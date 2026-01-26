/**
 * File: src/features/ai-assistant/components/VoiceToTextPanel.tsx
 *
 * Separate Voice-to-Text panel component.
 * This is independent from the AI Conversation chat input.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, X, Send, Copy, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { VoiceService } from "../voice/voiceService";
import type {
  VoiceSettings,
  VoiceState,
  VoiceRecognitionResult,
} from "../voice/types";
import { cn } from "@/lib/utils";

interface VoiceToTextPanelProps {
  settings: VoiceSettings;
  onTranscript: (text: string) => void;
  onClose?: () => void;
  onOpenSettings?: () => void;
  onInsertToChat?: (text: string) => void;
}

export const VoiceToTextPanel = ({
  settings,
  onTranscript,
  onClose,
  onOpenSettings,
  onInsertToChat,
}: VoiceToTextPanelProps) => {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
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
          const finalText = result.text.trim();
          if (finalText) {
            setCurrentTranscript("");
            setTranscriptHistory((prev) => [finalText, ...prev]);
            setError(null); // Clear errors on successful transcription
            
            // Call onTranscript callback (for logging/processing)
            onTranscript(finalText);
            
            // Automatically insert the transcribed text into the chat input
            // This ensures the text appears in the chat box immediately
            if (onInsertToChat) {
              onInsertToChat(finalText);
            }
          }
        } else {
          setCurrentTranscript(result.text);
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
  }, [settings, onTranscript]);

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
    } catch (error) {
      console.error("Failed to stop:", error);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleInsertToChat = (text: string) => {
    if (onInsertToChat) {
      onInsertToChat(text);
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
        return "Listening...";
      case "processing":
        return "Processing...";
      case "speaking":
        return "Speaking...";
      case "waiting":
        return "Waiting...";
      default:
        return "Ready";
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200 dark:border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Voice to Text
          </CardTitle>
          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                className="h-8 w-8 p-0"
                title="Voice settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status and Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", getStateColor())} />
              <span className={cn("text-sm font-medium", getStateColor())}>
                {getStateLabel()}
              </span>
            </div>
            <Badge variant="outline" className="text-xs">
              {settings.activationMode === "push-to-talk"
                ? "Hold Spacebar"
                : settings.activationMode === "continuous"
                  ? "Continuous"
                  : "VAD"}
            </Badge>
          </div>

          {/* Audio Level Indicator */}
          {voiceState === "listening" && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-0.5 h-6">
                {Array.from({ length: 15 }).map((_, i) => {
                  const barHeight = Math.max(
                    2,
                    audioLevel * 15 > i ? (audioLevel * 15 - i) * 4 : 2
                  );
                  const isActive = isVoiceActive && audioLevel * 15 > i;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "w-0.5 rounded-full transition-all duration-75",
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
                <p className="text-xs text-green-600 dark:text-green-400 font-medium text-center">
                  Voice detected
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-700 dark:text-red-400">
                {error}
              </p>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleToggleListening}
              disabled={
                voiceState === "processing" || voiceState === "speaking"
              }
              className={cn(
                "flex-1",
                voiceState === "listening"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white",
              )}
              aria-label={voiceState === "listening" ? "Stop listening" : "Start listening"}
              title={voiceState === "listening" ? "Stop listening (Ctrl/Cmd+M)" : "Start listening (Ctrl/Cmd+M)"}
            >
              {voiceState === "listening" ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Start Listening
                </>
              )}
            </Button>
            {(voiceState === "listening" || currentTranscript) && (
              <Button variant="outline" onClick={handleStop} className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Current Transcription */}
        {currentTranscript && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Transcribing...
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                {currentTranscript}
              </p>
            </div>
          </div>
        )}

        {/* Transcript History */}
        {transcriptHistory.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Transcript History
            </div>
            <ScrollArea className="h-64 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
              <div className="space-y-2">
                {transcriptHistory.map((transcript, index) => (
                  <div
                    key={index}
                    className="group p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                  >
                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                      {transcript}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(transcript, index)}
                        className="h-7 text-xs"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      {onInsertToChat && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInsertToChat(transcript)}
                          className="h-7 text-xs"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Insert to Chat
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty State */}
        {!currentTranscript && transcriptHistory.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Mic className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {settings.activationMode === "push-to-talk"
                ? "Hold Spacebar to start recording"
                : "Click 'Start Listening' to begin"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
