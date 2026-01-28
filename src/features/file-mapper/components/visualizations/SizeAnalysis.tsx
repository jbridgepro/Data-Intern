/**
 * File: src/features/file-mapper/components/visualizations/SizeAnalysis.tsx
 *
 * Frontend component for Size Distribution Analysis
 * Dashboard-style view with Glassmorphism UI and optimized Recharts
 * Updated with Context Menus for Charts
 */

import React, { useMemo, useState, useEffect } from "react";
import { FileSystemNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import {
  formatFileSize,
  getTotalSize,
  getTotalFileCount,
  getTotalFolderCount
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
  ResponsiveContainer
} from "recharts";
import { 
    HardDrive, 
    File, 
    Folder, 
    PieChart as PieIcon,
    BarChart3,
    Copy,
    FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

interface SizeAnalysisProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

// Tech-themed palette
const COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#6366f1", // Indigo
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl text-xs">
          <p className="font-semibold mb-1 text-slate-700 dark:text-slate-200">{label || payload[0].name}</p>
          <p className="text-blue-600 dark:text-blue-400">
             {payload[0].name}: <span className="font-mono">{typeof payload[0].value === 'number' && payload[0].value > 10000 ? formatFileSize(payload[0].value) : payload[0].value}</span>
          </p>
          {payload[0].payload.count !== undefined && (
             <p className="text-slate-500 mt-1">Count: {payload[0].payload.count}</p>
          )}
        </div>
      );
    }
    return null;
};

interface ContextMenuState {
    x: number;
    y: number;
    item: { name: string; path: string };
}

export function SizeAnalysis({ data, config }: SizeAnalysisProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
        if (contextMenu) setContextMenu(null);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu]);

  // Memoize heavy calculations
  const { fileTypeStats, topFiles, topFolders, summaryStats } = useMemo(() => {
     const stats: Record<string, { count: number; totalSize: number }> = {};
     const files: Array<{ name: string; path: string; size: number }> = [];
     const folders: Array<{ name: string; path: string; size: number }> = [];
     
     const totalSize = getTotalSize(data);
     const totalFiles = getTotalFileCount(data);
     const totalFolders = getTotalFolderCount(data);

     const processNode = (node: FileSystemNode) => {
        if (!node.isDirectory) {
            const ext = node.extension ? node.extension.toLowerCase() : "unknown";
            if (!stats[ext]) stats[ext] = { count: 0, totalSize: 0 };
            stats[ext].count++;
            stats[ext].totalSize += node.size;
            
            files.push({ name: node.name, path: node.path, size: node.size });
        } else {
            const size = getTotalSize(node);
            folders.push({ name: node.name, path: node.path, size });
            
            if (node.children) node.children.forEach(processNode);
        }
     };

     if (data.children) data.children.forEach(processNode);
     
     // Top 10 Files
     files.sort((a,b) => b.size - a.size);
     
     // Top 10 Folders
     folders.sort((a,b) => b.size - a.size);
     
     // Prepare Chart Data
     const pieData = Object.entries(stats)
        .map(([name, s]) => ({ name: `.${name}`, value: s.totalSize, count: s.count })) 
        .sort((a,b) => b.value - a.value)
        .slice(0, 8); 
     
     return {
         fileTypeStats: pieData,
         topFiles: files.slice(0, 10).map(f => ({ ...f, sizeFormatted: formatFileSize(f.size) })),
         topFolders: folders.slice(0, 10).map(f => ({ ...f, sizeFormatted: formatFileSize(f.size) })),
         summaryStats: { totalSize, totalFiles, totalFolders }
     };
  }, [data]);

  const handleContextMenu = (e: any, item: { name: string; path: string }) => {
      // Recharts event usually provides pure event or synthesized event.
      // We need clientX/Y.
      e.preventDefault();
      
      // Recharts event object structure might vary. 
      // If triggered from Cell, 'e' is the event, or the second arg is index?
      // Recharts 'onClick' signature: (data, index, event) => void
      // BUT for native DOM event handlers passed to components, it depends.
      // Let's use standard onContextMenu on the Cell.
      
      // If e is a React SyntheticEvent or native:
      const clientX = e.clientX || (e.nativeEvent ? e.nativeEvent.clientX : 0);
      const clientY = e.clientY || (e.nativeEvent ? e.nativeEvent.clientY : 0);
      
      setContextMenu({
          x: clientX,
          y: clientY,
          item
      });
  };

  const handleCopyPath = async () => {
    if (contextMenu) {
      try {
        await navigator.clipboard.writeText(contextMenu.item.path);
      } catch (err) {
        console.error("Failed to copy path:", err);
      }
      setContextMenu(null);
    }
  };

  const handleRevealInExplorer = async () => {
    if (contextMenu) {
      try {
        await revealItemInDir(contextMenu.item.path);
      } catch (err) {
        console.error("Failed to reveal item:", err);
      }
      setContextMenu(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20">
      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        
        {/* Header Stats Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Total Size Card */}
             <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm flex items-center gap-4 group hover:border-blue-500/30 transition-colors">
                <div className="p-3 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform">
                   <HardDrive className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                   <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Storage</p>
                   <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatFileSize(summaryStats.totalSize)}</h3>
                </div>
             </div>

             {/* Total Files Card */}
             <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm flex items-center gap-4 group hover:border-emerald-500/30 transition-colors">
                <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:scale-110 transition-transform">
                   <File className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                   <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Files</p>
                   <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{summaryStats.totalFiles.toLocaleString()}</h3>
                </div>
             </div>

             {/* Total Folders Card */}
             <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm flex items-center gap-4 group hover:border-violet-500/30 transition-colors">
                <div className="p-3 bg-violet-500/10 rounded-lg group-hover:scale-110 transition-transform">
                   <Folder className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                   <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Folders</p>
                   <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{summaryStats.totalFolders.toLocaleString()}</h3>
                </div>
             </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* File Types Pie */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                    <PieIcon className="h-5 w-5 text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Storage Distribution</h3>
                </div>
                <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                             <Pie
                                data={fileTypeStats}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {fileTypeStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                                verticalAlign="middle" 
                                align="right" 
                                layout="vertical"
                                type="circle"
                                iconSize={8}
                                wrapperStyle={{ fontSize: '12px', opacity: 0.8 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Files Bar */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="h-5 w-5 text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Largest Files</h3>
                </div>
                <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={topFiles}
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={120} 
                                tick={{ fontSize: 11, fill: '#94a3b8' }} 
                                tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="size" barSize={12} radius={[0, 4, 4, 0]}>
                                {topFiles.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={COLORS[index % COLORS.length]} 
                                        fillOpacity={0.8}
                                        className="cursor-context-menu hover:fill-opacity-100 transition-opacity"
                                        onContextMenu={(e) => handleContextMenu(e, entry)}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            {/* Folder Sizes Bar (Full Width) */}
            <div className="lg:col-span-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                    <Folder className="h-5 w-5 text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Largest Folders</h3>
                </div>
                <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart
                            data={topFolders}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickFormatter={(val) => val.length > 20 ? val.substring(0, 20) + '...' : val}
                            />
                            <YAxis 
                                tickFormatter={(val) => formatFileSize(val)} 
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="size" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} fillOpacity={0.8}>
                                {topFolders.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`} 
                                        fill="#3b82f6" 
                                        fillOpacity={0.8}
                                        className="cursor-context-menu hover:fill-opacity-100 transition-opacity"
                                        onContextMenu={(e) => handleContextMenu(e, entry)}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                className="fixed z-50 min-w-[180px] bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 py-1.5"
                style={{ 
                    top: contextMenu.y, 
                    left: contextMenu.x 
                }}
                onClick={(e) => e.stopPropagation()}
                >
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50 mb-1 max-w-[200px] truncate">
                    {contextMenu.item.name}
                </div>
                <button
                    onClick={handleCopyPath}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-left transition-colors"
                >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Path
                </button>
                <button
                    onClick={handleRevealInExplorer}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-left transition-colors"
                >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Reveal in Explorer
                </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
