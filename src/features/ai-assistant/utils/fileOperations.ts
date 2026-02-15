/**
 * File: src/features/ai-assistant/utils/fileOperations.ts
 * 
 * Executes file operations (move, copy, rename, delete) with safety checks.
 */

import { rename, copyFile as tauriCopyFile, remove, mkdir, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { dirname } from '@tauri-apps/api/path';
import type { FileOperation, FileOperationItem } from '../types';

interface ExecutionOptions {
  enableBackup?: boolean;
  excludedFolders?: string[];
}

/**
 * Executes a file operation with safety checks.
 */
export async function executeFileOperation(
  operation: FileOperation,
  options: ExecutionOptions = {}
): Promise<void> {
  const { enableBackup = false, excludedFolders = [] } = options;

  // Check for excluded folders
  for (const item of operation.files) {
    for (const excluded of excludedFolders) {
      if (item.sourcePath.includes(excluded)) {
        throw new Error(`Cannot operate on excluded folder: ${excluded}`);
      }
    }
  }

  // Execute operations
  for (const item of operation.files) {
    try {
      switch (item.action) {
        case 'move':
        case 'rename':
          if (item.targetPath) {
            // Skip if source and target are the same
            const sourceNormalized = item.sourcePath.replace(/\\/g, '/');
            const targetNormalized = item.targetPath.replace(/\\/g, '/');
            if (sourceNormalized === targetNormalized) {
              continue; // Skip this file, already in correct location
            }

            // Ensure target directory exists
            const targetDir = await dirname(item.targetPath);
            try {
              await mkdir(targetDir, { recursive: true });
            } catch (e: any) {
              // Directory might already exist, ignore
              if (e.code !== 'EEXIST' && !e.message?.includes('already exists')) {
                console.warn(`Warning creating directory ${targetDir}:`, e);
              }
            }
            
            // Check if target file already exists
            if (await exists(item.targetPath)) {
              // Skip if target already exists (avoid overwriting)
              console.warn(`Target file already exists, skipping: ${item.targetPath}`);
              continue;
            }
            
            await rename(item.sourcePath, item.targetPath);
          }
          break;

        case 'copy':
          if (item.targetPath) {
            const targetDir = await dirname(item.targetPath);
            try {
              await mkdir(targetDir, { recursive: true });
            } catch (e) {
              // Directory might already exist, ignore
            }
            await tauriCopyFile(item.sourcePath, item.targetPath);
          }
          break;

        case 'delete':
          await remove(item.sourcePath);
          break;

        case 'create':
          if (item.targetPath) {
            const targetDir = await dirname(item.targetPath);
            try {
              await mkdir(targetDir, { recursive: true });
            } catch (e) {
              // Directory might already exist, ignore
            }
            // Create empty file
            await writeTextFile(item.targetPath, '');
          }
          break;
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`Error executing operation on ${item.sourcePath}:`, error);
      // Provide more context in the error
      throw new Error(`Failed to ${item.action} file "${item.sourcePath}": ${errorMessage}`);
    }
  }
}
