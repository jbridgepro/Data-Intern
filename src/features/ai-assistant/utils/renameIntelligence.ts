/**
 * File: src/features/ai-assistant/utils/renameIntelligence.ts
 * 
 * Intelligent file renaming based on patterns, dates, and content analysis.
 */

import { readDir, stat } from '@tauri-apps/plugin-fs';
import { join, dirname, basename, extname } from '@tauri-apps/api/path';
import type { FileOperation, FileOperationItem, FileInfo } from '../types';

/**
 * Generates a rename operation based on user command.
 */
export async function generateRenameOperation(
  path: string,
  command: string
): Promise<FileOperation> {
  const files: FileInfo[] = [];
  await collectFiles(path, files, path);

  const lowerCommand = command.toLowerCase();
  const operations: FileOperationItem[] = [];

  // Parse command to determine rename strategy
  if (lowerCommand.includes('date') || lowerCommand.includes('yyyy-mm-dd')) {
    // Rename by date
    for (const file of files) {
      const newName = await generateDateBasedName(file);
      if (newName !== file.name) {
        const parent = await dirname(file.path);
        const targetPath = await join(parent, newName);
        operations.push({
          sourcePath: file.path,
          targetPath,
          action: 'rename',
          reason: 'Add creation date to filename',
        });
      }
    }
  } else if (lowerCommand.includes('snake_case') || lowerCommand.includes('snake')) {
    // Convert to snake_case
    for (const file of files) {
      const newName = await toSnakeCase(file.name);
      if (newName !== file.name) {
        const parent = await dirname(file.path);
        const targetPath = await join(parent, newName);
        operations.push({
          sourcePath: file.path,
          targetPath,
          action: 'rename',
          reason: 'Convert to snake_case',
        });
      }
    }
  } else if (lowerCommand.includes('standardize') || lowerCommand.includes('standard')) {
    // Standardize naming
    for (const file of files) {
      const newName = await standardizeFileName(file.name);
      if (newName !== file.name) {
        const parent = await dirname(file.path);
        const targetPath = await join(parent, newName);
        operations.push({
          sourcePath: file.path,
          targetPath,
          action: 'rename',
          reason: 'Standardize filename',
        });
      }
    }
  } else {
    // Default: clean up filenames
    for (const file of files) {
      const newName = await cleanFileName(file.name);
      if (newName !== file.name) {
        const parent = await dirname(file.path);
        const targetPath = await join(parent, newName);
        operations.push({
          sourcePath: file.path,
          targetPath,
          action: 'rename',
          reason: 'Clean up filename',
        });
      }
    }
  }

  const preview = generatePreview(files, operations);

  return {
    id: `rename-${Date.now()}`,
    type: 'rename',
    description: `Rename ${operations.length} files based on your request`,
    files: operations,
    preview,
    confidence: 0.9,
    requiresConfirmation: operations.length > 20,
  };
}

/**
 * Generates a date-based filename.
 */
/**
 * Generates a date-based filename.
 */
async function generateDateBasedName(file: FileInfo): Promise<string> {
  const date = file.created || file.modified || new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const ext = await extname(file.name);
  const baseName = await basename(file.name, ext);

  // Check if date already in filename
  if (/\d{4}-\d{2}-\d{2}/.test(file.name)) {
    return file.name; // Already has date
  }

  return `${dateStr}_${baseName}${ext}`;
}

/**
 * Converts filename to snake_case.
 */
async function toSnakeCase(name: string): Promise<string> {
  const ext = await extname(name);
  const baseName = await basename(name, ext);

  return baseName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase() + ext;
}

/**
 * Standardizes filename format.
 */
async function standardizeFileName(name: string): Promise<string> {
  const ext = await extname(name);
  const baseName = await basename(name, ext);

  // Remove special characters, normalize spaces
  let standardized = baseName
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter of each word
  standardized = standardized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return standardized + ext;
}

/**
 * Cleans up filename (removes extra spaces, special chars).
 */
async function cleanFileName(name: string): Promise<string> {
  const ext = await extname(name);
  const baseName = await basename(name, ext);

  let cleaned = baseName
    .replace(/[^\w\s.-]/g, '') // Remove special chars except . and -
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  return cleaned + ext;
}

/**
 * Collects all files from a directory.
 */
async function collectFiles(
  currentPath: string,
  files: FileInfo[],
  rootPath: string
): Promise<void> {
  try {
    const entries = await readDir(currentPath);

    for (const entry of entries) {
      const entryPath = await join(currentPath, entry.name);

      if (entry.isDirectory) {
        if (!entry.name.startsWith('.')) {
          await collectFiles(entryPath, files, rootPath);
        }
      } else {
        try {
          const metadata = await stat(entryPath);
          const extension = entry.name.split('.').pop()?.toLowerCase();

          files.push({
            path: entryPath,
            name: entry.name,
            size: metadata.size,
            extension,
            created: metadata.birthtime ? new Date(metadata.birthtime) : undefined,
            modified: metadata.mtime ? new Date(metadata.mtime) : undefined,
          });
        } catch (error) {
          console.warn(`Cannot access file: ${entryPath}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${currentPath}:`, error);
  }
}

/**
 * Generates a preview of rename operations.
 */
function generatePreview(
  files: FileInfo[],
  operations: FileOperationItem[]
): { before: any; after: any } {
  const before: any = {};
  const after: any = {};

  operations.forEach((op) => {
    before[op.sourcePath] = { type: 'file' };
    if (op.targetPath) {
      after[op.targetPath] = { type: 'file' };
    }
  });

  return { before, after };
}
