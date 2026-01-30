/**
 * File: src/features/quick-tools/pages/AudioTranscription.tsx
 *
 * Audio Transcription quick-tool page: record or upload audio and transcribe via
 * VibeVoice-ASR or Faster-Whisper. Supports service options, health check,
 * expandable transcript in the job list, and a dedicated "View transcript"
 * overlay to read the full transcript once created (with optional segments).
 */

import React, { useRef, useCallback, useEffect, useState } from "react";
import {
  Mic,
  Upload,
  Play,
  Pause,
  Copy,
  CheckCircle,
  Loader2,
  FileAudio,
  Trash2,
  Download,
  StopCircle,
  Circle,
  Settings2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAudioTranscription,
  TranscriptionJob,
  TranscriptionSegment,
  TranscriptionProvider,
  type VoiceServiceHealth,
} from "../contexts/AudioTranscriptionContext";

export const AudioTranscription: React.FC = () => {
  const {
    jobs,
    isRecording,
    audioLevel,
    options,
    startRecording,
    stopRecording,
    transcribeFile,
    clearJob,
    clearAllJobs,
    downloadAudio,
    downloadTranscript,
    updateOptions,
    checkHealth,
    startService,
  } = useAudioTranscription();

  const [copied, setCopied] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [viewingTranscriptJobId, setViewingTranscriptJobId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [health, setHealth] = useState<VoiceServiceHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [serviceStarting, setServiceStarting] = useState(false);
  const [serviceStartError, setServiceStartError] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const result = await checkHealth();
      setHealth(result);
    } finally {
      setHealthLoading(false);
    }
  }, [checkHealth]);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const handleStartService = useCallback(async () => {
    setServiceStartError(null);
    setServiceStarting(true);
    try {
      const result = await startService();
      if (!result.success) {
        setServiceStartError(result.error ?? "Failed to start service");
        setServiceStarting(false);
        return;
      }
      // Poll health until ready or timeout (first load can take 1–2 minutes)
      const maxAttempts = 45;
      const delayMs = 3000;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, delayMs));
        const h = await checkHealth();
        if (h?.status === "healthy" || h?.whisper_available) {
          setHealth(h);
          setServiceStarting(false);
          return;
        }
        setHealth(h);
      }
      setServiceStarting(false);
    } catch (err) {
      setServiceStartError(err instanceof Error ? err.message : "Failed to start");
      setServiceStarting(false);
    }
  }, [startService, checkHealth]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      transcribeFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("audio/")) {
        transcribeFile(file);
      }
    },
    [transcribeFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const copyTranscript = (jobId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(jobId);
    setTimeout(() => setCopied(null), 2000);
  };

  const togglePlayback = (jobId: string) => {
    const audio = audioRefs.current[jobId];
    if (!audio) return;

    if (playingId === jobId) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Pause any other playing audio
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId]?.pause();
      }
      audio.play();
      setPlayingId(jobId);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /** Format segment timestamp (e.g. 65.2 -> "1:05") */
  const formatSegmentTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status: TranscriptionJob["status"]) => {
    switch (status) {
      case "recording":
        return "text-red-500";
      case "processing":
        return "text-amber-500";
      case "completed":
        return "text-emerald-500";
      case "error":
        return "text-red-500";
      default:
        return "text-slate-500";
    }
  };

  const isServiceHealthy = health?.status === "healthy" || health?.whisper_available;
  const providerLabel: Record<TranscriptionProvider, string> = {
    "vibevoice-asr": "VibeVoice-ASR",
    "faster-whisper": "Faster-Whisper",
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
            <Mic className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Audio Transcription
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Record or upload audio — {providerLabel[options.provider]}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Service status with clearer message and Start service option */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
              isServiceHealthy
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
            )}
          >
            {healthLoading || serviceStarting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : isServiceHealthy ? (
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {healthLoading
                ? "Checking…"
                : serviceStarting
                  ? "Starting voice service…"
                  : isServiceHealthy
                    ? "Service ready"
                    : "Voice service not running"}
            </span>
            {!isServiceHealthy && !serviceStarting && (
              <button
                type="button"
                onClick={handleStartService}
                className="shrink-0 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                title="Start the voice service (Python process)"
              >
                Start service
              </button>
            )}
            <button
              type="button"
              onClick={refreshHealth}
              className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
              title="Refresh status"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 shrink-0", healthLoading && "animate-spin")} />
            </button>
          </div>
          {/* Show error or hint when unavailable */}
          {!isServiceHealthy && !healthLoading && health?.error && !serviceStarting && (
            <span className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400" title={health.error}>
              {health.error}
            </span>
          )}
          {serviceStartError && (
            <span className="max-w-xs truncate text-xs text-red-600 dark:text-red-400" title={serviceStartError}>
              {serviceStartError}
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              showSettings
                ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            )}
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </button>

          {jobs.length > 0 && (
            <button
              onClick={clearAllJobs}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </button>
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
              isRecording
                ? "bg-red-600 hover:bg-red-700 animate-pulse"
                : "bg-violet-600 hover:bg-violet-700"
            )}
          >
            {isRecording ? (
              <>
                <StopCircle className="h-4 w-4" />
                Stop Recording
              </>
            ) : (
              <>
                <Circle className="h-4 w-4 fill-current" />
                Record
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Transcription options</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="audio-transcription-service-url" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Service URL
              </label>
              <input
                id="audio-transcription-service-url"
                type="url"
                value={options.serviceUrl}
                onChange={(e) => updateOptions({ serviceUrl: e.target.value.trim() })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                placeholder="http://127.0.0.1:8765"
              />
            </div>
            <div>
              <label htmlFor="audio-transcription-provider" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Provider
              </label>
              <select
                id="audio-transcription-provider"
                value={options.provider}
                onChange={(e) => updateOptions({ provider: e.target.value as TranscriptionProvider })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Transcription provider"
              >
                <option value="vibevoice-asr">VibeVoice-ASR</option>
                <option value="faster-whisper">Faster-Whisper</option>
              </select>
            </div>
            <div>
              <label htmlFor="audio-transcription-language" className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Language (optional)
              </label>
              <input
                id="audio-transcription-language"
                type="text"
                value={options.language ?? ""}
                onChange={(e) => updateOptions({ language: e.target.value.trim() || null })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                placeholder="e.g. en, es, auto"
              />
            </div>
            <div className="flex items-end">
              <label htmlFor="audio-transcription-diarization" className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  id="audio-transcription-diarization"
                  type="checkbox"
                  checked={options.enableDiarization}
                  onChange={(e) => updateOptions({ enableDiarization: e.target.checked })}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  aria-label="Enable speaker diarization"
                />
                Speaker diarization
              </label>
            </div>
          </div>
          {health?.error && !isServiceHealthy && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{health.error}</p>
          )}
          {!isServiceHealthy && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Use &quot;Start service&quot; above, or run manually from the project:{" "}
              <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">cd voice-service && python3 voice_service.py</code>
            </p>
          )}
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-red-500 animate-ping opacity-50" />
              <Circle className="absolute h-4 w-4 fill-red-500 text-red-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-red-700 dark:text-red-300">Recording...</div>
              <div className="mt-1 h-2 rounded-full bg-red-200 dark:bg-red-900/50 overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-red-600 dark:text-red-400">
              Navigate away freely - recording continues!
            </span>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        {/* Left: Upload Zone with drag feedback */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors cursor-pointer",
            isDragging
              ? "border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/30"
              : "border-slate-200 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/50 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-violet-600 dark:hover:bg-violet-900/20"
          )}
        >
          <Upload className="mb-4 h-12 w-12 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isDragging ? "Drop audio file here" : "Drop audio file here or click to browse"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Supports MP3, WAV, M4A, OGG, FLAC</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
            aria-label="Upload audio file for transcription"
          />
        </div>

        {/* Right: Jobs List */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Transcription Jobs ({jobs.length})
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                <FileAudio className="h-12 w-12 mb-4" />
                <p className="text-sm text-center">No transcription jobs yet.<br />Record or upload audio to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {/* Job Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {job.type === "recording" ? (
                          <Mic className="h-4 w-4 text-violet-500" />
                        ) : (
                          <FileAudio className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                          {job.name}
                        </span>
                      </div>
                      <span className={cn("text-xs font-medium capitalize", getStatusColor(job.status))}>
                        {job.status === "processing" && <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />}
                        {job.status}
                      </span>
                    </div>

                    {/* Progress Bar (if processing) */}
                    {job.status === "processing" && (
                      <div className="mb-2">
                        <div className="h-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 overflow-hidden">
                          <div
                            className="h-full bg-violet-500 transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {job.status === "error" && job.error && (
                      <div className="mb-2 text-xs text-red-500">{job.error}</div>
                    )}

                    {/* Audio Player */}
                    {job.audioUrl && job.status !== "recording" && (
                      <div className="mb-2 flex items-center gap-2">
                        <button
                          onClick={() => togglePlayback(job.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:hover:bg-violet-900/50"
                        >
                          {playingId === job.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                        </button>
                        <audio
                          ref={(el) => { audioRefs.current[job.id] = el; }}
                          src={job.audioUrl}
                          onEnded={() => setPlayingId(null)}
                          className="hidden"
                        />
                        <span className="text-xs text-slate-500">Audio</span>
                      </div>
                    )}

                    {/* Transcript: expandable preview / full text */}
                    {(job.transcript || job.status === "completed") && (
                      <div className="mb-2">
                        {job.transcript ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedJobId((id) => (id === job.id ? null : job.id))}
                              className="flex w-full items-center gap-1 text-left text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              {expandedJobId === job.id ? (
                                <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                              )}
                              {expandedJobId === job.id ? "Hide transcript" : "Show full transcript"}
                            </button>
                            <div
                              className={cn(
                                "mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400",
                                expandedJobId !== job.id && "line-clamp-2"
                              )}
                            >
                              {job.transcript}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs italic text-slate-400">
                            No transcript text available.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Segments (timestamps + optional speaker) */}
                    {job.status === "completed" && job.segments && job.segments.length > 0 && (
                      <div className="mb-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-800/30">
                        <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Segments</p>
                        <div className="max-h-32 space-y-1 overflow-y-auto">
                          {job.segments.map((seg: TranscriptionSegment, idx: number) => (
                            <div
                              key={idx}
                              className="flex gap-2 text-xs text-slate-600 dark:text-slate-400"
                            >
                              <span className="shrink-0 font-mono text-slate-500 dark:text-slate-500">
                                {formatSegmentTime(seg.start)}–{formatSegmentTime(seg.end)}
                              </span>
                              {seg.speaker && (
                                <span className="shrink-0 font-medium text-violet-600 dark:text-violet-400">
                                  {seg.speaker}:
                                </span>
                              )}
                              <span className="min-w-0 flex-1">{seg.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {job.status === "completed" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingTranscriptJobId(job.id)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/30"
                          title="View full transcript"
                        >
                          <FileText className="h-3 w-3" />
                          View transcript
                        </button>
                        <button
                          onClick={() => copyTranscript(job.id, job.transcript)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          {copied === job.id ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          Copy
                        </button>
                        <button
                          onClick={() => downloadTranscript(job.id)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          <Download className="h-3 w-3" />
                          Transcript
                        </button>
                        {job.audioUrl && (
                          <button
                            onClick={() => downloadAudio(job.id)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                          >
                            <Download className="h-3 w-3" />
                            Audio
                          </button>
                        )}
                        <button
                          onClick={() => clearJob(job.id)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transcript viewer overlay: full transcript once created */}
      {viewingTranscriptJobId && (() => {
        const viewingJob = jobs.find((j) => j.id === viewingTranscriptJobId);
        if (!viewingJob?.transcript) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transcript-viewer-title"
            onClick={() => setViewingTranscriptJobId(null)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-5 w-5 shrink-0 text-violet-500 dark:text-violet-400" />
                  <h2 id="transcript-viewer-title" className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                    {viewingJob.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingTranscriptJobId(null)}
                  className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Close transcript view"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Full transcript */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {viewingJob.transcript}
                </div>
                {/* Segments when available */}
                {viewingJob.segments && viewingJob.segments.length > 0 && (
                  <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Segments (with timestamps)
                    </h3>
                    <div className="space-y-2">
                      {viewingJob.segments.map((seg: TranscriptionSegment, idx: number) => (
                        <div
                          key={idx}
                          className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
                        >
                          <span className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {formatSegmentTime(seg.start)} – {formatSegmentTime(seg.end)}
                          </span>
                          {seg.speaker && (
                            <span className="shrink-0 font-medium text-violet-600 dark:text-violet-400">
                              {seg.speaker}:
                            </span>
                          )}
                          <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-300">{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Footer actions */}
              <div className="flex gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    copyTranscript(viewingJob.id, viewingJob.transcript);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {copied === viewingJob.id ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => downloadTranscript(viewingJob.id)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTranscriptJobId(null)}
                  className="ml-auto flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
