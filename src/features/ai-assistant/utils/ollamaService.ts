/**
 * File: src/features/ai-assistant/utils/ollamaService.ts
 * 
 * Orchestrator service for interacting with Ollama local LLM API.
 * Uses PromptBuilder, ResponseParser, and ToolExecutionService.
 */

import type { ToolDefinition, ToolContext } from './toolsRegistry';
import { isFileCreationRequest, parseFileCreationRequest } from './fileCreationFallback';
import type { ToolExecutionInfo } from '../components/ToolExecutionCard';
import type { ReasoningStep } from '../components/ReasoningChain';
import { PromptBuilder } from '../services/PromptBuilder';
import { ResponseParser } from '../services/ResponseParser';
import { ToolExecutionService } from '../services/ToolExecutionService';

// Re-export types for compatibility
export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
  stream?: boolean;
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2:3b',
  temperature: 0.7,
  stream: false,
};

let ollamaConfig: OllamaConfig = { ...DEFAULT_CONFIG };

export function initializeOllamaClient(config: Partial<OllamaConfig>): void {
  ollamaConfig = { ...DEFAULT_CONFIG, ...config };
}

export function getOllamaConfig(): OllamaConfig {
  return { ...ollamaConfig };
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_call_id?: string;
}

interface OllamaToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

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

function convertMessagesToOllamaFormat(
  messages: Array<{ role: string; content: any }>
): OllamaMessage[] {
  return messages.map(msg => {
    // Handle complex content (like tool use arrays from Anthropic format)
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

    // Handle tool results
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

    // Default string content
    return {
      role: msg.role as 'user' | 'assistant' | 'system',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    };
  });
}

/**
 * Main orchestrator function
 */
export async function processCommandWithOllama(
  command: string,
  currentDirectory: string,
  directoryAnalysis: any,
  settings: any,
  tools: ToolDefinition[],
  systemPrompt: string, // Kept for signature compatibility
  skillContext?: string,
  abortSignal?: AbortSignal,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ content: string; operation?: any; metadata?: any }> {

  // 1. Determine Needs
  const needsTools = PromptBuilder.commandNeedsTools(command);
  const modelToUse = settings.ollamaModel || settings.model || ollamaConfig.model;
  const baseUrlToUse = settings.ollamaBaseUrl || ollamaConfig.baseUrl || 'http://localhost:11434';

  // 2. Build User Prompt
  const userPrompt = PromptBuilder.buildUserPrompt(
    command,
    currentDirectory,
    directoryAnalysis,
    needsTools,
    conversationHistory
  );

  // 3. Select System Prompt
  const effectiveSystemPrompt = PromptBuilder.buildSystemPrompt(
    systemPrompt,
    needsTools,
    settings,
    tools,
    skillContext
  );

  const context: ToolContext = {
    currentDirectory,
    settings,
    directoryAnalysis,
  };

  // 4. Prepare Messages
  const messages: OllamaMessage[] = [
    { role: 'system', content: effectiveSystemPrompt },
  ];

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-10);
    // Be careful not to double-add if we are using the new convert logic which might be strict
    // but here we just push formatted history
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: userPrompt });

  let finalResponse = '';
  let operation: any;
  const toolExecutions: ToolExecutionInfo[] = [];
  const reasoningSteps: ReasoningStep[] = [];
  let maxIterations = 10;
  let iteration = 0;
  let stepCounter = 1;

  try {
    const ollamaTools = needsTools ? convertToolsToOllamaFormat(tools) : [];

    while (iteration < maxIterations) {
      if (abortSignal?.aborted) throw new Error('Request aborted');

      // Call API
      const response = await fetch(`${baseUrlToUse}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          messages: convertMessagesToOllamaFormat(messages),
          tools: needsTools && ollamaTools.length > 0 ? ollamaTools : undefined,
          temperature: settings.creativityLevel === 'conservative' ? 0.3 : settings.creativityLevel === 'balanced' ? 0.7 : 1.0,
          stream: false,
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes('does not support tools')) {
          throw new Error(`MODEL_TOOLS_NOT_SUPPORTED:${modelToUse}:${errorText}`);
        }
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.message) throw new Error('Invalid response from Ollama API');

      const assistantMessage = data.message;
      const toolCalls = assistantMessage.tool_calls || assistantMessage.tools || [];

      if (toolCalls && toolCalls.length > 0) {
        // Tool execution path
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function?.name || toolCall.name;
          const toolArgsString = toolCall.function?.arguments || toolCall.arguments || '{}';

          let toolArgs: any;
          try {
            toolArgs = typeof toolArgsString === 'string' ? JSON.parse(toolArgsString) : toolArgsString;
          } catch (e) {
            console.error('Failed to parse tool arguments:', e);
            toolArgs = {};
          }

          // Reasoning: Selection
          const selectionStep = ToolExecutionService.createToolSelectionStep(stepCounter++, toolName, toolArgs);
          reasoningSteps.push(selectionStep);

          // Execute
          const { result, executionInfo } = await ToolExecutionService.executeToolCall(toolName, toolArgs, context);

          toolExecutions.push(executionInfo);
          if (result.operation) operation = result.operation;
          if (toolName === 'analyze_directory' && result.success && result.data) {
            context.directoryAnalysis = result.data;
          }

          // Reasoning: Result update
          selectionStep.result = result.success ? 'success' : 'error';
          if (result.success && result.data) {
            const dataSummary = typeof result.data === 'object'
              ? JSON.stringify(result.data).substring(0, 200) + '...'
              : String(result.data).substring(0, 200);
            selectionStep.content += ` Result: ${dataSummary}`;
          } else {
            selectionStep.content += ` Error: ${result.error}`;
          }

          // Reasoning: Analysis
          if (result.success && result.data) {
            reasoningSteps.push(ToolExecutionService.createAnalysisStep(stepCounter++, toolName));
          }

          // Add result to history
          messages.push({
            role: 'user',
            content: result.success ? JSON.stringify(result.data || { success: true }) : `Error: ${result.error}`,
            tool_call_id: toolCall.id || toolCall.function?.id || `tool_${Date.now()}`,
          });
        }
      } else {
        // Text response path
        const text = assistantMessage.content || '';
        const cleanedText = ResponseParser.cleanResponse(text);

        if (cleanedText.length > 0) {
          finalResponse += cleanedText + '\n\n';
          messages.push({ role: 'assistant', content: cleanedText });
        }
        break; // Done
      }
      iteration++;
    }

    // Direct File Creation Fallback
    if (isFileCreationRequest(command)) {
      const wrote = toolExecutions.filter((e) => e.tool === 'write_file_content');
      if (wrote.length === 0 && currentDirectory) {
        const items = parseFileCreationRequest(command);
        if (items.length > 0) {
          const created: string[] = [];
          for (const item of items) {
            const params = {
              path: item.fileName,
              content: item.content || '',
              createDirectories: true,
              overwrite: false,
            };
            const { result, executionInfo } = await ToolExecutionService.executeToolCall('write_file_content', params, context);
            toolExecutions.push(executionInfo);
            if (result.success) created.push(item.fileName);
          }
          if (created.length > 0) {
            finalResponse += `\nI also created ${created.length} file(s) for you directly: ${created.join(', ')}.`;
          }
        }
      }
    }

    // Conclusion
    if (reasoningSteps.length > 0) {
      reasoningSteps.push(ToolExecutionService.createConclusionStep(stepCounter++));
    }

    return {
      content: finalResponse.trim() || 'I processed your request.',
      operation,
      metadata: {
        model: modelToUse,
        provider: 'ollama',
        toolsUsed: toolExecutions.length,
        toolExecutions,
        reasoningSteps,
      },
    };

  } catch (error: any) {
    if (error.message?.includes('MODEL_TOOLS_NOT_SUPPORTED')) {
      // Fallback logic for models without tools (simplified)
      return {
        content: `⚠️ **Model Compatibility Issue**\n\nThe model **${settings.ollamaModel}** does not support function calling. Please switch to a compatible model like \`llama3.2:3b\`.`,
        metadata: { isError: true, errorType: 'model_tools_not_supported' }
      };
    }
    throw error;
  }
}

// Since we don't have ollamaConnection file, we should keep them if they are small, or move them.
// The original file had them at the end. For safety, I will implement them here again to avoid breaking imports.

export async function testOllamaConnection(config: Partial<OllamaConfig>): Promise<{ valid: boolean; message: string }> {
  // ... implementation same as original ...
  try {
    const testConfig = { ...DEFAULT_CONFIG, ...config };
    const response = await fetch(`${testConfig.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: testConfig.model,
        messages: [{ role: 'user', content: 'Say "OK"' }],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { valid: false, message: `Connection failed: ${response.status} - ${errorText}` };
    }
    const data = await response.json();
    if (data.message && data.message.content) {
      return { valid: true, message: 'Ollama connection successful!' };
    }
    return { valid: false, message: 'Invalid response from Ollama' };
  } catch (error: any) {
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return { valid: false, message: 'Cannot connect to Ollama. Make sure Ollama is running.' };
    }
    return { valid: false, message: error.message || 'Failed to test Ollama connection' };
  }
}

export async function listOllamaModels(baseUrl: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
    if (!response.ok) throw new Error(`Failed to list models: ${response.statusText}`);
    const data = await response.json();
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((model: any) => model.name);
    }
    return [];
  } catch (error: any) {
    console.error('Failed to list Ollama models:', error);
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      throw new Error('Connection refused. Is Ollama running?');
    }
    throw error;
  }
}

export async function checkOllamaConnection(baseUrl: string = 'http://localhost:11434'): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/`, { method: 'HEAD' });
    return response.ok || response.status === 404;
  } catch (error) {
    return false;
  }
}
