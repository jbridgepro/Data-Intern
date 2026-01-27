/**
 * File: src/features/ai-assistant/voice/hooks/useVoiceOutput.ts
 * 
 * Hook for managing voice output (text-to-speech).
 */

import { useRef, useCallback } from 'react';
import { VoiceService } from '../voiceService';
import type { VoiceSettings, VoiceUpdateFrequency } from '../types';

/**
 * Hook for voice output functionality.
 */
export const useVoiceOutput = (settings: VoiceSettings) => {
  const voiceServiceRef = useRef<VoiceService | null>(null);

  // Initialize voice service
  if (!voiceServiceRef.current) {
    voiceServiceRef.current = new VoiceService(settings);
  }

  // Update service when settings change
  if (voiceServiceRef.current) {
    voiceServiceRef.current.updateSettings(settings);
  }

  /**
   * Speaks text with optional interruption.
   */
  const speak = useCallback((text: string, interrupt = false) => {
    if (voiceServiceRef.current && settings.voiceOutputEnabled) {
      voiceServiceRef.current.speak(text, interrupt);
    }
  }, [settings.voiceOutputEnabled]);

  /**
   * Stops current speech.
   */
  const stopSpeaking = useCallback(() => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.stopSpeaking();
    }
  }, []);

  /**
   * Speaks progress update based on frequency setting.
   */
  const speakProgress = useCallback((
    current: number,
    total: number,
    stage: string,
    frequency: VoiceUpdateFrequency
  ) => {
    if (!settings.voiceOutputEnabled) return;

    const percentage = Math.round((current / total) * 100);

    switch (frequency) {
      case 'verbose':
        // Speak every update
        speak(`${stage}. ${percentage}% complete.`);
        break;

      case 'milestones':
        // Speak at 25%, 50%, 75%, 100%
        if (percentage === 25 || percentage === 50 || percentage === 75 || percentage === 100) {
          speak(`${stage}. ${percentage}% complete.`);
        }
        break;

      case 'completion-only':
        // Only speak when done
        if (percentage === 100) {
          speak(`${stage} complete.`);
        }
        break;

      case 'silent':
        // Don't speak
        break;
    }
  }, [settings.voiceOutputEnabled, speak]);

  return {
    speak,
    stopSpeaking,
    speakProgress,
  };
};
