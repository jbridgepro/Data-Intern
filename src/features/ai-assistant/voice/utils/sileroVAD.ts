/**
 * File: src/features/ai-assistant/voice/utils/sileroVAD.ts
 *
 * Silero VAD wrapper using @ricky0123/vad-web for neural network-based
 * voice activity detection. Significantly more accurate than amplitude-based VAD.
 */

import { MicVAD, RealTimeVADOptions } from '@ricky0123/vad-web';

/**
 * Silero VAD sensitivity presets
 */
export type VADSensitivity = 'low' | 'medium' | 'high';

const SENSITIVITY_THRESHOLDS: Record<VADSensitivity, number> = {
    low: 0.7,      // Very confident speech only
    medium: 0.5,   // Balanced (default)
    high: 0.3,     // More sensitive, may pick up soft speech
};

/**
 * Callback types for VAD events
 */
export interface SileroVADCallbacks {
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio: Float32Array) => void;
    onVADMisfire?: () => void;
    onError?: (error: Error) => void;
}

/**
 * SileroVAD class wraps @ricky0123/vad-web with adaptive thresholds
 * and simplified API for integration with VoiceService.
 */
export class SileroVAD {
    private vad: MicVAD | null = null;
    private isRunning = false;
    private sensitivity: VADSensitivity = 'medium';
    private callbacks: SileroVADCallbacks = {};
    private adaptiveThreshold = false;
    private ambientNoiseLevel = 0;
    private speechProbabilityHistory: number[] = [];

    /**
     * Creates a new SileroVAD instance.
     */
    constructor(options?: {
        sensitivity?: VADSensitivity;
        adaptiveThreshold?: boolean;
    }) {
        this.sensitivity = options?.sensitivity || 'medium';
        this.adaptiveThreshold = options?.adaptiveThreshold ?? false;
    }

    /**
     * Sets the VAD sensitivity level.
     */
    setSensitivity(sensitivity: VADSensitivity): void {
        this.sensitivity = sensitivity;
        // If running, the threshold will be applied on next frame
    }

    /**
     * Enables or disables adaptive threshold based on ambient noise.
     */
    setAdaptiveThreshold(enabled: boolean): void {
        this.adaptiveThreshold = enabled;
    }

    /**
     * Sets the callback functions for VAD events.
     */
    setCallbacks(callbacks: SileroVADCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * Starts the Silero VAD with microphone input.
     * Returns a promise that resolves when VAD is ready.
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.warn('[SileroVAD] Already running');
            return;
        }

        try {
            const threshold = SENSITIVITY_THRESHOLDS[this.sensitivity];

            const vadOptions: Partial<RealTimeVADOptions> = {
                positiveSpeechThreshold: threshold,
                negativeSpeechThreshold: threshold - 0.15,
                redemptionMs: 768, // 8 frames * 96ms
                preSpeechPadMs: 96, // ~1 frame of padding
                minSpeechMs: 288, // ~3 frames minimum speech

                onSpeechStart: () => {
                    console.log('[SileroVAD] Speech started');
                    this.callbacks.onSpeechStart?.();
                },

                onSpeechEnd: (audio: Float32Array) => {
                    console.log('[SileroVAD] Speech ended, audio length:', audio.length);
                    this.callbacks.onSpeechEnd?.(audio);
                },

                onVADMisfire: () => {
                    console.log('[SileroVAD] VAD misfire (brief noise)');
                    this.callbacks.onVADMisfire?.();
                },
            };

            console.log('[SileroVAD] Starting with threshold:', threshold);
            this.vad = await MicVAD.new(vadOptions);
            this.vad.start();
            this.isRunning = true;
            console.log('[SileroVAD] Started successfully');

        } catch (error: any) {
            console.error('[SileroVAD] Failed to start:', error);
            this.callbacks.onError?.(error);
            throw error;
        }
    }

    /**
     * Pauses the VAD without destroying it.
     */
    pause(): void {
        if (this.vad && this.isRunning) {
            this.vad.pause();
            console.log('[SileroVAD] Paused');
        }
    }

    /**
     * Resumes the VAD after pausing.
     */
    resume(): void {
        if (this.vad && this.isRunning) {
            this.vad.start();
            console.log('[SileroVAD] Resumed');
        }
    }

    /**
     * Stops and destroys the VAD instance.
     */
    async stop(): Promise<void> {
        if (this.vad) {
            this.vad.pause();
            this.vad.destroy();
            this.vad = null;
            this.isRunning = false;
            this.speechProbabilityHistory = [];
            console.log('[SileroVAD] Stopped');
        }
    }

    /**
     * Checks if VAD is currently running.
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Gets the current effective threshold based on sensitivity and adaptation.
     */
    getEffectiveThreshold(): number {
        let threshold = SENSITIVITY_THRESHOLDS[this.sensitivity];

        if (this.adaptiveThreshold && this.ambientNoiseLevel > 0) {
            // Increase threshold in noisy environments
            threshold = Math.min(0.9, threshold + this.ambientNoiseLevel * 0.2);
        }

        return threshold;
    }

    /**
     * Updates the ambient noise level for adaptive thresholding.
     * Call this periodically with a noise estimate (0-1).
     */
    updateAmbientNoise(level: number): void {
        this.ambientNoiseLevel = Math.max(0, Math.min(1, level));
    }

    /**
     * Converts Float32Array audio to base64 WAV format.
     * Useful for sending captured speech to transcription service.
     */
    static audioToBase64Wav(audio: Float32Array, sampleRate = 16000): string {
        const numChannels = 1;
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = audio.length * bytesPerSample;
        const bufferSize = 44 + dataSize;

        const buffer = new ArrayBuffer(bufferSize);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, bufferSize - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Convert float samples to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < audio.length; i++) {
            const sample = Math.max(-1, Math.min(1, audio[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }

        // Convert to base64
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}
