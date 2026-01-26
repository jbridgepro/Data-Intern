/**
 * File: src/features/ai-assistant/utils/toolsRegistry.ts
 * 
 * Registry of available tools for the AI to use.
 * Includes custom file operations and MCP tools.
 */

import type { AISettings, DirectoryAnalysis, FileOperation, OrganizationConfig } from '../types';
import { analyzeDirectoryFiles } from './fileAnalysis';
import { organizeFilesByStrategy } from './organizationStrategies';
import { findDuplicateFiles } from './duplicateDetection';
import { generateRenameOperation } from './renameIntelligence';
import { executeFileOperation } from './fileOperations';
import { toolOrchestrator } from './toolOrchestrator';
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
 * Tool execution result.
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  operation?: FileOperation;
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
    description: 'Write or create a text file with specified content. Can create new files or overwrite existing ones. Use this to create configuration files, notes, or any text-based files.',
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
  
  // Set working directory if provided
  if (workDir) {
    cmd.cwd = workDir;
  }
  
  return { cmd, path: clawdbotPath };
}

export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  const path = args.path || context.currentDirectory;

  try {
    switch (toolName) {
      case 'analyze_directory':
        if (!path) {
          return {
            success: false,
            error: 'No directory path provided. Please select a directory first.',
          };
        }
        const analysis = await analyzeDirectoryFiles(path);
        return {
          success: true,
          data: {
            totalFiles: analysis.totalFiles,
            totalSize: analysis.totalSize,
            organizationScore: analysis.organizationScore,
            fileTypes: analysis.fileTypes.slice(0, 10),
            summary: analysis.summary,
          },
        };

      case 'organize_files':
        if (!path) {
          return {
            success: false,
            error: 'No directory path provided. Please select a directory first.',
          };
        }
        const config: OrganizationConfig = {
          strategy: args.strategy || 'by-type',
          options: {
            dateFormat: args.dateFormat || 'year-month',
          },
        };
        const operation = await organizeFilesByStrategy(path, config);
        return {
          success: true,
          data: {
            description: operation.description,
            fileCount: operation.files.length,
            confidence: operation.confidence,
            requiresConfirmation: operation.requiresConfirmation,
          },
          operation,
        };

      case 'find_duplicates':
        if (!path) {
          return {
            success: false,
            error: 'No directory path provided. Please select a directory first.',
          };
        }
        const duplicates = await findDuplicateFiles(path);
        return {
          success: true,
          data: {
            totalDuplicates: duplicates.totalDuplicates,
            duplicateGroups: duplicates.duplicateGroups.slice(0, 10),
            totalWastedSpace: duplicates.totalWastedSpace,
            summary: duplicates.summary,
          },
        };

      case 'rename_files':
        if (!path) {
          return {
            success: false,
            error: 'No directory path provided. Please select a directory first.',
          };
        }
        const patternMap: Record<string, string> = {
          'date-prefix': 'Rename these files to include their creation date in YYYY-MM-DD format',
          'snake-case': 'Rename these files to snake_case format',
          'standardize': 'Standardize the naming of these files',
          'clean': 'Clean up the filenames by removing special characters',
        };
        const renameCommand = patternMap[args.pattern] || patternMap['clean'];
        const renameOperation = await generateRenameOperation(path, renameCommand);
        return {
          success: true,
          data: {
            description: renameOperation.description,
            fileCount: renameOperation.files.length,
            confidence: renameOperation.confidence,
          },
          operation: renameOperation,
        };

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
        return {
          success: true,
          data: {
            message: 'Operation executed successfully',
          },
        };

      // Tab-based tools
      case 'file_copy_tab':
        return await toolOrchestrator.executeTool(
          'file_copy',
          args as FileCopyToolParams,
          'File Copy operation'
        );

      case 'folder_creation_tab':
        return await toolOrchestrator.executeTool(
          'folder_creation',
          args as FolderCreationToolParams,
          'Folder Creation operation'
        );

      case 'file_creation_tab':
        return await toolOrchestrator.executeTool(
          'file_creation',
          args as FileCreationToolParams,
          'File Creation operation'
        );

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

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      success: false,
      error: error.message || `Failed to execute ${toolName}`,
    };
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
          extension: entry.isDirectory ? null : extname(entry.name).slice(1),
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
    const fileName = basename(filePath);
    const fileExt = extname(fileName).slice(1);

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
    const encoding = args.encoding || 'utf8';

    let content = await readTextFile(filePath, { encoding });
    
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
 * Execute write_file_content tool
 */
async function executeWriteFileContent(args: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const filePath = args.path;
  const content = args.content;
  
  if (!filePath || content === undefined) {
    return { success: false, error: 'File path and content are required.' };
  }

  try {
    // Check if file exists
    const fileExists = await exists(filePath);
    if (fileExists && !args.overwrite) {
      return { success: false, error: 'File already exists. Set overwrite=true to overwrite.' };
    }

    // Create parent directories if needed
    if (args.createDirectories !== false) {
      const parentDir = dirname(filePath);
      const parentExists = await exists(parentDir);
      if (!parentExists) {
        await mkdir(parentDir, { recursive: true });
      }
    }

    await writeTextFile(filePath, content);

    return {
      success: true,
      data: {
        path: filePath,
        written: true,
        size: content.length,
        lines: content.split('\n').length,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to write file content' };
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

    return {
      success: errors.length === 0 || deleted.length > 0,
      data: {
        deleted,
        errors: errors.length > 0 ? errors : undefined,
        count: deleted.length,
      },
    };
  } catch (error: any) {
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
              const ageDays = (Date.now() - (metadata.mtime || 0)) / (1000 * 60 * 60 * 24);
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
    
    const dirExists = await exists(dirPath);
    if (dirExists) {
      return { success: false, error: 'Directory already exists.' };
    }

    await mkdir(dirPath, { recursive });

    return {
      success: true,
      data: {
        path: dirPath,
        created: true,
      },
    };
  } catch (error: any) {
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
    const parentDir = dirname(destPath);
    const parentExists = await exists(parentDir);
    if (!parentExists) {
      await mkdir(parentDir, { recursive: true });
    }

    const { rename } = await import('@tauri-apps/plugin-fs');
    await rename(sourcePath, destPath);

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
    const parentDir = dirname(destPath);
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
 * Gets all available tools (custom + MCP).
 * Optionally filters tools based on settings (e.g., ClawdBot tools).
 */
export async function getAllTools(settings?: { clawdbotEnabled?: boolean }): Promise<ToolDefinition[]> {
  let customTools = TOOLS;
  
  // Filter ClawdBot tools if not enabled
  if (settings && !settings.clawdbotEnabled) {
    customTools = customTools.filter(tool => 
      !tool.name.startsWith('clawdbot_') && !tool.name.startsWith('clawdhub_')
    );
  }
  
  const mcpTools = await getMCPTools();
  return [...customTools, ...mcpTools];
}
