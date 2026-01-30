/**
 * File: src/features/ai-assistant/utils/toolsRegistry.ts
 * 
 * Registry of available tools for the AI to use.
 * Includes custom file operations and MCP tools.
 * 
 * This module provides:
 * - Tool definitions in Anthropic's tool use format
 * - Tool execution logic with error handling
 * - Utility functions for common operations
 * - Type-safe interfaces for tool parameters and results
 */

import type { AISettings, DirectoryAnalysis, FileOperation, OrganizationConfig, DEFAULT_CACHE_SETTINGS } from '../types';
import { analyzeDirectoryFiles } from './fileAnalysis';
import { organizeFilesByStrategy } from './organizationStrategies';
import { findDuplicateFiles } from './duplicateDetection';
import { generateRenameOperation } from './renameIntelligence';
import { executeFileOperation } from './fileOperations';
import { toolOrchestrator } from './toolOrchestrator';
import { directoryCache } from './directoryCache';
import { toolPermissionManager } from './toolPermissions';
import { 
  operationHistory, 
  createFileChange, 
  getOperationTypeFromTool,
  isOperationUndoable 
} from './operationHistory';
import { auditLogger } from './auditLogger';
import { workflowManager, BUILTIN_TEMPLATES } from './workflowManager';
import type { OperationType, FileChange, WorkflowCategory } from '../types';
import type {
  FileCopyToolParams,
  FolderCreationToolParams,
  FileCreationToolParams,
  FindReplaceToolParams,
} from './tabTools';
import { agentService } from '../../agents/services/agentService';
import { Command } from '@tauri-apps/plugin-shell';
import { readDir, stat, readTextFile, writeTextFile, remove, mkdir, exists } from '@tauri-apps/plugin-fs';
import { join, basename, dirname, extname } from '@tauri-apps/api/path';

/**
 * Tool definition interface matching Anthropic's tool use format.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  category?: ToolCategory; // Optional categorization for better organization
  examples?: string[]; // Optional usage examples
}

/**
 * Tool categories for better organization and filtering.
 */
export enum ToolCategory {
  FILE_OPERATIONS = 'file_operations',
  DIRECTORY_OPERATIONS = 'directory_operations',
  SEARCH_AND_ANALYSIS = 'search_and_analysis',
  ORGANIZATION = 'organization',
  AGENT_MANAGEMENT = 'agent_management',
  SYSTEM_COMMANDS = 'system_commands',
  TAB_TOOLS = 'tab_tools',
  SKILLS = 'skills',
}

/**
 * Tool execution context.
 */
export interface ToolContext {
  currentDirectory: string;
  settings: AISettings;
  directoryAnalysis?: DirectoryAnalysis | null;
}

/**
 * Tool execution result with enhanced metadata.
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  operation?: FileOperation;
  warnings?: string[]; // Optional warnings (non-fatal issues)
  metadata?: {
    executionTime?: number; // Execution time in milliseconds
    itemsProcessed?: number; // Number of items processed
    [key: string]: any; // Additional metadata
  };
}

/**
 * Validation result for tool arguments.
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Registry of all available tools.
 * Includes both custom file operations and tab-based tools.
 */
export const TOOLS: ToolDefinition[] = [
  {
    name: 'analyze_directory',
    description: 'Analyzes a directory to get file statistics, types, sizes, and organization score. Use this to understand what files are in a directory before organizing them.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to analyze. If not provided, uses the current working directory.',
        },
      },
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'analyze_directory() - Analyze current directory',
      'analyze_directory({ path: "/Downloads" }) - Analyze Downloads folder',
    ],
  },
  {
    name: 'file_copy_tab',
    description: 'File Copy & Move tool - Copy or move files with advanced filtering. Can filter by file type, exclude patterns, and handle subdirectories. Use this for organizing files by moving them to different locations.',
    input_schema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Source directory path',
        },
        destinationPath: {
          type: 'string',
          description: 'Destination directory path',
        },
        fileTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'File type filters (e.g., ["*.py", "*.js"]). Leave empty for all files.',
        },
        excludePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exclude patterns (e.g., ["*test*", "*temp*"])',
        },
        operation: {
          type: 'string',
          enum: ['copy', 'move'],
          description: 'Operation type: copy or move',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Include files from subdirectories',
        },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite existing files',
        },
      },
      required: ['sourcePath', 'destinationPath', 'operation'],
    },
  },
  {
    name: 'folder_creation_tab',
    description: 'Folder Creation tool - Create bulk folder structures with subfolders, numbering, and date prefixes. Use this to set up project structures or organize files into folders. IMPORTANT: When subfolders are specified, they will be created inside EACH main folder.',
    input_schema: {
      type: 'object',
      properties: {
        rootPath: {
          type: 'string',
          description: 'Root directory where folders will be created',
        },
        folderNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of folder names to create',
        },
        subfolders: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of subfolder names to create inside EACH main folder. Example: ["1", "2", "3"] will create folders 1, 2, and 3 inside each main folder.',
        },
        datePrefix: {
          type: 'boolean',
          description: 'Add date prefix to folder names',
        },
        dateFormat: {
          type: 'string',
          description: 'Date format (e.g., YYYY-MM-DD)',
        },
        numbering: {
          type: 'boolean',
          description: 'Add numbering prefix to folder names',
        },
        numberFormat: {
          type: 'string',
          description: 'Number format (e.g., "01", "001")',
        },
      },
      required: ['rootPath', 'folderNames'],
    },
  },
  {
    name: 'file_creation_tab',
    description: 'File Creation tool - Generate empty files in bulk with naming patterns, numbering, and date prefixes. Use this to create placeholder files or initialize project structures. IMPORTANT: When user says "create X files starting with Y", extract Y as the baseName parameter. Extract the file extension from the request (e.g., "SQL files" → extensions: ["sql"]).',
    input_schema: {
      type: 'object',
      properties: {
        rootPath: {
          type: 'string',
          description: 'Directory where files will be created. If not provided, uses the current working directory.',
        },
        baseName: {
          type: 'string',
          description: 'Base name prefix for files. Example: If user says "create files starting with Justin", baseName should be "Justin".',
        },
        extensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'File extensions without the dot (e.g., ["sql", "txt", "log"]). Extract from user request like "SQL files" → ["sql"], "text files" → ["txt"].',
        },
        count: {
          type: 'number',
          description: 'Number of files to create. Extract from user request like "create 5 files" → 5.',
        },
        useNumbering: {
          type: 'boolean',
          description: 'Add numbering to file names',
        },
        startNumber: {
          type: 'number',
          description: 'Starting number for numbering',
        },
        digitCount: {
          type: 'number',
          description: 'Number of digits for numbering (e.g., 3 for 001)',
        },
        useDate: {
          type: 'boolean',
          description: 'Add date prefix to file names',
        },
        dateFormat: {
          type: 'string',
          description: 'Date format (e.g., YYYY-MM-DD)',
        },
        datePosition: {
          type: 'string',
          enum: ['prefix', 'suffix'],
          description: 'Date position in filename',
        },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite existing files',
        },
      },
      required: ['rootPath', 'baseName', 'extensions', 'count'],
    },
  },
  {
    name: 'find_replace_tab',
    description: 'Find & Replace tool - Search and replace text in files with regex support, file filtering, and case sensitivity options. Use this to refactor code, update configurations, or modify file contents.',
    input_schema: {
      type: 'object',
      properties: {
        rootPath: {
          type: 'string',
          description: 'Directory to search in',
        },
        searchQuery: {
          type: 'string',
          description: 'Text or pattern to search for',
        },
        replaceQuery: {
          type: 'string',
          description: 'Text to replace with (optional, omit for search only)',
        },
        filePattern: {
          type: 'string',
          description: 'File pattern filter (e.g., "*.sql", "*.js")',
        },
        useRegex: {
          type: 'boolean',
          description: 'Use regular expressions',
        },
        matchCase: {
          type: 'boolean',
          description: 'Case-sensitive search',
        },
        wholeWord: {
          type: 'boolean',
          description: 'Match whole words only',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Search in subdirectories',
        },
      },
      required: ['rootPath', 'searchQuery'],
    },
  },
  {
    name: 'organize_files',
    description: 'Organizes files in a directory by type, date, project, or size. Creates a preview of the operation before executing.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to organize. If not provided, uses the current working directory.',
        },
        strategy: {
          type: 'string',
          enum: ['by-type', 'by-date', 'by-project', 'by-size'],
          description: 'Organization strategy: by-type (group by file extension), by-date (group by creation date), by-project (detect project names), by-size (group by file size).',
        },
        dateFormat: {
          type: 'string',
          enum: ['year-month', 'quarter', 'year'],
          description: 'Date format for by-date strategy. Only used when strategy is by-date.',
        },
      },
      required: ['strategy'],
    },
    category: ToolCategory.ORGANIZATION,
    examples: [
      'organize_files({ strategy: "by-type" }) - Group files by extension',
      'organize_files({ strategy: "by-date", dateFormat: "year-month" }) - Group by date',
    ],
  },
  {
    name: 'find_duplicates',
    description: 'Finds duplicate files in a directory by comparing file sizes and content hashes. Helps identify files that can be safely removed.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to search for duplicates. If not provided, uses the current working directory.',
        },
      },
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'find_duplicates() - Find duplicates in current directory',
      'find_duplicates({ path: "/Photos" }) - Find duplicate photos',
    ],
  },
  {
    name: 'rename_files',
    description: 'Renames files based on patterns, dates, or naming conventions. Can standardize file names, add dates, or convert to snake_case.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path containing files to rename. If not provided, uses the current working directory.',
        },
        pattern: {
          type: 'string',
          enum: ['date-prefix', 'snake-case', 'standardize', 'clean'],
          description: 'Renaming pattern: date-prefix (add YYYY-MM-DD prefix), snake-case (convert to snake_case), standardize (normalize naming), clean (remove special chars).',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'execute_operation',
    description: 'Executes a file operation that was previously generated. Use this after organizing or renaming to actually perform the file operations.',
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'object',
          description: 'The file operation object to execute. This should come from a previous organize_files or rename_files call.',
        },
      },
      required: ['operation'],
    },
  },
  {
    name: 'list_agents',
    description: 'Lists all available file management agents. Agents can automate tasks like file organization, duplicate detection, cleanup, and backups.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'start_agent',
    description: 'Starts a file management agent. Agents can run in the background to perform automated file operations like organizing, cleaning up, or finding duplicates.',
    input_schema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent to start. Use list_agents to see available agents.',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'stop_agent',
    description: 'Stops a running agent.',
    input_schema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent to stop.',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'get_agent_status',
    description: 'Gets the current status, progress, and results of an agent.',
    input_schema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent to check.',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'configure_agent',
    description: 'Configures an agent with specific parameters. Use this to set up agents for specific directories or customize their behavior.',
    input_schema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent to configure.',
        },
        params: {
          type: 'object',
          description: 'Agent-specific parameters. For file-organizer: {targetDirectory, strategy, includeSubdirectories}. For duplicate-finder: {targetDirectory, minFileSize, autoRemove}. For cleanup-agent: {targetDirectories, removeEmptyFolders, removeTempFiles, olderThanDays}.',
        },
        enabled: {
          type: 'boolean',
          description: 'Whether to enable or disable the agent.',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name pattern, extension, or wildcard. Returns matching file paths with metadata. Use this to find specific files in a directory or subdirectories.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to search in. If not provided, uses the current working directory.',
        },
        pattern: {
          type: 'string',
          description: 'Search pattern (e.g., "*.jpg", "report*", "*test*"). Supports wildcards * and ?.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Search in subdirectories recursively. Default: true.',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Case-sensitive search. Default: false.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return. Default: 100.',
        },
      },
      required: ['pattern'],
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'search_files({ pattern: "*.jpg" }) - Find all JPG files',
      'search_files({ pattern: "report*", includeSubdirectories: false }) - Find files starting with "report"',
    ],
  },
  {
    name: 'list_directory_contents',
    description: 'Lists all files and folders in a directory with detailed metadata (size, modified date, type). More detailed than analyze_directory for browsing directory contents.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list. If not provided, uses the current working directory.',
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include hidden files and folders. Default: false.',
        },
        sortBy: {
          type: 'string',
          enum: ['name', 'size', 'date', 'type'],
          description: 'Sort order: name (alphabetical), size (largest first), date (newest first), type (folders first). Default: name.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return. Default: 1000.',
        },
      },
    },
  },
  {
    name: 'get_file_info',
    description: 'Get detailed information about a specific file or folder including size, creation date, modified date, permissions, and type. Use this to inspect individual files.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full path to the file or folder.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file_content',
    description: 'Read the content of a text file. Supports various text formats (txt, json, xml, code files, etc.). Returns file content as text. Use this to read configuration files, logs, or any text-based files.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full path to the text file to read.',
        },
        maxLines: {
          type: 'number',
          description: 'Maximum number of lines to read. If not specified, reads entire file (up to 10,000 lines for safety).',
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'utf16', 'latin1'],
          description: 'File encoding. Default: utf8.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file_content',
    description: 'Write or create a file with specified content and exact name. Can create new files or overwrite existing ones. Use this when the user wants to create SPECIFIC named files/documents (e.g., "create a document called \'Justin\'s Big Plan.docx\'" or "one that says, Justins, New Idea"). IMPORTANT: Use this for documents and files with specific names, NOT for creating folders. For multiple files, call this tool ONCE for each file separately. The path parameter must be the FULL file path including directory and filename with extension. If user doesn\'t specify content, use empty string.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full path where the file should be created or written.',
        },
        content: {
          type: 'string',
          description: 'Text content to write to the file.',
        },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite existing file if it exists. Default: false (will fail if file exists).',
        },
        createDirectories: {
          type: 'boolean',
          description: 'Create parent directories if they don\'t exist. Default: true.',
        },
      },
      required: ['path', 'content'],
    },
    category: ToolCategory.FILE_OPERATIONS,
    examples: [
      'write_file_content({ path: "/path/to/file.txt", content: "Hello World" })',
      'write_file_content({ path: "/docs/report.md", content: "", createDirectories: true })',
    ],
  },
  {
    name: 'delete_files',
    description: 'Delete files or folders. Includes safety checks and can delete multiple files. Use with caution - always preview before deleting. For safety, requires explicit confirmation for destructive operations.',
    input_schema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file or folder paths to delete.',
        },
        recursive: {
          type: 'boolean',
          description: 'Delete folders recursively. Required if deleting folders. Default: false.',
        },
        skipErrors: {
          type: 'boolean',
          description: 'Continue deleting other files if one fails. Default: false.',
        },
      },
      required: ['paths'],
    },
    category: ToolCategory.FILE_OPERATIONS,
    examples: [
      'delete_files({ paths: ["/path/to/file.txt"] })',
      'delete_files({ paths: ["/folder"], recursive: true })',
    ],
  },
  {
    name: 'calculate_directory_size',
    description: 'Calculate the total size of a directory including all subdirectories and files. Returns total size in bytes and human-readable format. Use this to check disk usage or compare directory sizes.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to calculate size for. If not provided, uses the current working directory.',
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include hidden files and folders in calculation. Default: true.',
        },
      },
    },
  },
  {
    name: 'file_search_by_content',
    description: 'Search for files containing specific text content. Searches inside file contents, not just filenames. Supports regex patterns. Use this to find files containing specific text, code, or data.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to search in. If not provided, uses the current working directory.',
        },
        searchText: {
          type: 'string',
          description: 'Text or pattern to search for in file contents.',
        },
        filePattern: {
          type: 'string',
          description: 'File pattern filter (e.g., "*.txt", "*.js", "*.py"). Leave empty to search all text files.',
        },
        useRegex: {
          type: 'boolean',
          description: 'Treat searchText as a regular expression. Default: false.',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Case-sensitive search. Default: false.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Search in subdirectories recursively. Default: true.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matching files to return. Default: 50.',
        },
      },
      required: ['searchText'],
    },
  },
  {
    name: 'compare_directories',
    description: 'Compare two directories to find differences - files that exist in one but not the other, or files with different sizes/dates. Useful for syncing, backups, or finding missing files.',
    input_schema: {
      type: 'object',
      properties: {
        path1: {
          type: 'string',
          description: 'First directory path to compare.',
        },
        path2: {
          type: 'string',
          description: 'Second directory path to compare.',
        },
        compareContent: {
          type: 'boolean',
          description: 'Compare file contents (slower but more accurate). Default: false (compares size and date only).',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Compare subdirectories recursively. Default: true.',
        },
      },
      required: ['path1', 'path2'],
    },
  },
  {
    name: 'batch_delete',
    description: 'Delete multiple files matching a pattern. More efficient than delete_files for pattern-based deletion. Includes safety checks and preview.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to search for files to delete. If not provided, uses the current working directory.',
        },
        pattern: {
          type: 'string',
          description: 'File pattern to match (e.g., "*.tmp", "*~", "*.bak"). Supports wildcards.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Search in subdirectories recursively. Default: false.',
        },
        olderThanDays: {
          type: 'number',
          description: 'Only delete files older than this many days. Optional.',
        },
        minSize: {
          type: 'number',
          description: 'Only delete files larger than this size in bytes. Optional.',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a new directory or directory structure. Can create nested directories in one operation. Use this to set up folder structures.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Full path of the directory to create. Can include nested paths (e.g., "/path/to/new/folder").',
        },
        recursive: {
          type: 'boolean',
          description: 'Create parent directories if they don\'t exist. Default: true.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'move_file',
    description: 'Move a file or folder to a new location. Can also be used to rename files. More direct than file_copy_tab for single file operations.',
    input_schema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Source file or folder path.',
        },
        destinationPath: {
          type: 'string',
          description: 'Destination path (can be a new filename for renaming).',
        },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite destination if it exists. Default: false.',
        },
      },
      required: ['sourcePath', 'destinationPath'],
    },
  },
  {
    name: 'copy_file',
    description: 'Copy a file or folder to a new location. More direct than file_copy_tab for single file operations.',
    input_schema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Source file or folder path.',
        },
        destinationPath: {
          type: 'string',
          description: 'Destination path.',
        },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite destination if it exists. Default: false.',
        },
        recursive: {
          type: 'boolean',
          description: 'Copy folders recursively. Required for folders. Default: false.',
        },
      },
      required: ['sourcePath', 'destinationPath'],
    },
  },
  {
    name: 'execute_terminal_command',
    description: 'Executes a command in the terminal. Use this to run CLI tools, scripts, or system commands. WARNING: This tool is powerful. Only run commands that are safe and necessary for the user\'s request.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to execute (e.g., "ls", "grep", "node", "curl")',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments for the command',
        },
        cwd: {
          type: 'string',
          description: 'Current working directory for the command. Optional.',
        },
      },
      required: ['command', 'args'],
    },
    category: ToolCategory.SYSTEM_COMMANDS,
  },
  // ========== NEW TOOLS ==========
  {
    name: 'get_recent_files',
    description: 'Find recently modified files in a directory. Useful for finding files you\'ve worked on recently or tracking changes. Can filter by time range and file type.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to search. If not provided, uses the current working directory.',
        },
        withinDays: {
          type: 'number',
          description: 'Find files modified within this many days. Default: 7.',
        },
        withinHours: {
          type: 'number',
          description: 'Find files modified within this many hours. More precise than withinDays.',
        },
        filePattern: {
          type: 'string',
          description: 'File pattern filter (e.g., "*.js", "*.doc"). Optional.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Search in subdirectories recursively. Default: true.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return. Default: 50.',
        },
        sortBy: {
          type: 'string',
          enum: ['modified', 'created', 'size', 'name'],
          description: 'Sort results by: modified (newest first), created, size, or name. Default: modified.',
        },
      },
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'get_recent_files({ withinDays: 1 }) - Files modified today',
      'get_recent_files({ withinHours: 2, filePattern: "*.py" }) - Python files from last 2 hours',
    ],
  },
  {
    name: 'get_large_files',
    description: 'Find large files in a directory that may be taking up disk space. Useful for cleanup and identifying space hogs.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to search. If not provided, uses the current working directory.',
        },
        minSizeMB: {
          type: 'number',
          description: 'Minimum file size in megabytes. Default: 100.',
        },
        minSizeKB: {
          type: 'number',
          description: 'Minimum file size in kilobytes. Use for smaller threshold. Takes precedence over minSizeMB.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Search in subdirectories recursively. Default: true.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return. Default: 50.',
        },
        excludePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to exclude (e.g., ["node_modules/*", "*.iso"]).',
        },
      },
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'get_large_files({ minSizeMB: 500 }) - Files larger than 500MB',
      'get_large_files({ minSizeKB: 1024 }) - Files larger than 1MB',
    ],
  },
  {
    name: 'get_empty_folders',
    description: 'Find empty folders in a directory. Useful for cleanup and organization. Empty folders can accumulate over time and clutter your file system.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to search. If not provided, uses the current working directory.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Search in subdirectories recursively. Default: true.',
        },
        deleteEmpty: {
          type: 'boolean',
          description: 'Actually delete the empty folders found. Default: false (just reports them).',
        },
      },
    },
    category: ToolCategory.ORGANIZATION,
    examples: [
      'get_empty_folders({ path: "/Downloads" }) - Find empty folders in Downloads',
      'get_empty_folders({ deleteEmpty: true }) - Find and remove empty folders',
    ],
  },
  {
    name: 'backup_file',
    description: 'Create a timestamped backup of a file or folder. Creates a copy with a timestamp suffix to preserve the original.',
    input_schema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Path to the file or folder to backup.',
        },
        backupDirectory: {
          type: 'string',
          description: 'Directory to store the backup. If not provided, creates backup in the same directory.',
        },
        suffix: {
          type: 'string',
          description: 'Custom suffix for backup name. Default: timestamp (YYYY-MM-DD_HH-MM-SS).',
        },
        compress: {
          type: 'boolean',
          description: 'Compress the backup (creates a .zip file). Default: false.',
        },
      },
      required: ['sourcePath'],
    },
    category: ToolCategory.FILE_OPERATIONS,
    examples: [
      'backup_file({ sourcePath: "/path/to/important.docx" }) - Create backup with timestamp',
      'backup_file({ sourcePath: "/project", compress: true }) - Create compressed backup',
    ],
  },
  {
    name: 'get_disk_usage',
    description: 'Get disk usage information for the current drive or a specific path. Shows total space, used space, and available space.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to check disk usage for. If not provided, uses the current working directory.',
        },
      },
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'get_disk_usage() - Check disk space for current directory',
      'get_disk_usage({ path: "/" }) - Check root disk usage',
    ],
  },
  {
    name: 'flatten_directory',
    description: 'Move all files from subdirectories into a single directory. Useful for consolidating scattered files. Creates a flat structure.',
    input_schema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Directory containing nested subdirectories to flatten.',
        },
        destinationPath: {
          type: 'string',
          description: 'Directory to move files to. If not provided, moves to the source directory.',
        },
        handleDuplicates: {
          type: 'string',
          enum: ['rename', 'skip', 'overwrite'],
          description: 'How to handle duplicate file names: rename (add number), skip, or overwrite. Default: rename.',
        },
        deleteEmptyFolders: {
          type: 'boolean',
          description: 'Delete empty folders after flattening. Default: true.',
        },
        filePattern: {
          type: 'string',
          description: 'Only flatten files matching this pattern (e.g., "*.jpg"). Optional.',
        },
        preview: {
          type: 'boolean',
          description: 'Preview the operation without making changes. Default: false.',
        },
      },
      required: ['sourcePath'],
    },
    category: ToolCategory.ORGANIZATION,
    examples: [
      'flatten_directory({ sourcePath: "/Photos", filePattern: "*.jpg" }) - Flatten all JPG files',
      'flatten_directory({ sourcePath: "/Downloads", preview: true }) - Preview flatten operation',
    ],
  },
  {
    name: 'get_file_types_summary',
    description: 'Get a summary of all file types in a directory with counts and total sizes. Useful for understanding what\'s in a directory at a glance.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to analyze. If not provided, uses the current working directory.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Include files from subdirectories. Default: true.',
        },
        groupBy: {
          type: 'string',
          enum: ['extension', 'category', 'mime'],
          description: 'How to group files: extension (e.g., .jpg), category (e.g., Images), or mime type. Default: extension.',
        },
      },
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'get_file_types_summary() - Get summary of file types',
      'get_file_types_summary({ groupBy: "category" }) - Group by category (Images, Documents, etc.)',
    ],
  },
  {
    name: 'preview_operation',
    description: 'Preview a file operation without executing it. Shows what would happen if you ran organize, move, rename, or delete operations. Use this for safety before destructive operations.',
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['organize', 'delete', 'move', 'rename', 'flatten'],
          description: 'The operation to preview.',
        },
        params: {
          type: 'object',
          description: 'Parameters for the operation (same as the actual operation would use).',
        },
      },
      required: ['operation', 'params'],
    },
    category: ToolCategory.FILE_OPERATIONS,
    examples: [
      'preview_operation({ operation: "delete", params: { paths: [...] }}) - Preview delete',
      'preview_operation({ operation: "organize", params: { strategy: "by-type" }}) - Preview organize',
    ],
  },
  {
    name: 'undo_last_operation',
    description: 'Undo the last file operation if possible. Works for move, rename, and copy operations. Some operations like delete cannot be undone.',
    input_schema: {
      type: 'object',
      properties: {
        operationId: {
          type: 'string',
          description: 'ID of the operation to undo. If not provided, undoes the most recent operation.',
        },
      },
    },
    category: ToolCategory.FILE_OPERATIONS,
    examples: [
      'undo_last_operation() - Undo most recent operation',
    ],
  },
  {
    name: 'watch_directory',
    description: 'Start watching a directory for changes. Reports new files, modified files, and deleted files. Useful for monitoring folders.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to watch.',
        },
        duration: {
          type: 'number',
          description: 'How long to watch in seconds. Default: 60.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Watch subdirectories recursively. Default: true.',
        },
        filePattern: {
          type: 'string',
          description: 'Only report changes to files matching this pattern.',
        },
      },
      required: ['path'],
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'watch_directory({ path: "/Downloads", duration: 30 }) - Watch Downloads for 30 seconds',
    ],
  },
  {
    name: 'merge_text_files',
    description: 'Merge multiple text files into one. Useful for combining logs, documents, or code files.',
    input_schema: {
      type: 'object',
      properties: {
        sourcePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths to merge.',
        },
        destinationPath: {
          type: 'string',
          description: 'Path for the merged output file.',
        },
        separator: {
          type: 'string',
          description: 'Text to insert between merged files. Default: newline.',
        },
        includeFilenames: {
          type: 'boolean',
          description: 'Include filename headers in the merged file. Default: true.',
        },
      },
      required: ['sourcePaths', 'destinationPath'],
    },
    category: ToolCategory.FILE_OPERATIONS,
    examples: [
      'merge_text_files({ sourcePaths: ["log1.txt", "log2.txt"], destinationPath: "combined.txt" })',
    ],
  },
  {
    name: 'split_file',
    description: 'Split a large file into smaller parts. Useful for handling large files or preparing for upload.',
    input_schema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Path to the file to split.',
        },
        chunkSizeMB: {
          type: 'number',
          description: 'Size of each chunk in megabytes. Default: 100.',
        },
        outputDirectory: {
          type: 'string',
          description: 'Directory for split files. If not provided, uses same directory as source.',
        },
        prefix: {
          type: 'string',
          description: 'Prefix for split file names. Default: original filename.',
        },
      },
      required: ['sourcePath'],
    },
    category: ToolCategory.FILE_OPERATIONS,
    examples: [
      'split_file({ sourcePath: "/large-video.mp4", chunkSizeMB: 500 })',
    ],
  },
  {
    name: 'sync_directories',
    description: 'Synchronize two directories so they have the same files. Can copy new/modified files from source to destination.',
    input_schema: {
      type: 'object',
      properties: {
        sourcePath: {
          type: 'string',
          description: 'Source directory (the master copy).',
        },
        destinationPath: {
          type: 'string',
          description: 'Destination directory (will be updated to match source).',
        },
        mode: {
          type: 'string',
          enum: ['mirror', 'update', 'backup'],
          description: 'Sync mode: mirror (exact copy, deletes extra), update (only add new/changed), backup (like update but keeps old versions). Default: update.',
        },
        deleteExtra: {
          type: 'boolean',
          description: 'Delete files in destination that don\'t exist in source. Only for mirror mode. Default: false.',
        },
        preview: {
          type: 'boolean',
          description: 'Preview the sync without making changes. Default: false.',
        },
      },
      required: ['sourcePath', 'destinationPath'],
    },
    category: ToolCategory.FILE_OPERATIONS,
    examples: [
      'sync_directories({ sourcePath: "/Work", destinationPath: "/Backup/Work" })',
      'sync_directories({ sourcePath: "/Photos", destinationPath: "/Backup", preview: true })',
    ],
  },
  {
    name: 'find_broken_links',
    description: 'Find broken symbolic links and shortcuts in a directory. Broken links point to files/folders that no longer exist.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to search. If not provided, uses the current working directory.',
        },
        includeSubdirectories: {
          type: 'boolean',
          description: 'Search in subdirectories recursively. Default: true.',
        },
        deletebroken: {
          type: 'boolean',
          description: 'Delete broken links found. Default: false (just reports them).',
        },
      },
    },
    category: ToolCategory.SEARCH_AND_ANALYSIS,
    examples: [
      'find_broken_links() - Find broken links',
      'find_broken_links({ deleteBroken: true }) - Find and remove broken links',
    ],
  },
  {
    name: 'get_tool_help',
    description: 'Get detailed help and examples for a specific tool. Shows tool description, parameters, and usage examples.',
    input_schema: {
      type: 'object',
      properties: {
        toolName: {
          type: 'string',
          description: 'Name of the tool to get help for. If not provided, lists all available tools.',
        },
        category: {
          type: 'string',
          enum: ['file_operations', 'directory_operations', 'search_and_analysis', 'organization', 'agent_management', 'system_commands', 'tab_tools', 'skills'],
          description: 'Filter tools by category.',
        },
      },
    },
    category: ToolCategory.SYSTEM_COMMANDS,
    examples: [
      'get_tool_help({ toolName: "organize_files" }) - Get help for organize_files',
      'get_tool_help({ category: "search_and_analysis" }) - List search tools',
    ],
  },
  // ========== WORKFLOW TOOLS ==========
  {
    name: 'list_workflows',
    description: 'Lists all available workflow templates. Use this to see what automated workflows the user has saved.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['organization', 'cleanup', 'backup', 'migration', 'analysis', 'development', 'custom'],
          description: 'Filter workflows by category.',
        },
        favoritesOnly: {
          type: 'boolean',
          description: 'Only show favorited workflows.',
        },
      },
    },
    category: ToolCategory.SYSTEM_COMMANDS,
    examples: [
      'list_workflows() - List all workflows',
      'list_workflows({ category: "organization" }) - List organization workflows',
      'list_workflows({ favoritesOnly: true }) - List favorite workflows',
    ],
  },
  {
    name: 'run_workflow',
    description: 'Executes a saved workflow template with the specified parameters. Use this to run automated multi-step operations.',
    input_schema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'The ID of the workflow to execute.',
        },
        workflowName: {
          type: 'string',
          description: 'The name of the workflow to execute (alternative to ID).',
        },
        parameters: {
          type: 'object',
          description: 'Parameter values to pass to the workflow (e.g., { targetPath: "/path/to/folder" }).',
        },
      },
    },
    category: ToolCategory.SYSTEM_COMMANDS,
    examples: [
      'run_workflow({ workflowName: "Organize by Type", parameters: { targetPath: "/Downloads" } })',
      'run_workflow({ workflowId: "wf-123", parameters: { sourcePath: "/docs", backupPath: "/backups" } })',
    ],
  },
  {
    name: 'create_workflow',
    description: 'Creates a new workflow from a built-in template or from scratch. Use this when the user wants to save a sequence of operations for reuse.',
    input_schema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'ID of the built-in template to use (e.g., "builtin-organize-by-type").',
        },
        name: {
          type: 'string',
          description: 'Name for the new workflow.',
        },
        description: {
          type: 'string',
          description: 'Description of what the workflow does.',
        },
        category: {
          type: 'string',
          enum: ['organization', 'cleanup', 'backup', 'migration', 'analysis', 'development', 'custom'],
          description: 'Category for the workflow.',
        },
      },
      required: ['name'],
    },
    category: ToolCategory.SYSTEM_COMMANDS,
    examples: [
      'create_workflow({ templateId: "builtin-organize-by-type", name: "My Organize Workflow" })',
      'create_workflow({ name: "Daily Backup", category: "backup", description: "Backs up my documents" })',
    ],
  },
  {
    name: 'get_workflow_templates',
    description: 'Lists available built-in workflow templates that can be used as starting points for new workflows.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['organization', 'cleanup', 'backup', 'migration', 'analysis', 'development', 'custom'],
          description: 'Filter templates by category.',
        },
      },
    },
    category: ToolCategory.SYSTEM_COMMANDS,
    examples: [
      'get_workflow_templates() - List all templates',
      'get_workflow_templates({ category: "organization" }) - List organization templates',
    ],
  },
];

/**
 * Executes a tool by name with the provided arguments.
 */
/**
 * Helper function to find ClawdBot CLI path.
 * Tries multiple locations including PATH and common nvm installations.
 * Returns an object with the path and whether to use Node 22 from nvm.
 * 
 * Front-end utility: Can be used by UI components to check ClawdBot availability.
 */
export async function findClawdBotPath(): Promise<{ path: string; useNode22: boolean } | null> {
  const { Command } = await import('@tauri-apps/plugin-shell');

  // Node 22 path from nvm (required for ClawdBot)
  const NODE22_PATH = '/Users/koo1j/.nvm/versions/node/v22.22.0/bin/node';
  const CLAWDBOT_NVM_PATH = '/Users/koo1j/.nvm/versions/node/v22.22.0/bin/clawdbot';
  const CLAWDBOT_GLOBAL_PATH = '/usr/local/bin/clawdbot';

  // Try paths in order of preference:
  // 1. nvm ClawdBot (uses Node 22 automatically)
  // 2. Global ClawdBot with nvm Node 22
  // 3. PATH ClawdBot (may fail if Node < 22)

  const pathsToTry = [
    { path: CLAWDBOT_NVM_PATH, useNode22: false, description: 'nvm ClawdBot' },
    { path: CLAWDBOT_GLOBAL_PATH, useNode22: true, description: 'global ClawdBot with Node 22' },
    { path: 'clawdbot', useNode22: false, description: 'PATH ClawdBot' },
  ];

  // Try each path until one works
  for (const { path: clawdbotPath, useNode22, description } of pathsToTry) {
    try {
      let cmd;
      if (useNode22 && clawdbotPath !== 'clawdbot') {
        // Use Node 22 from nvm to run ClawdBot
        cmd = Command.create('sh', ['-c', `${NODE22_PATH} ${clawdbotPath} --version`]);
      } else if (clawdbotPath === 'clawdbot') {
        // Try direct command (from PATH)
        cmd = Command.create('clawdbot', ['--version']);
      } else {
        // Use absolute path with sh wrapper
        cmd = Command.create('sh', ['-c', `${clawdbotPath} --version`]);
      }

      const result = await cmd.execute();

      if (result.code === 0) {
        return { path: clawdbotPath, useNode22 };
      }
    } catch (error) {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Helper function to find ClawdHub CLI path.
 * Tries multiple locations including PATH and common nvm installations.
 * Returns the path if found, or null if not found.
 */
async function findClawdHubPath(): Promise<string | null> {
  const { Command } = await import('@tauri-apps/plugin-shell');

  // Define potential ClawdHub paths (check common nvm locations)
  const CLAWDHUB_PATHS = [
    'clawdhub', // Try PATH first
    '/Users/koo1j/.nvm/versions/node/v22.22.0/bin/clawdhub', // Known nvm path
  ];

  // Try each path until one works
  for (const clawdhubPath of CLAWDHUB_PATHS) {
    try {
      let cmd;
      if (clawdhubPath === 'clawdhub') {
        // Try direct command (from PATH)
        cmd = Command.create('clawdhub', ['--version']);
      } else {
        // Use absolute path with sh wrapper
        cmd = Command.create('sh', ['-c', `${clawdhubPath} --version`]);
      }

      const result = await cmd.execute();

      if (result.code === 0) {
        return clawdhubPath;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Helper function to create a ClawdBot command.
 * Uses the findClawdBotPath helper to locate ClawdBot.
 */
async function createClawdBotCommand(args: string[], workDir?: string): Promise<{ cmd: any; path: string } | null> {
  const { Command } = await import('@tauri-apps/plugin-shell');
  const clawdbotInfo = await findClawdBotPath();

  if (!clawdbotInfo) {
    return null;
  }

  const { path: clawdbotPath, useNode22 } = clawdbotInfo;
  const NODE22_PATH = '/Users/koo1j/.nvm/versions/node/v22.22.0/bin/node';

  let cmd;
  if (useNode22 && clawdbotPath !== 'clawdbot') {
    // Use Node 22 from nvm to run ClawdBot
    const escapedArgs = args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
    cmd = Command.create('sh', ['-c', `${NODE22_PATH} ${clawdbotPath} ${escapedArgs}`]);
  } else if (clawdbotPath === 'clawdbot') {
    // Use direct command (from PATH)
    cmd = Command.create('clawdbot', args);
  } else {
    // Use absolute path with sh wrapper
    const escapedArgs = args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
    cmd = Command.create('sh', ['-c', `${clawdbotPath} ${escapedArgs}`]);
  }

  // Set working directory if provided - reconstruct command with cd prepended
  if (workDir) {
    // Reconstruct the command with cd prepended since we can't modify Command properties
    if (clawdbotPath === 'clawdbot') {
      // For direct command, wrap in sh with cd
      const escapedArgs = args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
      cmd = Command.create('sh', ['-c', `cd "${workDir}" && clawdbot ${escapedArgs}`]);
    } else {
      // For absolute path or Node 22, reconstruct with cd
      const escapedArgs = args.map(arg => `'${arg.replace(/'/g, "'\\''")}'`).join(' ');
      if (useNode22 && clawdbotPath !== 'clawdbot') {
        cmd = Command.create('sh', ['-c', `cd "${workDir}" && ${NODE22_PATH} ${clawdbotPath} ${escapedArgs}`]);
      } else {
        cmd = Command.create('sh', ['-c', `cd "${workDir}" && ${clawdbotPath} ${escapedArgs}`]);
      }
    }
  }

  return { cmd, path: clawdbotPath };
}

/**
 * Utility Functions for Tool Execution
 * These functions provide common patterns used across multiple tools.
 */

/**
 * Normalizes a file or directory path, resolving it relative to current directory if needed.
 */
async function normalizePath(path: string | undefined, currentDirectory: string): Promise<string | null> {
  if (!path) {
    return currentDirectory || null;
  }
  
  // If path is already absolute, return as-is
  if (path.startsWith('/') || path.startsWith('~')) {
    return path;
  }
  
  // Resolve relative to current directory
  if (currentDirectory) {
    try {
      return await join(currentDirectory, path);
    } catch (e) {
      return null;
    }
  }
  
  return path;
}

/**
 * Validates that a path exists and is accessible.
 */
async function validatePath(path: string, mustBeDirectory: boolean = false): Promise<ValidationResult> {
  try {
    const pathExists = await exists(path);
    if (!pathExists) {
      return {
        valid: false,
        error: `Path does not exist: ${path}`,
      };
    }
    
    if (mustBeDirectory) {
      const pathStat = await stat(path);
      // Note: Tauri's stat doesn't directly tell us if it's a directory
      // We'll need to check by trying to read it as a directory
      try {
        await readDir(path);
      } catch (e) {
        return {
          valid: false,
          error: `Path is not a directory: ${path}`,
        };
      }
    }
    
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: `Cannot access path: ${error.message}`,
    };
  }
}

/**
 * Validates required parameters for a tool.
 */
function validateRequiredParams(args: Record<string, any>, required: string[]): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  for (const param of required) {
    if (args[param] === undefined || args[param] === null || args[param] === '') {
      missing.push(param);
    }
  }
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required parameters: ${missing.join(', ')}`,
    };
  }
  
  return { valid: true, warnings };
}

/**
 * Creates a standardized error result.
 */
function createErrorResult(error: string, warnings?: string[]): ToolResult {
  return {
    success: false,
    error,
    warnings,
  };
}

/**
 * Creates a standardized success result.
 */
function createSuccessResult(data: any, operation?: FileOperation, metadata?: ToolResult['metadata']): ToolResult {
  return {
    success: true,
    data,
    operation,
    metadata,
  };
}

/**
 * Wraps tool execution with timing and error handling.
 */
async function executeWithTiming<T>(
  fn: () => Promise<T>,
  toolName: string
): Promise<{ result: T; executionTime: number }> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const executionTime = Date.now() - startTime;
    return { result, executionTime };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`[${toolName}] Execution failed after ${executionTime}ms:`, error);
    throw error;
  }
}

/**
 * Executes a tool by name with the provided arguments.
 * Enhanced with better error handling, validation, and timing.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  const startTime = Date.now();
  
  // Initialize audit logger if settings provided
  if (context.settings.auditLog) {
    auditLogger.updateSettings(context.settings.auditLog);
  }

  // Log tool execution start (debug level)
  auditLogger.debug('tool_execution', `start_${toolName}`, `Starting tool execution: ${toolName}`, {
    toolName,
    toolArgs: args,
  });
  
  try {
    // Update permission manager with current settings
    if (context.settings.toolPermissions) {
      toolPermissionManager.updateSettings(context.settings.toolPermissions);
    }

    // Check tool permissions before execution
    const permissionCheck = toolPermissionManager.checkPermission(toolName);
    
    // Log permission check
    auditLogger.logPermissionCheck(toolName, permissionCheck.allowed, permissionCheck.reason);
    
    if (!permissionCheck.allowed) {
      console.log(`[executeTool] Tool "${toolName}" is disabled: ${permissionCheck.reason}`);
      
      // Log permission denial
      auditLogger.warn('permission', 'permission_denied', `Tool "${toolName}" execution blocked`, {
        toolName,
        metadata: { reason: permissionCheck.reason },
      });
      
      return createErrorResult(
        `This operation is not permitted. ${permissionCheck.reason}`,
        [`Tool "${toolPermissionManager.getToolDisplayName(toolName)}" is currently disabled in settings.`]
      );
    }

    // Log if confirmation would normally be required
    // (actual confirmation handled at AI service level)
    if (permissionCheck.requiresConfirmation) {
      console.log(`[executeTool] Tool "${toolName}" requires confirmation: ${permissionCheck.reason}`);
    }

    // Get tool definition for validation
    const toolDef = TOOLS.find(t => t.name === toolName);
    if (toolDef && toolDef.input_schema.required) {
      const validation = validateRequiredParams(args, toolDef.input_schema.required);
      if (!validation.valid) {
        return createErrorResult(validation.error || 'Invalid parameters', validation.warnings);
      }
    }
    
    const path = args.path || context.currentDirectory;

  try {
    switch (toolName) {
      case 'analyze_directory': {
        const normalizedPath = await normalizePath(path, context.currentDirectory);
        if (!normalizedPath) {
          return createErrorResult('No directory path provided. Please select a directory first.');
        }
        
        const pathValidation = await validatePath(normalizedPath, true);
        if (!pathValidation.valid) {
          return createErrorResult(pathValidation.error || 'Invalid directory path');
        }
        
        // Check cache settings and update cache configuration
        const cacheEnabled = context.settings.cacheSettings?.enabled ?? true;
        const cacheTTL = context.settings.cacheSettings?.ttlSeconds ?? 300;
        const cacheMaxEntries = context.settings.cacheSettings?.maxEntries ?? 50;
        
        directoryCache.updateConfig({
          enabled: cacheEnabled,
          ttlSeconds: cacheTTL,
          maxEntries: cacheMaxEntries,
        });
        
        // Try to get from cache first
        const cachedAnalysis = directoryCache.get(normalizedPath);
        if (cachedAnalysis) {
          const cacheStats = directoryCache.getStats();
          console.log(`[analyze_directory] Cache hit! Hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
          
          return createSuccessResult(
            {
              totalFiles: cachedAnalysis.totalFiles,
              totalSize: cachedAnalysis.totalSize,
              organizationScore: cachedAnalysis.organizationScore,
              fileTypes: cachedAnalysis.fileTypes.slice(0, 10),
              summary: cachedAnalysis.summary,
              path: normalizedPath,
              cached: true,
              cacheAge: Math.round((Date.now() - (directoryCache.getEntryInfo(normalizedPath)?.timestamp || Date.now())) / 1000),
            },
            undefined,
            { executionTime: 0, itemsProcessed: cachedAnalysis.totalFiles, fromCache: true }
          );
        }
        
        // Cache miss - perform fresh analysis
        const { result: analysis, executionTime } = await executeWithTiming(
          () => analyzeDirectoryFiles(normalizedPath),
          toolName
        );
        
        // Store in cache
        directoryCache.set(normalizedPath, analysis);
        
        const cacheStats = directoryCache.getStats();
        console.log(`[analyze_directory] Cached result. Entries: ${cacheStats.entries}, Hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
        
        return createSuccessResult(
          {
            totalFiles: analysis.totalFiles,
            totalSize: analysis.totalSize,
            organizationScore: analysis.organizationScore,
            fileTypes: analysis.fileTypes.slice(0, 10),
            summary: analysis.summary,
            path: normalizedPath,
            cached: false,
          },
          undefined,
          { executionTime, itemsProcessed: analysis.totalFiles, fromCache: false }
        );
      }

      case 'organize_files': {
        const normalizedPath = await normalizePath(path, context.currentDirectory);
        if (!normalizedPath) {
          return createErrorResult('No directory path provided. Please select a directory first.');
        }
        
        const pathValidation = await validatePath(normalizedPath, true);
        if (!pathValidation.valid) {
          return createErrorResult(pathValidation.error || 'Invalid directory path');
        }
        
        const config: OrganizationConfig = {
          strategy: args.strategy || 'by-type',
          options: {
            dateFormat: args.dateFormat || 'year-month',
          },
        };
        
        const { result: operation, executionTime } = await executeWithTiming(
          () => organizeFilesByStrategy(normalizedPath, config),
          toolName
        );
        
        return createSuccessResult(
          {
            description: operation.description,
            fileCount: operation.files.length,
            confidence: operation.confidence,
            requiresConfirmation: operation.requiresConfirmation,
            path: normalizedPath,
            strategy: config.strategy,
          },
          operation,
          { executionTime, itemsProcessed: operation.files.length }
        );
      }

      case 'find_duplicates': {
        const normalizedPath = await normalizePath(path, context.currentDirectory);
        if (!normalizedPath) {
          return createErrorResult('No directory path provided. Please select a directory first.');
        }
        
        const pathValidation = await validatePath(normalizedPath, true);
        if (!pathValidation.valid) {
          return createErrorResult(pathValidation.error || 'Invalid directory path');
        }
        
        const { result: duplicates, executionTime } = await executeWithTiming(
          () => findDuplicateFiles(normalizedPath),
          toolName
        );
        
        return createSuccessResult(
          {
            totalDuplicates: duplicates.totalDuplicates,
            duplicateGroups: duplicates.duplicateGroups.slice(0, 10),
            totalWastedSpace: duplicates.totalWastedSpace,
            summary: duplicates.summary,
            path: normalizedPath,
            totalGroups: duplicates.duplicateGroups.length,
          },
          undefined,
          { executionTime, itemsProcessed: duplicates.totalDuplicates }
        );
      }

      case 'rename_files': {
        const normalizedPath = await normalizePath(path, context.currentDirectory);
        if (!normalizedPath) {
          return createErrorResult('No directory path provided. Please select a directory first.');
        }
        
        const pathValidation = await validatePath(normalizedPath, true);
        if (!pathValidation.valid) {
          return createErrorResult(pathValidation.error || 'Invalid directory path');
        }
        
        const patternMap: Record<string, string> = {
          'date-prefix': 'Rename these files to include their creation date in YYYY-MM-DD format',
          'snake-case': 'Rename these files to snake_case format',
          'standardize': 'Standardize the naming of these files',
          'clean': 'Clean up the filenames by removing special characters',
        };
        const renameCommand = patternMap[args.pattern] || patternMap['clean'];
        
        const { result: renameOperation, executionTime } = await executeWithTiming(
          () => generateRenameOperation(normalizedPath, renameCommand),
          toolName
        );
        
        return createSuccessResult(
          {
            description: renameOperation.description,
            fileCount: renameOperation.files.length,
            confidence: renameOperation.confidence,
            pattern: args.pattern,
            path: normalizedPath,
          },
          renameOperation,
          { executionTime, itemsProcessed: renameOperation.files.length }
        );
      }

      case 'execute_operation':
        if (!args.operation) {
          return {
            success: false,
            error: 'No operation provided to execute.',
          };
        }
        await executeFileOperation(args.operation, {
          enableBackup: context.settings.enableBackup,
          excludedFolders: context.settings.excludedFolders,
        });
        
        // Invalidate cache for affected directories after file operations
        if (args.operation.files && args.operation.files.length > 0) {
          const affectedPaths = new Set<string>();
          for (const file of args.operation.files) {
            if (file.sourcePath) {
              const sourceDir = file.sourcePath.substring(0, file.sourcePath.lastIndexOf('/'));
              if (sourceDir) affectedPaths.add(sourceDir);
            }
            if (file.targetPath) {
              const targetDir = file.targetPath.substring(0, file.targetPath.lastIndexOf('/'));
              if (targetDir) affectedPaths.add(targetDir);
            }
          }
          for (const dirPath of affectedPaths) {
            directoryCache.invalidate(dirPath);
          }
          console.log(`[execute_operation] Invalidated ${affectedPaths.size} cached directories`);
        }
        
        return {
          success: true,
          data: {
            message: 'Operation executed successfully',
          },
        };

      // Tab-based tools
      case 'file_copy_tab': {
        const copyResult = await toolOrchestrator.executeTool(
          'file_copy',
          args as FileCopyToolParams,
          'File Copy operation'
        );
        // Invalidate cache for source and destination directories
        if (copyResult.success) {
          const copyArgs = args as FileCopyToolParams;
          if (copyArgs.sourcePath) directoryCache.invalidate(copyArgs.sourcePath);
          if (copyArgs.destinationPath) directoryCache.invalidate(copyArgs.destinationPath);
        }
        return copyResult;
      }

      case 'folder_creation_tab': {
        const folderResult = await toolOrchestrator.executeTool(
          'folder_creation',
          args as FolderCreationToolParams,
          'Folder Creation operation'
        );
        // Invalidate cache for the root path where folders were created
        if (folderResult.success) {
          const folderArgs = args as FolderCreationToolParams;
          if (folderArgs.rootPath) directoryCache.invalidate(folderArgs.rootPath);
        }
        return folderResult;
      }

      case 'file_creation_tab': {
        const fileResult = await toolOrchestrator.executeTool(
          'file_creation',
          args as FileCreationToolParams,
          'File Creation operation'
        );
        // Invalidate cache for the root path where files were created
        if (fileResult.success) {
          const fileArgs = args as FileCreationToolParams;
          if (fileArgs.rootPath) directoryCache.invalidate(fileArgs.rootPath);
        }
        return fileResult;
      }

      case 'find_replace_tab':
        return await toolOrchestrator.executeTool(
          'find_replace',
          args as FindReplaceToolParams,
          'Find & Replace operation'
        );

      // Agent management tools
      case 'list_agents':
        const agents = agentService.getAgents();
        return {
          success: true,
          data: {
            agents: agents.map(agent => ({
              id: agent.id,
              type: agent.type,
              name: agent.name,
              description: agent.description,
              enabled: agent.enabled,
              params: agent.params,
            })),
            total: agents.length,
          },
        };

      case 'start_agent':
        try {
          const agent = agentService.getAgent(args.agentId);
          if (!agent) {
            return {
              success: false,
              error: `Agent with ID "${args.agentId}" not found. Use list_agents to see available agents.`,
            };
          }

          if (!agent.enabled) {
            return {
              success: false,
              error: `Agent "${agent.name}" is not enabled. Enable it first using configure_agent.`,
            };
          }

          const state = agentService.getAgentState(args.agentId);
          if (state?.status === 'running') {
            return {
              success: false,
              error: `Agent "${agent.name}" is already running.`,
            };
          }

          await agentService.startAgent(args.agentId);
          return {
            success: true,
            data: {
              message: `Agent "${agent.name}" started successfully`,
              agentId: args.agentId,
              agentName: agent.name,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to start agent',
          };
        }

      case 'stop_agent':
        const agentToStop = agentService.getAgent(args.agentId);
        if (!agentToStop) {
          return {
            success: false,
            error: `Agent with ID "${args.agentId}" not found. Use list_agents to see available agents.`,
          };
        }

        const stateToStop = agentService.getAgentState(args.agentId);
        if (!stateToStop || (stateToStop.status !== 'running' && stateToStop.status !== 'paused')) {
          return {
            success: false,
            error: `Agent "${agentToStop.name}" is not currently running.`,
          };
        }

        agentService.stopAgent(args.agentId);
        return {
          success: true,
          data: {
            message: `Agent "${agentToStop.name}" stopped`,
            agentId: args.agentId,
            agentName: agentToStop.name,
          },
        };

      case 'get_agent_status':
        const state = agentService.getAgentState(args.agentId);
        const agentInfo = agentService.getAgent(args.agentId);
        if (!agentInfo) {
          return {
            success: false,
            error: `Agent with ID "${args.agentId}" not found`,
          };
        }
        return {
          success: true,
          data: {
            agent: {
              id: agentInfo.id,
              name: agentInfo.name,
              type: agentInfo.type,
              enabled: agentInfo.enabled,
            },
            state: state ? {
              status: state.status,
              progress: state.progress,
              startedAt: state.startedAt,
              completedAt: state.completedAt,
              error: state.error,
              results: state.results,
              recentLogs: state.logs.slice(-5),
            } : null,
          },
        };

      case 'configure_agent':
        try {
          const agentToConfigure = agentService.getAgent(args.agentId);
          if (!agentToConfigure) {
            return {
              success: false,
              error: `Agent with ID "${args.agentId}" not found. Use list_agents to see available agents.`,
            };
          }

          const updates: any = {};
          if (args.params !== undefined) {
            // Merge with existing params
            updates.params = { ...agentToConfigure.params, ...args.params };
          }
          if (args.enabled !== undefined) {
            updates.enabled = args.enabled;
            // Stop agent if disabling
            if (!args.enabled) {
              const currentState = agentService.getAgentState(args.agentId);
              if (currentState?.status === 'running' || currentState?.status === 'paused') {
                agentService.stopAgent(args.agentId);
              }
            }
          }

          agentService.updateAgent(args.agentId, updates);
          const configuredAgent = agentService.getAgent(args.agentId);

          return {
            success: true,
            data: {
              message: `Agent "${configuredAgent?.name || args.agentId}" configured successfully`,
              agent: {
                id: configuredAgent?.id,
                type: configuredAgent?.type,
                name: configuredAgent?.name,
                description: configuredAgent?.description,
                enabled: configuredAgent?.enabled,
                params: configuredAgent?.params,
              },
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Failed to configure agent',
          };
        }

      // ClawdBot integration tools
      case 'clawdbot_execute':
        try {
          // Check if ClawdBot is enabled in settings
          if (!context.settings.clawdbotEnabled) {
            return {
              success: false,
              error: 'ClawdBot is not enabled. Please enable it in Settings → Clawdbot Integration.',
            };
          }

          const command = args.command as string;
          const commandArgs = (args.args as string[]) || [];
          const workDir = args.directory || context.currentDirectory || undefined;

          // Build command arguments
          const cmdArgs = [command, ...commandArgs];

          // Use helper function to find and create ClawdBot command
          const cmdResult = await createClawdBotCommand(cmdArgs, workDir);

          if (!cmdResult) {
            return {
              success: false,
              error: 'ClawdBot CLI not found. Make sure it is installed and in your PATH, or install it with: npm install -g clawdbot',
            };
          }

          const result = await cmdResult.cmd.execute();

          if (result.code === 0) {
            return {
              success: true,
              data: {
                message: `ClawdBot command "${command}" executed successfully`,
                output: result.stdout,
                command: command,
                args: commandArgs,
              },
            };
          } else {
            return {
              success: false,
              error: `ClawdBot command failed: ${result.stderr || result.stdout || 'Unknown error'}`,
              data: {
                output: result.stdout,
                error: result.stderr,
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: `Failed to execute ClawdBot command: ${error.message || 'Unknown error'}. Make sure ClawdBot CLI is installed and in your PATH.`,
          };
        }

      case 'clawdhub_list_skills':
        try {
          // Use helper function to find and create ClawdBot command
          const cmdResult = await createClawdBotCommand(['plugins', 'list', '--json']);

          if (!cmdResult) {
            return {
              success: false,
              error: 'ClawdBot CLI not found. Make sure it is installed and in your PATH, or install it with: npm install -g clawdbot',
            };
          }

          // Try to get skills from ClawdBot plugins list
          const result = await cmdResult.cmd.execute();

          if (result.code === 0) {
            try {
              // Clean ANSI escape codes
              const cleanOutput = result.stdout.replace(/\u001b\[.*?m/g, '');
              const plugins = JSON.parse(cleanOutput);

              return {
                success: true,
                data: {
                  skills: Array.isArray(plugins) ? plugins.map((p: any) => ({
                    name: p.name,
                    description: p.description,
                    enabled: p.enabled,
                    source: p.source,
                    origin: p.origin,
                  })) : [],
                  total: Array.isArray(plugins) ? plugins.length : 0,
                },
              };
            } catch (parseError) {
              return {
                success: false,
                error: 'Failed to parse ClawdBot plugins output. Make sure ClawdBot is properly installed.',
              };
            }
          } else {
            return {
              success: false,
              error: `Failed to list skills: ${result.stderr || 'Unknown error'}`,
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: `Failed to list ClawdHub skills: ${error.message || 'Unknown error'}. Make sure ClawdBot CLI is installed.`,
          };
        }

      case 'clawdhub_install_skill':
        try {
          const skillName = args.skillName as string;
          if (!skillName) {
            return {
              success: false,
              error: 'Skill name is required',
            };
          }

          // Find ClawdHub path
          const clawdhubPath = await findClawdHubPath();

          if (!clawdhubPath) {
            return {
              success: false,
              error: 'ClawdHub CLI not found. Make sure it is installed and in your PATH, or install it with: npm install -g clawdhub',
            };
          }

          // Use clawdhub to install the skill
          // Use sh -c to ensure $HOME expansion works
          let installCmd;
          if (clawdhubPath === 'clawdhub') {
            installCmd = Command.create('sh', ['-c', `clawdhub install "${skillName}" --workdir "$HOME/clawd"`]);
          } else {
            installCmd = Command.create('sh', ['-c', `${clawdhubPath} install "${skillName}" --workdir "$HOME/clawd"`]);
          }

          const result = await installCmd.execute();

          if (result.code === 0) {
            return {
              success: true,
              data: {
                message: `Skill "${skillName}" installed successfully from ClawdHub`,
                output: result.stdout,
              },
            };
          } else {
            return {
              success: false,
              error: `Failed to install skill: ${result.stderr || result.stdout || 'Unknown error'}`,
              data: {
                output: result.stdout,
                error: result.stderr,
              },
            };
          }
        } catch (error: any) {
          return {
            success: false,
            error: `Failed to install ClawdHub skill: ${error.message || 'Unknown error'}. Make sure clawdhub is installed and in your PATH.`,
          };
        }

      // New utility tools
      case 'search_files':
        return await executeSearchFiles(args, context);

      case 'list_directory_contents':
        return await executeListDirectoryContents(args, context);

      case 'get_file_info':
        return await executeGetFileInfo(args, context);

      case 'read_file_content':
        return await executeReadFileContent(args, context);

      case 'write_file_content':
        return await executeWriteFileContent(args, context);

      case 'delete_files':
        return await executeDeleteFiles(args, context);

      case 'calculate_directory_size':
        return await executeCalculateDirectorySize(args, context);

      case 'file_search_by_content':
        return await executeFileSearchByContent(args, context);

      case 'compare_directories':
        return await executeCompareDirectories(args, context);

      case 'batch_delete':
        return await executeBatchDelete(args, context);

      case 'create_directory':
        return await executeCreateDirectory(args, context);

      case 'move_file':
        return await executeMoveFile(args, context);

      case 'copy_file':
        return await executeCopyFile(args, context);

      case 'execute_terminal_command':
        try {
          const { Command } = await import('@tauri-apps/plugin-shell');
          const command = args.command as string;
          const cmdArgs = (args.args as string[]) || [];
          const cwd = args.cwd || context.currentDirectory || undefined;

          // Create the command
          // Note: Tauri's shell plugin requires commands to be configured in capabilities
          // For general usage, we might act as a wrapper around 'sh -c' if allowed,
          // or rely on specific binary allowlists.
          // Assuming 'sh' is allowed for flexibility as per previous patterns.
          let cmd;
          if (command === 'sh' || command === 'bash') {
            // For shell commands, we can prepend cd if cwd is specified
            if (cwd) {
              const shellCmd = cmdArgs.length > 0 ? cmdArgs.join(' ') : '';
              cmd = Command.create(command, ['-c', `cd "${cwd}" && ${shellCmd}`]);
            } else {
              cmd = Command.create(command, cmdArgs);
            }
          } else {
            // Wrap in sh -c for maximum compatibility if direct execution isn't whitelisted for every bin
            // But let's try direct first if it matches known patterns, otherwise fallback to sh
            // Actually, the most robust way for arbitrary CLI tools (like node, curl) in this context
            // is often to interpret the whole thing through sh
            let fullCmd = `${command} ${cmdArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`;
            if (cwd) {
              fullCmd = `cd "${cwd}" && ${fullCmd}`;
            }
            cmd = Command.create('sh', ['-c', fullCmd]);
          }
          // Note: For direct commands (not shell), cwd cannot be set in Tauri v2 Command API
          // The command will run in the current working directory

          const result = await cmd.execute();

          return {
            success: result.code === 0,
            data: {
              stdout: result.stdout,
              stderr: result.stderr,
              code: result.code,
            },
            error: result.code !== 0 ? `Command failed with code ${result.code}: ${result.stderr}` : undefined,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Failed to execute command: ${error.message}`
          };
        }

      // ========== NEW TOOL IMPLEMENTATIONS ==========

      case 'get_recent_files':
        return await executeGetRecentFiles(args, context);

      case 'get_large_files':
        return await executeGetLargeFiles(args, context);

      case 'get_empty_folders':
        return await executeGetEmptyFolders(args, context);

      case 'backup_file':
        return await executeBackupFile(args, context);

      case 'get_disk_usage':
        return await executeGetDiskUsage(args, context);

      case 'flatten_directory':
        return await executeFlattenDirectory(args, context);

      case 'get_file_types_summary':
        return await executeGetFileTypesSummary(args, context);

      case 'preview_operation':
        return await executePreviewOperation(args, context);

      case 'merge_text_files':
        return await executeMergeTextFiles(args, context);

      case 'sync_directories':
        return await executeSyncDirectories(args, context);

      case 'get_tool_help':
        return await executeGetToolHelp(args);

      // ========== WORKFLOW TOOLS ==========
      case 'list_workflows': {
        await workflowManager.initialize();
        let workflows = workflowManager.getAllWorkflows();
        
        // Apply filters
        if (args.category) {
          workflows = workflows.filter(w => w.category === args.category);
        }
        if (args.favoritesOnly) {
          workflows = workflows.filter(w => w.isFavorite);
        }
        
        return {
          success: true,
          data: {
            workflows: workflows.map(w => ({
              id: w.id,
              name: w.name,
              description: w.description,
              category: w.category,
              steps: w.steps.length,
              runCount: w.runCount,
              isFavorite: w.isFavorite,
              lastRunAt: w.lastRunAt,
              tags: w.tags,
            })),
            total: workflows.length,
          },
        };
      }

      case 'run_workflow': {
        await workflowManager.initialize();
        
        // Find workflow by ID or name
        let workflow;
        if (args.workflowId) {
          workflow = workflowManager.getWorkflow(args.workflowId);
        } else if (args.workflowName) {
          const allWorkflows = workflowManager.getAllWorkflows();
          workflow = allWorkflows.find(w => 
            w.name.toLowerCase() === args.workflowName.toLowerCase()
          );
        }
        
        if (!workflow) {
          return {
            success: false,
            error: `Workflow not found: ${args.workflowId || args.workflowName}`,
          };
        }
        
        // Create a tool executor function for the workflow
        const toolExecutor = async (toolName: string, toolArgs: Record<string, any>) => {
          const result = await executeTool(toolName, toolArgs, context);
          if (!result.success) {
            throw new Error(result.error || 'Tool execution failed');
          }
          return result;
        };
        
        try {
          const execution = await workflowManager.executeWorkflow(
            workflow.id,
            args.parameters || {},
            toolExecutor,
            { triggeredBy: 'api' }
          );
          
          return {
            success: execution.status === 'completed',
            data: {
              executionId: execution.id,
              workflowName: execution.workflowName,
              status: execution.status,
              stepsCompleted: execution.stepResults.filter(s => s.status === 'success').length,
              totalSteps: execution.totalSteps,
              filesAffected: execution.totalFilesAffected,
              duration: execution.duration,
              error: execution.error,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Workflow execution failed: ${error.message}`,
          };
        }
      }

      case 'create_workflow': {
        await workflowManager.initialize();
        
        let newWorkflow;
        
        if (args.templateId) {
          // Create from template
          newWorkflow = workflowManager.createFromTemplate(args.templateId, {
            name: args.name,
            description: args.description,
            category: args.category as WorkflowCategory,
          });
        } else {
          // Create from scratch
          newWorkflow = workflowManager.createWorkflow({
            name: args.name,
            description: args.description || '',
            category: (args.category as WorkflowCategory) || 'custom',
            steps: [],
            parameters: [],
          });
        }
        
        if (!newWorkflow) {
          return {
            success: false,
            error: 'Failed to create workflow. Template may not exist.',
          };
        }
        
        return {
          success: true,
          data: {
            id: newWorkflow.id,
            name: newWorkflow.name,
            description: newWorkflow.description,
            category: newWorkflow.category,
            steps: newWorkflow.steps.length,
            message: `Created workflow "${newWorkflow.name}"`,
          },
        };
      }

      case 'get_workflow_templates': {
        let templates = [...BUILTIN_TEMPLATES];
        
        if (args.category) {
          templates = templates.filter(t => t.category === args.category);
        }
        
        return {
          success: true,
          data: {
            templates: templates.map(t => ({
              id: t.id,
              name: t.name,
              description: t.description,
              category: t.category,
              icon: t.icon,
            })),
            total: templates.length,
          },
        };
      }

      // Handle Clawdhub skill tools (skill_*)
      default:
        // Check if this is a skill tool (starts with 'skill_')
        if (toolName.startsWith('skill_')) {
          try {
            // Check if ClawdBot is enabled
            if (!context.settings.clawdbotEnabled) {
              return {
                success: false,
                error: 'ClawdBot is not enabled. Please enable it in Settings → Clawdbot Integration to use skills.',
              };
            }

            // Extract skill name from tool name (skill_<name>)
            const skillName = toolName.replace('skill_', '');
            const skillArgs = (args.args as string[]) || [];
            const cwd = args.cwd || context.currentDirectory || undefined;

            // Get skill information
            const { discoverClawdhubSkills } = await import('./clawdhubToolDiscovery');
            const skills = await discoverClawdhubSkills();
            const skill = skills.find(s => s.name === skillName && s.isExecutable);

            if (!skill || !skill.executablePath || !skill.nodePath) {
              return {
                success: false,
                error: `Skill "${skillName}" not found or is not executable. Available skills: ${skills.filter(s => s.isExecutable).map(s => s.name).join(', ')}`,
              };
            }

            // Execute the skill using Node
            const { Command } = await import('@tauri-apps/plugin-shell');
            const cmdArgs = [skill.executablePath, ...skillArgs];
            
            // Use sh -c to execute with the node path
            let fullCmd = `${skill.nodePath} ${cmdArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`;
            if (cwd) {
              fullCmd = `cd "${cwd}" && ${fullCmd}`;
            }
            const cmd = Command.create('sh', ['-c', fullCmd]);

            const result = await cmd.execute();

            return {
              success: result.code === 0,
              data: {
                stdout: result.stdout,
                stderr: result.stderr,
                code: result.code,
                skill: skillName,
              },
              error: result.code !== 0 ? `Skill "${skillName}" failed with code ${result.code}: ${result.stderr || result.stdout}` : undefined,
            };
          } catch (error: any) {
            return {
              success: false,
              error: `Failed to execute skill tool: ${error.message}`,
            };
          }
        }

        // Unknown tool
        return {
          success: false,
          error: `Unknown tool: ${toolName}. Use list_available_tools to see all available tools.`,
        };
    }
  } catch (error: any) {
    // Re-throw to be caught by outer catch
    throw error;
  }
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`Error executing tool ${toolName} (took ${executionTime}ms):`, error);
    
    // Provide more helpful error messages
    let errorMessage = error.message || `Failed to execute ${toolName}`;
    
    // Check for common error patterns
    if (error.message?.includes('ENOENT')) {
      errorMessage = `File or directory not found. Please check the path and try again.`;
    } else if (error.message?.includes('EACCES') || error.message?.includes('permission')) {
      errorMessage = `Permission denied. You may not have access to this file or directory.`;
    } else if (error.message?.includes('ENOSPC')) {
      errorMessage = `No space left on device. Please free up some space and try again.`;
    }
    
    // Log tool execution failure to audit log
    auditLogger.logToolExecution(toolName, args, false, executionTime, {
      error: errorMessage,
    });
    
    return createErrorResult(errorMessage, undefined);
  }
}

/**
 * Helper function to match file patterns (supports * and ? wildcards)
 */
function matchPattern(filename: string, pattern: string, caseSensitive: boolean = false): boolean {
  const fn = caseSensitive ? filename : filename.toLowerCase();
  const pat = caseSensitive ? pattern : pattern.toLowerCase();

  // Convert wildcard pattern to regex
  const regexPattern = pat
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(fn);
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Execute search_files tool
 */
async function executeSearchFiles(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const searchPath = args.path || context.currentDirectory;
  if (!searchPath) {
    return { success: false, error: 'No directory path provided.' };
  }

  try {
    const pattern = args.pattern || '*';
    const includeSubdirs = args.includeSubdirectories !== false;
    const caseSensitive = args.caseSensitive === true;
    const maxResults = args.maxResults || 100;

    const results: any[] = [];

    async function searchDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await readDir(dirPath);

        for (const entry of entries) {
          if (results.length >= maxResults) break;

          const entryPath = await join(dirPath, entry.name);
          const matches = matchPattern(entry.name, pattern, caseSensitive);

          if (matches) {
            try {
              const metadata = await stat(entryPath);
              results.push({
                path: entryPath,
                name: entry.name,
                isDirectory: entry.isDirectory,
                size: metadata.size,
                modified: new Date(metadata.mtime || 0).toISOString(),
              });
            } catch (e) {
              // Skip files we can't stat
            }
          }

          if (includeSubdirs && entry.isDirectory) {
            await searchDirectory(entryPath);
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await searchDirectory(searchPath);

    return {
      success: true,
      data: {
        pattern,
        results,
        count: results.length,
        totalFound: results.length >= maxResults ? `at least ${maxResults}` : results.length,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to search files' };
  }
}

/**
 * Execute list_directory_contents tool
 */
async function executeListDirectoryContents(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const listPath = args.path || context.currentDirectory;
  if (!listPath) {
    return { success: false, error: 'No directory path provided.' };
  }

  try {
    const includeHidden = args.includeHidden === true;
    const sortBy = args.sortBy || 'name';
    const limit = args.limit || 1000;

    const entries = await readDir(listPath);
    const items: any[] = [];

    for (const entry of entries) {
      if (items.length >= limit) break;

      // Skip hidden files if not requested
      if (!includeHidden && entry.name.startsWith('.')) continue;

      const entryPath = await join(listPath, entry.name);
      try {
        const metadata = await stat(entryPath);
        items.push({
          path: entryPath,
          name: entry.name,
          isDirectory: entry.isDirectory,
          size: metadata.size,
          created: new Date(metadata.birthtime || 0).toISOString(),
          modified: new Date(metadata.mtime || 0).toISOString(),
          extension: entry.isDirectory ? null : (() => {
            const lastDot = entry.name.lastIndexOf('.');
            return lastDot !== -1 ? entry.name.substring(lastDot + 1) : null;
          })(),
        });
      } catch (e) {
        // Include entry even if we can't stat it
        items.push({
          path: entryPath,
          name: entry.name,
          isDirectory: entry.isDirectory,
        });
      }
    }

    // Sort items
    items.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return (b.size || 0) - (a.size || 0);
      if (sortBy === 'date') return new Date(b.modified || 0).getTime() - new Date(a.modified || 0).getTime();
      if (sortBy === 'type') {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      }
      return 0;
    });

    return {
      success: true,
      data: {
        path: listPath,
        items,
        count: items.length,
        totalSize: items.reduce((sum, item) => sum + (item.size || 0), 0),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to list directory contents' };
  }
}

/**
 * Execute get_file_info tool
 */
async function executeGetFileInfo(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const filePath = args.path;
  if (!filePath) {
    return { success: false, error: 'No file path provided.' };
  }

  try {
    const metadata = await stat(filePath);
    const fileName = await basename(filePath);
    const lastDot = fileName.lastIndexOf('.');
    const fileExt = lastDot !== -1 ? fileName.substring(lastDot + 1) : '';

    return {
      success: true,
      data: {
        path: filePath,
        name: fileName,
        isDirectory: metadata.isDirectory,
        size: metadata.size,
        created: new Date(metadata.birthtime || 0).toISOString(),
        modified: new Date(metadata.mtime || 0).toISOString(),
        accessed: new Date(metadata.atime || 0).toISOString(),
        extension: fileExt || null,
        sizeFormatted: formatBytes(metadata.size),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get file info' };
  }
}

/**
 * Execute read_file_content tool
 */
async function executeReadFileContent(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const filePath = args.path;
  if (!filePath) {
    return { success: false, error: 'No file path provided.' };
  }

  try {
    const maxLines = args.maxLines || 10000;
    // Note: Tauri v2 readTextFile always reads as UTF-8, encoding option not supported
    let content = await readTextFile(filePath);

    // Limit lines if specified
    if (maxLines > 0) {
      const lines = content.split('\n');
      if (lines.length > maxLines) {
        content = lines.slice(0, maxLines).join('\n') + `\n... (truncated, showing ${maxLines} of ${lines.length} lines)`;
      }
    }

    return {
      success: true,
      data: {
        path: filePath,
        content,
        length: content.length,
        lines: content.split('\n').length,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to read file content' };
  }
}

/**
 * Sanitize and resolve a file path, handling AI placeholder paths.
 * Handles cases where AI outputs literal placeholders like:
 * - [currentDirectory]/file.txt
 * - /path/to/folder/file.txt
 * - ${currentDir}/file.txt
 */
function sanitizePath(inputPath: string, currentDirectory: string | undefined): string {
  let cleanPath = inputPath.trim();
  
  // Remove common AI placeholder patterns
  const placeholderPatterns = [
    /^\[currentDirectory\]\/?/i,         // [currentDirectory]/
    /^\[current_directory\]\/?/i,        // [current_directory]/
    /^\[cwd\]\/?/i,                       // [cwd]/
    /^\$\{currentDir(ectory)?\}\/?/i,    // ${currentDir}/ or ${currentDirectory}/
    /^\/path\/to\/folder\/?/i,           // /path/to/folder/
    /^\/path\/to\/current\/directory\/?/i, // /path/to/current/directory/
    /^\.\/(?=\w)/,                        // ./ (but keep the rest)
  ];
  
  for (const pattern of placeholderPatterns) {
    if (pattern.test(cleanPath)) {
      cleanPath = cleanPath.replace(pattern, '');
      console.log(`[sanitizePath] Removed placeholder, path is now: "${cleanPath}"`);
      break;
    }
  }
  
  // Remove any leading slashes if we're going to join with currentDirectory
  // (but only if the path doesn't look like an absolute Unix path to a real location)
  if (!cleanPath.startsWith('/Users/') && !cleanPath.startsWith('/home/') && !cleanPath.startsWith('/var/')) {
    cleanPath = cleanPath.replace(/^\/+/, '');
  }
  
  return cleanPath;
}

/**
 * Execute write_file_content tool
 */
async function executeWriteFileContent(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const filePath = args.path;
  const content = args.content;

  if (!filePath) {
    return { success: false, error: 'File path is required.' };
  }

  // Content can be empty string, but must be defined
  const fileContent = content !== undefined ? (content || '') : '';

  try {
    // Sanitize and normalize the file path
    let normalizedPath = sanitizePath(filePath, context.currentDirectory);
    
    console.log(`[write_file_content] Original path: ${filePath}`);
    console.log(`[write_file_content] Sanitized path: ${normalizedPath}`);
    
    // If path doesn't start with /, assume it's relative to current directory
    if (!normalizedPath.startsWith('/') && context.currentDirectory) {
      normalizedPath = await join(context.currentDirectory, normalizedPath);
    }

    console.log(`[write_file_content] Final resolved path: ${normalizedPath}`);
    console.log(`[write_file_content] Content length: ${fileContent.length} characters`);
    console.log(`[write_file_content] Current directory: ${context.currentDirectory}`);

    // Check if file exists
    try {
      const fileExists = await exists(normalizedPath);
      if (fileExists && !args.overwrite) {
        return { success: false, error: `File already exists: ${normalizedPath}. Set overwrite=true to overwrite.` };
      }
    } catch (existsError: any) {
      // If exists check fails, continue anyway (might be a new file)
      console.warn(`[write_file_content] Could not check if file exists:`, existsError);
    }

    // Create parent directories if needed
    if (args.createDirectories !== false) {
      try {
        const parentDir = await dirname(normalizedPath);
        const parentExists = await exists(parentDir);
        if (!parentExists) {
          console.log(`[write_file_content] Creating parent directory: ${parentDir}`);
          await mkdir(parentDir, { recursive: true });
        }
      } catch (dirError: any) {
        console.warn(`[write_file_content] Could not create parent directory:`, dirError);
        // Continue anyway - might already exist or might fail later
      }
    }

    // Write the file
    console.log(`[write_file_content] Writing file content...`);
    try {
      await writeTextFile(normalizedPath, fileContent);
      console.log(`[write_file_content] Successfully created file: ${normalizedPath}`);
    } catch (writeError: any) {
      console.error(`[write_file_content] Write error:`, writeError);
      // Try to get more details about the error
      const errorDetails = writeError?.message || writeError?.toString() || 'Unknown write error';
      return { 
        success: false, 
        error: `Failed to write file: ${errorDetails}. Path: ${normalizedPath}` 
      };
    }

    // Invalidate cache for the parent directory
    const parentDir = await dirname(normalizedPath);
    directoryCache.invalidate(parentDir);
    console.log(`[write_file_content] Invalidated cache for: ${parentDir}`);

    // Record operation to history for undo support
    if (context.settings.operationHistory?.enabled !== false) {
      const fileName = await basename(normalizedPath);
      operationHistory.recordOperation({
        type: 'create_file',
        description: `Created file: ${fileName}`,
        toolName: 'write_file_content',
        toolArgs: args,
        changes: [
          createFileChange('create', normalizedPath, {
            newContent: fileContent,
            size: fileContent.length,
            isDirectory: false,
          }),
        ],
        status: 'completed',
        filesAffected: 1,
        canUndo: true,
        hasBackup: false,
      });
    }

    // Log file operation to audit log
    const executionTime = Date.now() - Date.now(); // Will be recalculated
    auditLogger.logFileOperation('write_file', [normalizedPath], true, {
      toolName: 'write_file_content',
    });

    return {
      success: true,
      data: {
        path: normalizedPath,
        written: true,
        size: fileContent.length,
        lines: fileContent.split('\n').length,
        fileName: await basename(normalizedPath),
      },
    };
  } catch (error: any) {
    console.error(`[write_file_content] Error creating file:`, error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorStack = error?.stack ? `\nStack: ${error.stack.substring(0, 200)}` : '';
    
    // Log file operation failure
    auditLogger.logFileOperation('write_file', [filePath], false, {
      error: errorMessage,
      toolName: 'write_file_content',
    });
    
    return { 
      success: false, 
      error: `Failed to write file content: ${errorMessage}${errorStack}. Path: ${filePath}` 
    };
  }
}

/**
 * Execute delete_files tool
 */
async function executeDeleteFiles(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const paths = args.paths;
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return { success: false, error: 'No file paths provided.' };
  }

  try {
    const recursive = args.recursive === true;
    const skipErrors = args.skipErrors === true;
    const deleted: string[] = [];
    const errors: string[] = [];

    for (const filePath of paths) {
      try {
        const fileExists = await exists(filePath);
        if (!fileExists) {
          if (!skipErrors) {
            return { success: false, error: `File not found: ${filePath}` };
          }
          errors.push(`Not found: ${filePath}`);
          continue;
        }

        const metadata = await stat(filePath);
        if (metadata.isDirectory && !recursive) {
          if (!skipErrors) {
            return { success: false, error: `Cannot delete directory without recursive=true: ${filePath}` };
          }
          errors.push(`Directory requires recursive=true: ${filePath}`);
          continue;
        }

        await remove(filePath, { recursive });
        deleted.push(filePath);
      } catch (error: any) {
        if (!skipErrors) {
          return { success: false, error: `Failed to delete ${filePath}: ${error.message}` };
        }
        errors.push(`${filePath}: ${error.message}`);
      }
    }

    // Invalidate cache for parent directories of deleted files
    if (deleted.length > 0) {
      const affectedDirs = new Set<string>();
      for (const deletedPath of deleted) {
        const parentDir = deletedPath.substring(0, deletedPath.lastIndexOf('/'));
        if (parentDir) affectedDirs.add(parentDir);
      }
      for (const dirPath of affectedDirs) {
        directoryCache.invalidate(dirPath);
      }
      console.log(`[delete_files] Invalidated ${affectedDirs.size} cached directories`);
    }

    // Record operation to history for undo support
    if (context.settings.operationHistory?.enabled !== false && deleted.length > 0) {
      // Create backup of deleted files for potential restore
      const backupPath = await operationHistory.createBackup(deleted);
      
      const changes: FileChange[] = deleted.map(filePath => 
        createFileChange('delete', filePath, {
          success: true,
          isDirectory: false, // Would need stat info for accuracy
        })
      );

      operationHistory.recordOperation({
        type: 'delete_file',
        description: `Deleted ${deleted.length} file(s)`,
        toolName: 'delete_files',
        toolArgs: args,
        changes,
        status: 'completed',
        filesAffected: deleted.length,
        canUndo: backupPath !== null,
        undoBlockedReason: backupPath ? undefined : 'No backup created',
        hasBackup: backupPath !== null,
        backupPath: backupPath || undefined,
      });
    }

    // Log file operation to audit log
    auditLogger.logFileOperation('delete_files', deleted, errors.length === 0 || deleted.length > 0, {
      toolName: 'delete_files',
      error: errors.length > 0 ? errors.join(', ') : undefined,
    });

    return {
      success: errors.length === 0 || deleted.length > 0,
      data: {
        deleted,
        errors: errors.length > 0 ? errors : undefined,
        count: deleted.length,
      },
    };
  } catch (error: any) {
    // Log delete failure
    auditLogger.logFileOperation('delete_files', paths, false, {
      error: error.message || 'Failed to delete files',
      toolName: 'delete_files',
    });
    return { success: false, error: error.message || 'Failed to delete files' };
  }
}

/**
 * Execute calculate_directory_size tool
 */
async function executeCalculateDirectorySize(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const dirPath = args.path || context.currentDirectory;
  if (!dirPath) {
    return { success: false, error: 'No directory path provided.' };
  }

  try {
    const includeHidden = args.includeHidden !== false;
    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;

    async function calculateSize(path: string): Promise<void> {
      try {
        const entries = await readDir(path);

        for (const entry of entries) {
          if (!includeHidden && entry.name.startsWith('.')) continue;

          const entryPath = await join(path, entry.name);
          try {
            const metadata = await stat(entryPath);

            if (metadata.isDirectory) {
              folderCount++;
              await calculateSize(entryPath);
            } else {
              fileCount++;
              totalSize += metadata.size;
            }
          } catch (e) {
            // Skip files we can't access
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await calculateSize(dirPath);

    return {
      success: true,
      data: {
        path: dirPath,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        fileCount,
        folderCount,
        totalItems: fileCount + folderCount,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to calculate directory size' };
  }
}

/**
 * Execute file_search_by_content tool
 */
async function executeFileSearchByContent(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const searchPath = args.path || context.currentDirectory;
  if (!searchPath) {
    return { success: false, error: 'No directory path provided.' };
  }

  try {
    const searchText = args.searchText;
    const filePattern = args.filePattern || '*';
    const useRegex = args.useRegex === true;
    const caseSensitive = args.caseSensitive === true;
    const includeSubdirs = args.includeSubdirectories !== false;
    const maxResults = args.maxResults || 50;

    const results: any[] = [];
    const textToSearch = caseSensitive ? searchText : searchText.toLowerCase();
    const regex = useRegex ? new RegExp(searchText, caseSensitive ? 'g' : 'gi') : null;

    async function searchDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await readDir(dirPath);

        for (const entry of entries) {
          if (results.length >= maxResults) break;

          if (entry.isDirectory && includeSubdirs) {
            const entryPath = await join(dirPath, entry.name);
            await searchDirectory(entryPath);
            continue;
          }

          if (!entry.isFile) continue;

          // Check file pattern
          if (!matchPattern(entry.name, filePattern, false)) continue;

          const entryPath = await join(dirPath, entry.name);

          try {
            const content = await readTextFile(entryPath);
            const searchContent = caseSensitive ? content : content.toLowerCase();

            let found = false;
            let matches: any[] = [];

            if (useRegex && regex) {
              const regexMatches = content.matchAll(regex);
              for (const match of regexMatches) {
                matches.push({
                  index: match.index,
                  match: match[0],
                });
                found = true;
                if (matches.length >= 10) break; // Limit matches per file
              }
            } else {
              const index = searchContent.indexOf(textToSearch);
              if (index !== -1) {
                found = true;
                matches.push({
                  index,
                  match: searchText,
                });
              }
            }

            if (found) {
              results.push({
                path: entryPath,
                name: entry.name,
                matches: matches.length,
                matchDetails: matches.slice(0, 5), // Limit details
              });
            }
          } catch (e) {
            // Skip files we can't read (binary, permissions, etc.)
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await searchDirectory(searchPath);

    return {
      success: true,
      data: {
        searchText,
        results,
        count: results.length,
        totalFound: results.length >= maxResults ? `at least ${maxResults}` : results.length,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to search file contents' };
  }
}

/**
 * Execute compare_directories tool
 */
async function executeCompareDirectories(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const path1 = args.path1;
  const path2 = args.path2;

  if (!path1 || !path2) {
    return { success: false, error: 'Both directory paths are required.' };
  }

  try {
    const compareContent = args.compareContent === true;
    const includeSubdirs = args.includeSubdirectories !== false;

    const files1 = new Map<string, any>();
    const files2 = new Map<string, any>();

    async function indexDirectory(path: string, map: Map<string, any>, basePath: string = ''): Promise<void> {
      try {
        const entries = await readDir(path);

        for (const entry of entries) {
          const entryPath = await join(path, entry.name);
          const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

          try {
            const metadata = await stat(entryPath);

            if (metadata.isDirectory && includeSubdirs) {
              await indexDirectory(entryPath, map, relativePath);
            } else if (!metadata.isDirectory) {
              const fileInfo: any = {
                path: entryPath,
                relativePath,
                size: metadata.size,
                modified: metadata.mtime,
              };

              if (compareContent) {
                try {
                  const content = await readTextFile(entryPath);
                  // Simple hash for comparison
                  fileInfo.contentHash = content.length.toString(); // Simplified
                } catch (e) {
                  // Skip binary files
                }
              }

              map.set(relativePath, fileInfo);
            }
          } catch (e) {
            // Skip inaccessible files
          }
        }
      } catch (e) {
        // Skip inaccessible directories
      }
    }

    await Promise.all([
      indexDirectory(path1, files1),
      indexDirectory(path2, files2),
    ]);

    const onlyIn1: string[] = [];
    const onlyIn2: string[] = [];
    const different: string[] = [];
    const same: string[] = [];

    // Compare files
    for (const [relPath, info1] of files1.entries()) {
      const info2 = files2.get(relPath);

      if (!info2) {
        onlyIn1.push(relPath);
      } else if (info1.size !== info2.size || (compareContent && info1.contentHash !== info2.contentHash)) {
        different.push(relPath);
      } else {
        same.push(relPath);
      }
    }

    for (const [relPath] of files2.entries()) {
      if (!files1.has(relPath)) {
        onlyIn2.push(relPath);
      }
    }

    return {
      success: true,
      data: {
        path1,
        path2,
        onlyInPath1: onlyIn1,
        onlyInPath2: onlyIn2,
        different,
        same,
        summary: {
          totalIn1: files1.size,
          totalIn2: files2.size,
          onlyIn1: onlyIn1.length,
          onlyIn2: onlyIn2.length,
          different: different.length,
          same: same.length,
        },
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to compare directories' };
  }
}

/**
 * Execute batch_delete tool
 */
async function executeBatchDelete(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const deletePath = args.path || context.currentDirectory;
  if (!deletePath) {
    return { success: false, error: 'No directory path provided.' };
  }

  try {
    const pattern = args.pattern;
    const includeSubdirs = args.includeSubdirectories === true;
    const olderThanDays = args.olderThanDays;
    const minSize = args.minSize;

    const filesToDelete: string[] = [];

    async function findFilesToDelete(dirPath: string): Promise<void> {
      try {
        const entries = await readDir(dirPath);

        for (const entry of entries) {
          const entryPath = await join(dirPath, entry.name);

          if (entry.isDirectory && includeSubdirs) {
            await findFilesToDelete(entryPath);
            continue;
          }

          if (!entry.isFile) continue;

          // Check pattern
          if (!matchPattern(entry.name, pattern, false)) continue;

          try {
            const metadata = await stat(entryPath);

            // Check age filter
            if (olderThanDays) {
              const mtime = metadata.mtime ? (typeof metadata.mtime === 'number' ? metadata.mtime : new Date(metadata.mtime).getTime()) : 0;
              const ageDays = (Date.now() - mtime) / (1000 * 60 * 60 * 24);
              if (ageDays < olderThanDays) continue;
            }

            // Check size filter
            if (minSize && metadata.size < minSize) continue;

            filesToDelete.push(entryPath);
          } catch (e) {
            // Skip files we can't stat
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await findFilesToDelete(deletePath);

    // Return preview - actual deletion should be confirmed
    return {
      success: true,
      data: {
        pattern,
        filesFound: filesToDelete,
        count: filesToDelete.length,
        preview: true,
        message: `Found ${filesToDelete.length} files matching pattern. Use delete_files tool with these paths to actually delete them.`,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to find files for batch delete' };
  }
}

/**
 * Execute create_directory tool
 */
async function executeCreateDirectory(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const dirPath = args.path;
  if (!dirPath) {
    return { success: false, error: 'No directory path provided.' };
  }

  try {
    const recursive = args.recursive !== false;

    // Sanitize and normalize the path - resolve placeholder paths and relative paths
    let normalizedPath = sanitizePath(dirPath, context.currentDirectory);
    
    console.log(`[create_directory] Original path: ${dirPath}`);
    console.log(`[create_directory] Sanitized path: ${normalizedPath}`);
    
    // If path doesn't start with /, assume it's relative to current directory
    if (!normalizedPath.startsWith('/') && context.currentDirectory) {
      normalizedPath = await join(context.currentDirectory, normalizedPath);
    }

    console.log(`[create_directory] Final resolved path: ${normalizedPath}`);
    console.log(`[create_directory] Current directory: ${context.currentDirectory}`);

    const dirExists = await exists(normalizedPath);
    if (dirExists) {
      return { 
        success: true, // Changed to success - directory already exists is not an error for our use case
        data: {
          path: normalizedPath,
          created: false,
          alreadyExists: true,
        },
      };
    }

    await mkdir(normalizedPath, { recursive });

    // Invalidate cache for the parent directory
    const parentDir = await dirname(normalizedPath);
    directoryCache.invalidate(parentDir);
    console.log(`[create_directory] Invalidated cache for: ${parentDir}`);

    // Record operation to history for undo support
    if (context.settings.operationHistory?.enabled !== false) {
      const folderName = await basename(normalizedPath);
      operationHistory.recordOperation({
        type: 'create_directory',
        description: `Created folder: ${folderName}`,
        toolName: 'create_directory',
        toolArgs: args,
        changes: [
          createFileChange('create', normalizedPath, {
            isDirectory: true,
          }),
        ],
        status: 'completed',
        filesAffected: 1,
        canUndo: true,
        hasBackup: false,
      });
    }

    return {
      success: true,
      data: {
        path: normalizedPath,
        created: true,
        folderName: await basename(normalizedPath),
      },
    };
  } catch (error: any) {
    console.error(`[create_directory] Error:`, error);
    return { success: false, error: error.message || 'Failed to create directory' };
  }
}

/**
 * Execute move_file tool
 */
async function executeMoveFile(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const sourcePath = args.sourcePath;
  const destPath = args.destinationPath;

  if (!sourcePath || !destPath) {
    return { success: false, error: 'Source and destination paths are required.' };
  }

  try {
    const overwrite = args.overwrite === true;

    const sourceExists = await exists(sourcePath);
    if (!sourceExists) {
      return { success: false, error: 'Source file does not exist.' };
    }

    const destExists = await exists(destPath);
    if (destExists && !overwrite) {
      return { success: false, error: 'Destination already exists. Set overwrite=true to overwrite.' };
    }

    // Create parent directory if needed
    const parentDir = await dirname(destPath);
    const parentExists = await exists(parentDir);
    if (!parentExists) {
      await mkdir(parentDir, { recursive: true });
    }

    const { rename } = await import('@tauri-apps/plugin-fs');
    await rename(sourcePath, destPath);

    // Invalidate cache for both source and destination parent directories
    const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    const destParent = await dirname(destPath);
    if (sourceParent) directoryCache.invalidate(sourceParent);
    if (destParent) directoryCache.invalidate(destParent);
    console.log(`[move_file] Invalidated cache for: ${sourceParent}, ${destParent}`);

    // Record operation to history for undo support
    if (context.settings.operationHistory?.enabled !== false) {
      const fileName = await basename(sourcePath);
      operationHistory.recordOperation({
        type: 'move_file',
        description: `Moved: ${fileName}`,
        toolName: 'move_file',
        toolArgs: args,
        changes: [
          createFileChange('move', sourcePath, {
            targetPath: destPath,
            isDirectory: false,
          }),
        ],
        status: 'completed',
        filesAffected: 1,
        canUndo: true,
        hasBackup: false,
      });
    }

    return {
      success: true,
      data: {
        sourcePath,
        destinationPath: destPath,
        moved: true,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to move file' };
  }
}

/**
 * Execute copy_file tool
 */
async function executeCopyFile(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const sourcePath = args.sourcePath;
  const destPath = args.destinationPath;

  if (!sourcePath || !destPath) {
    return { success: false, error: 'Source and destination paths are required.' };
  }

  try {
    const overwrite = args.overwrite === true;
    const recursive = args.recursive === true;

    const sourceExists = await exists(sourcePath);
    if (!sourceExists) {
      return { success: false, error: 'Source file does not exist.' };
    }

    const sourceMetadata = await stat(sourcePath);

    // For directories, we need recursive copy
    if (sourceMetadata.isDirectory && !recursive) {
      return { success: false, error: 'Cannot copy directory without recursive=true.' };
    }

    const destExists = await exists(destPath);
    if (destExists && !overwrite) {
      return { success: false, error: 'Destination already exists. Set overwrite=true to overwrite.' };
    }

    // Create parent directory if needed
    const parentDir = await dirname(destPath);
    const parentExists = await exists(parentDir);
    if (!parentExists) {
      await mkdir(parentDir, { recursive: true });
    }

    const { copyFile } = await import('@tauri-apps/plugin-fs');

    if (sourceMetadata.isDirectory) {
      // For directories, we need to copy recursively
      // This is a simplified version - full recursive copy would need more logic
      return { success: false, error: 'Directory copying requires more complex logic. Use file_copy_tab for directories.' };
    } else {
      await copyFile(sourcePath, destPath);
    }

    // Invalidate cache for destination parent directory (source unchanged)
    const destParent = await dirname(destPath);
    if (destParent) directoryCache.invalidate(destParent);
    console.log(`[copy_file] Invalidated cache for: ${destParent}`);

    // Record operation to history for undo support
    if (context.settings.operationHistory?.enabled !== false) {
      const fileName = await basename(sourcePath);
      operationHistory.recordOperation({
        type: 'copy_file',
        description: `Copied: ${fileName}`,
        toolName: 'copy_file',
        toolArgs: args,
        changes: [
          createFileChange('copy', sourcePath, {
            targetPath: destPath,
            isDirectory: false,
          }),
        ],
        status: 'completed',
        filesAffected: 1,
        canUndo: true,
        hasBackup: false,
      });
    }

    return {
      success: true,
      data: {
        sourcePath,
        destinationPath: destPath,
        copied: true,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to copy file' };
  }
}

// ========== NEW TOOL IMPLEMENTATIONS ==========

/**
 * Execute get_recent_files tool - Find recently modified files
 */
async function executeGetRecentFiles(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const searchPath = args.path || context.currentDirectory;
  if (!searchPath) {
    return createErrorResult('No directory path provided.');
  }

  try {
    const withinDays = args.withinDays || 7;
    const withinHours = args.withinHours;
    const filePattern = args.filePattern || '*';
    const includeSubdirs = args.includeSubdirectories !== false;
    const maxResults = args.maxResults || 50;
    const sortBy = args.sortBy || 'modified';

    // Calculate cutoff time
    const now = Date.now();
    const cutoffTime = withinHours 
      ? now - (withinHours * 60 * 60 * 1000)
      : now - (withinDays * 24 * 60 * 60 * 1000);

    const results: any[] = [];

    async function searchDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await readDir(dirPath);
        for (const entry of entries) {
          if (results.length >= maxResults * 2) break; // Get extra for sorting

          const entryPath = await join(dirPath, entry.name);

          if (entry.isDirectory && includeSubdirs) {
            await searchDirectory(entryPath);
            continue;
          }

          if (!entry.isFile) continue;
          if (!matchPattern(entry.name, filePattern, false)) continue;

          try {
            const metadata = await stat(entryPath);
            const modifiedTime = metadata.mtime 
              ? (typeof metadata.mtime === 'number' ? metadata.mtime : new Date(metadata.mtime).getTime())
              : 0;

            if (modifiedTime >= cutoffTime) {
              results.push({
                path: entryPath,
                name: entry.name,
                size: metadata.size,
                sizeFormatted: formatBytes(metadata.size),
                modified: new Date(modifiedTime).toISOString(),
                modifiedTimestamp: modifiedTime,
              });
            }
          } catch (e) {
            // Skip files we can't stat
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await searchDirectory(searchPath);

    // Sort results
    results.sort((a, b) => {
      switch (sortBy) {
        case 'modified': return b.modifiedTimestamp - a.modifiedTimestamp;
        case 'size': return b.size - a.size;
        case 'name': return a.name.localeCompare(b.name);
        default: return b.modifiedTimestamp - a.modifiedTimestamp;
      }
    });

    const finalResults = results.slice(0, maxResults);

    return createSuccessResult({
      files: finalResults,
      count: finalResults.length,
      searchPath,
      criteria: withinHours ? `within ${withinHours} hours` : `within ${withinDays} days`,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to find recent files');
  }
}

/**
 * Execute get_large_files tool - Find large files
 */
async function executeGetLargeFiles(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const searchPath = args.path || context.currentDirectory;
  if (!searchPath) {
    return createErrorResult('No directory path provided.');
  }

  try {
    const minSizeKB = args.minSizeKB;
    const minSizeMB = args.minSizeMB || 100;
    const minBytes = minSizeKB ? minSizeKB * 1024 : minSizeMB * 1024 * 1024;
    const includeSubdirs = args.includeSubdirectories !== false;
    const maxResults = args.maxResults || 50;
    const excludePatterns = args.excludePatterns || [];

    const results: any[] = [];

    async function searchDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await readDir(dirPath);
        for (const entry of entries) {
          const entryPath = await join(dirPath, entry.name);

          // Check exclude patterns
          const shouldExclude = excludePatterns.some((pattern: string) => 
            matchPattern(entry.name, pattern, false)
          );
          if (shouldExclude) continue;

          if (entry.isDirectory && includeSubdirs) {
            await searchDirectory(entryPath);
            continue;
          }

          if (!entry.isFile) continue;

          try {
            const metadata = await stat(entryPath);
            if (metadata.size >= minBytes) {
              results.push({
                path: entryPath,
                name: entry.name,
                size: metadata.size,
                sizeFormatted: formatBytes(metadata.size),
                modified: new Date(metadata.mtime || 0).toISOString(),
              });
            }
          } catch (e) {
            // Skip files we can't stat
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await searchDirectory(searchPath);

    // Sort by size (largest first)
    results.sort((a, b) => b.size - a.size);
    const finalResults = results.slice(0, maxResults);

    const totalSize = finalResults.reduce((sum, f) => sum + f.size, 0);

    return createSuccessResult({
      files: finalResults,
      count: finalResults.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      threshold: formatBytes(minBytes),
      searchPath,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to find large files');
  }
}

/**
 * Execute get_empty_folders tool - Find empty folders
 */
async function executeGetEmptyFolders(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const searchPath = args.path || context.currentDirectory;
  if (!searchPath) {
    return createErrorResult('No directory path provided.');
  }

  try {
    const includeSubdirs = args.includeSubdirectories !== false;
    const deleteEmpty = args.deleteEmpty === true;

    const emptyFolders: string[] = [];
    const deletedFolders: string[] = [];
    const failedDeletes: string[] = [];

    async function checkDirectory(dirPath: string): Promise<boolean> {
      try {
        const entries = await readDir(dirPath);
        
        if (entries.length === 0) {
          emptyFolders.push(dirPath);
          
          if (deleteEmpty) {
            try {
              await remove(dirPath);
              deletedFolders.push(dirPath);
            } catch (e) {
              failedDeletes.push(dirPath);
            }
          }
          return true;
        }

        // Check subdirectories
        if (includeSubdirs) {
          for (const entry of entries) {
            if (entry.isDirectory) {
              const subPath = await join(dirPath, entry.name);
              await checkDirectory(subPath);
            }
          }
        }
        
        return false;
      } catch (e) {
        return false;
      }
    }

    await checkDirectory(searchPath);

    return createSuccessResult({
      emptyFolders,
      count: emptyFolders.length,
      deletedFolders: deleteEmpty ? deletedFolders : undefined,
      deletedCount: deleteEmpty ? deletedFolders.length : undefined,
      failedDeletes: failedDeletes.length > 0 ? failedDeletes : undefined,
      searchPath,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to find empty folders');
  }
}

/**
 * Execute backup_file tool - Create timestamped backup
 */
async function executeBackupFile(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const sourcePath = args.sourcePath;
  if (!sourcePath) {
    return createErrorResult('Source path is required.');
  }

  try {
    // Check if source exists
    const sourceExists = await exists(sourcePath);
    if (!sourceExists) {
      return createErrorResult(`Source not found: ${sourcePath}`);
    }

    const sourceBasename = await basename(sourcePath);
    const sourceDir = await dirname(sourcePath);
    const sourceExt = await extname(sourcePath);
    const nameWithoutExt = sourceBasename.replace(sourceExt, '');

    // Generate timestamp suffix
    const now = new Date();
    const timestamp = args.suffix || now.toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .replace('T', '_')
      .substring(0, 19);

    const backupDir = args.backupDirectory || sourceDir;
    const backupName = `${nameWithoutExt}_backup_${timestamp}${sourceExt}`;
    const backupPath = await join(backupDir, backupName);

    // Ensure backup directory exists
    const backupDirExists = await exists(backupDir);
    if (!backupDirExists) {
      await mkdir(backupDir, { recursive: true });
    }

    // Copy file to backup location
    const content = await readTextFile(sourcePath);
    await writeTextFile(backupPath, content);

    return createSuccessResult({
      originalPath: sourcePath,
      backupPath,
      backupName,
      timestamp,
      message: `Backup created: ${backupName}`,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to create backup');
  }
}

/**
 * Execute get_disk_usage tool - Get disk space information
 */
async function executeGetDiskUsage(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const targetPath = args.path || context.currentDirectory;
  if (!targetPath) {
    return createErrorResult('No path provided.');
  }

  try {
    // Use df command to get disk usage
    const cmd = Command.create('sh', ['-c', `df -k "${targetPath}" | tail -1`]);
    const result = await cmd.execute();

    if (result.code !== 0) {
      return createErrorResult('Failed to get disk usage');
    }

    // Parse df output: Filesystem 1K-blocks Used Available Use% Mounted
    const parts = result.stdout.trim().split(/\s+/);
    if (parts.length >= 6) {
      const totalKB = parseInt(parts[1], 10);
      const usedKB = parseInt(parts[2], 10);
      const availableKB = parseInt(parts[3], 10);
      const usePercent = parts[4];

      return createSuccessResult({
        path: targetPath,
        filesystem: parts[0],
        mountPoint: parts[5],
        total: totalKB * 1024,
        totalFormatted: formatBytes(totalKB * 1024),
        used: usedKB * 1024,
        usedFormatted: formatBytes(usedKB * 1024),
        available: availableKB * 1024,
        availableFormatted: formatBytes(availableKB * 1024),
        usePercent,
      });
    }

    return createErrorResult('Unable to parse disk usage information');
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to get disk usage');
  }
}

/**
 * Execute flatten_directory tool - Move all files from subdirs to one directory
 */
async function executeFlattenDirectory(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const sourcePath = args.sourcePath;
  if (!sourcePath) {
    return createErrorResult('Source path is required.');
  }

  try {
    const destinationPath = args.destinationPath || sourcePath;
    const handleDuplicates = args.handleDuplicates || 'rename';
    const deleteEmptyFolders = args.deleteEmptyFolders !== false;
    const filePattern = args.filePattern || '*';
    const preview = args.preview === true;

    const filesToMove: Array<{ from: string; to: string; name: string }> = [];
    const nameCount: Record<string, number> = {};

    async function collectFiles(dirPath: string): Promise<void> {
      try {
        const entries = await readDir(dirPath);
        for (const entry of entries) {
          const entryPath = await join(dirPath, entry.name);

          if (entry.isDirectory) {
            await collectFiles(entryPath);
            continue;
          }

          if (!entry.isFile) continue;
          if (!matchPattern(entry.name, filePattern, false)) continue;

          let targetName = entry.name;
          
          // Handle duplicate names
          if (handleDuplicates === 'rename') {
            nameCount[entry.name] = (nameCount[entry.name] || 0) + 1;
            if (nameCount[entry.name] > 1) {
              const ext = await extname(entry.name);
              const base = entry.name.replace(ext, '');
              targetName = `${base}_${nameCount[entry.name]}${ext}`;
            }
          }

          const targetPath = await join(destinationPath, targetName);
          filesToMove.push({ from: entryPath, to: targetPath, name: targetName });
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await collectFiles(sourcePath);

    if (preview) {
      return createSuccessResult({
        preview: true,
        filesToMove: filesToMove.map(f => ({ from: f.from, to: f.to })),
        count: filesToMove.length,
        message: `Would move ${filesToMove.length} file(s) to ${destinationPath}`,
      });
    }

    // Actually move files
    let moved = 0;
    let errors: string[] = [];

    for (const file of filesToMove) {
      try {
        const content = await readTextFile(file.from);
        await writeTextFile(file.to, content);
        await remove(file.from);
        moved++;
      } catch (e: any) {
        errors.push(`${file.name}: ${e.message}`);
      }
    }

    return createSuccessResult({
      moved,
      errors: errors.length > 0 ? errors : undefined,
      destinationPath,
      message: `Moved ${moved} file(s) to ${destinationPath}`,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to flatten directory');
  }
}

/**
 * Execute get_file_types_summary tool - Summarize file types in directory
 */
async function executeGetFileTypesSummary(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const searchPath = args.path || context.currentDirectory;
  if (!searchPath) {
    return createErrorResult('No directory path provided.');
  }

  try {
    const includeSubdirs = args.includeSubdirectories !== false;
    const groupBy = args.groupBy || 'extension';

    const typeStats: Record<string, { count: number; totalSize: number; files: string[] }> = {};

    // Category mappings for groupBy: 'category'
    const categoryMap: Record<string, string> = {
      '.jpg': 'Images', '.jpeg': 'Images', '.png': 'Images', '.gif': 'Images', 
      '.bmp': 'Images', '.webp': 'Images', '.svg': 'Images', '.ico': 'Images',
      '.mp4': 'Videos', '.avi': 'Videos', '.mov': 'Videos', '.mkv': 'Videos', 
      '.wmv': 'Videos', '.webm': 'Videos',
      '.mp3': 'Audio', '.wav': 'Audio', '.flac': 'Audio', '.aac': 'Audio', 
      '.ogg': 'Audio', '.m4a': 'Audio',
      '.pdf': 'Documents', '.doc': 'Documents', '.docx': 'Documents', 
      '.xls': 'Documents', '.xlsx': 'Documents', '.ppt': 'Documents', 
      '.pptx': 'Documents', '.txt': 'Documents', '.rtf': 'Documents',
      '.zip': 'Archives', '.rar': 'Archives', '.7z': 'Archives', 
      '.tar': 'Archives', '.gz': 'Archives',
      '.js': 'Code', '.ts': 'Code', '.py': 'Code', '.java': 'Code', 
      '.cpp': 'Code', '.c': 'Code', '.h': 'Code', '.css': 'Code', 
      '.html': 'Code', '.jsx': 'Code', '.tsx': 'Code', '.rs': 'Code',
    };

    async function scanDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await readDir(dirPath);
        for (const entry of entries) {
          const entryPath = await join(dirPath, entry.name);

          if (entry.isDirectory && includeSubdirs) {
            await scanDirectory(entryPath);
            continue;
          }

          if (!entry.isFile) continue;

          try {
            const metadata = await stat(entryPath);
            const ext = (await extname(entry.name)).toLowerCase() || 'no extension';
            
            let key: string;
            if (groupBy === 'category') {
              key = categoryMap[ext] || 'Other';
            } else {
              key = ext;
            }

            if (!typeStats[key]) {
              typeStats[key] = { count: 0, totalSize: 0, files: [] };
            }
            typeStats[key].count++;
            typeStats[key].totalSize += metadata.size;
            if (typeStats[key].files.length < 5) {
              typeStats[key].files.push(entry.name);
            }
          } catch (e) {
            // Skip files we can't stat
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await scanDirectory(searchPath);

    // Convert to array and sort by count
    const summary = Object.entries(typeStats)
      .map(([type, stats]) => ({
        type,
        count: stats.count,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatBytes(stats.totalSize),
        sampleFiles: stats.files,
      }))
      .sort((a, b) => b.count - a.count);

    const totalFiles = summary.reduce((sum, s) => sum + s.count, 0);
    const totalSize = summary.reduce((sum, s) => sum + s.totalSize, 0);

    return createSuccessResult({
      summary,
      totalTypes: summary.length,
      totalFiles,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      groupedBy: groupBy,
      searchPath,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to get file types summary');
  }
}

/**
 * Execute preview_operation tool - Preview without executing
 */
async function executePreviewOperation(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const operation = args.operation;
  const params = args.params || {};

  if (!operation) {
    return createErrorResult('Operation type is required.');
  }

  try {
    // For now, return a simplified preview
    // In a full implementation, this would simulate each operation
    const preview: any = {
      operation,
      params,
      wouldAffect: [],
      warnings: [],
    };

    switch (operation) {
      case 'delete':
        preview.wouldAffect = params.paths || [];
        preview.warnings.push('This operation cannot be undone.');
        break;
      case 'organize':
        preview.description = `Would organize files using "${params.strategy || 'by-type'}" strategy`;
        break;
      case 'move':
        preview.wouldAffect = [params.sourcePath];
        preview.destination = params.destinationPath;
        break;
      case 'flatten':
        preview.description = `Would move all files from subdirectories to ${params.destinationPath || params.sourcePath}`;
        break;
      default:
        preview.description = `Preview not available for operation: ${operation}`;
    }

    return createSuccessResult({
      preview: true,
      ...preview,
      message: 'This is a preview. No changes have been made.',
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to preview operation');
  }
}

/**
 * Execute merge_text_files tool - Combine multiple text files
 */
async function executeMergeTextFiles(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const sourcePaths = args.sourcePaths;
  const destinationPath = args.destinationPath;

  if (!sourcePaths || sourcePaths.length === 0) {
    return createErrorResult('Source paths are required.');
  }
  if (!destinationPath) {
    return createErrorResult('Destination path is required.');
  }

  try {
    const separator = args.separator || '\n';
    const includeFilenames = args.includeFilenames !== false;

    const parts: string[] = [];
    const errors: string[] = [];

    for (const sourcePath of sourcePaths) {
      try {
        const content = await readTextFile(sourcePath);
        const filename = await basename(sourcePath);

        if (includeFilenames) {
          parts.push(`\n// ========== ${filename} ==========\n`);
        }
        parts.push(content);
      } catch (e: any) {
        errors.push(`${sourcePath}: ${e.message}`);
      }
    }

    if (parts.length === 0) {
      return createErrorResult('No files could be read.');
    }

    const mergedContent = parts.join(separator);
    await writeTextFile(destinationPath, mergedContent);

    return createSuccessResult({
      destinationPath,
      mergedFiles: sourcePaths.length - errors.length,
      totalFiles: sourcePaths.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Merged ${sourcePaths.length - errors.length} file(s) into ${destinationPath}`,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to merge files');
  }
}

/**
 * Execute sync_directories tool - Synchronize two directories
 */
async function executeSyncDirectories(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const sourcePath = args.sourcePath;
  const destinationPath = args.destinationPath;

  if (!sourcePath || !destinationPath) {
    return createErrorResult('Source and destination paths are required.');
  }

  try {
    const mode = args.mode || 'update';
    const deleteExtra = args.deleteExtra === true && mode === 'mirror';
    const preview = args.preview === true;

    const toCopy: Array<{ source: string; dest: string; reason: string }> = [];
    const toDelete: string[] = [];

    // Scan source directory
    async function scanSource(srcDir: string, destDir: string): Promise<void> {
      try {
        const entries = await readDir(srcDir);
        
        for (const entry of entries) {
          const srcPath = await join(srcDir, entry.name);
          const dstPath = await join(destDir, entry.name);

          if (entry.isDirectory) {
            await scanSource(srcPath, dstPath);
            continue;
          }

          const destExists = await exists(dstPath);
          
          if (!destExists) {
            toCopy.push({ source: srcPath, dest: dstPath, reason: 'new' });
          } else {
            // Check if modified
            try {
              const srcStat = await stat(srcPath);
              const dstStat = await stat(dstPath);
              
              const srcMtime = srcStat.mtime ? new Date(srcStat.mtime).getTime() : 0;
              const dstMtime = dstStat.mtime ? new Date(dstStat.mtime).getTime() : 0;
              if (srcMtime > dstMtime || srcStat.size !== dstStat.size) {
                toCopy.push({ source: srcPath, dest: dstPath, reason: 'modified' });
              }
            } catch (e) {
              // Skip comparison errors
            }
          }
        }
      } catch (e) {
        // Skip directories we can't read
      }
    }

    await scanSource(sourcePath, destinationPath);

    if (preview) {
      return createSuccessResult({
        preview: true,
        toCopy: toCopy.length,
        toDelete: toDelete.length,
        files: toCopy.slice(0, 20), // Show first 20
        mode,
        message: `Would sync ${toCopy.length} file(s) from ${sourcePath} to ${destinationPath}`,
      });
    }

    // Actually sync
    let copied = 0;
    let errors: string[] = [];

    for (const item of toCopy) {
      try {
        // Ensure destination directory exists
        const destDir = await dirname(item.dest);
        const destDirExists = await exists(destDir);
        if (!destDirExists) {
          await mkdir(destDir, { recursive: true });
        }

        const content = await readTextFile(item.source);
        await writeTextFile(item.dest, content);
        copied++;
      } catch (e: any) {
        errors.push(`${item.source}: ${e.message}`);
      }
    }

    return createSuccessResult({
      copied,
      errors: errors.length > 0 ? errors : undefined,
      mode,
      sourcePath,
      destinationPath,
      message: `Synced ${copied} file(s) to ${destinationPath}`,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to sync directories');
  }
}

/**
 * Execute get_tool_help tool - Get help for tools
 */
async function executeGetToolHelp(args: Record<string, any>): Promise<ToolResult> {
  const toolName = args.toolName;
  const category = args.category;

  try {
    if (toolName) {
      // Get help for specific tool
      const tool = TOOLS.find(t => t.name === toolName);
      if (!tool) {
        return createErrorResult(`Tool "${toolName}" not found. Use get_tool_help() to see all available tools.`);
      }

      return createSuccessResult({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.input_schema.properties,
        required: tool.input_schema.required || [],
        examples: tool.examples || [],
      });
    }

    // List all tools, optionally filtered by category
    let tools = TOOLS;
    if (category) {
      tools = tools.filter(t => t.category === category);
    }

    const toolList = tools.map(t => ({
      name: t.name,
      description: t.description.substring(0, 100) + (t.description.length > 100 ? '...' : ''),
      category: t.category,
    }));

    // Group by category
    const byCategory: Record<string, string[]> = {};
    tools.forEach(t => {
      const cat = t.category || 'uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t.name);
    });

    return createSuccessResult({
      tools: toolList,
      total: toolList.length,
      byCategory,
      availableCategories: Object.keys(ToolCategory),
      message: toolName ? undefined : `Found ${toolList.length} tool(s)${category ? ` in category "${category}"` : ''}`,
    });
  } catch (error: any) {
    return createErrorResult(error.message || 'Failed to get tool help');
  }
}

/**
 * Gets available MCP tools and converts them to Anthropic tool format.
 */
export async function getMCPTools(): Promise<ToolDefinition[]> {
  try {
    const { getMCPTools: getMCPToolsFromIntegration } = await import('./mcpIntegration');
    return await getMCPToolsFromIntegration();
  } catch (error) {
    console.warn('Failed to get MCP tools:', error);
    return [];
  }
}

/**
 * Gets all available tools (custom + MCP + Skills).
 * Optionally filters tools based on settings (e.g., ClawdBot tools).
 */
export async function getAllTools(settings?: AISettings): Promise<ToolDefinition[]> {
  let customTools = TOOLS;

  // Filter ClawdBot tools if not enabled
  if (settings && !settings.clawdbotEnabled) {
    customTools = customTools.filter(tool =>
      !tool.name.startsWith('clawdbot_') && !tool.name.startsWith('clawdhub_')
    );
  }

  // Filter out disabled tools based on permissions
  if (settings?.toolPermissions) {
    toolPermissionManager.updateSettings(settings.toolPermissions);
    const allowedToolNames = toolPermissionManager.filterAllowedTools(
      customTools.map(t => t.name)
    );
    customTools = customTools.filter(tool => allowedToolNames.includes(tool.name));
    console.log(`[getAllTools] Filtered to ${customTools.length} allowed tools`);
  }

  const mcpTools = await getMCPTools();
  
  // Get skill tools if ClawdBot is enabled
  let skillTools: ToolDefinition[] = [];
  if (settings?.clawdbotEnabled) {
    try {
      const { getClawdhubSkillTools } = await import('./clawdhubToolDiscovery');
      skillTools = await getClawdhubSkillTools();
    } catch (error) {
      console.warn('Failed to get Clawdhub skill tools:', error);
    }
  }
  
  return [...customTools, ...mcpTools, ...skillTools];
}

/**
 * Gets a tool definition by name.
 */
export function getToolDefinition(toolName: string): ToolDefinition | undefined {
  return TOOLS.find(tool => tool.name === toolName);
}

/**
 * Lists all available tools with their categories and descriptions.
 * Useful for AI to understand what tools are available.
 */
export async function listAvailableTools(settings?: { clawdbotEnabled?: boolean }): Promise<{
  tools: Array<{
    name: string;
    description: string;
    category?: string;
    examples?: string[];
  }>;
  total: number;
  byCategory: Record<string, number>;
}> {
  const allTools = await getAllTools(settings);
  
  const tools = allTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    category: tool.category,
    examples: tool.examples,
  }));
  
  const byCategory: Record<string, number> = {};
  tools.forEach(tool => {
    const category = tool.category || 'uncategorized';
    byCategory[category] = (byCategory[category] || 0) + 1;
  });
  
  return {
    tools,
    total: tools.length,
    byCategory,
  };
}
