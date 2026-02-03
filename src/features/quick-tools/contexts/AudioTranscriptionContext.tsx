/**
 * File: src/features/quick-tools/contexts/AudioTranscriptionContext.tsx
 *
 * Context for the Audio Transcription quick tool. Manages recording, file uploads,
 * and transcription jobs via the Tauri voice service (Faster-Whisper).
 * Remote VibeVoice-ASR is supported via custom service URL.
 */

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Supported transcription provider: Faster-Whisper (local) or Groq (cloud) */
export type TranscriptionProvider = "faster-whisper" | "groq";

/** User-configurable options for the transcription service */
export interface TranscriptionOptions {
  serviceUrl: string;
  provider: TranscriptionProvider;
  language: string | null;
  enableDiarization: boolean;
  groqApiKey?: string;
}

export const defaultTranscriptionOptions: TranscriptionOptions = {
  serviceUrl: "http://127.0.0.1:8765",
  provider: "faster-whisper",
  language: null,
  enableDiarization: false,
  groqApiKey: localStorage.getItem("groq-api-key") || "",
};

export interface TranscriptionJob {
  id: string;
  type: "file" | "recording";
  name: string;
  status: "recording" | "processing" | "completed" | "error";
  progress: number;
  transcript: string;
  segments: TranscriptionSegment[];
  audioUrl?: string;
  audioBlob?: Blob;
  /** Original file extension for uploads (e.g. "mp3") for download filename */
  fileExtension?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

/** Result of voice service health check */
export interface VoiceServiceHealth {
  status: string;
  whisper_available: boolean;
  piper_available: boolean;
  error?: string;
}

interface AudioTranscriptionContextType {
  jobs: TranscriptionJob[];
  activeRecording: TranscriptionJob | null;
  isRecording: boolean;
  audioLevel: number;
  options: TranscriptionOptions;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  transcribeFile: (file: File) => Promise<void>;
  clearJob: (id: string) => void;
  clearAllJobs: () => void;
  downloadAudio: (jobId: string) => void;
  downloadTranscript: (jobId: string) => void;
  updateOptions: (partial: Partial<TranscriptionOptions>) => void;
  checkHealth: () => Promise<VoiceServiceHealth>;
  /** Start the voice service process (Tauri only). Returns success or error message. */
  startService: () => Promise<{ success: boolean; error?: string }>;
}

const AudioTranscriptionContext = createContext<AudioTranscriptionContextType | null>(null);

export const useAudioTranscription = () => {
  const context = useContext(AudioTranscriptionContext);
  if (!context) {
    throw new Error("useAudioTranscription must be used within AudioTranscriptionProvider");
  }
  return context;
};

export const AudioTranscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [activeRecording, setActiveRecording] = useState<TranscriptionJob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [options, setOptions] = useState<TranscriptionOptions>(defaultTranscriptionOptions);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const updateOptions = useCallback((partial: Partial<TranscriptionOptions>) => {
    setOptions((prev) => ({ ...prev, ...partial }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const showNotification = useCallback((title: string, body: string) => {
    // Use browser notifications if available
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, { body });
        }
      });
    }
  }, []);
  
  /** Get supported MIME type for MediaRecorder */
  const getSupportedMimeType = useCallback(() => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ""; // Let browser choose default if none match
  }, []);

  /**
   * Convert audio blob to WAV PCM format and return as base64.
   * This ensures the backend receives a valid WAV file.
   */
  const convertBlobToWavBase64 = useCallback(async (blob: Blob): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new AudioContext();
        
        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch (decodeError) {
          // If decoding fails, just send raw base64 and let backend handle it
          console.warn("Audio decode failed, sending raw format:", decodeError);
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          await audioContext.close();
          resolve(base64);
          return;
        }

        // Convert AudioBuffer to WAV
        const wavBuffer = audioBufferToWav(audioBuffer);
        const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          audioContext.close();
          resolve(base64);
        };
        reader.onerror = (err) => {
          audioContext.close();
          reject(err);
        };
        reader.readAsDataURL(wavBlob);
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  /**
   * Convert AudioBuffer to WAV ArrayBuffer.
   */
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    const channels: Float32Array[] = [];

    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  };

  /** Check voice service health (Tauri backend). Does not rely on window.__TAURI__ (Tauri v2 may not set it). */
  const checkHealth = useCallback(async (): Promise<VoiceServiceHealth> => {
    try {
      const result = await invoke<{
        status: string;
        whisper_available: boolean;
        piper_available: boolean;
        error?: string;
      }>("check_voice_service_health", {
        serviceUrl: options.serviceUrl,
      });
      return {
        status: result.status,
        whisper_available: result.whisper_available,
        piper_available: result.piper_available,
        error: result.error,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "unavailable",
        whisper_available: false,
        piper_available: false,
        error: message,
      };
    }
  }, [options.serviceUrl]);

  /** Start the voice service process via Tauri. Parses options.serviceUrl for host/port. */
  const startService = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const url = options.serviceUrl || "http://127.0.0.1:8765";
      let host = "127.0.0.1";
      let port = 8765;
      try {
        const urlObj = new URL(url);
        host = urlObj.hostname;
        port = urlObj.port ? parseInt(urlObj.port, 10) : 8765;
      } catch {
        const match = url.match(/https?:\/\/([^:]+):?(\d+)?/);
        if (match) {
          host = match[1];
          if (match[2]) port = parseInt(match[2], 10);
        }
      }
      await invoke<string>("start_voice_service", {
        config: {
          host,
          port,
          model_size: "base",
          device: "cpu",
          compute_type: "int8",
        },
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }, [options.serviceUrl]);

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
    }
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  /**
   * Shared transcription logic: invoke backend with streaming and update job state.
   * Used by both recording (transcribeBlob) and file upload (transcribeFile).
   */
  const runTranscribe = useCallback(
    async (
      jobId: string,
      displayName: string,
      audioBase64: string,
      fileExtension?: string
    ): Promise<void> => {
      let unlisten: (() => void) | undefined;
      try {
        let currentTranscript = "";
        unlisten = await listen<any>("transcription-stream", (event) => {
          const payload = event.payload;
          if (!payload) return;
          if (payload.type === "token" || payload.type === "segment") {
            const chunk = payload.text ?? "";
            currentTranscript += chunk;
            setJobs((prev) =>
              prev.map((job) =>
                job.id === jobId
                  ? { ...job, transcript: currentTranscript, progress: Math.min(90, job.progress + 5) }
                  : job
              )
            );
          } else if (payload.type === "done" && (payload.text ?? "").trim()) {
            currentTranscript = (payload.text ?? "").trim();
            setJobs((prev) =>
              prev.map((job) =>
                job.id === jobId ? { ...job, transcript: currentTranscript, progress: 95 } : job
              )
            );
          }
        });



        let result: {
          success: boolean;
          text?: string;
          segments?: TranscriptionSegment[];
          error?: string;
        };

        if (options.provider === "groq") {
          if (!options.groqApiKey) {
            throw new Error("Groq API Key is required. Please enter it in the settings panel.");
          }

          // Convert base64 to Blob for Groq API
          const binaryString = window.atob(audioBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "audio/wav" });
          const file = new File([blob], "audio.wav", { type: "audio/wav" });

          const formData = new FormData();
          formData.append("file", file);
          formData.append("model", "whisper-large-v3-turbo"); // Use Turbo for speed/cost
          if (options.language && options.language !== "auto") {
            formData.append("language", options.language);
          }
          formData.append("response_format", "verbose_json"); // Get segments

          const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${options.groqApiKey}`
            },
            body: formData
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
            throw new Error(err.error?.message || `Groq API Error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          result = {
            success: true,
            text: data.text,
            segments: data.segments?.map((s: any) => ({
              start: s.start,
              end: s.end,
              text: s.text,
              confidence: 1.0
            })) || [],
          };

        } else {
          // Default: Tauri local voice service (Faster-Whisper)
          result = await invoke<{
            success: boolean;
            text?: string;
            segments?: TranscriptionSegment[];
            error?: string;
          }>("transcribe_audio", {
            audioBase64,
            language: options.language || null,
            serviceUrl: options.serviceUrl,
            provider: options.provider,
            hotwords: null,
            enableDiarization: options.enableDiarization,
            stream: true,
          });
        }

        unlisten?.();

        if (result.success) {
          const fromSegments =
            result.segments && result.segments.length > 0
              ? result.segments.map((s) => s.text).join(" ").trim()
              : "";
          const accumulatedText =
            (result.text && result.text.trim()) ||
            currentTranscript.trim() ||
            fromSegments ||
            "";
          
          setJobs((prev) =>
            prev.map((job) => {
              if (job.id !== jobId) return job;
              return {
                ...job,
                status: "completed",
                progress: 100,
                transcript: accumulatedText,
                segments: result.segments ?? job.segments ?? [],
                completedAt: new Date(),
                ...(fileExtension !== undefined ? { fileExtension } : {}),
              };
            })
          );
          showNotification("Transcription Complete", `"${displayName}" has finished transcribing.`);
        } else {
          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId ? { ...job, status: "error", error: result.error || "Transcription failed" } : job
            )
          );
          showNotification("Transcription Failed", result.error || "Unable to transcribe audio");
        }
      } catch (error: unknown) {
        unlisten?.();
        const errorMessage = error instanceof Error ? error.message : "Transcription failed";
        if (errorMessage.includes("Network Error") || errorMessage.includes("Failed to fetch")) {
          const detail = "Could not connect to voice service. Please ensure it is running.";
          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId ? { ...job, status: "error", error: detail } : job
            )
          );
          showNotification("Connection Failed", detail);
        } else {
          setJobs((prev) =>
            prev.map((job) =>
              job.id === jobId ? { ...job, status: "error", error: errorMessage } : job
            )
          );
          showNotification("Transcription Error", errorMessage);
        }
      }
    },
    [options.serviceUrl, options.provider, options.language, options.enableDiarization, showNotification]
  );

  /** Transcribe a recorded blob; called from MediaRecorder onstop with job id and name. */
  const transcribeBlob = useCallback(
    async (blob: Blob, jobId: string, displayName: string) => {
      try {
        // Convert to WAV format for reliable backend processing
        const base64 = await convertBlobToWavBase64(blob);
        await runTranscribe(jobId, displayName, base64);
      } finally {
        setActiveRecording(null);
      }
    },
    [runTranscribe, convertBlobToWavBase64]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio analysis for level monitoring
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Create MediaRecorder
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Create new job first so we have stable id/name for transcribeBlob
      const newJob: TranscriptionJob = {
        id: `rec-${Date.now()}`,
        type: "recording",
        name: `Recording ${new Date().toLocaleTimeString()}`,
        status: "recording",
        progress: 0,
        transcript: "",
        segments: [],
        createdAt: new Date(),
      };

      setJobs((prev) => [newJob, ...prev]);
      setActiveRecording(newJob);

      mediaRecorder.onstop = async () => {
        // Use the actual mime type from the recorder or the one we selected
        const blobType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Update job with blob and switch to processing
        setActiveRecording((prev) =>
          prev
            ? {
                ...prev,
                status: "processing",
                audioBlob,
                audioUrl,
              }
            : null
        );
        setJobs((prev) =>
          prev.map((job) =>
            job.id === newJob.id
              ? { ...job, status: "processing", audioBlob, audioUrl }
              : job
          )
        );

        // Run transcription with stable job id and display name
        await transcribeBlob(audioBlob, newJob.id, newJob.name);
      };

      setIsRecording(true);
      mediaRecorder.start(1000); // Collect data every second
      updateAudioLevel();
    } catch (error: unknown) {
      console.error("Failed to start recording:", error);
      const message = error instanceof Error ? error.message : "Unable to access microphone";
      showNotification("Recording Failed", message);
    }
  }, [updateAudioLevel, showNotification, transcribeBlob]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false);
      setAudioLevel(0);
      mediaRecorderRef.current.stop();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  }, [isRecording]);

  const transcribeFile = useCallback(
    async (file: File) => {
      const jobId = `file-${Date.now()}`;
      const audioUrl = URL.createObjectURL(file);
      // Preserve file extension for download (e.g. "mp3", "wav")
      const fileExtension = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
        : undefined;

      const newJob: TranscriptionJob = {
        id: jobId,
        type: "file",
        name: file.name,
        status: "processing",
        progress: 0,
        transcript: "",
        segments: [],
        audioUrl,
        fileExtension,
        createdAt: new Date(),
      };

      setJobs((prev) => [newJob, ...prev]);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        await runTranscribe(jobId, file.name, base64, fileExtension);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Transcription failed";
        setJobs((prev) =>
          prev.map((job) =>
            job.id === jobId ? { ...job, status: "error", error: errorMessage } : job
          )
        );
        showNotification("Transcription Error", errorMessage);
      }
    },
    [runTranscribe, showNotification]
  );

  const clearJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job?.audioUrl) {
        URL.revokeObjectURL(job.audioUrl);
      }
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  const clearAllJobs = useCallback(() => {
    setJobs((prev) => {
      prev.forEach((job) => {
        if (job.audioUrl) {
          URL.revokeObjectURL(job.audioUrl);
        }
      });
      return [];
    });
  }, []);

  const downloadAudio = useCallback((jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job?.audioUrl) {
      const baseName = job.name.replace(/\s+/g, "_").replace(/\.[^.]+$/, "") || job.name;
      const extension = job.fileExtension || "webm";
      const a = document.createElement("a");
      a.href = job.audioUrl;
      a.download = `${baseName}.${extension}`;
      a.click();
    }
  }, [jobs]);

  const downloadTranscript = useCallback((jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job?.transcript) {
      const blob = new Blob([job.transcript], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.name.replace(/\s+/g, "_")}_transcript.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [jobs]);

  return (
    <AudioTranscriptionContext.Provider
      value={{
        jobs,
        activeRecording,
        isRecording,
        audioLevel,
        options,
        startRecording,
        stopRecording,
        transcribeFile,
        clearJob,
        clearAllJobs,
        downloadAudio,
        downloadTranscript,
        updateOptions,
        checkHealth,
        startService,
      }}
    >
      {children}
    </AudioTranscriptionContext.Provider>
  );
};
