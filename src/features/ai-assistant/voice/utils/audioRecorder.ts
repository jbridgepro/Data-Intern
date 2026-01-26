/**
 * File: src/features/ai-assistant/voice/utils/audioRecorder.ts
 * 
 * Utility for recording audio from microphone and converting to base64 WAV format.
 * Used for Faster-Whisper transcription.
 * Enhanced with real-time audio level monitoring and voice activity detection.
 */

/**
 * Audio level callback type.
 */
export type AudioLevelCallback = (level: number) => void;

/**
 * Voice activity callback type.
 */
export type VoiceActivityCallback = (isActive: boolean) => void;

/**
 * Audio recorder class for capturing microphone input.
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private audioLevelCallback: AudioLevelCallback | null = null;
  private voiceActivityCallback: VoiceActivityCallback | null = null;
  private animationFrameId: number | null = null;
  private vadThreshold: number = 0.02; // Voice activity detection threshold
  private vadSilenceDuration: number = 1000; // Milliseconds of silence before considering speech ended
  private lastVoiceActivityTime: number = 0;
  private isVoiceActive: boolean = false;

  /**
   * Sets the audio level callback for real-time level monitoring.
   */
  setAudioLevelCallback(callback: AudioLevelCallback | null): void {
    this.audioLevelCallback = callback;
  }

  /**
   * Sets the voice activity detection callback.
   */
  setVoiceActivityCallback(callback: VoiceActivityCallback | null): void {
    this.voiceActivityCallback = callback;
  }

  /**
   * Sets the voice activity detection threshold (0.0 to 1.0).
   */
  setVADThreshold(threshold: number): void {
    this.vadThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Sets the silence duration before considering speech ended (in milliseconds).
   */
  setVADSilenceDuration(duration: number): void {
    this.vadSilenceDuration = Math.max(100, duration);
  }

  /**
   * Starts recording audio from the microphone.
   */
  async startRecording(): Promise<void> {
    try {
      // Request microphone access with enhanced constraints
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono
          sampleRate: 16000, // 16kHz for Whisper
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Additional constraints for better quality
          latency: 0.01, // Low latency
          googEchoCancellation: true,
          googNoiseSuppression: true,
          googAutoGainControl: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
        },
      });

      // Create audio context for level monitoring
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // Start audio level monitoring
      this.startAudioLevelMonitoring();

      // Create MediaRecorder with WAV format if supported, otherwise use webm
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 16000, // 16kbps
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
    } catch (error: any) {
      console.error('Error starting audio recording:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to access microphone.';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Microphone is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not support the required audio settings.';
      } else if (error.message) {
        errorMessage = `Microphone error: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Starts monitoring audio levels for visualization and VAD.
   */
  private startAudioLevelMonitoring(): void {
    if (!this.analyser || !this.dataArray) return;

    const monitor = () => {
      if (!this.analyser || !this.dataArray || !this.isRecording) {
        this.animationFrameId = null;
        return;
      }

      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate average audio level
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const averageLevel = sum / this.dataArray.length / 255; // Normalize to 0-1

      // Call audio level callback
      if (this.audioLevelCallback) {
        this.audioLevelCallback(averageLevel);
      }

      // Voice Activity Detection
      const currentTime = Date.now();
      const isCurrentlyActive = averageLevel > this.vadThreshold;

      if (isCurrentlyActive) {
        this.lastVoiceActivityTime = currentTime;
        if (!this.isVoiceActive) {
          this.isVoiceActive = true;
          if (this.voiceActivityCallback) {
            this.voiceActivityCallback(true);
          }
        }
      } else {
        // Check if we've been silent long enough
        if (this.isVoiceActive && (currentTime - this.lastVoiceActivityTime) > this.vadSilenceDuration) {
          this.isVoiceActive = false;
          if (this.voiceActivityCallback) {
            this.voiceActivityCallback(false);
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(monitor);
    };

    this.animationFrameId = requestAnimationFrame(monitor);
  }

  /**
   * Stops recording and returns audio as base64-encoded WAV.
   */
  async stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not currently recording'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          // Combine all audio chunks
          const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          
          // Convert to WAV format
          const wavBase64 = await this.convertToWav(audioBlob);
          
          // Clean up
          this.cleanup();
          
          resolve(wavBase64);
        } catch (error) {
          this.cleanup();
          reject(error);
        }
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }

  /**
   * Converts audio blob to WAV format and returns as base64.
   */
  private async convertToWav(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        try {
          // Decode audio data
          const audioBuffer = await audioContext.decodeAudioData(e.target?.result as ArrayBuffer);
          
          // Convert to WAV
          const wav = this.audioBufferToWav(audioBuffer);
          const wavBlob = new Blob([wav], { type: 'audio/wav' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(wavBlob);
        } catch (error) {
          reject(error);
        }
      };

      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(audioBlob);
    });
  }

  /**
   * Converts AudioBuffer to WAV format.
   */
  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    const channels: Float32Array[] = [];

    // Get channel data
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  }

  /**
   * Cleans up resources.
   */
  private cleanup(): void {
    // Stop audio level monitoring
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop audio context
    if (this.audioContext) {
      this.audioContext.close().catch(console.error);
      this.audioContext = null;
    }

    // Stop media stream
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }

    // Reset analyser
    this.analyser = null;
    this.dataArray = null;

    // Reset media recorder
    this.mediaRecorder = null;
    this.audioChunks = [];

    // Reset voice activity state
    this.isVoiceActive = false;
    this.lastVoiceActivityTime = 0;
  }

  /**
   * Checks if audio recording is available.
   */
  static isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 
           !!navigator.mediaDevices && 
           !!navigator.mediaDevices.getUserMedia;
  }
}
