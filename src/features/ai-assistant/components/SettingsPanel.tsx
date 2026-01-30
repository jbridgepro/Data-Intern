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
  Brain,
  Database,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Lock,
  Unlock,
  RotateCcw,
  History,
  Undo2,
  FileText,
  Download,
  Eye,
  EyeOff,
  Play,
  Globe,
  DollarSign,
  XCircle,
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
import type { AISettings, ContextSettings, CacheSettings, ToolPermissionsSettings, ToolPermission, ToolRiskLevel, OperationHistorySettings, AuditLogSettings, AuditLogLevel, WorkflowSettings, OpenRouterSettings, OpenRouterModel } from "../types";
import { DEFAULT_CONTEXT_SETTINGS, DEFAULT_CACHE_SETTINGS, DEFAULT_TOOL_PERMISSIONS, TOOL_METADATA, DEFAULT_OPERATION_HISTORY_SETTINGS, DEFAULT_AUDIT_LOG_SETTINGS, DEFAULT_WORKFLOW_SETTINGS, DEFAULT_OPENROUTER_SETTINGS, OPENROUTER_POPULAR_MODELS } from "../types";
import { Slider } from "@/components/ui/slider";
import { directoryCache } from "../utils/directoryCache";
import { toolPermissionManager } from "../utils/toolPermissions";
import { operationHistory } from "../utils/operationHistory";
import { auditLogger } from "../utils/auditLogger";
import { workflowManager } from "../utils/workflowManager";
import { openRouterService, formatModelPricing, formatContextLength, getProviderDisplayName } from "../utils/openRouterService";

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
  const [cacheStats, setCacheStats] = useState(directoryCache.getStats());
  const [toolPermissions, setToolPermissions] = useState<ToolPermission[]>([]);
  const [permissionFilter, setPermissionFilter] = useState<'all' | 'safe' | 'moderate' | 'destructive'>('all');

  // Update cache stats periodically when component is mounted
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(directoryCache.getStats());
    }, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Load tool permissions when settings change
  useEffect(() => {
    if (settings.toolPermissions) {
      toolPermissionManager.updateSettings(settings.toolPermissions);
    }
    setToolPermissions(toolPermissionManager.getAllToolPermissions());
  }, [settings.toolPermissions]);

  // Handle clearing the cache
  const handleClearCache = () => {
    directoryCache.clear();
    setCacheStats(directoryCache.getStats());
  };

  // Handle changing a tool's permission
  const handleToolPermissionChange = (toolName: string, status: 'allowed' | 'confirm' | 'disabled') => {
    const currentOverrides = settings.toolPermissions?.toolOverrides || {};
    const currentDisabled = settings.toolPermissions?.disabledTools || [];
    
    let newOverrides = { ...currentOverrides };
    let newDisabled = [...currentDisabled];
    
    if (status === 'disabled') {
      // Add to disabled list, remove from overrides
      if (!newDisabled.includes(toolName)) {
        newDisabled.push(toolName);
      }
      delete newOverrides[toolName];
    } else {
      // Remove from disabled, add to overrides
      newDisabled = newDisabled.filter(t => t !== toolName);
      newOverrides[toolName] = status;
    }
    
    onUpdate({
      toolPermissions: {
        ...DEFAULT_TOOL_PERMISSIONS,
        ...settings.toolPermissions,
        toolOverrides: newOverrides,
        disabledTools: newDisabled,
      },
    });
  };

  // Handle resetting a tool's permission
  const handleResetToolPermission = (toolName: string) => {
    const currentOverrides = { ...settings.toolPermissions?.toolOverrides || {} };
    const currentDisabled = settings.toolPermissions?.disabledTools || [];
    
    delete currentOverrides[toolName];
    const newDisabled = currentDisabled.filter(t => t !== toolName);
    
    onUpdate({
      toolPermissions: {
        ...DEFAULT_TOOL_PERMISSIONS,
        ...settings.toolPermissions,
        toolOverrides: currentOverrides,
        disabledTools: newDisabled,
      },
    });
  };

  // Handle resetting all permissions
  const handleResetAllPermissions = () => {
    onUpdate({
      toolPermissions: { ...DEFAULT_TOOL_PERMISSIONS },
    });
  };

  // Filter tools by risk level
  const filteredTools = toolPermissions.filter(tool => 
    permissionFilter === 'all' || tool.riskLevel === permissionFilter
  );

  // Get permission stats
  const permissionStats = {
    total: toolPermissions.length,
    allowed: toolPermissions.filter(t => t.status === 'allowed').length,
    confirm: toolPermissions.filter(t => t.status === 'confirm').length,
    disabled: toolPermissions.filter(t => t.status === 'disabled').length,
  };

  // Get risk level icon
  const getRiskIcon = (level: ToolRiskLevel) => {
    switch (level) {
      case 'safe': return <ShieldCheck className="h-3.5 w-3.5 text-green-500" />;
      case 'moderate': return <ShieldAlert className="h-3.5 w-3.5 text-yellow-500" />;
      case 'destructive': return <ShieldOff className="h-3.5 w-3.5 text-red-500" />;
    }
  };

  // Get status icon
  const getStatusIcon = (status: 'allowed' | 'confirm' | 'disabled') => {
    switch (status) {
      case 'allowed': return <Unlock className="h-3.5 w-3.5 text-green-500" />;
      case 'confirm': return <Lock className="h-3.5 w-3.5 text-yellow-500" />;
      case 'disabled': return <ShieldOff className="h-3.5 w-3.5 text-red-500" />;
    }
  };

  // History stats state
  const [historyStats, setHistoryStats] = useState({ undoCount: 0, redoCount: 0, total: 0 });

  // Load history stats
  useEffect(() => {
    const loadStats = async () => {
      await operationHistory.initialize();
      setHistoryStats(operationHistory.getStackInfo());
    };
    loadStats();
    
    const unsubscribe = operationHistory.addListener((_, undo, redo) => {
      setHistoryStats({ undoCount: undo, redoCount: redo, total: operationHistory.getHistory().length });
    });
    return () => unsubscribe();
  }, []);

  // Handle clearing history
  const handleClearOperationHistory = () => {
    operationHistory.clearHistory();
    setHistoryStats({ undoCount: 0, redoCount: 0, total: 0 });
  };

  // Audit log stats state
  const [auditStats, setAuditStats] = useState({ 
    totalEntries: 0, 
    errorCount: 0, 
    successRate: 100 
  });

  // Load audit stats
  useEffect(() => {
    const loadAuditStats = async () => {
      await auditLogger.initialize();
      const stats = auditLogger.getStats();
      setAuditStats({
        totalEntries: stats.totalEntries,
        errorCount: stats.errorCount,
        successRate: stats.successRate,
      });
    };
    loadAuditStats();
    
    const unsubscribe = auditLogger.addListener((_, stats) => {
      setAuditStats({
        totalEntries: stats.totalEntries,
        errorCount: stats.errorCount,
        successRate: stats.successRate,
      });
    });
    return () => unsubscribe();
  }, []);

  // Handle clearing audit logs
  const handleClearAuditLogs = () => {
    auditLogger.clearLogs();
    setAuditStats({ totalEntries: 0, errorCount: 0, successRate: 100 });
  };

  // Handle export audit logs
  const handleExportAuditLogs = (format: 'json' | 'csv' | 'txt') => {
    const exportData = auditLogger.exportLogs(format);
    const blob = new Blob([exportData.data], { 
      type: format === 'json' ? 'application/json' : 'text/plain' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Workflow stats state
  const [workflowStats, setWorkflowStats] = useState({ total: 0, favorites: 0, totalRuns: 0 });

  // Load workflow stats
  useEffect(() => {
    const loadWorkflowStats = async () => {
      await workflowManager.initialize();
      const workflows = workflowManager.getAllWorkflows();
      setWorkflowStats({
        total: workflows.length,
        favorites: workflows.filter(w => w.isFavorite).length,
        totalRuns: workflows.reduce((sum, w) => sum + w.runCount, 0),
      });
    };
    loadWorkflowStats();
    
    const unsubscribe = workflowManager.addWorkflowListener((workflows) => {
      setWorkflowStats({
        total: workflows.length,
        favorites: workflows.filter(w => w.isFavorite).length,
        totalRuns: workflows.reduce((sum, w) => sum + w.runCount, 0),
      });
    });
    return () => unsubscribe();
  }, []);

  // Handle export workflows
  const handleExportWorkflows = () => {
    const data = workflowManager.exportWorkflows();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflows-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // OpenRouter state
  const [openRouterApiKeyValid, setOpenRouterApiKeyValid] = useState<boolean | null>(null);
  const [isValidatingOpenRouterKey, setIsValidatingOpenRouterKey] = useState(false);
  const [openRouterCredits, setOpenRouterCredits] = useState<number | null>(null);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);

  // Validate OpenRouter API key
  const handleValidateOpenRouterKey = async () => {
    const apiKey = settings.openRouter?.apiKey;
    if (!apiKey) {
      setOpenRouterApiKeyValid(false);
      return;
    }

    setIsValidatingOpenRouterKey(true);
    openRouterService.updateSettings({ apiKey });
    
    try {
      const result = await openRouterService.validateApiKey();
      setOpenRouterApiKeyValid(result.valid);
      
      if (result.valid) {
        const credits = await openRouterService.getCredits();
        setOpenRouterCredits(credits?.credits || null);
      }
    } catch (error) {
      setOpenRouterApiKeyValid(false);
    } finally {
      setIsValidatingOpenRouterKey(false);
    }
  };

  // Update OpenRouter settings helper
  const updateOpenRouterSettings = (updates: Partial<OpenRouterSettings>) => {
    onUpdate({
      openRouter: {
        ...DEFAULT_OPENROUTER_SETTINGS,
        ...settings.openRouter,
        ...updates,
      },
    });
  };

  // Get selected OpenRouter model info
  const selectedOpenRouterModel = OPENROUTER_POPULAR_MODELS.find(
    m => m.id === (settings.openRouter?.model || DEFAULT_OPENROUTER_SETTINGS.model)
  );

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
                        onUpdate({ provider: value as "anthropic" | "ollama" | "openrouter" });
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
                        <SelectItem value="openrouter">
                          OpenRouter (Multi-Model)
                        </SelectItem>
                        <SelectItem value="ollama">
                          Ollama (Local LLM)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.provider === "ollama"
                        ? "Uses local Ollama installation - no API key required"
                        : settings.provider === "openrouter"
                        ? "Access 100+ AI models through unified API"
                        : "Uses Anthropic Claude API - requires API key"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* OpenRouter Configuration - Only show when OpenRouter is selected */}
              {settings.provider === "openrouter" && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <Label className="text-base font-semibold">
                      OpenRouter Configuration
                    </Label>
                  </div>
                  
                  {/* Setup Required Alert - Show when API key is not configured */}
                  {(!settings.openRouter?.apiKey || settings.openRouter.apiKey.trim() === "") && (
                    <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                            API Key Required
                          </p>
                          <p className="text-blue-700 dark:text-blue-300 mb-2">
                            OpenRouter provides access to 100+ AI models through a single API.
                            Get your free API key to get started.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                            onClick={() => window.open("https://openrouter.ai/keys", "_blank")}
                          >
                            Get API Key →
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {/* API Key */}
                    <div>
                      <Label htmlFor="openrouter-api-key" className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5" />
                        API Key
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <div className="relative flex-1">
                          <Input
                            id="openrouter-api-key"
                            type={showOpenRouterKey ? "text" : "password"}
                            value={settings.openRouter?.apiKey || ""}
                            onChange={(e) => {
                              updateOpenRouterSettings({ apiKey: e.target.value });
                              setOpenRouterApiKeyValid(null);
                            }}
                            placeholder="sk-or-v1-..."
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                          >
                            {showOpenRouterKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleValidateOpenRouterKey}
                          disabled={isValidatingOpenRouterKey || !settings.openRouter?.apiKey}
                        >
                          {isValidatingOpenRouterKey ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : openRouterApiKeyValid === true ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : openRouterApiKeyValid === false ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            "Test"
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Get your API key from{" "}
                        <a 
                          href="https://openrouter.ai/keys" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          openrouter.ai/keys
                        </a>
                      </p>
                      {/* Validation result feedback */}
                      {openRouterApiKeyValid === false && (
                        <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
                          <div className="flex items-center gap-1 font-medium">
                            <XCircle className="h-3.5 w-3.5" />
                            Invalid API Key
                          </div>
                          <p className="mt-1">Please check that you've copied the full API key correctly.</p>
                        </div>
                      )}
                      {openRouterApiKeyValid === true && (
                        <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/20 text-xs text-green-700 dark:text-green-300">
                          <div className="flex items-center gap-1 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            API Key Valid
                          </div>
                          {openRouterCredits !== null && (
                            <p className="mt-1 flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Credits remaining: ${openRouterCredits.toFixed(4)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Model Selection */}
                    <div>
                      <Label htmlFor="openrouter-model" className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5" />
                        Model
                      </Label>
                      <Select
                        value={settings.openRouter?.model || DEFAULT_OPENROUTER_SETTINGS.model}
                        onValueChange={(value) => updateOpenRouterSettings({ model: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPENROUTER_POPULAR_MODELS.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{model.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({getProviderDisplayName(model.provider)})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedOpenRouterModel && (
                        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs space-y-1">
                          <p className="text-muted-foreground">{selectedOpenRouterModel.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                              {formatContextLength(selectedOpenRouterModel.contextLength)} context
                            </span>
                            {selectedOpenRouterModel.supportsTools && (
                              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                                Tools
                              </span>
                            )}
                            {selectedOpenRouterModel.supportsVision && (
                              <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                                Vision
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            {formatModelPricing(selectedOpenRouterModel)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Temperature */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="openrouter-temp">Temperature</Label>
                        <span className="text-sm text-muted-foreground">
                          {(settings.openRouter?.temperature ?? DEFAULT_OPENROUTER_SETTINGS.temperature).toFixed(1)}
                        </span>
                      </div>
                      <Slider
                        id="openrouter-temp"
                        min={0}
                        max={2}
                        step={0.1}
                        value={[settings.openRouter?.temperature ?? DEFAULT_OPENROUTER_SETTINGS.temperature]}
                        onValueChange={(value) => updateOpenRouterSettings({ temperature: value[0] })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Lower = more focused, Higher = more creative
                      </p>
                    </div>

                    {/* Max Tokens */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="openrouter-tokens">Max Tokens</Label>
                        <span className="text-sm text-muted-foreground">
                          {settings.openRouter?.maxTokens ?? DEFAULT_OPENROUTER_SETTINGS.maxTokens}
                        </span>
                      </div>
                      <Slider
                        id="openrouter-tokens"
                        min={256}
                        max={16384}
                        step={256}
                        value={[settings.openRouter?.maxTokens ?? DEFAULT_OPENROUTER_SETTINGS.maxTokens]}
                        onValueChange={(value) => updateOpenRouterSettings({ maxTokens: value[0] })}
                      />
                    </div>

                    {/* Site Info (for rankings) */}
                    <div>
                      <Label htmlFor="openrouter-site">Site Name (Optional)</Label>
                      <Input
                        id="openrouter-site"
                        value={settings.openRouter?.siteName || ""}
                        onChange={(e) => updateOpenRouterSettings({ siteName: e.target.value })}
                        placeholder="File Pro"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Shown in OpenRouter rankings (optional)
                      </p>
                    </div>

                    {/* Enable Fallback */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="openrouter-fallback">Enable Fallback</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically try backup models on failure
                        </p>
                      </div>
                      <Switch
                        id="openrouter-fallback"
                        checked={settings.openRouter?.enableFallback ?? DEFAULT_OPENROUTER_SETTINGS.enableFallback}
                        onCheckedChange={(checked) => updateOpenRouterSettings({ enableFallback: checked })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {settings.provider === "openrouter" && <Separator />}

              {/* Clawdbot Integration */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <Label className="text-base font-semibold">
                    Clawdbot Integration
                  </Label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="clawdbot-enabled">
                        Enable Clawdbot Agent
                      </Label>
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
                  <Label className="text-base font-semibold">
                    Personalization
                  </Label>
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
                      Customize the name the AI will use to refer to itself.
                      Leave empty to use the default name.
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
                      Set a name the AI will use to address you. Leave empty to
                      use "You".
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

              {/* Context Management Settings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <Label className="text-base font-semibold">
                    Context Management
                  </Label>
                </div>
                <div className="space-y-4">
                  {/* Max Conversation History */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="max-history">Conversation Memory</Label>
                      <span className="text-sm text-muted-foreground">
                        {settings.contextSettings?.maxConversationHistory ??
                          DEFAULT_CONTEXT_SETTINGS.maxConversationHistory}{" "}
                        messages
                      </span>
                    </div>
                    <Slider
                      id="max-history"
                      min={5}
                      max={30}
                      step={1}
                      value={[
                        settings.contextSettings?.maxConversationHistory ??
                          DEFAULT_CONTEXT_SETTINGS.maxConversationHistory,
                      ]}
                      onValueChange={(value) =>
                        onUpdate({
                          contextSettings: {
                            ...DEFAULT_CONTEXT_SETTINGS,
                            ...settings.contextSettings,
                            maxConversationHistory: value[0],
                          },
                        })
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Number of messages to include in AI context. Higher values
                      provide more context but use more tokens.
                    </p>
                  </div>

                  {/* Memory Mode */}
                  <div>
                    <Label htmlFor="memory-mode">Memory Mode</Label>
                    <Select
                      value={
                        settings.contextSettings?.memoryMode ??
                        DEFAULT_CONTEXT_SETTINGS.memoryMode
                      }
                      onValueChange={(value: "session" | "persistent") =>
                        onUpdate({
                          contextSettings: {
                            ...DEFAULT_CONTEXT_SETTINGS,
                            ...settings.contextSettings,
                            memoryMode: value,
                          },
                        })
                      }
                    >
                      <SelectTrigger id="memory-mode" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="session">
                          Session (clears on tab close)
                        </SelectItem>
                        <SelectItem value="persistent">
                          Persistent (survives restarts)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      How long to retain conversation history
                    </p>
                  </div>

                  {/* Prioritize Tool Messages */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="prioritize-tools">
                        Prioritize Tool Messages
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Keep messages with tool executions in context
                      </p>
                    </div>
                    <Switch
                      id="prioritize-tools"
                      checked={
                        settings.contextSettings?.prioritizeToolMessages ??
                        DEFAULT_CONTEXT_SETTINGS.prioritizeToolMessages
                      }
                      onCheckedChange={(checked) =>
                        onUpdate({
                          contextSettings: {
                            ...DEFAULT_CONTEXT_SETTINGS,
                            ...settings.contextSettings,
                            prioritizeToolMessages: checked,
                          },
                        })
                      }
                    />
                  </div>

                  {/* Enable Context Summarization */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="context-summary">
                        Context Summarization
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Summarize older context when truncating
                      </p>
                    </div>
                    <Switch
                      id="context-summary"
                      checked={
                        settings.contextSettings?.enableContextSummarization ??
                        DEFAULT_CONTEXT_SETTINGS.enableContextSummarization
                      }
                      onCheckedChange={(checked) =>
                        onUpdate({
                          contextSettings: {
                            ...DEFAULT_CONTEXT_SETTINGS,
                            ...settings.contextSettings,
                            enableContextSummarization: checked,
                          },
                        })
                      }
                    />
                  </div>

                  {/* Include Directory Analysis */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="include-analysis">
                        Include Directory Analysis
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Add directory info to context
                      </p>
                    </div>
                    <Switch
                      id="include-analysis"
                      checked={
                        settings.contextSettings?.includeDirectoryAnalysis ??
                        DEFAULT_CONTEXT_SETTINGS.includeDirectoryAnalysis
                      }
                      onCheckedChange={(checked) =>
                        onUpdate({
                          contextSettings: {
                            ...DEFAULT_CONTEXT_SETTINGS,
                            ...settings.contextSettings,
                            includeDirectoryAnalysis: checked,
                          },
                        })
                      }
                    />
                  </div>

                  {/* Relevance Threshold */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="relevance-threshold">
                        Relevance Threshold
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        {Math.round(
                          (settings.contextSettings?.relevanceThreshold ??
                            DEFAULT_CONTEXT_SETTINGS.relevanceThreshold) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <Slider
                      id="relevance-threshold"
                      min={0}
                      max={100}
                      step={5}
                      value={[
                        Math.round(
                          (settings.contextSettings?.relevanceThreshold ??
                            DEFAULT_CONTEXT_SETTINGS.relevanceThreshold) * 100,
                        ),
                      ]}
                      onValueChange={(value) =>
                        onUpdate({
                          contextSettings: {
                            ...DEFAULT_CONTEXT_SETTINGS,
                            ...settings.contextSettings,
                            relevanceThreshold: value[0] / 100,
                          },
                        })
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum relevance score for including older messages.
                      Lower values include more context.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Cache Settings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <Label className="text-base font-semibold">
                    Directory Cache
                  </Label>
                </div>
                <div className="space-y-4">
                  {/* Cache Status Display */}
                  {(settings.cacheSettings?.showCacheStatus ??
                    DEFAULT_CACHE_SETTINGS.showCacheStatus) && (
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Cached Entries
                        </span>
                        <span className="font-medium">
                          {cacheStats.entries}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Hit Rate</span>
                        <span className="font-medium">
                          {cacheStats.hitRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Cache Size
                        </span>
                        <span className="font-medium">
                          {(cacheStats.totalSize / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearCache}
                        disabled={cacheStats.entries === 0}
                        className="w-full mt-2"
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Clear Cache
                      </Button>
                    </div>
                  )}

                  {/* Enable Cache */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="cache-enabled">Enable Caching</Label>
                      <p className="text-xs text-muted-foreground">
                        Cache directory analysis for faster responses
                      </p>
                    </div>
                    <Switch
                      id="cache-enabled"
                      checked={
                        settings.cacheSettings?.enabled ??
                        DEFAULT_CACHE_SETTINGS.enabled
                      }
                      onCheckedChange={(checked) =>
                        onUpdate({
                          cacheSettings: {
                            ...DEFAULT_CACHE_SETTINGS,
                            ...settings.cacheSettings,
                            enabled: checked,
                          },
                        })
                      }
                    />
                  </div>

                  {/* Cache TTL */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="cache-ttl">Cache Duration</Label>
                      <span className="text-sm text-muted-foreground">
                        {Math.floor(
                          (settings.cacheSettings?.ttlSeconds ??
                            DEFAULT_CACHE_SETTINGS.ttlSeconds) / 60,
                        )}{" "}
                        min
                      </span>
                    </div>
                    <Slider
                      id="cache-ttl"
                      min={60}
                      max={1800}
                      step={60}
                      value={[
                        settings.cacheSettings?.ttlSeconds ??
                          DEFAULT_CACHE_SETTINGS.ttlSeconds,
                      ]}
                      onValueChange={(value) =>
                        onUpdate({
                          cacheSettings: {
                            ...DEFAULT_CACHE_SETTINGS,
                            ...settings.cacheSettings,
                            ttlSeconds: value[0],
                          },
                        })
                      }
                      disabled={
                        !(
                          settings.cacheSettings?.enabled ??
                          DEFAULT_CACHE_SETTINGS.enabled
                        )
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      How long to keep cached results before refreshing
                    </p>
                  </div>

                  {/* Max Entries */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="cache-max-entries">
                        Max Cached Directories
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        {settings.cacheSettings?.maxEntries ??
                          DEFAULT_CACHE_SETTINGS.maxEntries}
                      </span>
                    </div>
                    <Slider
                      id="cache-max-entries"
                      min={10}
                      max={200}
                      step={10}
                      value={[
                        settings.cacheSettings?.maxEntries ??
                          DEFAULT_CACHE_SETTINGS.maxEntries,
                      ]}
                      onValueChange={(value) =>
                        onUpdate({
                          cacheSettings: {
                            ...DEFAULT_CACHE_SETTINGS,
                            ...settings.cacheSettings,
                            maxEntries: value[0],
                          },
                        })
                      }
                      disabled={
                        !(
                          settings.cacheSettings?.enabled ??
                          DEFAULT_CACHE_SETTINGS.enabled
                        )
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum number of directories to cache
                    </p>
                  </div>

                  {/* Show Cache Status */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-cache-status">
                        Show Cache Status
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Display cache statistics in this panel
                      </p>
                    </div>
                    <Switch
                      id="show-cache-status"
                      checked={
                        settings.cacheSettings?.showCacheStatus ??
                        DEFAULT_CACHE_SETTINGS.showCacheStatus
                      }
                      onCheckedChange={(checked) =>
                        onUpdate({
                          cacheSettings: {
                            ...DEFAULT_CACHE_SETTINGS,
                            ...settings.cacheSettings,
                            showCacheStatus: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tool Permissions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <Label className="text-base font-semibold">
                    Tool Permissions
                  </Label>
                </div>
                <div className="space-y-4">
                  {/* Permission Stats */}
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{permissionStats.total}</div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">{permissionStats.allowed}</div>
                        <div className="text-muted-foreground">Allowed</div>
                      </div>
                      <div>
                        <div className="font-semibold text-yellow-600">{permissionStats.confirm}</div>
                        <div className="text-muted-foreground">Confirm</div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-600">{permissionStats.disabled}</div>
                        <div className="text-muted-foreground">Disabled</div>
                      </div>
                    </div>
                  </div>

                  {/* Enable Permission Checking */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="permissions-enabled">Enable Permission Checking</Label>
                      <p className="text-xs text-muted-foreground">
                        Enforce tool permissions and confirmations
                      </p>
                    </div>
                    <Switch
                      id="permissions-enabled"
                      checked={settings.toolPermissions?.enabled ?? DEFAULT_TOOL_PERMISSIONS.enabled}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          toolPermissions: {
                            ...DEFAULT_TOOL_PERMISSIONS,
                            ...settings.toolPermissions,
                            enabled: checked,
                          },
                        })
                      }
                    />
                  </div>

                  {/* Require Confirmation for Destructive */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="confirm-destructive">Confirm Destructive Operations</Label>
                      <p className="text-xs text-muted-foreground">
                        Require confirmation for delete/move operations
                      </p>
                    </div>
                    <Switch
                      id="confirm-destructive"
                      checked={!settings.toolPermissions?.allowDestructiveWithoutConfirmation}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          toolPermissions: {
                            ...DEFAULT_TOOL_PERMISSIONS,
                            ...settings.toolPermissions,
                            allowDestructiveWithoutConfirmation: !checked,
                          },
                        })
                      }
                      disabled={!(settings.toolPermissions?.enabled ?? DEFAULT_TOOL_PERMISSIONS.enabled)}
                    />
                  </div>

                  {/* Tool Filter */}
                  <div>
                    <Label>Filter by Risk Level</Label>
                    <div className="flex gap-2 mt-2">
                      {(['all', 'safe', 'moderate', 'destructive'] as const).map((filter) => (
                        <Button
                          key={filter}
                          variant={permissionFilter === filter ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPermissionFilter(filter)}
                          className="text-xs capitalize"
                        >
                          {filter === 'all' ? 'All' : (
                            <>
                              {filter === 'safe' && <ShieldCheck className="h-3 w-3 mr-1" />}
                              {filter === 'moderate' && <ShieldAlert className="h-3 w-3 mr-1" />}
                              {filter === 'destructive' && <ShieldOff className="h-3 w-3 mr-1" />}
                              {filter}
                            </>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Tool List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filteredTools.map((tool) => (
                      <div
                        key={tool.toolName}
                        className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getRiskIcon(tool.riskLevel)}
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{tool.displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">{tool.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Select
                            value={tool.status}
                            onValueChange={(value: 'allowed' | 'confirm' | 'disabled') =>
                              handleToolPermissionChange(tool.toolName, value)
                            }
                            disabled={!(settings.toolPermissions?.enabled ?? DEFAULT_TOOL_PERMISSIONS.enabled) || !tool.canDisable}
                          >
                            <SelectTrigger className="h-7 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="allowed">
                                <span className="flex items-center gap-1">
                                  <Unlock className="h-3 w-3 text-green-500" />
                                  Allowed
                                </span>
                              </SelectItem>
                              <SelectItem value="confirm">
                                <span className="flex items-center gap-1">
                                  <Lock className="h-3 w-3 text-yellow-500" />
                                  Confirm
                                </span>
                              </SelectItem>
                              {tool.canDisable && (
                                <SelectItem value="disabled">
                                  <span className="flex items-center gap-1">
                                    <ShieldOff className="h-3 w-3 text-red-500" />
                                    Disabled
                                  </span>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleResetToolPermission(tool.toolName)}
                            disabled={!(settings.toolPermissions?.enabled ?? DEFAULT_TOOL_PERMISSIONS.enabled)}
                            title="Reset to default"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reset All Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetAllPermissions}
                    className="w-full"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />
                    Reset All to Defaults
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Operation History Settings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <Label className="text-base font-semibold">
                    Operation History
                  </Label>
                </div>
                <div className="space-y-4">
                  {/* History Stats */}
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{historyStats.total}</div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                      <div>
                        <div className="font-semibold text-blue-600">{historyStats.undoCount}</div>
                        <div className="text-muted-foreground">Undo</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">{historyStats.redoCount}</div>
                        <div className="text-muted-foreground">Redo</div>
                      </div>
                    </div>
                    {historyStats.total > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearOperationHistory}
                        className="w-full mt-3 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Clear History
                      </Button>
                    )}
                  </div>

                  {/* Enable History */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="history-enabled">Enable History Tracking</Label>
                      <p className="text-xs text-muted-foreground">
                        Record operations for undo/redo
                      </p>
                    </div>
                    <Switch
                      id="history-enabled"
                      checked={settings.operationHistory?.enabled ?? DEFAULT_OPERATION_HISTORY_SETTINGS.enabled}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          operationHistory: {
                            ...DEFAULT_OPERATION_HISTORY_SETTINGS,
                            ...settings.operationHistory,
                            enabled: checked,
                          },
                        })
                      }
                    />
                  </div>

                  {/* Auto Backup */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-backup">Auto-Backup on Delete</Label>
                      <p className="text-xs text-muted-foreground">
                        Create backups before destructive operations
                      </p>
                    </div>
                    <Switch
                      id="auto-backup"
                      checked={settings.operationHistory?.autoBackup ?? DEFAULT_OPERATION_HISTORY_SETTINGS.autoBackup}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          operationHistory: {
                            ...DEFAULT_OPERATION_HISTORY_SETTINGS,
                            ...settings.operationHistory,
                            autoBackup: checked,
                          },
                        })
                      }
                      disabled={!(settings.operationHistory?.enabled ?? DEFAULT_OPERATION_HISTORY_SETTINGS.enabled)}
                    />
                  </div>

                  {/* Persist History */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="persist-history">Persist History</Label>
                      <p className="text-xs text-muted-foreground">
                        Save history across sessions
                      </p>
                    </div>
                    <Switch
                      id="persist-history"
                      checked={settings.operationHistory?.persistHistory ?? DEFAULT_OPERATION_HISTORY_SETTINGS.persistHistory}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          operationHistory: {
                            ...DEFAULT_OPERATION_HISTORY_SETTINGS,
                            ...settings.operationHistory,
                            persistHistory: checked,
                          },
                        })
                      }
                      disabled={!(settings.operationHistory?.enabled ?? DEFAULT_OPERATION_HISTORY_SETTINGS.enabled)}
                    />
                  </div>

                  {/* Max History Size */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="history-size">History Size</Label>
                      <span className="text-sm text-muted-foreground">
                        {settings.operationHistory?.maxHistorySize ?? DEFAULT_OPERATION_HISTORY_SETTINGS.maxHistorySize} operations
                      </span>
                    </div>
                    <Slider
                      id="history-size"
                      min={10}
                      max={200}
                      step={10}
                      value={[settings.operationHistory?.maxHistorySize ?? DEFAULT_OPERATION_HISTORY_SETTINGS.maxHistorySize]}
                      onValueChange={(value) =>
                        onUpdate({
                          operationHistory: {
                            ...DEFAULT_OPERATION_HISTORY_SETTINGS,
                            ...settings.operationHistory,
                            maxHistorySize: value[0],
                          },
                        })
                      }
                      disabled={!(settings.operationHistory?.enabled ?? DEFAULT_OPERATION_HISTORY_SETTINGS.enabled)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum number of operations to remember
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Audit Logging Settings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <Label className="text-base font-semibold">
                    Audit Logging
                  </Label>
                </div>
                <div className="space-y-4">
                  {/* Audit Stats */}
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{auditStats.totalEntries}</div>
                        <div className="text-muted-foreground">Entries</div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-600">{auditStats.errorCount}</div>
                        <div className="text-muted-foreground">Errors</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">{auditStats.successRate.toFixed(0)}%</div>
                        <div className="text-muted-foreground">Success</div>
                      </div>
                    </div>
                    {auditStats.totalEntries > 0 && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportAuditLogs('json')}
                          className="flex-1"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Export
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearAuditLogs}
                          className="flex-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Enable Audit Logging */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="audit-enabled">Enable Audit Logging</Label>
                      <p className="text-xs text-muted-foreground">
                        Track all AI operations for compliance
                      </p>
                    </div>
                    <Switch
                      id="audit-enabled"
                      checked={settings.auditLog?.enabled ?? DEFAULT_AUDIT_LOG_SETTINGS.enabled}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          auditLog: {
                            ...DEFAULT_AUDIT_LOG_SETTINGS,
                            ...settings.auditLog,
                            enabled: checked,
                          },
                        })
                      }
                    />
                  </div>

                  {/* Log Level */}
                  <div>
                    <Label htmlFor="log-level">Minimum Log Level</Label>
                    <Select
                      value={settings.auditLog?.logLevel ?? DEFAULT_AUDIT_LOG_SETTINGS.logLevel}
                      onValueChange={(value) =>
                        onUpdate({
                          auditLog: {
                            ...DEFAULT_AUDIT_LOG_SETTINGS,
                            ...settings.auditLog,
                            logLevel: value as AuditLogLevel,
                          },
                        })
                      }
                      disabled={!(settings.auditLog?.enabled ?? DEFAULT_AUDIT_LOG_SETTINGS.enabled)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debug">Debug (all)</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="critical">Critical only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Persist Logs */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="persist-audit">Persist Logs</Label>
                      <p className="text-xs text-muted-foreground">
                        Save logs across sessions
                      </p>
                    </div>
                    <Switch
                      id="persist-audit"
                      checked={settings.auditLog?.persistLogs ?? DEFAULT_AUDIT_LOG_SETTINGS.persistLogs}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          auditLog: {
                            ...DEFAULT_AUDIT_LOG_SETTINGS,
                            ...settings.auditLog,
                            persistLogs: checked,
                          },
                        })
                      }
                      disabled={!(settings.auditLog?.enabled ?? DEFAULT_AUDIT_LOG_SETTINGS.enabled)}
                    />
                  </div>

                  {/* Privacy Settings */}
                  <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      {settings.auditLog?.includeUserPrompts ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                      Privacy Options
                    </Label>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-args" className="text-sm">Include Tool Arguments</Label>
                      <Switch
                        id="include-args"
                        checked={settings.auditLog?.includeArguments ?? DEFAULT_AUDIT_LOG_SETTINGS.includeArguments}
                        onCheckedChange={(checked) =>
                          onUpdate({
                            auditLog: {
                              ...DEFAULT_AUDIT_LOG_SETTINGS,
                              ...settings.auditLog,
                              includeArguments: checked,
                            },
                          })
                        }
                        disabled={!(settings.auditLog?.enabled ?? DEFAULT_AUDIT_LOG_SETTINGS.enabled)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-paths" className="text-sm">Include File Paths</Label>
                      <Switch
                        id="include-paths"
                        checked={settings.auditLog?.includeFilePaths ?? DEFAULT_AUDIT_LOG_SETTINGS.includeFilePaths}
                        onCheckedChange={(checked) =>
                          onUpdate({
                            auditLog: {
                              ...DEFAULT_AUDIT_LOG_SETTINGS,
                              ...settings.auditLog,
                              includeFilePaths: checked,
                            },
                          })
                        }
                        disabled={!(settings.auditLog?.enabled ?? DEFAULT_AUDIT_LOG_SETTINGS.enabled)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-prompts" className="text-sm">Include User Prompts</Label>
                      <Switch
                        id="include-prompts"
                        checked={settings.auditLog?.includeUserPrompts ?? DEFAULT_AUDIT_LOG_SETTINGS.includeUserPrompts}
                        onCheckedChange={(checked) =>
                          onUpdate({
                            auditLog: {
                              ...DEFAULT_AUDIT_LOG_SETTINGS,
                              ...settings.auditLog,
                              includeUserPrompts: checked,
                            },
                          })
                        }
                        disabled={!(settings.auditLog?.enabled ?? DEFAULT_AUDIT_LOG_SETTINGS.enabled)}
                      />
                    </div>
                  </div>

                  {/* Max Entries */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="max-audit-entries">Max Log Entries</Label>
                      <span className="text-sm text-muted-foreground">
                        {settings.auditLog?.maxEntries ?? DEFAULT_AUDIT_LOG_SETTINGS.maxEntries}
                      </span>
                    </div>
                    <Slider
                      id="max-audit-entries"
                      min={100}
                      max={5000}
                      step={100}
                      value={[settings.auditLog?.maxEntries ?? DEFAULT_AUDIT_LOG_SETTINGS.maxEntries]}
                      onValueChange={(value) =>
                        onUpdate({
                          auditLog: {
                            ...DEFAULT_AUDIT_LOG_SETTINGS,
                            ...settings.auditLog,
                            maxEntries: value[0],
                          },
                        })
                      }
                      disabled={!(settings.auditLog?.enabled ?? DEFAULT_AUDIT_LOG_SETTINGS.enabled)}
                      className="mt-2"
                    />
                  </div>

                  {/* Retention Days */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="retention-days">Retention Period</Label>
                      <span className="text-sm text-muted-foreground">
                        {(settings.auditLog?.retentionDays ?? DEFAULT_AUDIT_LOG_SETTINGS.retentionDays) === 0
                          ? "Unlimited"
                          : `${settings.auditLog?.retentionDays ?? DEFAULT_AUDIT_LOG_SETTINGS.retentionDays} days`}
                      </span>
                    </div>
                    <Slider
                      id="retention-days"
                      min={0}
                      max={365}
                      step={7}
                      value={[settings.auditLog?.retentionDays ?? DEFAULT_AUDIT_LOG_SETTINGS.retentionDays]}
                      onValueChange={(value) =>
                        onUpdate({
                          auditLog: {
                            ...DEFAULT_AUDIT_LOG_SETTINGS,
                            ...settings.auditLog,
                            retentionDays: value[0],
                          },
                        })
                      }
                      disabled={!(settings.auditLog?.enabled ?? DEFAULT_AUDIT_LOG_SETTINGS.enabled)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      0 = keep logs indefinitely
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Workflow Templates Settings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <Label className="text-base font-semibold">
                    Workflow Templates
                  </Label>
                </div>
                <div className="space-y-4">
                  {/* Workflow Stats */}
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{workflowStats.total}</div>
                        <div className="text-muted-foreground">Workflows</div>
                      </div>
                      <div>
                        <div className="font-semibold text-yellow-600">{workflowStats.favorites}</div>
                        <div className="text-muted-foreground">Favorites</div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600">{workflowStats.totalRuns}</div>
                        <div className="text-muted-foreground">Total Runs</div>
                      </div>
                    </div>
                    {workflowStats.total > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportWorkflows}
                        className="w-full mt-3"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Export Workflows
                      </Button>
                    )}
                  </div>

                  {/* Enable Workflows */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="workflows-enabled">Enable Workflows</Label>
                      <p className="text-xs text-muted-foreground">
                        Use workflow templates for automation
                      </p>
                    </div>
                    <Switch
                      id="workflows-enabled"
                      checked={settings.workflows?.enabled ?? DEFAULT_WORKFLOW_SETTINGS.enabled}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          workflows: {
                            ...DEFAULT_WORKFLOW_SETTINGS,
                            ...settings.workflows,
                            enabled: checked,
                          },
                        })
                      }
                    />
                  </div>

                  {/* Show Suggestions */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-suggestions">Show Suggestions</Label>
                      <p className="text-xs text-muted-foreground">
                        Suggest workflows in AI chat
                      </p>
                    </div>
                    <Switch
                      id="show-suggestions"
                      checked={settings.workflows?.showSuggestions ?? DEFAULT_WORKFLOW_SETTINGS.showSuggestions}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          workflows: {
                            ...DEFAULT_WORKFLOW_SETTINGS,
                            ...settings.workflows,
                            showSuggestions: checked,
                          },
                        })
                      }
                      disabled={!(settings.workflows?.enabled ?? DEFAULT_WORKFLOW_SETTINGS.enabled)}
                    />
                  </div>

                  {/* Persist Workflows */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="persist-workflows">Persist Workflows</Label>
                      <p className="text-xs text-muted-foreground">
                        Save workflows across sessions
                      </p>
                    </div>
                    <Switch
                      id="persist-workflows"
                      checked={settings.workflows?.persistWorkflows ?? DEFAULT_WORKFLOW_SETTINGS.persistWorkflows}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          workflows: {
                            ...DEFAULT_WORKFLOW_SETTINGS,
                            ...settings.workflows,
                            persistWorkflows: checked,
                          },
                        })
                      }
                      disabled={!(settings.workflows?.enabled ?? DEFAULT_WORKFLOW_SETTINGS.enabled)}
                    />
                  </div>

                  {/* Auto-save Repeated Operations */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-save-repeated">Auto-save Repeated</Label>
                      <p className="text-xs text-muted-foreground">
                        Suggest saving repeated operations
                      </p>
                    </div>
                    <Switch
                      id="auto-save-repeated"
                      checked={settings.workflows?.autoSaveRepeated ?? DEFAULT_WORKFLOW_SETTINGS.autoSaveRepeated}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          workflows: {
                            ...DEFAULT_WORKFLOW_SETTINGS,
                            ...settings.workflows,
                            autoSaveRepeated: checked,
                          },
                        })
                      }
                      disabled={!(settings.workflows?.enabled ?? DEFAULT_WORKFLOW_SETTINGS.enabled)}
                    />
                  </div>

                  {/* Max Workflows */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="max-workflows">Max Workflows</Label>
                      <span className="text-sm text-muted-foreground">
                        {settings.workflows?.maxWorkflows ?? DEFAULT_WORKFLOW_SETTINGS.maxWorkflows}
                      </span>
                    </div>
                    <Slider
                      id="max-workflows"
                      min={10}
                      max={200}
                      step={10}
                      value={[settings.workflows?.maxWorkflows ?? DEFAULT_WORKFLOW_SETTINGS.maxWorkflows]}
                      onValueChange={(value) =>
                        onUpdate({
                          workflows: {
                            ...DEFAULT_WORKFLOW_SETTINGS,
                            ...settings.workflows,
                            maxWorkflows: value[0],
                          },
                        })
                      }
                      disabled={!(settings.workflows?.enabled ?? DEFAULT_WORKFLOW_SETTINGS.enabled)}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum workflow templates to store
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Excluded Folders */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FolderX className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <Label className="text-base font-semibold">
                    Excluded Folders
                  </Label>
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
                      Override the default instructions. Leave empty to use the
                      built-in optimized prompt.
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
                          className={`p-3 rounded-lg text-xs ${
                            keyTestResult.valid
                              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {keyTestResult.valid ? (
                              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            )}
                            <span className="font-medium">{keyTestResult.message}</span>
                          </div>
                          {/* Show troubleshooting tips when connection fails */}
                          {!keyTestResult.valid && (
                            <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800 space-y-2">
                              <p className="font-medium">Troubleshooting:</p>
                              <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300">
                                <li>Make sure Ollama is installed and running</li>
                                <li>Check if the Ollama app is in your menu bar (macOS)</li>
                                <li>Try running <code className="bg-red-100 dark:bg-red-900 px-1 rounded">ollama serve</code> in terminal</li>
                                <li>Verify the base URL is correct (default: localhost:11434)</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Quick Setup Guide */}
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Quick Setup Guide
                        </p>
                        <ol className="text-xs text-muted-foreground space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</span>
                            <span>
                              Download from{" "}
                              <a
                                href="https://ollama.com/download"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                ollama.com/download
                              </a>
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</span>
                            <span>Install and launch Ollama</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</span>
                            <span>
                              Pull a model in terminal:{" "}
                              <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">
                                ollama pull llama3.2:3b
                              </code>
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">4</span>
                            <span>Click "Test Connection" above</span>
                          </li>
                        </ol>
                        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-600">
                          <p className="text-xs text-muted-foreground">
                            <strong>Recommended models:</strong> llama3.2:3b (fast), llama3.1:8b (balanced), qwen2.5:14b (powerful)
                          </p>
                        </div>
                      </div>
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
