/**
 * File: src/features/file-mapper/components/visualizations/TreeView.tsx
 *
 * Frontend component for Tree View visualization
 * Displays hierarchical structure with ASCII/Unicode tree lines
 * Supports interactive expansion/collapse and context menu
 * Updated with Premium UI
 */

import React, { useState, useEffect, useRef } from "react";
import { FileSystemNode, moveNode, copyNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import { formatFileSize } from "../../utils/fileSystemScanner";
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  FolderOpen,
  Maximize2,
  Minimize2,
  GripVertical
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils"; // Assuming utils exists or I'll use inline classes if not sure, but FileMapper used it.

// Fallback for cn if not available (safe pattern)
function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

interface TreeViewProps {
  data: FileSystemNode;
  config: VisualizationConfig;
  onRefresh?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: FileSystemNode;
}

export function TreeView({ data, config, onRefresh }: TreeViewProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  
  // Helper to get all directory paths (recursive)
  const getAllPaths = (node: FileSystemNode): Set<string> => {
    const paths = new Set<string>();
    const traverse = (n: FileSystemNode) => {
      if (n.isDirectory) {
        paths.add(n.path);
        if (n.children) {
          n.children.forEach(traverse);
        }
      }
    };
    traverse(node);
    return paths;
  };

  // Initialize with all expanded when data changes (default behavior)
  useEffect(() => {
    setExpandedPaths(getAllPaths(data));
  }, [data]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu]);

  // Toggle expansion for a specific folder
  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const handleExpandAll = () => {
    setExpandedPaths(getAllPaths(data));
  };

  const handleCollapseAll = () => {
    // Only keep root expanded
    const rootPath = new Set<string>();
    if (data.isDirectory) rootPath.add(data.path);
    setExpandedPaths(rootPath);
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileSystemNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const handleCopyPath = async () => {
    if (contextMenu) {
      try {
        await navigator.clipboard.writeText(contextMenu.node.path);
      } catch (err) {
        console.error("Failed to copy path:", err);
      }
      setContextMenu(null);
    }
  };

  const handleRevealInExplorer = async () => {
    if (contextMenu) {
      try {
        await revealItemInDir(contextMenu.node.path);
      } catch (err) {
        console.error("Failed to reveal item:", err);
      }
      setContextMenu(null);
    }
  };

  const getVisiblePaths = (node: FileSystemNode, expanded: Set<string>): string[] => {
    const result: string[] = [];
    const traverse = (n: FileSystemNode) => {
      result.push(n.path);
      if (n.isDirectory && expanded.has(n.path) && n.children) {
        n.children.forEach(traverse);
      }
    };
    traverse(node);
    return result;
  };

  const handleNodeClick = (e: React.MouseEvent, node: FileSystemNode) => {
    e.stopPropagation(); // Prevent parent click
    
    // Check modifiers
    const isMultiSelect = e.metaKey || e.ctrlKey;
    const isRangeSelect = e.shiftKey;

    if (isRangeSelect && lastSelectedPath) {
      const visiblePaths = getVisiblePaths(data, expandedPaths);
      const startIdx = visiblePaths.indexOf(lastSelectedPath);
      const endIdx = visiblePaths.indexOf(node.path);
      
      if (startIdx !== -1 && endIdx !== -1) {
        const start = Math.min(startIdx, endIdx);
        const end = Math.max(startIdx, endIdx);
        const range = visiblePaths.slice(start, end + 1);
        
        // If meta key is pressed, add to selection, else replace
        const newSelected = isMultiSelect ? new Set<string>(selectedPaths) : new Set<string>();
        range.forEach(p => newSelected.add(p));
        setSelectedPaths(newSelected);
      }
    } else if (isMultiSelect) {
      const newSelected = new Set<string>(selectedPaths);
      if (newSelected.has(node.path)) {
        newSelected.delete(node.path);
      } else {
        newSelected.add(node.path);
        setLastSelectedPath(node.path);
      }
      setSelectedPaths(newSelected);
    } else {
      // Single select
      setSelectedPaths(new Set<string>([node.path]));
      setLastSelectedPath(node.path);
    }
  };

  const handleDragStart = (e: React.DragEvent, node: FileSystemNode) => {
    e.stopPropagation();
    
    let pathsToDrag = Array.from(selectedPaths);
    if (!selectedPaths.has(node.path)) {
      pathsToDrag = [node.path];
      setSelectedPaths(new Set<string>([node.path]));
      setLastSelectedPath(node.path);
    }
    
    e.dataTransfer.setData("application/json", JSON.stringify(pathsToDrag));
    e.dataTransfer.effectAllowed = "copyMove";
    
    // Create a custom drag image if possible, or just let browser handle it
    // Styling the drag is hard without custom drag layer, sticking to default
  };

  const handleDragOver = (e: React.DragEvent, node: FileSystemNode) => {
    e.preventDefault(); // Allow drop
    e.stopPropagation();
    
    if (node.isDirectory) {
      setDragOverPath(node.path);
      e.dataTransfer.dropEffect = e.altKey ? "copy" : "move";
    } else {
      setDragOverPath(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetNode: FileSystemNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    if (!targetNode.isDirectory) return;

    const transferData = e.dataTransfer.getData("application/json");
    if (!transferData) return;

    const sourcePaths: string[] = JSON.parse(transferData);
    const isCopy = e.altKey;

    let modified = false;

    for (const sourcePath of sourcePaths) {
      if (targetNode.path.startsWith(sourcePath) && targetNode.path !== sourcePath) {
        console.warn("Cannot move folder into itself");
        continue;
      }
      
      const fileName = sourcePath.split(/[/\\]/).pop();
      const destPath = `${targetNode.path}/${fileName}`; 
      
      if (destPath === sourcePath) continue;

      try {
        if (isCopy) {
           // We need to assume moveNode/copyNode handles this or we need logic
           // Reusing logic from previous implementation
           // Since we can't easily check isDirectory without a lookup, and previous user code used logic 
           // that implies copyNode handles it or we used a finder.
           // To be safe and consistent with user code I verified:
           // "const nodeToCopy = findNode(data, sourcePath);"
           
           const findNode = (n: FileSystemNode, p: string): FileSystemNode | null => {
              if (n.path === p) return n;
              if (n.children) {
                 for (const c of n.children) {
                   const res = findNode(c, p);
                   if (res) return res;
                 }
              }
              return null;
           };
           
           const nodeToCopy = findNode(data, sourcePath);
           const isDir = nodeToCopy?.isDirectory || false;
           await copyNode(sourcePath, destPath, isDir);
        } else {
           await moveNode(sourcePath, destPath);
        }
        modified = true;
      } catch (err) {
        console.error("File operation failed:", err);
      }
    }

    if (modified && onRefresh) {
      onRefresh();
    }
  };

  const renderNode = (
    node: FileSystemNode,
    prefix: string = "",
    isLast: boolean = true,
    isRoot: boolean = true,
  ) => {
    const connector = isRoot ? "" : isLast ? "└── " : "├── ";
    const nextPrefix = isRoot ? "" : isLast ? "    " : "│   ";
    
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedPaths.has(node.path);
    const isDragOver = dragOverPath === node.path;

    const icon = node.isDirectory ? (
      config.iconStyle === "emoji" ? (
        "📁"
      ) : config.iconStyle === "ascii" ? (
        "[DIR]"
      ) : (
        <Folder className={classNames("inline h-4 w-4", isSelected ? "text-blue-600 dark:text-blue-300" : "text-blue-500/80")} />
      )
    ) : config.iconStyle === "emoji" ? (
      "📄"
    ) : config.iconStyle === "ascii" ? (
      "[FILE]"
    ) : (
      <File className={classNames("inline h-4 w-4", isSelected ? "text-slate-600 dark:text-slate-200" : "text-slate-400")} />
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
      <div key={node.path} className="font-mono text-sm leading-relaxed">
        <div 
          className={classNames(
            "flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-all duration-150 group border border-transparent",
            isSelected
              ? "bg-blue-100/60 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" 
              : isDragOver
                ? "bg-blue-50 dark:bg-blue-900/40 border-blue-400 border-dashed"
                : "hover:bg-slate-100/80 dark:hover:bg-slate-800/80",
            contextMenu?.node.path === node.path && !isSelected && "bg-slate-100 dark:bg-slate-800"
          )}
          onClick={(e) => handleNodeClick(e, node)}
          onContextMenu={(e) => {
             handleNodeClick(e, node);
             handleContextMenu(e, node);
          }}
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={(e) => handleDrop(e, node)}
        >
          {/* Connector Line */}
          <span className="text-slate-300 dark:text-slate-600 font-light select-none whitespace-pre">
            {prefix + connector}
          </span>
          
          {/* Expand Toggle */}
          {node.isDirectory && hasChildren ? (
            <span 
              className={classNames(
                "cursor-pointer p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors",
                isExpanded ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"
              )}
              onClick={(e) => toggleExpand(node.path, e)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          ) : (
             // Spacer for alignment if no children or file
             node.isDirectory && <span className="w-4" /> 
          )} 
          
          {/* Icon */}
          <span className="text-slate-700 dark:text-slate-200 opacity-90">{icon}</span>
          
          {/* Name */}
          <span className={classNames(
            "font-medium truncate",
            isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"
          )}>
            {node.name}
          </span>
          
          {/* Info Badges (Size/Count) */}
          {(sizeInfo || countInfo) && (
            <span className={classNames(
                "text-xs ml-1 opacity-0 group-hover:opacity-100 transition-opacity",
                isSelected ? "text-slate-500 dark:text-slate-400 opacity-100" : "text-slate-400 dark:text-slate-500"
            )}>
              {sizeInfo}
              {countInfo}
            </span>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child, index) =>
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
    <div className="flex flex-col h-full bg-transparent rounded-lg overflow-hidden">
      {/* Visual Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm sticky top-0 z-10">
        <button
          onClick={handleExpandAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-lg transition-all shadow-sm"
        >
          <Maximize2 className="h-3 w-3" />
          Expand All
        </button>
        <button
          onClick={handleCollapseAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-lg transition-all shadow-sm"
        >
          <Minimize2 className="h-3 w-3" />
          Collapse All
        </button>
        
        <div className="ml-auto text-xs text-slate-400 px-2 flex items-center gap-4">
           {selectedPaths.size > 0 && <span>{selectedPaths.size} selected</span>}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="min-w-fit pb-10">
          {renderNode(data, "", true, true)}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 py-1.5 animation-scale-in"
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50 mb-1">
             {contextMenu.node.name}
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
            Reveal in File Explorer
          </button>
        </div>
      )}
    </div>
  );
}
