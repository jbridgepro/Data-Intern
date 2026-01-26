/**
 * File: src/features/ai-assistant/utils/ollamaService.ts
 * 
 * Service for interacting with Ollama local LLM API.
 * Supports Llama 3.2 3B and other Ollama models with function calling.
 */

import type { ToolDefinition, ToolContext, ToolResult } from './toolsRegistry';
import { executeTool } from './toolsRegistry';
import { executeMCPTool, isMCPTool, parseMCPToolName } from './mcpIntegration';
import type { ToolExecutionInfo } from '../components/ToolExecutionCard';
import type { ReasoningStep } from '../components/ReasoningChain';
import { getConversationalSystemPrompt, generateJsonCommandModePrompt } from './aiGuidelines';

/**
 * Ollama API configuration
 */
export interface OllamaConfig {
  baseUrl: string; // Default: http://localhost:11434
  model: string; // Default: llama3.2:3b
  temperature?: number;
  stream?: boolean;
}

/**
 * Default Ollama configuration
 */
const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2:3b',
  temperature: 0.7,
  stream: false,
};

let ollamaConfig: OllamaConfig = { ...DEFAULT_CONFIG };

/**
 * Initializes Ollama client configuration.
 */
export function initializeOllamaClient(config: Partial<OllamaConfig>): void {
  ollamaConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

/**
 * Gets the current Ollama configuration.
 */
export function getOllamaConfig(): OllamaConfig {
  return { ...ollamaConfig };
}

/**
 * Ollama message format
 */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_call_id?: string;
}

/**
 * Ollama tool call format
 */
interface OllamaToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Ollama tool definition format
 */
interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Converts Anthropic tool definitions to Ollama format.
 */
function convertToolsToOllamaFormat(tools: ToolDefinition[]): OllamaTool[] {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: tool.input_schema.properties,
        required: tool.input_schema.required || [],
      },
    },
  }));
}

/**
 * Converts Anthropic messages to Ollama format.
 */
function convertMessagesToOllamaFormat(
  messages: Array<{ role: string; content: any }>
): OllamaMessage[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
    }

    // Handle tool use (assistant message with tool calls)
    if (Array.isArray(msg.content)) {
      const textParts: string[] = [];
      const toolCalls: OllamaToolCall[] = [];

      for (const item of msg.content) {
        if (item.type === 'text') {
          textParts.push(item.text);
        } else if (item.type === 'tool_use') {
          toolCalls.push({
            id: item.id,
            type: 'function',
            function: {
              name: item.name,
              arguments: JSON.stringify(item.input),
            },
          });
        }
      }

      return {
        role: 'assistant',
        content: textParts.join('\n'),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    }

    // Handle tool results (user message with tool_call_id)
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const toolResult = msg.content.find((c: any) => c.type === 'tool_result');
      if (toolResult) {
        return {
          role: 'user',
          content: typeof toolResult.content === 'string'
            ? toolResult.content
            : JSON.stringify(toolResult.content),
          tool_call_id: toolResult.tool_use_id,
        };
      }
    }

    return {
      role: msg.role as 'user' | 'assistant' | 'system',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    };
  });
}

/**
 * Processes a user command using Ollama with tool use support.
 */
/**
 * Determines if a command likely needs tools based on keywords and intent.
 */
function commandNeedsTools(command: string): boolean {
  const lowerCommand = command.toLowerCase().trim();

  // Simple greetings and conversational queries don't need tools
  const simpleQueries = [
    'hi', 'hello', 'hey', 'how are you', 'what\'s up', 'good morning',
    'good afternoon', 'good evening', 'thanks', 'thank you', 'bye', 'goodbye'
  ];

  if (simpleQueries.some(query => lowerCommand === query || lowerCommand.startsWith(query + ' '))) {
    return false;
  }

  // Commands that likely need tools
  const toolKeywords = [
    'organize', 'organize files', 'sort', 'move', 'copy', 'delete', 'rename',
    'find', 'search', 'duplicate', 'analyze', 'create', 'generate', 'list',
    'show', 'display', 'count', 'size', 'folder', 'file', 'directory', 'project'
  ];

  return toolKeywords.some(keyword => lowerCommand.includes(keyword));
}

export async function processCommandWithOllama(
  command: string,
  currentDirectory: string,
  directoryAnalysis: any,
  settings: any,
  tools: ToolDefinition[],
  systemPrompt: string,
  abortSignal?: AbortSignal,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ content: string; operation?: any; metadata?: any }> {
  // Only include tools if the command likely needs them
  const needsTools = commandNeedsTools(command);

  // Use the model from settings, not the global config
  // This ensures we use the currently selected model from the UI
  const modelToUse = settings.ollamaModel || settings.model || ollamaConfig.model;
  const baseUrlToUse = settings.ollamaBaseUrl || ollamaConfig.baseUrl || 'http://localhost:11434';

  // Determine system prompt
  let effectiveSystemPrompt = systemPrompt;
  if (!needsTools) {
    effectiveSystemPrompt = getConversationalSystemPrompt(settings.aiName, settings.userName);
  }

  const userPrompt = buildUserPrompt(command, currentDirectory, directoryAnalysis, needsTools, conversationHistory);

  const context: ToolContext = {
    currentDirectory,
    settings,
    directoryAnalysis,
  };

  // Build initial messages with conversation history
  const messages: OllamaMessage[] = [
    {
      role: 'system',
      content: effectiveSystemPrompt,
    },
  ];
  
  // Add conversation history (last 10 messages to avoid token limits)
  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-10); // Last 10 messages
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }
  
  // Add current user message
  messages.push({
    role: 'user',
    content: userPrompt,
  });

  let finalResponse = '';
  let operation: any;
  const toolExecutions: ToolExecutionInfo[] = [];
  const reasoningSteps: any[] = [];
  let maxIterations = 10;
  let iteration = 0;
  let stepCounter = 1;

  try {
    const ollamaTools = needsTools ? convertToolsToOllamaFormat(tools) : [];

    while (iteration < maxIterations) {
      // Check if request was aborted
      if (abortSignal?.aborted) {
        throw new Error('Request aborted');
      }

      // Create a timeout promise (60 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout: Ollama took too long to respond')), 60000);
      });

      // Call Ollama API - use the model from settings, not global config
      const fetchPromise = fetch(`${baseUrlToUse}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse, // Use the model from settings
          messages: convertMessagesToOllamaFormat(messages),
          // Only include tools if we determined the command needs them
          // This allows models without tool support to still handle simple queries
          tools: needsTools && ollamaTools.length > 0 ? ollamaTools : undefined,
          temperature: settings.creativityLevel === 'conservative' ? 0.3
            : settings.creativityLevel === 'balanced' ? 0.7
              : 1.0,
          stream: false,
        }),
        signal: abortSignal, // Support cancellation
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Ollama API error: ${response.status} - ${errorText}`;

        // Check for "does not support tools" error
        if (errorText.includes('does not support tools') || errorText.includes('does not support tool')) {
          errorMessage = `MODEL_TOOLS_NOT_SUPPORTED:${modelToUse}:${errorText}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.message) {
        throw new Error('Invalid response from Ollama API');
      }

      const assistantMessage = data.message;
      let hasToolCalls = false;

      // Process tool calls if present
      // Note: Ollama function calling support varies by model
      // Some models use tool_calls, others might use different formats
      const toolCalls = assistantMessage.tool_calls || assistantMessage.tools || [];

      if (toolCalls && toolCalls.length > 0) {
        hasToolCalls = true;

        // Add assistant message with tool calls to conversation
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: toolCalls,
        });

        // Execute each tool call
        for (const toolCall of toolCalls) {
          // Handle different tool call formats
          const toolName = toolCall.function?.name || toolCall.name;
          const toolArgsString = toolCall.function?.arguments || toolCall.arguments || '{}';

          if (!toolName) {
            console.warn('Invalid tool call format:', toolCall);
            continue;
          }

          let toolArgs: any;

          try {
            toolArgs = typeof toolArgsString === 'string'
              ? JSON.parse(toolArgsString)
              : toolArgsString;
          } catch (e) {
            console.error('Failed to parse tool arguments:', e);
            toolArgs = {};
          }

          // Add reasoning step for tool selection
          reasoningSteps.push({
            id: `reasoning-${stepCounter}`,
            step: stepCounter++,
            type: 'tool_selection',
            content: `I'll use the ${toolName} tool to ${getToolDescription(toolName, toolArgs)}.`,
            timestamp: Date.now(),
            toolUsed: toolName,
            result: 'pending',
          });

          // Create tool execution info
          const execution: ToolExecutionInfo = {
            tool: toolName,
            description: getToolDescription(toolName, toolArgs),
            params: toolArgs,
            status: 'running',
          };
          toolExecutions.push(execution);

          // Execute the tool
          let toolResult: ToolResult;

          if (isMCPTool(toolName)) {
            // Execute MCP tool
            const parsed = parseMCPToolName(toolName);
            if (parsed) {
              toolResult = await executeMCPTool(parsed.server, parsed.tool, toolArgs);
            } else {
              toolResult = {
                success: false,
                error: `Invalid MCP tool name: ${toolName}`,
              };
            }
          } else {
            // Execute custom tool
            toolResult = await executeTool(toolName, toolArgs, context);
          }

          // Update execution status
          execution.status = toolResult.success ? 'success' : 'error';
          execution.result = toolResult;

          // Update reasoning step with result
          const lastReasoningStep = reasoningSteps[reasoningSteps.length - 1];
          if (lastReasoningStep && lastReasoningStep.toolUsed === toolName) {
            lastReasoningStep.result = toolResult.success ? 'success' : 'error';
            if (toolResult.success && toolResult.data) {
              const dataSummary = typeof toolResult.data === 'object'
                ? JSON.stringify(toolResult.data).substring(0, 200) + '...'
                : String(toolResult.data).substring(0, 200);
              lastReasoningStep.content += ` Result: ${dataSummary}`;
            } else if (!toolResult.success) {
              lastReasoningStep.content += ` Error: ${toolResult.error}`;
            }
          }

          // Add reasoning step for analysis of results
          if (toolResult.success && toolResult.data) {
            reasoningSteps.push({
              id: `reasoning-${stepCounter}`,
              step: stepCounter++,
              type: 'analysis',
              content: `Analyzing the results from ${toolName} to determine next steps...`,
              timestamp: Date.now(),
            });
          }

          // Add tool result to conversation
          const toolCallId = toolCall.id || toolCall.function?.id || `tool_${Date.now()}`;
          messages.push({
            role: 'user',
            content: toolResult.success
              ? JSON.stringify(toolResult.data || { success: true })
              : `Error: ${toolResult.error}`,
            tool_call_id: toolCallId,
          });

          // Store operation if tool returned one
          if (toolResult.operation) {
            operation = toolResult.operation;
          }

          // Update context if we got new directory analysis
          if (toolName === 'analyze_directory' && toolResult.success && toolResult.data) {
            context.directoryAnalysis = toolResult.data;
          }
        }
      } else {
        // No tool calls, just text response
        let text = assistantMessage.content || '';
        
        // Filter out JSON command blocks and technical details from user-facing responses
        // Remove JSON code blocks that show tool definitions
        text = text.replace(/```json\s*\{[^}]*"tool"[^}]*\}[^`]*```/gi, '');
        text = text.replace(/```json\s*\{[\s\S]*?"tool"[\s\S]*?\}[\s\S]*?```/gi, '');
        
        // Remove standalone JSON blocks that look like tool commands
        text = text.replace(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g, '');
        
        // Remove phrases that introduce JSON blocks
        text = text.replace(/Here's a (sample )?command block in JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/Here's the JSON (command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/You can use this JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/Here's (an )?example (JSON )?(command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/I'll show you the JSON (command|format|block)[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/Here's how to (do|execute) it in JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/To use a tool, (you|we) (can|need to|must) (use|output|provide) (this|the following) JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/We'll need to (use|output|provide) (this|the following) JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/The (JSON|command) (format|block|structure) (is|would be|looks like):[\s\S]*?```json[\s\S]*?```/gi, '');
        text = text.replace(/In JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');
        
        // Remove any remaining standalone JSON blocks (even without "tool" key)
        text = text.replace(/```json\s*\{[\s\S]*?"(foldersCreated|filesProcessed|count|totalFiles|arguments)"[\s\S]*?\}[\s\S]*?```/gi, '');
        
        // Remove phrases that mention JSON without showing it
        text = text.replace(/I can (show|provide|give) you the JSON (command|format|block)[\s\S]*?\./gi, '');
        text = text.replace(/Here's (a|an) (sample|example) (JSON )?(command|format|block)[\s\S]*?\./gi, '');
        
        // Clean up multiple newlines
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/^\s*\n/gm, ''); // Remove lines with only whitespace
        text = text.trim();
        
        if (text.length > 0) {
          finalResponse += text + '\n\n';
          messages.push({
            role: 'assistant',
            content: text,
          });
        }

        // If we got a text response and no tool calls, we're done
        break;
      }

      iteration++;
    }

    // Generate implementation plan if we have tool executions
    let implementationPlan: any = null;
    if (toolExecutions.length > 0) {
      const { generatePlanFromToolExecutions } = await import('../voice/utils/planGenerator');
      implementationPlan = generatePlanFromToolExecutions(command, toolExecutions);
    }

    // Add final conclusion reasoning step
    if (reasoningSteps.length > 0 && finalResponse.trim()) {
      reasoningSteps.push({
        id: `reasoning-${stepCounter}`,
        step: stepCounter++,
        type: 'conclusion',
        content: 'Completed processing. Preparing final response for the user.',
        timestamp: Date.now(),
      });
    }

    // Final cleanup of response - remove any remaining JSON blocks or technical details
    let cleanedResponse = finalResponse.trim();
    
    // Remove any remaining JSON command blocks (multiple patterns to catch all variations)
    cleanedResponse = cleanedResponse.replace(/```json\s*\{[^}]*"tool"[^}]*\}[^`]*```/gi, '');
    cleanedResponse = cleanedResponse.replace(/```json\s*\{[\s\S]*?"tool"[\s\S]*?\}[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/```json[\s\S]*?"tool"[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g, '');
    
    // Remove phrases introducing JSON blocks
    cleanedResponse = cleanedResponse.replace(/Here's a (sample )?command block in JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/Here's the JSON (command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/You can use this JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/Here's (an )?example (JSON )?(command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/I'll show you the JSON (command|format|block)[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/Here's how to (do|execute) it in JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/To use a tool, (you|we) (can|need to|must) (use|output|provide) (this|the following) JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/We'll need to (use|output|provide) (this|the following) JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
    
    // Remove "Tool Execution Result" JSON blocks
    cleanedResponse = cleanedResponse.replace(/\*\*Tool Execution Result:\*\*[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/Tool Execution Result:[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/\*\*Tool Execution Result:\*\*[\s\S]*?\{[\s\S]*?\}/gi, '');
    cleanedResponse = cleanedResponse.replace(/Tool Execution Result:[\s\S]*?\{[\s\S]*?\}/gi, '');
    
    // Remove standalone JSON result blocks
    cleanedResponse = cleanedResponse.replace(/```json\s*\{[\s\S]*?"foldersCreated"[\s\S]*?\}[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/```json\s*\{[\s\S]*?"filesProcessed"[\s\S]*?\}[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/```json\s*\{[\s\S]*?"count"[\s\S]*?\}[\s\S]*?```/gi, '');
    
    // Remove references to JSON in explanations
    cleanedResponse = cleanedResponse.replace(/The (JSON|command) (format|block|structure) (is|would be|looks like):[\s\S]*?```json[\s\S]*?```/gi, '');
    cleanedResponse = cleanedResponse.replace(/In JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');
    
    // Remove empty lines and clean up multiple newlines
    cleanedResponse = cleanedResponse.replace(/\n{3,}/g, '\n\n');
    cleanedResponse = cleanedResponse.replace(/^\s*\n/gm, ''); // Remove lines with only whitespace
    cleanedResponse = cleanedResponse.trim();

    return {
      content: cleanedResponse || 'I processed your request using available tools.',
      operation,
      metadata: {
        model: modelToUse, // Use the actual model that was used
        provider: 'ollama',
        toolsUsed: toolExecutions.length,
        toolExecutions,
        implementationPlan,
        reasoningSteps, // Include reasoning chain for display
      },
    };
  } catch (error: any) {
    console.error('Ollama API error:', error);

    // Check if request was aborted or timed out
    if (error.message?.includes('aborted') || error.name === 'AbortError') {
      throw error; // Re-throw to be handled by caller
    }

    if (error.message?.includes('timeout') || error.message?.includes('took too long')) {
      return {
        content: '⏱️ **Request Timeout**\n\n' +
          'The request took too long to complete (over 60 seconds). This might happen if:\n\n' +
          '• The model is slow or overloaded\n' +
          '• Ollama is processing a large request\n' +
          '• Network issues\n\n' +
          '**Try:**\n' +
          '1. Check if Ollama is running properly\n' +
          '2. Try a simpler query\n' +
          '3. Check your Ollama logs for errors\n' +
          '4. Try cancelling and sending again',
        metadata: {
          isError: true,
          errorType: 'timeout',
        },
      };
    }

    // Check if Ollama is running
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return {
        content: 'Cannot connect to Ollama. Please make sure Ollama is running and accessible at ' + baseUrlToUse,
      };
    }

    // Check for model not found error
    if (error.message?.includes('model') && error.message?.includes('not found')) {
      return {
        content: `⚠️ **Model Not Found**\n\n` +
          `The model **${modelToUse}** is not available in Ollama.\n\n` +
          `**To fix this:**\n` +
          `1. Pull the model: \`ollama pull ${modelToUse}\`\n` +
          `2. Or select a different model from the dropdown\n` +
          `3. Make sure Ollama is running and the model is available\n\n` +
          `**Available models:** Check your Ollama installation or use the model selector to see available models.`,
        metadata: {
          isError: true,
          errorType: 'model_not_found',
          requestedModel: modelToUse,
        },
      };
    }

    // Check for "does not support tools" error
    if (error.message?.includes('MODEL_TOOLS_NOT_SUPPORTED')) {
      const parts = error.message.split(':');
      const modelName = parts[1] || modelToUse;

      // If this was a simple query that shouldn't need tools, retry without tools
      if (!needsTools) {
        // Check if request was aborted before retrying
        if (abortSignal?.aborted) {
          throw new Error('Request aborted');
        }

        // Retry the request without tools
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout: Ollama took too long to respond')), 60000);
          });

          const retryFetchPromise = fetch(`${baseUrlToUse}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelToUse, // Use the model from settings
              messages: convertMessagesToOllamaFormat(messages),
              // No tools this time
              temperature: settings.creativityLevel === 'conservative' ? 0.3
                : settings.creativityLevel === 'balanced' ? 0.7
                  : 1.0,
              stream: false,
            }),
            signal: abortSignal,
          });

          const retryResponse = await Promise.race([retryFetchPromise, timeoutPromise]);

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.message && retryData.message.content) {
              return {
                content: retryData.message.content,
                metadata: {
                  model: ollamaConfig.model,
                  provider: 'ollama',
                  toolsUsed: 0,
                  note: 'Response generated without tools (model does not support tools)',
                },
              };
            }
          }
        } catch (retryError) {
          // Fall through to show the error message
        }
      }

      // Fallback: Try JSON Command Mode for tool execution
      try {
        // Check abort signal
        if (abortSignal?.aborted) throw new Error('Request aborted');

        const jsonSystemPrompt = generateJsonCommandModePrompt(tools, settings.aiName, settings.userName);
        // Replace system prompt
        const jsonMessages = [
          { role: 'system', content: jsonSystemPrompt },
          ...messages.filter(m => m.role !== 'system')
        ];

        const jsonRetryResponse = await fetch(`${baseUrlToUse}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelToUse,
            messages: convertMessagesToOllamaFormat(jsonMessages as any),
            stream: false, // No streaming for JSON mode to ensure valid JSON
            // No 'tools' parameter here
            // Some models support json_mode or format: 'json', but safe to default to text
          }),
          signal: abortSignal
        });

        if (jsonRetryResponse.ok) {
          const data = await jsonRetryResponse.json();
          const content = data.message?.content || '';

          // Parse for JSON block
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*"tool"[\s\S]*}/);

          if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            try {
              const cmd = JSON.parse(jsonStr);
              if (cmd.tool && cmd.arguments) {
                // Simulate tool call
                const toolName = cmd.tool;
                const toolArgs = cmd.arguments;

                // Execute tool (similar logic to main loop)
                let toolResult: ToolResult;

                if (isMCPTool(toolName)) {
                  const parsed = parseMCPToolName(toolName);
                  if (parsed) {
                    toolResult = await executeMCPTool(parsed.server, parsed.tool, toolArgs);
                  } else {
                    toolResult = { success: false, error: `Invalid MCP tool name: ${toolName}` };
                  }
                } else {
                  toolResult = await executeTool(toolName, toolArgs, context);
                }

                // Format result in natural language instead of JSON
                let resultText = '';
                if (toolResult.success && toolResult.data) {
                  const data = toolResult.data;
                  // Format common tool results in user-friendly way
                  if (data.foldersCreated !== undefined) {
                    resultText = `Successfully created ${data.foldersCreated} folder${data.foldersCreated !== 1 ? 's' : ''}.`;
                  } else if (data.filesProcessed !== undefined) {
                    resultText = `Processed ${data.filesProcessed} file${data.filesProcessed !== 1 ? 's' : ''}.`;
                  } else if (data.count !== undefined) {
                    resultText = `Found ${data.count} item${data.count !== 1 ? 's' : ''}.`;
                  } else if (data.message) {
                    resultText = data.message;
                  } else {
                    resultText = 'Operation completed successfully.';
                  }
                } else {
                  resultText = `Error: ${toolResult.error || 'Operation failed'}`;
                }

                // Clean the content to remove JSON blocks
                let cleanedContent = content;
                cleanedContent = cleanedContent.replace(/```json\s*\{[^}]*"tool"[^}]*\}[^`]*```/gi, '');
                cleanedContent = cleanedContent.replace(/```json\s*\{[\s\S]*?"tool"[\s\S]*?\}[\s\S]*?```/gi, '');
                cleanedContent = cleanedContent.replace(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g, '');
                cleanedContent = cleanedContent.replace(/Here's a (sample )?command block in JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');
                cleanedContent = cleanedContent.replace(/Here's the JSON (command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
                cleanedContent = cleanedContent.trim();

                return {
                  content: cleanedContent ? `${cleanedContent}\n\n${resultText}` : resultText,
                  operation: toolResult.operation,
                  metadata: {
                    model: modelToUse,
                    provider: 'ollama',
                    toolsUsed: 1,
                    note: 'Executed via JSON Command Mode fallback',
                    toolExecutions: [{
                      tool: toolName,
                      params: toolArgs,
                      status: toolResult.success ? 'success' : 'error',
                      result: toolResult,
                      description: getToolDescription(toolName, toolArgs)
                    }]
                  }
                };
              }
            } catch (e) {
              console.error('Failed to parse JSON command:', e);
            }
          }

          // If no valid JSON command found, return text response
          return {
            content: content,
            metadata: {
              model: modelToUse,
              provider: 'ollama',
              toolsUsed: 0,
              note: 'Fallback to text response (JSON command parsing failed or none found)'
            }
          };
        }
      } catch (fallbackError) {
        console.error('JSON Command Mode fallback failed:', fallbackError);
      }

      return {
        content: `⚠️ **Model Compatibility Issue**\n\n` +
          `The model **${modelName}** does not support function calling (tools), which is required for AI-powered file operations.\n\n` +
          `I tried to force a command mode, but that also failed. Please switch to a model like \`llama3.2:3b\` or \`qwen2.5\` for full functionality.`,
        metadata: {
          isError: true,
          errorType: 'model_tools_not_supported',
          currentModel: modelName,
          recommendedModels: [
            'llama3.2:3b',
            'llama3.1:8b',
            'llama3.1:70b',
            'qwen2.5:7b',
            'qwen2.5:14b',
          ],
        },
      };
    }

    return {
      content: `I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
    };
  }
}

/**
 * Builds a prompt for the AI based on user command and context.
 */
function buildUserPrompt(
  command: string,
  currentDirectory: string,
  directoryAnalysis: any,
  needsTools: boolean = true,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  // For simple conversational queries, just use the command directly
  if (!needsTools) {
    return command;
  }
  
  // Detect if this is a confirmation response (yes, no, ok, sure, etc.)
  const isConfirmation = /^(yes|yeah|yep|yup|ok|okay|sure|alright|all right|go ahead|proceed|continue|do it|execute|confirm|approved?|agreed?)$/i.test(command.trim());
  const isRejection = /^(no|nope|nah|cancel|stop|abort|don't|dont)$/i.test(command.trim());
  
  // Detect if this is a question that requires immediate tool execution
  const isQuestion = /^(how many|how much|what|which|where|when|who|count|list|show|find|analyze)/i.test(command.trim());
  const needsAnalysis = /(pictures?|images?|files?|photos?|documents?|videos?|audio|size|space|count)/i.test(command);
  
  // For commands that need tools, include full context
  let prompt = `User command: "${command}"\n\n`;

  // Handle confirmation/rejection responses with context
  if (isConfirmation || isRejection) {
    if (conversationHistory && conversationHistory.length > 0) {
      // Find the last assistant message that asked for confirmation
      const lastAssistantMessage = [...conversationHistory].reverse().find(msg => msg.role === 'assistant');
      if (lastAssistantMessage) {
        const lastMessage = lastAssistantMessage.content;
        prompt += `CRITICAL CONTEXT: The user is responding "${command}" to your previous message where you asked for confirmation or approval.\n\n`;
        prompt += `Your previous message was: "${lastMessage.substring(0, 800)}"\n\n`;
        
        if (isConfirmation) {
          // Extract what operation was discussed
          const operationKeywords = {
            'organize': ['organize', 'organization', 'organizing', 'group', 'grouping'],
            'create folders': ['create', 'creating', 'folders', 'subfolders', 'directory', 'directories'],
            'move files': ['move', 'moving', 'relocate'],
            'rename': ['rename', 'renaming', 'rename files'],
            'delete': ['delete', 'deleting', 'remove', 'removing'],
          };
          
          let detectedOperation = '';
          for (const [op, keywords] of Object.entries(operationKeywords)) {
            if (keywords.some(kw => lastMessage.toLowerCase().includes(kw))) {
              detectedOperation = op;
              break;
            }
          }
          
          prompt += `ACTION REQUIRED: The user has confirmed/approved with "${command}".\n\n`;
          prompt += `You MUST immediately execute the operation you described. Do NOT just repeat information or ask again.\n\n`;
          
          if (detectedOperation) {
            prompt += `Based on your previous message, you were discussing: ${detectedOperation}.\n\n`;
            prompt += `IMMEDIATELY execute the appropriate tools to ${detectedOperation}:\n`;
            if (detectedOperation.includes('organize')) {
              prompt += `- Use 'organize_files' or 'folder_creation_tab' to create the folder structure\n`;
              prompt += `- Use 'move_file' or 'copy_file' to organize files into the new structure\n`;
            } else if (detectedOperation.includes('create folders')) {
              prompt += `- Use 'folder_creation_tab' or 'create_directory' to create the folders\n`;
            } else if (detectedOperation.includes('move')) {
              prompt += `- Use 'move_file' to move files to their new locations\n`;
            } else if (detectedOperation.includes('rename')) {
              prompt += `- Use 'rename_files' to rename the files\n`;
            }
            prompt += `\nDO NOT ask for permission again. DO NOT just describe what you would do. EXECUTE THE TOOLS NOW.\n\n`;
          } else {
            prompt += `IMMEDIATELY execute the tools you mentioned in your previous message. Do not repeat information - take action now.\n\n`;
          }
        } else {
          prompt += `The user has rejected/cancelled. Acknowledge this and ask if they'd like to try a different approach or cancel the operation.\n\n`;
        }
      }
    }
  }

  // Handle action commands (create, confirm, etc.) - treat them as confirmations
  const actionCommands: Record<string, string> = {
    'create': 'yes',
    'confirm': 'yes',
    'approve': 'yes',
    'proceed': 'yes',
    'go ahead': 'yes',
    'do it': 'yes',
    'execute': 'yes',
    'cancel': 'no',
    'stop': 'no',
    'abort': 'no',
  };

  const normalizedCommand = command.trim().toLowerCase();
  if (actionCommands[normalizedCommand] && !isConfirmation && !isRejection) {
    // Treat action commands as confirmations
    const action = actionCommands[normalizedCommand];
    if (conversationHistory && conversationHistory.length > 0) {
      const lastAssistantMessage = [...conversationHistory].reverse().find(msg => msg.role === 'assistant');
      if (lastAssistantMessage) {
        prompt += `CONTEXT: The user clicked a confirmation button or said "${command}" to approve the operation.\n\n`;
        prompt += `Your previous message was: "${lastAssistantMessage.content.substring(0, 800)}"\n\n`;
        
        if (action === 'yes') {
          prompt += `The user has confirmed/approved. Proceed with the operation you described. Execute the tools you mentioned and complete the task immediately.\n\n`;
        } else {
          prompt += `The user has rejected/cancelled. Acknowledge this and ask if they'd like to try a different approach.\n\n`;
        }
      }
    }
  }

  // Add instruction for direct action if it's a question
  if (isQuestion && needsAnalysis && !isConfirmation && !isRejection && !actionCommands[normalizedCommand]) {
    prompt += `IMPORTANT: This is a question that requires data. Execute the appropriate tool (e.g., analyze_directory) IMMEDIATELY to get the answer. Do not ask for permission or show JSON blocks - just execute and provide the direct answer.\n\n`;
  }

  if (currentDirectory) {
    prompt += `Current working directory: ${currentDirectory}\n\n`;
  }

  if (directoryAnalysis) {
    prompt += `Directory Analysis:\n`;
    prompt += `- Total files: ${directoryAnalysis.totalFiles}\n`;
    prompt += `- Total size: ${formatBytes(directoryAnalysis.totalSize)}\n`;
    prompt += `- Organization score: ${directoryAnalysis.organizationScore}/100\n\n`;

    if (directoryAnalysis.fileTypes && directoryAnalysis.fileTypes.length > 0) {
      prompt += `File types:\n`;
      directoryAnalysis.fileTypes.slice(0, 5).forEach((type: any) => {
        prompt += `- ${type.extension}: ${type.count} files (${formatBytes(type.totalSize)})\n`;
      });
      prompt += `\n`;
    }
  }

  prompt += `Please provide a helpful response and suggest file operations if appropriate. `;
  prompt += `Be specific about what will happen and always prioritize safety.`;

  return prompt;
}

/**
 * Formats bytes to human-readable format.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Gets a human-readable description for a tool execution.
 */
function getToolDescription(toolName: string, args: Record<string, any>): string {
  const descriptions: Record<string, (args: Record<string, any>) => string> = {
    'file_copy_tab': (args) =>
      `${args.operation || 'Copy'} files from ${args.sourcePath || 'source'} to ${args.destinationPath || 'destination'}`,
    'folder_creation_tab': (args) =>
      `Create ${args.folderNames?.length || 0} folders${args.subfolders?.length ? ` with ${args.subfolders.length} subfolders each` : ''}`,
    'file_creation_tab': (args) =>
      `Create ${args.count || 0} files with extensions: ${args.extensions?.join(', ') || ''}`,
    'find_replace_tab': (args) =>
      `${args.replaceQuery ? 'Find and replace' : 'Find'} "${args.searchQuery || ''}" in ${args.filePattern || 'all files'}`,
  };

  const descFn = descriptions[toolName];
  return descFn ? descFn(args) : `Execute ${toolName}`;
}

/**
 * Tests the Ollama connection by making a simple request.
 */
export async function testOllamaConnection(config: Partial<OllamaConfig>): Promise<{ valid: boolean; message: string }> {
  try {
    const testConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    const response = await fetch(`${testConfig.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: testConfig.model,
        messages: [
          {
            role: 'user',
            content: 'Say "OK"',
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        valid: false,
        message: `Connection failed: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    if (data.message && data.message.content) {
      return {
        valid: true,
        message: 'Ollama connection successful!',
      };
    }

    return {
      valid: false,
      message: 'Invalid response from Ollama',
    };
  } catch (error: any) {
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return {
        valid: false,
        message: 'Cannot connect to Ollama. Make sure Ollama is running.',
      };
    }
    return {
      valid: false,
      message: error.message || 'Failed to test Ollama connection',
    };
  }
}

/**
 * Lists available Ollama models.
 */
/**
 * Lists available Ollama models.
 */
export async function listOllamaModels(baseUrl: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((model: any) => model.name);
    }

    return [];
  } catch (error: any) {
    console.error('Failed to list Ollama models:', error);
    // Propagate the error with a friendly message
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      throw new Error('Connection refused. Is Ollama running?');
    }
    throw error;
  }
}

/**
 * Checks if Ollama is accessible.
 */
export async function checkOllamaConnection(baseUrl: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/`, { method: 'HEAD' });
    return response.ok || response.status === 404; // 404 is fine, means server is reachable
  } catch (error) {
    return false;
  }
}

