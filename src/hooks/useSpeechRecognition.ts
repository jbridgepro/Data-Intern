/**
 * File path: src/hooks/useSpeechRecognition.ts
 * Frontend: Browser speech-to-text via Web Speech API.
 * Use for voice input in SQL Formatter and other quick tools.
 */

import { useState, useRef, useCallback, useEffect } from "react";

export type SpeechRecognitionErrorCode =
  | "no-speech"
  | "aborted"
  | "audio-capture"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | "bad-grammar"
  | "language-not-supported";

export interface UseSpeechRecognitionOptions {
  /** Called with final transcript when recognition ends. */
  onResult?: (text: string, isFinal: boolean) => void;
  /** Language code (e.g. "en-US"). */
  lang?: string;
  /** If true, keep listening until stop is called. */
  continuous?: boolean;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  /** Interim (live) transcript while speaking. */
  interimTranscript: string;
  /** Last final transcript. */
  finalTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  isSupported: boolean;
  error: string | null;
}

function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { onResult, lang = "en-US", continuous = false } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<InstanceType<NonNullable<ReturnType<typeof getSpeechRecognition>>> | null>(null);
  const onResultRef = useRef(onResult);
  const accumulatedFinalRef = useRef("");
  onResultRef.current = onResult;

  const SpeechRecognitionClass = getSpeechRecognition();
  const isSupported = !!SpeechRecognitionClass;

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.abort();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    setError(null);
    setFinalTranscript("");
    setInterimTranscript("");
    accumulatedFinalRef.current = "";

    const rec = new SpeechRecognitionClass();
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterimTranscript(interim);
      if (finalText) {
        accumulatedFinalRef.current = (accumulatedFinalRef.current + " " + finalText).trim();
        setFinalTranscript(accumulatedFinalRef.current);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error as SpeechRecognitionErrorCode;
      if (code === "aborted" || code === "no-speech") {
        setError(null);
        return;
      }
      const message =
        code === "not-allowed"
          ? "Microphone access was denied."
          : code === "network"
            ? "Network error. Check your connection."
            : `Speech recognition error: ${code}`;
      setError(message);
      setIsListening(false);
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript("");
      const fullTranscript = accumulatedFinalRef.current.trim();
      if (fullTranscript && onResultRef.current) onResultRef.current(fullTranscript, true);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start microphone.");
    }
  }, [SpeechRecognitionClass, continuous, lang]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    interimTranscript,
    finalTranscript,
    startListening,
    stopListening,
    toggleListening,
    isSupported,
    error,
  };
}
