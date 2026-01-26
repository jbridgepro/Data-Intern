/**
 * File: src/features/agents/types.ts
 * 
 * Type definitions for the Agent system.
 */

/**
 * Agent status types.
 */
export type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'stopped';

/**
 * Agent types available in the system.
 */
export type AgentType =
  | 'file-organizer'
  | 'duplicate-finder'
  | 'file-analyzer'
  | 'backup-agent'
  | 'cleanup-agent'
  | 'sync-agent'
  | 'task-agent'
  | 'clawdbot';

/**
 * Agent configuration.
 */
export interface AgentConfig {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  enabled: boolean;
  autoStart?: boolean;
  schedule?: AgentSchedule;
  params?: Record<string, any>;
}

/**
 * Agent schedule configuration.
 */
export interface AgentSchedule {
  enabled: boolean;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'on-change';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
}

/**
 * Agent execution state.
 */
export interface AgentState {
  id: string;
  status: AgentStatus;
  progress: {
    current: number;
    total: number;
    percentage: number;
    stage: string;
  };
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: AgentResults;
  logs: AgentLog[];
}

/**
 * Agent execution results.
 */
export interface AgentResults {
  filesProcessed?: number;
  foldersCreated?: number;
  duplicatesFound?: number;
  spaceSaved?: number;
  errors?: number;
  linesAdded?: number;
  linesRemoved?: number;
  filesTouchedCount?: number;
  [key: string]: any;
}

/**
 * Agent log entry.
 */
export interface AgentLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  data?: any;
}

/**
 * Agent task definition.
 */
export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  description: string;
  params: Record<string, any>;
  status: AgentStatus;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  result?: any;
  error?: string;
}
