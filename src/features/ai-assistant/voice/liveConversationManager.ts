/**
 * File: src/features/ai-assistant/voice/liveConversationManager.ts
 *
 * Live voice conversation manager for Gemini Live-style interactions.
 * Handles continuous voice conversation flow with automatic speech output.
 */

import { VoiceService } from './voiceService';
import { VoiceOutputManager, createVoiceOutputManager } from './voiceOutputManager';
import type { VoiceSettings, VoiceRecognitionResult, VoiceState } from './types';

/**
 * Conversation turn
 */
export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  audioPlayed?: boolean; // For assistant turns
}

/**
 * Conversation state
 */
export type ConversationState =
  | 'idle'           // Not in conversation
  | 'listening'      // Listening to user
  | 'processing'     // Processing user input
  | 'thinking'       // AI thinking (before speaking)
  | 'speaking'       // AI speaking
  | 'waiting';       // Waiting for user response

/**
 * Live conversation callbacks
 */
export interface LiveConversationCallbacks {
  onUserSpoke?: (text: string) => void;
  onAssistantResponse?: (text: string) => void;
  onAssistantStartedSpeaking?: () => void;
  onAssistantFinishedSpeaking?: () => void;
  onConversationStateChange?: (state: ConversationState) => void;
  onTurnAdded?: (turn: ConversationTurn) => void;
  onError?: (error: Error) => void;
}

/**
 * Live conversation options
 */
export interface LiveConversationOptions {
  // Automatically start listening after AI finishes speaking
  autoResumeListening?: boolean;
  // Automatically speak AI responses
  autoSpeakResponses?: boolean;
  // Allow user to interrupt AI while speaking
  allowInterruptions?: boolean;
  // Voice output settings
  voiceOutputSettings?: {
    splitMode?: 'sentences' | 'paragraphs' | 'none';
    maxChunkLength?: number;
    streamingMode?: boolean;
  };
}

/**
 * Live Voice Conversation Manager
 */
export class LiveConversationManager {
  private voiceService: VoiceService;
  private outputManager: VoiceOutputManager;
  private settings: VoiceSettings;
  private callbacks: LiveConversationCallbacks;
  private options: LiveConversationOptions;

  private conversationState: ConversationState = 'idle';
  private conversationHistory: ConversationTurn[] = [];
  private currentTurnId: string | null = null;
  private isActive: boolean = false;

  constructor(
    voiceService: VoiceService,
    settings: VoiceSettings,
    callbacks: LiveConversationCallbacks = {},
    options: LiveConversationOptions = {}
  ) {
    this.voiceService = voiceService;
    this.settings = settings;
    this.callbacks = callbacks;
    this.options = {
      autoResumeListening: true,
      autoSpeakResponses: true,
      allowInterruptions: true,
      ...options,
    };

    // Create output manager
    this.outputManager = createVoiceOutputManager(voiceService, settings);

    // Setup voice service callbacks
    this.setupVoiceServiceCallbacks();

    // Setup output manager callbacks
    this.outputManager.setStateChangeCallback((state) => {
      if (state === 'speaking') {
        this.setConversationState('speaking');
      } else if (state === 'idle' && this.conversationState === 'speaking') {
        this.onAssistantFinishedSpeaking();
      }
    });

    // Configure output manager with options
    if (this.options.voiceOutputSettings) {
      this.outputManager.updateProcessingOptions(this.options.voiceOutputSettings);
    }
  }

  /**
   * Setup voice service callbacks
   */
  private setupVoiceServiceCallbacks(): void {
    // Listen for transcripts
    this.voiceService.setTranscriptCallback((result) => {
      if (result.isFinal) {
        this.onUserSpoke(result.text);
      }
    });

    // Listen for state changes
    this.voiceService.setStateChangeCallback((state) => {
      this.onVoiceServiceStateChange(state);
    });
  }

  /**
   * Start live conversation mode
   */
  async startConversation(): Promise<void> {
    if (this.isActive) {
      console.log('[LiveConversation] Already active');
      return;
    }

    console.log('[LiveConversation] Starting live conversation mode');

    this.isActive = true;
    this.conversationHistory = [];
    this.setConversationState('listening');

    // Start listening
    try {
      await this.voiceService.startListening();
    } catch (error: any) {
      console.error('[LiveConversation] Failed to start listening:', error);
      this.callbacks.onError?.(error);
      this.isActive = false;
      this.setConversationState('idle');
    }
  }

  /**
   * Stop live conversation mode
   */
  async stopConversation(): Promise<void> {
    console.log('[LiveConversation] Stopping live conversation mode');

    this.isActive = false;

    // Stop listening
    await this.voiceService.stopListening();

    // Stop speaking
    await this.outputManager.stopSpeaking();

    this.setConversationState('idle');
  }

  /**
   * Handle assistant response (from AI)
   * This is called when the AI generates a response
   */
  async handleAssistantResponse(
    responseText: string,
    options: { streaming?: boolean } = {}
  ): Promise<void> {
    if (!this.isActive) {
      console.log('[LiveConversation] Not active, skipping response');
      return;
    }

    console.log('[LiveConversation] Handling assistant response');

    // Add turn to history
    const turn = this.addTurn('assistant', responseText);

    // Callback
    this.callbacks.onAssistantResponse?.(responseText);

    // Speak response if auto-speak enabled
    if (this.options.autoSpeakResponses && this.settings.voiceOutputEnabled) {
      this.setConversationState('thinking');

      // Small delay before speaking (feels more natural)
      await this.delay(300);

      this.setConversationState('speaking');
      this.callbacks.onAssistantStartedSpeaking?.();

      try {
        if (options.streaming) {
          await this.outputManager.speakStreamingChunk(responseText);
        } else {
          await this.outputManager.speakResponse(responseText, {
            onComplete: () => {
              turn.audioPlayed = true;
              this.onAssistantFinishedSpeaking();
            },
            onError: (error) => {
              console.error('[LiveConversation] Speech error:', error);
              this.callbacks.onError?.(error);
              this.onAssistantFinishedSpeaking();
            },
          });
        }
      } catch (error: any) {
        console.error('[LiveConversation] Failed to speak response:', error);
        this.callbacks.onError?.(error);
        this.onAssistantFinishedSpeaking();
      }
    }
  }

  /**
   * Handle streaming assistant response chunk
   */
  async handleStreamingChunk(chunk: string): Promise<void> {
    if (!this.isActive) return;

    // Speak streaming chunk
    if (this.options.autoSpeakResponses && this.settings.voiceOutputEnabled) {
      await this.outputManager.speakStreamingChunk(chunk);
    }
  }

  /**
   * Interrupt current speech (for barge-in)
   */
  async interrupt(): Promise<void> {
    console.log('[LiveConversation] Interrupting assistant');

    await this.outputManager.stopSpeaking();
    this.setConversationState('listening');
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.voiceService.updateSettings(settings);
    this.outputManager.updateSettings(settings);
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<LiveConversationOptions>): void {
    this.options = { ...this.options, ...options };

    if (options.voiceOutputSettings) {
      this.outputManager.updateProcessingOptions(options.voiceOutputSettings);
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationTurn[] {
    return [...this.conversationHistory];
  }

  /**
   * Get current state
   */
  getState(): ConversationState {
    return this.conversationState;
  }

  /**
   * Check if active
   */
  isConversationActive(): boolean {
    return this.isActive;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Handle user spoke
   */
  private onUserSpoke(text: string): void {
    if (!this.isActive) return;

    console.log('[LiveConversation] User spoke:', text);

    // If AI is speaking and interruptions allowed, interrupt
    if (this.conversationState === 'speaking' && this.options.allowInterruptions) {
      this.interrupt();
    }

    // Add turn to history
    this.addTurn('user', text);

    // Callback
    this.callbacks.onUserSpoke?.(text);

    // Set state to processing
    this.setConversationState('processing');
  }

  /**
   * Handle assistant finished speaking
   */
  private onAssistantFinishedSpeaking(): void {
    console.log('[LiveConversation] Assistant finished speaking');

    this.callbacks.onAssistantFinishedSpeaking?.();

    // Resume listening if auto-resume enabled
    if (this.options.autoResumeListening && this.isActive) {
      this.setConversationState('waiting');

      // Small delay before resuming listening
      setTimeout(() => {
        if (this.isActive && this.conversationState === 'waiting') {
          this.setConversationState('listening');
        }
      }, 500);
    } else {
      this.setConversationState('idle');
    }
  }

  /**
   * Handle voice service state change
   */
  private onVoiceServiceStateChange(state: VoiceState): void {
    // Map voice service state to conversation state
    if (!this.isActive) return;

    switch (state) {
      case 'listening':
        if (this.conversationState !== 'speaking') {
          this.setConversationState('listening');
        }
        break;

      case 'processing':
        this.setConversationState('processing');
        break;

      case 'speaking':
        this.setConversationState('speaking');
        break;

      case 'idle':
        if (this.conversationState === 'listening' || this.conversationState === 'processing') {
          this.setConversationState('idle');
        }
        break;
    }
  }

  /**
   * Set conversation state
   */
  private setConversationState(state: ConversationState): void {
    if (this.conversationState === state) return;

    console.log(`[LiveConversation] State: ${this.conversationState} → ${state}`);

    this.conversationState = state;
    this.callbacks.onConversationStateChange?.(state);
  }

  /**
   * Add turn to history
   */
  private addTurn(role: 'user' | 'assistant', text: string): ConversationTurn {
    const turn: ConversationTurn = {
      id: this.generateTurnId(),
      role,
      text,
      timestamp: Date.now(),
      audioPlayed: role === 'user', // User turns are always "played" (spoken)
    };

    this.conversationHistory.push(turn);
    this.callbacks.onTurnAdded?.(turn);

    // Keep last 50 turns
    if (this.conversationHistory.length > 50) {
      this.conversationHistory.shift();
    }

    return turn;
  }

  /**
   * Generate turn ID
   */
  private generateTurnId(): string {
    return `turn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create live conversation manager
 */
export function createLiveConversationManager(
  voiceService: VoiceService,
  settings: VoiceSettings,
  callbacks?: LiveConversationCallbacks,
  options?: LiveConversationOptions
): LiveConversationManager {
  return new LiveConversationManager(voiceService, settings, callbacks, options);
}
