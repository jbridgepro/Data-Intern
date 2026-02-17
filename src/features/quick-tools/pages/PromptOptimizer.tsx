/**
 * File: src/features/quick-tools/pages/PromptOptimizer.tsx
 *
 * Frontend: Prompt Optimizer quick tool.
 * Lets users refine prompts via templates or AI-powered improvement using the app's configured provider.
 * Supports voice input via Web Speech API (Voice button) and Record & Transcribe fallback
 * (works when Web Speech fails, e.g. Safari/WebKit in Tauri). Provider and model configurable on this page.
 *
 * Layout follows the compact two-panel pattern used by other Quick Tools (SQL Formatter, etc.):
 *   - Slim header bar with icon + title
 *   - Compact toolbar with AI provider, model, and action buttons
 *   - Two-column split: left = input + templates, right = output + best practices
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  Sparkles,
  Copy,
  CheckCircle,
  Wand2,
  Loader2,
  Bot,
  Server,
  RefreshCw,
  Mic,
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useRecordAndTranscribe } from "@/hooks/useRecordAndTranscribe";
import {
  OPENROUTER_POPULAR_MODELS,
  DEFAULT_OPENROUTER_SETTINGS,
} from "@/features/ai-assistant/types";
import type { AISettings } from "@/features/ai-assistant/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PROMPT_TEMPLATES = [
  {
    id: "clarify",
    name: "Add Clarity",
    prefix:
      "Please provide a clear and detailed response to the following:\n\n",
    suffix: "\n\nBreak down your answer into clear, logical steps.",
  },
  {
    id: "expert",
    name: "Expert Mode",
    prefix: "You are an expert in this field. ",
    suffix:
      "\n\nProvide a professional, in-depth analysis with specific examples.",
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
  {
    id: "code",
    name: "Code-focused",
    prefix: "Provide well-structured, production-ready code with comments:\n\n",
    suffix: "\n\nInclude error handling and best practices.",
  },
  {
    id: "creative",
    name: "Creative",
    prefix: "Use a creative, engaging tone. ",
    suffix: "\n\nMake the response vivid and memorable.",
  },
  {
    id: "structured",
    name: "Structured Output",
    prefix: "",
    suffix:
      "\n\nRespond in a clear structure (e.g., bullet points, numbered list, or JSON if applicable).",
  },
];

/** Example prompts for quick start; user can click to populate input. */
const EXAMPLE_PROMPTS = [
  "Explain how React hooks work",
  "Write a Python function to validate email",
  "Summarize the key benefits of TypeScript",
  "Draft a professional email declining a meeting",
];

const BEST_PRACTICES = [
  "Be specific about what you want",
  "Provide relevant context",
  "Specify the desired format",
  "Include examples when helpful",
  "Break complex requests into parts",
  "Define the role or persona if needed",
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
  const [showProviderSettings, setShowProviderSettings] = useState(false);

  /** Voice input (Web Speech API): append transcribed text when recognition ends. */
  const {
    isListening: isVoiceListening,
    interimTranscript: voiceInterim,
    toggleListening: toggleVoiceListening,
    isSupported: isVoiceSupported,
    error: voiceError,
  } = useSpeechRecognition({
    onResult: (text) =>
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text)),
    lang: "en-US",
    continuous: true,
  });

  /** Record & transcribe fallback: works when Web Speech API fails (e.g. Safari/Tauri). */
  const {
    startRecording,
    stopRecording,
    isRecording,
    isTranscribing,
    error: recordError,
    isAvailable: recordAvailable,
  } = useRecordAndTranscribe({
    onTranscript: (text) =>
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text)),
  });

  const baseUrl = settings.ollamaBaseUrl || "http://localhost:11434";
  const currentOllamaModel =
    settings.ollamaModel || settings.model || "llama3.2:3b";

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

  /* ---- Handler functions ------------------------------------------ */

  const handleProviderChange = (
    value: "ollama" | "anthropic" | "openrouter",
  ) => {
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
      const message =
        err instanceof Error ? err.message : "Failed to improve prompt.";
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

  /** Move optimized prompt back to input for further iteration. */
  const useOutputAsInput = () => {
    const text = output || input;
    if (!text.trim()) return;
    setInput(text);
    setOutput("");
    setSelectedTemplate(null);
    setErrorMessage(null);
  };

  /** Clear input and reset output state. */
  const clearInput = () => {
    setInput("");
    setOutput("");
    setSelectedTemplate(null);
    setErrorMessage(null);
  };

  const inputWordCount = input.trim() ? input.trim().split(/\s+/).length : 0;
  const inputCharCount = input.length;

  /** Human-readable provider label for the toolbar. */
  const providerLabel =
    settings.provider === "ollama"
      ? "Ollama"
      : settings.provider === "anthropic"
        ? "Claude"
        : "OpenRouter";

  /* ================================================================= */
  /*  RENDER                                                            */
  /* ================================================================= */

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ─── Compact Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Wand2 className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
          <span className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            Prompt Optimizer
          </span>
        </div>
        {/* Primary action: Improve with AI */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Voice input: Web Speech API (Chrome, etc.) */}
          {isVoiceSupported && (
            <Button
              size="sm"
              variant={isVoiceListening ? "destructive" : "outline"}
              className={cn(
                "h-7 gap-1 text-xs",
                isVoiceListening && "animate-pulse",
              )}
              onClick={toggleVoiceListening}
              title={isVoiceListening ? "Stop listening" : "Voice input (speech-to-text)"}
              aria-label={
                isVoiceListening ? "Stop voice input" : "Start voice input"
              }
            >
              <Mic className="h-3 w-3" />
              {isVoiceListening ? "Stop" : "Voice"}
            </Button>
          )}
          {/* Record & transcribe: fallback when Web Speech fails (Safari/Tauri) */}
          {recordAvailable && (
            <Button
              size="sm"
              variant={isRecording || isTranscribing ? "destructive" : "outline"}
              className={cn(
                "h-7 gap-1 text-xs",
                (isRecording || isTranscribing) && "animate-pulse",
              )}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              title={
                isRecording
                  ? "Stop recording"
                  : isTranscribing
                    ? "Transcribing..."
                    : "Record & transcribe"
              }
              aria-label={
                isRecording ? "Stop recording" : "Record and transcribe"
              }
            >
              <Mic className="h-3 w-3" />
              {isTranscribing ? "…" : isRecording ? "Stop" : "Record"}
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleImproveWithAI}
            disabled={!input.trim() || isImproving}
          >
            {isImproving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Improving…
              </>
            ) : (
              <>
                <Bot className="h-3 w-3" aria-hidden />
                Improve with AI
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ─── Toolbar: Provider, model, templates ──────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
        {/* Provider toggle — expandable settings */}
        <button
          type="button"
          onClick={() => setShowProviderSettings(!showProviderSettings)}
          className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          {showProviderSettings ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <Server className="h-3 w-3" />
          {providerLabel}
        </button>

        {/* Inline provider / model selectors when expanded */}
        {showProviderSettings && (
          <>
            <Select
              value={settings.provider}
              onValueChange={(value) =>
                handleProviderChange(
                  value as "ollama" | "anthropic" | "openrouter",
                )
              }
            >
              <SelectTrigger className="w-[130px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
              </SelectContent>
            </Select>

            {/* Model selector — varies by provider */}
            {settings.provider === "ollama" && (
              <>
                <Input
                  value={baseUrl}
                  onChange={(e) => handleOllamaBaseUrlChange(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="h-7 w-[160px] font-mono text-[11px]"
                />
                {isLoadingOllamaModels ? (
                  <div className="flex items-center text-[11px] text-slate-500">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Loading…
                  </div>
                ) : ollamaModels.length > 0 ? (
                  <Select
                    value={currentOllamaModel}
                    onValueChange={handleOllamaModelChange}
                  >
                    <SelectTrigger className="w-[140px] h-7 text-xs">
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
                    value={currentOllamaModel}
                    onChange={(e) => handleOllamaModelChange(e.target.value)}
                    placeholder="llama3.2:3b"
                    className="h-7 w-[120px] font-mono text-[11px]"
                  />
                )}
                <button
                  type="button"
                  onClick={loadOllamaModels}
                  disabled={isLoadingOllamaModels}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <RefreshCw
                    className={cn(
                      "h-3 w-3",
                      isLoadingOllamaModels && "animate-spin",
                    )}
                  />
                  Refresh
                </button>
              </>
            )}

            {settings.provider === "anthropic" && (
              <Select
                value={settings.model}
                onValueChange={handleAnthropicModelChange}
              >
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet">
                    Claude Sonnet 4.5
                  </SelectItem>
                  <SelectItem value="claude-opus">Claude Opus 4.5</SelectItem>
                  <SelectItem value="claude-haiku">
                    Claude Haiku 4.5
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {settings.provider === "openrouter" && (
              <Select
                value={
                  settings.openRouter?.model ??
                  DEFAULT_OPENROUTER_SETTINGS.model
                }
                onValueChange={handleOpenRouterModelChange}
              >
                <SelectTrigger className="w-[200px] h-7 text-xs">
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
            )}
          </>
        )}

        {/* Template pills — right-aligned */}
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {PROMPT_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template.id)}
              disabled={!input.trim()}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                selectedTemplate === template.id
                  ? "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/60"
                  : "text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-slate-800/30 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:text-slate-600 dark:hover:text-slate-300",
                !input.trim() && "opacity-40 cursor-not-allowed",
              )}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Error banner (if any) ────────────────────────────────── */}
      {errorMessage && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400 border-b border-red-200/50 dark:border-red-800/50 shrink-0">
          <X className="h-3 w-3 shrink-0" />
          <span role="alert">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-300"
            title="Dismiss error"
            aria-label="Dismiss error"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ─── Main two-column area ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-200/70 dark:divide-slate-800/70 overflow-hidden">
        {/* LEFT: Input panel */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {/* Input header */}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
            <div className="flex items-center gap-1.5">
              <Wand2 className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Your Prompt
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Word / character count */}
              {input.length > 0 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {inputWordCount}w · {inputCharCount}c
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                onClick={clearInput}
                title="Clear input"
                aria-label="Clear input"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Textarea — fills remaining space */}
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setErrorMessage(null);
            }}
            placeholder="Enter your prompt here, or use voice input..."
            className="flex-1 min-h-0 w-full resize-none bg-transparent p-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200 focus:outline-none"
            spellCheck={false}
          />

          {/* Live voice transcript */}
          {isVoiceListening && voiceInterim && (
            <p className="px-3 pb-1 text-[11px] text-slate-500 dark:text-slate-400 italic shrink-0">
              Listening: {voiceInterim}
            </p>
          )}
          {(voiceError || recordError) && (
            <p className="px-3 pb-1 text-[11px] text-red-600 dark:text-red-400 shrink-0" role="alert">
              {voiceError || recordError}
            </p>
          )}

          {/* Example prompts — clickable quick-start chips */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-800/20 shrink-0 flex-wrap">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Try:
            </span>
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                onClick={() => {
                  setInput(example);
                  setErrorMessage(null);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Output panel */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {/* Output header with action buttons */}
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Optimized Prompt
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Use optimized output as new input for further iteration */}
              {output && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-purple-600 dark:text-purple-400"
                  onClick={useOutputAsInput}
                  title="Use as input to refine further"
                >
                  <RotateCcw className="h-3 w-3" />
                  Iterate
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={copyOutput}
                disabled={!output && !input}
              >
                {copied ? (
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Output preview — fills remaining space */}
          <pre className="flex-1 min-h-0 overflow-auto p-3 font-sans text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">
            {output || input || (
              <span className="text-slate-400 dark:text-slate-500 italic text-xs">
                Your optimized prompt will appear here.
              </span>
            )}
          </pre>

          {/* Best Practices — collapsible footer like other tools */}
          <div className="border-t border-slate-200/50 dark:border-slate-800/50 shrink-0">
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <Sparkles className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                Best Practices
                <ChevronRight className="h-3 w-3 text-slate-400 transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-3 pb-3">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {BEST_PRACTICES.map((practice, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Sparkles className="h-2.5 w-2.5 mt-0.5 text-purple-400/60 shrink-0" />
                      <span>{practice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};
