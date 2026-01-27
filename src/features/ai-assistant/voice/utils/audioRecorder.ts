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

  private vadSilenceCallback: (() => void) | null = null;
  private vadVoiceStartCallback: (() => void) | null = null;
  private animationFrameId: number | null = null;

  // Adjusted defaults for more natural conversation
  private vadThreshold: number = 0.02;
  private vadSilenceDuration: number = 1200; // 1.2s silence to trigger "end of thought"
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
   * Sets callback for when silence is detected (end of speech).
   */
  setSilenceDetectionCallback(callback: () => void): void {
    this.vadSilenceCallback = callback;
  }

  /**
   * Sets callback for when voice starts.
   */
  setVoiceStartCallback(callback: () => void): void {
    this.vadVoiceStartCallback = callback;
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
          // Voice started
          if (this.voiceActivityCallback) this.voiceActivityCallback(true);
          if (this.vadVoiceStartCallback) this.vadVoiceStartCallback();
        }
      } else {
        // Check if we've been silent long enough
        if (this.isVoiceActive && (currentTime - this.lastVoiceActivityTime) > this.vadSilenceDuration) {
          this.isVoiceActive = false;
          // Voice ended (Silence detected)
          if (this.voiceActivityCallback) this.voiceActivityCallback(false);
          if (this.vadSilenceCallback) this.vadSilenceCallback();
        }
      }

      this.animationFrameId = requestAnimationFrame(monitor);
    };

    this.animationFrameId = requestAnimationFrame(monitor);
  }

  /**
   * Stops recording and returns audio as base64-encoded WAV.
   */
  /**
   * Flushes currently recorded audio and returns it as base64-encoded WAV.
   * Does NOT stop recording.
   */
  async flushAudio(): Promise<string | null> {
    if (!this.mediaRecorder || !this.isRecording) {
      return null;
    }

    // Force flush current data
    try {
      this.mediaRecorder.requestData();
    } catch (error) {
      console.warn('Failed to request data from MediaRecorder:', error);
      return null;
    }

    // Give more time for the dataavailable event to fire and push to chunks
    // Increased from 100ms to 200ms for more reliable data collection
    await new Promise(resolve => setTimeout(resolve, 200));

    if (this.audioChunks.length === 0) {
      console.debug('No audio chunks available for flushing');
      return null;
    }

    try {
      // Combine all audio chunks
      const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });

      // Validate blob size - increased minimum to 2KB for more reliable decoding
      // Very small audio blobs often fail to decode properly
      if (audioBlob.size < 2048) {
        console.debug(`Audio blob is too small (${audioBlob.size} bytes), skipping conversion. Minimum: 2048 bytes`);
        return null;
      }

      // Validate that we have actual audio data (not just empty chunks)
      let totalChunkSize = 0;
      for (const chunk of this.audioChunks) {
        totalChunkSize += chunk.size;
      }
      
      if (totalChunkSize < 2048) {
        console.debug(`Total chunk size is too small (${totalChunkSize} bytes), skipping conversion`);
        return null;
      }

      // Convert to WAV format with better error handling
      let wavBase64: string;
      try {
        wavBase64 = await this.convertToWav(audioBlob);
      } catch (conversionError: any) {
        // If conversion fails, it might be because the audio is too short or corrupted
        // Log the error but don't throw - just return null
        console.warn('Audio conversion failed during flush:', conversionError.message || conversionError);
        
        // If it's a decoding error, the audio might be too short or in an unsupported format
        // This is common when flushing very short audio segments
        if (conversionError.message?.includes('Decoding failed') || 
            conversionError.message?.includes('EncodingError')) {
          console.debug('Audio decoding failed - likely too short or unsupported format. This is normal for very brief audio segments.');
        }
        
        return null;
      }
      
      // Only clear chunks after successful conversion
      // Keep a small buffer of recent chunks to avoid losing data
      // Clear all but the last few chunks to maintain continuity
      if (this.audioChunks.length > 3) {
        // Keep the last 2 chunks for continuity
        this.audioChunks = this.audioChunks.slice(-2);
      } else {
        // If we have few chunks, clear them all
        this.audioChunks = [];
      }
      
      return wavBase64;
    } catch (error: any) {
      // Catch any other unexpected errors
      console.error('Error flushing audio:', error);
      // Don't clear chunks on error - they might still be valid for the next attempt
      return null;
    }
  }

  /**
   * Stops recording and returns audio as base64-encoded WAV.
   */
  async stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        // If not recording but we have data, try to return it
        if (this.audioChunks.length > 0) {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          // Validate blob before conversion
          if (blob.size < 1024) {
            console.warn('Audio data is too short, returning empty string');
            this.cleanup();
            resolve('');
            return;
          }
          this.convertToWav(blob)
            .then((result) => {
              this.cleanup();
              resolve(result);
            })
            .catch((error) => {
              this.cleanup();
              console.error('Failed to convert audio on stop:', error);
              // Resolve with empty string instead of rejecting to prevent crashes
              resolve('');
            });
          return;
        }
        this.cleanup();
        resolve(''); // Just resolve empty if nothing
        return;
      }

      // Set up stop handler before stopping
      this.mediaRecorder.onstop = async () => {
        try {
          // Wait a bit for any final data to arrive
          await new Promise(resolve => setTimeout(resolve, 100));

          // Check if we have any chunks
          if (this.audioChunks.length === 0) {
            console.warn('No audio chunks recorded');
            this.cleanup();
            resolve('');
            return;
          }

          // Combine all audio chunks
          const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });

          // Validate blob size
          if (audioBlob.size < 1024) {
            console.warn('Audio blob is too small, returning empty string');
            this.cleanup();
            resolve('');
            return;
          }

          // Convert to WAV format
          const wavBase64 = await this.convertToWav(audioBlob);

          // Clean up
          this.cleanup();

          resolve(wavBase64);
        } catch (error: any) {
          console.error('Error during stop recording:', error);
          this.cleanup();
          // Resolve with empty string instead of rejecting to prevent crashes
          resolve('');
        }
      };

      // Handle errors during stop
      this.mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error during stop:', event.error);
        this.cleanup();
        resolve(''); // Resolve with empty instead of rejecting
      };

      try {
        this.mediaRecorder.stop();
        this.isRecording = false;
      } catch (error: any) {
        console.error('Error stopping MediaRecorder:', error);
        this.cleanup();
        resolve(''); // Resolve with empty instead of rejecting
      }
    });
  }

  /**
   * Converts audio blob to WAV format and returns as base64.
   */
  private async convertToWav(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      // Validate blob
      if (!audioBlob || audioBlob.size === 0) {
        reject(new Error('Audio blob is empty or invalid'));
        return;
      }

      // Check minimum size (at least 1KB for valid audio)
      if (audioBlob.size < 1024) {
        reject(new Error('Audio data is too short to be valid'));
        return;
      }

      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          
          // Validate array buffer
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            reject(new Error('Failed to read audio data'));
            return;
          }

          // Decode audio data with better error handling
          let audioBuffer: AudioBuffer;
          try {
            // Use cloneArrayBuffer to avoid "ArrayBuffer is detached" errors
            const clonedBuffer = arrayBuffer.slice(0);
            audioBuffer = await audioContext.decodeAudioData(clonedBuffer);
          } catch (decodeError: any) {
            // Provide more specific error message
            if (decodeError.name === 'EncodingError' || decodeError.message?.includes('Decoding failed')) {
              // This often happens with very short audio segments or unsupported formats
              // It's not necessarily an error - just means this audio segment can't be decoded
              reject(new Error(`Audio decoding failed: The audio format may not be supported or the audio segment is too short. Original error: ${decodeError.message}`));
            } else {
              reject(new Error(`Audio decoding failed: ${decodeError.message || 'Unknown error'}`));
            }
            return;
          }

          // Validate decoded audio buffer
          if (!audioBuffer || audioBuffer.length === 0) {
            reject(new Error('Decoded audio buffer is empty'));
            return;
          }

          // Convert to WAV
          const wav = this.audioBufferToWav(audioBuffer);
          const wavBlob = new Blob([wav], { type: 'audio/wav' });

          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            if (!result) {
              reject(new Error('Failed to convert WAV to base64'));
              return;
            }
            const base64 = result.split(',')[1];
            if (!base64) {
              reject(new Error('Failed to extract base64 data'));
              return;
            }
            resolve(base64);
          };
          reader.onerror = (error) => {
            reject(new Error(`Failed to read WAV blob: ${error}`));
          };
          reader.readAsDataURL(wavBlob);
        } catch (error: any) {
          reject(new Error(`Error processing audio: ${error.message || 'Unknown error'}`));
        } finally {
          // Clean up audio context
          try {
            await audioContext.close();
          } catch (closeError) {
            // Ignore close errors
          }
        }
      };

      fileReader.onerror = (error) => {
        reject(new Error(`Failed to read audio blob: ${error}`));
      };
      
      try {
        fileReader.readAsArrayBuffer(audioBlob);
      } catch (error: any) {
        reject(new Error(`Failed to start reading audio blob: ${error.message || 'Unknown error'}`));
      }
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
