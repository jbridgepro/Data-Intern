/**
 * File: src/features/file-mapper/components/StatisticsPanel.tsx
 *
 * Frontend component for displaying directory statistics
 */

import { FileSystemNode } from "../utils/fileSystemScanner";
import {
  formatFileSize,
  getTotalSize,
  getTotalFileCount,
  getTotalFolderCount,
} from "../utils/fileSystemScanner";
import { BarChart3, File, Folder, HardDrive, TrendingUp } from "lucide-react";

interface StatisticsPanelProps {
  data: FileSystemNode;
  statistics: {
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
  };
}

export function StatisticsPanel({ data, statistics }: StatisticsPanelProps) {
  // Calculate file type distribution
  const fileTypeStats: Record<string, { count: number; totalSize: number }> =
    {};
  const largestFiles: Array<{ name: string; path: string; size: number }> = [];
  const folderSizes: Array<{ name: string; size: number; fileCount: number }> =
    [];

  const collectStats = (node: FileSystemNode) => {
    if (!node.isDirectory) {
      const ext = node.extension || "no extension";
      if (!fileTypeStats[ext]) {
        fileTypeStats[ext] = { count: 0, totalSize: 0 };
      }
      fileTypeStats[ext].count++;
      fileTypeStats[ext].totalSize += node.size;

      largestFiles.push({
        name: node.name,
        path: node.path,
        size: node.size,
      });
    } else {
      const folderSize = getTotalSize(node);
      const fileCount = getTotalFileCount(node);
      folderSizes.push({
        name: node.name,
        size: folderSize,
        fileCount,
      });

      if (node.children) {
        node.children.forEach(collectStats);
      }
    }
  };

  collectStats(data);

  // Sort and get top items
  largestFiles.sort((a, b) => b.size - a.size);
  const top5Files = largestFiles.slice(0, 5);

  folderSizes.sort((a, b) => b.size - a.size);
  const top5Folders = folderSizes.slice(0, 5);

  const fileTypeEntries = Object.entries(fileTypeStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 6);

  const maxDepth = getMaxDepth(data);
  const avgFileSize =
    statistics.totalFiles > 0
      ? statistics.totalSize / statistics.totalFiles
      : 0;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
          📊 Directory Statistics
        </h3>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <File className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Total Files
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            {statistics.totalFiles.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Folder className="h-4 w-4 text-green-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Total Folders
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            {statistics.totalFolders.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-purple-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Total Size
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            {formatFileSize(statistics.totalSize)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Max Depth
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            {maxDepth}
          </div>
        </div>
      </div>

      {/* File Types Distribution */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
          File Types Distribution
        </h4>
        <div className="space-y-2">
          {fileTypeEntries.map(({ name, count, totalSize }) => (
            <div
              key={name}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-600 dark:text-slate-400">
                {name || "no extension"}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-slate-500 dark:text-slate-500">
                  {count} files
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {formatFileSize(totalSize)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Largest Files */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Largest Files (Top 5)
        </h4>
        <div className="space-y-2">
          {top5Files.map((file, index) => (
            <div
              key={file.path}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-600 dark:text-slate-400 truncate flex-1 mr-2">
                {index + 1}. {file.name}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatFileSize(file.size)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Largest Folders */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Largest Folders (Top 5)
        </h4>
        <div className="space-y-2">
          {top5Folders.map((folder, index) => (
            <div
              key={folder.name}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-600 dark:text-slate-400 truncate flex-1 mr-2">
                {index + 1}. {folder.name} ({folder.fileCount} files)
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formatFileSize(folder.size)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getMaxDepth(node: FileSystemNode): number {
  if (!node.children || node.children.length === 0) {
    return node.depth;
  }
  return Math.max(...node.children.map((child) => getMaxDepth(child)));
}
