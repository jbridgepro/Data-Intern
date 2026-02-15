/**
 * File: src/features/ai-assistant/voice/hooks/useVoiceServiceManager.ts
 * 
 * Hook for automatically managing the voice service lifecycle.
 * Automatically starts the voice service when the app initializes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { VoiceService } from '../voiceService';
import type { VoiceSettings } from '../types';

interface VoiceServiceStatus {
  isRunning: boolean;
  isStarting: boolean;
  error: string | null;
  pid: string | null;
}

/**
 * Hook to automatically manage voice service lifecycle.
 * Starts the service automatically when provider is faster-whisper.
 */
export const useVoiceServiceManager = (settings: VoiceSettings) => {
  const [status, setStatus] = useState<VoiceServiceStatus>({
    isRunning: false,
    isStarting: false,
    error: null,
    pid: null,
  });
  // Use browser-safe timeout type instead of NodeJS.Timeout
  const checkIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAttemptsRef = useRef(0);
  const maxStartAttempts = 3;

  /**
   * Checks if the voice service is running.
   */
  const checkServiceHealth = useCallback(async (): Promise<boolean> => {
    if (settings.provider !== 'faster-whisper') {
      return false;
    }

    try {
      const result = await VoiceService.checkVoiceServiceHealth(
        settings.voiceServiceUrl
      );
      return result.status === 'healthy';
    } catch (error) {
      return false;
    }
  }, [settings.provider, settings.voiceServiceUrl]);

  /**
   * Starts the voice service.
   */
  const startService = useCallback(async (): Promise<boolean> => {
    if (settings.provider !== 'faster-whisper') {
      return false;
    }

    // Check if already running
    const isRunning = await checkServiceHealth();
    if (isRunning) {
      setStatus((prev) => ({
        ...prev,
        isRunning: true,
        isStarting: false,
        error: null,
      }));
      return true;
    }

    setStatus((prev) => ({
      ...prev,
      isStarting: true,
      error: null,
    }));

    try {
      // Parse URL to extract host and port
      const url = settings.voiceServiceUrl || 'http://127.0.0.1:8765';
      let host = '127.0.0.1';
      let port = 8765;

      try {
        const urlObj = new URL(url);
        host = urlObj.hostname;
        port = urlObj.port ? parseInt(urlObj.port, 10) : 8765;
      } catch (e) {
        // Fallback parsing if URL parsing fails
        const match = url.match(/https?:\/\/([^:]+):?(\d+)?/);
        if (match) {
          host = match[1];
          if (match[2]) {
            port = parseInt(match[2], 10);
          }
        }
      }

      const config = {
        host,
        port,
        model_size: settings.whisperModelSize || 'base',
        device: settings.whisperDevice || 'cpu',
        compute_type: settings.whisperComputeType || 'int8',
      };

      const result = await invoke<string>('start_voice_service', {
        config,
      });

      // Extract PID from result if available
      const pidMatch = result.match(/PID: (\d+)/);
      const pid = pidMatch ? pidMatch[1] : null;

      // Wait for service to start with retries
      // The service needs time to:
      // 1. Start the HTTP server
      // 2. Load the Whisper model (first time can take 30-120 seconds depending on model size)
      // 3. Initialize Piper
      let isRunning = false;
      const maxHealthCheckAttempts = 60; // 60 attempts = 120 seconds total (2 minutes)
      const healthCheckDelay = 2000; // 2 seconds between checks
      const totalWaitTime = (maxHealthCheckAttempts * healthCheckDelay) / 1000; // in seconds

      for (let attempt = 0; attempt < maxHealthCheckAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, healthCheckDelay));

        isRunning = await checkServiceHealth();
        if (isRunning) {
          setStatus({
            isRunning: true,
            isStarting: false,
            error: null,
            pid,
          });
          startAttemptsRef.current = 0;
          return true;
        }

        // Update status to show we're still waiting
        if (attempt < maxHealthCheckAttempts - 1) {
          const elapsedSeconds = ((attempt + 1) * healthCheckDelay) / 1000;
          setStatus((prev) => ({
            ...prev,
            isStarting: true,
            error: `Loading Whisper model... (${Math.round(elapsedSeconds)}s / ${totalWaitTime}s). This may take 1-2 minutes on first run.`,
          }));
        }
      }

      // If we get here, service didn't become healthy
      // Check if process is still running (PID exists)
      // If process is running, it might just be taking longer to load the model
      if (pid) {
        // Process is running but health check failed - model might still be loading
        // Set status to show it's still loading, not an error
        setStatus((prev) => ({
          ...prev,
          isStarting: false,
          isRunning: false,
          error: `Service is starting (PID: ${pid}). Whisper model is still loading - this can take 1-2 minutes on first run. The service will be ready automatically when the model finishes loading.`,
        }));
        // Don't throw error - let the service continue loading
        // The periodic health check will detect when it's ready
        startAttemptsRef.current = 0;
        return false;
      }

      // No PID means process might not have started
      throw new Error(
        `Service health check failed after ${totalWaitTime} seconds. ` +
        'The service process may not have started, or the Whisper model is still loading (can take 1-2 minutes on first run). ' +
        'Try refreshing the status in a few moments.'
      );
    } catch (error: any) {
      // Extract detailed error message
      let errorMessage = 'Failed to start voice service';

      if (error && typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error) {
        errorMessage = String(error);
      }

      console.error('Voice service start error:', error);

      setStatus((prev) => ({
        ...prev,
        isStarting: false,
        error: errorMessage,
        isRunning: false,
      }));
      startAttemptsRef.current += 1;
      return false;
    }
  }, [settings, checkServiceHealth]);

  /**
   * Automatically starts the service if needed.
   */
  const autoStartService = useCallback(async () => {
    if (settings.provider !== 'faster-whisper') {
      return;
    }

    // Check if already running
    const isRunning = await checkServiceHealth();
    if (isRunning) {
      setStatus((prev) => ({
        ...prev,
        isRunning: true,
        error: null,
      }));
      return;
    }

    // Only auto-start if we haven't exceeded max attempts
    if (startAttemptsRef.current < maxStartAttempts) {
      await startService();
    }
  }, [settings.provider, checkServiceHealth, startService]);

  /**
   * Monitors service health and auto-restarts if needed.
   */
  useEffect(() => {
    if (settings.provider !== 'faster-whisper') {
      // Clear interval if not using faster-whisper
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      setStatus({
        isRunning: false,
        isStarting: false,
        error: null,
        pid: null,
      });
      return;
    }

    // Initial check and start
    autoStartService();

    // Set up periodic health check
    checkIntervalRef.current = setInterval(async () => {
      const isRunning = await checkServiceHealth();
      if (!isRunning && !status.isStarting && startAttemptsRef.current < maxStartAttempts) {
        // Service stopped, try to restart
        console.log('Voice service stopped, attempting to restart...');
        await startService();
      } else if (isRunning && !status.isRunning) {
        // Service is running but status wasn't updated
        setStatus((prev) => ({
          ...prev,
          isRunning: true,
          error: null,
        }));
      }
    }, 10000); // Check every 10 seconds

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [settings.provider, settings.voiceServiceUrl, autoStartService, checkServiceHealth, startService, status.isStarting, status.isRunning]);

  /**
   * Manual start function (for retry).
   */
  const manualStart = useCallback(async () => {
    startAttemptsRef.current = 0; // Reset attempts
    return await startService();
  }, [startService]);

  return {
    status,
    startService: manualStart,
    checkHealth: checkServiceHealth,
  };
};
