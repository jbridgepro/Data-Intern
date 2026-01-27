/**
 * File: src/features/ai-assistant/voice/components/VoiceSettingsPanel.tsx
 *
 * Voice settings configuration panel.
 * Includes environment presets for quick configuration.
 */

import { X, Volume2, Mic, Settings2, Play, Loader2, Sparkles, Home, Building2, Headphones, Zap } from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VoiceSettings } from "../types";
import { VoiceServiceStatus } from "./VoiceServiceStatus";

// Environment preset definitions
interface EnvironmentPreset {
  id: string;
  name: string;
  description: string;
  icon: typeof Home;
  settings: Partial<VoiceSettings>;
}

const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    id: 'quiet-office',
    name: 'Quiet Office',
    description: 'Low background noise, clear speech',
    icon: Building2,
    settings: {
      noiseCancellation: false,
      activationMode: 'continuous',
      autoPunctuation: true,
      whisperModelSize: 'base',
      micSensitivity: 4, // Moderate sensitivity for quiet environments
    },
  },
  {
    id: 'home',
    name: 'Home',
    description: 'Moderate background noise',
    icon: Home,
    settings: {
      noiseCancellation: true,
      activationMode: 'continuous',
      autoPunctuation: true,
      whisperModelSize: 'base',
      micSensitivity: 3, // Lower sensitivity for home noise
    },
  },
  {
    id: 'noisy',
    name: 'Noisy Environment',
    description: 'High background noise, crowds',
    icon: Headphones,
    settings: {
      noiseCancellation: true,
      activationMode: 'push-to-talk', // Push-to-talk recommended for noisy
      autoPunctuation: true,
      whisperModelSize: 'small',
      micSensitivity: 1, // Very low sensitivity to avoid false triggers
    },
  },
  {
    id: 'high-accuracy',
    name: 'High Accuracy',
    description: 'Best transcription quality, slower',
    icon: Sparkles,
    settings: {
      noiseCancellation: true,
      activationMode: 'continuous',
      autoPunctuation: true,
      whisperModelSize: 'medium',
      whisperComputeType: 'float32',
      micSensitivity: 3, // Conservative to ensure clean audio
    },
  },
  {
    id: 'low-latency',
    name: 'Low Latency',
    description: 'Fastest response, good for quick commands',
    icon: Zap,
    settings: {
      noiseCancellation: false,
      activationMode: 'voice-activity-detection',
      autoPunctuation: false,
      whisperModelSize: 'tiny',
      whisperComputeType: 'int8',
      micSensitivity: 5, // Slightly higher for quick detection
    },
  },
];

interface VoiceSettingsPanelProps {
  settings: VoiceSettings;
  onUpdate: (updates: Partial<VoiceSettings>) => void;
  onClose: () => void;
  serviceManager?: {
    status: {
      isRunning: boolean;
      isStarting: boolean;
      error: string | null;
    };
    startService: () => Promise<boolean>;
  };
}

export const VoiceSettingsPanel = ({
  settings,
  onUpdate,
  onClose,
  serviceManager,
}: VoiceSettingsPanelProps) => {
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const { toast } = useToast();

  /**
   * Tests the selected voice by playing a sample phrase.
   */
  const testVoice = async () => {
    console.log("Test voice button clicked", { settings });
    setIsTestingVoice(true);
    
    const testText = "Hello! This is a test of the selected voice. How does it sound?";
    const speed = settings.voiceSpeed || 1.0;
    const volume = settings.volume || 100;

    // If provider is not faster-whisper, use browser TTS directly
    if (settings.provider !== "faster-whisper") {
      console.log("Using browser TTS for test (provider is not faster-whisper)");
      fallbackToBrowserTTS(testText, speed, volume);
      toast({
        title: "Voice test",
        description: "Playing test audio using browser text-to-speech...",
      });
      setIsTestingVoice(false);
      return;
    }

    try {
      const serviceUrl = settings.voiceServiceUrl || "http://127.0.0.1:8765";
      // Handle custom voice - if it's "__custom__", we need to get the actual custom value
      let voice = settings.piperVoice || "en_US-lessac-medium";
      if (voice === "__custom__") {
        // If custom is selected but no custom value entered, use default
        voice = "en_US-lessac-medium";
        toast({
          title: "Using default voice",
          description: "Please enter a custom voice name or select a voice from the list.",
          variant: "default",
        });
      }

      console.log("Testing voice with settings:", {
        serviceUrl,
        voice,
        speed,
        volume,
      });

      const result = await invoke<{
        success: boolean;
        audio?: string;
        format?: string;
        error?: string;
      }>("synthesize_speech", {
        text: testText,
        voice: voice,
        speed: speed,
        serviceUrl: serviceUrl,
      });

      console.log("Voice synthesis result:", {
        success: result.success,
        hasAudio: !!result.audio,
        error: result.error,
        format: result.format,
      });

      // Check if error indicates missing voice model
      if (!result.success && result.error) {
        const errorMessage = result.error;
        const isHTMLResponse = errorMessage.includes('<!DOCTYPE HTML>') || errorMessage.includes('<html');
        const isVoiceNotFound = isHTMLResponse ||
                              errorMessage.includes('not found') || 
                              errorMessage.includes('404') ||
                              errorMessage.includes('Voice model');
        
        if (isVoiceNotFound) {
          // Extract error message from HTML if present
          let extractedMessage = errorMessage;
          if (isHTMLResponse) {
            const match = errorMessage.match(/<p>Message: ([^<]+)<\/p>/);
            if (match) {
              extractedMessage = match[1];
            } else {
              // Fallback: try to extract any text between <p> tags
              const fallbackMatch = errorMessage.match(/<p>([^<]+)<\/p>/);
              if (fallbackMatch) {
                extractedMessage = fallbackMatch[1];
              }
            }
          }
          
          toast({
            title: "Voice model not found",
            description: extractedMessage || `The voice model '${voice}' is not available. Please download it and place it in the voices directory, or use browser TTS instead.`,
            variant: "destructive",
          });
          return;
        }
        
        // Other errors
        toast({
          title: "Voice synthesis failed",
          description: errorMessage || "An unknown error occurred during voice synthesis.",
          variant: "destructive",
        });
        return;
      }

      if (result.success && result.audio) {
        // Decode base64 audio and play it
        try {
          await playAudioFromBase64(result.audio, volume);
          toast({
            title: "Voice test",
            description: "Playing test audio...",
          });
        } catch (playError: any) {
          console.error("Audio playback error:", playError);
          // Fallback to browser TTS
          fallbackToBrowserTTS(testText, speed, volume);
          toast({
            title: "Using browser TTS",
            description: "Piper audio playback failed, using browser text-to-speech instead.",
            variant: "default",
          });
        }
      } else {
        const errorMsg = result.error || "Could not synthesize speech. Make sure the voice service is running and the voice model is available.";
        console.error("Voice synthesis failed:", errorMsg);
        
        // Fallback to browser TTS if service is unavailable
        if (errorMsg.includes("connect") || errorMsg.includes("Failed to connect") || errorMsg.includes("Cannot connect")) {
          fallbackToBrowserTTS(testText, speed, volume);
          toast({
            title: "Using browser TTS",
            description: "Voice service unavailable. Using browser text-to-speech for testing.",
            variant: "default",
          });
        } else {
          toast({
            title: "Voice test failed",
            description: errorMsg,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("Voice test error:", error);
      const errorMessage = error?.message || error?.toString() || "Failed to test voice. Please check your voice service connection.";
      
      // Always fallback to browser TTS on error
      try {
        fallbackToBrowserTTS(testText, speed, volume);
        toast({
          title: "Using browser TTS",
          description: "Voice service error. Using browser text-to-speech for testing.",
          variant: "default",
        });
      } catch (fallbackError) {
        toast({
          title: "Voice test error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsTestingVoice(false);
    }
  };

  /**
   * Fallback to browser TTS for testing.
   */
  const fallbackToBrowserTTS = (text: string, speed: number, volume: number) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      utterance.volume = Math.max(0, Math.min(1, volume / 100));
      window.speechSynthesis.speak(utterance);
    }
  };

  /**
   * Plays audio from base64-encoded WAV data.
   */
  const playAudioFromBase64 = async (audioBase64: string, volume: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Decode base64 to binary
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Create blob and audio element
        const blob = new Blob([bytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        // Set volume (0.0 to 1.0)
        audio.volume = Math.max(0, Math.min(1, volume / 100));

        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };

        audio.onerror = (error) => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to play audio"));
        };

        audio.play().catch((error) => {
          URL.revokeObjectURL(url);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  return (
    <div className="w-96 border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      <Card className="rounded-none border-0 border-b h-full flex flex-col">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Voice Settings
            </CardTitle>
            <CardDescription>Configure voice input and output</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 h-full">
            <div className="space-y-6">
              {/* Voice Input Provider */}
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Voice Input Provider
                </Label>
                <Select
                  value={settings.provider}
                  onValueChange={(value) =>
                    onUpdate({ provider: value as VoiceSettings["provider"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faster-whisper">
                      Faster-Whisper (Recommended)
                    </SelectItem>
                    <SelectItem value="browser-stt">
                      Browser Speech Recognition (Fallback)
                    </SelectItem>
                    <SelectItem value="openai-realtime">
                      OpenAI Realtime API (GPT-4o)
                    </SelectItem>
                    <SelectItem value="gemini-live">
                      Gemini Live Voice
                    </SelectItem>
                    <SelectItem value="claude-voice">
                      Claude Voice (Coming Soon)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.provider === "faster-whisper" &&
                    "Fast, accurate local transcription with Piper TTS"}
                  {settings.provider === "browser-stt" &&
                    "Uses browser built-in speech recognition"}
                  {settings.provider === "openai-realtime" &&
                    "Low latency, natural conversation"}
                  {settings.provider === "gemini-live" &&
                    "Multi-turn conversational AI"}
                </p>
              </div>

              {/* Environment Presets - Quick Configuration */}
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">
                    Quick Setup
                  </Label>
                  <Badge variant="outline" className="text-xs">
                    Presets
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Choose a preset that matches your environment for optimal settings
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ENVIRONMENT_PRESETS.map((preset) => {
                    const PresetIcon = preset.icon;
                    return (
                      <Button
                        key={preset.id}
                        variant="outline"
                        className={cn(
                          "h-auto p-3 flex flex-col items-start gap-1 text-left hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all",
                        )}
                        onClick={() => {
                          onUpdate(preset.settings);
                          toast({
                            title: `Applied: ${preset.name}`,
                            description: preset.description,
                          });
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <PresetIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-medium text-xs">{preset.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                          {preset.description}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Faster-Whisper Configuration */}
              {settings.provider === "faster-whisper" && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">
                      Faster-Whisper Settings
                    </Label>

                    <div>
                      <Label htmlFor="voice-service-url">
                        Voice Service URL
                      </Label>
                      <input
                        id="voice-service-url"
                        type="text"
                        value={
                          settings.voiceServiceUrl || "http://127.0.0.1:8765"
                        }
                        onChange={(e) =>
                          onUpdate({ voiceServiceUrl: e.target.value })
                        }
                        className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm"
                        placeholder="http://127.0.0.1:8765"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        URL of the Python voice service
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="whisper-model-size">Model Size</Label>
                      <Select
                        value={settings.whisperModelSize || "base"}
                        onValueChange={(value) =>
                          onUpdate({
                            whisperModelSize: value as
                              | "tiny"
                              | "base"
                              | "small"
                              | "medium"
                              | "large-v2"
                              | "large-v3",
                          })
                        }
                      >
                        <SelectTrigger id="whisper-model-size" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tiny">
                            Tiny (Fastest, ~39M)
                          </SelectItem>
                          <SelectItem value="base">
                            Base (Recommended, ~74M)
                          </SelectItem>
                          <SelectItem value="small">Small (~244M)</SelectItem>
                          <SelectItem value="medium">Medium (~769M)</SelectItem>
                          <SelectItem value="large-v2">
                            Large v2 (~1550M)
                          </SelectItem>
                          <SelectItem value="large-v3">
                            Large v3 (~1550M)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Larger models are more accurate but slower
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="whisper-device">Device</Label>
                      <Select
                        value={settings.whisperDevice || "cpu"}
                        onValueChange={(value) =>
                          onUpdate({
                            whisperDevice: value as "cpu" | "cuda",
                          })
                        }
                      >
                        <SelectTrigger id="whisper-device" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpu">CPU</SelectItem>
                          <SelectItem value="cuda">CUDA (GPU)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="whisper-compute-type">Compute Type</Label>
                      <Select
                        value={settings.whisperComputeType || "int8"}
                        onValueChange={(value) =>
                          onUpdate({
                            whisperComputeType: value as
                              | "int8"
                              | "int8_float16"
                              | "int16"
                              | "float16"
                              | "float32",
                          })
                        }
                      >
                        <SelectTrigger
                          id="whisper-compute-type"
                          className="mt-1"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="int8">
                            int8 (Fastest, CPU)
                          </SelectItem>
                          <SelectItem value="int8_float16">
                            int8_float16
                          </SelectItem>
                          <SelectItem value="int16">int16</SelectItem>
                          <SelectItem value="float16">float16 (GPU)</SelectItem>
                          <SelectItem value="float32">
                            float32 (Best Quality)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="piper-voice">AI Voice (Piper TTS)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            testVoice();
                          }}
                          disabled={isTestingVoice}
                          className="h-7 text-xs"
                        >
                          {isTestingVoice ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              Test Voice
                            </>
                          )}
                        </Button>
                      </div>
                      <Select
                        value={
                          settings.piperVoice &&
                          ![
                            "en_US-lessac-medium",
                            "en_US-lessac-high",
                            "en_US-amy-medium",
                            "en_US-amy-high",
                            "en_US-ryan-medium",
                            "en_US-ryan-high",
                            "en_GB-alba-medium",
                            "en_GB-alba-high",
                            "en_GB-northern_english_male-medium",
                            "en_GB-semaine-medium",
                            "en_GB-semaine-high",
                            "es_ES-sharvard-medium",
                            "es_ES-sharvard-high",
                            "fr_FR-siwis-medium",
                            "fr_FR-siwis-high",
                            "de_DE-thorsten-medium",
                            "de_DE-thorsten-high",
                            "it_IT-riccardo-medium",
                            "it_IT-riccardo-high",
                            "ja_JP-natsumi-medium",
                            "ja_JP-natsumi-high",
                            "zh_CN-huayan-medium",
                            "zh_CN-huayan-high",
                          ].includes(settings.piperVoice)
                            ? "__custom__"
                            : settings.piperVoice || "en_US-lessac-medium"
                        }
                        onValueChange={(value) => {
                          if (value === "__custom__") {
                            // Don't update yet, just show the input
                            onUpdate({ piperVoice: "__custom__" });
                          } else {
                            onUpdate({ piperVoice: value });
                          }
                        }}
                      >
                        <SelectTrigger id="piper-voice" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en_US-lessac-medium">
                            English (US) - Lessac Medium (Default)
                          </SelectItem>
                          <SelectItem value="en_US-lessac-high">
                            English (US) - Lessac High Quality
                          </SelectItem>
                          <SelectItem value="en_US-amy-medium">
                            English (US) - Amy Medium (Female)
                          </SelectItem>
                          <SelectItem value="en_US-amy-high">
                            English (US) - Amy High Quality (Female)
                          </SelectItem>
                          <SelectItem value="en_US-ryan-medium">
                            English (US) - Ryan Medium (Male)
                          </SelectItem>
                          <SelectItem value="en_US-ryan-high">
                            English (US) - Ryan High Quality (Male)
                          </SelectItem>
                          <SelectItem value="en_GB-alba-medium">
                            English (UK) - Alba Medium
                          </SelectItem>
                          <SelectItem value="en_GB-alba-high">
                            English (UK) - Alba High Quality
                          </SelectItem>
                          <SelectItem value="en_GB-northern_english_male-medium">
                            English (UK) - Northern English Male
                          </SelectItem>
                          <SelectItem value="en_GB-semaine-medium">
                            English (UK) - Semaine Medium
                          </SelectItem>
                          <SelectItem value="en_GB-semaine-high">
                            English (UK) - Semaine High Quality
                          </SelectItem>
                          <SelectItem value="es_ES-sharvard-medium">
                            Spanish (Spain) - Sharvard Medium
                          </SelectItem>
                          <SelectItem value="es_ES-sharvard-high">
                            Spanish (Spain) - Sharvard High Quality
                          </SelectItem>
                          <SelectItem value="fr_FR-siwis-medium">
                            French - Siwis Medium
                          </SelectItem>
                          <SelectItem value="fr_FR-siwis-high">
                            French - Siwis High Quality
                          </SelectItem>
                          <SelectItem value="de_DE-thorsten-medium">
                            German - Thorsten Medium
                          </SelectItem>
                          <SelectItem value="de_DE-thorsten-high">
                            German - Thorsten High Quality
                          </SelectItem>
                          <SelectItem value="it_IT-riccardo-medium">
                            Italian - Riccardo Medium
                          </SelectItem>
                          <SelectItem value="it_IT-riccardo-high">
                            Italian - Riccardo High Quality
                          </SelectItem>
                          <SelectItem value="ja_JP-natsumi-medium">
                            Japanese - Natsumi Medium
                          </SelectItem>
                          <SelectItem value="ja_JP-natsumi-high">
                            Japanese - Natsumi High Quality
                          </SelectItem>
                          <SelectItem value="zh_CN-huayan-medium">
                            Chinese (Simplified) - Huayan Medium
                          </SelectItem>
                          <SelectItem value="zh_CN-huayan-high">
                            Chinese (Simplified) - Huayan High Quality
                          </SelectItem>
                          <SelectItem value="__custom__">
                            Custom Voice...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select the AI voice for text-to-speech. High quality voices
                        sound better but use more resources.
                      </p>
                      {(settings.piperVoice === "__custom__" ||
                        (settings.piperVoice &&
                          ![
                            "en_US-lessac-medium",
                            "en_US-lessac-high",
                            "en_US-amy-medium",
                            "en_US-amy-high",
                            "en_US-ryan-medium",
                            "en_US-ryan-high",
                            "en_GB-alba-medium",
                            "en_GB-alba-high",
                            "en_GB-northern_english_male-medium",
                            "en_GB-semaine-medium",
                            "en_GB-semaine-high",
                            "es_ES-sharvard-medium",
                            "es_ES-sharvard-high",
                            "fr_FR-siwis-medium",
                            "fr_FR-siwis-high",
                            "de_DE-thorsten-medium",
                            "de_DE-thorsten-high",
                            "it_IT-riccardo-medium",
                            "it_IT-riccardo-high",
                            "ja_JP-natsumi-medium",
                            "ja_JP-natsumi-high",
                            "zh_CN-huayan-medium",
                            "zh_CN-huayan-high",
                          ].includes(settings.piperVoice))) && (
                        <div className="mt-2">
                          <Label htmlFor="piper-voice-custom" className="text-xs">
                            Custom Voice Name
                          </Label>
                          <input
                            id="piper-voice-custom"
                            type="text"
                            value={
                              settings.piperVoice === "__custom__"
                                ? ""
                                : settings.piperVoice || ""
                            }
                            onChange={(e) =>
                              onUpdate({ piperVoice: e.target.value })
                            }
                            className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm"
                            placeholder="Enter voice name (e.g., en_US-custom-medium)"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter the name of your custom Piper voice model
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Voice Output */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Voice Output
                  </Label>
                  {settings.voiceOutputEnabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        testVoice();
                      }}
                      disabled={isTestingVoice}
                      className="h-7 text-xs"
                    >
                      {isTestingVoice ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Test
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="voice-output">
                        Enable Voice Responses
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        AI will speak responses aloud
                      </p>
                    </div>
                    <Switch
                      id="voice-output"
                      checked={settings.voiceOutputEnabled}
                      onCheckedChange={(checked) =>
                        onUpdate({ voiceOutputEnabled: checked })
                      }
                    />
                  </div>

                  {settings.voiceOutputEnabled && (
                    <>
                      <div>
                        <Label htmlFor="voice-persona">AI Persona</Label>
                        <Select
                          value={settings.voicePersona || 'friendly'}
                          onValueChange={(value) =>
                            onUpdate({ voicePersona: value as any })
                          }
                        >
                          <SelectTrigger id="voice-persona" className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="friendly">Friendly (Default)</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="concise">Concise</SelectItem>
                            <SelectItem value="robot">Robot</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Changes the tone of spoken responses
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="voice-speed">Speech Speed</Label>
                        <div className="mt-2 space-y-2">
                          <Slider
                            id="voice-speed"
                            min={0.5}
                            max={2.0}
                            step={0.1}
                            value={[settings.voiceSpeed]}
                            onValueChange={([value]) =>
                              onUpdate({ voiceSpeed: value })
                            }
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0.5x</span>
                            <span className="font-medium">
                              {settings.voiceSpeed}x
                            </span>
                            <span>2.0x</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="volume">Volume</Label>
                        <div className="mt-2 space-y-2">
                          <Slider
                            id="volume"
                            min={0}
                            max={100}
                            step={5}
                            value={[settings.volume]}
                            onValueChange={([value]) =>
                              onUpdate({ volume: value })
                            }
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0%</span>
                            <span className="font-medium">
                              {settings.volume}%
                            </span>
                            <span>100%</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* Activation Mode */}
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Activation Mode
                </Label>
                <Select
                  value={settings.activationMode}
                  onValueChange={(value) =>
                    onUpdate({
                      activationMode: value as VoiceSettings["activationMode"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="push-to-talk">
                      Push-to-Talk (Spacebar)
                    </SelectItem>
                    <SelectItem value="continuous">
                      Continuous (Wake word)
                    </SelectItem>
                    <SelectItem value="voice-activity-detection">
                      Voice Activity Detection
                    </SelectItem>
                  </SelectContent>
                </Select>
                {settings.activationMode === "continuous" && (
                  <div className="mt-2">
                    <Label htmlFor="wake-word">Wake Word</Label>
                    <input
                      id="wake-word"
                      type="text"
                      value={settings.wakeWord || "Hey Assistant"}
                      onChange={(e) => onUpdate({ wakeWord: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm"
                      placeholder="Hey Assistant"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Update Frequency */}
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Update Frequency
                </Label>
                <Select
                  value={settings.updateFrequency}
                  onValueChange={(value) =>
                    onUpdate({
                      updateFrequency:
                        value as VoiceSettings["updateFrequency"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verbose">
                      Verbose (Every step)
                    </SelectItem>
                    <SelectItem value="milestones">
                      Milestones (25%, 50%, 75%, 100%)
                    </SelectItem>
                    <SelectItem value="completion-only">
                      Completion Only
                    </SelectItem>
                    <SelectItem value="silent">Silent (Visual only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Advanced Options */}
              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Advanced Options
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-transcription">
                        Show Real-time Transcription
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Display transcription as you speak
                      </p>
                    </div>
                    <Switch
                      id="show-transcription"
                      checked={settings.showTranscription}
                      onCheckedChange={(checked) =>
                        onUpdate({ showTranscription: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-punctuation">Auto-punctuation</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically add punctuation
                      </p>
                    </div>
                    <Switch
                      id="auto-punctuation"
                      checked={settings.autoPunctuation}
                      onCheckedChange={(checked) =>
                        onUpdate({ autoPunctuation: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="noise-cancellation">
                        Noise Cancellation
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Filter background noise
                      </p>
                    </div>
                    <Switch
                      id="noise-cancellation"
                      checked={settings.noiseCancellation}
                      onCheckedChange={(checked) =>
                        onUpdate({ noiseCancellation: checked })
                      }
                    />
                  </div>

                  {/* Microphone Sensitivity Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="mic-sensitivity">
                        Microphone Sensitivity
                      </Label>
                      <span className="text-xs text-muted-foreground font-medium">
                        {settings.micSensitivity ?? 3}/10
                      </span>
                    </div>
                    <Slider
                      id="mic-sensitivity"
                      value={[settings.micSensitivity ?? 3]}
                      onValueChange={(value) =>
                        onUpdate({ micSensitivity: value[0] })
                      }
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Less sensitive (recommended)</span>
                      <span>More sensitive</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lower values (1-3) are recommended to avoid false triggers from ambient noise.
                      Increase only if your speech is not being detected.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="allow-interruptions">
                        Allow Interruptions
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Can interrupt AI while speaking
                      </p>
                    </div>
                    <Switch
                      id="allow-interruptions"
                      checked={settings.allowInterruptions}
                      onCheckedChange={(checked) =>
                        onUpdate({ allowInterruptions: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Language */}
              <div>
                <Label htmlFor="language">Language</Label>
                <Select
                  value={settings.language}
                  onValueChange={(value) => onUpdate({ language: value })}
                >
                  <SelectTrigger id="language" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanish</SelectItem>
                    <SelectItem value="fr-FR">French</SelectItem>
                    <SelectItem value="de-DE">German</SelectItem>
                    <SelectItem value="ja-JP">Japanese</SelectItem>
                    <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Service Status */}
              <VoiceServiceStatus
                settings={settings}
                serviceManager={serviceManager}
              />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
