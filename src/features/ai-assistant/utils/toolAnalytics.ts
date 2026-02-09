/**
 * File: src/features/ai-assistant/utils/toolAnalytics.ts
 *
 * Tool usage analytics and monitoring system.
 * Tracks execution metrics, performance, usage patterns, and success rates.
 */

import type { ToolExecutionMetrics } from '../types/toolMetadata';

/**
 * Aggregated tool analytics
 */
export interface ToolAnalytics {
  toolName: string;

  // Usage metrics
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number; // Percentage

  // Performance metrics
  avgExecutionTime: number; // Milliseconds
  minExecutionTime: number;
  maxExecutionTime: number;
  p50ExecutionTime: number; // Median
  p95ExecutionTime: number; // 95th percentile
  p99ExecutionTime: number; // 99th percentile

  // Volume metrics
  totalFilesProcessed: number;
  totalBytesProcessed: number;
  avgFilesPerExecution: number;
  avgBytesPerExecution: number;

  // Error analysis
  commonErrors: Array<{
    error: string;
    count: number;
    lastOccurrence: number;
  }>;

  // Usage patterns
  hourlyUsage: number[]; // Usage by hour of day (0-23)
  dailyUsage: Map<string, number>; // Usage by date (YYYY-MM-DD)
  commonParameters: Array<{
    parameter: string;
    value: any;
    frequency: number;
  }>;

  // Timing
  firstUsed: number;
  lastUsed: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Tool execution record
 */
export interface ExecutionRecord {
  id: string;
  toolName: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  filesProcessed?: number;
  bytesProcessed?: number;
  parameters?: Record<string, any>;
  memoryUsed?: number;
}

/**
 * Analytics filter options
 */
export interface AnalyticsFilter {
  toolNames?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
  successOnly?: boolean;
  minExecutions?: number;
}

/**
 * Performance trend
 */
export interface PerformanceTrend {
  toolName: string;
  trend: 'improving' | 'stable' | 'degrading';
  avgExecutionTime: number;
  changePercent: number; // Percentage change over time
  recommendation?: string;
}

/**
 * Usage insight
 */
export interface UsageInsight {
  type: 'high_usage' | 'low_usage' | 'high_errors' | 'slow_performance' | 'common_pattern';
  toolName?: string;
  message: string;
  data?: any;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Tool analytics manager
 */
export class ToolAnalyticsManager {
  private executions: Map<string, ExecutionRecord[]> = new Map(); // toolName -> records
  private analytics: Map<string, ToolAnalytics> = new Map(); // toolName -> analytics
  private maxRecordsPerTool: number = 1000; // Keep last N records per tool
  private storageKey: string = 'file-pro-tool-analytics';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Record a tool execution
   */
  recordExecution(metrics: ToolExecutionMetrics): void {
    const record: ExecutionRecord = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      toolName: metrics.toolName,
      timestamp: metrics.startTime,
      duration: metrics.duration || (metrics.endTime ? metrics.endTime - metrics.startTime : 0),
      success: metrics.success,
      error: metrics.error,
      filesProcessed: metrics.filesProcessed,
      bytesProcessed: metrics.bytesProcessed,
      parameters: metrics.parameters,
      memoryUsed: metrics.memoryUsed,
    };

    // Add to executions
    if (!this.executions.has(metrics.toolName)) {
      this.executions.set(metrics.toolName, []);
    }

    const toolExecutions = this.executions.get(metrics.toolName)!;
    toolExecutions.push(record);

    // Trim to max records
    if (toolExecutions.length > this.maxRecordsPerTool) {
      toolExecutions.splice(0, toolExecutions.length - this.maxRecordsPerTool);
    }

    // Update analytics
    this.updateAnalytics(metrics.toolName);

    // Persist
    this.saveToStorage();
  }

  /**
   * Get analytics for a specific tool
   */
  getToolAnalytics(toolName: string): ToolAnalytics | null {
    return this.analytics.get(toolName) || null;
  }

  /**
   * Get analytics for all tools
   */
  getAllAnalytics(filter?: AnalyticsFilter): ToolAnalytics[] {
    let results = Array.from(this.analytics.values());

    if (filter) {
      if (filter.toolNames) {
        results = results.filter(a => filter.toolNames!.includes(a.toolName));
      }

      if (filter.successOnly) {
        results = results.filter(a => a.successRate >= 90);
      }

      if (filter.minExecutions != null) {
        const minEx = filter.minExecutions;
        results = results.filter(a => a.totalExecutions >= minEx);
      }

      if (filter.dateRange) {
        results = results.filter(a =>
          a.lastUsed >= filter.dateRange!.start &&
          a.firstUsed <= filter.dateRange!.end
        );
      }
    }

    return results;
  }

  /**
   * Get most used tools
   */
  getMostUsedTools(limit: number = 10): ToolAnalytics[] {
    return Array.from(this.analytics.values())
      .sort((a, b) => b.totalExecutions - a.totalExecutions)
      .slice(0, limit);
  }

  /**
   * Get fastest tools
   */
  getFastestTools(limit: number = 10): ToolAnalytics[] {
    return Array.from(this.analytics.values())
      .filter(a => a.totalExecutions > 0)
      .sort((a, b) => a.avgExecutionTime - b.avgExecutionTime)
      .slice(0, limit);
  }

  /**
   * Get slowest tools
   */
  getSlowestTools(limit: number = 10): ToolAnalytics[] {
    return Array.from(this.analytics.values())
      .filter(a => a.totalExecutions > 0)
      .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
      .slice(0, limit);
  }

  /**
   * Get tools with highest error rates
   */
  getHighErrorRateTools(limit: number = 10): ToolAnalytics[] {
    return Array.from(this.analytics.values())
      .filter(a => a.totalExecutions > 0 && a.successRate < 100)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, limit);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(toolNames?: string[]): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    const toolsToAnalyze = toolNames
      ? toolNames.map(name => this.analytics.get(name)).filter(Boolean) as ToolAnalytics[]
      : Array.from(this.analytics.values());

    for (const analytics of toolsToAnalyze) {
      if (analytics.totalExecutions < 10) continue; // Need minimum data

      const executions = this.executions.get(analytics.toolName) || [];
      if (executions.length < 10) continue;

      // Split into two halves
      const midpoint = Math.floor(executions.length / 2);
      const firstHalf = executions.slice(0, midpoint);
      const secondHalf = executions.slice(midpoint);

      const firstAvg = this.calculateAverage(firstHalf.map(e => e.duration));
      const secondAvg = this.calculateAverage(secondHalf.map(e => e.duration));

      const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      let recommendation: string | undefined;

      if (changePercent < -10) {
        trend = 'improving';
        recommendation = `Performance improved by ${Math.abs(changePercent).toFixed(1)}%`;
      } else if (changePercent > 10) {
        trend = 'degrading';
        recommendation = `Performance degraded by ${changePercent.toFixed(1)}% - investigate potential issues`;
      }

      trends.push({
        toolName: analytics.toolName,
        trend,
        avgExecutionTime: analytics.avgExecutionTime,
        changePercent,
        recommendation,
      });
    }

    return trends;
  }

  /**
   * Get usage insights
   */
  getUsageInsights(): UsageInsight[] {
    const insights: UsageInsight[] = [];

    for (const analytics of this.analytics.values()) {
      // High usage tools
      if (analytics.totalExecutions > 100) {
        insights.push({
          type: 'high_usage',
          toolName: analytics.toolName,
          message: `'${analytics.toolName}' is heavily used (${analytics.totalExecutions} executions)`,
          data: { executions: analytics.totalExecutions },
          severity: 'info',
        });
      }

      // High error rate
      if (analytics.successRate < 80 && analytics.totalExecutions > 5) {
        insights.push({
          type: 'high_errors',
          toolName: analytics.toolName,
          message: `'${analytics.toolName}' has high failure rate (${(100 - analytics.successRate).toFixed(1)}%)`,
          data: {
            successRate: analytics.successRate,
            commonErrors: analytics.commonErrors.slice(0, 3),
          },
          severity: 'critical',
        });
      }

      // Slow performance
      if (analytics.avgExecutionTime > 5000 && analytics.totalExecutions > 5) {
        insights.push({
          type: 'slow_performance',
          toolName: analytics.toolName,
          message: `'${analytics.toolName}' has slow average execution time (${(analytics.avgExecutionTime / 1000).toFixed(2)}s)`,
          data: { avgTime: analytics.avgExecutionTime },
          severity: 'warning',
        });
      }

      // Low usage (potential to remove or deprecate)
      if (analytics.totalExecutions < 5 && analytics.lastUsed < Date.now() - 30 * 24 * 60 * 60 * 1000) {
        insights.push({
          type: 'low_usage',
          toolName: analytics.toolName,
          message: `'${analytics.toolName}' is rarely used (${analytics.totalExecutions} times in 30+ days)`,
          data: { executions: analytics.totalExecutions },
          severity: 'info',
        });
      }
    }

    // Sort by severity
    return insights.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get execution history for a tool
   */
  getExecutionHistory(toolName: string, limit?: number): ExecutionRecord[] {
    const records = this.executions.get(toolName) || [];
    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Clear analytics for a specific tool
   */
  clearToolAnalytics(toolName: string): void {
    this.executions.delete(toolName);
    this.analytics.delete(toolName);
    this.saveToStorage();
  }

  /**
   * Clear all analytics
   */
  clearAllAnalytics(): void {
    this.executions.clear();
    this.analytics.clear();
    this.saveToStorage();
  }

  /**
   * Export analytics to JSON
   */
  exportAnalytics(): string {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      analytics: Array.from(this.analytics.entries()).map(([name, data]) => ({
        ...data,
        toolName: name,
        dailyUsage: Array.from(data.dailyUsage.entries()),
      })),
      recentExecutions: Array.from(this.executions.entries()).map(([name, records]) => ({
        toolName: name,
        records: records.slice(-100), // Last 100 per tool
      })),
    }, null, 2);
  }

  /**
   * Update analytics for a tool
   */
  private updateAnalytics(toolName: string): void {
    const executions = this.executions.get(toolName) || [];
    if (executions.length === 0) return;

    const successful = executions.filter(e => e.success);
    const failed = executions.filter(e => !e.success);

    // Calculate percentiles
    const durations = executions.map(e => e.duration).sort((a, b) => a - b);
    const p50 = this.percentile(durations, 50);
    const p95 = this.percentile(durations, 95);
    const p99 = this.percentile(durations, 99);

    // Calculate hourly usage
    const hourlyUsage = new Array(24).fill(0);
    executions.forEach(exec => {
      const hour = new Date(exec.timestamp).getHours();
      hourlyUsage[hour]++;
    });

    // Calculate daily usage
    const dailyUsage = new Map<string, number>();
    executions.forEach(exec => {
      const date = new Date(exec.timestamp).toISOString().split('T')[0];
      dailyUsage.set(date, (dailyUsage.get(date) || 0) + 1);
    });

    // Common errors
    const errorCounts = new Map<string, number>();
    failed.forEach(exec => {
      if (exec.error) {
        errorCounts.set(exec.error, (errorCounts.get(exec.error) || 0) + 1);
      }
    });

    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({
        error,
        count,
        lastOccurrence: failed.reverse().find(e => e.error === error)?.timestamp || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate common parameters
    const parameterCounts = new Map<string, Map<any, number>>();
    executions.forEach(exec => {
      if (exec.parameters) {
        Object.entries(exec.parameters).forEach(([key, value]) => {
          if (!parameterCounts.has(key)) {
            parameterCounts.set(key, new Map());
          }
          const valueStr = JSON.stringify(value);
          const valueCounts = parameterCounts.get(key)!;
          valueCounts.set(valueStr, (valueCounts.get(valueStr) || 0) + 1);
        });
      }
    });

    const commonParameters: Array<{ parameter: string; value: any; frequency: number }> = [];
    parameterCounts.forEach((valueCounts, parameter) => {
      const sorted = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      sorted.forEach(([valueStr, count]) => {
        try {
          commonParameters.push({
            parameter,
            value: JSON.parse(valueStr),
            frequency: (count / executions.length) * 100,
          });
        } catch {
          // Skip invalid JSON
        }
      });
    });

    // Calculate trend
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (executions.length > 20) {
      const recent = executions.slice(-10);
      const older = executions.slice(-20, -10);
      if (recent.length > older.length * 1.2) trend = 'increasing';
      else if (recent.length < older.length * 0.8) trend = 'decreasing';
    }

    // Total files and bytes processed
    const totalFilesProcessed = executions.reduce((sum, e) => sum + (e.filesProcessed || 0), 0);
    const totalBytesProcessed = executions.reduce((sum, e) => sum + (e.bytesProcessed || 0), 0);

    this.analytics.set(toolName, {
      toolName,
      totalExecutions: executions.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      successRate: (successful.length / executions.length) * 100,
      avgExecutionTime: this.calculateAverage(durations),
      minExecutionTime: Math.min(...durations),
      maxExecutionTime: Math.max(...durations),
      p50ExecutionTime: p50,
      p95ExecutionTime: p95,
      p99ExecutionTime: p99,
      totalFilesProcessed,
      totalBytesProcessed,
      avgFilesPerExecution: totalFilesProcessed / executions.length,
      avgBytesPerExecution: totalBytesProcessed / executions.length,
      commonErrors,
      hourlyUsage,
      dailyUsage,
      commonParameters,
      firstUsed: executions[0].timestamp,
      lastUsed: executions[executions.length - 1].timestamp,
      trend,
    });
  }

  /**
   * Calculate average of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        executions: Array.from(this.executions.entries()).map(([name, records]) => ({
          toolName: name,
          records: records.slice(-this.maxRecordsPerTool), // Keep limited records
        })),
        savedAt: Date.now(),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('[ToolAnalytics] Could not save to storage:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);
      if (data.executions) {
        data.executions.forEach((item: { toolName: string; records: ExecutionRecord[] }) => {
          this.executions.set(item.toolName, item.records);
          this.updateAnalytics(item.toolName);
        });
      }

      console.log(`[ToolAnalytics] Loaded ${this.executions.size} tool analytics from storage`);
    } catch (error) {
      console.warn('[ToolAnalytics] Could not load from storage:', error);
    }
  }
}

/**
 * Singleton instance
 */
export const toolAnalyticsManager = new ToolAnalyticsManager();
