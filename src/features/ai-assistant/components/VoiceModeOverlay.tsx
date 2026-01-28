/**
 * File: src/features/ai-assistant/components/VoiceModeOverlay.tsx
 *
 * Immersive Voice Mode Overlay for AI Discussion.
 * Inspired by Gemini Live / ChatGPT Voice Mode.
 *
 * Features:
 * - Real-time transcription with interim results
 * - Transcript preview before auto-send (with edit option)
 * - Voice command detection feedback
 * - Confidence score display
 * - Connection status indicator
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  X,
  MoreHorizontal,
  Settings,
  Maximize2,
  Minimize2,
  Send,
  Edit3,
  Check,
  AlertCircle,
  Wifi,
  WifiOff,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { VoiceService } from "../voice/voiceService";
import type {
  VoiceSettings,
  VoiceState,
  VoiceRecognitionResult,
} from "../voice/types";
import { VoiceVisualizer } from "./VoiceVisualizer";

interface VoiceModeOverlayProps {
  settings: VoiceSettings;
  onClose: () => void;
  onTranscript: (text: string) => void;
  onOpenSettings?: () => void;
}

// Pending transcript waiting for user confirmation or auto-send
interface PendingTranscript {
  text: string;
  confidence: number;
  timestamp: number;
}

export const VoiceModeOverlay = ({
  settings,
  onClose,
  onTranscript,
  onOpenSettings,
}: VoiceModeOverlayProps) => {
  // Core state
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);

  // Enhanced UX state
  const [pendingTranscript, setPendingTranscript] =
    useState<PendingTranscript | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [showHelp, setShowHelp] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);

  // Refs
  const voiceServiceRef = useRef<VoiceService | null>(null);
  // Use browser-safe timeout type to avoid NodeJS namespace dependency
  const autoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Voice commands list for help
  const voiceCommands = [
    { command: "Send", description: "Send the current message" },
    { command: "Edit", description: "Edit the transcribed text" },
    { command: "Cancel", description: "Clear and start over" },
    { command: "Stop", description: "Stop listening" },
  ];

  // Check if text looks like noise/gibberish rather than real speech
  const isLikelyNoise = useCallback((text: string): boolean => {
    const trimmed = text.trim().toLowerCase();

    // Too short to be meaningful speech
    if (trimmed.length < 5) return true;

    // Count actual words (at least 2 characters each)
    const words = trimmed.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length < 2) return true;

    // Common noise artifacts from speech recognition
    const noisePatterns = [
      /^[aeiou]+$/i, // Just vowels (aaaa, eeee)
      /^[^aeiou\s]+$/i, // No vowels at all
      /^(.)\1+$/, // Repeated single character
      /^(..?)\1+$/, // Repeated short pattern
      /^(um|uh|ah|oh|eh|mm|hm|hmm|mhm)+$/i, // Just filler sounds
      /^[\s\W]+$/, // Just punctuation/spaces
      /^[a-z]$/i, // Single letter
      /^[a-z]{1,2}\s*$/i, // One or two letters
      /^(the|a|an|is|it|i|and|or|but)\s*$/i, // Just common short words
    ];

    for (const pattern of noisePatterns) {
      if (pattern.test(trimmed)) return true;
    }

    // Check for reasonable word structure (has consonants and vowels mixed)
    const hasVowels = /[aeiou]/i.test(trimmed);
    const hasConsonants = /[bcdfghjklmnpqrstvwxyz]/i.test(trimmed);
    if (!hasVowels || !hasConsonants) return true;

    return false;
  }, []);

  // Handle pending transcript - wait for confirmation or auto-send after delay
  const handlePendingTranscript = useCallback(
    (result: VoiceRecognitionResult) => {
      // Clear any existing auto-send timeout
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }

      const trimmedText = result.text.trim();

      // Filter out noise - don't even show as pending
      if (isLikelyNoise(trimmedText)) {
        console.log("[Voice] Filtered out noise:", trimmedText);
        return;
      }

      // Check for voice commands in the transcript
      const lowerText = trimmedText.toLowerCase();

      // Voice command detection
      if (
        lowerText === "send" ||
        lowerText === "send it" ||
        lowerText === "send message"
      ) {
        if (pendingTranscript) {
          setLastVoiceCommand("Send");
          onTranscript(pendingTranscript.text);
          setPendingTranscript(null);
          setTranscript("");
          setTimeout(() => setLastVoiceCommand(null), 2000);
          return;
        }
      }

      if (
        lowerText === "cancel" ||
        lowerText === "clear" ||
        lowerText === "start over"
      ) {
        setLastVoiceCommand("Cancel");
        setPendingTranscript(null);
        setTranscript("");
        setInterimTranscript("");
        setTimeout(() => setLastVoiceCommand(null), 2000);
        return;
      }

      if (
        lowerText === "edit" ||
        lowerText === "edit text" ||
        lowerText === "change"
      ) {
        if (pendingTranscript) {
          setLastVoiceCommand("Edit");
          setIsEditing(true);
          setEditedText(pendingTranscript.text);
          setTimeout(() => {
            setLastVoiceCommand(null);
            editInputRef.current?.focus();
          }, 500);
          return;
        }
      }

      // Set pending transcript
      const pending: PendingTranscript = {
        text: trimmedText,
        confidence: result.confidence,
        timestamp: Date.now(),
      };
      setPendingTranscript(pending);
      setConfidence(result.confidence);
      setTranscript(trimmedText);
      setInterimTranscript("");

      // Determine if auto-send should be enabled
      // Require higher confidence and longer text for auto-send
      const wordCount = trimmedText
        .split(/\s+/)
        .filter((w) => w.length >= 2).length;
      const shouldAutoSend =
        result.confidence > 0.85 && wordCount >= 3 && trimmedText.length >= 15;

      if (!shouldAutoSend) {
        // Don't auto-send - require manual confirmation
        console.log(
          "[Voice] Auto-send disabled: conf=",
          result.confidence,
          "words=",
          wordCount,
        );
        return;
      }

      // Auto-send after delay (only for high-quality transcripts)
      const autoSendDelay = 4000; // 4 seconds to review

      autoSendTimeoutRef.current = setTimeout(() => {
        // Double-check the transcript is still valid before sending
        if (
          pending.text === pendingTranscript?.text &&
          !isLikelyNoise(pending.text)
        ) {
          console.log("[Voice] Auto-sending:", pending.text);
          onTranscript(pending.text);
          setPendingTranscript(null);
          setTranscript("");
        }
      }, autoSendDelay);
    },
    [pendingTranscript, onTranscript, isLikelyNoise],
  );

  // Initialize voice service
  useEffect(() => {
    if (VoiceService.isAvailable()) {
      setConnectionStatus("connecting");

      const service = new VoiceService({
        ...settings,
        activationMode: "continuous", // Force continuous mode for conversation
      });

      service.setStateChangeCallback((state) => {
        setVoiceState(state);
        // Update connection status based on state
        if (
          state === "listening" ||
          state === "processing" ||
          state === "speaking"
        ) {
          setConnectionStatus("connected");
        }
      });

      service.setAudioLevelCallback(setAudioLevel);

      service.setTranscriptCallback((result) => {
        if (result.isFinal) {
          // Use pending transcript system instead of direct send
          handlePendingTranscript(result);
        } else {
          setInterimTranscript(result.text);
        }
      });

      // Start listening immediately
      service
        .startListening()
        .then(() => setConnectionStatus("connected"))
        .catch((error) => {
          console.error("Failed to start voice service:", error);
          setConnectionStatus("disconnected");
        });

      voiceServiceRef.current = service;
    } else {
      setConnectionStatus("disconnected");
    }

    return () => {
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
      }
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stopListening();
        voiceServiceRef.current.stopSpeaking();
      }
    };
  }, [settings, handlePendingTranscript]);

  // Handle manual send
  const handleSend = useCallback(() => {
    if (pendingTranscript) {
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
      }
      onTranscript(isEditing ? editedText : pendingTranscript.text);
      setPendingTranscript(null);
      setTranscript("");
      setIsEditing(false);
      setEditedText("");
    }
  }, [pendingTranscript, isEditing, editedText, onTranscript]);

  // Handle edit confirmation
  const handleEditConfirm = useCallback(() => {
    if (editedText.trim()) {
      setPendingTranscript({
        text: editedText.trim(),
        confidence: 1.0, // User edited, so confidence is 100%
        timestamp: Date.now(),
      });
      setTranscript(editedText.trim());
    }
    setIsEditing(false);
  }, [editedText]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
    }
    setPendingTranscript(null);
    setTranscript("");
    setInterimTranscript("");
    setIsEditing(false);
    setEditedText("");
  }, []);

  // Toggle microphone on/off
  const handleToggleMute = useCallback(() => {
    if (voiceServiceRef.current) {
      if (voiceState === "listening") {
        voiceServiceRef.current.stopListening();
        setConnectionStatus("disconnected");
      } else {
        voiceServiceRef.current
          .startListening()
          .then(() => setConnectionStatus("connected"))
          .catch(() => setConnectionStatus("disconnected"));
      }
    }
  }, [voiceState]);

  // Get state text for display
  const getStateText = useCallback(() => {
    if (pendingTranscript) return "Review message";
    switch (voiceState) {
      case "listening":
        return "Listening...";
      case "processing":
        return "Thinking...";
      case "speaking":
        return "Speaking...";
      default:
        return "Ready";
    }
  }, [voiceState, pendingTranscript]);

  // Get state hint for display
  const getStateHint = useCallback(() => {
    if (pendingTranscript) {
      const timeLeft = Math.max(
        0,
        Math.ceil((3000 - (Date.now() - pendingTranscript.timestamp)) / 1000),
      );
      return `Auto-sending in ${timeLeft}s • Say "Send", "Edit", or "Cancel"`;
    }
    switch (voiceState) {
      case "listening":
        return "Speak now...";
      case "processing":
        return "Processing your request...";
      case "speaking":
        return "Assistant is speaking...";
      default:
        return "Tap mic to start";
    }
  }, [voiceState, pendingTranscript]);

  // Get connection status icon and color
  const getConnectionStatusUI = useCallback(() => {
    switch (connectionStatus) {
      case "connected":
        return { icon: Wifi, color: "text-green-500", label: "Connected" };
      case "connecting":
        return {
          icon: Wifi,
          color: "text-yellow-500 animate-pulse",
          label: "Connecting...",
        };
      case "disconnected":
        return { icon: WifiOff, color: "text-red-500", label: "Disconnected" };
    }
  }, [connectionStatus]);

  // Get confidence color based on score
  const getConfidenceColor = useCallback((conf: number) => {
    if (conf >= 0.9) return "text-green-500";
    if (conf >= 0.7) return "text-yellow-500";
    return "text-orange-500";
  }, []);

  const connectionUI = getConnectionStatusUI();
  const ConnectionIcon = connectionUI.icon;

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full shadow-2xl border border-blue-500/20 animate-in slide-in-from-bottom duration-300">
        <div className="relative w-10 h-10 flex items-center justify-center">
          <VoiceVisualizer
            state={voiceState}
            audioLevel={audioLevel}
            width={40}
            height={40}
          />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {getStateText()}
            </span>
            <ConnectionIcon className={cn("w-3 h-3", connectionUI.color)} />
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[150px] truncate">
            {pendingTranscript
              ? `"${pendingTranscript.text}"`
              : transcript || "Click to expand"}
          </span>
        </div>
        {/* Quick actions in minimized mode */}
        {pendingTranscript && (
          <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full bg-green-100 hover:bg-green-200 text-green-600"
              onClick={handleSend}
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full hover:bg-red-100 hover:text-red-600"
              onClick={handleCancel}
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            onClick={() => setIsMinimized(false)}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full hover:bg-red-100 hover:text-red-600"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
          {/* Status indicators */}
          <div className="flex items-center gap-3">
            {/* Voice state indicator */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm">
              <div
                className={cn(
                  "w-2 h-2 rounded-full shadow-lg transition-colors duration-500",
                  voiceState === "listening"
                    ? "bg-blue-500 shadow-blue-500/50"
                    : voiceState === "speaking"
                      ? "bg-green-500 shadow-green-500/50"
                      : voiceState === "processing"
                        ? "bg-purple-500 shadow-purple-500/50 animate-pulse"
                        : "bg-slate-400",
                )}
              />
              <span className="text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300 uppercase">
                {getStateText()}
              </span>
            </div>

            {/* Connection status */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                    connectionStatus === "connected"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : connectionStatus === "connecting"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
                  )}
                >
                  <ConnectionIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{connectionUI.label}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{connectionUI.label}</p>
              </TooltipContent>
            </Tooltip>

            {/* Confidence indicator (when pending) */}
            {pendingTranscript && (
              <Badge
                variant="outline"
                className={cn("text-xs", getConfidenceColor(confidence))}
              >
                {Math.round(confidence * 100)}% confident
              </Badge>
            )}
          </div>

          {/* Top right controls */}
          <div className="flex items-center gap-2">
            {/* Help button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHelp(!showHelp)}
                  className={cn(
                    "rounded-full hover:bg-slate-200 dark:hover:bg-slate-800",
                    showHelp && "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
                  )}
                >
                  <HelpCircle className="w-5 h-5 opacity-70" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Voice commands help</p>
              </TooltipContent>
            </Tooltip>

            {/* Settings button */}
            {onOpenSettings && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                className="rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <Settings className="w-5 h-5 opacity-70" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMinimized(true)}
              className="rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
              title="Minimize"
            >
              <Minimize2 className="w-5 h-5 opacity-70" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Voice Commands Help Panel */}
        {showHelp && (
          <div className="absolute top-20 right-6 w-64 p-4 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Voice Commands
            </h3>
            <div className="space-y-2">
              {voiceCommands.map((cmd) => (
                <div
                  key={cmd.command}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    "{cmd.command}"
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {cmd.description}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
              Tip: Speak clearly and pause briefly after commands
            </p>
          </div>
        )}

        {/* Voice Command Feedback Toast */}
        {lastVoiceCommand && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-500 text-white rounded-full text-sm font-medium shadow-lg animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>"{lastVoiceCommand}" recognized</span>
            </div>
          </div>
        )}

        {/* Main Visualizer Area */}
        <div className="relative w-full max-w-2xl h-[400px] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center">
            <VoiceVisualizer
              state={voiceState}
              audioLevel={audioLevel}
              width={600}
              height={600}
            />
          </div>
        </div>

        {/* Transcript / Subtitles Area */}
        <div className="absolute bottom-44 left-0 right-0 px-12 text-center">
          <div className="max-w-4xl mx-auto transition-all duration-300">
            {/* Editing mode */}
            {isEditing && pendingTranscript && (
              <div className="flex items-center gap-3 justify-center animate-in fade-in slide-in-from-bottom-2">
                <Input
                  ref={editInputRef}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="max-w-lg text-lg text-center border-2 border-blue-500"
                  placeholder="Edit your message..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEditConfirm();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                />
                <Button size="sm" onClick={handleEditConfirm}>
                  <Check className="w-4 h-4 mr-1" />
                  Done
                </Button>
              </div>
            )}

            {/* Pending transcript preview */}
            {!isEditing && pendingTranscript && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-2xl font-light text-slate-800 dark:text-slate-200 leading-relaxed">
                  "{pendingTranscript.text}"
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleSend}
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Send
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(true);
                      setEditedText(pendingTranscript.text);
                      setTimeout(() => editInputRef.current?.focus(), 100);
                    }}
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-100"
                    onClick={handleCancel}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {getStateHint()}
                </p>
              </div>
            )}

            {/* Interim transcript (currently speaking) */}
            {!isEditing && !pendingTranscript && interimTranscript && (
              <p className="text-3xl font-light text-slate-800 dark:text-slate-200 leading-relaxed animate-in fade-in slide-in-from-bottom-2 pointer-events-none">
                {interimTranscript}
              </p>
            )}

            {/* Idle state hint */}
            {!isEditing && !pendingTranscript && !interimTranscript && (
              <p className="text-xl font-light text-slate-400 dark:text-slate-500 animate-pulse pointer-events-none">
                {getStateHint()}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-12 flex items-center gap-8">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all hover:scale-110"
                onClick={onOpenSettings}
              >
                <Settings className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <Button
            size="lg"
            variant={voiceState === "listening" ? "destructive" : "default"}
            className={cn(
              "w-20 h-20 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95",
              voiceState === "listening"
                ? "shadow-red-500/30"
                : "shadow-blue-500/30 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
            )}
            onClick={handleToggleMute}
          >
            {voiceState === "listening" ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all hover:scale-110"
                onClick={() => setShowHelp(!showHelp)}
              >
                <HelpCircle className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Voice commands</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};
