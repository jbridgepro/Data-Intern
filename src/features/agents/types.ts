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
 * Subagent configuration.
 */
export interface SubAgentConfig {
  id: string;
  name: string;
  role: string;
  goal: string;
  model?: string;
  tools?: string[];
}

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
  subagents?: SubAgentConfig[];
  /**
   * How much the agent may do without asking.
   * - 'ask-all': every proposed change waits in the Approval Inbox (default).
   * - 'ask-risky': low and medium risk changes apply automatically.
   * High risk changes (deletes, overwrites) always wait, whatever this is set to.
   */
  approvalPolicy?: ApprovalPolicy;
}

/**
 * Approval policy for an agent's proposed changes.
 */
export type ApprovalPolicy = 'ask-all' | 'ask-risky';

/**
 * What triggered an agent run.
 */
export type AgentTrigger = 'manual' | 'schedule' | 'on-change' | 'ai-assistant';

/**
 * Kinds of change an agent can propose.
 * - move: rename/move a file (undoable)
 * - copy: copy one file; with overwrite the old target is moved to trash first
 * - copy-tree: copy a whole folder without overwriting (backup)
 * - trash: move a file into an agent trash folder instead of deleting it (undoable)
 * - remove-empty-dir: remove a folder that is still empty when applied
 * - mkdir: create a folder
 */
export type ChangeKind = 'move' | 'copy' | 'copy-tree' | 'trash' | 'remove-empty-dir' | 'mkdir';

/**
 * Risk of a proposed change. High risk changes always need approval.
 */
export type ChangeRisk = 'low' | 'medium' | 'high';

/**
 * A single change proposed by an agent.
 */
export interface ProposedChange {
  id: string;
  kind: ChangeKind;
  source: string;
  target?: string;
  overwrite?: boolean;
  size?: number;
  risk: ChangeRisk;
  reason?: string;
}

/**
 * What an executor hands back when it wants changes made.
 */
export interface AgentProposal {
  title: string;
  summary: string;
  changes: Omit<ProposedChange, 'id' | 'risk'>[];
}

/**
 * Inbox lane, following the "needs me / can wait" triage pattern.
 */
export type ApprovalLane = 'needs-you' | 'can-wait';

export type ChangeSetStatus =
  | 'pending'
  | 'applying'
  | 'applied'
  | 'partially-applied'
  | 'rejected'
  | 'failed'
  | 'undone';

/**
 * Step recorded while applying a change, used to undo it.
 */
export interface UndoStep {
  action: 'rename' | 'remove' | 'mkdir' | 'remove-dir';
  from?: string;
  to?: string;
  path?: string;
}

/**
 * A group of changes from one agent run, reviewed together.
 */
export interface ChangeSet {
  id: string;
  agentId: string;
  agentName: string;
  trigger: AgentTrigger;
  createdAt: number;
  title: string;
  summary: string;
  changes: ProposedChange[];
  lane: ApprovalLane;
  status: ChangeSetStatus;
  /** True when it was applied without asking (allowed by the agent's policy). */
  autoApplied?: boolean;
  decidedAt?: number;
  appliedChangeIds?: string[];
  skippedChangeIds?: string[];
  failures?: Array<{ changeId: string; error: string }>;
  undoSteps?: UndoStep[];
}

export type ScheduleFrequency = 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'on-change';

/**
 * Agent schedule configuration.
 */
export interface AgentSchedule {
  enabled: boolean;
  frequency: ScheduleFrequency;
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
  trigger?: AgentTrigger;
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
