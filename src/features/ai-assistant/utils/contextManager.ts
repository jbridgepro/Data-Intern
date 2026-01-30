/**
 * File: src/features/ai-assistant/utils/contextManager.ts
 * 
 * Intelligent context window management for the AI Assistant.
 * Handles selection, prioritization, and summarization of conversation history
 * to optimize the context sent to the AI model.
 * 
 * Key features:
 * - Intelligent message selection based on relevance
 * - Tool execution message prioritization
 * - Confirmation/clarification context preservation
 * - Optional context summarization for long conversations
 * - Configurable through ContextSettings
 */

import type { ContextSettings, DEFAULT_CONTEXT_SETTINGS } from '../types';

/**
 * Conversation message with metadata for context management.
 */
export interface ConversationMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  metadata?: {
    toolsUsed?: string[];
    hasToolExecution?: boolean;
    isConfirmation?: boolean;
    isClarification?: boolean;
    topics?: string[];
    importance?: number; // 0-1 score
  };
}

/**
 * Context selection result with metadata.
 */
export interface ContextSelectionResult {
  messages: ConversationMessage[];
  totalMessagesConsidered: number;
  messagesIncluded: number;
  contextSummary?: string;
  truncated: boolean;
  relevanceScores?: Map<string, number>;
}

/**
 * Keywords that indicate important context that should be preserved.
 */
const IMPORTANT_KEYWORDS = {
  // Confirmation-related
  confirmation: ['yes', 'no', 'confirm', 'cancel', 'proceed', 'approve', 'reject', 'ok', 'okay', 'sure'],
  // Clarification-related
  clarification: ['what type', 'which', 'clarify', 'do you mean', 'options', '.txt', '.docx', '.md', '.pdf'],
  // Tool-related
  tools: ['created', 'moved', 'copied', 'deleted', 'organized', 'renamed', 'found', 'analyzed'],
  // File operation keywords
  fileOps: ['file', 'folder', 'directory', 'document', 'files', 'folders'],
  // Error/issue keywords
  errors: ['error', 'failed', 'unable', 'cannot', 'problem', 'issue'],
};

/**
 * ContextManager class handles intelligent context selection and optimization.
 */
export class ContextManager {
  private settings: ContextSettings;

  constructor(settings?: Partial<ContextSettings>) {
    // Merge provided settings with defaults
    this.settings = {
      maxConversationHistory: settings?.maxConversationHistory ?? 10,
      includeDirectoryAnalysis: settings?.includeDirectoryAnalysis ?? true,
      memoryMode: settings?.memoryMode ?? 'session',
      prioritizeToolMessages: settings?.prioritizeToolMessages ?? true,
      enableContextSummarization: settings?.enableContextSummarization ?? true,
      relevanceThreshold: settings?.relevanceThreshold ?? 0.3,
    };
  }

  /**
   * Updates the context manager settings.
   * @param newSettings - Partial settings to update
   */
  updateSettings(newSettings: Partial<ContextSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Selects the most relevant messages from conversation history.
   * Uses intelligent selection based on:
   * 1. Recency (recent messages are always included)
   * 2. Tool execution presence (prioritized if enabled)
   * 3. Confirmation/clarification context (preserved)
   * 4. Relevance to current command
   * 
   * @param history - Full conversation history
   * @param currentCommand - The current user command for relevance scoring
   * @returns ContextSelectionResult with optimized message list
   */
  selectRelevantContext(
    history: ConversationMessage[],
    currentCommand: string
  ): ContextSelectionResult {
    if (!history || history.length === 0) {
      return {
        messages: [],
        totalMessagesConsidered: 0,
        messagesIncluded: 0,
        truncated: false,
      };
    }

    const maxMessages = this.settings.maxConversationHistory;
    const relevanceScores = new Map<string, number>();

    // If history fits within limit, return all
    if (history.length <= maxMessages) {
      return {
        messages: history,
        totalMessagesConsidered: history.length,
        messagesIncluded: history.length,
        truncated: false,
      };
    }

    // Score each message for relevance
    const scoredMessages = history.map((msg, index) => {
      const score = this.calculateMessageRelevance(msg, currentCommand, index, history.length);
      const id = msg.id || `msg-${index}`;
      relevanceScores.set(id, score);
      return { message: msg, score, originalIndex: index };
    });

    // Always include the most recent messages (last 3-5)
    const recentCount = Math.min(5, Math.floor(maxMessages / 2));
    const recentMessages = scoredMessages.slice(-recentCount);
    
    // Get remaining slots for older messages
    const remainingSlots = maxMessages - recentCount;
    
    // Sort older messages by score and select top ones
    const olderMessages = scoredMessages
      .slice(0, -recentCount)
      .filter(m => m.score >= this.settings.relevanceThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, remainingSlots);

    // Combine and sort by original index to maintain conversation flow
    const selectedMessages = [...olderMessages, ...recentMessages]
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .map(m => m.message);

    // Generate context summary if enabled and we're truncating significantly
    let contextSummary: string | undefined;
    if (this.settings.enableContextSummarization && history.length > maxMessages * 2) {
      contextSummary = this.generateContextSummary(
        history.slice(0, -maxMessages),
        currentCommand
      );
    }

    return {
      messages: selectedMessages,
      totalMessagesConsidered: history.length,
      messagesIncluded: selectedMessages.length,
      truncated: history.length > maxMessages,
      contextSummary,
      relevanceScores,
    };
  }

  /**
   * Calculates relevance score for a message (0-1).
   * Higher scores indicate more relevant messages.
   * 
   * @param message - The message to score
   * @param currentCommand - Current user command for keyword matching
   * @param index - Position in conversation history
   * @param totalMessages - Total number of messages
   * @returns Relevance score between 0 and 1
   */
  private calculateMessageRelevance(
    message: ConversationMessage,
    currentCommand: string,
    index: number,
    totalMessages: number
  ): number {
    let score = 0;
    const content = message.content.toLowerCase();
    const command = currentCommand.toLowerCase();

    // 1. Recency bonus (0-0.3)
    // More recent messages get higher scores
    const recencyFactor = index / totalMessages;
    score += recencyFactor * 0.3;

    // 2. Tool execution bonus (0-0.25)
    if (this.settings.prioritizeToolMessages) {
      if (message.metadata?.hasToolExecution || message.metadata?.toolsUsed?.length) {
        score += 0.25;
      }
      // Check content for tool-related keywords
      if (IMPORTANT_KEYWORDS.tools.some(kw => content.includes(kw))) {
        score += 0.1;
      }
    }

    // 3. Confirmation/Clarification context (0-0.2)
    if (this.isConfirmationMessage(message)) {
      score += 0.2;
    }
    if (this.isClarificationMessage(message)) {
      score += 0.2;
    }

    // 4. Keyword relevance to current command (0-0.2)
    const keywordOverlap = this.calculateKeywordOverlap(content, command);
    score += keywordOverlap * 0.2;

    // 5. File operation context (0-0.1)
    if (IMPORTANT_KEYWORDS.fileOps.some(kw => content.includes(kw))) {
      score += 0.1;
    }

    // 6. Error/issue context (0-0.1)
    // Preserve error context for better troubleshooting
    if (IMPORTANT_KEYWORDS.errors.some(kw => content.includes(kw))) {
      score += 0.1;
    }

    // 7. Use metadata importance if available
    if (message.metadata?.importance !== undefined) {
      score = (score + message.metadata.importance) / 2;
    }

    // Clamp score to 0-1 range
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Checks if a message is a confirmation response.
   * @param message - Message to check
   * @returns True if message appears to be a confirmation
   */
  private isConfirmationMessage(message: ConversationMessage): boolean {
    if (message.metadata?.isConfirmation) return true;
    
    const content = message.content.toLowerCase().trim();
    
    // Check for short confirmation responses
    if (content.length < 20) {
      return IMPORTANT_KEYWORDS.confirmation.some(kw => 
        content === kw || content.startsWith(kw + ' ') || content.startsWith(kw + ',')
      );
    }
    
    return false;
  }

  /**
   * Checks if a message involves clarification (asking or answering).
   * @param message - Message to check
   * @returns True if message is part of a clarification exchange
   */
  private isClarificationMessage(message: ConversationMessage): boolean {
    if (message.metadata?.isClarification) return true;
    
    const content = message.content.toLowerCase();
    
    // Check for clarification patterns
    const clarificationPatterns = [
      /what type of file/i,
      /what format/i,
      /which.*prefer/i,
      /do you mean/i,
      /\.txt|\.docx|\.md|\.pdf/i,
      /plain text|word document|markdown/i,
    ];
    
    return clarificationPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Calculates keyword overlap between two strings.
   * @param content - Message content
   * @param command - Current command
   * @returns Overlap score between 0 and 1
   */
  private calculateKeywordOverlap(content: string, command: string): number {
    // Extract significant words (length > 3, not common words)
    const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'would', 'could', 'there', 'their', 'what', 'about', 'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'this', 'that', 'with', 'from']);
    
    const extractWords = (text: string): Set<string> => {
      return new Set(
        text.split(/\s+/)
          .map(w => w.replace(/[^a-z0-9]/gi, '').toLowerCase())
          .filter(w => w.length > 3 && !commonWords.has(w))
      );
    };
    
    const contentWords = extractWords(content);
    const commandWords = extractWords(command);
    
    if (commandWords.size === 0) return 0;
    
    let matchCount = 0;
    for (const word of commandWords) {
      if (contentWords.has(word)) {
        matchCount++;
      }
    }
    
    return matchCount / commandWords.size;
  }

  /**
   * Generates a brief summary of older context that was truncated.
   * This helps preserve important context without including full messages.
   * 
   * @param truncatedMessages - Messages that were truncated
   * @param currentCommand - Current command for relevance
   * @returns A brief summary string
   */
  private generateContextSummary(
    truncatedMessages: ConversationMessage[],
    currentCommand: string
  ): string {
    if (truncatedMessages.length === 0) return '';

    // Extract key information from truncated messages
    const toolsUsed = new Set<string>();
    const topicsDiscussed = new Set<string>();
    let filesCreated = 0;
    let foldersCreated = 0;
    let errorsEncountered = 0;

    for (const msg of truncatedMessages) {
      // Track tools used
      if (msg.metadata?.toolsUsed) {
        msg.metadata.toolsUsed.forEach(t => toolsUsed.add(t));
      }

      const content = msg.content.toLowerCase();

      // Count file operations mentioned
      const fileMatches = content.match(/created?\s+(\d+)\s+file/gi);
      if (fileMatches) {
        fileMatches.forEach(m => {
          const num = parseInt(m.match(/\d+/)?.[0] || '1');
          filesCreated += num;
        });
      }

      const folderMatches = content.match(/created?\s+(\d+)\s+folder/gi);
      if (folderMatches) {
        folderMatches.forEach(m => {
          const num = parseInt(m.match(/\d+/)?.[0] || '1');
          foldersCreated += num;
        });
      }

      // Track errors
      if (IMPORTANT_KEYWORDS.errors.some(kw => content.includes(kw))) {
        errorsEncountered++;
      }

      // Extract topics
      if (content.includes('organiz')) topicsDiscussed.add('file organization');
      if (content.includes('duplicate')) topicsDiscussed.add('duplicate detection');
      if (content.includes('search') || content.includes('find')) topicsDiscussed.add('file search');
      if (content.includes('rename')) topicsDiscussed.add('file renaming');
    }

    // Build summary
    const summaryParts: string[] = [];
    
    if (truncatedMessages.length > 0) {
      summaryParts.push(`Earlier conversation included ${truncatedMessages.length} messages`);
    }
    
    if (topicsDiscussed.size > 0) {
      summaryParts.push(`Topics: ${Array.from(topicsDiscussed).join(', ')}`);
    }
    
    if (filesCreated > 0 || foldersCreated > 0) {
      const ops = [];
      if (filesCreated > 0) ops.push(`${filesCreated} files created`);
      if (foldersCreated > 0) ops.push(`${foldersCreated} folders created`);
      summaryParts.push(`Operations: ${ops.join(', ')}`);
    }
    
    if (errorsEncountered > 0) {
      summaryParts.push(`${errorsEncountered} error(s) encountered`);
    }

    return summaryParts.length > 0 
      ? `[Context Summary: ${summaryParts.join('. ')}]`
      : '';
  }

  /**
   * Enriches messages with metadata for better context management.
   * Call this when adding messages to history.
   * 
   * @param message - Message to enrich
   * @returns Enriched message with metadata
   */
  enrichMessageMetadata(message: ConversationMessage): ConversationMessage {
    const enriched = { ...message };
    
    if (!enriched.metadata) {
      enriched.metadata = {};
    }

    // Add timestamp if not present
    if (!enriched.timestamp) {
      enriched.timestamp = Date.now();
    }

    // Detect confirmation
    enriched.metadata.isConfirmation = this.isConfirmationMessage(message);

    // Detect clarification
    enriched.metadata.isClarification = this.isClarificationMessage(message);

    // Detect tool execution indicators
    const content = message.content.toLowerCase();
    enriched.metadata.hasToolExecution = 
      IMPORTANT_KEYWORDS.tools.some(kw => content.includes(kw)) ||
      content.includes('i created') ||
      content.includes('i organized') ||
      content.includes('i found');

    // Calculate base importance
    let importance = 0.5;
    if (enriched.metadata.isConfirmation) importance += 0.2;
    if (enriched.metadata.isClarification) importance += 0.2;
    if (enriched.metadata.hasToolExecution) importance += 0.2;
    enriched.metadata.importance = Math.min(1, importance);

    return enriched;
  }

  /**
   * Formats selected context as messages for the AI provider.
   * Optionally prepends a context summary if truncation occurred.
   * 
   * @param result - Context selection result
   * @returns Array of formatted messages ready for AI provider
   */
  formatContextForProvider(
    result: ContextSelectionResult
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const formatted: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add context summary as a system-level user message if available
    if (result.contextSummary && result.truncated) {
      formatted.push({
        role: 'user',
        content: result.contextSummary,
      });
    }

    // Add selected messages
    for (const msg of result.messages) {
      formatted.push({
        role: msg.role,
        content: msg.content,
      });
    }

    return formatted;
  }

  /**
   * Gets the current settings.
   * @returns Current context settings
   */
  getSettings(): ContextSettings {
    return { ...this.settings };
  }
}

/**
 * Singleton instance with default settings.
 * Can be reconfigured via updateSettings().
 */
export const contextManager = new ContextManager();

/**
 * Factory function to create a context manager with custom settings.
 * @param settings - Custom settings
 * @returns New ContextManager instance
 */
export function createContextManager(settings?: Partial<ContextSettings>): ContextManager {
  return new ContextManager(settings);
}
