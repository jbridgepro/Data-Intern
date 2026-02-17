/**
 * File: src/hooks/useRecordAndTranscribe.ts
 *
 * Frontend: Record audio and transcribe via Tauri voice service or Groq.
 * Fallback for when Web Speech API is unavailable (e.g. Safari/WebKit in Tauri).
 */

import { useState, useRef, useCallback } from "react";
import { blobToWavBase64 } from "@/lib/audioUtils";

const GROQ_API_KEY_KEY = "groq-api-key";
const DEFAULT_VOICE_SERVICE_URL = "http://127.0.0.1:8765";

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export interface UseRecordAndTranscribeOptions {
  onTranscript: (text: string) => void;
  /** Groq API key; if not provided, reads from localStorage. */
  groqApiKey?: string;
  /** Voice service URL for Tauri/local transcription. */
  serviceUrl?: string;
}

export interface UseRecordAndTranscribeReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
  /** Whether record-and-transcribe is available (MediaRecorder + mic). */
  isAvailable: boolean;
}

export function useRecordAndTranscribe(
  options: UseRecordAndTranscribeOptions
): UseRecordAndTranscribeReturn {
  const { onTranscript, groqApiKey, serviceUrl = DEFAULT_VOICE_SERVICE_URL } =
    options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const isAvailable =
    typeof MediaRecorder !== "undefined" &&
    typeof navigator?.mediaDevices?.getUserMedia === "function";

  const runTranscription = useCallback(
    async (chunks: Blob[]) => {
      if (chunks.length === 0) return;
      setIsTranscribing(true);
      setError(null);

      try {
      const mimeType =
        chunks[0]?.type || getSupportedMimeType() || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });
      const base64 = await blobToWavBase64(blob);

      let text: string | null = null;

      // Try Tauri transcribe_audio first (local voice service)
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<{ success: boolean; text?: string; error?: string }>(
          "transcribe_audio",
          {
            audioBase64: base64,
            language: "en",
            serviceUrl,
            provider: "faster-whisper",
            hotwords: null,
            enableDiarization: false,
            stream: false,
          }
        );
        if (result.success && result.text?.trim()) {
          text = result.text.trim();
        } else if (result.error) {
          throw new Error(result.error);
        }
      } catch (tauriErr) {
        const errMsg =
          tauriErr instanceof Error ? tauriErr.message : String(tauriErr);
        if (
          errMsg.includes("not found") ||
          errMsg.includes("Failed to fetch") ||
          errMsg.includes("connection refused") ||
          errMsg.includes("ECONNREFUSED")
        ) {
          // Voice service not running; fall through to Groq
        } else {
          throw tauriErr;
        }
      }

      // Fallback: Groq API (if no Tauri result and API key available)
      if (!text) {
        const key = groqApiKey ?? localStorage.getItem(GROQ_API_KEY_KEY) ?? "";
        if (!key.trim()) {
          throw new Error(
            "Voice service not running. Start it from the Audio Transcription tool, or add a Groq API key in Audio Transcription settings."
          );
        }

        const mimeMap: Record<string, string> = {
          wav: "audio/wav",
          mp3: "audio/mpeg",
          m4a: "audio/mp4",
        };
        const mimeType = mimeMap["wav"] ?? "audio/wav";
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob2 = new Blob([bytes], { type: mimeType });
        const file = new File([blob2], "audio.wav", { type: mimeType });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("model", "whisper-large-v3-turbo");
        formData.append("language", "en");
        formData.append("response_format", "verbose_json");

        const response = await fetch(
          "https://api.groq.com/openai/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key.trim()}` },
            body: formData,
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            err.error?.message ?? `Groq API error: ${response.status}`
          );
        }
        const data = await response.json();
        text = (data.text ?? "").trim();
      }

      if (text) {
        onTranscript(text);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Transcription failed.";
      setError(msg);
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscript, groqApiKey, serviceUrl]);

  const startRecording = useCallback(async () => {
    if (!isAvailable) {
      setError("Recording is not supported in this browser.");
      return;
    }
    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        runTranscription(chunks);
      };

      recorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not access microphone.";
      setError(msg);
    }
  }, [isAvailable, runTranscription]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  return {
    startRecording,
    stopRecording,
    isRecording,
    isTranscribing,
    error,
    isAvailable,
  };
}
