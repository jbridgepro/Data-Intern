/**
 * File: src/features/ai-assistant/utils/organizationStrategies.ts
 * 
 * Implements various file organization strategies (by type, date, project, etc.).
 */

import { readDir, stat } from '@tauri-apps/plugin-fs';
import { join, dirname, basename } from '@tauri-apps/api/path';
import type { FileOperation, FileOperationItem, OrganizationConfig, FileInfo } from '../types';

/**
 * Organizes files based on the specified strategy.
 */
export async function organizeFilesByStrategy(
  path: string,
  config: OrganizationConfig
): Promise<FileOperation> {
  const files: FileInfo[] = [];
  await collectFiles(path, files, path);

  let operationItems: FileOperationItem[] = [];

  switch (config.strategy) {
    case 'by-type':
      operationItems = await organizeByType(files, path);
      break;
    case 'by-date':
      operationItems = await organizeByDate(files, path, config.options.dateFormat || 'year-month');
      break;
    case 'by-project':
      operationItems = await organizeByProject(files, path);
      break;
    case 'by-size':
      operationItems = await organizeBySize(files, path, config.options.sizeThresholds);
      break;
    default:
      operationItems = await organizeByType(files, path);
  }

  // Generate preview
  const preview = generatePreview(files, operationItems);

  return {
    id: `organize-${Date.now()}`,
    type: 'organize',
    description: generateDescription(config, operationItems.length),
    files: operationItems,
    preview,
    confidence: 0.85,
    requiresConfirmation: operationItems.length > 50,
  };
}

/**
 * Organizes files by their extension/type.
 */
async function organizeByType(files: FileInfo[], rootPath: string): Promise<FileOperationItem[]> {
  const typeMap = new Map<string, FileInfo[]>();

  // Group files by type
  files.forEach((file) => {
    const category = getFileCategory(file.extension || 'other');
    if (!typeMap.has(category)) {
      typeMap.set(category, []);
    }
    typeMap.get(category)!.push(file);
  });

  const operations: FileOperationItem[] = [];

  for (const [category, categoryFiles] of typeMap.entries()) {
    const targetDir = await join(rootPath, category);
    
    for (const file of categoryFiles) {
      const fileName = await basename(file.path);
      const targetPath = await join(targetDir, fileName);

      // Normalize paths for comparison
      const sourceNormalized = file.path.replace(/\\/g, '/').toLowerCase();
      const targetNormalized = targetPath.replace(/\\/g, '/').toLowerCase();
      
      // Skip if file is already in the target location
      if (sourceNormalized === targetNormalized) {
        continue;
      }

      // Check if target path would be inside source path (would cause error)
      if (targetNormalized.startsWith(sourceNormalized + '/')) {
        console.warn(`Skipping ${file.path}: target would be inside source directory`);
        continue;
      }
      
      operations.push({
        sourcePath: file.path,
        targetPath,
        action: 'move',
        reason: `Organizing by type: ${category}`,
      });
    }
  }

  return operations;
}

/**
 * Organizes files by creation/modification date.
 */
async function organizeByDate(
  files: FileInfo[],
  rootPath: string,
  dateFormat: 'year-month' | 'quarter' | 'year' | 'custom'
): Promise<FileOperationItem[]> {
  const operations: FileOperationItem[] = [];

  for (const file of files) {
    const date = file.created || file.modified || new Date();
    let folderName: string;

    switch (dateFormat) {
      case 'year':
        folderName = date.getFullYear().toString();
        break;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        folderName = `${date.getFullYear()}/Q${quarter}`;
        break;
      case 'year-month':
      default:
        const month = String(date.getMonth() + 1).padStart(2, '0');
        folderName = `${date.getFullYear()}-${month}`;
        break;
    }

    const targetDir = await join(rootPath, folderName);
    const fileName = basename(file.path);
    const targetPath = await join(targetDir, fileName);

    operations.push({
      sourcePath: file.path,
      targetPath,
      action: 'move',
      reason: `Organizing by date: ${folderName}`,
    });
  }

  return operations;
}

/**
 * Organizes files by detected project names.
 */
async function organizeByProject(files: FileInfo[], rootPath: string): Promise<FileOperationItem[]> {
  const projectMap = new Map<string, FileInfo[]>();

  // Detect projects from file names
  files.forEach((file) => {
    const projectName = detectProjectName(file.name);
    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, []);
    }
    projectMap.get(projectName)!.push(file);
  });

  const operations: FileOperationItem[] = [];

  for (const [projectName, projectFiles] of projectMap.entries()) {
    const targetDir = await join(rootPath, projectName);

    for (const file of projectFiles) {
      const fileName = basename(file.path);
      const targetPath = await join(targetDir, fileName);

      operations.push({
        sourcePath: file.path,
        targetPath,
        action: 'move',
        reason: `Organizing by project: ${projectName}`,
      });
    }
  }

  return operations;
}

/**
 * Organizes files by size categories.
 */
async function organizeBySize(
  files: FileInfo[],
  rootPath: string,
  thresholds?: { small: number; medium: number; large: number }
): Promise<FileOperationItem[]> {
  const defaultThresholds = {
    small: 1024 * 1024, // 1MB
    medium: 10 * 1024 * 1024, // 10MB
    large: 100 * 1024 * 1024, // 100MB
  };

  const { small, medium, large } = thresholds || defaultThresholds;
  const operations: FileOperationItem[] = [];

  for (const file of files) {
    let category: string;
    if (file.size < small) {
      category = 'Small';
    } else if (file.size < medium) {
      category = 'Medium';
    } else if (file.size < large) {
      category = 'Large';
    } else {
      category = 'Very Large';
    }

    const targetDir = await join(rootPath, category);
    const fileName = basename(file.path);
    const targetPath = await join(targetDir, fileName);

    operations.push({
      sourcePath: file.path,
      targetPath,
      action: 'move',
      reason: `Organizing by size: ${category}`,
    });
  }

  return operations;
}

/**
 * Categorizes file extensions into common groups.
 */
function getFileCategory(extension: string): string {
  const categories: Record<string, string[]> = {
    'Documents': ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'],
    'Images': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'heic'],
    'Videos': ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v'],
    'Audio': ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'],
    'Archives': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
    'Code': ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs'],
    'Data': ['csv', 'json', 'xml', 'xlsx', 'xls', 'db', 'sql', 'sqlite'],
    'Other': [],
  };

  for (const [category, exts] of Object.entries(categories)) {
    if (exts.includes(extension.toLowerCase())) {
      return category;
    }
  }

  return 'Other';
}

/**
 * Detects project name from file name patterns.
 */
function detectProjectName(fileName: string): string {
  // Common patterns: project_name_file.ext, ProjectName_file.ext, etc.
  const parts = fileName.split(/[-_\s]/);
  if (parts.length > 1) {
    // Use first part as project name
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  }
  return 'Misc';
}

/**
 * Collects all files from a directory recursively.
 */
async function collectFiles(
  currentPath: string,
  files: FileInfo[],
  rootPath: string
): Promise<void> {
  try {
    const entries = await readDir(currentPath);

    // If directory is empty, return early
    if (entries.length === 0) {
      return;
    }

    for (const entry of entries) {
      try {
        const entryPath = await join(currentPath, entry.name);

        if (entry.isDirectory) {
          // Skip hidden directories and system directories
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '.git') {
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
          } catch (error: any) {
            // Skip files we can't access (permissions, etc.)
            console.warn(`Cannot access file: ${entryPath}`, error.message || error);
          }
        }
      } catch (error: any) {
        // Skip entries we can't process
        console.warn(`Cannot process entry: ${entry.name}`, error.message || error);
      }
    }
  } catch (error: any) {
    // Re-throw if it's the root directory (should not fail silently)
    if (currentPath === rootPath) {
      throw new Error(`Cannot read directory ${currentPath}: ${error.message || 'Unknown error'}`);
    }
    // For subdirectories, just log and continue
    console.warn(`Error reading directory ${currentPath}:`, error.message || error);
  }
}

/**
 * Generates a preview of the file structure before and after.
 */
function generatePreview(
  files: FileInfo[],
  operations: FileOperationItem[]
): { before: any; after: any } {
  // Simplified preview structure
  const before: any = {};
  const after: any = {};

  files.forEach((file) => {
    before[file.path] = { type: 'file', size: file.size };
  });

  operations.forEach((op) => {
    if (op.targetPath) {
      after[op.targetPath] = { type: 'file' };
    }
  });

  return { before, after };
}

/**
 * Generates a description for the operation.
 */
function generateDescription(config: OrganizationConfig, fileCount: number): string {
  const strategyNames: Record<string, string> = {
    'by-type': 'by file type',
    'by-date': 'by date',
    'by-project': 'by project',
    'by-size': 'by file size',
  };

  return `Organize ${fileCount} files ${strategyNames[config.strategy] || 'automatically'}`;
}
