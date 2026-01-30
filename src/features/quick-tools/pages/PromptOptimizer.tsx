/**
 * File: src/features/quick-tools/pages/PromptOptimizer.tsx
 *
 * Frontend: Prompt Optimizer quick tool.
 * Lets users refine prompts via templates or AI-powered improvement using the app's configured provider.
 * Provider and model can be changed directly on this page (synced with Chat settings).
 */

import React, { useState, useCallback, useEffect } from "react";
import { Sparkles, Copy, CheckCircle, Wand2, Loader2, Bot, Server, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/features/chat/contexts/ChatContext";
import { improvePromptWithAI } from "@/features/ai-assistant/utils/aiService";
import { listOllamaModels } from "@/features/ai-assistant/utils/ollamaService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  OPENROUTER_POPULAR_MODELS,
  DEFAULT_OPENROUTER_SETTINGS,
} from "@/features/ai-assistant/types";
import type { AISettings } from "@/features/ai-assistant/types";

const PROMPT_TEMPLATES = [
  {
    id: "clarify",
    name: "Add Clarity",
    prefix: "Please provide a clear and detailed response to the following:\n\n",
    suffix: "\n\nBreak down your answer into clear, logical steps.",
  },
  {
    id: "expert",
    name: "Expert Mode",
    prefix: "You are an expert in this field. ",
    suffix: "\n\nProvide a professional, in-depth analysis with specific examples.",
  },
  {
    id: "step-by-step",
    name: "Step-by-Step",
    prefix: "Walk me through this step-by-step:\n\n",
    suffix: "\n\nNumber each step clearly.",
  },
  {
    id: "examples",
    name: "With Examples",
    prefix: "",
    suffix: "\n\nPlease include relevant examples to illustrate your points.",
  },
  {
    id: "concise",
    name: "Concise",
    prefix: "Be concise and to the point. ",
    suffix: "\n\nLimit your response to the essential information only.",
  },
  {
    id: "eli5",
    name: "Explain Simply",
    prefix: "Explain this in simple terms that anyone could understand:\n\n",
    suffix: "",
  },
];

const BEST_PRACTICES = [
  "Be specific about what you want",
  "Provide relevant context",
  "Specify the desired format",
  "Include examples when helpful",
  "Break complex requests into parts",
  "Define the role or persona if needed",
];

export const PromptOptimizer: React.FC = () => {
  const { settings, updateSettings } = useChatContext();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);

  const baseUrl = settings.ollamaBaseUrl || "http://localhost:11434";
  const currentOllamaModel = settings.ollamaModel || settings.model || "llama3.2:3b";

  /** Load Ollama model list when provider is Ollama. */
  const loadOllamaModels = useCallback(async () => {
    if (settings.provider !== "ollama") return;
    setIsLoadingOllamaModels(true);
    try {
      const models = await listOllamaModels(baseUrl);
      setOllamaModels(models);
    } catch {
      setOllamaModels([]);
    } finally {
      setIsLoadingOllamaModels(false);
    }
  }, [settings.provider, baseUrl]);

  useEffect(() => {
    if (settings.provider === "ollama") loadOllamaModels();
  }, [settings.provider, loadOllamaModels]);

  const handleProviderChange = (value: "ollama" | "anthropic" | "openrouter") => {
    updateSettings({ provider: value });
    setErrorMessage(null);
  };

  const handleOllamaBaseUrlChange = (value: string) => {
    updateSettings({ ollamaBaseUrl: value || undefined });
  };

  const handleOllamaModelChange = (value: string) => {
    updateSettings({ ollamaModel: value, model: value });
  };

  const handleAnthropicModelChange = (value: string) => {
    updateSettings({ model: value as AISettings["model"] });
  };

  const handleOpenRouterModelChange = (value: string) => {
    updateSettings({
      openRouter: {
        ...DEFAULT_OPENROUTER_SETTINGS,
        ...settings.openRouter,
        model: value,
      },
    });
  };

  const applyTemplate = (templateId: string) => {
    const template = PROMPT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);
    setErrorMessage(null);
    const optimized = `${template.prefix}${input}${template.suffix}`.trim();
    setOutput(optimized);
  };

  /** Calls the configured AI provider to improve the user's prompt and sets the result in output. */
  const handleImproveWithAI = useCallback(async () => {
    if (!input.trim()) return;
    setIsImproving(true);
    setErrorMessage(null);
    try {
      const improved = await improvePromptWithAI(input, settings);
      setSelectedTemplate(null);
      setOutput(improved);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to improve prompt.";
      setErrorMessage(message);
    } finally {
      setIsImproving(false);
    }
  }, [input, settings]);

  const copyOutput = () => {
    navigator.clipboard.writeText(output || input);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
          <Wand2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Prompt Optimizer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enhance your prompts for better AI responses
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-0">
        {/* Input Column */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
            <label className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Your Prompt
            </label>
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="Enter your prompt here..."
              className="flex-1 w-full resize-none rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:bg-slate-950 dark:text-slate-300"
            />
          </div>

          {/* AI provider and model: change from this page (synced with Chat settings) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                AI provider & model
              </label>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="prompt-optimizer-provider" className="text-xs text-slate-600 dark:text-slate-400">
                  Provider
                </Label>
                <Select
                  value={settings.provider}
                  onValueChange={(value) => handleProviderChange(value as "ollama" | "anthropic" | "openrouter")}
                >
                  <SelectTrigger id="prompt-optimizer-provider" className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.provider === "ollama" && (
                <>
                  <div>
                    <Label htmlFor="prompt-optimizer-ollama-url" className="text-xs text-slate-600 dark:text-slate-400">
                      Base URL
                    </Label>
                    <Input
                      id="prompt-optimizer-ollama-url"
                      value={baseUrl}
                      onChange={(e) => handleOllamaBaseUrlChange(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="mt-1 h-8 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label htmlFor="prompt-optimizer-ollama-model" className="text-xs text-slate-600 dark:text-slate-400">
                        Model
                      </Label>
                      <button
                        type="button"
                        onClick={loadOllamaModels}
                        disabled={isLoadingOllamaModels}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <RefreshCw className={cn("h-3 w-3", isLoadingOllamaModels && "animate-spin")} />
                        Refresh
                      </button>
                    </div>
                    {isLoadingOllamaModels ? (
                      <div className="flex h-8 items-center text-xs text-slate-500 dark:text-slate-400">
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Loading models…
                      </div>
                    ) : ollamaModels.length > 0 ? (
                      <Select value={currentOllamaModel} onValueChange={handleOllamaModelChange}>
                        <SelectTrigger id="prompt-optimizer-ollama-model" className="mt-0 h-8 w-full text-xs">
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
                        id="prompt-optimizer-ollama-model"
                        value={currentOllamaModel}
                        onChange={(e) => handleOllamaModelChange(e.target.value)}
                        placeholder="llama3.2:3b"
                        className="h-8 font-mono text-xs"
                      />
                    )}
                  </div>
                </>
              )}

              {settings.provider === "anthropic" && (
                <div>
                  <Label htmlFor="prompt-optimizer-anthropic-model" className="text-xs text-slate-600 dark:text-slate-400">
                    Model
                  </Label>
                  <Select value={settings.model} onValueChange={handleAnthropicModelChange}>
                    <SelectTrigger id="prompt-optimizer-anthropic-model" className="mt-1 h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-sonnet">Claude Sonnet 4.5</SelectItem>
                      <SelectItem value="claude-opus">Claude Opus 4.5</SelectItem>
                      <SelectItem value="claude-haiku">Claude Haiku 4.5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {settings.provider === "openrouter" && (
                <div>
                  <Label htmlFor="prompt-optimizer-openrouter-model" className="text-xs text-slate-600 dark:text-slate-400">
                    Model
                  </Label>
                  <Select
                    value={settings.openRouter?.model ?? DEFAULT_OPENROUTER_SETTINGS.model}
                    onValueChange={handleOpenRouterModelChange}
                  >
                    <SelectTrigger id="prompt-optimizer-openrouter-model" className="mt-1 h-8 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENROUTER_POPULAR_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Templates and AI improvement */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Enhancement Templates
            </label>
            {/* Improve with AI: uses configured Chat provider (Ollama / Anthropic / OpenRouter) */}
            <div className="mb-3">
              <button
                type="button"
                onClick={handleImproveWithAI}
                disabled={!input.trim() || isImproving}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  "bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  !input.trim() && "opacity-50 cursor-not-allowed"
                )}
              >
                {isImproving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Improving…
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" aria-hidden />
                    Improve with AI
                  </>
                )}
              </button>
              {errorMessage && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errorMessage}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PROMPT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  disabled={!input.trim()}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedTemplate === template.id
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700",
                    !input.trim() && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output Column */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                Optimized Prompt
              </label>
              <button
                onClick={copyOutput}
                disabled={!output && !input}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded-lg bg-purple-50/50 p-4 dark:bg-purple-900/10">
              <pre className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 font-sans">
                {output || input || "// Your optimized prompt will appear here"}
              </pre>
            </div>
          </div>

          {/* Best Practices */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Best Practices
            </label>
            <ul className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
              {BEST_PRACTICES.map((practice, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Sparkles className="h-3 w-3 mt-0.5 text-purple-400 shrink-0" />
                  <span>{practice}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
