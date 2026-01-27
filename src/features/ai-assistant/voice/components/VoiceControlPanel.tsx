/**
 * File: src/features/ai-assistant/voice/components/VoiceControlPanel.tsx
 *
 * Voice control panel component with microphone controls and status.
 */

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VoiceService } from "../voiceService";
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
  const [isPushedToTalk, setIsPushedToTalk] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceServiceRef = useRef<VoiceService | null>(null);
  const spacebarPressedRef = useRef(false);

  // Initialize voice service
  useEffect(() => {
    setError(null); // Clear any previous errors
    
    if (VoiceService.isAvailable()) {
      const service = new VoiceService(settings);
      service.setStateChangeCallback(setVoiceState);
      
      // Set up audio level monitoring
      service.setAudioLevelCallback((level) => {
        setAudioLevel(level);
      });

      // Set up voice activity detection
      service.setVoiceActivityCallback((isActive) => {
        setIsVoiceActive(isActive);
      });

      service.setTranscriptCallback((result: VoiceRecognitionResult) => {
        if (result.isFinal) {
          setCurrentTranscript(result.text);
          setInterimTranscript("");
          setError(null); // Clear errors on successful transcription
          onTranscript(result.text);

          // Check for approval/cancellation
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
      setError('Voice recognition is not available in this browser.');
    }

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stopListening();
        voiceServiceRef.current.stopSpeaking();
      }
    };
  }, [settings, onTranscript, onApproval]);

  // Handle push-to-talk (spacebar) and keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                            activeElement?.tagName === 'TEXTAREA' ||
                            activeElement?.getAttribute('contenteditable') === 'true';

      // Push-to-talk: Spacebar
      if (
        e.code === "Space" &&
        settings.activationMode === "push-to-talk" &&
        !e.repeat &&
        !isInputFocused
      ) {
        e.preventDefault();
        spacebarPressedRef.current = true;
        setIsPushedToTalk(true);
        try {
          await voiceServiceRef.current?.startListening();
        } catch (error) {
          console.error("Failed to start listening:", error);
        }
      }

      // Keyboard shortcuts (only when not in input fields)
      if (!isInputFocused) {
        // Ctrl/Cmd + M: Toggle microphone
        if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
          e.preventDefault();
          handleToggleListening();
        }
        // Escape: Stop listening
        else if (e.key === 'Escape' && voiceState === 'listening') {
          e.preventDefault();
          handleStop();
        }
        // Ctrl/Cmd + Shift + P: Pause/Resume
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
          e.preventDefault();
          if (voiceServiceRef.current?.isPausedListening()) {
            voiceServiceRef.current?.resumeListening();
          } else {
            voiceServiceRef.current?.pauseListening();
          }
        }
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (e.code === "Space" && settings.activationMode === "push-to-talk") {
        e.preventDefault();
        spacebarPressedRef.current = false;
        setIsPushedToTalk(false);
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
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to stop listening';
        console.error("Failed to stop listening:", error);
        setError(errorMessage);
      }
    } else {
      try {
        setError(null);
        await voiceServiceRef.current?.startListening();
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to start listening';
        console.error("Failed to start listening:", error);
        setError(errorMessage);
      }
    }
  };

  const handleStop = async () => {
    try {
      await voiceServiceRef.current?.stopListening();
      voiceServiceRef.current?.stopSpeaking();
      setCurrentTranscript("");
      setInterimTranscript("");
    } catch (error) {
      console.error("Failed to stop:", error);
    }
  };

  const getStateColor = () => {
    switch (voiceState) {
      case "listening":
        return "text-red-600 dark:text-red-400";
      case "processing":
        return "text-yellow-600 dark:text-yellow-400";
      case "speaking":
        return "text-green-600 dark:text-green-400";
      case "waiting":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-slate-400 dark:text-slate-500";
    }
  };

  const getStateLabel = () => {
    switch (voiceState) {
      case "listening":
        return "LISTENING...";
      case "processing":
        return "PROCESSING...";
      case "speaking":
        return "SPEAKING...";
      case "waiting":
        return "WAITING FOR APPROVAL...";
      default:
        return "IDLE";
    }
  };

  const getStateIcon = () => {
    switch (voiceState) {
      case "listening":
      case "processing":
        return (
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
        );
      case "speaking":
        return (
          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
        );
      case "waiting":
        return (
          <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
        );
      default:
        return <div className="h-3 w-3 rounded-full bg-slate-400" />;
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Voice Assistant</h3>
            </div>
            {onOpenSettings && (
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Status Display */}
          <div
            className={cn(
              "p-4 rounded-lg border-2 border-dashed text-center space-y-2",
              voiceState === "listening" &&
                "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10",
              voiceState === "processing" &&
                "border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10",
              voiceState === "speaking" &&
                "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10",
              voiceState === "waiting" &&
                "border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10",
              voiceState === "idle" && "border-slate-200 dark:border-slate-800",
            )}
          >
            <div className="flex items-center justify-center gap-2">
              {getStateIcon()}
              <span className={cn("text-sm font-medium", getStateColor())}>
                {getStateLabel()}
              </span>
            </div>

            {/* Audio Level Indicator */}
            {voiceState === "listening" && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-center gap-1 h-8">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const barHeight = Math.max(
                      2,
                      audioLevel * 20 > i ? (audioLevel * 20 - i) * 8 : 2
                    );
                    const isActive = isVoiceActive && audioLevel * 20 > i;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "w-1 rounded-full transition-all duration-75",
                          isActive
                            ? "bg-green-500 dark:bg-green-400"
                            : "bg-slate-300 dark:bg-slate-600"
                        )}
                        style={{ height: `${barHeight}px` }}
                      />
                    );
                  })}
                </div>
                {isVoiceActive && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Voice detected
                  </p>
                )}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            {/* Transcription Display */}
            {(currentTranscript || interimTranscript) && (
              <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  {interimTranscript && (
                    <span className="italic opacity-70">
                      {interimTranscript}
                    </span>
                  )}
                </div>
                {currentTranscript && (
                  <div className="text-base font-medium">
                    "{currentTranscript}"
                  </div>
                )}
              </div>
            )}

            {!currentTranscript && !interimTranscript && !error && (
              <p className="text-sm text-muted-foreground">
                {settings.activationMode === "push-to-talk"
                  ? "Hold Spacebar or click mic to speak"
                  : "Click mic to start speaking"}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant={voiceState === "listening" ? "default" : "outline"}
              size="lg"
              onClick={handleToggleListening}
              disabled={
                voiceState === "speaking" || voiceState === "processing"
              }
              className={cn(
                "h-12 w-12 rounded-full",
                voiceState === "listening" && "bg-red-600 hover:bg-red-700",
              )}
              aria-label={voiceState === "listening" ? "Stop listening" : "Start listening"}
              title={voiceState === "listening" ? "Stop listening (Ctrl/Cmd+M)" : "Start listening (Ctrl/Cmd+M)"}
            >
              {voiceState === "listening" ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button>

            {voiceState === "listening" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (voiceServiceRef.current?.isPausedListening()) {
                    voiceServiceRef.current?.resumeListening();
                  } else {
                    voiceServiceRef.current?.pauseListening();
                  }
                }}
                title="Pause/Resume listening"
              >
                <Pause className="h-4 w-4 mr-1" />
                {voiceServiceRef.current?.isPausedListening() ? "Resume" : "Pause"}
              </Button>
            )}

            {(voiceState === "listening" ||
              voiceState === "speaking" ||
              voiceState === "processing") && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleStop}
                aria-label="Stop all voice operations"
                title="Stop all (Escape)"
              >
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            )}
          </div>

          {/* Settings Summary */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                {settings.voiceOutputEnabled ? (
                  <Volume2 className="h-3 w-3" />
                ) : (
                  <VolumeX className="h-3 w-3" />
                )}
                <span>
                  Voice Output: {settings.voiceOutputEnabled ? "ON" : "OFF"}
                </span>
              </div>
              <div>Volume: {settings.volume}%</div>
            </div>
            <div>
              Mode:{" "}
              {settings.activationMode === "push-to-talk"
                ? "Push-to-Talk"
                : "Continuous"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
