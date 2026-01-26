/**
 * File: src/features/ai-assistant/voice/components/VoiceSettingsPanel.tsx
 *
 * Voice settings configuration panel.
 */

import { X, Volume2, Mic, Settings2 } from "lucide-react";
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
import type { VoiceSettings } from "../types";
import { VoiceServiceStatus } from "./VoiceServiceStatus";

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
                      <Label htmlFor="piper-voice">Piper Voice Model</Label>
                      <input
                        id="piper-voice"
                        type="text"
                        value={settings.piperVoice || "en_US-lessac-medium"}
                        onChange={(e) =>
                          onUpdate({ piperVoice: e.target.value })
                        }
                        className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm"
                        placeholder="en_US-lessac-medium"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Voice model name (e.g., en_US-lessac-medium)
                      </p>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Voice Output */}
              <div>
                <Label className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Voice Output
                </Label>
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
