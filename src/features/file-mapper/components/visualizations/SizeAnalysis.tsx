/**
 * File: src/features/file-mapper/components/visualizations/SizeAnalysis.tsx
 *
 * Frontend component for Size Distribution Analysis
 * Shows pie charts, bar charts, and folder comparisons
 */

import { FileSystemNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import {
  formatFileSize,
  getTotalSize,
  getTotalFileCount,
} from "../../utils/fileSystemScanner";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SizeAnalysisProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

export function SizeAnalysis({ data, config }: SizeAnalysisProps) {
  // Collect file type statistics
  const fileTypeStats: Record<string, { count: number; totalSize: number }> =
    {};
  const largestFiles: Array<{ name: string; path: string; size: number }> = [];
  const folderSizes: Array<{ name: string; size: number }> = [];

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
      folderSizes.push({
        name: node.name,
        size: folderSize,
      });

      if (node.children) {
        node.children.forEach(collectStats);
      }
    }
  };

  collectStats(data);

  // Sort and prepare data
  largestFiles.sort((a, b) => b.size - a.size);
  const top10Files = largestFiles.slice(0, 10).map((f) => ({
    name: f.name.length > 30 ? f.name.substring(0, 30) + "..." : f.name,
    size: f.size,
    sizeFormatted: formatFileSize(f.size),
  }));

  folderSizes.sort((a, b) => b.size - a.size);
  const topFolders = folderSizes.slice(0, 10).map((f) => ({
    name: f.name.length > 30 ? f.name.substring(0, 30) + "..." : f.name,
    size: f.size,
    sizeFormatted: formatFileSize(f.size),
  }));

  const pieData = Object.entries(fileTypeStats)
    .map(([name, stats]) => ({
      name: name || "no extension",
      value: stats.totalSize,
      count: stats.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
  ];

  const totalSize = getTotalSize(data);
  const totalFiles = getTotalFileCount(data);

  return (
    <div className="h-full overflow-auto p-6 bg-white dark:bg-slate-900 rounded-lg">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="text-sm text-blue-600 dark:text-blue-400">
              Total Files
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {totalFiles}
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="text-sm text-green-600 dark:text-green-400">
              Total Size
            </div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {formatFileSize(totalSize)}
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="text-sm text-purple-600 dark:text-purple-400">
              File Types
            </div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {Object.keys(fileTypeStats).length}
            </div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <div className="text-sm text-orange-600 dark:text-orange-400">
              Folders
            </div>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {folderSizes.length}
            </div>
          </div>
        </div>

        {/* Pie Chart - By File Type */}
        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200">
            Storage by File Type
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatFileSize(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart - Top 10 Largest Files */}
        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200">
            Top 10 Largest Files
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top10Files} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(value) => formatFileSize(value)}
              />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip formatter={(value: number) => formatFileSize(value)} />
              <Bar dataKey="size" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Folder Size Comparison */}
        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200">
            Folder Size Comparison
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topFolders} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(value) => formatFileSize(value)}
              />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip formatter={(value: number) => formatFileSize(value)} />
              <Bar dataKey="size" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
