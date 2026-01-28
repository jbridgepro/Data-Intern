/**
 * File: src/features/file-mapper/components/VisualizationRenderer.tsx
 *
 * Frontend component that renders different visualization styles
 * based on the selected visualization type.
 */

import { FileSystemNode } from "../utils/fileSystemScanner";
import { VisualizationStyle, VisualizationConfig } from "../types";
import { TreeView } from "./visualizations/TreeView";
import { NetworkGraph } from "./visualizations/NetworkGraph";
import { IndentedList } from "./visualizations/IndentedList";
import { MindMap } from "./visualizations/MindMap";
import { DirectoryChart } from "./visualizations/DirectoryChart";
import { SizeAnalysis } from "./visualizations/SizeAnalysis";

interface VisualizationRendererProps {
  data: FileSystemNode | null;
  style: VisualizationStyle;
  config: VisualizationConfig;
  onRefresh?: () => void;
}

export function VisualizationRenderer({
  data,
  style,
  config,
  onRefresh,
}: VisualizationRendererProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p>No data to visualize. Please select a folder and generate a map.</p>
      </div>
    );
  }

  switch (style) {
    case "tree":
      return <TreeView data={data} config={config} onRefresh={onRefresh} />;
    case "network":
      return <NetworkGraph data={data} config={config} />;
    case "indented":
      return <IndentedList data={data} config={config} />;
    case "mindmap":
      return <MindMap data={data} config={config} />;
    case "directory":
      return <DirectoryChart data={data} config={config} />;
    case "size-analysis":
      return <SizeAnalysis data={data} config={config} />;
    default:
      return <TreeView data={data} config={config} onRefresh={onRefresh} />;
  }
}
