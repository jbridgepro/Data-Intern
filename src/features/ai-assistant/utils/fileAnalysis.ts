/**
 * File: src/features/ai-assistant/utils/fileAnalysis.ts
 * 
 * Utilities for analyzing directory contents, file patterns, and storage usage.
 */

import { readDir, stat } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { DirectoryAnalysis, FileInfo, FileTypeBreakdown } from '../types';

/**
 * Analyzes a directory and returns comprehensive statistics and insights.
 */
export async function analyzeDirectoryFiles(path: string): Promise<DirectoryAnalysis> {
  const files: FileInfo[] = [];
  let totalSize = 0;

  // Recursively collect all files
  await collectFiles(path, files, path);

  // Calculate total size
  totalSize = files.reduce((sum, file) => sum + file.size, 0);

  // Group by file type
  const fileTypes = groupByFileType(files, totalSize);

  // Find largest files
  const largestFiles = [...files]
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  // Find oldest and newest files
  const filesWithDates = files.filter(f => f.created || f.modified);
  const oldestFiles = [...filesWithDates]
    .sort((a, b) => {
      const dateA = a.created || a.modified || new Date(0);
      const dateB = b.created || b.modified || new Date(0);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 10);

  const newestFiles = [...filesWithDates]
    .sort((a, b) => {
      const dateA = a.created || a.modified || new Date(0);
      const dateB = b.created || b.modified || new Date(0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 10);

  // Calculate organization score
  const organizationScore = calculateOrganizationScore(files, path);

  // Generate summary
  const summary = generateAnalysisSummary({
    totalFiles: files.length,
    totalSize,
    fileTypes,
    largestFiles,
    organizationScore,
  });

  return {
    totalFiles: files.length,
    totalSize,
    fileTypes,
    largestFiles,
    oldestFiles,
    newestFiles,
    summary,
    organizationScore,
  };
}

/**
 * Recursively collects all files from a directory.
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
        // Skip hidden/system directories
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
          // Skip files we can't access
          console.warn(`Cannot access file: ${entryPath}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${currentPath}:`, error);
  }
}

/**
 * Groups files by extension and calculates statistics.
 */
function groupByFileType(files: FileInfo[], totalSize: number): FileTypeBreakdown[] {
  const typeMap = new Map<string, { count: number; size: number }>();

  files.forEach((file) => {
    const ext = file.extension || 'no-extension';
    const current = typeMap.get(ext) || { count: 0, size: 0 };
    typeMap.set(ext, {
      count: current.count + 1,
      size: current.size + file.size,
    });
  });

  return Array.from(typeMap.entries())
    .map(([extension, data]) => ({
      extension,
      count: data.count,
      totalSize: data.size,
      percentage: totalSize > 0 ? (data.size / totalSize) * 100 : 0,
    }))
    .sort((a, b) => b.totalSize - a.totalSize);
}

/**
 * Calculates an organization score (0-100) based on file structure.
 */
function calculateOrganizationScore(files: FileInfo[], rootPath: string): number {
  if (files.length === 0) return 100;

  let score = 100;

  // Penalize if too many files in root
  const rootFiles = files.filter(f => {
    const relativePath = f.path.replace(rootPath, '').replace(/^[\/\\]/, '');
    return !relativePath.includes('/') && !relativePath.includes('\\');
  });
  const rootFileRatio = rootFiles.length / files.length;
  if (rootFileRatio > 0.5) {
    score -= 30; // Too many files in root
  } else if (rootFileRatio > 0.3) {
    score -= 15;
  }

  // Check for consistent naming patterns
  const hasConsistentNaming = checkNamingConsistency(files);
  if (!hasConsistentNaming) {
    score -= 20;
  }

  // Check for organized folder structure
  const folderDepth = calculateAverageDepth(files, rootPath);
  if (folderDepth < 1) {
    score -= 25; // Everything in root
  }

  return Math.max(0, Math.min(100, score));
}

function checkNamingConsistency(files: FileInfo[]): boolean {
  if (files.length < 3) return true;

  // Check if files follow similar naming patterns
  const patterns = files.map(f => {
    const name = f.name.toLowerCase();
    // Check for common patterns: date prefixes, consistent separators, etc.
    return {
      hasDate: /\d{4}[-_]\d{2}[-_]\d{2}/.test(name),
      hasUnderscores: name.includes('_'),
      hasDashes: name.includes('-'),
      hasSpaces: name.includes(' '),
    };
  });

  const hasDateCount = patterns.filter(p => p.hasDate).length;
  const hasUnderscoreCount = patterns.filter(p => p.hasUnderscores).length;
  const hasDashCount = patterns.filter(p => p.hasDashes).length;

  // If >50% follow a pattern, consider it consistent
  const total = files.length;
  return (
    hasDateCount / total > 0.5 ||
    hasUnderscoreCount / total > 0.5 ||
    hasDashCount / total > 0.5
  );
}

function calculateAverageDepth(files: FileInfo[], rootPath: string): number {
  if (files.length === 0) return 0;

  const depths = files.map(f => {
    const relativePath = f.path.replace(rootPath, '').replace(/^[\/\\]/, '');
    const depth = (relativePath.match(/[\/\\]/g) || []).length;
    return depth;
  });

  return depths.reduce((sum, d) => sum + d, 0) / depths.length;
}

/**
 * Generates a human-readable summary of the analysis.
 */
function generateAnalysisSummary(data: {
  totalFiles: number;
  totalSize: number;
  fileTypes: FileTypeBreakdown[];
  largestFiles: FileInfo[];
  organizationScore: number;
}): string {
  const { totalFiles, totalSize, fileTypes, largestFiles, organizationScore } = data;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  let summary = `I analyzed ${totalFiles} files (${formatSize(totalSize)} total).\n\n`;

  // Top file types
  const topTypes = fileTypes.slice(0, 5);
  summary += `**File Types:**\n`;
  topTypes.forEach((type) => {
    summary += `• ${type.count} ${type.extension} files (${formatSize(type.totalSize)}, ${type.percentage.toFixed(1)}%)\n`;
  });

  // Largest files
  if (largestFiles.length > 0) {
    summary += `\n**Largest Files:**\n`;
    largestFiles.slice(0, 5).forEach((file) => {
      summary += `• ${file.name} (${formatSize(file.size)})\n`;
    });
  }

  // Organization score
  summary += `\n**Organization Score:** ${organizationScore}/100\n`;
  if (organizationScore < 50) {
    summary += `This folder could benefit from better organization. I can help organize it!`;
  } else if (organizationScore < 75) {
    summary += `The folder is somewhat organized, but there's room for improvement.`;
  } else {
    summary += `The folder is well-organized!`;
  }

  return summary;
}
