/**
 * File: src/features/ai-assistant/components/AIProviderSetupWizard.tsx
 *
 * Step-by-step wizard component for setting up AI providers (Ollama, OpenRouter, Anthropic).
 * Guides users through the process of connecting their first AI model.
 */

import { useState, useEffect } from "react";
import {
  Server,
  Cloud,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Download,
  Terminal,
  Key,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Shield,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { testAPIKey, listAvailableModels } from "../utils/aiService";
import { openRouterService } from "../utils/openRouterService";
import type { AISettings, AIProvider, OpenRouterSettings } from "../types";
import { DEFAULT_OPENROUTER_SETTINGS } from "../types";

interface AIProviderSetupWizardProps {
  settings: AISettings;
  onUpdate: (updates: Partial<AISettings>) => void;
  onComplete: () => void;
  onSkip?: () => void;
}

type SetupStep = "select-provider" | "setup-provider" | "verify-connection" | "complete";

interface ProviderOption {
  id: AIProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  setup: "easy" | "moderate" | "advanced";
  cost: "free" | "paid" | "freemium";
  recommended?: boolean;
}

// Provider options with detailed information
const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Run AI models locally on your computer. Free, private, and works offline.",
    icon: <Server className="h-6 w-6" />,
    features: ["100% Private", "Works Offline", "No API Key", "Free Forever"],
    setup: "moderate",
    cost: "free",
    recommended: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ AI models through one API. Pay-as-you-go pricing.",
    icon: <Globe className="h-6 w-6" />,
    features: ["100+ Models", "Claude, GPT-4, Llama", "Pay Per Use", "Easy Setup"],
    setup: "easy",
    cost: "paid",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Direct access to Claude models. Best for production use.",
    icon: <Cloud className="h-6 w-6" />,
    features: ["Official API", "Fastest Response", "Direct Support", "Enterprise Ready"],
    setup: "easy",
    cost: "paid",
  },
];

export const AIProviderSetupWizard = ({
  settings,
  onUpdate,
  onComplete,
  onSkip,
}: AIProviderSetupWizardProps) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<SetupStep>("select-provider");
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  
  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  // Ollama state
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isCheckingOllama, setIsCheckingOllama] = useState(false);
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  
  // OpenRouter state
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [openRouterCredits, setOpenRouterCredits] = useState<number | null>(null);
  
  // Anthropic state
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  
  // Clipboard state
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Check Ollama installation status
  const checkOllamaStatus = async () => {
    setIsCheckingOllama(true);
    try {
      const baseUrl = settings.ollamaBaseUrl || "http://localhost:11434";
      const response = await fetch(`${baseUrl}/api/tags`, { 
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.models?.map((m: any) => m.name) || [];
        setOllamaModels(models);
        setOllamaInstalled(true);
      } else {
        setOllamaInstalled(false);
        setOllamaModels([]);
      }
    } catch (error) {
      setOllamaInstalled(false);
      setOllamaModels([]);
    } finally {
      setIsCheckingOllama(false);
    }
  };

  // Check Ollama when selected
  useEffect(() => {
    if (selectedProvider === "ollama" && currentStep === "setup-provider") {
      checkOllamaStatus();
    }
  }, [selectedProvider, currentStep]);

  // Copy command to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Handle provider selection
  const handleSelectProvider = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setConnectionResult(null);
    setCurrentStep("setup-provider");
  };

  // Handle connection test
  const handleTestConnection = async () => {
    if (!selectedProvider) return;
    
    setIsConnecting(true);
    setConnectionResult(null);

    try {
      if (selectedProvider === "ollama") {
        // Test Ollama connection
        const result = await testAPIKey(undefined, "ollama", {
          baseUrl: settings.ollamaBaseUrl || "http://localhost:11434",
          model: settings.ollamaModel || ollamaModels[0] || "llama3.2:3b",
        });
        
        if (result.valid) {
          onUpdate({ 
            provider: "ollama",
            ollamaModel: settings.ollamaModel || ollamaModels[0] || "llama3.2:3b",
          });
          setConnectionResult({ success: true, message: "Successfully connected to Ollama!" });
          setCurrentStep("verify-connection");
        } else {
          setConnectionResult({ success: false, message: result.message });
        }
      } else if (selectedProvider === "openrouter") {
        // Validate OpenRouter API key
        if (!openRouterApiKey.trim()) {
          setConnectionResult({ success: false, message: "Please enter your OpenRouter API key" });
          setIsConnecting(false);
          return;
        }

        openRouterService.updateSettings({ apiKey: openRouterApiKey });
        const result = await openRouterService.validateApiKey();
        
        if (result.valid) {
          const credits = await openRouterService.getCredits();
          setOpenRouterCredits(credits?.credits || null);
          
          onUpdate({
            provider: "openrouter",
            openRouter: {
              ...DEFAULT_OPENROUTER_SETTINGS,
              ...settings.openRouter,
              apiKey: openRouterApiKey,
            },
          });
          setConnectionResult({ success: true, message: "Successfully connected to OpenRouter!" });
          setCurrentStep("verify-connection");
        } else {
          setConnectionResult({ success: false, message: result.message || "Invalid API key" });
        }
      } else if (selectedProvider === "anthropic") {
        // Validate Anthropic API key
        if (!anthropicApiKey.trim()) {
          setConnectionResult({ success: false, message: "Please enter your Anthropic API key" });
          setIsConnecting(false);
          return;
        }

        const result = await testAPIKey(anthropicApiKey, "anthropic");
        
        if (result.valid) {
          onUpdate({
            provider: "anthropic",
            apiKey: anthropicApiKey,
          });
          setConnectionResult({ success: true, message: "Successfully connected to Anthropic Claude!" });
          setCurrentStep("verify-connection");
        } else {
          setConnectionResult({ success: false, message: result.message });
        }
      }
    } catch (error: any) {
      setConnectionResult({ 
        success: false, 
        message: error.message || "Connection failed. Please check your settings." 
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Get cost badge color
  const getCostBadgeColor = (cost: "free" | "paid" | "freemium") => {
    switch (cost) {
      case "free": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "paid": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "freemium": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    }
  };

  // Render provider selection step
  const renderProviderSelection = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25 mb-4">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Set Up AI Assistant
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Choose how you want to connect to AI models. You can change this later in settings.
        </p>
      </div>

      {/* Provider Options */}
      <div className="grid gap-4">
        {PROVIDER_OPTIONS.map((provider) => (
          <button
            key={provider.id}
            onClick={() => handleSelectProvider(provider.id)}
            className={cn(
              "relative w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
              "hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20",
              "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2",
              provider.recommended
                ? "border-violet-300 dark:border-violet-700 bg-violet-50/30 dark:bg-violet-900/10"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
            )}
          >
            {/* Recommended Badge */}
            {provider.recommended && (
              <div className="absolute -top-2.5 left-4">
                <Badge className="bg-violet-500 text-white text-xs px-2 py-0.5">
                  Recommended
                </Badge>
              </div>
            )}

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={cn(
                "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
                provider.recommended
                  ? "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
              )}>
                {provider.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {provider.name}
                  </h3>
                  <Badge variant="outline" className={cn("text-xs", getCostBadgeColor(provider.cost))}>
                    {provider.cost === "free" ? "Free" : provider.cost === "paid" ? "Paid" : "Free Tier"}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  {provider.description}
                </p>
                
                {/* Features */}
                <div className="flex flex-wrap gap-1.5">
                  {provider.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="flex-shrink-0 h-5 w-5 text-slate-400" />
            </div>
          </button>
        ))}
      </div>

      {/* Skip Option */}
      {onSkip && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-slate-500 hover:text-slate-700"
          >
            Skip for now
          </Button>
        </div>
      )}
    </div>
  );

  // Render Ollama setup step
  const renderOllamaSetup = () => (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCurrentStep("select-provider")}
        className="gap-1.5"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 mb-4">
          <Server className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Set Up Ollama
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Run AI models locally on your computer
        </p>
      </div>

      {/* Connection Status */}
      <Card className={cn(
        "border-2 transition-colors",
        ollamaInstalled === true
          ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20"
          : ollamaInstalled === false
          ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20"
          : "border-slate-200 dark:border-slate-700"
      )}>
        <CardContent className="pt-4">
          {isCheckingOllama ? (
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Checking Ollama installation...</span>
            </div>
          ) : ollamaInstalled === true ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Ollama is running!</span>
              </div>
              {ollamaModels.length > 0 ? (
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {ollamaModels.length} model{ollamaModels.length !== 1 ? "s" : ""} available:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ollamaModels.slice(0, 5).map((model) => (
                      <Badge key={model} variant="secondary" className="text-xs">
                        {model}
                      </Badge>
                    ))}
                    {ollamaModels.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{ollamaModels.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    No models installed yet. Pull a model to get started:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-slate-900 text-slate-100 rounded-lg text-sm font-mono">
                      ollama pull llama3.2:3b
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("ollama pull llama3.2:3b")}
                    >
                      {copiedCommand ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Ollama not detected</span>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Follow these steps to install Ollama:
                </p>
                
                {/* Step 1: Download */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-400">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Download Ollama
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-violet-600"
                      onClick={() => window.open("https://ollama.com/download", "_blank")}
                    >
                      ollama.com/download <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>

                {/* Step 2: Install & Run */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-400">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Install and start Ollama
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Run the installer and Ollama will start automatically
                    </p>
                  </div>
                </div>

                {/* Step 3: Pull a model */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-400">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Pull a model (in terminal)
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 px-2 py-1 bg-slate-900 text-slate-100 rounded text-xs font-mono">
                        ollama pull llama3.2:3b
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard("ollama pull llama3.2:3b")}
                      >
                        {copiedCommand ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refresh Button */}
      <Button
        variant="outline"
        onClick={checkOllamaStatus}
        disabled={isCheckingOllama}
        className="w-full gap-2"
      >
        <RefreshCw className={cn("h-4 w-4", isCheckingOllama && "animate-spin")} />
        Check Connection Again
      </Button>

      {/* Connection Result */}
      {connectionResult && (
        <div className={cn(
          "p-3 rounded-lg flex items-center gap-2",
          connectionResult.success
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
        )}>
          {connectionResult.success ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span className="text-sm">{connectionResult.message}</span>
        </div>
      )}

      {/* Connect Button */}
      <Button
        onClick={handleTestConnection}
        disabled={isConnecting || ollamaInstalled !== true || ollamaModels.length === 0}
        className="w-full gap-2"
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Connect to Ollama
          </>
        )}
      </Button>
    </div>
  );

  // Render OpenRouter setup step
  const renderOpenRouterSetup = () => (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCurrentStep("select-provider")}
        className="gap-1.5"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-4">
          <Globe className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Set Up OpenRouter
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Access 100+ AI models with one API key
        </p>
      </div>

      {/* API Key Setup Steps */}
      <div className="space-y-4">
        {/* Step 1: Get API Key */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
            1
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Get your API key
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-blue-600"
              onClick={() => window.open("https://openrouter.ai/keys", "_blank")}
            >
              openrouter.ai/keys <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* Step 2: Enter API Key */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
            2
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Enter your API key
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="sk-or-v1-..."
                value={openRouterApiKey}
                onChange={(e) => setOpenRouterApiKey(e.target.value)}
                className="flex-1"
              />
              <Key className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pay-as-you-go pricing
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Only pay for what you use. Many models cost less than $0.001 per request.
                You can set spending limits in your OpenRouter dashboard.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Result */}
      {connectionResult && (
        <div className={cn(
          "p-3 rounded-lg flex items-center gap-2",
          connectionResult.success
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
        )}>
          {connectionResult.success ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span className="text-sm">{connectionResult.message}</span>
        </div>
      )}

      {/* Connect Button */}
      <Button
        onClick={handleTestConnection}
        disabled={isConnecting || !openRouterApiKey.trim()}
        className="w-full gap-2"
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Connect to OpenRouter
          </>
        )}
      </Button>
    </div>
  );

  // Render Anthropic setup step
  const renderAnthropicSetup = () => (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCurrentStep("select-provider")}
        className="gap-1.5"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-violet-100 dark:bg-violet-900/30 mb-4">
          <Cloud className="h-7 w-7 text-violet-600 dark:text-violet-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Set Up Anthropic Claude
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Direct access to Claude AI models
        </p>
      </div>

      {/* API Key Setup Steps */}
      <div className="space-y-4">
        {/* Step 1: Get API Key */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-400">
            1
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Get your API key
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-violet-600"
              onClick={() => window.open("https://console.anthropic.com/settings/keys", "_blank")}
            >
              console.anthropic.com <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* Step 2: Enter API Key */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-400">
            2
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Enter your API key
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="sk-ant-..."
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                className="flex-1"
              />
              <Key className="h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                Your API key is stored locally
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                We never send your API key to our servers. All requests go directly to Anthropic.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Result */}
      {connectionResult && (
        <div className={cn(
          "p-3 rounded-lg flex items-center gap-2",
          connectionResult.success
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
        )}>
          {connectionResult.success ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span className="text-sm">{connectionResult.message}</span>
        </div>
      )}

      {/* Connect Button */}
      <Button
        onClick={handleTestConnection}
        disabled={isConnecting || !anthropicApiKey.trim()}
        className="w-full gap-2"
      >
        {isConnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Connect to Anthropic
          </>
        )}
      </Button>
    </div>
  );

  // Render verification/complete step
  const renderVerificationStep = () => (
    <div className="space-y-6 text-center">
      {/* Success Animation */}
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          All Set!
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You're connected to{" "}
          {selectedProvider === "ollama" ? "Ollama" : 
           selectedProvider === "openrouter" ? "OpenRouter" : "Anthropic Claude"}.
          You can now start using the AI assistant.
        </p>
      </div>

      {/* Provider Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            {selectedProvider === "ollama" ? (
              <Server className="h-6 w-6 text-emerald-600" />
            ) : selectedProvider === "openrouter" ? (
              <Globe className="h-6 w-6 text-blue-600" />
            ) : (
              <Cloud className="h-6 w-6 text-violet-600" />
            )}
            <div className="text-left">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {selectedProvider === "ollama" ? "Ollama (Local)" : 
                 selectedProvider === "openrouter" ? "OpenRouter" : "Anthropic Claude"}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedProvider === "ollama" 
                  ? `${ollamaModels.length} model(s) available`
                  : selectedProvider === "openrouter" && openRouterCredits !== null
                  ? `$${openRouterCredits.toFixed(2)} credits available`
                  : "Connected"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complete Button */}
      <Button onClick={onComplete} className="w-full gap-2" size="lg">
        <Sparkles className="h-5 w-5" />
        Start Using AI Assistant
      </Button>
    </div>
  );

  // Main render
  return (
    <div className="w-full max-w-lg mx-auto p-6">
      {currentStep === "select-provider" && renderProviderSelection()}
      {currentStep === "setup-provider" && selectedProvider === "ollama" && renderOllamaSetup()}
      {currentStep === "setup-provider" && selectedProvider === "openrouter" && renderOpenRouterSetup()}
      {currentStep === "setup-provider" && selectedProvider === "anthropic" && renderAnthropicSetup()}
      {currentStep === "verify-connection" && renderVerificationStep()}
    </div>
  );
};
