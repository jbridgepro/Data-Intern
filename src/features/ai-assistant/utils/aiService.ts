/**
 * File: src/features/ai-assistant/utils/aiService.ts
 * 
 * Service for interacting with AI providers (Anthropic Claude API and Ollama).
 * Handles AI-powered file organization suggestions and command processing.
 * Supports tool use for custom file operations and MCP tools.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AISettings, FileOperation, DirectoryAnalysis } from '../types';
import { getAllTools, executeTool, type ToolContext, type ToolResult } from './toolsRegistry';
import { executeMCPTool, isMCPTool, parseMCPToolName } from './mcpIntegration';
import { toolOrchestrator } from './toolOrchestrator';
import { generateSystemPrompt } from './aiGuidelines';
import type { ToolExecutionInfo } from '../components/ToolExecutionCard';
import type { ReasoningStep } from '../components/ReasoningChain';
import {
  initializeOllamaClient,
  processCommandWithOllama,
  testOllamaConnection,
  listOllamaModels
} from './ollamaService';

let anthropicClient: Anthropic | null = null;

/**
 * Initializes the AI client based on provider settings.
 */
export function initializeAIClient(settings: AISettings): void {
  if (settings.provider === 'anthropic') {
    // Initialize Anthropic client
    if (!settings.apiKey) {
      anthropicClient = null;
      return;
    }

    try {
      anthropicClient = new Anthropic({
        apiKey: settings.apiKey,
      });
    } catch (error) {
      console.error('Failed to initialize Anthropic client:', error);
      anthropicClient = null;
    }
  } else if (settings.provider === 'ollama') {
    // Initialize Ollama client
    initializeOllamaClient({
      baseUrl: settings.ollamaBaseUrl || 'http://localhost:11434',
      model: settings.ollamaModel || settings.model || 'llama3.2:3b',
    });
  }
}

/**
 * Gets the model name for Anthropic API based on settings.
 * Uses the latest Claude 4.5 series models.
 */
function getModelName(settings: AISettings): string {
  const modelMap: Record<string, string> = {
    'claude-sonnet': 'claude-sonnet-4-20250514', // Claude Sonnet 4.5
    'claude-opus': 'claude-opus-4-20250514', // Claude Opus 4.5
    'claude-haiku': 'claude-3-5-haiku-20241022', // Claude Haiku 4.5
  };
  return modelMap[settings.model] || modelMap['claude-sonnet'];
}

/**
 * Gets the temperature based on creativity level.
 */
function getTemperature(creativityLevel: AISettings['creativityLevel']): number {
  const tempMap = {
    'conservative': 0.3,
    'balanced': 0.7,
    'creative': 1.0,
  };
  return tempMap[creativityLevel];
}

/**
 * Formats tool results in natural language for user-facing responses.
 * Prevents raw JSON from being shown to users.
 */
function formatToolResultForUser(toolName: string, toolResult: ToolResult): string {
  if (!toolResult.success) {
    return `I encountered an error: ${toolResult.error || 'Unknown error'}.`;
  }

  if (!toolResult.data) {
    return 'Operation completed successfully.';
  }

  const data = toolResult.data;

  // Format common tool results
  switch (toolName) {
    case 'analyze_directory':
      if (data.totalFiles !== undefined) {
        const fileTypes = data.fileTypes || [];
        const imageTypes = fileTypes.filter((ft: any) => 
          ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic', 'heif'].includes(ft.extension?.toLowerCase())
        );
        if (imageTypes.length > 0) {
          const totalImages = imageTypes.reduce((sum: number, ft: any) => sum + (ft.count || 0), 0);
          return `Found ${totalImages} image file${totalImages !== 1 ? 's' : ''} in ${data.totalFiles} total file${data.totalFiles !== 1 ? 's' : ''}.`;
        }
        return `Found ${data.totalFiles} file${data.totalFiles !== 1 ? 's' : ''} in the directory.`;
      }
      break;

    case 'folder_creation_tab':
    case 'folder_creation':
      if (data.foldersCreated !== undefined) {
        return `Created ${data.foldersCreated} folder${data.foldersCreated !== 1 ? 's' : ''} successfully.`;
      }
      break;

    case 'file_creation_tab':
    case 'file_creation':
      if (data.filesCreated !== undefined) {
        return `Created ${data.filesCreated} file${data.filesCreated !== 1 ? 's' : ''} successfully.`;
      }
      break;

    case 'search_files':
      if (data.count !== undefined) {
        return `Found ${data.count} file${data.count !== 1 ? 's' : ''} matching your search.`;
      }
      break;

    case 'list_directory_contents':
      if (data.count !== undefined) {
        return `Listed ${data.count} item${data.count !== 1 ? 's' : ''} in the directory.`;
      }
      break;

    case 'calculate_directory_size':
      if (data.totalSizeFormatted) {
        return `Total directory size: ${data.totalSizeFormatted} (${data.fileCount} files, ${data.folderCount} folders).`;
      }
      break;

    case 'find_duplicates':
      if (data.totalDuplicates !== undefined) {
        return `Found ${data.totalDuplicates} duplicate file${data.totalDuplicates !== 1 ? 's' : ''}.`;
      }
      break;

    case 'delete_files':
      if (data.count !== undefined) {
        return `Deleted ${data.count} file${data.count !== 1 ? 's' : ''} successfully.`;
      }
      break;

    case 'organize_files':
      if (data.fileCount !== undefined) {
        return `Organized ${data.fileCount} file${data.fileCount !== 1 ? 's' : ''}.`;
      }
      break;

    case 'rename_files':
      if (data.fileCount !== undefined) {
        return `Renamed ${data.fileCount} file${data.fileCount !== 1 ? 's' : ''} successfully.`;
      }
      break;

    default:
      // Generic formatting for unknown tools
      if (data.message) {
        return data.message;
      }
      if (data.count !== undefined) {
        return `Processed ${data.count} item${data.count !== 1 ? 's' : ''}.`;
      }
      return 'Operation completed successfully.';
  }

  return 'Operation completed successfully.';
}

/**
 * Processes a user command using AI with tool use support.
 * The AI can call custom file operation tools and MCP tools.
 * Supports both Anthropic and Ollama providers.
 */
export async function processCommandWithAI(
  command: string,
  currentDirectory: string,
  directoryAnalysis: DirectoryAnalysis | null,
  settings: AISettings,
  abortSignal?: AbortSignal,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ content: string; operation?: FileOperation; metadata?: any }> {
  // Route to appropriate provider
  if (settings.provider === 'ollama') {
    return processCommandWithOllamaProvider(
      command,
      currentDirectory,
      directoryAnalysis,
      settings,
      abortSignal,
      conversationHistory
    );
  } else {
    // Default to Anthropic
    return processCommandWithAnthropicProvider(
      command,
      currentDirectory,
      directoryAnalysis,
      settings,
      abortSignal,
      conversationHistory
    );
  }
}

/**
 * Processes a user command using Anthropic Claude API.
 */
async function processCommandWithAnthropicProvider(
  command: string,
  currentDirectory: string,
  directoryAnalysis: DirectoryAnalysis | null,
  settings: AISettings,
  abortSignal?: AbortSignal,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ content: string; operation?: FileOperation; metadata?: any }> {
  if (!anthropicClient || !settings.apiKey) {
    return {
      content: 'Please configure your Anthropic API key in settings to use AI-powered features.',
    };
  }

  try {
    // Get all available tools (custom + MCP), filtered by settings
    const tools = await getAllTools(settings);
    const toolDefinitions = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));

    let systemPrompt = settings.systemPrompt;

    if (!systemPrompt) {
      systemPrompt = generateSystemPrompt(tools, { 
        clawdbotEnabled: settings.clawdbotEnabled,
        aiName: settings.aiName,
        userName: settings.userName
      });
    }

    const userPrompt = buildUserPrompt(command, currentDirectory, directoryAnalysis);
    const context: ToolContext = {
      currentDirectory,
      settings,
      directoryAnalysis,
    };

    // Build conversation history - include previous messages for context
    const messages: Anthropic.MessageParam[] = [];
    
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
    let operation: FileOperation | undefined;
    const toolExecutions: ToolExecutionInfo[] = [];
    const reasoningSteps: ReasoningStep[] = [];
    let maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    let stepCounter = 1;

    // Set up progress callbacks for tool orchestrator
    toolOrchestrator.setProgressCallback((step, total, tool, progress) => {
      // Update tool execution progress
      const execution = toolExecutions.find(e => e.tool === tool);
      if (execution) {
        execution.progress = progress;
        execution.status = 'running';
      }
    });

    toolOrchestrator.setStepCompleteCallback((step, tool, result) => {
      const execution = toolExecutions.find(e => e.tool === tool);
      if (execution) {
        execution.status = result.success ? 'success' : 'error';
        execution.result = result;
      }
    });

    while (iteration < maxIterations) {
      const response = await anthropicClient.messages.create({
        model: getModelName(settings),
        max_tokens: settings.maxTokens || 4096,
        temperature: getTemperature(settings.creativityLevel),
        system: systemPrompt,
        tools: toolDefinitions,
        messages,
      }, { signal: abortSignal });

      // Process the response
      for (const content of response.content) {
        if (content.type === 'text') {
          // Extract reasoning from text response
          const text = content.text;

          // Check if this looks like reasoning (contains "I need", "I'll", "Based on", etc.)
          const reasoningIndicators = [
            /I need to/i,
            /I'll/i,
            /I should/i,
            /Based on/i,
            /First, I'll/i,
            /Next, I'll/i,
            /Let me/i,
            /I'll start by/i,
            /I'll use/i,
            /I'm going to/i,
            /I will/i,
            /To accomplish/i,
            /The best approach/i,
            /I should first/i,
            /Let me analyze/i,
            /I'll check/i,
          ];

          const isReasoning = reasoningIndicators.some(pattern => pattern.test(text));

          // Extract reasoning steps from text (look for numbered steps or sequential reasoning)
          if (isReasoning) {
            // Check if this is planning/analysis before tool use
            if (iteration === 0 || text.length < 500) {
              // This is likely initial reasoning or planning
              const reasoningType = text.toLowerCase().includes('plan') || text.toLowerCase().includes('strategy')
                ? 'planning'
                : 'analysis';

              reasoningSteps.push({
                id: `reasoning-${stepCounter}`,
                step: stepCounter++,
                type: reasoningType,
                content: text,
                timestamp: Date.now(),
              });
            }
          }

          // Filter out JSON command blocks and technical details from user-facing responses
          let cleanedText = text;
          
          // Remove JSON code blocks that show tool definitions
          cleanedText = cleanedText.replace(/```json\s*\{[^}]*"tool"[^}]*\}[^`]*```/gi, '');
          cleanedText = cleanedText.replace(/```json\s*\{[\s\S]*?"tool"[\s\S]*?\}[\s\S]*?```/gi, '');
          
          // Remove standalone JSON blocks that look like tool commands
          cleanedText = cleanedText.replace(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g, '');
          
          // Remove phrases that introduce JSON blocks
          cleanedText = cleanedText.replace(/Here's a (sample )?command block in JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');
          cleanedText = cleanedText.replace(/Here's the JSON (command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
          cleanedText = cleanedText.replace(/You can use this JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
          cleanedText = cleanedText.replace(/Here's (an )?example (JSON )?(command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
          
          // Remove references to showing JSON
          cleanedText = cleanedText.replace(/I'll show you the JSON (command|format|block)[\s\S]*?```json[\s\S]*?```/gi, '');
          cleanedText = cleanedText.replace(/Here's how to (do|execute) it in JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
          cleanedText = cleanedText.replace(/To use a tool, (you|we) (can|need to|must) (use|output|provide) (this|the following) JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
          cleanedText = cleanedText.replace(/We'll need to (use|output|provide) (this|the following) JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
          cleanedText = cleanedText.replace(/The (JSON|command) (format|block|structure) (is|would be|looks like):[\s\S]*?```json[\s\S]*?```/gi, '');
          cleanedText = cleanedText.replace(/In JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');
          
          // Remove any remaining standalone JSON blocks (even without "tool" key)
          cleanedText = cleanedText.replace(/```json\s*\{[\s\S]*?"(foldersCreated|filesProcessed|count|totalFiles|arguments)"[\s\S]*?\}[\s\S]*?```/gi, '');
          
          // Remove phrases that mention JSON without showing it
          cleanedText = cleanedText.replace(/I can (show|provide|give) you the JSON (command|format|block)[\s\S]*?\./gi, '');
          cleanedText = cleanedText.replace(/Here's (a|an) (sample|example) (JSON )?(command|format|block)[\s\S]*?\./gi, '');
          
          // Clean up multiple newlines
          cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
          cleanedText = cleanedText.replace(/^\s*\n/gm, ''); // Remove lines with only whitespace
          
          // Only add to response if there's meaningful content left
          if (cleanedText.trim().length > 0) {
            finalResponse += cleanedText + '\n\n';
            messages.push({
              role: 'assistant',
              content: cleanedText,
            });
          }
        } else if (content.type === 'tool_use') {
          // AI wants to use a tool
          const toolName = content.name;
          const toolArgs = content.input;

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

          messages.push({
            role: 'assistant',
            content: content,
          });

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
              // Extract key information for reasoning
              let resultSummary = '';
              if (toolName === 'analyze_directory' && typeof toolResult.data === 'object') {
                const data = toolResult.data as any;
                if (data.fileTypes) {
                  const imageTypes = data.fileTypes.filter((ft: any) => 
                    ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic', 'heif'].includes(ft.extension?.toLowerCase())
                  );
                  if (imageTypes.length > 0) {
                    const totalImages = imageTypes.reduce((sum: number, ft: any) => sum + (ft.count || 0), 0);
                    resultSummary = `Found ${totalImages} image file(s)`;
                  } else {
                    resultSummary = `Found ${data.totalFiles || 0} file(s)`;
                  }
                } else {
                  resultSummary = `Analysis complete: ${data.totalFiles || 0} files`;
                }
              } else {
                const dataSummary = typeof toolResult.data === 'object'
                  ? JSON.stringify(toolResult.data).substring(0, 150) + '...'
                  : String(toolResult.data).substring(0, 150);
                resultSummary = `Result: ${dataSummary}`;
              }
              lastReasoningStep.content += ` ${resultSummary}`;
            } else if (!toolResult.success) {
              lastReasoningStep.content += ` Error: ${toolResult.error}`;
            }
          }

          // Add reasoning step for analysis of results (only if we need to process further)
          if (toolResult.success && toolResult.data && toolName === 'analyze_directory') {
            // Extract image count for "how many pictures" questions
            const data = toolResult.data as any;
            if (data.fileTypes) {
              const imageTypes = data.fileTypes.filter((ft: any) => 
                ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic', 'heif'].includes(ft.extension?.toLowerCase())
              );
              if (imageTypes.length > 0) {
                const totalImages = imageTypes.reduce((sum: number, ft: any) => sum + (ft.count || 0), 0);
                reasoningSteps.push({
                  id: `reasoning-${stepCounter}`,
                  step: stepCounter++,
                  type: 'analysis',
                  content: `Identified ${totalImages} image file(s) from the analysis results.`,
                  timestamp: Date.now(),
                });
              }
            }
          }

          // Add tool result to conversation
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: content.id,
                content: toolResult.success
                  ? JSON.stringify(toolResult.data || { success: true })
                  : `Error: ${toolResult.error}`,
              },
            ],
          });

          // Store operation if tool returned one
          if (toolResult.operation) {
            operation = toolResult.operation;
          }

          // Update context if we got new directory analysis
          if (toolName === 'analyze_directory' && toolResult.success && toolResult.data) {
            context.directoryAnalysis = toolResult.data as DirectoryAnalysis;
          }
        }
      }

      // Check if we should continue (AI might want to use more tools)
      const lastContent = response.content[response.content.length - 1];
      if (lastContent.type === 'text') {
        // AI finished with a text response, we're done
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
        model: settings.model,
        toolsUsed: toolExecutions.length,
        toolExecutions, // Include tool execution details for UI
        implementationPlan, // Include plan for approval
        reasoningSteps, // Include reasoning chain for display
      },
    };
  } catch (error: any) {
    console.error('AI API error:', error);

    if (error.status === 401) {
      return {
        content: 'Invalid API key. Please check your API key in settings.',
      };
    }

    if (error.status === 429) {
      return {
        content: 'Rate limit exceeded. Please try again in a moment.',
      };
    }

    return {
      content: `I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
    };
  }
}

/**
 * Processes a user command using Ollama local LLM.
 */
async function processCommandWithOllamaProvider(
  command: string,
  currentDirectory: string,
  directoryAnalysis: DirectoryAnalysis | null,
  settings: AISettings,
  abortSignal?: AbortSignal,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ content: string; operation?: FileOperation; metadata?: any }> {
  try {
    // Get all available tools (custom + MCP), filtered by settings
    const tools = await getAllTools(settings);

    let systemPrompt = settings.systemPrompt;

    if (!systemPrompt) {
      systemPrompt = generateSystemPrompt(tools, { 
        clawdbotEnabled: settings.clawdbotEnabled,
        aiName: settings.aiName,
        userName: settings.userName
      });
    }

    return await processCommandWithOllama(
      command,
      currentDirectory,
      directoryAnalysis,
      settings,
      tools,
      systemPrompt,
      abortSignal,
      conversationHistory
    );
  } catch (error: any) {
    console.error('Ollama processing error:', error);
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
  directoryAnalysis: DirectoryAnalysis | null,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  // Detect if this is a confirmation response (yes, no, ok, sure, etc.)
  const isConfirmation = /^(yes|yeah|yep|yup|ok|okay|sure|alright|all right|go ahead|proceed|continue|do it|execute|confirm|approved?|agreed?)$/i.test(command.trim());
  const isRejection = /^(no|nope|nah|cancel|stop|abort|don't|dont)$/i.test(command.trim());
  
  // Detect if this is a question that requires immediate tool execution
  const isQuestion = /^(how many|how much|what|which|where|when|who|count|list|show|find|analyze)/i.test(command.trim());
  const needsAnalysis = /(pictures?|images?|files?|photos?|documents?|videos?|audio|size|space|count)/i.test(command);
  
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
            'create files': ['create', 'creating', 'files', 'file', 'generate', 'generating', 'make', 'making'],
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
            } else if (detectedOperation.includes('create files') || detectedOperation.includes('create file')) {
              prompt += `- Use 'file_creation_tab' to create the files\n`;
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

    if (directoryAnalysis.fileTypes.length > 0) {
      prompt += `File types:\n`;
      directoryAnalysis.fileTypes.slice(0, 5).forEach(type => {
        prompt += `- ${type.extension}: ${type.count} files (${formatBytes(type.totalSize)})\n`;
      });
      prompt += `\n`;
    }
  }

  if (!isConfirmation && !isRejection) {
    prompt += `Please provide a helpful response and suggest file operations if appropriate. `;
    prompt += `Be specific about what will happen and always prioritize safety.`;
  }

  return prompt;
}

/**
 * Uses AI to analyze directory and suggest organization strategies.
 * Supports both Anthropic and Ollama providers.
 */
export async function suggestOrganizationStrategy(
  directoryAnalysis: DirectoryAnalysis,
  settings: AISettings
): Promise<string> {
  if (settings.provider === 'ollama') {
    // Use Ollama for suggestions
    try {
      const prompt = `Based on this directory analysis, suggest the best organization strategy:

Total files: ${directoryAnalysis.totalFiles}
Total size: ${formatBytes(directoryAnalysis.totalSize)}
Organization score: ${directoryAnalysis.organizationScore}/100

File types:
${directoryAnalysis.fileTypes.slice(0, 10).map(t =>
        `- ${t.extension}: ${t.count} files (${formatBytes(t.totalSize)})`
      ).join('\n')}

Provide a brief suggestion (2-3 sentences) on how to organize these files.`;

      const baseUrl = settings.ollamaBaseUrl || 'http://localhost:11434';
      const model = settings.ollamaModel || settings.model || 'llama3.2:3b';

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.message && data.message.content) {
          return data.message.content;
        }
      }
    } catch (error) {
      console.error('Error getting Ollama suggestion:', error);
    }
    return generateFallbackSuggestion(directoryAnalysis);
  } else {
    // Use Anthropic for suggestions
    if (!anthropicClient || !settings.apiKey) {
      return generateFallbackSuggestion(directoryAnalysis);
    }

    try {
      const prompt = `Based on this directory analysis, suggest the best organization strategy:

Total files: ${directoryAnalysis.totalFiles}
Total size: ${formatBytes(directoryAnalysis.totalSize)}
Organization score: ${directoryAnalysis.organizationScore}/100

File types:
${directoryAnalysis.fileTypes.slice(0, 10).map(t =>
        `- ${t.extension}: ${t.count} files (${formatBytes(t.totalSize)})`
      ).join('\n')}

Provide a brief suggestion (2-3 sentences) on how to organize these files.`;

      const response = await anthropicClient.messages.create({
        model: getModelName(settings),
        max_tokens: 500,
        temperature: getTemperature(settings.creativityLevel),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      return generateFallbackSuggestion(directoryAnalysis);
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      return generateFallbackSuggestion(directoryAnalysis);
    }
  }
}

/**
 * Generates a fallback suggestion when AI is not available.
 */
function generateFallbackSuggestion(analysis: DirectoryAnalysis): string {
  const topType = analysis.fileTypes[0];
  if (topType && topType.percentage > 50) {
    return `Most files are ${topType.extension} files. Consider organizing by file type to improve structure.`;
  }
  return `Your directory has ${analysis.totalFiles} files. Consider organizing by file type or date to improve organization.`;
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
 * Tests the API key or connection by making a simple request.
 * Supports both Anthropic and Ollama providers.
 */
export async function testAPIKey(
  apiKey: string | undefined,
  provider: 'anthropic' | 'ollama' = 'anthropic',
  ollamaConfig?: { baseUrl?: string; model?: string }
): Promise<{ valid: boolean; message: string }> {
  if (provider === 'ollama') {
    return testOllamaConnection({
      baseUrl: ollamaConfig?.baseUrl,
      model: ollamaConfig?.model,
    });
  } else {
    // Test Anthropic API key
    if (!apiKey) {
      return {
        valid: false,
        message: 'Please enter an API key',
      };
    }

    try {
      const testClient = new Anthropic({ apiKey });
      const response = await testClient.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Say "OK"',
          },
        ],
      });

      return {
        valid: true,
        message: 'API key is valid!',
      };
    } catch (error: any) {
      if (error.status === 401) {
        return {
          valid: false,
          message: 'Invalid API key',
        };
      }
      return {
        valid: false,
        message: error.message || 'Failed to test API key',
      };
    }
  }
}

/**
 * Lists available models for the specified provider.
 */
export async function listAvailableModels(
  provider: 'anthropic' | 'ollama',
  baseUrl?: string
): Promise<string[]> {
  if (provider === 'ollama') {
    return listOllamaModels(baseUrl);
  } else {
    // Anthropic models are fixed
    return ['claude-sonnet', 'claude-opus', 'claude-haiku'];
  }
}
