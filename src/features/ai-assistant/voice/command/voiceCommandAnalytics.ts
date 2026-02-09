/**
 * File: src/features/ai-assistant/voice/command/voiceCommandAnalytics.ts
 *
 * Lightweight analytics for voice command recognition.
 * Tracks counts, latency, confidence, and recent misses.
 */

import type { VoiceCommand } from "./voiceCommand";

export interface VoiceCommandMiss {
  text: string;
  reason: "unknown-intent" | "low-confidence";
  confidence: number;
  intent: string;
  timestamp: number;
}

interface VoiceCommandAnalyticsState {
  totalCommands: number;
  totalMisses: number;
  totalConfidence: number;
  totalLatencyMs: number;
  intentCounts: Record<string, number>;
  toolCounts: Record<string, number>;
  recentMisses: VoiceCommandMiss[];
  lastUpdated: number;
}

export interface VoiceCommandAnalyticsSnapshot {
  totalCommands: number;
  totalMisses: number;
  missRate: number;
  avgConfidence: number;
  avgLatencyMs: number;
  intentCounts: Record<string, number>;
  toolCounts: Record<string, number>;
  recentMisses: VoiceCommandMiss[];
  lastUpdated: number;
}

const STORAGE_KEY = "file-pro-voice-command-analytics";
const MAX_MISSES = 10;
const LOW_CONFIDENCE_THRESHOLD = 0.45;

const createEmptyState = (): VoiceCommandAnalyticsState => ({
  totalCommands: 0,
  totalMisses: 0,
  totalConfidence: 0,
  totalLatencyMs: 0,
  intentCounts: {},
  toolCounts: {},
  recentMisses: [],
  lastUpdated: Date.now(),
});

class VoiceCommandAnalyticsManager {
  private state: VoiceCommandAnalyticsState = createEmptyState();

  constructor() {
    this.state = this.loadState();
  }

  record(command: VoiceCommand, rawText: string) {
    if (typeof window === "undefined") return;

    const intent = command.intent || "unknown";
    const confidence = Number.isFinite(command.confidence)
      ? command.confidence
      : 0;
    const latencyMs = Number.isFinite(command.processingTime)
      ? command.processingTime || 0
      : 0;

    this.state.totalCommands += 1;
    this.state.totalConfidence += confidence;
    this.state.totalLatencyMs += latencyMs;
    this.state.intentCounts[intent] =
      (this.state.intentCounts[intent] || 0) + 1;

    if (command.tool) {
      this.state.toolCounts[command.tool] =
        (this.state.toolCounts[command.tool] || 0) + 1;
    }

    const isUnknown = intent === "unknown";
    const isLowConfidence = confidence > 0 && confidence < LOW_CONFIDENCE_THRESHOLD;
    if (isUnknown || isLowConfidence) {
      this.state.totalMisses += 1;
      const miss: VoiceCommandMiss = {
        text: rawText,
        reason: isUnknown ? "unknown-intent" : "low-confidence",
        confidence,
        intent,
        timestamp: Date.now(),
      };
      this.state.recentMisses = [miss, ...this.state.recentMisses].slice(
        0,
        MAX_MISSES,
      );
    }

    this.state.lastUpdated = Date.now();
    this.saveState();
  }

  getSnapshot(): VoiceCommandAnalyticsSnapshot {
    const total = this.state.totalCommands || 0;
    const avgConfidence = total
      ? this.state.totalConfidence / total
      : 0;
    const avgLatencyMs = total
      ? this.state.totalLatencyMs / total
      : 0;
    const missRate = total ? this.state.totalMisses / total : 0;

    return {
      totalCommands: total,
      totalMisses: this.state.totalMisses,
      missRate,
      avgConfidence,
      avgLatencyMs,
      intentCounts: { ...this.state.intentCounts },
      toolCounts: { ...this.state.toolCounts },
      recentMisses: [...this.state.recentMisses],
      lastUpdated: this.state.lastUpdated,
    };
  }

  reset() {
    this.state = createEmptyState();
    this.saveState();
  }

  private loadState(): VoiceCommandAnalyticsState {
    if (typeof window === "undefined") return createEmptyState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createEmptyState();
      const parsed = JSON.parse(raw) as VoiceCommandAnalyticsState;
      return {
        ...createEmptyState(),
        ...parsed,
        intentCounts: parsed.intentCounts || {},
        toolCounts: parsed.toolCounts || {},
        recentMisses: parsed.recentMisses || [],
      };
    } catch (error) {
      console.warn("[VoiceAnalytics] Failed to load state:", error);
      return createEmptyState();
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn("[VoiceAnalytics] Failed to save state:", error);
    }
  }
}

export const voiceCommandAnalytics = new VoiceCommandAnalyticsManager();
