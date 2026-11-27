/**
 * File: src/features/ai-assistant/utils/toolDefinitions.ts
 * 
 * Tool definitions and type interfaces for the AI assistant tool system.
 * Extracted from toolsRegistry.ts for modularity.
 */

import type { AISettings, DirectoryAnalysis, FileOperation } from '../types';

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
export interface ValidationResult {
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
    description: 'Configures an agent with specific parameters. Use this to set up agents for specific directories or customize their behavior. Agents never change files directly: they draft changes into the Approval Inbox, where the user approves them.',
    input_schema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent to configure.',
        },
        params: {
          type: 'object',
          description: 'Agent-specific parameters. For file-organizer: {targetDirectory, strategy, includeSubdirectories}. For duplicate-finder: {targetDirectory, minFileSize, proposeRemoval (default true; drafts duplicates for the trash, user approves)}. For cleanup-agent: {targetDirectories, removeEmptyFolders, removeTempFiles, olderThanDays}.',
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
      required: ['path'],
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

