/**
 * File: src/features/ai-assistant/hooks/useVoiceInput.ts
 * 
 * Hook for managing voice input in the chat input component.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceService } from '../voice/voiceService';
import type { VoiceSettings } from '../voice/types';

export const useVoiceInput = (
  settings: VoiceSettings,
  onTranscript: (text: string) => void
) => {
  const [isListening, setIsListening] = useState(false);
  const [transcribing, setTranscribing] = useState('');
  const voiceServiceRef = useRef<VoiceService | null>(null);

  // Initialize voice service
  useEffect(() => {
    if (VoiceService.isAvailable()) {
      const service = new VoiceService(settings);
      service.setTranscriptCallback((result) => {
        if (result.isFinal) {
          setTranscribing('');
          onTranscript(result.text);
          setIsListening(false);
        } else {
          setTranscribing(result.text);
        }
      });
      service.setStateChangeCallback((state) => {
        setIsListening(state === 'listening');
      });
      voiceServiceRef.current = service;
    }

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stopListening();
        voiceServiceRef.current.stopSpeaking();
      }
    };
  }, [settings, onTranscript]);

  const startListening = useCallback(() => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.startListening();
      setIsListening(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.stopListening();
      setIsListening(false);
      setTranscribing('');
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcribing,
    startListening,
    stopListening,
    toggleListening,
    isAvailable: VoiceService.isAvailable(),
  };
};
