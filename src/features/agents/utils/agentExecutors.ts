/**
 * File: src/features/agents/utils/agentExecutors.ts
 * 
 * Agent execution logic that connects agents to real file operations.
 * Each agent type has its own executor that performs actual file management tasks.
 */

import { readDir, stat, exists } from '@tauri-apps/plugin-fs';
import { join, basename } from '@tauri-apps/api/path';
import type { AgentConfig, AgentLog, AgentProposal, AgentResults } from '../types';
import { organizeFilesByStrategy } from '../../ai-assistant/utils/organizationStrategies';
import { findDuplicateFiles } from '../../ai-assistant/utils/duplicateDetection';
import { analyzeDirectoryFiles } from '../../ai-assistant/utils/fileAnalysis';
import { completeWithAI } from '../../ai-assistant/utils/aiService';
import type { OrganizationConfig } from '../../ai-assistant/types';
import { AGENT_TRASH_DIR, buildTrashPath, trashStamp } from './changeSets';

/**
 * What an executor returns. Executors that want to change files put the
 * changes in `proposal`; the agent service routes them through the Approval
 * Inbox instead of the executor touching the disk itself.
 */
export type AgentExecutionResult = AgentResults & { proposal?: AgentProposal };

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
): Promise<AgentExecutionResult> {
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

    onProgress(70, 'Drafting moves...');

    // Filter out files that are already in their target location
    const filesToMove = operation.files.filter(item => {
      const source = item.sourcePath.replace(/\\/g, '/');
      const target = item.targetPath?.replace(/\\/g, '/') || '';
      const isMove = item.action === 'move' || item.action === 'rename';
      return isMove && target !== '' && source !== target;
    });

    onProgress(100, 'Completed');

    if (filesToMove.length === 0) {
      onLog({
        timestamp: new Date(),
        level: 'info',
        message: 'All files are already organized. No operations needed.',
      });
      return { filesProcessed: 0, foldersCreated: 0 };
    }

    const folders = new Set(
      filesToMove.map(f => f.targetPath!.replace(/\\/g, '/').split('/').slice(0, -1).join('/'))
    );

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: `Drafted ${filesToMove.length} moves into ${folders.size} folders. Waiting for approval.`,
    });

    return {
      filesProcessed: filesToMove.length,
      foldersCreated: folders.size,
      proposal: {
        title: `Organize ${filesToMove.length} files (${strategy})`,
        summary: `Move ${filesToMove.length} files in ${targetDirectory} into ${folders.size} folders.`,
        changes: filesToMove.map(f => ({
          kind: 'move' as const,
          source: f.sourcePath,
          target: f.targetPath!,
          reason: f.reason,
        })),
      },
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
): Promise<AgentExecutionResult> {
  const { onProgress, onLog, onError, shouldStop } = context;
  let targetDirectory = agent.params?.targetDirectory || '';
  const minFileSize = agent.params?.minFileSize || 0;
  // Drafting a cleanup is safe: nothing is removed until someone approves it.
  // `autoRemove` is the older name for this setting.
  const proposeRemoval = agent.params?.proposeRemoval ?? agent.params?.autoRemove ?? true;

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

    onProgress(100, 'Completed');

    const stamp = trashStamp();
    const changes: AgentProposal['changes'] = [];
    let reclaimable = 0;
    if (proposeRemoval) {
      for (const group of filteredGroups) {
        // Keep the first file in each group, draft the rest for the trash.
        for (const file of group.files.slice(1)) {
          if (file.path.includes(AGENT_TRASH_DIR)) continue;
          changes.push({
            kind: 'trash',
            source: file.path,
            target: buildTrashPath(targetDirectory, file.path, stamp),
            size: group.size,
            reason: `Duplicate of ${group.files[0].path}`,
          });
          reclaimable += group.size;
        }
      }
    }

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: changes.length > 0
        ? `Found ${filteredGroups.length} duplicate groups. Drafted ${changes.length} files for the trash, waiting for approval.`
        : `Duplicate scan completed. Found ${filteredGroups.length} groups`,
    });

    return {
      duplicatesFound: duplicateAnalysis.totalDuplicates,
      duplicateGroups: filteredGroups.length,
      filesRemoved: 0,
      spaceSaved: 0,
      reclaimableSpace: reclaimable,
      proposal: changes.length > 0 ? {
        title: `Remove ${changes.length} duplicate files`,
        summary: `Move ${changes.length} duplicates from ${targetDirectory} to the agent trash (keeps one copy of each). Undoable.`,
        changes,
      } : undefined,
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
): Promise<AgentExecutionResult> {
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
): Promise<AgentExecutionResult> {
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

    const cutoffDate = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const stamp = trashStamp();
    const changes: AgentProposal['changes'] = [];
    let reclaimable = 0;
    let tempFileCount = 0;
    let emptyFolderCount = 0;

    for (let i = 0; i < targetDirectories.length; i++) {
      const directory = targetDirectories[i];
      onProgress(
        Math.floor((i / targetDirectories.length) * 80),
        `Scanning ${await basename(directory)}...`
      );

      if (shouldStop()) {
        throw new Error('Agent stopped by user');
      }

      if (removeTempFiles) {
        const tempFiles = await findTempFiles(directory, cutoffDate);
        for (const file of tempFiles) {
          let size: number | undefined;
          try {
            size = (await stat(file)).size;
            reclaimable += size;
          } catch {
            // Size is informational only
          }
          changes.push({
            kind: 'trash',
            source: file,
            target: buildTrashPath(directory, file, stamp),
            size,
            reason: `Temporary file older than ${olderThanDays} days`,
          });
          tempFileCount++;
        }
      }

      if (removeEmptyFolders) {
        const emptyFolders = await findEmptyFolders(directory);
        // Deepest first, so nested empty folders can all be removed.
        emptyFolders.sort((a, b) => b.length - a.length);
        for (const folder of emptyFolders) {
          changes.push({
            kind: 'remove-empty-dir',
            source: folder,
            reason: 'Empty folder',
          });
          emptyFolderCount++;
        }
      }
    }

    onProgress(100, 'Completed');

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: changes.length > 0
        ? `Drafted cleanup of ${tempFileCount} temp files and ${emptyFolderCount} empty folders. Waiting for approval.`
        : 'Nothing to clean up.',
    });

    return {
      filesRemoved: 0,
      foldersRemoved: 0,
      spaceSaved: 0,
      tempFilesFound: tempFileCount,
      emptyFoldersFound: emptyFolderCount,
      reclaimableSpace: reclaimable,
      proposal: changes.length > 0 ? {
        title: `Clean up ${tempFileCount} temp files, ${emptyFolderCount} empty folders`,
        summary: `Temp files go to the agent trash (undoable). Empty folders are removed only if still empty when approved.`,
        changes,
      } : undefined,
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
): Promise<AgentExecutionResult> {
  const { onProgress, onLog, onError, shouldStop } = context;
  const sourceDirectories = agent.params?.sourceDirectories || [];
  const backupLocation = agent.params?.backupLocation || '';

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

    const changes: AgentProposal['changes'] = [];

    if (!(await exists(backupLocation))) {
      changes.push({ kind: 'mkdir', source: backupLocation, reason: 'Backup destination' });
    }

    for (let i = 0; i < sourceDirectories.length; i++) {
      const sourceDir = sourceDirectories[i];
      if (shouldStop()) {
        throw new Error('Agent stopped by user');
      }
      onProgress(10 + Math.floor((i / sourceDirectories.length) * 80), `Checking ${sourceDir}...`);
      if (!(await exists(sourceDir))) {
        onLog({ timestamp: new Date(), level: 'warning', message: `Source not found, skipping: ${sourceDir}` });
        continue;
      }
      const sourceDirName = await basename(sourceDir);
      changes.push({
        kind: 'copy-tree',
        source: sourceDir,
        target: await join(backupLocation, sourceDirName),
        reason: 'Copy new files only, never overwrites existing backups',
      });
    }

    onProgress(100, 'Completed');

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: `Drafted backup of ${changes.filter(c => c.kind === 'copy-tree').length} folder(s).`,
    });

    return {
      filesBackedUp: 0,
      backupLocation,
      totalSizeBackedUp: 0,
      proposal: changes.length > 0 ? {
        title: `Back up ${sourceDirectories.length} folder(s)`,
        summary: `Copy new files to ${backupLocation}. Existing backups are never overwritten.`,
        changes,
      } : undefined,
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
): Promise<AgentExecutionResult> {
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

    onProgress(5, 'Reading both folders...');

    const toRelative = (root: string, path: string) =>
      path.replace(/\\/g, '/').replace(root.replace(/\\/g, '/').replace(/\/+$/, ''), '').replace(/^\//, '');

    const sourceFiles = await collectAllFiles(sourceDirectory, includeSubdirectories);
    const targetFiles = (await exists(targetDirectory))
      ? await collectAllFiles(targetDirectory, includeSubdirectories)
      : [];
    const sourceMap = new Map(sourceFiles.map(f => [toRelative(sourceDirectory, f.path), f]));
    const targetMap = new Map(targetFiles.map(f => [toRelative(targetDirectory, f.path), f]));

    const changes: AgentProposal['changes'] = [];
    let filesCreated = 0;
    let filesUpdated = 0;

    if (syncDirection === 'one-way' || syncDirection === 'bidirectional') {
      onProgress(30, 'Comparing source to target...');
      for (const [relativePath, sourceFile] of sourceMap) {
        if (shouldStop()) throw new Error('Agent stopped by user');
        const targetFile = targetMap.get(relativePath);
        const newer = targetFile && (
          sourceFile.modified.getTime() > targetFile.modified.getTime() ||
          (sourceFile.size !== targetFile.size && syncDirection === 'one-way')
        );
        if (!targetFile || newer) {
          changes.push({
            kind: 'copy',
            source: sourceFile.path,
            target: targetFile ? targetFile.path : await join(targetDirectory, relativePath),
            overwrite: Boolean(targetFile),
            size: sourceFile.size,
            reason: targetFile ? 'Source is newer, replaces target' : 'Missing in target',
          });
          if (targetFile) filesUpdated++; else filesCreated++;
        }
      }
    }

    if (syncDirection === 'bidirectional') {
      onProgress(60, 'Comparing target to source...');
      for (const [relativePath, targetFile] of targetMap) {
        if (shouldStop()) throw new Error('Agent stopped by user');
        const sourceFile = sourceMap.get(relativePath);
        if (!sourceFile) {
          changes.push({
            kind: 'copy',
            source: targetFile.path,
            target: await join(sourceDirectory, relativePath),
            overwrite: false,
            size: targetFile.size,
            reason: 'Missing in source',
          });
          filesCreated++;
        } else if (targetFile.modified.getTime() > sourceFile.modified.getTime()) {
          changes.push({
            kind: 'copy',
            source: targetFile.path,
            target: sourceFile.path,
            overwrite: true,
            size: targetFile.size,
            reason: 'Target is newer, replaces source',
          });
          filesUpdated++;
        }
      }
    }

    onProgress(100, 'Completed');

    onLog({
      timestamp: new Date(),
      level: 'success',
      message: changes.length > 0
        ? `Drafted ${changes.length} copies (${filesCreated} new, ${filesUpdated} overwrites).`
        : 'Folders are already in sync.',
    });

    return {
      filesSynced: 0,
      filesCreated,
      filesUpdated,
      proposal: changes.length > 0 ? {
        title: `Sync ${changes.length} files (${syncDirection})`,
        summary: `${filesCreated} new copies and ${filesUpdated} overwrites between ${sourceDirectory} and ${targetDirectory}. Overwritten files are kept in the agent trash.`,
        changes,
      } : undefined,
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
 * Resolves the folder an AI agent should look at.
 */
function resolveWorkingDirectory(agent: AgentConfig): string | null {
  return (
    agent.params?.targetDirectory ||
    localStorage.getItem('ai-assistant-current-directory') ||
    null
  );
}

/**
 * Builds a compact, model-friendly snapshot of a folder.
 */
async function buildDirectorySnapshot(directory: string): Promise<string> {
  const lines: string[] = [`Folder: ${directory}`];
  try {
    const entries = await readDir(directory);
    const visible = entries.filter(e => !e.name.startsWith('.'));
    const folders = visible.filter(e => e.isDirectory).map(e => e.name);
    const files = visible.filter(e => e.isFile).map(e => e.name);
    lines.push(`Top-level folders (${folders.length}): ${folders.slice(0, 40).join(', ') || 'none'}`);
    lines.push(`Top-level files (${files.length}): ${files.slice(0, 40).join(', ') || 'none'}`);
  } catch (error: any) {
    lines.push(`Could not list folder: ${error?.message || error}`);
  }
  try {
    const analysis = await analyzeDirectoryFiles(directory);
    lines.push(`Total files: ${analysis.totalFiles}, total size: ${analysis.totalSize} bytes`);
    lines.push(`Organization score: ${analysis.organizationScore.toFixed(0)}/100`);
    lines.push(
      'File types: ' +
        analysis.fileTypes
          .slice(0, 12)
          .map(t => `${t.extension || '(none)'}: ${t.count}`)
          .join(', ')
    );
    lines.push(
      'Largest files: ' +
        analysis.largestFiles.slice(0, 5).map(f => `${f.name} (${f.size} bytes)`).join(', ')
    );
  } catch {
    // Analysis is optional context
  }
  return lines.join('\n');
}

const AGENT_SYSTEM_PROMPT = `You are a file management agent inside a desktop app.
You can only read the folder snapshot you are given. You cannot change files yourself.
Answer in plain text, under 200 words. Be specific to the snapshot.
When you recommend an action that changes files, say which built-in agent should do it:
File Organizer, Duplicate Finder, Cleanup Agent, Backup Agent or Sync Agent.
Their changes always go to the Approval Inbox for a person to review.`;

/**
 * Executes Clawdbot: an AI assistant that reviews the working folder and
 * writes a short brief with recommendations. It never changes files.
 */
export async function executeClawdbotAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentExecutionResult> {
  const { onProgress, onLog, shouldStop } = context;
  const directory = resolveWorkingDirectory(agent);
  if (!directory) {
    throw new Error('No folder to review. Set a target directory or a working directory in the AI Assistant.');
  }

  onProgress(15, 'Reading folder...');
  const snapshot = await buildDirectorySnapshot(directory);
  if (shouldStop()) throw new Error('Agent stopped by user');

  onProgress(50, 'Asking the model...');
  const goal =
    agent.params?.prompt ||
    'Give a short status brief of this folder: what needs attention now, and what can wait.';
  const brief = await completeWithAI({
    system: AGENT_SYSTEM_PROMPT,
    prompt: `${goal}\n\n${snapshot}`,
    maxTokens: 600,
    modelOverride: agent.params?.model,
  });

  onLog({ timestamp: new Date(), level: 'success', message: brief });
  onProgress(100, 'Completed');

  return { message: brief, directory };
}

/**
 * Executes a task agent with subagents.
 *
 * Each subagent either runs a built-in agent (when its `tools` list names
 * one, e.g. "duplicate-finder") or asks the model to work on its goal.
 * Changes drafted by built-in agents are merged into one proposal so the
 * whole task is reviewed in the Approval Inbox as a single set.
 */
export async function executeTaskAgent(
  agent: AgentConfig,
  context: AgentExecutionContext
): Promise<AgentExecutionResult> {
  const { onProgress, onLog, shouldStop } = context;
  const subagents = agent.subagents || [];

  if (subagents.length === 0) {
    onLog({
      timestamp: new Date(),
      level: 'warning',
      message: 'No subagents configured for this task agent.',
    });
    return { status: 'completed', subagentsExecuted: 0 };
  }

  const directory = resolveWorkingDirectory(agent);
  const snapshot = directory ? await buildDirectorySnapshot(directory) : 'No folder selected.';
  const builtInTypes = ['file-organizer', 'duplicate-finder', 'file-analyzer', 'cleanup-agent', 'backup-agent', 'sync-agent'];

  const subagentResults: Array<{ id: string; status: string; output?: string; error?: string }> = [];
  const mergedChanges: AgentProposal['changes'] = [];
  const proposalTitles: string[] = [];
  const notes: string[] = [];

  for (let index = 0; index < subagents.length; index++) {
    const subagent = subagents[index];
    if (shouldStop()) throw new Error('Agent stopped by user');

    onProgress(
      10 + Math.floor((index / subagents.length) * 80),
      `Subagent ${index + 1}/${subagents.length}: ${subagent.name}`
    );
    onLog({
      timestamp: new Date(),
      level: 'info',
      message: `Subagent [${subagent.name}] (${subagent.role}): ${subagent.goal}`,
    });

    try {
      const builtIn = subagent.tools?.find(t => builtInTypes.includes(t));
      if (builtIn) {
        const executor = getAgentExecutor(builtIn);
        const result = await executor(
          { ...agent, type: builtIn as AgentConfig['type'], name: `${agent.name} / ${subagent.name}` },
          context
        );
        if (result.proposal) {
          mergedChanges.push(...result.proposal.changes);
          proposalTitles.push(result.proposal.title);
        }
        subagentResults.push({ id: subagent.id, status: 'completed', output: result.proposal?.title });
      } else {
        const earlier = notes.length > 0 ? `\n\nNotes from earlier subagents:\n${notes.join('\n')}` : '';
        const output = await completeWithAI({
          system: `${AGENT_SYSTEM_PROMPT}\nYour role: ${subagent.role}.`,
          prompt: `Goal: ${subagent.goal}\n\n${snapshot}${earlier}`,
          maxTokens: 500,
          modelOverride: subagent.model,
        });
        notes.push(`[${subagent.name}] ${output}`);
        onLog({ timestamp: new Date(), level: 'success', message: `[${subagent.name}] ${output}` });
        subagentResults.push({ id: subagent.id, status: 'completed', output });
      }
    } catch (error: any) {
      onLog({
        timestamp: new Date(),
        level: 'error',
        message: `Subagent [${subagent.name}]: Failed - ${error.message}`,
      });
      subagentResults.push({ id: subagent.id, status: 'error', error: error.message });
    }
  }

  onProgress(100, 'Completed');

  return {
    subagentsExecuted: subagentResults.length,
    results: subagentResults,
    proposal: mergedChanges.length > 0 ? {
      title: `${agent.name}: ${proposalTitles.join(' + ')}`,
      summary: `Changes drafted by ${proposalTitles.length} subagent(s) of ${agent.name}.`,
      changes: mergedChanges,
    } : undefined,
  };
}

/**
 * Gets the executor function for an agent type.
 */
export function getAgentExecutor(
  agentType: string
): (agent: AgentConfig, context: AgentExecutionContext) => Promise<AgentExecutionResult> {
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
    case 'task-agent':
      return executeTaskAgent;
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}
