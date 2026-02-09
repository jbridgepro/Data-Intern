/**
 * File: src/features/ai-assistant/utils/ollamaService.ts
 * 
 * Orchestrator service for interacting with Ollama local LLM API.
 * Uses PromptBuilder, ResponseParser, and ToolExecutionService.
 */

import type { ToolDefinition, ToolContext } from './toolsRegistry';
import {
  isFileCreationRequest,
  parseFileCreationRequest,
  isCompositeCreationRequest,
  parseCompositeCreationRequest,
  isFolderCreationRequest,
  parseFolderCreationRequest,
  needsFileTypeClarification,
} from './fileCreationFallback';
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

function detectFileTypeReply(command: string): string | null {
  const raw = command.trim().toLowerCase();
  const plain = raw.replace(/^\.+/, '');
  const map: Record<string, string> = {
    txt: 'txt',
    text: 'txt',
    docx: 'docx',
    doc: 'docx',
    word: 'docx',
    md: 'md',
    markdown: 'md',
    pdf: 'pdf',
    rtf: 'rtf',
    csv: 'csv',
    xlsx: 'xlsx',
    xls: 'xls',
  };
  return map[plain] || null;
}

function parseCountFromText(text: string): number | null {
  const lower = text.toLowerCase();
  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const numberMatch = lower.match(/(\d+)\s+(?:files?|documents?)/i);
  if (numberMatch?.[1]) return Math.max(1, parseInt(numberMatch[1], 10));
  const wordMatch = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:files?|documents?)\b/i);
  if (wordMatch?.[1]) return wordMap[wordMatch[1]] || 1;
  return null;
}

function extractPendingCompositeContext(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): { folderName: string; count: number } | null {
  if (!conversationHistory || conversationHistory.length === 0) return null;

  let folderName: string | null = null;
  let count: number | null = null;

  for (let i = conversationHistory.length - 1; i >= 0; i -= 1) {
    const msg = conversationHistory[i];
    const content = msg.content || '';

    if (msg.role === 'assistant') {
      if (/what\s+type\s+of\s+files?/i.test(content)) {
        const folderMatch = content.match(/folder\s+"([^"]+)"/i);
        if (folderMatch?.[1]) folderName = folderMatch[1].trim();
      }
    }

    if (msg.role === 'user') {
      if (/folder|directory/i.test(content) && /document|file/i.test(content)) {
        if (!folderName) {
          const folderMatch =
            content.match(/(?:folder|directory)\s+(?:called|named|titled)\s+["']?([^"']+)["']?/i) ||
            content.match(/(?:folder|directory)\s+["']?([^"']+)["']?/i);
          if (folderMatch?.[1]) folderName = folderMatch[1].trim();
        }
        if (count === null) {
          count = parseCountFromText(content);
        }
      }
    }

    if (folderName && count !== null) break;
  }

  if (!folderName) return null;
  return { folderName, count: count || 1 };
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
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk?: (chunk: string) => void,
  progressCallbacks?: {
    onToolExecutions?: (tools: ToolExecutionInfo[]) => void;
    onReasoningSteps?: (steps: ReasoningStep[]) => void;
  }
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

  let finalResponse = '';
  let operation: any;
  const toolExecutions: ToolExecutionInfo[] = [];
  const reasoningSteps: ReasoningStep[] = [];

  // Shortcut: user is replying with a file type for a pending composite request.
  const fileTypeReply = detectFileTypeReply(command);
  if (fileTypeReply) {
    const pending = extractPendingCompositeContext(conversationHistory);
    if (pending && currentDirectory) {
      const folderPath = `${currentDirectory}/${pending.folderName}`;
      const { result: folderResult, executionInfo: folderInfo } = await ToolExecutionService.executeToolCall(
        'create_directory',
        { path: folderPath },
        context
      );
      toolExecutions.push(folderInfo);
      progressCallbacks?.onToolExecutions?.([...toolExecutions]);

      const createdFiles: string[] = [];
      const errors: string[] = [];
      for (let i = 1; i <= pending.count; i += 1) {
        const fileName = `Document ${i}.${fileTypeReply}`;
        const filePath = `${folderPath}/${fileName}`;
        const { result: fileResult, executionInfo: fileInfo } = await ToolExecutionService.executeToolCall(
          'write_file_content',
          { path: filePath, content: '', createDirectories: true, overwrite: false },
          context
        );
        toolExecutions.push(fileInfo);
        progressCallbacks?.onToolExecutions?.([...toolExecutions]);
        if (fileResult.success) createdFiles.push(fileName);
        else if (fileResult.error) errors.push(fileResult.error);
      }

      let responseText = `Created ${createdFiles.length} file(s) in "${pending.folderName}": ${createdFiles.join(', ')}.`;
      if (errors.length > 0) responseText += ` ${errors.length} failed: ${errors.join('; ')}`;

      return {
        content: responseText,
        operation,
        metadata: {
          model: modelToUse,
          provider: 'ollama',
          toolsUsed: toolExecutions.length,
          toolExecutions,
          reasoningSteps,
        },
      };
    }
  }

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
          keep_alive: -1, // Keep model loaded permanently for faster responses
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Check for various error messages indicating tool support issues
        if (errorText.includes('does not support tools') ||
          errorText.includes('tool calling') ||
          errorText.includes('function calling') ||
          errorText.includes('tools not supported')) {
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
          progressCallbacks?.onReasoningSteps?.([...reasoningSteps]);

          // Execute
          const { result, executionInfo } = await ToolExecutionService.executeToolCall(toolName, toolArgs, context);

          toolExecutions.push(executionInfo);
          progressCallbacks?.onToolExecutions?.([...toolExecutions]);
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
            progressCallbacks?.onReasoningSteps?.([...reasoningSteps]);
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
          // Stream the response if callback is provided
          if (onChunk) {
            onChunk(cleanedText);
          }
          finalResponse += cleanedText + '\n\n';
          messages.push({ role: 'assistant', content: cleanedText });
        }
        break; // Done
      }
      iteration++;
    }

    // ========== DIRECT CREATION FALLBACK (Native Tool Mode) ==========
    // Handles cases where the AI didn't properly call tools for folder/file creation
    // BUT: Skip fallback if file type clarification is needed - let AI ask the user
    const executedToolsCountNative = toolExecutions.length;
    const requiresClarification = needsFileTypeClarification(command);
    const isCompositeRequestNative = isCompositeCreationRequest(command);

    const hasCreatedFolderNative = (folderName?: string): boolean => {
      const createdFolders = toolExecutions.filter(
        (e) => e.tool === 'create_directory' || e.tool === 'folder_creation_tab'
      );
      if (!folderName) return createdFolders.length > 0;
      return createdFolders.some((exec) => {
        const params = exec.params || {};
        if (Array.isArray(params.folderNames) && params.folderNames.includes(folderName)) {
          return true;
        }
        const path = typeof params.path === 'string' ? params.path : '';
        return path === folderName || path.endsWith(`/${folderName}`);
      });
    };

    if (requiresClarification && isCompositeRequestNative) {
      // For composite requests, create the folder now and ask about file types.
      if (currentDirectory) {
        const parsed = parseCompositeCreationRequest(command);
        const folder = parsed.folders[0];
        if (folder && !hasCreatedFolderNative(folder.folderName)) {
          const folderPath = `${currentDirectory}/${folder.folderName}`;
          const { result: folderResult, executionInfo: folderInfo } = await ToolExecutionService.executeToolCall(
            'create_directory',
            { path: folderPath },
            context
          );
          toolExecutions.push(folderInfo);
          if (folderResult.success) {
            finalResponse = `Done! I created the folder: 📁 ${folder.folderName}`;
          }
        }
      }
      console.log('[Native Fallback] Clarification needed for file types - delaying file creation.');
    } else if (requiresClarification) {
      console.log('[Native Fallback] File type clarification needed - skipping auto-execution');
      // Don't auto-execute - the AI should ask the user what file type they want
    }
    // Check for composite folder+file requests first
    else if (isCompositeRequestNative) {
      const createdFolders = toolExecutions.filter((e) => e.tool === 'create_directory' || e.tool === 'folder_creation_tab');
      const createdFiles = toolExecutions.filter((e) => e.tool === 'write_file_content');

      if ((createdFolders.length === 0 || createdFiles.length === 0) && currentDirectory) {
        console.log('[Native Fallback] Composite creation request detected, executing directly...');
        const parsed = parseCompositeCreationRequest(command);
        const createdItems: string[] = [];

        for (const folder of parsed.folders) {
          const folderPath = `${currentDirectory}/${folder.folderName}`;
          let folderResult = { success: true };
          if (!hasCreatedFolderNative(folder.folderName)) {
            const exec = await ToolExecutionService.executeToolCall(
              'create_directory',
              { path: folderPath },
              context
            );
            folderResult = exec.result;
            toolExecutions.push(exec.executionInfo);
          }

          if (folderResult.success) {
            createdItems.push(`📁 ${folder.folderName}`);
            for (const file of folder.filesInside) {
              const filePath = `${folderPath}/${file.fileName}`;
              const { result: fileResult, executionInfo: fileInfo } = await ToolExecutionService.executeToolCall(
                'write_file_content',
                { path: filePath, content: file.content || '', createDirectories: true },
                context
              );
              toolExecutions.push(fileInfo);
              if (fileResult.success) {
                createdItems.push(`  📄 ${file.fileName}`);
              }
            }
          }
        }

        if (createdItems.length > 0) {
          finalResponse = `Done! I created:\n${createdItems.join('\n')}`;
        }
      }
    }
    // Check for folder-only creation requests (folders don't need type clarification)
    else if (isFolderCreationRequest(command) && !isCompositeCreationRequest(command)) {
      const createdFolders = toolExecutions.filter((e) => e.tool === 'create_directory' || e.tool === 'folder_creation_tab');

      if (createdFolders.length === 0 && currentDirectory) {
        console.log('[Native Fallback] Folder creation request detected, executing directly...');
        const folder = parseFolderCreationRequest(command);
        if (folder) {
          const folderPath = `${currentDirectory}/${folder.folderName}`;
          const { result, executionInfo } = await ToolExecutionService.executeToolCall(
            'create_directory',
            { path: folderPath },
            context
          );
          toolExecutions.push(executionInfo);
          if (result.success) {
            finalResponse = `Done! I created the folder: 📁 ${folder.folderName}`;
          }
        }
      }
    }
    // Check for file-only creation requests (only if type is clear)
    else if (isFileCreationRequest(command)) {
      const wrote = toolExecutions.filter((e) => e.tool === 'write_file_content');
      if (wrote.length === 0 && currentDirectory) {
        console.log('[Native Fallback] File creation request detected, executing directly...');
        const items = parseFileCreationRequest(command);
        if (items.length > 0) {
          const created: string[] = [];
          for (const item of items) {
            const params = {
              path: `${currentDirectory}/${item.fileName}`,
              content: item.content || '',
              createDirectories: true,
              overwrite: false,
            };
            const { result, executionInfo } = await ToolExecutionService.executeToolCall('write_file_content', params, context);
            toolExecutions.push(executionInfo);
            if (result.success) created.push(item.fileName);
          }
          if (created.length > 0) {
            finalResponse = `Done! I created ${created.length} file(s): ${created.join(', ')}`;
          }
        }
      }
    }

    // If we executed fallback tools and there's no response yet, generate one
    if (toolExecutions.length > executedToolsCountNative && (!finalResponse || finalResponse.trim().length === 0)) {
      finalResponse = 'Done! I completed the operation.';
    }

    // ========== HALLUCINATION CHECK (Native Mode) ==========
    // Check if AI claims to have created files but no tools were executed
    const aiClaimsCreation = /(?:created|made|generated|wrote)\s+(?:the\s+)?(?:file|folder|directory|document)/i.test(finalResponse);
    const actuallyExecutedTools = toolExecutions.length > 0;

    if (aiClaimsCreation && !actuallyExecutedTools) {
      console.log('[Hallucination Detection] AI claimed creation but no tools executed. Checking for fallback...');

      // Force fallback check for creation commands
      if (isFolderCreationRequest(command) || isFileCreationRequest(command) || isCompositeCreationRequest(command)) {
        // We'll let the fallback logic below handle it
        console.log('[Hallucination Detection] Valid creation request detected, proceeding to fallback logic.');
      } else {
        // If it's not a clear creation request but AI claimed it, it might have been a confirmation
        // "yes" -> "I created the file"
        if (/^(yes|confirm|proceed)/i.test(command)) {
          console.log('[Hallucination Detection] Confirmation detected. Attempting to infer operation from context.');

          if (!currentDirectory) {
            console.warn('[Hallucination Fix] Cannot auto-create file: No current directory selected.');
            finalResponse += `\n(System: I wanted to create the file, but no folder is selected. Please select a folder first.)`;
          } else {
            // This complicates things as we don't have the context here easily without re-parsing history
            // But we can try to parse the AI's response to see what it *thought* it created
            // e.g. "I created the file test.docx"
            const fileMatch = finalResponse.match(/(?:created|made|wrote).*?([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)/i);
            if (fileMatch && fileMatch[1]) {
              const fileName = fileMatch[1];
              console.log(`[Hallucination Fix] Found filename "${fileName}" in AI response. Triggering creation.`);
              const params = {
                path: `${currentDirectory}/${fileName}`,
                content: '',
                createDirectories: true
              };
              const { result, executionInfo } = await ToolExecutionService.executeToolCall('write_file_content', params, context);
              toolExecutions.push(executionInfo);
              if (result.success) {
                finalResponse += `\n(System message: I verified the file "${fileName}" was created successfully.)`;
              }
            }
          }
        }
      }
    }

    // ========== CLARIFICATION OVERRIDE (Native Mode) ==========
    // If clarification was needed but the AI didn't ask (it just claimed to create files),
    // override the response with a clarification prompt.
    // Trigger when: no tools executed OR all tools failed
    const successfulFileCreations = toolExecutions.filter(
      exec => exec.tool === 'write_file_content' && exec.status === 'success' && exec.result?.success
    );
    const shouldAskClarification = requiresClarification && successfulFileCreations.length === 0;

    if (shouldAskClarification) {
      const alreadyAsking = /what\s+(?:type|kind|format)\s+(?:of\s+)?(?:file|document)/i.test(finalResponse);

      if (!alreadyAsking) {
        console.log('[Native Fallback] Clarification needed. Forcing clarification prompt.');

        // Parse the request to get folder and file names for the clarification message
        if (isCompositeRequestNative) {
          const parsed = parseCompositeCreationRequest(command);
          if (parsed.folders.length > 0) {
            const folder = parsed.folders[0];
            const folderCreated = hasCreatedFolderNative(folder.folderName);
            const folderLine = folderCreated
              ? `I created the folder "${folder.folderName}".`
              : `I can add the documents inside "${folder.folderName}".`;
            finalResponse = `${folderLine}\n\nWhat type of files would you like for the documents inside?\n- **.txt** - Plain text\n- **.docx** - Word document\n- **.md** - Markdown\n- Or tell me another format`;
          } else {
            finalResponse = `What type of file would you like to create?\n- **.txt** - Plain text\n- **.docx** - Word document\n- **.md** - Markdown\n- Or tell me another format`;
          }
        } else {
          finalResponse = `What type of file would you like to create?\n- **.txt** - Plain text\n- **.docx** - Word document\n- **.md** - Markdown\n- Or tell me another format`;
        }
      }
    }

    // Conclusion
    if (reasoningSteps.length > 0) {
      reasoningSteps.push(ToolExecutionService.createConclusionStep(stepCounter++));
      progressCallbacks?.onReasoningSteps?.([...reasoningSteps]);
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
      // Fallback to JSON command mode for models without native function calling
      console.log(`Model ${modelToUse} doesn't support native function calling. Falling back to JSON command mode.`);
      return await processCommandWithJsonMode(
        command,
        currentDirectory,
        directoryAnalysis,
        settings,
        tools,
        skillContext,
        abortSignal,
        conversationHistory,
        progressCallbacks
      );
    }

    console.error('Ollama processing error:', error);
    return {
      content: `I encountered an error during processing: ${error.message || 'Unknown error'}`,
      operation,
      metadata: {
        model: modelToUse,
        provider: 'ollama',
        toolsUsed: toolExecutions.length,
        toolExecutions,
        reasoningSteps,
        isError: true
      },
    };
  }
}

/**
 * Processes a command using JSON command mode for models that don't support native function calling.
 * The model outputs JSON commands in text, which we parse and execute.
 */
async function processCommandWithJsonMode(
  command: string,
  currentDirectory: string,
  directoryAnalysis: any,
  settings: any,
  tools: ToolDefinition[],
  skillContext?: string,
  abortSignal?: AbortSignal,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  progressCallbacks?: {
    onToolExecutions?: (tools: ToolExecutionInfo[]) => void;
    onReasoningSteps?: (steps: ReasoningStep[]) => void;
  }
): Promise<{ content: string; operation?: any; metadata?: any }> {
  const modelToUse = settings.ollamaModel || settings.model || ollamaConfig.model;
  const baseUrlToUse = settings.ollamaBaseUrl || ollamaConfig.baseUrl || 'http://localhost:11434';

  // Use JSON command mode prompt
  const systemPrompt = PromptBuilder.buildJsonSystemPrompt(tools, settings, skillContext);
  const userPrompt = PromptBuilder.buildUserPrompt(
    command,
    currentDirectory,
    directoryAnalysis,
    true, // needsTools
    conversationHistory
  );

  const context: ToolContext = {
    currentDirectory,
    settings,
    directoryAnalysis,
  };

  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (conversationHistory && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-10);
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
    while (iteration < maxIterations) {
      if (abortSignal?.aborted) throw new Error('Request aborted');

      // Call API without tools parameter (since model doesn't support it)
      const response = await fetch(`${baseUrlToUse}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          messages: convertMessagesToOllamaFormat(messages),
          temperature: settings.creativityLevel === 'conservative' ? 0.3 : settings.creativityLevel === 'balanced' ? 0.7 : 1.0,
          stream: false,
          keep_alive: -1, // Keep model loaded permanently for faster responses
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.message) throw new Error('Invalid response from Ollama API');

      const assistantMessage = data.message;
      const textResponse = assistantMessage.content || '';

      // Try to parse JSON commands from the response
      const jsonCommand = ResponseParser.parseJsonCommand(textResponse);

      if (jsonCommand && jsonCommand.tool) {
        // Found a JSON command - execute it
        const toolName = jsonCommand.tool;
        const toolArgs = jsonCommand.arguments || {};

        // Capture the natural language part of the response (Part 1)
        const cleanedText = ResponseParser.cleanResponse(textResponse);
        if (cleanedText.length > 0) {
          finalResponse += cleanedText + '\n\n';
        }

        // Reasoning: Selection
        const selectionStep = ToolExecutionService.createToolSelectionStep(stepCounter++, toolName, toolArgs);
        reasoningSteps.push(selectionStep);
        progressCallbacks?.onReasoningSteps?.([...reasoningSteps]);

        // Execute tool
        const { result, executionInfo } = await ToolExecutionService.executeToolCall(toolName, toolArgs, context);

        toolExecutions.push(executionInfo);
        progressCallbacks?.onToolExecutions?.([...toolExecutions]);
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

        // Add result to conversation
        messages.push({
          role: 'assistant',
          content: textResponse, // Keep the original response for context
        });
        messages.push({
          role: 'user',
          content: result.success
            ? `Tool execution result: ${JSON.stringify(result.data || { success: true })}`
            : `Tool execution error: ${result.error}`,
        });

        // Continue loop to get next response
        iteration++;
        continue;
      } else {
        // No JSON command found - this is a text response
        const cleanedText = ResponseParser.cleanResponse(textResponse);

        if (cleanedText.length > 0) {
          finalResponse += cleanedText + '\n\n';
          messages.push({ role: 'assistant', content: cleanedText });
        }

        // Check if we should continue (maybe the model is describing what it will do)
        // If it mentions tools but didn't output JSON, we might need to prompt again
        const mentionsTools = /(?:use|call|execute|run).*(?:tool|function|command)/i.test(textResponse);
        if (mentionsTools && toolExecutions.length === 0 && iteration < maxIterations - 1) {
          // Model mentioned tools but didn't output JSON - prompt it to actually do it
          messages.push({
            role: 'user',
            content: 'You mentioned using tools, but I need you to output a JSON command block. Please output a JSON block with "tool" and "arguments" fields to execute the tool.',
          });
          iteration++;
          continue;
        }

        break; // Done
      }
    }

    // ========== DIRECT CREATION FALLBACK ==========
    // Handles cases where the AI didn't properly call tools for folder/file creation
    // BUT: Skip fallback if file type clarification is needed - let AI ask the user
    const executedToolsCount = toolExecutions.length;
    const requiresClarificationJson = needsFileTypeClarification(command);
    const isCompositeRequestJson = isCompositeCreationRequest(command);

    const hasCreatedFolderJson = (folderName?: string): boolean => {
      const createdFolders = toolExecutions.filter(
        (e) => e.tool === 'create_directory' || e.tool === 'folder_creation_tab'
      );
      if (!folderName) return createdFolders.length > 0;
      return createdFolders.some((exec) => {
        const params = exec.params || {};
        if (Array.isArray(params.folderNames) && params.folderNames.includes(folderName)) {
          return true;
        }
        const path = typeof params.path === 'string' ? params.path : '';
        return path === folderName || path.endsWith(`/${folderName}`);
      });
    };

    if (requiresClarificationJson && isCompositeRequestJson) {
      if (currentDirectory) {
        const parsed = parseCompositeCreationRequest(command);
        const folder = parsed.folders[0];
        if (folder && !hasCreatedFolderJson(folder.folderName)) {
          const folderPath = `${currentDirectory}/${folder.folderName}`;
          const { result: folderResult, executionInfo: folderInfo } = await ToolExecutionService.executeToolCall(
            'create_directory',
            { path: folderPath },
            context
          );
          toolExecutions.push(folderInfo);
          if (folderResult.success) {
            finalResponse = `Done! I created the folder: 📁 ${folder.folderName}`;
          }
        }
      }
      console.log('[JSON Fallback] Clarification needed for file types - delaying file creation.');
    } else if (requiresClarificationJson) {
      console.log('[JSON Fallback] File type clarification needed - skipping auto-execution');
      // Don't auto-execute - the AI should ask the user what file type they want
    }
    // Check for composite folder+file requests first (e.g., "make folder X and add document Y inside")
    else if (isCompositeRequestJson) {
      const createdFolders = toolExecutions.filter((e) => e.tool === 'create_directory' || e.tool === 'folder_creation_tab');
      const createdFiles = toolExecutions.filter((e) => e.tool === 'write_file_content');

      // Only do fallback if the AI didn't already create the folder and file
      if ((createdFolders.length === 0 || createdFiles.length === 0) && currentDirectory) {
        console.log('[Fallback] Composite creation request detected, executing directly...');
        const parsed = parseCompositeCreationRequest(command);
        const createdItems: string[] = [];

        for (const folder of parsed.folders) {
          // Create the folder first if needed
          const folderPath = `${currentDirectory}/${folder.folderName}`;
          let folderResult = { success: true };
          if (!hasCreatedFolderJson(folder.folderName)) {
            const exec = await ToolExecutionService.executeToolCall(
              'create_directory',
              { path: folderPath },
              context
            );
            folderResult = exec.result;
            toolExecutions.push(exec.executionInfo);
          }

          if (folderResult.success) {
            createdItems.push(`📁 ${folder.folderName}`);

            // Create files inside the folder
            for (const file of folder.filesInside) {
              const filePath = `${folderPath}/${file.fileName}`;
              const { result: fileResult, executionInfo: fileInfo } = await ToolExecutionService.executeToolCall(
                'write_file_content',
                { path: filePath, content: file.content || '', createDirectories: true },
                context
              );
              toolExecutions.push(fileInfo);

              if (fileResult.success) {
                createdItems.push(`  📄 ${file.fileName}`);
              }
            }
          }
        }

        if (createdItems.length > 0) {
          finalResponse = `Done! I created:\n${createdItems.join('\n')}`;
        }
      }
    }
    // Check for folder-only creation requests (folders don't need type clarification)
    else if (isFolderCreationRequest(command) && !isCompositeCreationRequest(command)) {
      const createdFolders = toolExecutions.filter((e) => e.tool === 'create_directory' || e.tool === 'folder_creation_tab');

      if (createdFolders.length === 0 && currentDirectory) {
        console.log('[Fallback] Folder creation request detected, executing directly...');
        const folder = parseFolderCreationRequest(command);
        if (folder) {
          const folderPath = `${currentDirectory}/${folder.folderName}`;
          const { result, executionInfo } = await ToolExecutionService.executeToolCall(
            'create_directory',
            { path: folderPath },
            context
          );
          toolExecutions.push(executionInfo);

          if (result.success) {
            finalResponse = `Done! I created the folder: 📁 ${folder.folderName}`;
          }
        }
      }
    }
    // Check for file-only creation requests (only if type is clear)
    else if (isFileCreationRequest(command)) {
      const wrote = toolExecutions.filter((e) => e.tool === 'write_file_content');
      if (wrote.length === 0 && currentDirectory) {
        console.log('[Fallback] File creation request detected, executing directly...');
        const items = parseFileCreationRequest(command);
        if (items.length > 0) {
          const created: string[] = [];
          for (const item of items) {
            const params = {
              path: `${currentDirectory}/${item.fileName}`,
              content: item.content || '',
              createDirectories: true,
              overwrite: false,
            };
            const { result, executionInfo } = await ToolExecutionService.executeToolCall('write_file_content', params, context);
            toolExecutions.push(executionInfo);
            if (result.success) created.push(item.fileName);
          }
          if (created.length > 0) {
            finalResponse = `Done! I created ${created.length} file(s): ${created.join(', ')}`;
          }
        }
      }
    }

    // If we executed fallback tools and there's no response yet, generate one
    if (toolExecutions.length > executedToolsCount && (!finalResponse || finalResponse.trim().length === 0)) {
      const lastTool = toolExecutions[toolExecutions.length - 1];
      if (lastTool.result?.success) {
        finalResponse = 'Done! I completed the operation.';
      } else {
        finalResponse = `I encountered an error: ${lastTool.result?.error || 'Unknown error'}`;
      }
    }

    // ========== HALLUCINATION CHECK (JSON Mode) ==========
    const aiClaimsCreationJson = /(?:created|made|generated|wrote)\s+(?:the\s+)?(?:file|folder|directory|document)/i.test(finalResponse);
    const actuallyExecutedToolsJson = toolExecutions.length > 0;

    if (aiClaimsCreationJson && !actuallyExecutedToolsJson) {
      console.log('[Hallucination Detection JSON] AI claimed creation but no tools executed.');
      // Similar recovery logic could go here, but for now we'll rely on the Fallback logic above 
      // which usually catches these cases if they match the patterns
      if (!finalResponse.includes("System message")) { // Avoid double stamping
        if (!currentDirectory) {
          console.warn('[Hallucination Fix JSON] Cannot auto-create file: No current directory selected.');
          finalResponse += `\n(System: I cannot create the file because no folder is selected.)`;
        } else {
          // Check if we can rescue it
          const fileMatch = finalResponse.match(/(?:created|made|wrote).*?([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)/i);
          if (fileMatch && fileMatch[1]) {
            const fileName = fileMatch[1];
            console.log(`[Hallucination Fix JSON] Found filename "${fileName}" in AI response. Triggering creation.`);
            const params = {
              path: `${currentDirectory}/${fileName}`,
              content: '',
              createDirectories: true
            };
            const { result, executionInfo } = await ToolExecutionService.executeToolCall('write_file_content', params, context);
            toolExecutions.push(executionInfo);
            if (result.success) {
              finalResponse += `\n(System: Verified and created "${fileName}")`;
            }
          }
        }
      }

      // Conclusion
    } // end of while loop

    // ========== CLARIFICATION OVERRIDE (JSON Mode) ==========
    // If clarification is needed and no files were actually created, ask for file type.
    const successfulFileCreationsJson = toolExecutions.filter(
      exec => exec.tool === 'write_file_content' && exec.status === 'success' && exec.result?.success
    );
    const shouldAskClarificationJson = requiresClarificationJson && successfulFileCreationsJson.length === 0;

    if (shouldAskClarificationJson) {
      const alreadyAskingJson = /what\s+(?:type|kind|format)\s+(?:of\s+)?(?:file|document)/i.test(finalResponse);
      if (!alreadyAskingJson) {
        console.log('[JSON Fallback] Clarification needed. Forcing clarification prompt.');

        if (isCompositeRequestJson) {
          const parsed = parseCompositeCreationRequest(command);
          if (parsed.folders.length > 0) {
            const folder = parsed.folders[0];
            const folderCreated = hasCreatedFolderJson(folder.folderName);
            const folderLine = folderCreated
              ? `I created the folder "${folder.folderName}".`
              : `I can add the documents inside "${folder.folderName}".`;
            finalResponse = `${folderLine}\n\nWhat type of files would you like for the documents inside?\n- **.txt** - Plain text\n- **.docx** - Word document\n- **.md** - Markdown\n- Or tell me another format`;
          } else {
            finalResponse = `What type of file would you like to create?\n- **.txt** - Plain text\n- **.docx** - Word document\n- **.md** - Markdown\n- Or tell me another format`;
          }
        } else {
          finalResponse = `What type of file would you like to create?\n- **.txt** - Plain text\n- **.docx** - Word document\n- **.md** - Markdown\n- Or tell me another format`;
        }
      }
    }

    // Force return if loop finishes without returning
    return {
      content: finalResponse.trim() || 'I processed your request.',
      operation,
      metadata: {
        model: modelToUse,
        provider: 'ollama',
        toolsUsed: toolExecutions.length,
        toolExecutions,
        reasoningSteps,
        mode: 'json_command',
      },
    };

  } catch (error: any) {
    console.error('Error in JSON command mode:', error);
    return {
      content: `I encountered an error during processing: ${error.message || 'Unknown error'}`,
      operation,
      metadata: {
        model: modelToUse,
        provider: 'ollama',
        toolsUsed: toolExecutions.length,
        toolExecutions,
        reasoningSteps,
        mode: 'json_command',
        isError: true
      },
    };
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
        keep_alive: -1, // Keep model loaded permanently for faster responses
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
