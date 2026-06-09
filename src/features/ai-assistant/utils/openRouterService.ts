/**
 * File: src/features/ai-assistant/utils/openRouterService.ts
 *
 * OpenRouter API service for accessing multiple AI models through a unified API.
 * Supports tool calling, streaming, and model fallbacks.
 *
 * OpenRouter provides access to:
 * - Anthropic Claude models
 * - OpenAI GPT models
 * - Google Gemini models
 * - Meta Llama models
 * - Mistral models
 * - And many more...
 */

import type {
  OpenRouterSettings,
  OpenRouterModel,
  ToolDefinition,
} from '../types';
import {
  DEFAULT_OPENROUTER_SETTINGS,
  OPENROUTER_POPULAR_MODELS,
} from '../types';
import { auditLogger } from './auditLogger';

/**
 * OpenRouter API base URL.
 */
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter message format.
 */
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenRouterContentPart[];
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
}

/**
 * Content part for multimodal messages.
 */
export interface OpenRouterContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * Tool call format.
 */
export interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool definition format for OpenRouter.
 */
export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

/**
 * Chat completion request.
 */
export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  transforms?: string[];
  route?: 'fallback';
  models?: string[];
}

/**
 * Chat completion response.
 */
export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: OpenRouterMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Streaming chunk response.
 */
export interface OpenRouterStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<OpenRouterMessage>;
    finish_reason: string | null;
  }>;
}

/**
 * Model list response.
 */
export interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name: string;
    description?: string;
    context_length: number;
    pricing: {
      prompt: string;
      completion: string;
    };
    top_provider?: {
      context_length: number;
    };
    architecture?: {
      modality: string;
      tokenizer: string;
      instruct_type?: string;
    };
  }>;
}

/**
 * OpenRouter service class.
 */
export class OpenRouterService {
  private settings: OpenRouterSettings;
  private cachedModels: OpenRouterModel[] | null = null;
  private modelsCacheTime: number = 0;
  private readonly MODEL_CACHE_TTL = 1000 * 60 * 60; // 1 hour

  constructor(settings?: Partial<OpenRouterSettings>) {
    this.settings = { ...DEFAULT_OPENROUTER_SETTINGS, ...settings };
  }

  /**
   * Updates the settings.
   */
  updateSettings(newSettings: Partial<OpenRouterSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Gets the current settings.
   */
  getSettings(): OpenRouterSettings {
    return { ...this.settings };
  }

  /**
   * Checks if the service is configured with an API key.
   */
  isConfigured(): boolean {
    return !!this.settings.apiKey && this.settings.apiKey.length > 0;
  }

  /**
   * Validates the API key by making a test request.
   */
  async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    if (!this.settings.apiKey) {
      return { valid: false, error: 'No API key provided' };
    }

    try {
      const response = await fetch(`${OPENROUTER_API_URL}/auth/key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
        },
      });

      if (response.ok) {
        return { valid: true };
      } else {
        const error = await response.json().catch(() => ({}));
        return { valid: false, error: error.message || `HTTP ${response.status}` };
      }
    } catch (error: any) {
      return { valid: false, error: error.message || 'Connection failed' };
    }
  }

  /**
   * Fetches available models from OpenRouter.
   */
  async fetchModels(forceRefresh: boolean = false): Promise<OpenRouterModel[]> {
    // Return cached models if still valid
    if (!forceRefresh && this.cachedModels && Date.now() - this.modelsCacheTime < this.MODEL_CACHE_TTL) {
      return this.cachedModels;
    }

    try {
      const response = await fetch(`${OPENROUTER_API_URL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
        },
      });

      if (!response.ok) {
        console.warn('[OpenRouter] Failed to fetch models, using defaults');
        return OPENROUTER_POPULAR_MODELS;
      }

      const data: OpenRouterModelsResponse = await response.json();

      this.cachedModels = data.data.map(model => ({
        id: model.id,
        name: model.name,
        description: model.description,
        contextLength: model.context_length || model.top_provider?.context_length || 4096,
        promptPricing: parseFloat(model.pricing.prompt) * 1000000,
        completionPricing: parseFloat(model.pricing.completion) * 1000000,
        supportsTools: true, // Assume true, actual support varies
        supportsVision: model.architecture?.modality?.includes('image') || false,
        provider: model.id.split('/')[0],
      }));

      this.modelsCacheTime = Date.now();
      return this.cachedModels;
    } catch (error) {
      console.error('[OpenRouter] Error fetching models:', error);
      return OPENROUTER_POPULAR_MODELS;
    }
  }

  /**
   * Gets popular models (cached, no API call).
   */
  getPopularModels(): OpenRouterModel[] {
    return [...OPENROUTER_POPULAR_MODELS];
  }

  /**
   * Gets a model by ID.
   */
  getModel(modelId: string): OpenRouterModel | undefined {
    return OPENROUTER_POPULAR_MODELS.find(m => m.id === modelId) ||
      this.cachedModels?.find(m => m.id === modelId);
  }

  /**
   * Converts tool definitions to OpenRouter format.
   */
  private convertTools(tools: ToolDefinition[]): OpenRouterTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  /**
   * Sends a chat completion request.
   */
  async chat(
    messages: OpenRouterMessage[],
    options?: {
      model?: string;
      tools?: ToolDefinition[];
      stream?: boolean;
      onChunk?: (chunk: string) => void;
      signal?: AbortSignal;
    }
  ): Promise<OpenRouterResponse> {
    if (!this.isConfigured()) {
      throw new Error('OpenRouter API key not configured');
    }

    const startTime = Date.now();
    const model = options?.model || this.settings.model;

    // Build request
    const request: OpenRouterRequest = {
      model,
      messages,
      max_tokens: this.settings.maxTokens,
      temperature: this.settings.temperature,
      top_p: this.settings.topP,
      frequency_penalty: this.settings.frequencyPenalty,
      presence_penalty: this.settings.presencePenalty,
      stream: options?.stream || false,
    };

    // Add tools if provided
    if (options?.tools && options.tools.length > 0) {
      request.tools = this.convertTools(options.tools);
      request.tool_choice = 'auto';
    }

    // Add fallback models if enabled
    if (this.settings.enableFallback && this.settings.fallbackModels.length > 0) {
      request.route = 'fallback';
      request.models = [model, ...this.settings.fallbackModels];
    }

    // Log the request
    auditLogger.logAIRequest(model, messages[messages.length - 1]?.content?.toString() || '');

    try {
      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.settings.siteUrl || window.location.origin,
          'X-Title': this.settings.siteName || 'File Pro',
        },
        body: JSON.stringify(request),
        signal: options?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

        auditLogger.logAIResponse(model, false, Date.now() - startTime, {
          error: errorMessage,
        });

        throw new Error(`OpenRouter API error: ${errorMessage}`);
      }

      // Handle streaming response
      if (options?.stream && response.body) {
        return this.handleStreamingResponse(response, startTime, model, options.onChunk);
      }

      // Handle regular response
      const data: OpenRouterResponse = await response.json();

      const duration = Date.now() - startTime;
      auditLogger.logAIResponse(model, true, duration, {
        toolsUsed: data.choices[0]?.message?.tool_calls?.map(tc => tc.function.name),
      });

      console.log(`[OpenRouter] Response received in ${duration}ms, tokens: ${data.usage.total_tokens}`);
      return data;

    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (error.name === 'AbortError') {
        auditLogger.logAIResponse(model, false, duration, { error: 'Request cancelled' });
        throw new Error('Request cancelled');
      }

      auditLogger.logAIResponse(model, false, duration, { error: error.message });
      throw error;
    }
  }

  /**
   * Handles streaming response.
   */
  private async handleStreamingResponse(
    response: Response,
    startTime: number,
    model: string,
    onChunk?: (chunk: string) => void
  ): Promise<OpenRouterResponse> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let fullContent = '';
    let toolCalls: OpenRouterToolCall[] = [];
    let finishReason: string = 'stop';
    let responseId = '';
    let actualModel = model;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') continue;

          try {
            const parsed: OpenRouterStreamChunk = JSON.parse(data);
            responseId = parsed.id;
            actualModel = parsed.model;

            for (const choice of parsed.choices) {
              if (typeof choice.delta.content === 'string') {
                fullContent += choice.delta.content;
                onChunk?.(choice.delta.content);
              } else if (Array.isArray(choice.delta.content)) {
                // Handle array content if necessary, or just ignore
              }

              if (choice.delta.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  const existingCall = toolCalls.find(t => t.id === tc.id);
                  if (existingCall) {
                    existingCall.function.arguments += tc.function?.arguments || '';
                  } else if (tc.id) {
                    toolCalls.push({
                      id: tc.id,
                      type: 'function',
                      function: {
                        name: tc.function?.name || '',
                        arguments: tc.function?.arguments || '',
                      },
                    });
                  }
                }
              }

              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }
            }
          } catch (parseError) {
            // Skip invalid JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const duration = Date.now() - startTime;
    auditLogger.logAIResponse(actualModel, true, duration, {
      toolsUsed: toolCalls.map(tc => tc.function.name),
    });

    // Construct response object
    return {
      id: responseId,
      model: actualModel,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: fullContent,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: finishReason as any,
      }],
      usage: {
        prompt_tokens: 0, // Not available in streaming
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  /**
   * Sends a chat completion with tool execution loop.
   */
  async chatWithTools(
    messages: OpenRouterMessage[],
    tools: ToolDefinition[],
    toolExecutor: (toolName: string, args: Record<string, any>) => Promise<any>,
    options?: {
      maxToolCalls?: number;
      stream?: boolean;
      onChunk?: (chunk: string) => void;
      onToolCall?: (toolName: string, args: any) => void;
      signal?: AbortSignal;
    }
  ): Promise<{ response: OpenRouterResponse; toolResults: any[] }> {
    const maxCalls = options?.maxToolCalls || 10;
    const conversationMessages = [...messages];
    const toolResults: any[] = [];
    let callCount = 0;

    while (callCount < maxCalls) {
      const response = await this.chat(conversationMessages, {
        tools,
        stream: options?.stream,
        onChunk: options?.onChunk,
        signal: options?.signal,
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) break;

      // Add assistant message to conversation
      conversationMessages.push(assistantMessage);

      // Check for tool calls
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        // No more tool calls, return final response
        return { response, toolResults };
      }

      // Execute tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        callCount++;
        const toolName = toolCall.function.name;

        let args: Record<string, any>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        options?.onToolCall?.(toolName, args);

        try {
          const result = await toolExecutor(toolName, args);
          toolResults.push({ toolName, args, result });

          // Add tool result to conversation
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (error: any) {
          toolResults.push({ toolName, args, error: error.message });

          // Add error result to conversation
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }
    }

    // Max tool calls reached, return last response
    const finalResponse = await this.chat(conversationMessages, {
      stream: options?.stream,
      onChunk: options?.onChunk,
      signal: options?.signal,
    });

    return { response: finalResponse, toolResults };
  }

  /**
   * Gets the estimated cost for a request.
   */
  estimateCost(promptTokens: number, completionTokens: number, modelId?: string): number {
    const model = this.getModel(modelId || this.settings.model);
    if (!model) return 0;

    const promptCost = (promptTokens / 1000000) * model.promptPricing;
    const completionCost = (completionTokens / 1000000) * model.completionPricing;
    return promptCost + completionCost;
  }

  /**
   * Gets account credits/balance (if available).
   */
  async getCredits(): Promise<{ credits: number; currency: string } | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${OPENROUTER_API_URL}/auth/key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          credits: data.data?.limit_remaining || 0,
          currency: 'USD',
        };
      }
    } catch (error) {
      console.error('[OpenRouter] Error fetching credits:', error);
    }

    return null;
  }
}

/**
 * Singleton instance with default settings.
 */
export const openRouterService = new OpenRouterService();

/**
 * Factory function to create a service with custom settings.
 */
export function createOpenRouterService(settings?: Partial<OpenRouterSettings>): OpenRouterService {
  return new OpenRouterService(settings);
}

/**
 * Helper to format model pricing for display.
 */
export function formatModelPricing(model: OpenRouterModel): string {
  const formatPrice = (price: number) => {
    if (price < 0.01) return `$${price.toFixed(4)}`;
    if (price < 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(0)}`;
  };
  return `${formatPrice(model.promptPricing)}/${formatPrice(model.completionPricing)} per 1M tokens`;
}

/**
 * Helper to format context length for display.
 */
export function formatContextLength(length: number): string {
  if (length >= 1000000) return `${(length / 1000000).toFixed(0)}M`;
  if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
  return String(length);
}

/**
 * Gets the provider display name.
 */
export function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    meta: 'Meta',
    mistral: 'Mistral',
    deepseek: 'DeepSeek',
    qwen: 'Qwen',
  };
  return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}
