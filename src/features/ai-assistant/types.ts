/**
 * File: src/features/ai-assistant/types.ts
 * 
 * Type definitions for the AI File Assistant feature.
 */

// Chat message types
export interface ChatMessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    analysis?: DirectoryAnalysis;
    operation?: FileOperation;
    duplicates?: DuplicateAnalysis;
    [key: string]: any;
  };
}

// File operation types
export interface FileOperation {
  id: string;
  type: 'organize' | 'rename' | 'move' | 'delete' | 'create' | 'copy';
  description: string;
  files: FileOperationItem[];
  preview: {
    before: FileStructure;
    after: FileStructure;
  };
  confidence: number; // 0-1
  requiresConfirmation: boolean;
}

export interface FileOperationItem {
  sourcePath: string;
  targetPath?: string;
  action: 'move' | 'copy' | 'rename' | 'delete' | 'create';
  reason?: string;
}

export interface FileStructure {
  [path: string]: {
    type: 'file' | 'directory';
    size?: number;
    children?: FileStructure;
  };
}

// Directory analysis types
export interface DirectoryAnalysis {
  totalFiles: number;
  totalSize: number;
  fileTypes: FileTypeBreakdown[];
  largestFiles: FileInfo[];
  oldestFiles: FileInfo[];
  newestFiles: FileInfo[];
  suggestedOperation?: FileOperation;
  summary: string;
  organizationScore: number; // 0-100
}

export interface FileTypeBreakdown {
  extension: string;
  count: number;
  totalSize: number;
  percentage: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  extension?: string;
  created?: Date;
  modified?: Date;
}

// Duplicate analysis types
export interface DuplicateAnalysis {
  totalDuplicates: number;
  duplicateGroups: DuplicateGroup[];
  totalWastedSpace: number;
  summary: string;
}

export interface DuplicateGroup {
  id: string;
  files: FileInfo[];
  size: number;
  hash?: string;
}

// AI Provider types
export type AIProvider = 'anthropic' | 'ollama';

// AI Settings
export interface AISettings {
  provider: AIProvider; // AI provider: 'anthropic' or 'ollama'
  model: 'claude-sonnet' | 'claude-opus' | 'claude-haiku' | string; // Claude models or Ollama model name
  creativityLevel: 'conservative' | 'balanced' | 'creative';
  autoApproveThreshold: number; // Number of files before requiring confirmation
  enableBackup: boolean;
  dryRunDefault: boolean;
  excludedFolders: string[];
  apiKey?: string; // Anthropic API key (not needed for Ollama)
  // Ollama-specific settings
  ollamaBaseUrl?: string; // Default: http://localhost:11434
  ollamaModel?: string; // Default: llama3.2:3b
  systemPrompt?: string; // Custom system prompt
  maxTokens?: number; // Default: 4096
  // Clawdbot settings
  clawdbotEnabled?: boolean;
  // Personalization settings
  aiName?: string; // Custom name for the AI assistant
  userName?: string; // Custom name for the user
}

// Workflow types
export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  parameters?: WorkflowParameter[];
  schedule?: WorkflowSchedule;
  createdAt: Date;
  lastRun?: Date;
}

export interface WorkflowStep {
  id: string;
  type: 'organize' | 'rename' | 'move' | 'create' | 'analyze';
  config: Record<string, any>;
}

export interface WorkflowParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'path';
  defaultValue: any;
  description: string;
}

export interface WorkflowSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'on-change';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
}

// Organization strategy types
export type OrganizationStrategy =
  | 'by-type'
  | 'by-date'
  | 'by-project'
  | 'by-size'
  | 'custom';

export interface OrganizationConfig {
  strategy: OrganizationStrategy;
  options: {
    dateFormat?: 'year-month' | 'quarter' | 'year' | 'custom';
    sizeThresholds?: {
      small: number;
      medium: number;
      large: number;
    };
    customRules?: string; // Natural language rules
  };
}

// Contextual Tool Widget types
export interface ToolWidgetData {
  id: string;
  toolName: string; // e.g., 'folder_creation_tab', 'file_creation_tab', etc.
  params: Record<string, any>; // Tool-specific parameters
  description?: string; // Human-readable description
  confidence?: number; // 0-1, how confident the AI is about these parameters
  confirmed?: boolean; // Whether user has confirmed this widget
  sourceMessageId?: string; // ID of the message that generated this widget
  lastUpdated?: Date; // When the widget was last updated
}

export interface WidgetUpdate {
  widgetId: string;
  updates: Partial<ToolWidgetData>;
  source: 'ai' | 'user'; // Who made the update
  messageId?: string; // Related message ID if from chat
}
