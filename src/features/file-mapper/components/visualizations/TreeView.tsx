/**
 * File: src/features/file-mapper/components/visualizations/TreeView.tsx
 *
 * Frontend component for Tree View visualization
 * Displays hierarchical structure with ASCII/Unicode tree lines
 */

import { FileSystemNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import { formatFileSize } from "../../utils/fileSystemScanner";
import React from "react";
import { Folder, File } from "lucide-react";

interface TreeViewProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

export function TreeView({ data, config }: TreeViewProps) {
  const renderNode = (
    node: FileSystemNode,
    prefix: string = "",
    isLast: boolean = true,
    isRoot: boolean = true,
  ): React.JSX.Element => {
    const connector = isRoot ? "" : isLast ? "└── " : "├── ";
    const nextPrefix = isRoot ? "" : isLast ? "    " : "│   ";

    const icon = node.isDirectory ? (
      config.iconStyle === "emoji" ? (
        "📁"
      ) : config.iconStyle === "ascii" ? (
        "[DIR]"
      ) : (
        <Folder className="inline h-4 w-4" />
      )
    ) : config.iconStyle === "emoji" ? (
      "📄"
    ) : config.iconStyle === "ascii" ? (
      "[FILE]"
    ) : (
      <File className="inline h-4 w-4" />
    );

    const sizeInfo =
      config.showFileSizes && !node.isDirectory
        ? ` (${formatFileSize(node.size)})`
        : "";

    const countInfo =
      config.showFileCounts && node.isDirectory
        ? ` [${node.fileCount || 0} files, ${node.folderCount || 0} folders]`
        : "";

    return (
      <div key={node.path} className="font-mono text-sm">
        <div className="flex items-center gap-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2">
          <span className="text-slate-500 dark:text-slate-400">
            {prefix + connector}
          </span>
          <span className="text-slate-700 dark:text-slate-200">{icon}</span>
          <span className="text-slate-700 dark:text-slate-200 font-medium">
            {node.name}
          </span>
          {sizeInfo && (
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              {sizeInfo}
            </span>
          )}
          {countInfo && (
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              {countInfo}
            </span>
          )}
        </div>
        {node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child, index) =>
              renderNode(
                child,
                prefix + nextPrefix,
                index === node.children!.length - 1,
                false,
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto p-6 bg-white dark:bg-slate-900 rounded-lg">
      <div className="max-w-4xl mx-auto">
        {renderNode(data, "", true, true)}
      </div>
    </div>
  );
}
