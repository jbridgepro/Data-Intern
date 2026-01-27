/**
 * File: src/features/agents/agentRegistry.ts
 * 
 * Registry of available agents and their configurations.
 */

import {
  FolderTree,
  Search,
  BarChart3,
  HardDrive,
  Trash2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import type { AgentConfig, AgentType } from './types';

/**
 * Default agent configurations.
 */
export const DEFAULT_AGENTS: Omit<AgentConfig, 'id'>[] = [
  {
    type: 'file-organizer',
    name: 'File Organizer',
    description: 'Automatically organizes files by type, date, or project structure',
    enabled: false,
    autoStart: false,
    params: {
      strategy: 'by-type',
      targetDirectory: '',
      includeSubdirectories: true,
    },
  },
  {
    type: 'duplicate-finder',
    name: 'Duplicate Finder',
    description: 'Scans directories for duplicate files and suggests cleanup',
    enabled: false,
    autoStart: false,
    params: {
      targetDirectory: '',
      minFileSize: 0,
      includeSubdirectories: true,
    },
  },
  {
    type: 'file-analyzer',
    name: 'File Analyzer',
    description: 'Analyzes file usage, sizes, and suggests optimization opportunities',
    enabled: false,
    autoStart: false,
    params: {
      targetDirectory: '',
      analyzeUnused: true,
      suggestArchival: true,
    },
  },
  {
    type: 'backup-agent',
    name: 'Backup Agent',
    description: 'Automatically backs up important files and folders',
    enabled: false,
    autoStart: false,
    params: {
      sourceDirectories: [],
      backupLocation: '',
      frequency: 'daily',
    },
  },
  {
    type: 'cleanup-agent',
    name: 'Cleanup Agent',
    description: 'Removes temporary files, empty folders, and old cache files',
    enabled: false,
    autoStart: false,
    params: {
      targetDirectories: [],
      removeEmptyFolders: true,
      removeTempFiles: true,
      olderThanDays: 30,
    },
  },
  {
    type: 'sync-agent',
    name: 'Sync Agent',
    description: 'Keeps folders synchronized across different locations',
    enabled: false,
    autoStart: false,
    params: {
      sourceDirectory: '',
      targetDirectory: '',
      syncDirection: 'bidirectional',
    },
  },
  {
    type: 'clawdbot',
    name: 'Clawdbot',
    description: 'Specialized AI assistant for advanced operations',
    enabled: true,
    autoStart: false,
    params: {
      mode: 'assistant',
    },
  },
];

/**
 * Agent type metadata (icons, colors, etc.).
 */
export const AGENT_METADATA: Record<AgentType, {
  icon: typeof FolderTree;
  color: string;
  bgColor: string;
}> = {
  'file-organizer': {
    icon: FolderTree,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
  },
  'duplicate-finder': {
    icon: Search,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20',
  },
  'file-analyzer': {
    icon: BarChart3,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
  },
  'backup-agent': {
    icon: HardDrive,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/20',
  },
  'cleanup-agent': {
    icon: Trash2,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/20',
  },
  'sync-agent': {
    icon: RefreshCw,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/20',
  },
  'task-agent': {
    icon: Sparkles,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/20',
  },
  'clawdbot': {
    icon: Sparkles,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20',
  },
};

/**
 * Gets agent metadata by type.
 */
export function getAgentMetadata(type: AgentType) {
  return AGENT_METADATA[type] || {
    icon: Sparkles,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/20',
  };
}
