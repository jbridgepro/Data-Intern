import type { AuditLogEntry, AuditAction } from '../types';
import { DEFAULT_AUDIT_KEY } from '../types';

function loadAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(DEFAULT_AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAuditLogs(logs: AuditLogEntry[]): void {
  try {
    localStorage.setItem(DEFAULT_AUDIT_KEY, JSON.stringify(logs.slice(0, 500)));
  } catch {}
}

export function addAuditLog(
  curationRunId: string,
  action: AuditAction,
  details: string,
  metadata?: Record<string, unknown>
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    curationRunId,
    action,
    details,
    metadata,
    timestamp: new Date().toISOString(),
  };
  const logs = loadAuditLogs();
  logs.unshift(entry);
  saveAuditLogs(logs);
  return entry;
}

export function getAuditLogsForRun(curationRunId: string): AuditLogEntry[] {
  return loadAuditLogs().filter((l) => l.curationRunId === curationRunId);
}

export function getAllAuditLogs(limit = 100): AuditLogEntry[] {
  return loadAuditLogs().slice(0, limit);
}

export function clearAuditLogs(): void {
  localStorage.removeItem(DEFAULT_AUDIT_KEY);
}
