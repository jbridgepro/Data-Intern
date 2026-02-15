/**
 * File: src/features/ai-assistant/voice/voiceOutputManager.ts
 *
 * Enhanced voice output manager for Gemini Live-style voice interactions.
 * Automatically converts AI responses to speech and manages conversation flow.
 */

import { VoiceService } from './voiceService';
import type { VoiceSettings, VoiceState } from './types';

/**
 * Voice output options
 */
export interface VoiceOutputOptions {
  interrupt?: boolean;           // Interrupt current speech
  priority?: 'high' | 'normal' | 'low';  // Speech priority
  skipIfBusy?: boolean;         // Skip if already speaking
  onComplete?: () => void;      // Callback when speech completes
  onStart?: () => void;         // Callback when speech starts
  onError?: (error: Error) => void;  // Callback on error
}

/**
 * Speech queue item
 */
interface SpeechQueueItem {
  text: string;
  options: VoiceOutputOptions;
  timestamp: number;
}

/**
 * Response processing options
 */
export interface ResponseProcessingOptions {
  // How to split long responses
  splitMode?: 'sentences' | 'paragraphs' | 'chunks' | 'none';
  // Max length per chunk (characters)
  maxChunkLength?: number;
  // Whether to speak streaming responses in real-time
  streamingMode?: boolean;
  // Minimum chunk size to speak (avoid speaking tiny fragments)
  minChunkLength?: number;
}

/**
 * Voice output manager for handling AI response speech
 */
export class VoiceOutputManager {
  private voiceService: VoiceService;
  private settings: VoiceSettings;
  private speechQueue: SpeechQueueItem[] = [];
  private isSpeaking: boolean = false;
  private currentSpeechController: AbortController | null = null;
  private onStateChange?: (state: VoiceState) => void;

  // Response processing settings
  private processingOptions: ResponseProcessingOptions = {
    splitMode: 'sentences',
    maxChunkLength: 500,
    streamingMode: true,
    minChunkLength: 20,
  };

  constructor(voiceService: VoiceService, settings: VoiceSettings) {
    this.voiceService = voiceService;
    this.settings = settings;
  }

  /**
   * Set state change callback
   */
  setStateChangeCallback(callback: (state: VoiceState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.voiceService.updateSettings(settings);
  }

  /**
   * Update response processing options
   */
  updateProcessingOptions(options: Partial<ResponseProcessingOptions>): void {
    this.processingOptions = { ...this.processingOptions, ...options };
  }

  /**
   * Speak AI response with automatic processing
   * This is the main method to call for speaking AI responses
   */
  async speakResponse(
    response: string,
    options: VoiceOutputOptions = {}
  ): Promise<void> {
    if (!this.settings.voiceOutputEnabled) {
      console.log('[VoiceOutput] Voice output disabled, skipping speech');
      return;
    }

    // Clean and prepare text
    const cleanedText = this.cleanTextForSpeech(response);

    if (!cleanedText || cleanedText.length === 0) {
      console.log('[VoiceOutput] No text to speak after cleaning');
      return;
    }

    // Split into chunks if needed
    const chunks = this.splitTextIntoChunks(cleanedText);

    console.log(`[VoiceOutput] Speaking response (${chunks.length} chunks)`);

    // Speak each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;

      await this.speak(chunk, {
        ...options,
        onComplete: isLastChunk ? options.onComplete : undefined,
      });

      // Small pause between chunks
      if (!isLastChunk) {
        await this.delay(300);
      }
    }
  }

  /**
   * Speak text immediately or queue if busy
   */
  async speak(
    text: string,
    options: VoiceOutputOptions = {}
  ): Promise<void> {
    const queueItem: SpeechQueueItem = {
      text,
      options,
      timestamp: Date.now(),
    };

    // Handle high priority - interrupt current speech
    if (options.priority === 'high' || options.interrupt) {
      await this.stopSpeaking();
      this.speechQueue.unshift(queueItem);
    } else if (options.skipIfBusy && this.isSpeaking) {
      console.log('[VoiceOutput] Skipping speech - already speaking');
      return;
    } else {
      this.speechQueue.push(queueItem);
    }

    // Process queue if not already processing
    if (!this.isSpeaking) {
      await this.processQueue();
    }
  }

  /**
   * Speak streaming response chunk-by-chunk
   * Call this repeatedly as streaming chunks arrive
   */
  async speakStreamingChunk(
    chunk: string,
    options: VoiceOutputOptions = {}
  ): Promise<void> {
    if (!this.processingOptions.streamingMode) {
      return; // Streaming mode disabled
    }

    const cleanedChunk = this.cleanTextForSpeech(chunk);

    // Only speak if chunk is long enough
    if (cleanedChunk.length < (this.processingOptions.minChunkLength || 20)) {
      return;
    }

    // Check if chunk ends with complete sentence
    const endsWithSentence = /[.!?]\s*$/.test(cleanedChunk);

    if (endsWithSentence) {
      await this.speak(cleanedChunk, {
        ...options,
        skipIfBusy: false, // Always queue streaming chunks
      });
    }
  }

  /**
   * Stop current speech and clear queue
   */
  async stopSpeaking(): Promise<void> {
    console.log('[VoiceOutput] Stopping speech');

    // Abort current speech
    if (this.currentSpeechController) {
      this.currentSpeechController.abort();
      this.currentSpeechController = null;
    }

    // Stop voice service
    this.voiceService.stopSpeaking();

    // Clear queue
    this.speechQueue = [];
    this.isSpeaking = false;

    this.onStateChange?.('idle');
  }

  /**
   * Pause current speech
   */
  pause(): void {
    // Note: Browser SpeechSynthesis doesn't support true pause
    // We stop instead
    this.stopSpeaking();
  }

  /**
   * Check if currently speaking
   */
  isBusy(): boolean {
    return this.isSpeaking || this.speechQueue.length > 0;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.speechQueue.length;
  }

  /**
   * Process speech queue
   */
  private async processQueue(): Promise<void> {
    while (this.speechQueue.length > 0) {
      const item = this.speechQueue.shift();
      if (!item) continue;

      this.isSpeaking = true;
      this.onStateChange?.('speaking');

      try {
        // Call onStart callback
        item.options.onStart?.();

        // Create abort controller
        this.currentSpeechController = new AbortController();

        // Speak using voice service
        await this.voiceService.speak(item.text, false);

        // Call onComplete callback
        item.options.onComplete?.();

      } catch (error: any) {
        console.error('[VoiceOutput] Speech error:', error);
        item.options.onError?.(error);
      } finally {
        this.currentSpeechController = null;
      }
    }

    this.isSpeaking = false;
    this.onStateChange?.('idle');
  }

  /**
   * Clean text for speech
   * Removes markdown, URLs, code blocks, etc.
   */
  private cleanTextForSpeech(text: string): string {
    let cleaned = text;

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`[^`]+`/g, '');

    // Remove markdown formatting
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1'); // Bold
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1'); // Italic
    cleaned = cleaned.replace(/_(.+?)_/g, '$1'); // Italic
    cleaned = cleaned.replace(/~~(.+?)~~/g, '$1'); // Strikethrough

    // Remove markdown headers
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // Remove markdown links but keep text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');

    // Remove bullet points and list markers
    cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');

    // Remove multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove emoji (optional - they may speak strangely)
    // cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');

    // Trim
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Split text into speakable chunks
   */
  private splitTextIntoChunks(text: string): string[] {
    const mode = this.processingOptions.splitMode || 'sentences';
    const maxLength = this.processingOptions.maxChunkLength || 500;

    if (mode === 'none') {
      return [text];
    }

    if (mode === 'sentences') {
      return this.splitIntoSentences(text, maxLength);
    }

    if (mode === 'paragraphs') {
      return this.splitIntoParagraphs(text, maxLength);
    }

    if (mode === 'chunks') {
      return this.splitIntoFixedChunks(text, maxLength);
    }

    return [text];
  }

  /**
   * Split into sentences
   */
  private splitIntoSentences(text: string, maxLength: number): string[] {
    // Split on sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(c => c.length > 0);
  }

  /**
   * Split into paragraphs
   */
  private splitIntoParagraphs(text: string, maxLength: number): string[] {
    const paragraphs = text.split(/\n\n+/);

    const chunks: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.length > maxLength) {
        // Paragraph too long, split into sentences
        const sentenceChunks = this.splitIntoSentences(paragraph, maxLength);
        chunks.push(...sentenceChunks);
      } else {
        chunks.push(paragraph.trim());
      }
    }

    return chunks.filter(c => c.length > 0);
  }

  /**
   * Split into fixed-size chunks
   */
  private splitIntoFixedChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += maxLength) {
      chunks.push(text.slice(i, i + maxLength));
    }

    return chunks;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create voice output manager
 */
export function createVoiceOutputManager(
  voiceService: VoiceService,
  settings: VoiceSettings
): VoiceOutputManager {
  return new VoiceOutputManager(voiceService, settings);
}
