/**
 * File: src/features/ai-assistant/voice/hooks/useLiveConversation.ts
 *
 * React hook for Gemini Live-style voice conversations.
 * Provides easy integration of live voice mode with automatic speech output.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceService } from '../voiceService';
import {
  LiveConversationManager,
  createLiveConversationManager,
  type ConversationTurn,
  type ConversationState,
  type LiveConversationCallbacks,
  type LiveConversationOptions,
} from '../liveConversationManager';
import type { VoiceSettings } from '../types';

/**
 * Live conversation hook result
 */
export interface UseLiveConversationResult {
  // State
  isActive: boolean;
  conversationState: ConversationState;
  history: ConversationTurn[];

  // Controls
  startConversation: () => Promise<void>;
  stopConversation: () => Promise<void>;
  sendAssistantResponse: (text: string, streaming?: boolean) => Promise<void>;
  sendStreamingChunk: (chunk: string) => Promise<void>;
  interrupt: () => Promise<void>;

  // Settings
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  updateOptions: (options: Partial<LiveConversationOptions>) => void;

  // Info
  isSpeaking: boolean;
  isListening: boolean;
  isProcessing: boolean;
}

/**
 * Hook for live voice conversation
 */
export function useLiveConversation(
  voiceService: VoiceService,
  initialSettings: VoiceSettings,
  callbacks: LiveConversationCallbacks = {},
  options: LiveConversationOptions = {}
): UseLiveConversationResult {
  const managerRef = useRef<LiveConversationManager | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [history, setHistory] = useState<ConversationTurn[]>([]);

  // Initialize manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = createLiveConversationManager(
        voiceService,
        initialSettings,
        {
          ...callbacks,
          onConversationStateChange: (state) => {
            setConversationState(state);
            callbacks.onConversationStateChange?.(state);
          },
          onTurnAdded: (turn) => {
            setHistory(prev => [...prev, turn]);
            callbacks.onTurnAdded?.(turn);
          },
        },
        options
      );
    }

    return () => {
      // Cleanup
      if (managerRef.current?.isConversationActive()) {
        managerRef.current.stopConversation();
      }
    };
  }, []);

  /**
   * Start conversation
   */
  const startConversation = useCallback(async () => {
    if (!managerRef.current) return;

    try {
      await managerRef.current.startConversation();
      setIsActive(true);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      throw error;
    }
  }, []);

  /**
   * Stop conversation
   */
  const stopConversation = useCallback(async () => {
    if (!managerRef.current) return;

    await managerRef.current.stopConversation();
    setIsActive(false);
    setConversationState('idle');
  }, []);

  /**
   * Send assistant response (for speaking)
   */
  const sendAssistantResponse = useCallback(async (text: string, streaming = false) => {
    if (!managerRef.current) return;

    await managerRef.current.handleAssistantResponse(text, { streaming });
  }, []);

  /**
   * Send streaming chunk
   */
  const sendStreamingChunk = useCallback(async (chunk: string) => {
    if (!managerRef.current) return;

    await managerRef.current.handleStreamingChunk(chunk);
  }, []);

  /**
   * Interrupt current speech
   */
  const interrupt = useCallback(async () => {
    if (!managerRef.current) return;

    await managerRef.current.interrupt();
  }, []);

  /**
   * Update settings
   */
  const updateSettings = useCallback((settings: Partial<VoiceSettings>) => {
    if (!managerRef.current) return;

    managerRef.current.updateSettings(settings);
  }, []);

  /**
   * Update options
   */
  const updateOptions = useCallback((opts: Partial<LiveConversationOptions>) => {
    if (!managerRef.current) return;

    managerRef.current.updateOptions(opts);
  }, []);

  // Derived state
  const isSpeaking = conversationState === 'speaking';
  const isListening = conversationState === 'listening';
  const isProcessing = conversationState === 'processing' || conversationState === 'thinking';

  return {
    // State
    isActive,
    conversationState,
    history,

    // Controls
    startConversation,
    stopConversation,
    sendAssistantResponse,
    sendStreamingChunk,
    interrupt,

    // Settings
    updateSettings,
    updateOptions,

    // Info
    isSpeaking,
    isListening,
    isProcessing,
  };
}
