/**
 * File: src/features/file-mapper/components/visualizations/IndentedList.tsx
 *
 * Frontend component for Indented List visualization
 * Clean, exportable text format perfect for documentation
 */

import { FileSystemNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import { formatFileSize } from "../../utils/fileSystemScanner";

interface IndentedListProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

export function IndentedList({ data, config }: IndentedListProps) {
  const renderNode = (
    node: FileSystemNode,
    indent: number = 0,
  ): JSX.Element => {
    const indentStr = "  ".repeat(indent);

    return (
      <div key={node.path}>
        <div className="py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2">
          <span className="text-slate-700 dark:text-slate-200 font-mono">
            {indentStr}
            {node.name}
            {config.showFileSizes && !node.isDirectory && (
              <span className="text-slate-500 dark:text-slate-400 ml-2 text-xs">
                ({formatFileSize(node.size)})
              </span>
            )}
          </span>
        </div>
        {node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => renderNode(child, indent + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto p-6 bg-white dark:bg-slate-900 rounded-lg">
      <div className="max-w-3xl mx-auto font-mono text-sm">
        {renderNode(data)}
      </div>
    </div>
  );
}
