/**
 * File: src/features/ai-assistant/voice/components/VoiceControlPanel.tsx
 *
 * Modern voice control panel with animated waveform and glassmorphism design.
 */

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
  Settings,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VoiceService } from "../voiceService";
import { VoiceWaveform } from "./VoiceWaveform";
import type {
  VoiceSettings,
  VoiceState,
  VoiceRecognitionResult,
} from "../types";

interface VoiceControlPanelProps {
  settings: VoiceSettings;
  onSettingsChange: (settings: Partial<VoiceSettings>) => void;
  onTranscript: (text: string) => void;
  onApproval?: (approved: boolean) => void;
  onOpenSettings?: () => void;
}

const STATE_CONFIG = {
  idle: {
    label: "Ready",
    color: "text-slate-500 dark:text-slate-400",
    bgGlow: "",
    ringColor: "ring-slate-300 dark:ring-slate-600",
  },
  listening: {
    label: "Listening...",
    color: "text-red-500 dark:text-red-400",
    bgGlow: "shadow-[0_0_40px_rgba(239,68,68,0.3)]",
    ringColor: "ring-red-400 dark:ring-red-500",
  },
  processing: {
    label: "Processing...",
    color: "text-amber-500 dark:text-amber-400",
    bgGlow: "shadow-[0_0_40px_rgba(245,158,11,0.3)]",
    ringColor: "ring-amber-400 dark:ring-amber-500",
  },
  speaking: {
    label: "Speaking...",
    color: "text-emerald-500 dark:text-emerald-400",
    bgGlow: "shadow-[0_0_40px_rgba(16,185,129,0.3)]",
    ringColor: "ring-emerald-400 dark:ring-emerald-500",
  },
  waiting: {
    label: "Awaiting Response",
    color: "text-blue-500 dark:text-blue-400",
    bgGlow: "shadow-[0_0_40px_rgba(59,130,246,0.3)]",
    ringColor: "ring-blue-400 dark:ring-blue-500",
  },
};

export const VoiceControlPanel = ({
  settings,
  onSettingsChange,
  onTranscript,
  onApproval,
  onOpenSettings,
}: VoiceControlPanelProps) => {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceServiceRef = useRef<VoiceService | null>(null);
  const spacebarPressedRef = useRef(false);

  // Initialize voice service
  useEffect(() => {
    setError(null);

    if (VoiceService.isAvailable()) {
      const service = new VoiceService(settings);
      service.setStateChangeCallback(setVoiceState);

      service.setAudioLevelCallback((level) => {
        setAudioLevel(level);
      });

      service.setVoiceActivityCallback((isActive) => {
        setIsVoiceActive(isActive);
      });

      service.setTranscriptCallback((result: VoiceRecognitionResult) => {
        if (result.isFinal) {
          setCurrentTranscript(result.text);
          setInterimTranscript("");
          setError(null);
          onTranscript(result.text);

          if (onApproval) {
            if (service.detectApproval(result.text)) {
              onApproval(true);
            } else if (service.detectCancellation(result.text)) {
              onApproval(false);
            }
          }
        } else {
          setInterimTranscript(result.text);
        }
      });
      voiceServiceRef.current = service;
    } else {
      setError("Voice recognition is not available in this browser.");
    }

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stopListening();
        voiceServiceRef.current.stopSpeaking();
      }
    };
  }, [settings, onTranscript, onApproval]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true";

      if (
        e.code === "Space" &&
        settings.activationMode === "push-to-talk" &&
        !e.repeat &&
        !isInputFocused
      ) {
        e.preventDefault();
        spacebarPressedRef.current = true;
        try {
          await voiceServiceRef.current?.startListening();
        } catch (error) {
          console.error("Failed to start listening:", error);
        }
      }

      if (!isInputFocused) {
        if ((e.ctrlKey || e.metaKey) && e.key === "m") {
          e.preventDefault();
          handleToggleListening();
        } else if (e.key === "Escape" && voiceState === "listening") {
          e.preventDefault();
          handleStop();
        }
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (e.code === "Space" && settings.activationMode === "push-to-talk") {
        e.preventDefault();
        spacebarPressedRef.current = false;
        try {
          await voiceServiceRef.current?.stopListening();
        } catch (error) {
          console.error("Failed to stop listening:", error);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [settings.activationMode, voiceState]);

  const handleToggleListening = async () => {
    if (voiceState === "listening") {
      try {
        await voiceServiceRef.current?.stopListening();
        setError(null);
        setIsPaused(false);
      } catch (error: any) {
        setError(error?.message || "Failed to stop listening");
      }
    } else {
      try {
        setError(null);
        await voiceServiceRef.current?.startListening();
      } catch (error: any) {
        setError(error?.message || "Failed to start listening");
      }
    }
  };

  const handlePauseResume = () => {
    if (voiceServiceRef.current?.isPausedListening()) {
      voiceServiceRef.current?.resumeListening();
      setIsPaused(false);
    } else {
      voiceServiceRef.current?.pauseListening();
      setIsPaused(true);
    }
  };

  const handleStop = async () => {
    try {
      await voiceServiceRef.current?.stopListening();
      voiceServiceRef.current?.stopSpeaking();
      setCurrentTranscript("");
      setInterimTranscript("");
      setIsPaused(false);
    } catch (error) {
      console.error("Failed to stop:", error);
    }
  };

  const stateConfig = STATE_CONFIG[voiceState];
  const isActive = voiceState !== "idle";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl transition-all duration-500",
        // Glassmorphism background
        "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl",
        "border border-slate-200/50 dark:border-slate-700/50",
        stateConfig.bgGlow
      )}
    >
      {/* Animated background gradient */}
      {isActive && (
        <div
          className={cn(
            "absolute inset-0 opacity-10 transition-opacity duration-500",
            voiceState === "listening" &&
              "bg-gradient-to-br from-red-500 via-transparent to-red-500/50",
            voiceState === "processing" &&
              "bg-gradient-to-br from-amber-500 via-transparent to-amber-500/50",
            voiceState === "speaking" &&
              "bg-gradient-to-br from-emerald-500 via-transparent to-emerald-500/50",
            voiceState === "waiting" &&
              "bg-gradient-to-br from-blue-500 via-transparent to-blue-500/50"
          )}
        />
      )}

      <div className="relative p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-xl transition-colors duration-300",
                isActive
                  ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                  : "bg-slate-100 dark:bg-slate-800"
              )}
            >
              <Waves
                className={cn(
                  "h-5 w-5 transition-colors duration-300",
                  isActive ? "text-white" : "text-slate-500 dark:text-slate-400"
                )}
              />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Voice Assistant
              </h3>
              <p className={cn("text-sm font-medium", stateConfig.color)}>
                {stateConfig.label}
              </p>
            </div>
          </div>
          {onOpenSettings && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Waveform Visualization */}
        <div className="relative bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-3 overflow-hidden">
          <VoiceWaveform
            audioLevel={audioLevel}
            isActive={isVoiceActive}
            state={voiceState}
          />

          {/* Voice detection indicator */}
          {isVoiceActive && voiceState === "listening" && (
            <div className="absolute top-2 right-2">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Transcript Display */}
        {(currentTranscript || interimTranscript) && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
            {interimTranscript && (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                {interimTranscript}
              </p>
            )}
            {currentTranscript && (
              <p className="text-base font-medium text-slate-900 dark:text-white">
                "{currentTranscript}"
              </p>
            )}
          </div>
        )}

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4">
          {/* Pause/Resume (only when listening) */}
          {voiceState === "listening" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePauseResume}
              className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {isPaused ? (
                <Play className="h-5 w-5" />
              ) : (
                <Pause className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* Main Mic Button */}
          <div className="relative">
            {/* Pulsing rings when listening */}
            {voiceState === "listening" && (
              <>
                <span className="absolute inset-0 rounded-full animate-ping bg-red-400/30" />
                <span
                  className="absolute inset-[-8px] rounded-full animate-pulse bg-red-400/20"
                  style={{ animationDelay: "0.2s" }}
                />
              </>
            )}

            <Button
              onClick={handleToggleListening}
              disabled={
                voiceState === "speaking" || voiceState === "processing"
              }
              className={cn(
                "relative h-16 w-16 rounded-full transition-all duration-300",
                "shadow-lg hover:shadow-xl",
                voiceState === "listening"
                  ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                  : "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-600 dark:hover:to-slate-700 text-slate-700 dark:text-slate-200"
              )}
            >
              {voiceState === "listening" ? (
                <Mic className="h-7 w-7" />
              ) : (
                <MicOff className="h-7 w-7" />
              )}
            </Button>
          </div>

          {/* Stop Button (when active) */}
          {isActive && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStop}
              className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600"
            >
              <Square className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Hint Text */}
        {voiceState === "idle" && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            {settings.activationMode === "push-to-talk"
              ? "Hold Spacebar or click to speak"
              : "Click the microphone to start"}
          </p>
        )}

        {/* Bottom Status Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {settings.voiceOutputEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              <span>{settings.volume}%</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-medium">
              {settings.activationMode === "push-to-talk"
                ? "Push-to-Talk"
                : "Continuous"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
