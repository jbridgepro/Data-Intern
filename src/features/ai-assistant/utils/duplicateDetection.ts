/**
 * File: src/features/ai-assistant/utils/duplicateDetection.ts
 * 
 * Utilities for detecting duplicate files by hash and name patterns.
 */

import { readDir, stat, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { DuplicateAnalysis, DuplicateGroup, FileInfo } from '../types';

/**
 * Finds duplicate files in a directory.
 */
export async function findDuplicateFiles(path: string): Promise<DuplicateAnalysis> {
  const files: FileInfo[] = [];
  await collectFiles(path, files, path);

  // Group by size first (quick filter)
  const sizeGroups = new Map<number, FileInfo[]>();
  files.forEach((file) => {
    if (!sizeGroups.has(file.size)) {
      sizeGroups.set(file.size, []);
    }
    sizeGroups.get(file.size)!.push(file);
  });

  // Only check files with same size (potential duplicates)
  const potentialDuplicates: FileInfo[][] = Array.from(sizeGroups.values())
    .filter(group => group.length > 1);

  // For small groups, compute hashes
  const duplicateGroups: DuplicateGroup[] = [];
  let totalWastedSpace = 0;

  for (const group of potentialDuplicates) {
    if (group.length <= 10) {
      // Small group - compute full hashes
      const hashGroups = await groupByHash(group);
      for (const hashGroup of hashGroups) {
        if (hashGroup.files.length > 1) {
          duplicateGroups.push({
            id: `dup-${Date.now()}-${Math.random()}`,
            files: hashGroup.files,
            size: hashGroup.files[0].size,
            hash: hashGroup.hash,
          });
          // Calculate wasted space (all duplicates except one)
          totalWastedSpace += hashGroup.files[0].size * (hashGroup.files.length - 1);
        }
      }
    } else {
      // Large group - use name-based detection
      const nameGroups = groupByNamePattern(group);
      for (const nameGroup of nameGroups) {
        if (nameGroup.length > 1) {
          duplicateGroups.push({
            id: `dup-${Date.now()}-${Math.random()}`,
            files: nameGroup,
            size: nameGroup[0].size,
          });
          totalWastedSpace += nameGroup[0].size * (nameGroup.length - 1);
        }
      }
    }
  }

  const summary = generateDuplicateSummary(duplicateGroups, totalWastedSpace);

  return {
    totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.files.length, 0),
    duplicateGroups,
    totalWastedSpace,
    summary,
  };
}

/**
 * Groups files by their hash (for exact duplicates).
 */
async function groupByHash(files: FileInfo[]): Promise<Array<{ hash: string; files: FileInfo[] }>> {
  const hashMap = new Map<string, FileInfo[]>();

  for (const file of files) {
    try {
      // Simple hash based on file content (first 1KB for speed)
      const hash = await computeFileHash(file.path);
      if (!hashMap.has(hash)) {
        hashMap.set(hash, []);
      }
      hashMap.get(hash)!.push(file);
    } catch (error) {
      console.warn(`Cannot hash file: ${file.path}`, error);
    }
  }

  return Array.from(hashMap.entries()).map(([hash, files]) => ({ hash, files }));
}

/**
 * Computes a simple hash of a file (first 1KB for performance).
 * Uses text-based reading for simplicity - works for most file types.
 */
async function computeFileHash(filePath: string): Promise<string> {
  try {
    // Read file content (limit to first 1KB for performance)
    const content = await readTextFile(filePath);
    const sample = content.substring(0, 1024); // Take first 1KB
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      hash = ((hash << 5) - hash) + sample.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  } catch (error) {
    // Fallback to path-based hash for binary files or errors
    return filePath.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0).toString(36);
  }
}

/**
 * Groups files by name patterns (for similar/near-duplicates).
 */
function groupByNamePattern(files: FileInfo[]): FileInfo[][] {
  const groups: FileInfo[][] = [];
  const processed = new Set<string>();

  files.forEach((file) => {
    if (processed.has(file.path)) return;

    const group: FileInfo[] = [file];
    const baseName = normalizeFileName(file.name);

    files.forEach((otherFile) => {
      if (otherFile.path !== file.path && !processed.has(otherFile.path)) {
        const otherBaseName = normalizeFileName(otherFile.name);
        if (areSimilarNames(baseName, otherBaseName)) {
          group.push(otherFile);
          processed.add(otherFile.path);
        }
      }
    });

    if (group.length > 1) {
      groups.push(group);
      processed.add(file.path);
    }
  });

  return groups;
}

/**
 * Normalizes file names for comparison.
 */
function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

/**
 * Checks if two file names are similar.
 */
function areSimilarNames(name1: string, name2: string): boolean {
  // Exact match
  if (name1 === name2) return true;

  // Check for common patterns: file (1).ext, file copy.ext, file - Copy.ext
  const patterns = [
    /copy/i,
    /\(1\)/,
    /\(2\)/,
    /- copy/i,
    /_copy/i,
  ];

  const base1 = name1.replace(/\([0-9]+\)|copy|_copy|- copy/gi, '').trim();
  const base2 = name2.replace(/\([0-9]+\)|copy|_copy|- copy/gi, '').trim();

  return base1 === base2;
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
 * Generates a summary of duplicate findings.
 */
function generateDuplicateSummary(
  duplicateGroups: DuplicateGroup[],
  totalWastedSpace: number
): string {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.files.length, 0);

  let summary = `Found ${duplicateGroups.length} duplicate groups with ${totalDuplicates} files total.\n\n`;
  summary += `**Potential space savings:** ${formatSize(totalWastedSpace)}\n\n`;

  if (duplicateGroups.length > 0) {
    summary += `**Top duplicate groups:**\n`;
    duplicateGroups.slice(0, 5).forEach((group, index) => {
      summary += `${index + 1}. ${group.files[0].name} (${group.files.length} copies, ${formatSize(group.size)} each)\n`;
    });
  }

  return summary;
}
