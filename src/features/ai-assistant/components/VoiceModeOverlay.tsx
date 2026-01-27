/**
 * File: src/features/ai-assistant/components/VoiceModeOverlay.tsx
 *
 * Immersive Voice Mode Overlay for AI Discussion.
 * inspired by Gemini Live / ChatGPT Voice Mode.
 */

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, X, MoreHorizontal, Settings, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VoiceService } from "../voice/voiceService";
import type { VoiceSettings, VoiceState } from "../voice/types";
import { VoiceVisualizer } from "./VoiceVisualizer";

interface VoiceModeOverlayProps {
  settings: VoiceSettings;
  onClose: () => void;
  onTranscript: (text: string) => void;
}

export const VoiceModeOverlay = ({
  settings,
  onClose,
  onTranscript,
}: VoiceModeOverlayProps) => {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const voiceServiceRef = useRef<VoiceService | null>(null);

  useEffect(() => {
    if (VoiceService.isAvailable()) {
      const service = new VoiceService({
        ...settings,
        activationMode: "continuous", // Force continuous mode for conversation
      });

      service.setStateChangeCallback(setVoiceState);
      service.setAudioLevelCallback(setAudioLevel);
      service.setTranscriptCallback((result) => {
        if (result.isFinal) {
          setTranscript(result.text);
          setInterimTranscript("");
          // Auto-send final transcript
          if (result.text.trim()) {
            onTranscript(result.text);
          }
        } else {
          setInterimTranscript(result.text);
        }
      });

      // Start listening immediately
      service.startListening().catch(console.error);
      voiceServiceRef.current = service;
    }

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stopListening();
        voiceServiceRef.current.stopSpeaking();
      }
    };
  }, [settings, onTranscript]);

  const handleToggleMute = () => {
    if (voiceServiceRef.current) {
      if (voiceState === "listening") {
        voiceServiceRef.current.stopListening();
      } else {
        voiceServiceRef.current.startListening();
      }
    }
  };

  // Canvas logic removed - replaced by VoiceVisualizer component

  const getStateText = () => {
      switch(voiceState) {
          case 'listening': return "Listening...";
          case 'processing': return "Thinking...";
          case 'speaking': return "Speaking...";
          default: return "Ready";
      }
  };

  const getStateHint = () => {
    switch(voiceState) {
        case 'listening': return "Speak now...";
        case 'processing': return "Processing your request...";
        case 'speaking': return "Assistant is speaking...";
        default: return "Tap mic to start";
    }
  };

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
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{getStateText()}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[150px] truncate">
                {transcript || "Click to expand"}
            </span>
        </div>
        <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setIsMinimized(false)}>
                <Maximize2 className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-red-100 hover:text-red-600" onClick={onClose}>
                <X className="w-4 h-4" />
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm">
             <div className={cn("w-2 h-2 rounded-full shadow-lg transition-colors duration-500", 
                 voiceState === 'listening' ? "bg-blue-500 shadow-blue-500/50" :
                 voiceState === 'speaking' ? "bg-green-500 shadow-green-500/50" :
                 voiceState === 'processing' ? "bg-purple-500 shadow-purple-500/50 animate-pulse" : "bg-slate-400"
             )} />
             <span className="text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300 uppercase">
                 {getStateText()}
             </span>
        </div>
        
        <div className="flex items-center gap-3">
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

      {/* Transcript / Subtitles - Dynamic Typography */}
      <div className="absolute bottom-40 left-0 right-0 px-12 text-center pointer-events-none">
          <div className="max-w-4xl mx-auto transition-all duration-300">
              {interimTranscript ? (
                  <p className="text-3xl font-light text-slate-800 dark:text-slate-200 leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                       {interimTranscript}
                  </p>
              ) : transcript ? (
                  <p className="text-2xl font-light text-slate-600 dark:text-slate-400 leading-relaxed">
                       "{transcript}"
                  </p>
              ) : (
                  <p className="text-xl font-light text-slate-400 dark:text-slate-500 animate-pulse">
                      {getStateHint()}
                  </p>
              )}
          </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-12 flex items-center gap-8">
          <Button
            size="icon"
            variant="ghost"
            className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all hover:scale-110"
          >
             <Settings className="w-5 h-5" />
          </Button>

          <Button
            size="lg"
            variant={voiceState === 'listening' ? "destructive" : "default"}
            className={cn(
                "w-20 h-20 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95",
                voiceState === 'listening' ? "shadow-red-500/30" : "shadow-blue-500/30 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            )}
            onClick={handleToggleMute}
          >
              {voiceState === 'listening' ? (
                  <MicOff className="w-8 h-8" />
              ) : (
                  <Mic className="w-8 h-8" />
              )}
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all hover:scale-110"
          >
             <MoreHorizontal className="w-5 h-5" />
          </Button>
      </div>
    </div>
  );
};
