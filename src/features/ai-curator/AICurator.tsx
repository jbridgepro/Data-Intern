import { useState, useEffect } from 'react';
import { Sparkles, FolderOpen, Play, StopCircle, History, Settings as SettingsIcon, BarChart3, RefreshCw, Bell, X, Cpu, Globe, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAICurator } from './hooks/useAICurator';
import { CurationResults } from './components/CurationResults';
import { MODE_DESCRIPTIONS, SERVICE_PROMPTS, type ServiceType, type CurationMode } from './types';
import { OPENROUTER_POPULAR_MODELS } from '@/features/ai-assistant/types';
import { getProviderDisplayName, formatContextLength, formatModelPricing } from '@/features/ai-assistant/utils/openRouterService';
import { listOllamaModels } from '@/features/ai-assistant/utils/ollamaService';
import { convertFileSrc } from '@tauri-apps/api/core';

const serviceTypeOptions: { value: ServiceType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'portrait_photography', label: 'Portrait Photography' },
  { value: 'event_documentary', label: 'Event / Documentary' },
  { value: 'real_estate_property', label: 'Real Estate / Property' },
  { value: 'product_photography', label: 'Product Photography' },
  { value: 'brand_commercial', label: 'Brand / Commercial' },
  { value: 'video_production', label: 'Video Production' },
  { value: 'website_strategy', label: 'Website / Strategy' },
];

function getAiAssistantSettings() {
  try {
    const saved = localStorage.getItem('ai-assistant-settings');
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function AICurator() {
  const {
    isRunning, progress, currentRun, pastRuns, settings, setSettings,
    auditLogs, notifications, unreadNotifCount,
    startCuration, cancel, loadRun, clearCurrent, applyResults, rerunSelected, recordStaffDecision, updateFileTags, markNotificationReadById,
  } = useAICurator();

  const [directory, setDirectory] = useState('');
  const [mode, setMode] = useState<CurationMode>(settings.defaultMode || 'smart_sort');
  const [serviceType, setServiceType] = useState<ServiceType>('general');
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState<{ current: number; total: number } | null>(null);
  const [directoryFiles, setDirectoryFiles] = useState<number>(0);
  const [newTagInput, setNewTagInput] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const loadThumbnail = async () => {
      if (!progress?.currentFilePath) {
        setThumbnailUrl(null);
        return;
      }

      if (/\.(jpe?g|png|webp|gif|heic|avif)$/i.test(progress.currentFilePath)) {
        try {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const data = await readFile(progress.currentFilePath);
          if (!active) return;
          const ext = progress.currentFilePath.split('.').pop()?.toLowerCase() || 'jpeg';
          const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
          const blob = new Blob([data], { type: mimeType });
          objectUrl = URL.createObjectURL(blob);
          setThumbnailUrl(objectUrl);
        } catch (err) {
          console.error('Failed to load thumbnail preview:', err);
          if (active) {
            setThumbnailUrl(convertFileSrc(progress.currentFilePath));
          }
        }
      } else {
        setThumbnailUrl(null);
      }
    };

    loadThumbnail();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [progress?.currentFilePath]);

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    const currentTags = settings.evaluationTags || [];
    if (currentTags.includes(trimmed)) return;
    setSettings({
      ...settings,
      evaluationTags: [...currentTags, trimmed]
    });
    setNewTagInput('');
  };

  const [customServices, setCustomServices] = useState<{ value: string; label: string; prompt: string }[]>(() => {
    try {
      const saved = localStorage.getItem('ai-curator-custom-services');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showManageServices, setShowManageServices] = useState(false);
  const [newServiceKey, setNewServiceKey] = useState('');
  const [newServiceLabel, setNewServiceLabel] = useState('');
  const [newServicePrompt, setNewServicePrompt] = useState('');

  const handleCreateCustomService = () => {
    if (!newServiceKey || !newServiceLabel || !newServicePrompt) return;
    if (customServices.some(s => s.value === newServiceKey) || serviceTypeOptions.some(s => s.value === newServiceKey)) {
      alert('This Service Type identifier already exists.');
      return;
    }
    const updated = [...customServices, { value: newServiceKey, label: newServiceLabel, prompt: newServicePrompt }];
    setCustomServices(updated);
    localStorage.setItem('ai-curator-custom-services', JSON.stringify(updated));
    setServiceType(newServiceKey);
    setNewServiceKey('');
    setNewServiceLabel('');
    setNewServicePrompt('');
  };

  const handleDeleteCustomService = (key: string) => {
    const updated = customServices.filter(s => s.value !== key);
    setCustomServices(updated);
    localStorage.setItem('ai-curator-custom-services', JSON.stringify(updated));
    if (serviceType === key) {
      setServiceType('general');
    }
  };

  const allServiceOptions = [
    ...serviceTypeOptions,
    ...customServices.map(cs => ({ value: cs.value, label: cs.label }))
  ];

  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ai-curator-custom-prompts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [showPromptEditor, setShowPromptEditor] = useState(false);

  const getServicePromptText = (type: string) => {
    if (customPrompts[type]) return customPrompts[type];
    const customService = customServices.find(s => s.value === type);
    if (customService) return customService.prompt;
    return SERVICE_PROMPTS[type] || '';
  };

  const [activePrompt, setActivePrompt] = useState(() => getServicePromptText(serviceType));

  useEffect(() => {
    setActivePrompt(getServicePromptText(serviceType));
  }, [serviceType, customPrompts, customServices]);

  const handleUpdatePrompt = (newVal: string) => {
    setActivePrompt(newVal);
    const isCustom = customServices.some(s => s.value === serviceType);
    if (isCustom) {
      const updated = customServices.map(s => s.value === serviceType ? { ...s, prompt: newVal } : s);
      setCustomServices(updated);
      localStorage.setItem('ai-curator-custom-services', JSON.stringify(updated));
    } else {
      const updated = { ...customPrompts, [serviceType]: newVal };
      setCustomPrompts(updated);
      localStorage.setItem('ai-curator-custom-prompts', JSON.stringify(updated));
    }
  };

  const handleResetPrompt = () => {
    const updated = { ...customPrompts };
    delete updated[serviceType];
    setCustomPrompts(updated);
    localStorage.setItem('ai-curator-custom-prompts', JSON.stringify(updated));
  };

  const isPromptModified = (() => {
    const defaultPreset = SERVICE_PROMPTS[serviceType];
    if (!defaultPreset) return false;
    return Boolean(customPrompts[serviceType] && customPrompts[serviceType] !== defaultPreset);
  })();

  const [showCustomInput, setShowCustomInput] = useState(() => {
    const provider = settings.provider || 'openrouter';
    if (!settings.preferredModel) return false;
    if (provider === 'openrouter') {
      return !OPENROUTER_POPULAR_MODELS.some(m => m.id === settings.preferredModel);
    }
    if (provider === 'anthropic') {
      return !['claude-sonnet', 'claude-opus', 'claude-haiku'].includes(settings.preferredModel);
    }
    return false;
  });

  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  const loadOllamaModels = async () => {
    setIsLoadingOllamaModels(true);
    setOllamaError(null);
    try {
      const assistantSettings = getAiAssistantSettings();
      const baseUrl = assistantSettings?.ollamaBaseUrl || 'http://localhost:11434';
      const models = await listOllamaModels(baseUrl);
      setOllamaModels(models);
    } catch (err: any) {
      console.error('Failed to load Ollama models:', err);
      setOllamaModels([]);
      setOllamaError(err.message || 'Failed to connect to Ollama');
    } finally {
      setIsLoadingOllamaModels(false);
    }
  };

  useEffect(() => {
    if (settings.provider === 'ollama') {
      loadOllamaModels();
    }
  }, [settings.provider]);

  useEffect(() => {
    if (settings.preferredModel) {
      const provider = settings.provider || 'openrouter';
      if (provider === 'openrouter') {
        const isPopular = OPENROUTER_POPULAR_MODELS.some(m => m.id === settings.preferredModel);
        setShowCustomInput(!isPopular);
      } else if (provider === 'anthropic') {
        const isPreset = ['claude-sonnet', 'claude-opus', 'claude-haiku'].includes(settings.preferredModel);
        setShowCustomInput(!isPreset);
      } else if (provider === 'ollama') {
        if (ollamaModels.length > 0) {
          const isPreset = ollamaModels.includes(settings.preferredModel);
          setShowCustomInput(!isPreset);
        }
      }
    }
  }, [settings.preferredModel, settings.provider, ollamaModels]);

  const handleSelectDirectory = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setDirectory(selected);
      }
    } catch (err) {
      console.error('Failed to open directory picker:', err);
    }
  };

  const handleStart = () => {
    if (!directory || isRunning) return;
    clearCurrent();
    startCuration(directory, mode, serviceType);
  };

  const handleApplyResults = async (results: any[]) => {
    if (!directory || results.length === 0) return;
    setIsApplying(true);
    setApplyProgress({ current: 0, total: results.length });
    try {
      const result = await applyResults(results, directory);
      console.log(`[AI Curator] Applied: ${result.moved} files, errors: ${result.errors}`);
    } catch (err) {
      console.error('[AI Curator] Failed to apply results:', err);
    } finally {
      setIsApplying(false);
      setApplyProgress(null);
    }
  };

  const handleRerunSelected = async (assetIds: string[]) => {
    if (assetIds.length === 0) return;
    const updated = await rerunSelected(assetIds);
    if (updated) {
      clearCurrent();
    }
  };

  const modeInfo = MODE_DESCRIPTIONS[mode];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="AI Curator"
        subtitle="Analyze, score, and organize media files with AI-powered curation"
        icon={Sparkles}
        info={{
          overview: 'The AI Curator analyzes media files and scores them on quality, composition, subject quality, service fit, and deliverable readiness. Three curation modes let you balance speed, cost, and quality. Files are organized into suggested folders: Best Selects, Usable / Secondary, Needs Editing, Reject Candidates, and Duplicate Review.',
          steps: [
            'Select a directory containing media files to curate.',
            'Choose curation mode: Fast Sort (metadata), Smart Sort (automation + selective AI), or Deep AI Review (full AI analysis).',
            'Pick a service type to tailor prompts for your specific use case.',
            'Review the estimated cost and file breakdown before starting.',
            'Start curation and monitor progress. You can leave the page and come back.',
            'Review results in the dashboard. Approve, reject, or modify recommendations.',
            'Optionally apply the organization to copy files into structured folders.',
          ],
          examples: [
            'Curate a wedding gallery — best selects for album, secondaries for proofs, rejects for blurry shots.',
            'Organize real estate property photos — keep listing-ready images with bright exposure, flag duplicates.',
            'Review product photography batches — identify hero shots, detail images, and outtakes.',
          ],
        }}
      />

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {!currentRun && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Curation Settings</span>
                  <div className="flex items-center gap-2">
                    {unreadNotifCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setShowNotifications(!showNotifications)} className="relative">
                        <Bell className="h-4 w-4" />
                        {unreadNotifCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">
                            {unreadNotifCount}
                          </span>
                        )}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
                      <SettingsIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Source Directory</label>
                  <div className="flex gap-2">
                    <Input
                      value={directory}
                      onChange={(e) => setDirectory(e.target.value)}
                      placeholder="Select or type directory path..."
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={handleSelectDirectory} size="icon">
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Curation Mode</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.entries(MODE_DESCRIPTIONS) as [CurationMode, typeof modeInfo][]).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-colors',
                          mode === key
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-border hover:border-blue-300 hover:bg-accent'
                        )}
                      >
                        <div className="font-medium text-sm">{info.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{info.description}</div>
                        <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground">
                          <span>Speed: {info.speed}</span>
                          <span>Cost: {info.cost}</span>
                          <span>Quality: {info.quality}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium block">Service Type</label>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPromptEditor(!showPromptEditor)}
                          className="h-6 px-1.5 text-[10px]"
                        >
                          {showPromptEditor ? 'Hide Prompt' : 'Edit Prompt'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowManageServices(!showManageServices)}
                          className="h-6 px-1.5 text-[10px]"
                        >
                          {showManageServices ? 'Hide Custom' : 'Manage Custom'}
                        </Button>
                      </div>
                    </div>
                    <Select value={serviceType} onValueChange={(v) => {
                      setServiceType(v as ServiceType);
                      setActivePrompt(getServicePromptText(v));
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allServiceOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tailors AI prompts for the selected media type
                    </p>

                    {showPromptEditor && (
                      <div className="mt-2.5 p-3 border border-border rounded-lg bg-muted/40 space-y-2.5 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                            Prompt Template
                          </span>
                          {isPromptModified && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                              onClick={handleResetPrompt}
                            >
                              Reset to Default
                            </Button>
                          )}
                        </div>
                        <textarea
                          value={activePrompt}
                          onChange={(e) => handleUpdatePrompt(e.target.value)}
                          placeholder="Curation prompt template..."
                          className="w-full text-xs p-2 rounded-md border border-input bg-background min-h-[90px] max-h-48 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Custom prompts are automatically saved and used for curation.
                        </p>
                      </div>
                    )}

                    {showManageServices && (
                      <div className="mt-2.5 p-3 border border-border rounded-lg bg-muted/40 space-y-3">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          Manage Custom Services
                        </h4>

                        {/* List of Custom Services */}
                        {customServices.length > 0 && (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                            {customServices.map((cs) => (
                              <div key={cs.value} className="flex items-center justify-between p-1.5 bg-background border rounded text-xs">
                                <div className="min-w-0 flex-1 mr-2">
                                  <div className="font-semibold text-foreground truncate">{cs.label}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono truncate">{cs.value}</div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                                  onClick={() => handleDeleteCustomService(cs.value)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Form to Add New Service Type */}
                        <div className="space-y-2.5 pt-2 border-t">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground block">Unique Identifier</label>
                            <Input
                              value={newServiceKey}
                              onChange={(e) => setNewServiceKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                              placeholder="e.g. portrait_senior"
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground block">Display Label</label>
                            <Input
                              value={newServiceLabel}
                              onChange={(e) => setNewServiceLabel(e.target.value)}
                              placeholder="e.g. Senior Portraits"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground block">Curation Prompt</label>
                            <textarea
                              value={newServicePrompt}
                              onChange={(e) => setNewServicePrompt(e.target.value)}
                              placeholder="Describe instructions for the AI on how to score and sort files..."
                              className="w-full text-xs p-2 rounded-md border border-input bg-background min-h-[60px] max-h-32 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          </div>

                          <Button
                            size="sm"
                            className="w-full text-xs h-8"
                            onClick={handleCreateCustomService}
                            disabled={!newServiceKey || !newServiceLabel || !newServicePrompt}
                          >
                            Add Service Type
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Provider</label>
                    <Select
                      value={settings.provider || 'openrouter'}
                      onValueChange={(value) => {
                        const val = value as 'openrouter' | 'anthropic' | 'ollama';
                        let defaultModel = '';
                        if (val === 'openrouter') {
                          defaultModel = 'google/gemini-2.0-flash-001';
                        } else if (val === 'anthropic') {
                          defaultModel = 'claude-3-5-sonnet-20241022';
                        } else if (val === 'ollama') {
                          defaultModel = '';
                        }
                        setShowCustomInput(false);
                        setSettings({
                          ...settings,
                          provider: val,
                          preferredModel: defaultModel
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openrouter">OpenRouter (Multi-Model)</SelectItem>
                        <SelectItem value="anthropic">Anthropic Claude (Cloud)</SelectItem>
                        <SelectItem value="ollama">Ollama (Local LLM)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {settings.provider === 'ollama'
                        ? 'Uses local Ollama installation'
                        : settings.provider === 'anthropic'
                        ? 'Uses Anthropic Claude API'
                        : 'Access models via OpenRouter'}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium block">Model</label>
                      {settings.provider === 'ollama' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadOllamaModels}
                          disabled={isLoadingOllamaModels}
                          className="h-6 px-2 text-xs"
                        >
                          <RefreshCw
                            className={cn("h-3 w-3 mr-1", isLoadingOllamaModels && "animate-spin")}
                          />
                          Refresh
                        </Button>
                      )}
                    </div>

                    {settings.provider === 'ollama' && isLoadingOllamaModels ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground h-10 px-3 border border-input rounded-md bg-background">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span>Loading models...</span>
                      </div>
                    ) : (
                      <Select
                        value={showCustomInput ? 'custom' : settings.preferredModel}
                        onValueChange={(value) => {
                          if (value === 'custom') {
                            setShowCustomInput(true);
                          } else {
                            setShowCustomInput(false);
                            setSettings({ ...settings, preferredModel: value });
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={settings.provider === 'ollama' && ollamaModels.length === 0 ? "No models found" : "Select model..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {settings.provider === 'openrouter' && (
                            <>
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
                            </>
                          )}
                          {settings.provider === 'anthropic' && (
                            <>
                              <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                              <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                              <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                            </>
                          )}
                          {settings.provider === 'ollama' && (
                            <>
                              {ollamaModels.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          <SelectItem value="custom">Custom Model ID...</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {showCustomInput && (
                      <Input
                        value={settings.preferredModel}
                        onChange={(e) => setSettings({ ...settings, preferredModel: e.target.value })}
                        placeholder={
                          settings.provider === 'openrouter'
                            ? 'e.g. google/gemini-2.0-flash-001'
                            : settings.provider === 'anthropic'
                            ? 'e.g. claude-3-5-sonnet-20241022'
                            : 'e.g. llama3.2:3b'
                        }
                        className="text-sm mt-2 font-mono"
                      />
                    )}

                    {settings.provider === 'ollama' && ollamaError && (
                      <p className="text-xs text-red-500 mt-1">{ollamaError}</p>
                    )}

                    {!showCustomInput && settings.provider === 'openrouter' && (() => {
                      const selectedOpenRouterModel = OPENROUTER_POPULAR_MODELS.find(m => m.id === settings.preferredModel);
                      if (!selectedOpenRouterModel) return null;
                      return (
                        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs space-y-1">
                          <p className="text-muted-foreground">
                            {selectedOpenRouterModel.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
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
                      );
                    })()}

                    {!showCustomInput && settings.provider === 'anthropic' && (() => {
                      const details: Record<string, { desc: string; context: string; price: string }> = {
                        'claude-3-5-sonnet-20241022': {
                          desc: 'Most intelligent Claude model. Excellent for complex reasoning.',
                          context: '200k tokens',
                          price: '$3.00 / $15.00 per M tokens'
                        },
                        'claude-3-5-haiku-20241022': {
                          desc: 'Fastest and most cost-effective Claude model.',
                          context: '200k tokens',
                          price: '$0.80 / $4.00 per M tokens'
                        },
                        'claude-3-opus-20240229': {
                          desc: 'Powerful Claude model for highly complex tasks.',
                          context: '200k tokens',
                          price: '$15.00 / $75.00 per M tokens'
                        }
                      };
                      const selectedAnthropicModel = details[settings.preferredModel];
                      if (!selectedAnthropicModel) return null;
                      return (
                        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs space-y-1">
                          <p className="text-muted-foreground">
                            {selectedAnthropicModel.desc}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                              {selectedAnthropicModel.context} context
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            Pricing: {selectedAnthropicModel.price}
                          </p>
                        </div>
                      );
                    })()}

                    {!showCustomInput && settings.provider === 'ollama' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Runs locally on your device. Free and private.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={handleStart} disabled={!directory || isRunning} size="lg">
                    {isRunning ? (
                      <><StopCircle className="h-4 w-4 mr-1" /> Running...</>
                    ) : (
                      <><Play className="h-4 w-4 mr-1" /> Start {modeInfo.label}</>
                    )}
                  </Button>
                  {isRunning && (
                    <Button variant="destructive" size="sm" onClick={cancel}>
                      <StopCircle className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  )}
                </div>

                {showSettings && (
                  <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Batch Size</label>
                      <Input type="number" value={settings.maxBatchSize}
                        onChange={(e) => setSettings({ ...settings, maxBatchSize: Number(e.target.value) || 10 })}
                        min={1} max={50} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Confidence Threshold</label>
                      <Input type="number" value={settings.confidenceThreshold}
                        onChange={(e) => setSettings({ ...settings, confidenceThreshold: Number(e.target.value) || 70 })}
                        min={0} max={100} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Max AI Calls/Job</label>
                      <Input type="number" value={settings.maxAiCallsPerJob}
                        onChange={(e) => setSettings({ ...settings, maxAiCallsPerJob: Number(e.target.value) || 200 })}
                        min={1} max={10000} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Skip Duplicates</label>
                      <Select value={settings.skipAiForExactDuplicates ? 'true' : 'false'}
                        onValueChange={(v) => setSettings({ ...settings, skipAiForExactDuplicates: v === 'true' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Enabled</SelectItem>
                          <SelectItem value="false">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Skip Low Res</label>
                      <Select value={settings.skipAiForLowResolution ? 'true' : 'false'}
                        onValueChange={(v) => setSettings({ ...settings, skipAiForLowResolution: v === 'true' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Enabled</SelectItem>
                          <SelectItem value="false">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Notifications</label>
                      <Select value={settings.enableNotifications ? 'true' : 'false'}
                        onValueChange={(v) => setSettings({ ...settings, enableNotifications: v === 'true' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Enabled</SelectItem>
                          <SelectItem value="false">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">File Size Limit (MB)</label>
                      <Input type="number"
                        value={settings.fileSizeLimitBytes / (1024 * 1024)}
                        onChange={(e) => setSettings({ ...settings, fileSizeLimitBytes: (Number(e.target.value) || 20) * 1024 * 1024 })}
                        min={1} max={1000} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Monthly AI Budget ($)</label>
                      <Input type="number"
                        value={settings.monthlyAiBudgetCents / 100}
                        onChange={(e) => setSettings({ ...settings, monthlyAiBudgetCents: (Number(e.target.value) || 500) * 100 })}
                        min={0} max={100000} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Default Mode</label>
                      <Select value={settings.defaultMode}
                        onValueChange={(v) => setSettings({ ...settings, defaultMode: v as CurationMode })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fast_sort">Fast Sort</SelectItem>
                          <SelectItem value="smart_sort">Smart Sort</SelectItem>
                          <SelectItem value="deep_ai_review">Deep AI Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-3">
                      <Separator className="my-2" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Classification Score Thresholds</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-medium mb-1 block">Best Selects Threshold</label>
                          <Input type="number" value={settings.bestSelectsThreshold ?? 70}
                            onChange={(e) => setSettings({ ...settings, bestSelectsThreshold: Number(e.target.value) })}
                            min={0} max={100} />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Usable Secondary Threshold</label>
                          <Input type="number" value={settings.usableSecondaryThreshold ?? 40}
                            onChange={(e) => setSettings({ ...settings, usableSecondaryThreshold: Number(e.target.value) })}
                            min={0} max={100} />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Needs Editing Threshold</label>
                          <Input type="number" value={settings.needsEditingThreshold ?? 20}
                            onChange={(e) => setSettings({ ...settings, needsEditingThreshold: Number(e.target.value) })}
                            min={0} max={100} />
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3 space-y-2">
                      <Separator className="my-2" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dynamic Curation Tags</h4>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Configure target tags that the AI should evaluate and apply to media files during review.
                      </p>
                      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[60px] bg-background">
                        {(settings.evaluationTags || []).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1">
                            {tag}
                            <button
                              onClick={() => {
                                const updatedTags = (settings.evaluationTags || []).filter(t => t !== tag);
                                setSettings({ ...settings, evaluationTags: updatedTags });
                              }}
                              className="text-muted-foreground hover:text-foreground focus:outline-none"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                        {(settings.evaluationTags || []).length === 0 && (
                          <span className="text-xs text-muted-foreground italic p-1">No tags configured</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add custom tag (e.g. action, portrait)..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          className="h-8 text-xs"
                        />
                        <Button size="sm" onClick={handleAddTag} className="h-8 text-xs shrink-0">
                          Add Tag
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {showNotifications && (
                  <Card className="border-amber-200 dark:border-amber-800">
                    <CardHeader className="pb-2 py-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>Notifications ({notifications.length})</span>
                        <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 py-2">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No notifications</p>
                      ) : (
                        <ScrollArea className="max-h-40">
                          {notifications.slice(0, 10).map((n) => (
                            <div key={n.id}
                              onClick={() => markNotificationReadById(n.id)}
                              className={cn('flex items-start gap-2 py-1.5 px-2 rounded cursor-pointer text-xs hover:bg-accent',
                                n.status !== 'read' ? 'bg-blue-50 dark:bg-blue-900/10' : '')}
                            >
                              <Badge variant={n.status === 'read' ? 'outline' : 'default'} className="text-[8px] mt-0.5">
                                {n.type}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{n.title}</div>
                                <div className="text-muted-foreground truncate">{n.message}</div>
                              </div>
                            </div>
                          ))}
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {pastRuns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Past Curation Runs
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6">
                  <ScrollArea className="max-h-48">
                    {pastRuns.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => loadRun(run.id)}
                        className="flex items-center gap-3 w-full text-left py-2 px-3 rounded-lg hover:bg-accent transition-colors text-sm"
                      >
                        <Badge variant={run.status === 'ready_for_review' ? 'default' : 'secondary'} className="text-[10px]">
                          {run.currentStage || run.status}
                        </Badge>
                        <span className="flex-1 truncate">{run.sourceDirectory}</span>
                        <span className="text-xs text-muted-foreground">{run.totalFiles} files</span>
                        <span className="text-xs text-muted-foreground">{run.mode.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {isRunning && progress && (
          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md bg-card/60 backdrop-blur-md">
            <CardContent className="p-4 flex gap-4 items-center">
              {/* Thumbnail Preview Area */}
              {thumbnailUrl ? (
                <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border flex-shrink-0 bg-accent shadow-sm flex items-center justify-center">
                  <img
                    src={thumbnailUrl}
                    alt="Analyzing preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-md border border-border flex-shrink-0 bg-accent flex items-center justify-center text-muted-foreground shadow-sm">
                  <Sparkles className="h-6 w-6 animate-pulse text-blue-500" />
                </div>
              )}

              {/* Progress Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Analyzing file...
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {progress.processed} / {progress.total} ({progress.percent}%)
                  </span>
                </div>
                <div className="text-sm font-medium truncate mb-1.5 text-foreground flex items-center gap-1.5">
                  <span className="font-mono text-xs max-w-xs truncate">{progress.currentFile}</span>
                </div>
                <Progress value={progress.percent} className="h-2 bg-slate-100 dark:bg-slate-800" />
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {progress.stage}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentRun && !isRunning && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={clearCurrent}>
                <BarChart3 className="h-4 w-4 mr-1" /> New Curation
              </Button>
              <span className="text-xs text-muted-foreground">
                Mode: {currentRun.mode.replace(/_/g, ' ')} | Directory: {currentRun.sourceDirectory}
              </span>
            </div>

            <CurationResults
              run={currentRun}
              onApplyResults={handleApplyResults}
              isApplying={isApplying}
              applyProgress={applyProgress}
              onStaffDecision={recordStaffDecision}
              onRerunSelected={handleRerunSelected}
              onUpdateTags={updateFileTags}
            />
          </div>
        )}
      </div>
    </div>
  );
}
