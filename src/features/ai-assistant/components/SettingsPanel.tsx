/**
 * File: src/features/ai-assistant/components/SettingsPanel.tsx
 *
 * Component for AI Assistant settings and configuration.
 */

import { useState, useEffect } from "react";
import {
  X,
  Key,
  Shield,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  RefreshCw,
  Plus,
  Cpu,
  FolderX,
  Sparkles,
  User,
  Bot,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { testAPIKey, listAvailableModels } from "../utils/aiService";
import type { AISettings } from "../types";

interface SettingsPanelProps {
  settings: AISettings;
  onUpdate: (updates: Partial<AISettings>) => void;
  onClose: () => void;
}

export const SettingsPanel = ({
  settings,
  onUpdate,
  onClose,
}: SettingsPanelProps) => {
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [newExclusion, setNewExclusion] = useState("");

  const addExclusion = () => {
    if (!newExclusion.trim()) return;
    const current = settings.excludedFolders || [];
    if (!current.includes(newExclusion.trim())) {
      onUpdate({ excludedFolders: [...current, newExclusion.trim()] });
    }
    setNewExclusion("");
  };

  const removeExclusion = (path: string) => {
    const current = settings.excludedFolders || [];
    onUpdate({ excludedFolders: current.filter((p) => p !== path) });
  };

  // Load Ollama models when provider is Ollama
  useEffect(() => {
    if (settings.provider === "ollama") {
      loadOllamaModels();
    }
  }, [settings.provider, settings.ollamaBaseUrl]);

  const loadOllamaModels = async () => {
    setIsLoadingModels(true);
    try {
      const models = await listAvailableModels(
        "ollama",
        settings.ollamaBaseUrl,
      );
      setOllamaModels(models);
    } catch (error) {
      console.error("Failed to load Ollama models:", error);
      setOllamaModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingKey(true);
    setKeyTestResult(null);

    try {
      if (settings.provider === "ollama") {
        const result = await testAPIKey(undefined, "ollama", {
          baseUrl: settings.ollamaBaseUrl,
          model: settings.ollamaModel || settings.model,
        });
        setKeyTestResult(result);
      } else {
        if (!settings.apiKey) {
          setKeyTestResult({
            valid: false,
            message: "Please enter an API key first",
          });
          return;
        }
        const result = await testAPIKey(settings.apiKey, "anthropic");
        setKeyTestResult(result);
      }
    } catch (error: any) {
      setKeyTestResult({
        valid: false,
        message: error.message || "Failed to test connection",
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  return (
    <div className="w-96 border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      <Card className="rounded-none border-0 border-b h-full flex flex-col">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg">Settings</CardTitle>
            <CardDescription>Configure AI Assistant behavior</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 h-full">
            <div className="space-y-6">
              {/* AI Provider Selection */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Server className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <Label className="text-base font-semibold">AI Provider</Label>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={settings.provider || "anthropic"}
                      onValueChange={(value) => {
                        onUpdate({ provider: value as "anthropic" | "ollama" });
                        setKeyTestResult(null); // Clear test result when provider changes
                      }}
                    >
                      <SelectTrigger id="provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">
                          Anthropic Claude (Cloud)
                        </SelectItem>
                        <SelectItem value="ollama">
                          Ollama (Local LLM)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.provider === "ollama"
                        ? "Uses local Ollama installation - no API key required"
                        : "Uses Anthropic Claude API - requires API key"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Clawdbot Integration */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <Label className="text-base font-semibold">Clawdbot Integration</Label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="clawdbot-enabled">Enable Clawdbot Agent</Label>
                      <p className="text-xs text-muted-foreground">
                        Integrate with local Clawdbot CLI (requires Node 22+)
                      </p>
                    </div>
                    <Switch
                      id="clawdbot-enabled"
                      checked={settings.clawdbotEnabled}
                      onCheckedChange={(checked) =>
                        onUpdate({ clawdbotEnabled: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Personalization Settings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                  <Label className="text-base font-semibold">Personalization</Label>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ai-name">AI Assistant Name</Label>
                    <Input
                      id="ai-name"
                      value={settings.aiName || ""}
                      onChange={(e) =>
                        onUpdate({ aiName: e.target.value || undefined })
                      }
                      placeholder="FilePro (default)"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Customize the name the AI will use to refer to itself. Leave empty to use the default name.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="user-name">Your Name</Label>
                    <Input
                      id="user-name"
                      value={settings.userName || ""}
                      onChange={(e) =>
                        onUpdate({ userName: e.target.value || undefined })
                      }
                      placeholder="You (default)"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Set a name the AI will use to address you. Leave empty to use "You".
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* AI Model Settings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <Label className="text-base font-semibold">AI Model</Label>
                </div>
                <div className="space-y-3">
                  {settings.provider === "ollama" ? (
                    <>
                      <div>
                        <Label htmlFor="ollama-base-url">Ollama Base URL</Label>
                        <Input
                          id="ollama-base-url"
                          value={
                            settings.ollamaBaseUrl || "http://localhost:11434"
                          }
                          onChange={(e) =>
                            onUpdate({ ollamaBaseUrl: e.target.value })
                          }
                          placeholder="http://localhost:11434"
                          className="mt-1 font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          URL where Ollama is running
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label htmlFor="ollama-model">Ollama Model</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadOllamaModels}
                            disabled={isLoadingModels}
                            className="h-6 px-2"
                          >
                            <RefreshCw
                              className={`h-3 w-3 mr-1 ${isLoadingModels ? "animate-spin" : ""}`}
                            />
                            Refresh
                          </Button>
                        </div>
                        {isLoadingModels ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading models...
                          </div>
                        ) : ollamaModels.length > 0 ? (
                          <Select
                            value={
                              settings.ollamaModel ||
                              settings.model ||
                              "llama3.2:3b"
                            }
                            onValueChange={(value) =>
                              onUpdate({ ollamaModel: value, model: value })
                            }
                          >
                            <SelectTrigger id="ollama-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ollamaModels.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="ollama-model"
                            value={
                              settings.ollamaModel ||
                              settings.model ||
                              "llama3.2:3b"
                            }
                            onChange={(e) =>
                              onUpdate({
                                ollamaModel: e.target.value,
                                model: e.target.value,
                              })
                            }
                            placeholder="llama3.2:3b"
                            className="font-mono text-sm"
                          />
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Model name (e.g., llama3.2:3b). Make sure the model is
                          installed in Ollama.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label htmlFor="model">Model</Label>
                      <Select
                        value={settings.model}
                        onValueChange={(value) =>
                          onUpdate({ model: value as AISettings["model"] })
                        }
                      >
                        <SelectTrigger id="model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="claude-sonnet">
                            Claude Sonnet 4.5 (Recommended)
                          </SelectItem>
                          <SelectItem value="claude-opus">
                            Claude Opus 4.5 (Most Capable)
                          </SelectItem>
                          <SelectItem value="claude-haiku">
                            Claude Haiku 4.5 (Fastest)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="creativity">Creativity Level</Label>
                    <Select
                      value={settings.creativityLevel}
                      onValueChange={(value) =>
                        onUpdate({
                          creativityLevel:
                            value as AISettings["creativityLevel"],
                        })
                      }
                    >
                      <SelectTrigger id="creativity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conservative">
                          Conservative (Safe, Predictable)
                        </SelectItem>
                        <SelectItem value="balanced">
                          Balanced (Recommended)
                        </SelectItem>
                        <SelectItem value="creative">
                          Creative (Innovative)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Safety Settings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <Label className="text-base font-semibold">Safety</Label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="backup">Enable Auto-Backup</Label>
                      <p className="text-xs text-muted-foreground">
                        Create backups before major operations
                      </p>
                    </div>
                    <Switch
                      id="backup"
                      checked={settings.enableBackup}
                      onCheckedChange={(checked) =>
                        onUpdate({ enableBackup: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="dry-run">Dry Run by Default</Label>
                      <p className="text-xs text-muted-foreground">
                        Preview changes without executing
                      </p>
                    </div>
                    <Switch
                      id="dry-run"
                      checked={settings.dryRunDefault}
                      onCheckedChange={(checked) =>
                        onUpdate({ dryRunDefault: checked })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="threshold">Auto-Approve Threshold</Label>
                    <Input
                      id="threshold"
                      type="number"
                      value={settings.autoApproveThreshold}
                      onChange={(e) =>
                        onUpdate({
                          autoApproveThreshold: parseInt(e.target.value) || 50,
                        })
                      }
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Operations affecting more files require confirmation
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Excluded Folders */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FolderX className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <Label className="text-base font-semibold">Excluded Folders</Label>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={newExclusion}
                      onChange={(e) => setNewExclusion(e.target.value)}
                      placeholder="/path/to/exclude"
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addExclusion();
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addExclusion}
                      disabled={!newExclusion.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(settings.excludedFolders || []).length === 0 && (
                      <p className="text-xs text-muted-foreground italic w-full">
                        No folders excluded. Add paths to prevent AI access.
                      </p>
                    )}
                    {(settings.excludedFolders || []).map((path) => (
                      <Badge
                        key={path}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1 font-mono text-xs"
                      >
                        {path}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 rounded-full hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40"
                          onClick={() => removeExclusion(path)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Advanced Configuration */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  <Label className="text-base font-semibold">Advanced</Label>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="system-prompt" className="mb-2 block">
                      System Prompt
                    </Label>
                    <Textarea
                      id="system-prompt"
                      value={settings.systemPrompt || ""}
                      onChange={(e) =>
                        onUpdate({ systemPrompt: e.target.value })
                      }
                      placeholder="Default system prompt will be used if empty..."
                      className="font-mono text-xs min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Override the default instructions. Leave empty to use the built-in optimized prompt.
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="max-tokens">Max Tokens</Label>
                    <Input
                      id="max-tokens"
                      type="number"
                      value={settings.maxTokens || 4096}
                      onChange={(e) =>
                        onUpdate({
                          maxTokens: parseInt(e.target.value) || 4096,
                        })
                      }
                      className="mt-1 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum number of tokens to generate (default: 4096)
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* API Configuration */}
              {settings.provider === "anthropic" && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Key className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <Label className="text-base font-semibold">
                        API Configuration
                      </Label>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label htmlFor="api-key">Anthropic API Key</Label>
                          {settings.apiKey && (
                            <Badge variant="outline" className="text-xs">
                              {settings.apiKey.substring(0, 8)}...
                            </Badge>
                          )}
                        </div>
                        <Input
                          id="api-key"
                          type="password"
                          value={settings.apiKey || ""}
                          onChange={(e) => {
                            onUpdate({ apiKey: e.target.value });
                            setKeyTestResult(null); // Clear test result when key changes
                          }}
                          placeholder="sk-ant-..."
                          className="mt-1 font-mono text-sm"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTestConnection}
                            disabled={!settings.apiKey || isTestingKey}
                            className="flex-1"
                          >
                            {isTestingKey ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <Key className="h-3 w-3 mr-2" />
                                Test Key
                              </>
                            )}
                          </Button>
                        </div>
                        {keyTestResult && (
                          <div
                            className={`mt-2 p-2 rounded-lg flex items-center gap-2 text-xs ${
                              keyTestResult.valid
                                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                            }`}
                          >
                            {keyTestResult.valid ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                            <span>{keyTestResult.message}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Your API key is stored locally and never shared. Get
                          your key from{" "}
                          <a
                            href="https://console.anthropic.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Anthropic Console
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Ollama Connection Test */}
              {settings.provider === "ollama" && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <Label className="text-base font-semibold">
                        Connection Test
                      </Label>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestConnection}
                          disabled={isTestingKey}
                          className="flex-1"
                        >
                          {isTestingKey ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Server className="h-3 w-3 mr-2" />
                              Test Connection
                            </>
                          )}
                        </Button>
                      </div>
                      {keyTestResult && (
                        <div
                          className={`p-2 rounded-lg flex items-center gap-2 text-xs ${
                            keyTestResult.valid
                              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                          }`}
                        >
                          {keyTestResult.valid ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          <span>{keyTestResult.message}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Make sure Ollama is running. Install from{" "}
                        <a
                          href="https://ollama.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          ollama.com
                        </a>{" "}
                        and pull the model:{" "}
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                          ollama pull llama3.2:3b
                        </code>
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
