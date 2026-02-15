/**
 * File: src/features/ai-assistant/utils/auditLogger.ts
 *
 * Audit logging service for tracking all AI operations.
 * Provides comprehensive logging for compliance, debugging, and analysis.
 *
 * Key features:
 * - Configurable log levels and categories
 * - Automatic log rotation and retention
 * - Search and filtering capabilities
 * - Export functionality (JSON, CSV, TXT)
 * - Statistics and analytics
 * - Privacy controls for sensitive data
 */

import type {
  AuditLogSettings,
  AuditLogLevel,
  AuditLogCategory,
  AuditLogEntry,
  AuditLogFilter,
  AuditLogStats,
  AuditLogExportFormat,
  AuditLogExport,
} from '../types';
import { DEFAULT_AUDIT_LOG_SETTINGS, AUDIT_LOG_LEVEL_VALUES } from '../types';

/**
 * Storage key for persisting audit logs.
 */
const STORAGE_KEY = 'file-pro-audit-logs';
const SESSION_KEY = 'file-pro-audit-session';

/**
 * Listener callback type for log changes.
 */
type AuditLogListener = (entry: AuditLogEntry, stats: AuditLogStats) => void;

/**
 * AuditLogger class handles all audit logging functionality.
 */
export class AuditLogger {
  private settings: AuditLogSettings;
  private logs: AuditLogEntry[] = [];
  private listeners: Set<AuditLogListener> = new Set();
  private sessionId: string;
  private isInitialized: boolean = false;

  constructor(settings?: Partial<AuditLogSettings>) {
    this.settings = { ...DEFAULT_AUDIT_LOG_SETTINGS, ...settings };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Initializes the audit logger and loads persisted logs.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load or create session ID
    const storedSession = sessionStorage.getItem(SESSION_KEY);
    if (storedSession) {
      this.sessionId = storedSession;
    } else {
      sessionStorage.setItem(SESSION_KEY, this.sessionId);
    }

    // Load persisted logs
    if (this.settings.persistLogs) {
      this.loadFromStorage();
    }

    // Apply retention policy
    this.applyRetentionPolicy();

    this.isInitialized = true;

    // Log session start
    this.log({
      level: 'info',
      category: 'session',
      action: 'session_start',
      message: 'Audit logging session started',
      success: true,
      metadata: {
        sessionId: this.sessionId,
        settings: this.sanitizeSettings(this.settings),
      },
    });

    console.log(`[AuditLogger] Initialized with ${this.logs.length} log entries`);
  }

  /**
   * Updates the settings.
   */
  updateSettings(newSettings: Partial<AuditLogSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };

    // Log settings change
    this.log({
      level: 'info',
      category: 'settings',
      action: 'settings_updated',
      message: 'Audit log settings updated',
      success: true,
      metadata: {
        oldSettings: this.sanitizeSettings(oldSettings),
        newSettings: this.sanitizeSettings(this.settings),
      },
    });

    // Apply new retention policy if changed
    if (newSettings.retentionDays !== undefined || newSettings.maxEntries !== undefined) {
      this.applyRetentionPolicy();
    }
  }

  /**
   * Gets the current settings.
   */
  getSettings(): AuditLogSettings {
    return { ...this.settings };
  }

  /**
   * Gets the current session ID.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Generates a unique session ID.
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates a unique log entry ID.
   */
  private generateEntryId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Main logging method.
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'sessionId'>): AuditLogEntry | null {
    if (!this.settings.enabled) return null;

    // Check log level threshold
    if (AUDIT_LOG_LEVEL_VALUES[entry.level] < AUDIT_LOG_LEVEL_VALUES[this.settings.logLevel]) {
      return null;
    }

    const fullEntry: AuditLogEntry = {
      ...entry,
      id: this.generateEntryId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      // Sanitize based on settings
      toolArgs: this.settings.includeArguments ? entry.toolArgs : undefined,
      affectedFiles: this.settings.includeFilePaths ? entry.affectedFiles : undefined,
      userPrompt: this.settings.includeUserPrompts ? entry.userPrompt : undefined,
    };

    // Add to logs
    this.logs.push(fullEntry);

    // Trim if exceeds max entries
    this.trimLogs();

    // Persist
    this.saveToStorage();

    // Notify listeners
    this.notifyListeners(fullEntry);

    // Console output for debugging
    this.consoleOutput(fullEntry);

    return fullEntry;
  }

  /**
   * Convenience methods for different log levels.
   */
  debug(category: AuditLogCategory, action: string, message: string, extra?: Partial<AuditLogEntry>): AuditLogEntry | null {
    return this.log({ level: 'debug', category, action, message, success: true, ...extra });
  }

  info(category: AuditLogCategory, action: string, message: string, extra?: Partial<AuditLogEntry>): AuditLogEntry | null {
    return this.log({ level: 'info', category, action, message, success: true, ...extra });
  }

  warn(category: AuditLogCategory, action: string, message: string, extra?: Partial<AuditLogEntry>): AuditLogEntry | null {
    return this.log({ level: 'warn', category, action, message, success: true, ...extra });
  }

  error(category: AuditLogCategory, action: string, message: string, error?: string, extra?: Partial<AuditLogEntry>): AuditLogEntry | null {
    return this.log({ level: 'error', category, action, message, success: false, error, ...extra });
  }

  critical(category: AuditLogCategory, action: string, message: string, error?: string, extra?: Partial<AuditLogEntry>): AuditLogEntry | null {
    return this.log({ level: 'critical', category, action, message, success: false, error, ...extra });
  }

  /**
   * Logs a tool execution.
   */
  logToolExecution(
    toolName: string,
    args: Record<string, any>,
    success: boolean,
    duration: number,
    options?: {
      error?: string;
      affectedFiles?: string[];
      fileCount?: number;
      messageId?: string;
      userPrompt?: string;
    }
  ): AuditLogEntry | null {
    return this.log({
      level: success ? 'info' : 'error',
      category: 'tool_execution',
      action: `execute_${toolName}`,
      message: success 
        ? `Tool "${toolName}" executed successfully`
        : `Tool "${toolName}" failed: ${options?.error || 'Unknown error'}`,
      success,
      error: options?.error,
      duration,
      toolName,
      toolArgs: args,
      affectedFiles: options?.affectedFiles,
      fileCount: options?.fileCount,
      messageId: options?.messageId,
      userPrompt: options?.userPrompt,
    });
  }

  /**
   * Logs a file operation.
   */
  logFileOperation(
    operation: string,
    filePaths: string[],
    success: boolean,
    options?: {
      error?: string;
      duration?: number;
      toolName?: string;
    }
  ): AuditLogEntry | null {
    return this.log({
      level: success ? 'info' : 'error',
      category: 'file_operation',
      action: operation,
      message: success
        ? `File operation "${operation}" completed on ${filePaths.length} file(s)`
        : `File operation "${operation}" failed: ${options?.error || 'Unknown error'}`,
      success,
      error: options?.error,
      duration: options?.duration,
      toolName: options?.toolName,
      affectedFiles: filePaths,
      fileCount: filePaths.length,
    });
  }

  /**
   * Logs an AI request.
   */
  logAIRequest(
    model: string,
    userPrompt: string,
    options?: {
      messageId?: string;
      metadata?: Record<string, any>;
    }
  ): AuditLogEntry | null {
    return this.log({
      level: 'info',
      category: 'ai_request',
      action: 'ai_request',
      message: `AI request sent to ${model}`,
      success: true,
      model,
      userPrompt,
      messageId: options?.messageId,
      metadata: options?.metadata,
    });
  }

  /**
   * Logs an AI response.
   */
  logAIResponse(
    model: string,
    success: boolean,
    duration: number,
    options?: {
      error?: string;
      messageId?: string;
      toolsUsed?: string[];
    }
  ): AuditLogEntry | null {
    return this.log({
      level: success ? 'info' : 'error',
      category: 'ai_response',
      action: 'ai_response',
      message: success
        ? `AI response received from ${model} in ${duration}ms`
        : `AI response failed from ${model}: ${options?.error || 'Unknown error'}`,
      success,
      error: options?.error,
      duration,
      model,
      messageId: options?.messageId,
      metadata: options?.toolsUsed ? { toolsUsed: options.toolsUsed } : undefined,
    });
  }

  /**
   * Logs a permission check.
   */
  logPermissionCheck(
    toolName: string,
    allowed: boolean,
    reason?: string
  ): AuditLogEntry | null {
    return this.log({
      level: allowed ? 'debug' : 'warn',
      category: 'permission',
      action: 'permission_check',
      message: allowed
        ? `Permission granted for tool "${toolName}"`
        : `Permission denied for tool "${toolName}": ${reason || 'No reason provided'}`,
      success: allowed,
      toolName,
      metadata: { reason },
    });
  }

  /**
   * Logs a security event.
   */
  logSecurityEvent(
    action: string,
    message: string,
    level: AuditLogLevel = 'warn',
    metadata?: Record<string, any>
  ): AuditLogEntry | null {
    return this.log({
      level,
      category: 'security',
      action,
      message,
      success: level !== 'error' && level !== 'critical',
      metadata,
    });
  }

  /**
   * Gets all logs.
   */
  getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  /**
   * Gets logs with filtering.
   */
  getFilteredLogs(filter: AuditLogFilter): AuditLogEntry[] {
    let filtered = [...this.logs];

    // Filter by minimum level
    if (filter.minLevel) {
      const minValue = AUDIT_LOG_LEVEL_VALUES[filter.minLevel];
      filtered = filtered.filter(log => AUDIT_LOG_LEVEL_VALUES[log.level] >= minValue);
    }

    // Filter by categories
    if (filter.categories && filter.categories.length > 0) {
      filtered = filtered.filter(log => filter.categories!.includes(log.category));
    }

    // Filter by tool names
    if (filter.toolNames && filter.toolNames.length > 0) {
      filtered = filtered.filter(log => log.toolName && filter.toolNames!.includes(log.toolName));
    }

    // Filter by success
    if (filter.success !== undefined) {
      filtered = filtered.filter(log => log.success === filter.success);
    }

    // Filter by date range
    if (filter.fromDate) {
      filtered = filtered.filter(log => log.timestamp >= filter.fromDate!);
    }
    if (filter.toDate) {
      filtered = filtered.filter(log => log.timestamp <= filter.toDate!);
    }

    // Filter by session ID
    if (filter.sessionId) {
      filtered = filtered.filter(log => log.sessionId === filter.sessionId);
    }

    // Search in message text
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.action.toLowerCase().includes(searchLower) ||
        (log.toolName && log.toolName.toLowerCase().includes(searchLower))
      );
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    if (filter.offset) {
      filtered = filtered.slice(filter.offset);
    }
    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Gets a single log entry by ID.
   */
  getLogById(id: string): AuditLogEntry | undefined {
    return this.logs.find(log => log.id === id);
  }

  /**
   * Gets recent logs (newest first).
   */
  getRecentLogs(count: number = 50): AuditLogEntry[] {
    return [...this.logs].sort((a, b) => b.timestamp - a.timestamp).slice(0, count);
  }

  /**
   * Gets log statistics.
   */
  getStats(): AuditLogStats {
    const byLevel: Record<AuditLogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0,
    };

    const byCategory: Record<AuditLogCategory, number> = {
      tool_execution: 0,
      file_operation: 0,
      ai_request: 0,
      ai_response: 0,
      permission: 0,
      settings: 0,
      session: 0,
      error: 0,
      security: 0,
    };

    const toolCounts: Record<string, number> = {};
    let successCount = 0;
    let errorCount = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const log of this.logs) {
      byLevel[log.level]++;
      byCategory[log.category]++;

      if (log.success) successCount++;
      else errorCount++;

      if (log.toolName) {
        toolCounts[log.toolName] = (toolCounts[log.toolName] || 0) + 1;
      }

      if (log.duration) {
        totalDuration += log.duration;
        durationCount++;
      }
    }

    // Get top tools
    const topTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count }));

    return {
      totalEntries: this.logs.length,
      byLevel,
      byCategory,
      successRate: this.logs.length > 0 ? (successCount / this.logs.length) * 100 : 100,
      errorCount,
      topTools,
      oldestEntry: this.logs.length > 0 ? Math.min(...this.logs.map(l => l.timestamp)) : undefined,
      newestEntry: this.logs.length > 0 ? Math.max(...this.logs.map(l => l.timestamp)) : undefined,
      avgDuration: durationCount > 0 ? totalDuration / durationCount : undefined,
    };
  }

  /**
   * Exports logs to specified format.
   */
  exportLogs(format: AuditLogExportFormat, filter?: AuditLogFilter): AuditLogExport {
    const logs = filter ? this.getFilteredLogs(filter) : this.logs;
    let data: string;

    switch (format) {
      case 'json':
        data = JSON.stringify(logs, null, 2);
        break;

      case 'csv':
        const headers = ['timestamp', 'level', 'category', 'action', 'message', 'success', 'error', 'duration', 'toolName', 'fileCount'];
        const rows = logs.map(log => [
          new Date(log.timestamp).toISOString(),
          log.level,
          log.category,
          log.action,
          `"${log.message.replace(/"/g, '""')}"`,
          log.success,
          log.error ? `"${log.error.replace(/"/g, '""')}"` : '',
          log.duration || '',
          log.toolName || '',
          log.fileCount || '',
        ].join(','));
        data = [headers.join(','), ...rows].join('\n');
        break;

      case 'txt':
        data = logs.map(log => {
          const timestamp = new Date(log.timestamp).toISOString();
          const level = log.level.toUpperCase().padEnd(8);
          const category = log.category.padEnd(15);
          return `[${timestamp}] ${level} ${category} ${log.message}${log.error ? ` | Error: ${log.error}` : ''}`;
        }).join('\n');
        break;
    }

    return {
      format,
      exportedAt: Date.now(),
      entryCount: logs.length,
      filter,
      data,
    };
  }

  /**
   * Clears all logs.
   */
  clearLogs(): void {
    const count = this.logs.length;
    this.logs = [];
    this.saveToStorage();

    this.log({
      level: 'warn',
      category: 'settings',
      action: 'logs_cleared',
      message: `Cleared ${count} audit log entries`,
      success: true,
      metadata: { clearedCount: count },
    });
  }

  /**
   * Clears logs older than specified days.
   */
  clearOldLogs(days: number): number {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const originalCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);
    const removedCount = originalCount - this.logs.length;
    
    if (removedCount > 0) {
      this.saveToStorage();
      this.log({
        level: 'info',
        category: 'settings',
        action: 'old_logs_cleared',
        message: `Cleared ${removedCount} log entries older than ${days} days`,
        success: true,
        metadata: { removedCount, days },
      });
    }

    return removedCount;
  }

  /**
   * Registers a listener for new log entries.
   */
  addListener(listener: AuditLogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners of a new log entry.
   */
  private notifyListeners(entry: AuditLogEntry): void {
    const stats = this.getStats();
    for (const listener of this.listeners) {
      try {
        listener(entry, stats);
      } catch (error) {
        console.error('[AuditLogger] Listener error:', error);
      }
    }
  }

  /**
   * Trims logs to max entries.
   */
  private trimLogs(): void {
    if (this.logs.length > this.settings.maxEntries) {
      const toRemove = this.logs.length - this.settings.maxEntries;
      // Sort by timestamp and remove oldest
      this.logs.sort((a, b) => a.timestamp - b.timestamp);
      this.logs = this.logs.slice(toRemove);
    }
  }

  /**
   * Applies retention policy to logs.
   */
  private applyRetentionPolicy(): void {
    if (this.settings.retentionDays > 0) {
      this.clearOldLogs(this.settings.retentionDays);
    }
    this.trimLogs();
  }

  /**
   * Saves logs to localStorage.
   */
  private saveToStorage(): void {
    if (!this.settings.persistLogs) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        logs: this.logs,
        savedAt: Date.now(),
      }));
    } catch (error) {
      console.warn('[AuditLogger] Could not save to storage:', error);
    }
  }

  /**
   * Loads logs from localStorage.
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.logs = data.logs || [];
        console.log(`[AuditLogger] Loaded ${this.logs.length} logs from storage`);
      }
    } catch (error) {
      console.warn('[AuditLogger] Could not load from storage:', error);
      this.logs = [];
    }
  }

  /**
   * Outputs log entry to console.
   */
  private consoleOutput(entry: AuditLogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[AuditLog ${entry.level.toUpperCase()}]`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(prefix, timestamp, entry.message);
        break;
      case 'info':
        console.info(prefix, timestamp, entry.message);
        break;
      case 'warn':
        console.warn(prefix, timestamp, entry.message);
        break;
      case 'error':
      case 'critical':
        console.error(prefix, timestamp, entry.message, entry.error || '');
        break;
    }
  }

  /**
   * Sanitizes settings for logging (removes sensitive data).
   */
  private sanitizeSettings(settings: AuditLogSettings): Partial<AuditLogSettings> {
    return {
      enabled: settings.enabled,
      logLevel: settings.logLevel,
      maxEntries: settings.maxEntries,
      persistLogs: settings.persistLogs,
      retentionDays: settings.retentionDays,
    };
  }
}

/**
 * Singleton instance with default settings.
 */
export const auditLogger = new AuditLogger();

/**
 * Factory function to create a logger with custom settings.
 */
export function createAuditLogger(settings?: Partial<AuditLogSettings>): AuditLogger {
  return new AuditLogger(settings);
}

/**
 * Helper to format duration for display.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Helper to format timestamp for display.
 */
export function formatLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Gets color class for log level.
 */
export function getLogLevelColor(level: AuditLogLevel): string {
  switch (level) {
    case 'debug': return 'text-gray-500';
    case 'info': return 'text-blue-500';
    case 'warn': return 'text-yellow-500';
    case 'error': return 'text-red-500';
    case 'critical': return 'text-red-700';
  }
}

/**
 * Gets icon name for log category.
 */
export function getLogCategoryIcon(category: AuditLogCategory): string {
  switch (category) {
    case 'tool_execution': return 'Wrench';
    case 'file_operation': return 'FileText';
    case 'ai_request': return 'Send';
    case 'ai_response': return 'MessageSquare';
    case 'permission': return 'Shield';
    case 'settings': return 'Settings';
    case 'session': return 'User';
    case 'error': return 'AlertCircle';
    case 'security': return 'Lock';
  }
}
