/**
 * File: src/features/file-mapper/types.ts
 * 
 * Type definitions for the File Mapper feature
 */

import { FileSystemNode } from "./utils/fileSystemScanner";

// Visualization style types
export type VisualizationStyle =
  | "tree"
  | "sunburst"
  | "treemap"
  | "network"
  | "indented"
  | "mindmap"
  | "directory"
  | "size-analysis";

// Export format types
export type ExportFormat =
  | "png"
  | "svg"
  | "pdf"
  | "html"
  | "text"
  | "markdown"
  | "json"
  | "csv";

// Configuration for visualizations
export interface VisualizationConfig {
  style: VisualizationStyle;
  showFileSizes: boolean;
  showFileCounts: boolean;
  showPercentages: boolean;
  colorBy: "type" | "age" | "size";
  maxDepth: number;
  minSegmentSize?: number; // for sunburst/treemap
  layoutAlgorithm?: "force" | "hierarchical" | "radial" | "grid"; // for network
  lineStyle?: "ascii" | "unicode" | "minimal"; // for tree
  iconStyle?: "emoji" | "ascii" | "none"; // for tree
}

// Export configuration
export interface ExportConfig {
  format: ExportFormat;
  includeLegend: boolean;
  includeStatistics: boolean;
  includeTimestamp: boolean;
  includeSourcePath: boolean;
  includeFullPaths: boolean;
  includeMetadata: boolean;
  resolution?: { width: number; height: number };
  pageSize?: "A4" | "Letter";
  orientation?: "landscape" | "portrait";
}

// Statistics summary
export interface DirectoryStatistics {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  maxDepth: number;
  fileTypes: Record<string, { count: number; totalSize: number }>;
  largestFiles: Array<{ name: string; path: string; size: number }>;
  oldestFiles: Array<{ name: string; path: string; date: Date }>;
  newestFiles: Array<{ name: string; path: string; date: Date }>;
}
