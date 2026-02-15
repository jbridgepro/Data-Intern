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
  organizationScore?: number;
}

export interface DuplicateGroup {
  id: string;
  files: FileInfo[];
  size: number;
  hash?: string;
}

// AI Provider types
export type AIProvider = 'anthropic' | 'ollama' | 'openrouter';

/**
 * Tool Definition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  category?: string;
  input_schema: any;
  examples?: string[];
  handler?: (args: any, context: any) => Promise<any>;
}

// Organization Configuration
export interface OrganizationConfig {
  strategy: 'by-type' | 'by-date' | 'by-name' | 'custom' | 'by-project' | 'by-size';
  options?: Record<string, any>;
  customRules?: Record<string, string>; // extension -> folder
  dateFormat?: string;
  createFolders?: boolean;
  flatten?: boolean;
}

// ============================================================================
// OPENROUTER TYPES
// ============================================================================

/**
 * OpenRouter model information.
 */
export interface OpenRouterModel {
  /** Model ID (e.g., "anthropic/claude-3.5-sonnet") */
  id: string;
  /** Display name */
  name: string;
  /** Model description */
  description?: string;
  /** Context window size */
  contextLength: number;
  /** Pricing per million tokens (prompt) */
  promptPricing: number;
  /** Pricing per million tokens (completion) */
  completionPricing: number;
  /** Whether model supports tools/functions */
  supportsTools: boolean;
  /** Whether model supports vision */
  supportsVision: boolean;
  /** Model provider (anthropic, openai, meta, etc.) */
  provider: string;
}

/**
 * OpenRouter-specific settings.
 */
export interface OpenRouterSettings {
  /** OpenRouter API key */
  apiKey: string;
  /** Selected model ID */
  model: string;
  /** Site URL for rankings (optional) */
  siteUrl?: string;
  /** Site name for rankings (optional) */
  siteName?: string;
  /** Enable model fallbacks */
  enableFallback: boolean;
  /** Fallback model IDs */
  fallbackModels: string[];
  /** Max tokens for completion */
  maxTokens: number;
  /** Temperature (0-2) */
  temperature: number;
  /** Top P (0-1) */
  topP: number;
  /** Frequency penalty (-2 to 2) */
  frequencyPenalty: number;
  /** Presence penalty (-2 to 2) */
  presencePenalty: number;
}

/**
 * Default OpenRouter settings.
 */
export const DEFAULT_OPENROUTER_SETTINGS: OpenRouterSettings = {
  apiKey: '',
  model: 'anthropic/claude-3.5-sonnet',
  siteUrl: '',
  siteName: 'File Pro',
  enableFallback: false,
  fallbackModels: [],
  maxTokens: 4096,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

/**
 * Popular OpenRouter models with their capabilities.
 */
export const OPENROUTER_POPULAR_MODELS: OpenRouterModel[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Most intelligent Claude model, best for complex tasks',
    contextLength: 200000,
    promptPricing: 3,
    completionPricing: 15,
    supportsTools: true,
    supportsVision: true,
    provider: 'anthropic',
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fast and affordable Claude model',
    contextLength: 200000,
    promptPricing: 0.25,
    completionPricing: 1.25,
    supportsTools: true,
    supportsVision: true,
    provider: 'anthropic',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'OpenAI\'s most capable model',
    contextLength: 128000,
    promptPricing: 2.5,
    completionPricing: 10,
    supportsTools: true,
    supportsVision: true,
    provider: 'openai',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and affordable GPT-4 variant',
    contextLength: 128000,
    promptPricing: 0.15,
    completionPricing: 0.6,
    supportsTools: true,
    supportsVision: true,
    provider: 'openai',
  },
  {
    id: 'google/gemini-pro-1.5',
    name: 'Gemini Pro 1.5',
    description: 'Google\'s advanced model with 1M context',
    contextLength: 1000000,
    promptPricing: 1.25,
    completionPricing: 5,
    supportsTools: true,
    supportsVision: true,
    provider: 'google',
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    description: 'Meta\'s powerful open-source model',
    contextLength: 131072,
    promptPricing: 0.52,
    completionPricing: 0.75,
    supportsTools: true,
    supportsVision: false,
    provider: 'meta',
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    description: 'Fast and efficient Llama model',
    contextLength: 131072,
    promptPricing: 0.055,
    completionPricing: 0.055,
    supportsTools: true,
    supportsVision: false,
    provider: 'meta',
  },
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large',
    description: 'Mistral\'s flagship model',
    contextLength: 128000,
    promptPricing: 2,
    completionPricing: 6,
    supportsTools: true,
    supportsVision: false,
    provider: 'mistral',
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B',
    description: 'Efficient mixture of experts model',
    contextLength: 32768,
    promptPricing: 0.24,
    completionPricing: 0.24,
    supportsTools: true,
    supportsVision: false,
    provider: 'mistral',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    description: 'Cost-effective general purpose model',
    contextLength: 64000,
    promptPricing: 0.14,
    completionPricing: 0.28,
    supportsTools: true,
    supportsVision: false,
    provider: 'deepseek',
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B',
    description: 'Alibaba\'s advanced instruction model',
    contextLength: 131072,
    promptPricing: 0.35,
    completionPricing: 0.4,
    supportsTools: true,
    supportsVision: false,
    provider: 'qwen',
  },
];

/**
 * Context management settings for conversation history optimization.
 * Controls how the AI selects and prioritizes context from conversation history.
 */
export interface ContextSettings {
  /** Maximum number of messages to include in context (default: 10) */
  maxConversationHistory: number;
  /** Include directory analysis in context (default: true) */
  includeDirectoryAnalysis: boolean;
  /** Memory persistence mode: 'session' clears on tab close, 'persistent' survives restarts */
  memoryMode: 'session' | 'persistent';
  /** Prioritize messages containing tool executions (default: true) */
  prioritizeToolMessages: boolean;
  /** Include summarized older context when truncating (default: true) */
  enableContextSummarization: boolean;
  /** Minimum relevance score (0-1) for including older messages (default: 0.3) */
  relevanceThreshold: number;
  /** Enable persistent memory across sessions (default: false) */
  enablePersistentMemory?: boolean;
  /** Number of days to retain memory entries (default: 30) */
  memoryRetentionDays?: number;
  /** Enable semantic search for memory retrieval (default: true) */
  enableSemanticSearch?: boolean;
}

/**
 * Default context settings used when not explicitly configured.
 */
export const DEFAULT_CONTEXT_SETTINGS: ContextSettings = {
  maxConversationHistory: 10,
  includeDirectoryAnalysis: true,
  memoryMode: 'session',
  prioritizeToolMessages: true,
  enableContextSummarization: true,
  relevanceThreshold: 0.3,
  enablePersistentMemory: false,
  memoryRetentionDays: 30,
  enableSemanticSearch: true,
};

/**
 * Cache configuration for directory analysis results.
 * Improves performance by avoiding redundant directory scans.
 */
export interface CacheSettings {
  /** Enable/disable directory analysis caching (default: true) */
  enabled: boolean;
  /** Time-to-live in seconds before cache expires (default: 300 = 5 minutes) */
  ttlSeconds: number;
  /** Maximum number of directories to cache (default: 50) */
  maxEntries: number;
  /** Show cache status in UI (default: true) */
  showCacheStatus: boolean;
}

/**
 * Default cache settings used when not explicitly configured.
 */
export const DEFAULT_CACHE_SETTINGS: CacheSettings = {
  enabled: true,
  ttlSeconds: 300, // 5 minutes
  maxEntries: 50,
  showCacheStatus: true,
};

/**
 * Tool risk levels for permission categorization.
 */
export type ToolRiskLevel = 'safe' | 'moderate' | 'destructive';

/**
 * Permission status for a tool.
 */
export type ToolPermissionStatus = 'allowed' | 'confirm' | 'disabled';

/**
 * Individual tool permission configuration.
 */
export interface ToolPermission {
  /** Tool name (e.g., 'delete_files', 'move_file') */
  toolName: string;
  /** Display name for UI */
  displayName: string;
  /** Brief description of what the tool does */
  description: string;
  /** Risk level categorization */
  riskLevel: ToolRiskLevel;
  /** Current permission status */
  status: ToolPermissionStatus;
  /** Whether this tool can be disabled (some core tools always enabled) */
  canDisable: boolean;
}

/**
 * Tool permissions configuration.
 * Controls which tools the AI can use and which require confirmation.
 */
export interface ToolPermissionsSettings {
  /** Master switch to enable/disable permission checking */
  enabled: boolean;
  /** Default permission for tools not explicitly configured */
  defaultPermission: ToolPermissionStatus;
  /** Allow all destructive operations without confirmation (dangerous!) */
  allowDestructiveWithoutConfirmation: boolean;
  /** Individual tool permission overrides */
  toolOverrides: Record<string, ToolPermissionStatus>;
  /** Tool categories to require confirmation for */
  requireConfirmationFor: ToolRiskLevel[];
  /** Completely disabled tools (won't be available to AI) */
  disabledTools: string[];
}

/**
 * Default tool permissions settings.
 */
export const DEFAULT_TOOL_PERMISSIONS: ToolPermissionsSettings = {
  enabled: true,
  defaultPermission: 'allowed',
  allowDestructiveWithoutConfirmation: false,
  toolOverrides: {},
  requireConfirmationFor: ['destructive'],
  disabledTools: [],
};

/**
 * Pre-defined tool metadata with risk levels.
 * Used to categorize tools and set default permissions.
 */
export const TOOL_METADATA: Record<string, { displayName: string; description: string; riskLevel: ToolRiskLevel; canDisable: boolean }> = {
  // Safe tools - read-only operations
  'analyze_directory': { displayName: 'Analyze Directory', description: 'Analyzes directory contents and statistics', riskLevel: 'safe', canDisable: false },
  'find_duplicates': { displayName: 'Find Duplicates', description: 'Finds duplicate files in a directory', riskLevel: 'safe', canDisable: true },
  'search_files': { displayName: 'Search Files', description: 'Searches for files by name or pattern', riskLevel: 'safe', canDisable: true },
  'list_directory_contents': { displayName: 'List Directory', description: 'Lists files and folders in a directory', riskLevel: 'safe', canDisable: false },
  'calculate_directory_size': { displayName: 'Calculate Size', description: 'Calculates total directory size', riskLevel: 'safe', canDisable: true },
  'read_file_content': { displayName: 'Read File', description: 'Reads content of a text file', riskLevel: 'safe', canDisable: true },
  'file_search_by_content': { displayName: 'Search by Content', description: 'Searches files by their content', riskLevel: 'safe', canDisable: true },
  'compare_directories': { displayName: 'Compare Directories', description: 'Compares two directories', riskLevel: 'safe', canDisable: true },
  'list_agents': { displayName: 'List Agents', description: 'Lists available automation agents', riskLevel: 'safe', canDisable: true },
  'get_agent_status': { displayName: 'Get Agent Status', description: 'Gets status of an agent', riskLevel: 'safe', canDisable: true },

  // Moderate tools - create or modify with minimal risk
  'write_file_content': { displayName: 'Write File', description: 'Creates or overwrites a file', riskLevel: 'moderate', canDisable: true },
  'create_directory': { displayName: 'Create Directory', description: 'Creates a new folder', riskLevel: 'moderate', canDisable: true },
  'folder_creation_tab': { displayName: 'Bulk Folder Creation', description: 'Creates multiple folders at once', riskLevel: 'moderate', canDisable: true },
  'file_creation_tab': { displayName: 'Bulk File Creation', description: 'Creates multiple files at once', riskLevel: 'moderate', canDisable: true },
  'find_replace_tab': { displayName: 'Find & Replace', description: 'Finds and replaces text in files', riskLevel: 'moderate', canDisable: true },
  'organize_files': { displayName: 'Organize Files', description: 'Organizes files into folders', riskLevel: 'moderate', canDisable: true },
  'rename_files': { displayName: 'Rename Files', description: 'Renames files based on patterns', riskLevel: 'moderate', canDisable: true },
  'copy_file': { displayName: 'Copy File', description: 'Copies a file to a new location', riskLevel: 'moderate', canDisable: true },
  'file_copy_tab': { displayName: 'Bulk Copy/Move', description: 'Copies or moves multiple files', riskLevel: 'moderate', canDisable: true },
  'start_agent': { displayName: 'Start Agent', description: 'Starts an automation agent', riskLevel: 'moderate', canDisable: true },
  'stop_agent': { displayName: 'Stop Agent', description: 'Stops a running agent', riskLevel: 'moderate', canDisable: true },
  'configure_agent': { displayName: 'Configure Agent', description: 'Configures agent settings', riskLevel: 'moderate', canDisable: true },

  // Destructive tools - can permanently delete or modify data
  'delete_files': { displayName: 'Delete Files', description: 'Permanently deletes files', riskLevel: 'destructive', canDisable: true },
  'batch_delete': { displayName: 'Batch Delete', description: 'Deletes multiple files at once', riskLevel: 'destructive', canDisable: true },
  'move_file': { displayName: 'Move File', description: 'Moves a file to a new location', riskLevel: 'destructive', canDisable: true },
  'execute_operation': { displayName: 'Execute Operation', description: 'Executes a file operation', riskLevel: 'destructive', canDisable: true },
  'execute_terminal_command': { displayName: 'Terminal Command', description: 'Executes shell commands', riskLevel: 'destructive', canDisable: true },
};

// AI Settings
export interface AISettings {
  provider: AIProvider; // AI provider: 'anthropic', 'ollama', or 'openrouter'
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
  // OpenRouter-specific settings
  openRouter?: OpenRouterSettings;
  // Clawdbot settings
  clawdbotEnabled?: boolean;
  // Personalization settings
  aiName?: string; // Custom name for the AI assistant
  userName?: string; // Custom name for the user
  // Context management settings
  contextSettings?: ContextSettings;
  // Cache settings for directory analysis
  cacheSettings?: CacheSettings;
  // Tool permissions settings
  toolPermissions?: ToolPermissionsSettings;
  // Live reasoning display (UI)
  reasoningLive?: boolean;
  // Operation history settings
  operationHistory?: OperationHistorySettings;
  // Audit logging settings
  auditLog?: AuditLogSettings;
  // Workflow template settings
  workflows?: WorkflowSettings;
}

/**
 * Operation history settings for undo/redo functionality.
 */
export interface OperationHistorySettings {
  /** Enable operation history tracking (default: true) */
  enabled: boolean;
  /** Maximum number of operations to keep in history (default: 50) */
  maxHistorySize: number;
  /** Auto-save history to localStorage (default: true) */
  persistHistory: boolean;
  /** Show undo/redo buttons in UI (default: true) */
  showUndoRedo: boolean;
  /** Automatically create backups before destructive operations (default: true) */
  autoBackup: boolean;
}

/**
 * Default operation history settings.
 */
export const DEFAULT_OPERATION_HISTORY_SETTINGS: OperationHistorySettings = {
  enabled: true,
  maxHistorySize: 50,
  persistHistory: true,
  showUndoRedo: true,
  autoBackup: true,
};

/**
 * Types of file operations that can be tracked and undone.
 */
export type OperationType =
  | 'create_file'
  | 'delete_file'
  | 'move_file'
  | 'copy_file'
  | 'rename_file'
  | 'create_directory'
  | 'delete_directory'
  | 'move_directory'
  | 'write_content'
  | 'find_replace'
  | 'organize'
  | 'bulk_create'
  | 'bulk_delete'
  | 'bulk_move'
  | 'bulk_copy';

/**
 * Status of an operation in the history.
 */
export type OperationStatus = 'completed' | 'undone' | 'failed' | 'partial';

/**
 * Single file change within an operation.
 */
export interface FileChange {
  /** Type of change */
  type: 'create' | 'delete' | 'move' | 'copy' | 'rename' | 'modify';
  /** Source path (original location) */
  sourcePath: string;
  /** Target path (new location, for move/copy/rename) */
  targetPath?: string;
  /** Original content (for modify operations, to enable undo) */
  originalContent?: string;
  /** New content (for modify operations) */
  newContent?: string;
  /** File size in bytes */
  size?: number;
  /** Whether this was a directory */
  isDirectory?: boolean;
  /** Whether this change was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Recorded operation in the history.
 */
export interface OperationRecord {
  /** Unique identifier for this operation */
  id: string;
  /** Type of operation */
  type: OperationType;
  /** Human-readable description */
  description: string;
  /** Tool that performed the operation */
  toolName: string;
  /** Tool arguments used */
  toolArgs: Record<string, any>;
  /** Individual file changes */
  changes: FileChange[];
  /** Operation status */
  status: OperationStatus;
  /** Timestamp when operation started */
  timestamp: number;
  /** Timestamp when operation completed */
  completedAt?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Total files affected */
  filesAffected: number;
  /** Whether this operation can be undone */
  canUndo: boolean;
  /** Reason if cannot be undone */
  undoBlockedReason?: string;
  /** Whether backup was created */
  hasBackup: boolean;
  /** Backup location if created */
  backupPath?: string;
  /** User who initiated the operation (for multi-user scenarios) */
  initiatedBy?: string;
  /** Related message ID from chat */
  messageId?: string;
}

/**
 * Undo operation result.
 */
export interface UndoResult {
  /** Whether the undo was successful */
  success: boolean;
  /** Operation that was undone */
  operation: OperationRecord;
  /** New operation record for the undo action */
  undoOperation?: OperationRecord;
  /** Files that were restored/reverted */
  restoredFiles: string[];
  /** Files that failed to restore */
  failedFiles: Array<{ path: string; error: string }>;
  /** Error message if undo failed completely */
  error?: string;
}

// ============================================================================
// AUDIT LOGGING TYPES
// ============================================================================

/**
 * Audit log settings for tracking and compliance.
 */
export interface AuditLogSettings {
  /** Enable audit logging (default: true) */
  enabled: boolean;
  /** Log level threshold (default: 'info') */
  logLevel: AuditLogLevel;
  /** Maximum number of log entries to keep in memory (default: 1000) */
  maxEntries: number;
  /** Persist logs to localStorage (default: true) */
  persistLogs: boolean;
  /** Include tool arguments in logs (default: true, may contain sensitive data) */
  includeArguments: boolean;
  /** Include file paths in logs (default: true) */
  includeFilePaths: boolean;
  /** Include user prompts in logs (default: false, for privacy) */
  includeUserPrompts: boolean;
  /** Auto-export logs older than N days (0 = disabled) */
  autoExportDays: number;
  /** Log retention days (0 = unlimited) */
  retentionDays: number;
}

/**
 * Default audit log settings.
 */
export const DEFAULT_AUDIT_LOG_SETTINGS: AuditLogSettings = {
  enabled: true,
  logLevel: 'info',
  maxEntries: 1000,
  persistLogs: true,
  includeArguments: true,
  includeFilePaths: true,
  includeUserPrompts: false,
  autoExportDays: 0,
  retentionDays: 30,
};

/**
 * Audit log severity levels.
 */
export type AuditLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Numeric values for log levels (for filtering).
 */
export const AUDIT_LOG_LEVEL_VALUES: Record<AuditLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

/**
 * Categories of audit log entries.
 */
export type AuditLogCategory =
  | 'tool_execution'
  | 'file_operation'
  | 'ai_request'
  | 'ai_response'
  | 'permission'
  | 'settings'
  | 'session'
  | 'error'
  | 'security';

/**
 * Individual audit log entry.
 */
export interface AuditLogEntry {
  /** Unique identifier */
  id: string;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Log severity level */
  level: AuditLogLevel;
  /** Log category */
  category: AuditLogCategory;
  /** Action that was performed */
  action: string;
  /** Human-readable description */
  message: string;
  /** Whether the action was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds (for timed operations) */
  duration?: number;
  /** Tool name if applicable */
  toolName?: string;
  /** Tool arguments (sanitized based on settings) */
  toolArgs?: Record<string, any>;
  /** Files affected by the operation */
  affectedFiles?: string[];
  /** Number of files affected */
  fileCount?: number;
  /** User prompt that triggered this action */
  userPrompt?: string;
  /** AI model used */
  model?: string;
  /** Session ID for grouping related entries */
  sessionId?: string;
  /** Message ID from chat for correlation */
  messageId?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** IP address or client identifier (for multi-client scenarios) */
  clientId?: string;
}

/**
 * Audit log search/filter parameters.
 */
export interface AuditLogFilter {
  /** Filter by log level (minimum) */
  minLevel?: AuditLogLevel;
  /** Filter by category */
  categories?: AuditLogCategory[];
  /** Filter by tool name */
  toolNames?: string[];
  /** Filter by success/failure */
  success?: boolean;
  /** Filter by date range (start) */
  fromDate?: number;
  /** Filter by date range (end) */
  toDate?: number;
  /** Search in message text */
  searchText?: string;
  /** Filter by session ID */
  sessionId?: string;
  /** Maximum entries to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Audit log statistics.
 */
export interface AuditLogStats {
  /** Total number of log entries */
  totalEntries: number;
  /** Entries by level */
  byLevel: Record<AuditLogLevel, number>;
  /** Entries by category */
  byCategory: Record<AuditLogCategory, number>;
  /** Success rate percentage */
  successRate: number;
  /** Total errors */
  errorCount: number;
  /** Most used tools */
  topTools: Array<{ tool: string; count: number }>;
  /** Date of oldest entry */
  oldestEntry?: number;
  /** Date of newest entry */
  newestEntry?: number;
  /** Average operation duration (ms) */
  avgDuration?: number;
}

/**
 * Export format for audit logs.
 */
export type AuditLogExportFormat = 'json' | 'csv' | 'txt';

/**
 * Exported audit log data.
 */
export interface AuditLogExport {
  /** Export format */
  format: AuditLogExportFormat;
  /** Export timestamp */
  exportedAt: number;
  /** Number of entries exported */
  entryCount: number;
  /** Exported data (as string) */
  data: string;
  /** Filter used for export */
  filter?: AuditLogFilter;
}

// ============================================================================
// WORKFLOW AUTOMATION TYPES
// ============================================================================

/**
 * Workflow step types.
 */
export type WorkflowStepType =
  | 'tool_execution'
  | 'file_operation'
  | 'create_files'
  | 'create_folders'
  | 'organize_files'
  | 'rename_files'
  | 'copy_files'
  | 'delete_files'
  | 'analyze_directory'
  | 'organize'
  | 'transform'
  | 'backup'
  | 'analyze';

/**
 * Workflow execution frequency/schedule.
 */
export type WorkflowSchedule = {
  type: 'once' | 'daily' | 'weekly' | 'cron';
  value?: string; // e.g., '0 0 * * *' for daily
  lastRun?: number;
  nextRun?: number;
};

/**
 * Workflow step definition.
 */
export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  toolName: string;
  config: Record<string, any>; // Tool arguments with template variables {{var}}
  condition?: string; // Optional js expression
  retry?: {
    maxAttempts: number;
    delayMs: number;
  };
  continueOnError?: boolean;
  enabled?: boolean;
  order: number;
}

/**
 * Workflow Parameter definition.
 */
export interface WorkflowParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'directory' | 'file' | 'select' | 'pattern';
  defaultValue?: any;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

/**
 * Workflow definition.
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  category?: WorkflowCategory;
  visibility?: 'private' | 'public' | 'shared' | 'builtin';
  tags: string[];
  steps: WorkflowStep[];
  parameters: WorkflowParameter[];
  schedule?: WorkflowSchedule;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  runCount: number;
  avgExecutionTime?: number;
  successRate?: number;
  version: string;
  isFavorite: boolean;
  isEnabled: boolean;
  icon?: string;
  color?: string;
  author?: string;
}

/**
 * Workflow execution statuses.
 */
export type WorkflowExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Workflow execution instance.
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowExecutionStatus;
  parameters: Record<string, any>;
  stepResults: WorkflowStepResult[];
  currentStep: number;
  totalSteps: number;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  error?: string;
  logs?: string[];
  totalFilesAffected: number;
  triggeredBy: 'user' | 'schedule' | 'api';
}

/**
 * Result of a single workflow step.
 */
export interface WorkflowStepResult {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  retryAttempts?: number;
  filesAffected?: number;
}

/**
 * Workflow settings.
 */
export interface WorkflowSettings {
  maxWorkflows: number;
  persistWorkflows: boolean;
  enableScheduling: boolean;
  maxConcurrentExecutions: number;
  enabled?: boolean;
  autoSaveRepeated?: boolean;
  showSuggestions?: boolean;
}

/**
 * Default workflow settings.
 */
export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  maxWorkflows: 50,
  persistWorkflows: true,
  enableScheduling: false,
  maxConcurrentExecutions: 1,
  enabled: true,
  autoSaveRepeated: false,
  showSuggestions: true,
};

/**
 * Validation result for workflows.
 */
export interface WorkflowValidation {
  valid: boolean;
  errors: Array<{ stepId?: string; field?: string; message: string }>;
  warnings: Array<{ stepId?: string; field?: string; message: string }>;
}

export type WorkflowChangeListener = (workflows: Workflow[]) => void;
export type ExecutionListener = (execution: WorkflowExecution) => void;
export type WorkflowCategory = 'custom' | 'template' | 'system' | 'organization' | 'cleanup' | 'backup' | 'development' | string;

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  workflow: Partial<Workflow>;
}

export interface ToolWidgetData {
  id: string;
  lastUpdated: Date;
  toolName: string;
  sourceMessageId: string;
  params: Record<string, any>;
  confirmed?: boolean;
  confidence?: number;
  description?: string;
}

export type WidgetUpdate = Partial<ToolWidgetData>;
