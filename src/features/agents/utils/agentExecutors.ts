/**
 * File: src/features/agents/utils/agentExecutors.ts
 * 
 * Agent execution logic that connects agents to real file operations.
 * Each agent type has its own executor that performs actual file management tasks.
 */

import { readDir, stat, remove, exists, mkdir } from '@tauri-apps/plugin-fs';
import { join, basename, dirname } from '@tauri-apps/api/path';
import { copyFile as tauriCopyFile, rename } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import type { AgentConfig, AgentState, AgentLog, AgentResults } from '../types';
import { organizeFilesByStrategy } from '../../ai-assistant/utils/organizationStrategies';
import { findDuplicateFiles } from '../../ai-assistant/utils/duplicateDetection';
import { analyzeDirectoryFiles } from '../../ai-assistant/utils/fileAnalysis';
import { executeFileOperation } from '../../ai-assistant/utils/fileOperations';
import { executeFileCopyTool } from '../../ai-assistant/utils/tabTools';
import type { OrganizationConfig } from '../../ai-assistant/types';

/**
 * Agent execution context with progress callbacks.
 */
export interface AgentExecutionContext {
  onProgress: (progress: number, stage: string) => void;
  onLog: (log: AgentLog) => void;
  onError: (error: string) => void;
  shouldStop: () => boolean;
  shouldPause: () => boolean;
}

/**
 * Executes a file organizer agent.
 * Organizes files by type, date, project, or size based on agent configuration.
 */
export async function executeFileOrganizerAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentResults> {
  const { onProgress, onLog, onError, shouldStop } = context;
  let targetDirectory = agent.params?.targetDirectory || '';
  const strategy = agent.params?.strategy || 'by-type';
  const includeSubdirectories = agent.params?.includeSubdirectories !== false;

  if (!targetDirectory) {
    // Try to get current directory from localStorage (set by AI Assistant)
    const currentDir = localStorage.getItem('ai-assistant-current-directory');
    if (currentDir) {
      targetDirectory = currentDir;
      onLog({
        timestamp: new Date(),
        level: 'info',
        message: `Using current working directory: ${targetDirectory}`,
      });
    } else {
      throw new Error('Target directory not specified. Please configure the agent with a target directory or set a working directory in the AI Assistant.');
    }
  }

  try {
    // Validate directory exists and is accessible
    const { exists, readDir } = await import('@tauri-apps/plugin-fs');
    const dirExists = await exists(targetDirectory);
    if (!dirExists) {
      throw new Error(`Target directory does not exist: ${targetDirectory}`);
    }

    // Try to read directory to check permissions
    try {
      await readDir(targetDirectory);
    } catch (error: any) {
      throw new Error(`Cannot access directory: ${targetDirectory}. ${error.message || 'Permission denied'}`);
    }

    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Starting file organization with strategy: ${strategy} in ${targetDirectory}`,
    });

    onProgress(10, 'Analyzing directory structure...');

    if (shouldStop()) {
      throw new Error('Agent stopped by user');
    }

    // Organize files using the strategy
    const config: OrganizationConfig = {
      strategy: strategy as any,
      options: {
        dateFormat: agent.params?.dateFormat || 'year-month',
      },
    };

    onProgress(30, 'Generating organization plan...');
    const operation = await organizeFilesByStrategy(targetDirectory, config);

    if (shouldStop()) {
      throw new Error('Agent stopped by user');
    }

    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Found ${operation.files.length} files to organize`,
    });

    onProgress(50, 'Executing file operations...');

    // Filter out files that are already in their target location
    const filesToMove = operation.files.filter(item => {
      // Normalize paths for comparison
      const source = item.sourcePath.replace(/\\/g, '/');
      const target = item.targetPath?.replace(/\\/g, '/') || '';
      return source !== target;
    });

    if (filesToMove.length === 0) {
      onLog({
        timestamp: new Date(),
        level: 'info',
        message: 'All files are already organized. No operations needed.',
      });
      onProgress(100, 'Completed');
      return {
        filesProcessed: 0,
        foldersCreated: 0,
      };
    }

    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Moving ${filesToMove.length} files to organized structure...`,
    });

    // Execute the operation with filtered files
    const operationToExecute = {
      ...operation,
      files: filesToMove,
    };

    try {
      await executeFileOperation(operationToExecute, {
        enableBackup: true,
        excludedFolders: [],
      });
    } catch (error: any) {
      // Log the actual error for debugging
      onLog({
        timestamp: new Date(),
        level: 'error',
        message: `Error during file operation: ${error.message || 'Unknown error'}`,
        data: error,
      });
      throw error;
    }

    onProgress(100, 'Completed');

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: `File organization completed successfully. Processed ${filesToMove.length} files.`,
    });

    return {
      filesProcessed: filesToMove.length,
      foldersCreated: new Set(filesToMove.map(f => f.targetPath?.split('/').slice(0, -1).join('/')).filter(Boolean)).size,
    };
  } catch (error: any) {
    // Log detailed error information
    const errorMessage = error.message || 'File organization failed';
    onLog({
      timestamp: new Date(),
      level: 'error',
      message: `Error details: ${errorMessage}`,
      data: error,
    });
    onError(errorMessage);
    throw error;
  }
}

/**
 * Executes a duplicate finder agent.
 * Scans for duplicate files and optionally removes them.
 */
export async function executeDuplicateFinderAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentResults> {
  const { onProgress, onLog, onError, shouldStop } = context;
  let targetDirectory = agent.params?.targetDirectory || '';
  const minFileSize = agent.params?.minFileSize || 0;
  const autoRemove = agent.params?.autoRemove === true;

  if (!targetDirectory) {
    // Try to get current directory from localStorage (set by AI Assistant)
    const currentDir = localStorage.getItem('ai-assistant-current-directory');
    if (currentDir) {
      targetDirectory = currentDir;
      onLog({
        timestamp: new Date(),
        level: 'info',
        message: `Using current working directory: ${targetDirectory}`,
      });
    } else {
      throw new Error('Target directory not specified. Please configure the agent with a target directory or set a working directory in the AI Assistant.');
    }
  }

  try {
    onLog({
      timestamp: new Date(),
      level: 'info',
      message: 'Starting duplicate file scan...',
    });

    onProgress(20, 'Scanning directory for duplicates...');

    if (shouldStop()) {
      throw new Error('Agent stopped by user');
    }

    const duplicateAnalysis = await findDuplicateFiles(targetDirectory);

    onProgress(60, 'Analyzing duplicate groups...');

    if (shouldStop()) {
      throw new Error('Agent stopped by user');
    }

    // Filter by minimum file size
    const filteredGroups = duplicateAnalysis.duplicateGroups.filter(
      group => group.size >= minFileSize
    );

    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Found ${filteredGroups.length} duplicate groups`,
      data: { totalDuplicates: duplicateAnalysis.totalDuplicates },
    });

    let filesRemoved = 0;
    let spaceSaved = 0;

    if (autoRemove && filteredGroups.length > 0) {
      onProgress(80, 'Removing duplicate files...');

      // Remove duplicates (keep first file in each group)
      for (const group of filteredGroups) {
        if (shouldStop()) {
          throw new Error('Agent stopped by user');
        }

        // Keep the first file, remove the rest
        for (let i = 1; i < group.files.length; i++) {
          try {
            await remove(group.files[i].path);
            filesRemoved++;
            spaceSaved += group.size;
          } catch (error) {
            onLog({
              timestamp: new Date(),
              level: 'warning',
              message: `Failed to remove duplicate: ${group.files[i].path}`,
            });
          }
        }
      }
    }

    onProgress(100, 'Completed');

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: `Duplicate scan completed. Found ${filteredGroups.length} groups`,
    });

    return {
      duplicatesFound: duplicateAnalysis.totalDuplicates,
      duplicateGroups: filteredGroups.length,
      filesRemoved,
      spaceSaved,
    };
  } catch (error: any) {
    onError(error.message || 'Duplicate finder failed');
    throw error;
  }
}

/**
 * Executes a file analyzer agent.
 * Analyzes file usage, sizes, and suggests optimizations.
 */
export async function executeFileAnalyzerAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentResults> {
  const { onProgress, onLog, onError, shouldStop } = context;
  let targetDirectory = agent.params?.targetDirectory || '';
  const analyzeUnused = agent.params?.analyzeUnused !== false;
  const suggestArchival = agent.params?.suggestArchival === true;

  if (!targetDirectory) {
    // Try to get current directory from localStorage (set by AI Assistant)
    const currentDir = localStorage.getItem('ai-assistant-current-directory');
    if (currentDir) {
      targetDirectory = currentDir;
      onLog({
        timestamp: new Date(),
        level: 'info',
        message: `Using current working directory: ${targetDirectory}`,
      });
    } else {
      throw new Error('Target directory not specified. Please configure the agent with a target directory or set a working directory in the AI Assistant.');
    }
  }

  try {
    onLog({
      timestamp: new Date(),
      level: 'info',
      message: 'Starting file analysis...',
    });

    onProgress(20, 'Analyzing directory...');

    if (shouldStop()) {
      throw new Error('Agent stopped by user');
    }

    const analysis = await analyzeDirectoryFiles(targetDirectory);

    onProgress(60, 'Generating recommendations...');

    if (shouldStop()) {
      throw new Error('Agent stopped by user');
    }

    // Analyze unused files (files not modified in last 90 days)
    let unusedFiles = 0;
    let archivalCandidates = 0;

    if (analyzeUnused) {
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const files: Array<{ path: string; modified: Date; size: number }> = [];

      // Collect all files with modification dates
      await collectFilesWithDates(targetDirectory, files);

      // Count unused files
      unusedFiles = files.filter(file => {
        const fileDate = file.modified.getTime();
        return fileDate < ninetyDaysAgo;
      }).length;

      // Count large unused files as archival candidates
      const largeUnusedThreshold = 10 * 1024 * 1024; // 10MB
      archivalCandidates = files.filter(file => {
        const fileDate = file.modified.getTime();
        return fileDate < ninetyDaysAgo && file.size > largeUnusedThreshold;
      }).length;

      onLog({
        timestamp: new Date(),
        level: 'info',
        message: `Found ${unusedFiles} unused files (not modified in 90 days), ${archivalCandidates} large files suitable for archival`,
      });
    }

    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Analysis complete. Organization score: ${analysis.organizationScore.toFixed(2)}`,
      data: {
        totalFiles: analysis.totalFiles,
        totalSize: analysis.totalSize,
      },
    });

    onProgress(100, 'Completed');

    return {
      filesAnalyzed: analysis.totalFiles,
      totalSize: analysis.totalSize,
      organizationScore: analysis.organizationScore,
      unusedFiles,
      archivalCandidates,
    };
  } catch (error: any) {
    onError(error.message || 'File analysis failed');
    throw error;
  }
}

/**
 * Executes a cleanup agent.
 * Removes temporary files, empty folders, and old cache files.
 */
export async function executeCleanupAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentResults> {
  const { onProgress, onLog, onError, shouldStop } = context;
  const targetDirectories = agent.params?.targetDirectories || [];
  const removeEmptyFolders = agent.params?.removeEmptyFolders !== false;
  const removeTempFiles = agent.params?.removeTempFiles !== false;
  const olderThanDays = agent.params?.olderThanDays || 30;

  if (targetDirectories.length === 0) {
    throw new Error('No target directories specified');
  }

  try {
    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Starting cleanup in ${targetDirectories.length} directory(ies)...`,
    });

    let filesRemoved = 0;
    let foldersRemoved = 0;
    let spaceSaved = 0;
    const cutoffDate = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    for (let i = 0; i < targetDirectories.length; i++) {
      const directory = targetDirectories[i];
      onProgress(
        Math.floor((i / targetDirectories.length) * 80),
        `Cleaning up ${basename(directory)}...`
      );

      if (shouldStop()) {
        throw new Error('Agent stopped by user');
      }

      // Remove temp files
      if (removeTempFiles) {
        const tempFiles = await findTempFiles(directory, cutoffDate);
        for (const file of tempFiles) {
          try {
            const fileStat = await stat(file);
            await remove(file);
            filesRemoved++;
            spaceSaved += fileStat.size;
          } catch (error) {
            onLog({
              timestamp: new Date(),
              level: 'warning',
              message: `Failed to remove temp file: ${file}`,
            });
          }
        }
      }

      // Remove empty folders
      if (removeEmptyFolders) {
        const emptyFolders = await findEmptyFolders(directory);
        for (const folder of emptyFolders) {
          try {
            await remove(folder);
            foldersRemoved++;
          } catch (error) {
            onLog({
              timestamp: new Date(),
              level: 'warning',
              message: `Failed to remove empty folder: ${folder}`,
            });
          }
        }
      }
    }

    onProgress(100, 'Completed');

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: `Cleanup completed. Removed ${filesRemoved} files and ${foldersRemoved} folders`,
    });

    return {
      filesRemoved,
      foldersRemoved,
      spaceSaved,
    };
  } catch (error: any) {
    onError(error.message || 'Cleanup failed');
    throw error;
  }
}

/**
 * Finds temporary files in a directory.
 */
async function findTempFiles(directory: string, olderThan: number): Promise<string[]> {
  const tempFiles: string[] = [];
  const tempPatterns = [
    /\.tmp$/i,
    /\.temp$/i,
    /~$/,
    /\.cache$/i,
    /\.log$/i,
  ];

  try {
    await collectFilesRecursive(directory, async (filePath) => {
      const fileName = await basename(filePath);
      const isTempFile = tempPatterns.some(pattern => pattern.test(fileName));

      if (isTempFile) {
        try {
          const fileStat = await stat(filePath);
          const fileDate = fileStat.mtime ? new Date(fileStat.mtime).getTime() : Date.now();
          if (fileDate < olderThan) {
            tempFiles.push(filePath);
          }
        } catch {
          // Skip files we can't access
        }
      }
    });
  } catch (error) {
    console.error(`Error finding temp files in ${directory}:`, error);
  }

  return tempFiles;
}

/**
 * Finds empty folders in a directory.
 */
async function findEmptyFolders(directory: string): Promise<string[]> {
  const emptyFolders: string[] = [];

  try {
    await collectFoldersRecursive(directory, async (folderPath) => {
      try {
        const entries = await readDir(folderPath);
        if (entries.length === 0) {
          emptyFolders.push(folderPath);
        }
      } catch {
        // Skip folders we can't access
      }
    });
  } catch (error) {
    console.error(`Error finding empty folders in ${directory}:`, error);
  }

  return emptyFolders;
}

/**
 * Recursively collects files and calls callback for each file.
 */
async function collectFilesRecursive(
  directory: string,
  callback: (filePath: string) => Promise<void>
): Promise<void> {
  try {
    const entries = await readDir(directory);
    for (const entry of entries) {
      const entryPath = await join(directory, entry.name);
      if (entry.isDirectory) {
        if (!entry.name.startsWith('.')) {
          await collectFilesRecursive(entryPath, callback);
        }
      } else {
        await callback(entryPath);
      }
    }
  } catch (error) {
    console.error(`Error collecting files from ${directory}:`, error);
  }
}

/**
 * Recursively collects folders and calls callback for each folder.
 */
async function collectFoldersRecursive(
  directory: string,
  callback: (folderPath: string) => Promise<void>
): Promise<void> {
  try {
    const entries = await readDir(directory);
    for (const entry of entries) {
      if (entry.isDirectory && !entry.name.startsWith('.')) {
        const entryPath = await join(directory, entry.name);
        await callback(entryPath);
        await collectFoldersRecursive(entryPath, callback);
      }
    }
  } catch (error) {
    console.error(`Error collecting folders from ${directory}:`, error);
  }
}

/**
 * Executes a backup agent.
 * Backs up important files and folders.
 */
export async function executeBackupAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentResults> {
  const { onProgress, onLog, onError, shouldStop } = context;
  const sourceDirectories = agent.params?.sourceDirectories || [];
  const backupLocation = agent.params?.backupLocation || '';
  const includeSubdirectories = agent.params?.includeSubdirectories !== false;

  if (sourceDirectories.length === 0) {
    throw new Error('No source directories specified');
  }

  if (!backupLocation) {
    throw new Error('Backup location not specified');
  }

  try {
    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Starting backup of ${sourceDirectories.length} directory(ies) to ${backupLocation}...`,
    });

    // Ensure backup location exists
    onProgress(5, 'Preparing backup location...');
    try {
      const backupExists = await exists(backupLocation);
      if (!backupExists) {
        await mkdir(backupLocation, { recursive: true });
        onLog({
          timestamp: new Date(),
          level: 'info',
          message: `Created backup directory: ${backupLocation}`,
        });
      }
    } catch (error: any) {
      throw new Error(`Failed to create backup directory: ${error.message}`);
    }

    let totalFilesBackedUp = 0;
    let totalSizeBackedUp = 0;

    // Backup each source directory
    for (let i = 0; i < sourceDirectories.length; i++) {
      const sourceDir = sourceDirectories[i];
      const sourceDirName = await basename(sourceDir);
      const targetBackupDir = await join(backupLocation, sourceDirName);

      onProgress(
        Math.floor((i / sourceDirectories.length) * 80) + 10,
        `Backing up ${sourceDirName}...`
      );

      if (shouldStop()) {
        throw new Error('Agent stopped by user');
      }

      // Use file copy tool to backup files
      const copyResult = await executeFileCopyTool(
        {
          sourcePath: sourceDir,
          destinationPath: targetBackupDir,
          operation: 'copy',
          includeSubdirectories,
          overwrite: false, // Don't overwrite existing backups
        },
        (progress) => {
          if (progress) {
            const overallProgress = Math.floor(
              ((i / sourceDirectories.length) * 80) +
              ((progress.percentage / 100) * (80 / sourceDirectories.length)) +
              10
            );
            onProgress(overallProgress, progress.status || `Backing up ${sourceDirName}...`);
          }
        }
      );

      if (!copyResult.success) {
        onLog({
          timestamp: new Date(),
          level: 'warning',
          message: `Backup of ${sourceDirName} had issues: ${copyResult.error}`,
        });
      } else {
        // Count files backed up from copy result
        const filesCount = copyResult.data?.filesProcessed || copyResult.data?.totalFiles || 0;
        totalFilesBackedUp += filesCount;
      }
    }

    onProgress(100, 'Completed');

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: `Backup completed. Backed up ${totalFilesBackedUp} files`,
    });

    return {
      filesBackedUp: totalFilesBackedUp,
      backupLocation,
      totalSizeBackedUp,
    };
  } catch (error: any) {
    onError(error.message || 'Backup failed');
    throw error;
  }
}

/**
 * Executes a sync agent.
 * Keeps folders synchronized across different locations.
 */
export async function executeSyncAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentResults> {
  const { onProgress, onLog, onError, shouldStop } = context;
  const sourceDirectory = agent.params?.sourceDirectory || '';
  const targetDirectory = agent.params?.targetDirectory || '';
  const syncDirection = agent.params?.syncDirection || 'bidirectional';
  const includeSubdirectories = agent.params?.includeSubdirectories !== false;

  if (!sourceDirectory || !targetDirectory) {
    throw new Error('Source and target directories must be specified');
  }

  try {
    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Starting sync (${syncDirection}) from ${sourceDirectory} to ${targetDirectory}...`,
    });

    // Ensure target directory exists
    onProgress(5, 'Preparing sync target...');
    try {
      const targetExists = await exists(targetDirectory);
      if (!targetExists) {
        await mkdir(targetDirectory, { recursive: true });
      }
    } catch (error: any) {
      throw new Error(`Failed to create target directory: ${error.message}`);
    }

    let filesSynced = 0;
    let filesCreated = 0;
    let filesUpdated = 0;

    if (syncDirection === 'one-way' || syncDirection === 'bidirectional') {
      // Sync source -> target
      onProgress(20, 'Syncing source to target...');

      if (shouldStop()) {
        throw new Error('Agent stopped by user');
      }

      const sourceFiles = await collectAllFiles(sourceDirectory, includeSubdirectories);
      const targetFiles = await collectAllFiles(targetDirectory, includeSubdirectories);
      const targetFileMap = new Map(targetFiles.map(f => [f.name, f]));

      for (let i = 0; i < sourceFiles.length; i++) {
        const sourceFile = sourceFiles[i];
        const relativePath = sourceFile.path.replace(sourceDirectory, '').replace(/^\//, '');
        const targetPath = await join(targetDirectory, relativePath);
        const targetFile = targetFileMap.get(relativePath);

        if (shouldStop()) {
          throw new Error('Agent stopped by user');
        }

        // Check if file needs syncing
        let needsSync = false;
        if (!targetFile) {
          needsSync = true; // File doesn't exist in target
        } else {
          // Compare modification times
          const sourceTime = sourceFile.modified.getTime();
          const targetTime = targetFile.modified.getTime();
          if (sourceTime > targetTime || sourceFile.size !== targetFile.size) {
            needsSync = true; // Source is newer or sizes differ
          }
        }

        if (needsSync) {
          try {
            // Ensure target directory exists
            const targetDir = await dirname(targetPath);
            const targetDirExists = await exists(targetDir);
            if (!targetDirExists) {
              await mkdir(targetDir, { recursive: true });
            }

            await tauriCopyFile(sourceFile.path, targetPath);
            filesSynced++;
            if (!targetFile) {
              filesCreated++;
            } else {
              filesUpdated++;
            }

            onProgress(
              20 + Math.floor((i / sourceFiles.length) * 40),
              `Synced ${await basename(sourceFile.path)}...`
            );
          } catch (error: any) {
            onLog({
              timestamp: new Date(),
              level: 'warning',
              message: `Failed to sync ${sourceFile.path}: ${error.message}`,
            });
          }
        }
      }
    }

    if (syncDirection === 'bidirectional') {
      // Sync target -> source (for bidirectional)
      onProgress(60, 'Syncing target to source...');

      if (shouldStop()) {
        throw new Error('Agent stopped by user');
      }

      const sourceFiles = await collectAllFiles(sourceDirectory, includeSubdirectories);
      const sourceFileMap = new Map(sourceFiles.map(f => {
        const relativePath = f.path.replace(sourceDirectory, '').replace(/^\//, '');
        return [relativePath, f];
      }));

      const targetFiles = await collectAllFiles(targetDirectory, includeSubdirectories);

      for (let i = 0; i < targetFiles.length; i++) {
        const targetFile = targetFiles[i];
        const relativePath = targetFile.path.replace(targetDirectory, '').replace(/^\//, '');
        const sourcePath = await join(sourceDirectory, relativePath);
        const sourceFile = sourceFileMap.get(relativePath);

        if (shouldStop()) {
          throw new Error('Agent stopped by user');
        }

        // Check if file needs syncing (only if it doesn't exist in source or is newer)
        if (!sourceFile) {
          try {
            // Ensure source directory exists
            const sourceDir = await dirname(sourcePath);
            const sourceDirExists = await exists(sourceDir);
            if (!sourceDirExists) {
              await mkdir(sourceDir, { recursive: true });
            }

            await tauriCopyFile(targetFile.path, sourcePath);
            filesSynced++;
            filesCreated++;

            onProgress(
              60 + Math.floor((i / targetFiles.length) * 35),
              `Synced ${await basename(targetFile.path)}...`
            );
          } catch (error: any) {
            onLog({
              timestamp: new Date(),
              level: 'warning',
              message: `Failed to sync ${targetFile.path}: ${error.message}`,
            });
          }
        } else {
          // Check if target is newer
          const sourceTime = sourceFile.modified.getTime();
          const targetTime = targetFile.modified.getTime();
          if (targetTime > sourceTime && targetFile.size !== sourceFile.size) {
            try {
              await tauriCopyFile(targetFile.path, sourcePath);
              filesSynced++;
              filesUpdated++;

              onProgress(
                60 + Math.floor((i / targetFiles.length) * 35),
                `Synced ${await basename(targetFile.path)}...`
              );
            } catch (error: any) {
              onLog({
                timestamp: new Date(),
                level: 'warning',
                message: `Failed to sync ${targetFile.path}: ${error.message}`,
              });
            }
          }
        }
      }
    }

    onProgress(100, 'Completed');

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: `Sync completed. Synced ${filesSynced} files (${filesCreated} created, ${filesUpdated} updated)`,
    });

    return {
      filesSynced,
      filesCreated,
      filesUpdated,
    };
  } catch (error: any) {
    onError(error.message || 'Sync failed');
    throw error;
  }
}

/**
 * Collects files with modification dates for analysis.
 */
async function collectFilesWithDates(
  directory: string,
  files: Array<{ path: string; modified: Date; size: number }>
): Promise<void> {
  try {
    const entries = await readDir(directory);
    for (const entry of entries) {
      const entryPath = await join(directory, entry.name);
      if (entry.isDirectory) {
        if (!entry.name.startsWith('.')) {
          await collectFilesWithDates(entryPath, files);
        }
      } else {
        try {
          const metadata = await stat(entryPath);
          files.push({
            path: entryPath,
            modified: metadata.mtime ? new Date(metadata.mtime) : new Date(),
            size: metadata.size,
          });
        } catch {
          // Skip files we can't access
        }
      }
    }
  } catch (error) {
    console.error(`Error collecting files from ${directory}:`, error);
  }
}

/**
 * Collects all files in a directory with metadata.
 */
async function collectAllFiles(
  directory: string,
  includeSubdirectories: boolean
): Promise<Array<{ path: string; name: string; modified: Date; size: number }>> {
  const files: Array<{ path: string; name: string; modified: Date; size: number }> = [];

  const collect = async (dir: string) => {
    try {
      const entries = await readDir(dir);
      for (const entry of entries) {
        const entryPath = await join(dir, entry.name);
        if (entry.isDirectory && includeSubdirectories) {
          if (!entry.name.startsWith('.')) {
            await collect(entryPath);
          }
        } else if (entry.isFile) {
          try {
            const metadata = await stat(entryPath);
            const relativePath = entryPath.replace(directory, '').replace(/^\//, '');
            files.push({
              path: entryPath,
              name: relativePath,
              modified: metadata.mtime ? new Date(metadata.mtime) : new Date(),
              size: metadata.size,
            });
          } catch {
            // Skip files we can't access
          }
        }
      }
    } catch (error) {
      console.error(`Error collecting files from ${dir}:`, error);
    }
  };

  await collect(directory);
  return files;
}

/**
 * Executes Clawdbot agent.
 */
export async function executeClawdbotAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentResults> {
  const { onProgress, onLog, shouldStop } = context;

  onLog({
    timestamp: new Date(),
    level: 'info',
    message: 'Clawdbot initializing...',
  });

  onProgress(10, 'Starting up...');

  // Simulate initialization
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (shouldStop()) return {};

  onLog({
    timestamp: new Date(),
    level: 'info',
    message: 'Clawdbot is active and ready for commands.',
  });

  onProgress(100, 'Ready');

  // For now, it just finishes initialization. 
  // In a real scenario, it might stay running or enter a loop if it was a background daemon.
  // But here agents seem to be "tasks" that run and complete.
  // We'll treat it as a task that completes its initialization.

  return {
    success: true,
    message: 'Clawdbot initialized'
  };
}

/**
 * Gets the executor function for an agent type.
 */
export function getAgentExecutor(agentType: string) {
  switch (agentType) {
    case 'file-organizer':
      return executeFileOrganizerAgent;
    case 'duplicate-finder':
      return executeDuplicateFinderAgent;
    case 'clawdbot':
      return executeClawdbotAgent;
    case 'file-analyzer':
      return executeFileAnalyzerAgent;
    case 'cleanup-agent':
      return executeCleanupAgent;
    case 'backup-agent':
      return executeBackupAgent;
    case 'sync-agent':
      return executeSyncAgent;
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}
