/**
 * File: src/features/ai-assistant/voice/voiceService.ts
 * 
 * Voice service for handling speech-to-text and text-to-speech.
 * Supports multiple providers with fallback options.
 * Integrates Faster-Whisper (STT) and Piper (TTS) for optimal performance.
 */

import { invoke } from '@tauri-apps/api/core';
import type { VoiceSettings, VoiceRecognitionResult, VoiceState } from './types';
import { AudioRecorder } from './utils/audioRecorder';

/**
 * Voice service class.
 */
export class VoiceService {
  private settings: VoiceSettings;
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private currentState: VoiceState = 'idle';
  private onStateChange?: (state: VoiceState) => void;
  private onTranscript?: (result: VoiceRecognitionResult) => void;
  private isListening = false;
  private isPaused = false;
  private audioRecorder: AudioRecorder | null = null;
  private recordingInterval: NodeJS.Timeout | null = null;
  private onAudioLevel?: (level: number) => void;
  private onVoiceActivity?: (isActive: boolean) => void;
  private currentAudioLevel: number = 0;
  private isVoiceActive: boolean = false;

  constructor(settings: VoiceSettings) {
    this.settings = settings;
    this.initializeServices();
  }

  /**
   * Initializes voice services based on provider.
   */
  private initializeServices() {
    if (typeof window !== 'undefined') {
      // Initialize browser Speech Synthesis
      this.synthesis = window.speechSynthesis;

      // Initialize browser Speech Recognition (if available)
      const SpeechRecognition = (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.settings.language;

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          if (this.onTranscript) {
            this.onTranscript({
              text: finalTranscript || interimTranscript,
              confidence: event.results[event.results.length - 1]?.[0]?.confidence || 0.8,
              isFinal: finalTranscript.length > 0,
              interimResults: interimTranscript ? [interimTranscript] : undefined,
            });
          }
        };

        this.recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          this.setState('idle');
        };

        this.recognition.onend = () => {
          if (this.isListening && this.settings.activationMode === 'continuous') {
            // Restart if in continuous mode
            try {
              this.recognition.start();
            } catch (e) {
              // Already started or error
            }
          } else {
            this.setState('idle');
          }
        };
      }
    }
  }

  /**
   * Sets the state change callback.
   */
  setStateChangeCallback(callback: (state: VoiceState) => void) {
    this.onStateChange = callback;
  }

  /**
   * Sets the transcript callback.
   */
  setTranscriptCallback(callback: (result: VoiceRecognitionResult) => void) {
    this.onTranscript = callback;
  }

  /**
   * Sets the audio level callback for real-time level monitoring.
   */
  setAudioLevelCallback(callback: (level: number) => void) {
    this.onAudioLevel = callback;
  }

  /**
   * Sets the voice activity callback.
   */
  setVoiceActivityCallback(callback: (isActive: boolean) => void) {
    this.onVoiceActivity = callback;
  }

  /**
   * Gets the current audio level (0-1).
   */
  getCurrentAudioLevel(): number {
    return this.currentAudioLevel;
  }

  /**
   * Gets whether voice is currently active.
   */
  getIsVoiceActive(): boolean {
    return this.isVoiceActive;
  }

  /**
   * Updates settings.
   */
  updateSettings(settings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...settings };
    this.initializeServices();
  }

  /**
   * Starts listening for voice input.
   */
  async startListening() {
    if (this.isListening && !this.isPaused) return;

    // Resume if paused
    if (this.isPaused) {
      this.isPaused = false;
      this.setState('listening');
      return;
    }

    if (this.settings.provider === 'faster-whisper') {
      // Use Faster-Whisper via Tauri backend
      await this.startFasterWhisperListening();
    } else if (this.recognition && this.settings.provider === 'browser-stt') {
      try {
        this.recognition.start();
        this.isListening = true;
        this.isPaused = false;
        this.setState('listening');
      } catch (error) {
        console.error('Failed to start recognition:', error);
        throw error;
      }
    } else {
      // For other providers, would initialize their SDKs here
      console.warn('Voice provider not fully implemented:', this.settings.provider);
      this.isListening = true;
      this.isPaused = false;
      this.setState('listening');
    }
  }

  /**
   * Pauses listening without stopping the recording.
   */
  pauseListening() {
    if (!this.isListening || this.isPaused) return;

    this.isPaused = true;
    this.setState('idle');

    // For browser STT, we can't truly pause, so we stop
    if (this.recognition && this.settings.provider === 'browser-stt') {
      try {
        this.recognition.stop();
      } catch (error) {
        // Ignore errors if already stopped
      }
    }
  }

  /**
   * Resumes listening after being paused.
   */
  async resumeListening() {
    if (!this.isPaused) return;

    await this.startListening();
  }

  /**
   * Checks if listening is currently paused.
   */
  isPausedListening(): boolean {
    return this.isPaused;
  }

  /**
   * Starts listening with Faster-Whisper.
   */
  private async startFasterWhisperListening() {
    try {
      if (!AudioRecorder.isAvailable()) {
        throw new Error('Audio recording not available. Please check if your browser supports microphone access.');
      }

      this.audioRecorder = new AudioRecorder();

      // Set up audio level monitoring
      this.audioRecorder.setAudioLevelCallback((level) => {
        this.currentAudioLevel = level;
        if (this.onAudioLevel) {
          this.onAudioLevel(level);
        }
      });

      // Set up voice activity detection
      this.audioRecorder.setVoiceActivityCallback((isActive) => {
        this.isVoiceActive = isActive;
        if (this.onVoiceActivity) {
          this.onVoiceActivity(isActive);
        }
      });

      // Configure VAD based on settings - TUNED FOR NATURAL CONVERSATION
      if (this.settings.noiseCancellation) {
        this.audioRecorder.setVADThreshold(0.05);
        this.audioRecorder.setVADSilenceDuration(2000); // 2.0s for noisy (was 1000)
      } else {
        this.audioRecorder.setVADThreshold(0.015);
        this.audioRecorder.setVADSilenceDuration(1500); // 1.5s for normal (was 800)
      }

      // Handle Silence Detection (End of Thought)
      this.audioRecorder.setSilenceDetectionCallback(async () => {
        if (this.settings.activationMode === 'continuous' && this.isListening && !this.isPaused) {
          console.log('Silence detected, processing thought...');
          await this.processConversationTurn();
        }
      });

      // Handle Voice Start (Interruption/New Thought)
      this.audioRecorder.setVoiceStartCallback(() => {
        if (this.settings.activationMode === 'continuous' && this.isListening && !this.isPaused) {
          if (this.currentState !== 'speaking') {
            this.setState('listening');
          }
          // If speaking, we might want to stop speaking (barge-in)
          if (this.currentState === 'speaking' && this.settings.allowInterruptions) {
            this.stopSpeaking();
            this.setState('listening');
          }
        }
      });

      await this.audioRecorder.startRecording();
      this.isListening = true;
      this.setState('listening');

      // No more fixed interval loop!

    } catch (error: any) {
      console.error('Failed to start Faster-Whisper listening:', error);
      this.setState('idle');
      // Re-throw with more context if needed
      if (error.message) {
        throw error;
      }
      throw new Error(`Failed to start voice recording: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Starts continuous transcription for Faster-Whisper.
   */
  /**
   * Processes the current audio turn (silence detected).
   */
  private async processConversationTurn() {
    if (!this.audioRecorder || !this.isListening) return;

    try {
      // Flush the audio buffer without stopping recording
      const audioBase64 = await this.audioRecorder.flushAudio();

      // Only process if we got valid audio data
      // flushAudio returns null if audio is too short, corrupted, or conversion fails
      if (audioBase64 && audioBase64.length > 0) {
        // Only switch to 'processing' if we actually have audio
        // and we aren't already speaking (to avoid flickering)
        if (this.currentState !== 'speaking') {
          this.setState('processing');
        }

        await this.transcribeWithFasterWhisper(audioBase64);
      }
    } catch (error) {
      console.error('Error processing conversation turn:', error);
      this.setState('listening'); // Reset to listening on error
    }
  }

  /**
   * Stops listening for voice input.
   */
  async stopListening() {
    this.isPaused = false;

    if (this.settings.provider === 'faster-whisper' && this.audioRecorder && this.isListening) {
      // Stop continuous transcription
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }

      try {
        // Get final transcription
        const audioBase64 = await this.audioRecorder.stopRecording();
        if (audioBase64 && audioBase64.length > 0) {
          await this.transcribeWithFasterWhisper(audioBase64);
        } else {
          console.warn('No audio data to transcribe');
          this.setState('idle');
        }
      } catch (error: any) {
        console.error('Error during final transcription:', error);
        this.setState('idle');
        // Don't throw - just log and reset state
      }

      this.audioRecorder = null;
      this.isListening = false;
      this.currentAudioLevel = 0;
      this.isVoiceActive = false;

      // If we are just stopping, we might be in 'processing' state
      // but 'idle' is the correct final state
      this.setState('idle');
    } else if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        // Ignore errors if already stopped
      }
      this.isListening = false;
      this.currentAudioLevel = 0;
      this.isVoiceActive = false;
      this.setState('idle');
    }
  }

  /**
   * Transcribes audio using Faster-Whisper via Tauri backend.
   */
  private async transcribeWithFasterWhisper(audioBase64: string) {
    try {
      // Validate audio data
      if (!audioBase64 || audioBase64.length === 0) {
        console.warn('Empty audio data provided for transcription');
        this.setState('idle');
        return;
      }

      // Check minimum size (base64 encoded audio should be at least a few KB)
      if (audioBase64.length < 1000) {
        console.warn('Audio data is too short for transcription');
        this.setState('idle');
        return;
      }

      this.setState('processing');

      const serviceUrl = this.settings.voiceServiceUrl || 'http://127.0.0.1:8765';
      const language = this.settings.language === 'auto' ? null : this.settings.language;

      // Add timeout for transcription (30 seconds)
      const transcriptionPromise = invoke<{
        success: boolean;
        text?: string;
        language?: string;
        language_probability?: number;
        segments?: Array<{
          start: number;
          end: number;
          text: string;
          confidence: number;
        }>;
        error?: string;
      }>('transcribe_audio', {
        audioBase64,
        language,
        serviceUrl,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Transcription timeout: Service did not respond within 30 seconds')), 30000);
      });

      const result = await Promise.race([transcriptionPromise, timeoutPromise]);

      if (result.success && result.text) {
        const confidence = result.segments && result.segments.length > 0
          ? result.segments.reduce((sum, seg) => sum + seg.confidence, 0) / result.segments.length
          : 0.8;

        if (this.onTranscript) {
          this.onTranscript({
            text: result.text,
            confidence,
            isFinal: true,
            interimResults: undefined,
          });
        }
      } else {
        // Get detailed error message
        let errorMessage = result.error || 'Transcription failed: Unknown error';

        // Enhance error message with context
        if (errorMessage === 'Unknown error' || !errorMessage.includes(':')) {
          errorMessage = `Transcription failed: ${errorMessage}. The voice service may not be ready yet, or the Whisper model may still be loading.`;
        }

        console.error('Transcription failed:', errorMessage);

        // Provide user-friendly error feedback
        if (this.onTranscript) {
          this.onTranscript({
            text: '',
            confidence: 0,
            isFinal: true,
            interimResults: undefined,
          });
        }

        // Throw error to trigger fallback handling
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Faster-Whisper transcription error:', error);

      // Extract error message
      let errorMessage = 'Transcription failed';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error) {
        errorMessage = String(error);
      }

      // Handle specific error cases with better messages
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        errorMessage = 'Transcription timeout: The voice service did not respond in time. The Whisper model may still be loading (this can take 1-2 minutes on first run).';
        console.error('Transcription service timeout. Please check if the voice service is running and the model is loaded.');
      } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Failed to connect') || errorMessage.includes('Cannot connect')) {
        errorMessage = `Cannot connect to voice service at ${this.settings.voiceServiceUrl || 'http://127.0.0.1:8765'}. Please ensure the service is running and the Whisper model is loaded.`;
        console.error('Cannot connect to voice service. Please ensure the service is running at:', this.settings.voiceServiceUrl || 'http://127.0.0.1:8765');
      } else if (errorMessage.includes('model') && errorMessage.includes('loading')) {
        errorMessage = 'Whisper model is still loading. Please wait a moment and try again.';
        console.error('Whisper model is still loading.');
      } else if (errorMessage.includes('Decoding failed') || errorMessage.includes('EncodingError') || error?.message?.includes('Decoding failed')) {
        errorMessage = 'Audio decoding failed. The recorded audio may be corrupted, too short, or in an unsupported format. Please try speaking again.';
        console.error('Audio decoding error detected. This usually means the audio format is not supported or the audio data is corrupted.');
      }

      // Log the detailed error for debugging
      console.error('Detailed transcription error:', {
        message: errorMessage,
        originalError: error,
        serviceUrl: this.settings.voiceServiceUrl || 'http://127.0.0.1:8765',
      });

      // Handle audio decoding errors specifically - don't fallback, just reset state
      if (errorMessage.includes('Decoding failed') || errorMessage.includes('EncodingError') || error?.message?.includes('Decoding failed')) {
        // Don't fallback for decoding errors - they indicate a problem with the audio itself
        // Just reset state and let user try again
        this.setState('idle');
        return;
      }

      // Automatic fallback to browser-stt only if connection errors
      if (this.recognition && (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED'))) {
        console.log('Falling back to browser-stt provider due to connection error');
        // Update settings to use browser-stt
        this.updateSettings({ provider: 'browser-stt' });

        // Stop current listening (which was using faster-whisper)
        this.stopListening().then(() => {
          // Restart with new provider
          this.startListening();
        });
      } else {
        // For other errors (like model loading), don't fallback - just log the error
        // The user can retry once the model is loaded
        console.warn('Transcription error (not falling back):', errorMessage);
      }
    } finally {
      if (this.isListening && this.settings.provider === 'faster-whisper') {
        this.setState('listening');
      } else if (!this.isListening) {
        this.setState('idle');
      }
    }
  }

  /**
   * Speaks text using TTS.
   */
  async speak(text: string, interrupt = false) {
    if (!this.settings.voiceOutputEnabled) {
      return;
    }

    // Use Piper if provider is faster-whisper (they work together)
    if (this.settings.provider === 'faster-whisper' || this.settings.provider === 'piper') {
      await this.speakWithPiper(text, interrupt);
      return;
    }

    // Fallback to browser TTS
    if (!this.synthesis) {
      return;
    }

    if (interrupt && this.synthesis.speaking) {
      this.synthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.settings.voiceSpeed;
    utterance.volume = this.settings.volume / 100;
    utterance.lang = this.settings.language;

    utterance.onstart = () => {
      this.setState('speaking');
    };

    utterance.onend = () => {
      this.setState('idle');
    };

    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      this.setState('idle');
    };

    this.synthesis.speak(utterance);
  }

  /**
   * Speaks text using Piper TTS via Tauri backend.
   */
  private async speakWithPiper(text: string, interrupt: boolean) {
    try {
      if (interrupt) {
        this.stopSpeaking();
      }

      this.setState('speaking');

      const serviceUrl = this.settings.voiceServiceUrl || 'http://127.0.0.1:8765';
      const voice = this.settings.piperVoice || 'en_US-lessac-medium';
      const speed = this.settings.voiceSpeed;

      const result = await invoke<{
        success: boolean;
        audio?: string;
        format?: string;
        error?: string;
      }>('synthesize_speech', {
        text,
        voice,
        speed,
        serviceUrl,
      });

      if (result.success && result.audio) {
        // Decode base64 audio and play it
        await this.playAudioFromBase64(result.audio);
      } else {
        // Check if error indicates missing voice model
        const errorMessage = result.error || '';
        const isHTMLResponse = errorMessage.includes('<!DOCTYPE HTML>') || errorMessage.includes('<html');
        const isVoiceNotFound = isHTMLResponse ||
                              errorMessage.includes('not found') || 
                              errorMessage.includes('404') ||
                              errorMessage.includes('Voice model');
        
        if (isVoiceNotFound) {
          // Extract error message from HTML if present
          let extractedMessage = errorMessage;
          if (isHTMLResponse) {
            const match = errorMessage.match(/<p>Message: ([^<]+)<\/p>/);
            if (match) {
              extractedMessage = match[1];
            }
          }
          
          console.warn(`Voice model '${voice}' not found: ${extractedMessage}`);
          console.warn('Falling back to browser TTS. To use Piper TTS, please download the voice model and place it in the voices directory.');
        } else {
          console.error('Piper synthesis failed:', result.error);
        }
        
        // Fallback to browser TTS
        this.fallbackToBrowserTTS(text);
      }
    } catch (error: any) {
      console.error('Piper TTS error:', error);
      
      // Check if error is about missing voice model
      const errorMessage = error?.message || String(error) || '';
      const isHTMLResponse = errorMessage.includes('<!DOCTYPE HTML>') || errorMessage.includes('<html');
      const isVoiceNotFound = isHTMLResponse ||
                            errorMessage.includes('not found') || 
                            errorMessage.includes('404') ||
                            errorMessage.includes('Voice model');
      
      if (isVoiceNotFound) {
        const voice = this.settings.piperVoice || 'en_US-lessac-medium';
        
        // Extract error message from HTML if present
        let extractedMessage = errorMessage;
        if (isHTMLResponse) {
          const match = errorMessage.match(/<p>Message: ([^<]+)<\/p>/);
          if (match) {
            extractedMessage = match[1];
          }
        }
        
        console.warn(`Voice model '${voice}' not found: ${extractedMessage}`);
        console.warn('Falling back to browser TTS. To use Piper TTS, please download the voice model and place it in the voices directory.');
      }
      
      // Fallback to browser TTS
      this.fallbackToBrowserTTS(text);
    }
  }

  /**
   * Fallback to browser TTS when Piper is unavailable.
   */
  private fallbackToBrowserTTS(text: string) {
    if (!this.synthesis) {
      console.warn('Browser TTS not available');
      this.setState('idle');
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.settings.voiceSpeed;
      utterance.volume = this.settings.volume / 100;
      utterance.lang = this.settings.language === 'auto' ? 'en-US' : this.settings.language;
      
      utterance.onstart = () => {
        this.setState('speaking');
      };
      
      utterance.onend = () => {
        this.setState('idle');
      };
      
      utterance.onerror = (error) => {
        console.error('Browser TTS error:', error);
        this.setState('idle');
      };
      
      this.synthesis.speak(utterance);
    } catch (error) {
      console.error('Failed to use browser TTS:', error);
      this.setState('idle');
    }
  }

  /**
   * Plays audio from base64-encoded WAV data.
   */
  private async playAudioFromBase64(audioBase64: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Decode base64
        const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const audioBlob = new Blob([audioData], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Create audio element
        const audio = new Audio(audioUrl);
        audio.volume = this.settings.volume / 100;
        audio.playbackRate = this.settings.voiceSpeed;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.setState('idle');
          resolve();
        };

        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          reject(error);
        };

        audio.play();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stops current speech.
   */
  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.setState('idle');
    }
  }

  /**
   * Detects if user said an approval command.
   */
  detectApproval(text: string): boolean {
    const approvalPhrases = [
      'yes', 'yeah', 'yep', 'yup',
      'approve', 'approved',
      'go ahead', 'do it', 'start', 'begin', 'execute',
      'looks good', 'perfect', 'proceed',
      'sure', 'okay', 'ok', 'alright',
    ];

    const lowerText = text.toLowerCase().trim();
    return approvalPhrases.some(phrase =>
      lowerText.includes(phrase) || lowerText === phrase
    );
  }

  /**
   * Detects if user said a cancellation command.
   */
  detectCancellation(text: string): boolean {
    const cancelPhrases = [
      'no', 'nope', 'cancel', 'stop', 'abort',
      "don't do it", 'wait', 'hold on',
      'never mind', 'forget it',
    ];

    const lowerText = text.toLowerCase().trim();
    return cancelPhrases.some(phrase =>
      lowerText.includes(phrase) || lowerText === phrase
    );
  }

  /**
   * Sets the current state.
   */
  private setState(state: VoiceState) {
    this.currentState = state;
    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }

  /**
   * Gets the current state.
   */
  getState(): VoiceState {
    return this.currentState;
  }

  /**
   * Checks if voice recognition is available.
   */
  static isAvailable(): boolean {
    if (typeof window === 'undefined') return false;

    // Check for Faster-Whisper (via Tauri)
    if (typeof (window as any).__TAURI__ !== 'undefined') {
      return true; // Tauri is available, can use Faster-Whisper
    }

    // Check for browser Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }

  /**
   * Checks if voice service (Faster-Whisper + Piper) is available.
   */
  static async checkVoiceServiceHealth(serviceUrl?: string): Promise<{
    status: string;
    whisper_available: boolean;
    piper_available: boolean;
    error?: string;
  }> {
    try {
      if (typeof (window as any).__TAURI__ === 'undefined') {
        return {
          status: 'unavailable',
          whisper_available: false,
          piper_available: false,
        };
      }

      const result = await invoke<{
        status: string;
        whisper_available: boolean;
        piper_available: boolean;
        service: string;
      }>('check_voice_service_health', {
        serviceUrl: serviceUrl || 'http://127.0.0.1:8765',
      });

      return {
        status: result.status,
        whisper_available: result.whisper_available,
        piper_available: result.piper_available,
      };
    } catch (error) {
      console.error('Voice service health check failed:', error);
      return {
        status: 'unavailable',
        whisper_available: false,
        piper_available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
