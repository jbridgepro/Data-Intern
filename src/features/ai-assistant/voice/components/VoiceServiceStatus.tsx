/**
 * File: src/features/ai-assistant/voice/components/VoiceServiceStatus.tsx
 *
 * Component for displaying voice service health status and connection information.
 */

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VoiceService } from "../voiceService";
import { invoke } from "@tauri-apps/api/core";
import type { VoiceSettings } from "../types";

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
                    <code className="mt-1 block">python3 voice_service.py</code>
                  </>
                )}
              </div>
            )}

          {serviceManager?.status.isStarting && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-600 dark:text-blue-400">
              {serviceManager.status.error?.includes("Waiting for service") ? (
                <div>
                  <div className="font-medium mb-1">
                    Starting voice service...
                  </div>
                  <div className="text-blue-500">
                    {serviceManager.status.error}
                  </div>
                  <div className="mt-1 text-blue-400">
                    First-time startup may take 10-30 seconds while loading the
                    Whisper model.
                  </div>
                </div>
              ) : (
                "Starting voice service automatically..."
              )}
            </div>
          )}

          {/* Dependencies Check */}
          {dependencies && health.status === "unavailable" && (
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Dependency Check
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkDependencies}
                  disabled={checkingDeps}
                  className="h-6 text-xs ml-auto"
                >
                  {checkingDeps ? "Checking..." : "Recheck"}
                </Button>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Python:
                  </span>
                  <Badge
                    variant={
                      dependencies.python_available ? "default" : "destructive"
                    }
                  >
                    {dependencies.python_available
                      ? dependencies.python_version || "Available"
                      : "Not Found"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Script:
                  </span>
                  <Badge
                    variant={
                      dependencies.script_found ? "default" : "destructive"
                    }
                  >
                    {dependencies.script_found ? "Found" : "Not Found"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Faster-Whisper:
                  </span>
                  <Badge
                    variant={
                      dependencies.faster_whisper_available
                        ? "default"
                        : "destructive"
                    }
                  >
                    {dependencies.faster_whisper_available
                      ? "Installed"
                      : "Not Installed"}
                  </Badge>
                </div>
                {!dependencies.python_available && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-yellow-700 dark:text-yellow-400">
                    Install Python 3: <code>brew install python3</code> (macOS)
                    or download from python.org
                  </div>
                )}
                {dependencies.python_available &&
                  !dependencies.faster_whisper_available && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-yellow-700 dark:text-yellow-400">
                      Install dependencies:{" "}
                      <code>
                        pip3 install -r voice-service/requirements.txt
                      </code>
                    </div>
                  )}
                {!dependencies.script_found && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-400">
                    Voice service script not found. Expected at:
                    voice-service/voice_service.py
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
