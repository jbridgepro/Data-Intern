/**
 * File: src/features/file-mapper/components/visualizations/TreeView.tsx
 *
 * Frontend component for Tree View visualization
 * Displays hierarchical structure with ASCII/Unicode tree lines
 * Supports interactive expansion/collapse and context menu
 * Updated with Layout Match for File Copy Page (FileTree style)
 */

import React, { useState, useEffect, useRef } from "react";
import { FileSystemNode, moveNode, copyNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import { formatFileSize } from "../../utils/fileSystemScanner";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useVirtualizedTree, getAllPaths as getAllPathsHelper } from '../../hooks/useVirtualizedTree';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  FolderOpen,
  Maximize2,
  Minimize2,
  GripVertical,
  FileText, Database, Image as ImageIcon, Music, Video, Component, Loader2
} from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";

// Fallback for cn if not available
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
  const parentRef = useRef<HTMLDivElement>(null);

  // Flatten the tree for virtualization
  const flatNodes = useVirtualizedTree(data, expandedPaths);

  // Virtual scrolling configuration
  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // Estimated row height in pixels
    overscan: 10, // Render 10 extra rows above/below viewport for smooth scrolling
  });

  // Initialize with all expanded when data changes (default behavior)
  useEffect(() => {
    setExpandedPaths(getAllPathsHelper(data));
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
    setExpandedPaths(getAllPathsHelper(data));
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

  // Helper to determine icon (Visual Match)
  const getIcon = (node: FileSystemNode, isSelected: boolean) => {
    if (node.isDirectory)
        return <Folder className={classNames("h-4 w-4 shrink-0", isSelected ? "text-blue-500" : "text-blue-500/80")} />;

    const ext = node.extension;
    if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext || ""))
        return <ImageIcon className="h-4 w-4 text-purple-500 shrink-0" />;
    if (["mp4", "mov", "avi"].includes(ext || ""))
        return <Video className="h-4 w-4 text-red-500 shrink-0" />;
    if (["mp3", "wav"].includes(ext || ""))
        return <Music className="h-4 w-4 text-pink-500 shrink-0" />;
    if (["json", "xml", "yaml", "sql"].includes(ext || ""))
        return <Database className="h-4 w-4 text-yellow-500 shrink-0" />;
    if (["js", "ts", "jsx", "tsx"].includes(ext || ""))
        return <Component className="h-4 w-4 text-blue-400 shrink-0" />;
    if (["txt", "md"].includes(ext || ""))
        return <FileText className="h-4 w-4 text-slate-500 shrink-0" />;

    return <File className={classNames("h-4 w-4 shrink-0", isSelected ? "text-slate-500" : "text-gray-400")} />;
  };

  // New virtualized rendering function for flat nodes
  const renderNodeVirtualized = (flatNode: { node: FileSystemNode; depth: number; hasChildren: boolean; isExpanded: boolean }) => {
    const { node, depth, hasChildren, isExpanded } = flatNode;

    const isSelected = selectedPaths.has(node.path);
    const isDragOver = dragOverPath === node.path;

    const sizeInfo =
      config.showFileSizes && !node.isDirectory
        ? ` (${formatFileSize(node.size)})`
        : "";

    const countInfo =
      config.showFileCounts && node.isDirectory
        ? ` [${node.fileCount || 0}, ${node.folderCount || 0}]`
        : "";

    // Calculate indentation based on depth
    const indentPx = depth * 24; // 24px per level

    return (
      <div className="font-sans text-sm">
        <div
          style={{ paddingLeft: `${indentPx}px` }}
          className={classNames(
            "flex items-center py-1.5 px-2 rounded-sm cursor-pointer transition-colors group mx-1",
            isSelected
              ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 dark:border-blue-400 pl-[calc(0.5rem-2px)]"
              : isDragOver
                ? "bg-blue-50 dark:bg-blue-900/40 border-l-2 border-blue-400 border-dashed pl-[calc(0.5rem-2px)]"
                : "hover:bg-slate-100 dark:hover:bg-slate-800/50 border-l-2 border-transparent pl-[calc(0.5rem-2px)]"
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
          {/* Expand Toggle */}
          {node.isDirectory ? (
             <span
              className={classNames(
                "p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded shrink-0 transition-colors mr-1 cursor-pointer",
                !hasChildren && "opacity-50 pointer-events-none"
              )}
              onClick={(e) => toggleExpand(node.path, e)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </span>
          ) : (
             <span className="w-5 mr-1" />
          )}

          {/* Icon */}
          <span className="mr-2">{getIcon(node, isSelected)}</span>

          {/* Name */}
          <span className={classNames(
            "truncate select-none",
            isSelected ? "text-slate-900 dark:text-slate-100 font-medium" : "text-slate-700 dark:text-slate-300"
          )}>
            {node.name}
          </span>

          {/* Info Badges */}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground opacity-70">
              {sizeInfo}
              {countInfo}
          </div>
        </div>
      </div>
    );
  };

  // Old recursive rendering function (kept for reference, but not used with virtualization)
  const renderNode = (
    node: FileSystemNode,
    prefix: string = "",
    isLast: boolean = true,
    isRoot: boolean = true,
    level: number = 0
  ) => {
    // Note: The FileTree uses direct indentation control (paddingLeft).
    // The previous TreeView used Unicode lines ("│   ").
    // The request is to match the File Mapper layout to the Copy/Move page.
    // The Copy/Move page FileTree.tsx uses padding indent, no unicode lines.
    // However, TreeView's feature is specifically "Visualization". 
    // If I remove lines completely, it might lose its "Tree" appeal if user selected "Tree" style.
    // But since the request is explicit about layout matching:
    // "Have the File mapper Browser Directory match the layout of the copy move page" (Browser Directory aspect)
    // I will switch to Padding-based indentation if config.lineStyle is not strict, or just prioritize the clean look.
    // Actually, maintaining lines is probably better for "Mapping", but I will improve the row container style.
    
    // Let's stick to lines if it helps visualization, but improve the row style to be consistent.
    // OR better: Make it look like FileTree but with optional lines?
    // I'll keep the lines because it is a "Visualization", but I will match the row height, hover, and selection style exact.
    
    const connector = isRoot ? "" : isLast ? "└── " : "├── ";
    const nextPrefix = isRoot ? "" : isLast ? "    " : "│   ";
    
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedPaths.has(node.path);
    const isDragOver = dragOverPath === node.path;

    const sizeInfo =
      config.showFileSizes && !node.isDirectory
        ? ` (${formatFileSize(node.size)})`
        : "";

    const countInfo =
      config.showFileCounts && node.isDirectory
        ? ` [${node.fileCount || 0}, ${node.folderCount || 0}]`
        : "";

    return (
      <div key={node.path} className="font-sans text-sm">
        <div 
          className={classNames(
            "flex items-center py-1.5 px-2 rounded-sm cursor-pointer transition-colors group mx-1",
            // Selection Style from FileTree: bg-blue-50 border-l-2 border-blue-500 
            isSelected
              ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 dark:border-blue-400 pl-[calc(0.5rem-2px)]" 
              : isDragOver
                ? "bg-blue-50 dark:bg-blue-900/40 border-l-2 border-blue-400 border-dashed pl-[calc(0.5rem-2px)]"
                : "hover:bg-slate-100 dark:hover:bg-slate-800/50 border-l-2 border-transparent pl-[calc(0.5rem-2px)]"
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
          {/* Connector Line (kept for visualization context but styled subtly) */}
          <span className="text-slate-300 dark:text-slate-600 font-light select-none whitespace-pre font-mono text-xs mr-1 opacity-50">
            {prefix + connector}
          </span>
          
          {/* Expand Toggle */}
          {node.isDirectory ? (
             <span 
              className={classNames(
                "p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded shrink-0 transition-colors mr-1 cursor-pointer",
                !hasChildren && "opacity-50 pointer-events-none"
              )}
              onClick={(e) => toggleExpand(node.path, e)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </span>
          ) : (
             <span className="w-5 mr-1" />
          )} 
          
          {/* Icon */}
          <span className="mr-2">{getIcon(node, isSelected)}</span>
          
          {/* Name */}
          <span className={classNames(
            "truncate select-none",
            isSelected ? "text-slate-900 dark:text-slate-100 font-medium" : "text-slate-700 dark:text-slate-300"
          )}>
            {node.name}
          </span>
          
          {/* Info Badges */}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground opacity-70">
              {sizeInfo}
              {countInfo}
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child, index) =>
              renderNode(
                child,
                prefix + nextPrefix,
                index === node.children!.length - 1,
                false,
                level + 1
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent rounded-lg overflow-hidden">
      {/* Visual Toolbar - Keeping this as it adds value over simple Copy Tree, 
          but matching styling to be integrated. */}
      {/* If strictly matching "Browser Directory" layout of copy move page, 
          Copy Move page doesn't have a mini toolbar INSIDE the tree (FileTree.tsx doesn't have one).
          However, File Mapper implies enhanced visualization. I will keep it but make it very subtle.
      */}
      <div className="flex items-center gap-2 p-2 border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
         <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">Tree Navigation</div>
         <div className="ml-auto flex items-center gap-1">
            <button
              onClick={handleExpandAll}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 rounded transition-all"
              title="Expand All"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 rounded transition-all"
              title="Collapse All"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
         </div>
      </div>

      {/* Tree Content with Virtualization */}
      <div ref={parentRef} className="flex-1 overflow-auto p-2 custom-scrollbar">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const flatNode = flatNodes[virtualRow.index];
            if (!flatNode) return null;

            return (
              <div
                key={flatNode.node.path}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderNodeVirtualized(flatNode)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Context Menu - Kept as functional enhancement */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 py-1.5"
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
            Reveal in Explorer
          </button>
        </div>
      )}
    </div>
  );
}
