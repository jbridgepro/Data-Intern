/**
 * File: src/features/ai-assistant/voice/components/VoiceServiceStatus.tsx
 *
 * Component for displaying voice service health status and connection information.
 * Includes comprehensive troubleshooting tips for common issues.
 */

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { VoiceService } from "../voiceService";
import { invoke } from "@tauri-apps/api/core";
import type { VoiceSettings } from "../types";

// Troubleshooting tips organized by error type
interface TroubleshootingTip {
  title: string;
  description: string;
  command?: string;
  link?: string;
}

const TROUBLESHOOTING_TIPS: Record<string, TroubleshootingTip[]> = {
  'connection': [
    {
      title: 'Check if service is running',
      description: 'The voice service may not be started yet',
      command: 'ps aux | grep voice_service',
    },
    {
      title: 'Port already in use',
      description: 'Another process may be using port 8765',
      command: 'lsof -i :8765 | grep LISTEN',
    },
    {
      title: 'Kill stuck process',
      description: 'If the port is stuck, kill the process',
      command: 'lsof -ti :8765 | xargs kill -9',
    },
    {
      title: 'Firewall blocking',
      description: 'Check if firewall allows local connections on port 8765',
    },
  ],
  'python': [
    {
      title: 'Install Python 3',
      description: 'Python 3.8 or higher is required',
      command: 'brew install python3  # macOS',
    },
    {
      title: 'Check Python version',
      description: 'Verify Python is installed correctly',
      command: 'python3 --version',
    },
  ],
  'dependencies': [
    {
      title: 'Install dependencies',
      description: 'Install required Python packages',
      command: 'pip3 install -r voice-service/requirements.txt',
    },
    {
      title: 'Install Faster-Whisper',
      description: 'Install the speech recognition engine',
      command: 'pip3 install faster-whisper',
    },
    {
      title: 'Install Piper TTS',
      description: 'Install the text-to-speech engine',
      command: 'pip3 install piper-tts',
    },
  ],
  'model': [
    {
      title: 'First-time model loading',
      description: 'Whisper models download on first use (can take 1-5 minutes)',
    },
    {
      title: 'Try a smaller model',
      description: 'If loading is slow, try the "tiny" or "base" model',
    },
    {
      title: 'Check disk space',
      description: 'Ensure you have at least 2GB free for model downloads',
      command: 'df -h ~',
    },
  ],
};

interface VoiceServiceStatusProps {
  settings: VoiceSettings;
  serviceManager?: {
    status: {
      isRunning: boolean;
      isStarting: boolean;
      error: string | null;
    };
    startService: () => Promise<boolean>;
  };
}

interface ServiceHealth {
  status: string;
  whisper_available: boolean;
  piper_available: boolean;
  checking: boolean;
  error?: string;
}

export const VoiceServiceStatus = ({
  settings,
  serviceManager,
}: VoiceServiceStatusProps) => {
  const [health, setHealth] = useState<ServiceHealth>({
    status: "unknown",
    whisper_available: false,
    piper_available: false,
    checking: false,
  });
  const [dependencies, setDependencies] = useState<{
    python_available: boolean;
    python_version?: string;
    script_found: boolean;
    script_path?: string;
    faster_whisper_available: boolean;
  } | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Copy command to clipboard
  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Determine which troubleshooting tips to show based on current state
  const getRelevantTips = (): TroubleshootingTip[] => {
    const tips: TroubleshootingTip[] = [];
    
    if (health.status === 'unavailable') {
      tips.push(...TROUBLESHOOTING_TIPS['connection']);
    }
    
    if (dependencies && !dependencies.python_available) {
      tips.push(...TROUBLESHOOTING_TIPS['python']);
    }
    
    if (dependencies && !dependencies.faster_whisper_available) {
      tips.push(...TROUBLESHOOTING_TIPS['dependencies']);
    }
    
    if (serviceManager?.status.isStarting || serviceManager?.status.error?.includes('Loading')) {
      tips.push(...TROUBLESHOOTING_TIPS['model']);
    }
    
    return tips;
  };

  // Simulate loading progress for model initialization
  useEffect(() => {
    if (serviceManager?.status.isStarting) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          // Slow down as we approach 90%
          const increment = prev < 30 ? 5 : prev < 60 ? 3 : prev < 80 ? 1 : 0.5;
          return Math.min(prev + increment, 95);
        });
      }, 1000);
      return () => clearInterval(interval);
    } else if (health.status === 'healthy') {
      setLoadingProgress(100);
    }
  }, [serviceManager?.status.isStarting, health.status]);

  const checkDependencies = async () => {
    setCheckingDeps(true);
    try {
      const deps = await invoke<{
        python_available: boolean;
        python_version?: string;
        script_found: boolean;
        script_path?: string;
        faster_whisper_available: boolean;
      }>("check_voice_service_dependencies");
      setDependencies(deps);
    } catch (error) {
      console.error("Failed to check dependencies:", error);
    } finally {
      setCheckingDeps(false);
    }
  };

  const checkHealth = async () => {
    if (settings.provider !== "faster-whisper") {
      return;
    }

    setHealth((prev) => ({ ...prev, checking: true, error: undefined }));

    try {
      const result = await VoiceService.checkVoiceServiceHealth(
        settings.voiceServiceUrl,
      );

      setHealth({
        status: result.status,
        whisper_available: result.whisper_available,
        piper_available: result.piper_available,
        checking: false,
        error: result.error,
      });
    } catch (error: any) {
      setHealth({
        status: "unavailable",
        whisper_available: false,
        piper_available: false,
        checking: false,
        error: error.message || "Failed to connect to voice service",
      });
    }
  };

  useEffect(() => {
    if (settings.provider === "faster-whisper") {
      checkHealth();
      checkDependencies();
      // Check health every 30 seconds
      const interval = setInterval(checkHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [settings.provider, settings.voiceServiceUrl]);

  if (settings.provider !== "faster-whisper") {
    return null;
  }

  const handleManualStart = async () => {
    if (serviceManager) {
      await serviceManager.startService();
      // Wait a bit then check health (service manager already does health checks)
      setTimeout(() => checkHealth(), 5000);
    } else {
      // Fallback: try to start via Tauri command
      try {
        const config = {
          host: "127.0.0.1",
          port: 8765,
          model_size: settings.whisperModelSize || "base",
          device: settings.whisperDevice || "cpu",
          compute_type: settings.whisperComputeType || "int8",
        };
        await invoke("start_voice_service", { config });
        // Wait longer for service to initialize, especially on first run (model loading)
        setTimeout(() => checkHealth(), 10000);
      } catch (error) {
        console.error("Failed to start service:", error);
      }
    }
  };

  const getStatusIcon = () => {
    if (serviceManager?.status.isStarting) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (health.checking) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (health.status === "healthy") {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (health.status === "unavailable") {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (serviceManager?.status.isStarting) return "Starting...";
    if (health.checking) return "Checking...";
    if (health.status === "healthy") return "Connected";
    if (health.status === "unavailable") return "Disconnected";
    return "Unknown";
  };

  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">Voice Service Status</span>
          </div>
          <div className="flex items-center gap-2">
            {health.status === "unavailable" &&
              !serviceManager?.status.isStarting && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualStart}
                  className="h-7 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Start Service
                </Button>
              )}
            <Button
              variant="ghost"
              size="sm"
              onClick={checkHealth}
              disabled={health.checking || serviceManager?.status.isStarting}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status:</span>
            <Badge
              variant={
                health.status === "healthy"
                  ? "default"
                  : health.status === "unavailable"
                    ? "destructive"
                    : "secondary"
              }
            >
              {getStatusText()}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Faster-Whisper:</span>
            <Badge
              variant={health.whisper_available ? "default" : "destructive"}
            >
              {health.whisper_available ? "Available" : "Unavailable"}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Piper TTS:</span>
            <Badge variant={health.piper_available ? "default" : "destructive"}>
              {health.piper_available ? "Available" : "Unavailable"}
            </Badge>
          </div>

          {serviceManager?.status.error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
              {serviceManager.status.error}
            </div>
          )}

          {health.error && !serviceManager?.status.error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
              {health.error}
            </div>
          )}

          {health.status === "unavailable" &&
            !serviceManager?.status.isStarting && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-600 dark:text-yellow-400">
                {serviceManager ? (
                  <>
                    Service is not running. Click "Start Service" to launch it
                    automatically.
                    {serviceManager.status.error && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400 whitespace-pre-wrap">
                        {serviceManager.status.error}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    Make sure the voice service is running:
                    <br />
                    <code className="mt-1 block">python3 voice-service/voice_service.py</code>
                    <div className="mt-2 text-xs opacity-80">
                      If it fails with "Address already in use", run:
                      <code className="block mt-0.5">lsof -i :8765 | xargs kill</code>
                    </div>
                  </>
                )}
              </div>
            )}

          {serviceManager?.status.isStarting && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Initializing Voice Service
                </span>
              </div>
              
              {/* Loading progress bar */}
              <div className="space-y-2">
                <Progress value={loadingProgress} className="h-2" />
                <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                  <span>
                    {loadingProgress < 30 ? 'Starting service...' :
                     loadingProgress < 60 ? 'Loading Whisper model...' :
                     loadingProgress < 90 ? 'Initializing TTS...' :
                     'Almost ready...'}
                  </span>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
              </div>
              
              {serviceManager.status.error && (
                <div className="mt-2 text-xs text-blue-500 dark:text-blue-400">
                  {serviceManager.status.error}
                </div>
              )}
              
              <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-900/30 rounded flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  <strong>Tip:</strong> First-time model download can take 1-5 minutes 
                  depending on model size and internet speed. The model is cached for 
                  subsequent uses.
                </p>
              </div>
            </div>
          )}

          {/* Dependencies Check */}
          {dependencies && health.status === "unavailable" && (
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  System Requirements
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkDependencies}
                  disabled={checkingDeps}
                  className="h-6 text-xs ml-auto"
                >
                  {checkingDeps ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Checking</>
                  ) : (
                    <><RefreshCw className="h-3 w-3 mr-1" />Recheck</>
                  )}
                </Button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5" />
                    Python
                  </span>
                  <Badge
                    variant={dependencies.python_available ? "default" : "destructive"}
                    className={cn(dependencies.python_available && "bg-green-500")}
                  >
                    {dependencies.python_available
                      ? dependencies.python_version || "Available"
                      : "Not Found"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded">
                  <span className="text-slate-600 dark:text-slate-400">
                    Voice Service Script
                  </span>
                  <Badge
                    variant={dependencies.script_found ? "default" : "destructive"}
                    className={cn(dependencies.script_found && "bg-green-500")}
                  >
                    {dependencies.script_found ? "Found" : "Not Found"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded">
                  <span className="text-slate-600 dark:text-slate-400">
                    Faster-Whisper
                  </span>
                  <Badge
                    variant={dependencies.faster_whisper_available ? "default" : "destructive"}
                    className={cn(dependencies.faster_whisper_available && "bg-green-500")}
                  >
                    {dependencies.faster_whisper_available ? "Installed" : "Not Installed"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Troubleshooting Section */}
          {health.status === "unavailable" && !serviceManager?.status.isStarting && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                className="w-full justify-between text-xs h-8"
              >
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                  Troubleshooting Tips
                </span>
                {showTroubleshooting ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
              
              {showTroubleshooting && (
                <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                  {getRelevantTips().map((tip, index) => (
                    <div 
                      key={index}
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {tip.title}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {tip.description}
                          </p>
                        </div>
                        {tip.link && (
                          <a 
                            href={tip.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600"
                            aria-label={`Learn more about ${tip.title}`}
                            title={`Learn more about ${tip.title}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      {tip.command && (
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 text-[10px] bg-slate-900 dark:bg-slate-950 text-green-400 px-2 py-1.5 rounded font-mono overflow-x-auto">
                            {tip.command}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyCommand(tip.command!)}
                            className="h-6 w-6 p-0 shrink-0"
                          >
                            {copiedCommand === tip.command ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Additional help link */}
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-center">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      Need more help? Check the{" "}
                      <a 
                        href="#" 
                        className="underline hover:text-blue-700 dark:hover:text-blue-300"
                        onClick={(e) => {
                          e.preventDefault();
                          // Could open documentation or help modal
                        }}
                      >
                        Voice Setup Guide
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
