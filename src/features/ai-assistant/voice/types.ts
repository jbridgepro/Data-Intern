/**
 * File: src/features/ai-assistant/voice/types.ts
 * 
 * Type definitions for voice-enabled AI Assistant.
 */

/**
 * Voice provider types.
 */
export type VoiceProvider = 
  | 'openai-realtime'
  | 'gemini-live'
  | 'claude-voice'
  | 'browser-stt'
  | 'faster-whisper'  // Faster-Whisper for STT
  | 'piper';          // Piper for TTS (used automatically with faster-whisper)

/**
 * Voice activation modes.
 */
export type VoiceActivationMode = 
  | 'push-to-talk'
  | 'continuous'
  | 'voice-activity-detection';

/**
 * Voice output update frequency.
 */
export type VoiceUpdateFrequency = 
  | 'verbose'
  | 'milestones'
  | 'completion-only'
  | 'silent';

/**
 * Voice recognition state.
 */
export type VoiceState = 
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'waiting';

/**
 * Voice settings configuration.
 */
export interface VoiceSettings {
  provider: VoiceProvider;
  activationMode: VoiceActivationMode;
  voiceOutputEnabled: boolean;
  voiceSpeed: number; // 0.5 - 2.0
  volume: number; // 0 - 100
  updateFrequency: VoiceUpdateFrequency;
  language: string;
  showTranscription: boolean;
  autoPunctuation: boolean;
  noiseCancellation: boolean;
  allowInterruptions: boolean;
  wakeWord?: string;
  // Faster-Whisper specific settings
  whisperModelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3';
  whisperDevice?: 'cpu' | 'cuda';
  whisperComputeType?: 'int8' | 'int8_float16' | 'int16' | 'float16' | 'float32';
  // Piper specific settings
  piperVoice?: string; // e.g., 'en_US-lessac-medium'
  // Voice service URL
  voiceServiceUrl?: string; // Default: http://127.0.0.1:8765
}

/**
 * Voice recognition result.
 */
export interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  interimResults?: string[];
}

/**
 * Clarification question.
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'choice' | 'text' | 'path' | 'number' | 'date';
  options?: Array<{
    label: string;
    value: any;
    description?: string;
  }>;
  required: boolean;
}

/**
 * Implementation plan step.
 */
export interface ImplementationStep {
  id: string;
  order: number;
  tool: string;
  description: string;
  parameters: Record<string, any>;
  estimatedDuration: number; // seconds
  dependencies?: string[]; // step IDs
}

/**
 * Implementation plan.
 */
export interface ImplementationPlan {
  id: string;
  task: string;
  description: string;
  steps: ImplementationStep[];
  estimatedTotalTime: number; // seconds
  riskLevel: 'low' | 'medium' | 'high';
  safetyChecks: string[];
  preview?: {
    before: any;
    after: any;
  };
}

/**
 * Voice approval result.
 */
export interface VoiceApprovalResult {
  approved: boolean;
  method: 'voice' | 'ui';
  command?: string;
  confidence?: number;
}
