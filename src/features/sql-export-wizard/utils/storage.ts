/**
 * File path: src/features/sql-export-wizard/utils/storage.ts
 * 
 * Frontend utility for managing local storage of connections, templates, and queries
 * Handles persistence of user data
 */

import {
  ActivityEntry,
  DatabaseConnection,
  ExportTemplate,
  ImportTemplate,
  SavedQuery,
  ScheduledExport,
} from "../types";
import { encryptPassword, decryptPassword } from "./databaseConnection";

const STORAGE_KEYS = {
  CONNECTIONS: "sql-export-wizard-connections",
  TEMPLATES: "sql-export-wizard-templates",
  IMPORT_TEMPLATES: "sql-export-wizard-import-templates",
  QUERIES: "sql-export-wizard-queries",
  SCHEDULES: "sql-export-wizard-schedules",
  SETTINGS: "sql-export-wizard-settings",
  ACTIVITY: "sql-export-wizard-activity",
};

// Connection Storage
export function saveConnection(connection: DatabaseConnection): void {
  const connections = getConnections();
  const existingIndex = connections.findIndex((c) => c.id === connection.id);
  
  // Encrypt password if present
  const connectionToSave = {
    ...connection,
    password: connection.password ? encryptPassword(connection.password) : undefined,
  };

  if (existingIndex >= 0) {
    connections[existingIndex] = connectionToSave;
  } else {
    connections.push(connectionToSave);
  }

  localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(connections));
}

export function getConnections(): DatabaseConnection[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CONNECTIONS);
    if (!data) return [];
    
    const connections: DatabaseConnection[] = JSON.parse(data);
    // Decrypt passwords when loading
    return connections.map((conn) => ({
      ...conn,
      password: conn.password ? decryptPassword(conn.password) : undefined,
      lastConnected: conn.lastConnected ? new Date(conn.lastConnected) : undefined,
    }));
  } catch {
    return [];
  }
}

export function deleteConnection(connectionId: string): void {
  const connections = getConnections();
  const filtered = connections.filter((c) => c.id !== connectionId);
  localStorage.setItem(STORAGE_KEYS.CONNECTIONS, JSON.stringify(filtered));
}

export function getConnection(connectionId: string): DatabaseConnection | undefined {
  return getConnections().find((c) => c.id === connectionId);
}

// Template Storage
export function saveTemplate(template: ExportTemplate): void {
  const templates = getTemplates();
  const existingIndex = templates.findIndex((t) => t.id === template.id);
  
  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }

  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
}

export function getTemplates(): ExportTemplate[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!data) return [];
    
    const templates: ExportTemplate[] = JSON.parse(data);
    return templates.map((t) => ({
      ...t,
      createdAt: new Date(t.createdAt),
      lastUsed: t.lastUsed ? new Date(t.lastUsed) : undefined,
    }));
  } catch {
    return [];
  }
}

export function deleteTemplate(templateId: string): void {
  const templates = getTemplates();
  const filtered = templates.filter((t) => t.id !== templateId);
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(filtered));
}

// Import Template Storage
export function saveImportTemplate(template: ImportTemplate): void {
  const templates = getImportTemplates();
  const existingIndex = templates.findIndex((t) => t.id === template.id);
  
  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }

  localStorage.setItem(STORAGE_KEYS.IMPORT_TEMPLATES, JSON.stringify(templates));
}

export function getImportTemplates(): ImportTemplate[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.IMPORT_TEMPLATES);
    if (!data) return [];
    
    const templates: ImportTemplate[] = JSON.parse(data);
    return templates.map((t) => ({
      ...t,
      createdAt: new Date(t.createdAt),
      lastUsed: t.lastUsed ? new Date(t.lastUsed) : undefined,
    }));
  } catch {
    return [];
  }
}

export function deleteImportTemplate(templateId: string): void {
  const templates = getImportTemplates();
  const filtered = templates.filter((t) => t.id !== templateId);
  localStorage.setItem(STORAGE_KEYS.IMPORT_TEMPLATES, JSON.stringify(filtered));
}

// Query Storage
export function saveQuery(query: SavedQuery): void {
  const queries = getQueries();
  const existingIndex = queries.findIndex((q) => q.id === query.id);
  
  if (existingIndex >= 0) {
    queries[existingIndex] = query;
  } else {
    queries.push(query);
  }

  localStorage.setItem(STORAGE_KEYS.QUERIES, JSON.stringify(queries));
}

export function getQueries(): SavedQuery[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.QUERIES);
    if (!data) return [];
    
    const queries: SavedQuery[] = JSON.parse(data);
    return queries.map((q) => ({
      ...q,
      createdAt: new Date(q.createdAt),
      lastUsed: q.lastUsed ? new Date(q.lastUsed) : undefined,
    }));
  } catch {
    return [];
  }
}

export function getFavoriteQueries(): SavedQuery[] {
  return getQueries().filter((q) => q.isFavorite);
}

export function deleteQuery(queryId: string): void {
  const queries = getQueries();
  const filtered = queries.filter((q) => q.id !== queryId);
  localStorage.setItem(STORAGE_KEYS.QUERIES, JSON.stringify(filtered));
}

// Schedule Storage
export function saveSchedule(schedule: ScheduledExport): void {
  const schedules = getSchedules();
  const existingIndex = schedules.findIndex((s) => s.id === schedule.id);
  
  if (existingIndex >= 0) {
    schedules[existingIndex] = schedule;
  } else {
    schedules.push(schedule);
  }

  localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
}

export function getSchedules(): ScheduledExport[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    if (!data) return [];
    
    const schedules: ScheduledExport[] = JSON.parse(data);
    return schedules.map((s) => ({
      ...s,
      lastRun: s.lastRun ? new Date(s.lastRun) : undefined,
    }));
  } catch {
    return [];
  }
}

export function deleteSchedule(scheduleId: string): void {
  const schedules = getSchedules();
  const filtered = schedules.filter((s) => s.id !== scheduleId);
  localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(filtered));
}

// Settings Storage
export interface WizardSettings {
  defaultExportFolder: string;
  defaultImportFolder: string;
  autoConnect: boolean;
  rememberWindowSize: boolean;
  showRowCounts: boolean;
  enableAutoComplete: boolean;
  defaultBatchSize: number;
  queryTimeout: number;
  maxPreviewRows: number;
  connectionPoolSize: number;
  useAsyncOperations: boolean;
  compressLargeExports: boolean;
  encryptPasswords: boolean;
  requireDeleteConfirmation: boolean;
  warnOnSensitiveData: boolean;
  logQueryExecutions: boolean;
  sensitiveColumnPatterns: string[];
  csvDelimiter: string;
  dateFormat: string;
  encoding: string;
  includeHeadersByDefault: boolean;
  autoCreateExportFolder: boolean;
}

const DEFAULT_SETTINGS: WizardSettings = {
  defaultExportFolder: "",
  defaultImportFolder: "",
  autoConnect: true,
  rememberWindowSize: true,
  showRowCounts: true,
  enableAutoComplete: true,
  defaultBatchSize: 1000,
  queryTimeout: 30,
  maxPreviewRows: 1000,
  connectionPoolSize: 5,
  useAsyncOperations: true,
  compressLargeExports: true,
  encryptPasswords: true,
  requireDeleteConfirmation: true,
  warnOnSensitiveData: true,
  logQueryExecutions: false,
  sensitiveColumnPatterns: ["password", "ssn", "credit_card", "secret"],
  csvDelimiter: ",",
  dateFormat: "YYYY-MM-DD",
  encoding: "UTF-8",
  includeHeadersByDefault: true,
  autoCreateExportFolder: true,
};

export function getSettings(): WizardSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<WizardSettings>): void {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
}

// Activity Timeline Storage
export function getActivityEntries(): ActivityEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
    if (!data) return [];

    const entries: ActivityEntry[] = JSON.parse(data);
    return entries
      .filter((entry) => entry && entry.timestamp)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime(),
      );
  } catch {
    return [];
  }
}

export function addActivityEntry(entry: ActivityEntry): void {
  const entries = getActivityEntries();
  const updated = [entry, ...entries].slice(0, 30);
  localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(updated));
}

export function clearActivityEntries(): void {
  localStorage.removeItem(STORAGE_KEYS.ACTIVITY);
}
