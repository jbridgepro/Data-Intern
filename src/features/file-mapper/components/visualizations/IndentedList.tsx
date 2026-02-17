/**
 * File: src/features/file-mapper/components/visualizations/IndentedList.tsx
 *
 * Frontend component for List View visualization (Table Format)
 * Displays file structure with sortable columns, expand/collapse folders,
 * and context menu (Copy Path, Reveal in Explorer)
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { FileSystemNode, formatFileSize } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  File, 
  Folder, 
  FolderOpen,
  FileText,
  Copy,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import "./IndentedList.css";

/** Wrapper that applies indentation via CSS variable (no inline style). */
function IndentContent({
  depth,
  children,
  className,
}: {
  depth: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current)
      ref.current.style.setProperty(
        "--indented-list-padding-left",
        `${depth * 20}px`
      );
  }, [depth]);
  return (
    <div ref={ref} className={cn("indented-list-row-content", className)}>
      {children}
    </div>
  );
}

/** Context menu positioned via CSS variables (no inline style). */
function ContextMenuPortal({
  x,
  y,
  onClick,
  children,
}: {
  x: number;
  y: number;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuRef.current) return;
    menuRef.current.style.setProperty("--indented-list-menu-top", `${y}px`);
    menuRef.current.style.setProperty("--indented-list-menu-left", `${x}px`);
  }, [x, y]);
  return (
    <div
      ref={menuRef}
      className="indented-list-context-menu fixed z-50 min-w-[180px] bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 py-1.5"
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface IndentedListProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

type SortField = "name" | "size" | "type" | "date";
type SortDirection = "asc" | "desc";

interface FlatNode {
  node: FileSystemNode;
  depth: number;
}

interface ContextMenuState {
    x: number;
    y: number;
    node: FileSystemNode;
}

export function IndentedList({ data, config }: IndentedListProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  /** Set of folder paths that are expanded (children visible). Root is always expanded implicitly. */
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set([data.path]));

  // Keep root expanded when data changes (e.g. new scan)
  useEffect(() => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.add(data.path);
      return next;
    });
  }, [data.path]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    const collect = (node: FileSystemNode) => {
      if (node.isDirectory && node.path) allPaths.add(node.path);
      node.children?.forEach(collect);
    };
    collect(data);
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set([data.path]));
  };

  // Sort nodes recursively (preserves tree structure, sorts within each level)
  const sortNodesRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
    return [...nodes]
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "size":
            comparison = (a.size || 0) - (b.size || 0);
            break;
          case "type":
            const extA = a.extension || (a.isDirectory ? "Folder" : "");
            const extB = b.extension || (b.isDirectory ? "Folder" : "");
            comparison = extA.localeCompare(extB);
            break;
          case "date":
            const dateA = a.modifiedDate ? new Date(a.modifiedDate).getTime() : 0;
            const dateB = b.modifiedDate ? new Date(b.modifiedDate).getTime() : 0;
            comparison = dateA - dateB;
            break;
        }
        return sortDirection === "asc" ? comparison : -comparison;
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodesRecursive(node.children) : undefined,
      }));
  };

  // Flatten the tree, respecting expanded state (only include children of expanded folders)
  const sortedFlattenedNodes = useMemo(() => {
    const sortedData = {
      ...data,
      children: data.children ? sortNodesRecursive(data.children) : [],
    };
    const result: FlatNode[] = [];
    const traverse = (node: FileSystemNode, depth: number) => {
      result.push({ node, depth });
      const isExpanded = node.path === data.path || expandedPaths.has(node.path);
      if (node.isDirectory && node.children && isExpanded) {
        node.children.forEach((child) => traverse(child, depth + 1));
      }
    };
    traverse(sortedData, 0);
    return result;
  }, [data, sortField, sortDirection, expandedPaths]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileSystemNode) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          node
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-blue-500" /> : <ArrowDown className="h-3 w-3 text-blue-500" />;
  };

  const formatDate = (date: Date | null | string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
        <div className="flex-1 flex items-center gap-2">
          <button
            className="flex items-center gap-2 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            onClick={() => handleSort("name")}
          >
            <span>Name</span>
            <SortIcon field="name" />
          </button>
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            <button
              onClick={expandAll}
              className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              title="Expand all folders"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={collapseAll}
              className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              title="Collapse all folders"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        
        {config.showFileSizes && (
            <button 
              className="w-32 flex items-center justify-end gap-2 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              onClick={() => handleSort("size")}
            >
              <span>Size</span>
              <SortIcon field="size" />
            </button>
        )}
        
        <button 
          className="w-24 flex items-center gap-2 pl-4 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          onClick={() => handleSort("type")}
        >
          <span>Type</span>
          <SortIcon field="type" />
        </button>
        
        <button 
          className="w-40 flex items-center gap-2 pl-4 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          onClick={() => handleSort("date")}
        >
          <span>Date</span>
          <SortIcon field="date" />
        </button>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="min-w-fit pointer-events-auto">
            {sortedFlattenedNodes.map((item, index) => {
              const isFolder = item.node.isDirectory;
              const hasChildren = isFolder && item.node.children && item.node.children.length > 0;
              const isExpanded = hasChildren && (item.node.path === data.path || expandedPaths.has(item.node.path));
              return (
            <div 
                key={`${item.node.path}-${index}`}
                className="flex items-center px-4 py-2 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm group cursor-default"
                onContextMenu={(e) => handleContextMenu(e, item.node)}
            >
                {/* Name & Indentation (with expand/collapse for folders) */}
                <IndentContent depth={item.depth} className="flex-1 min-w-0 flex items-center gap-2">
                    {/* Expand/collapse chevron for folders */}
                    {isFolder ? (
                      <button
                        type="button"
                        onClick={() => hasChildren && toggleExpand(item.node.path)}
                        className={cn(
                          "shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors",
                          !hasChildren && "invisible"
                        )}
                        title={isExpanded ? "Collapse" : "Expand"}
                        aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                      >
                        {hasChildren ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-500" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" aria-hidden />
                    )}
                    {isFolder ? (
                      <Folder className={cn("h-4 w-4 shrink-0", isExpanded ? "text-blue-500" : "text-blue-400")} />
                    ) : (
                      item.node.extension === "pdf" ? (
                        <FileText className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-slate-400 shrink-0" />
                      )
                    )}
                    <span className={cn(
                        "truncate font-medium select-none",
                        isFolder ? "text-slate-700 dark:text-slate-200" : "text-slate-600 dark:text-slate-400"
                    )}>
                        {item.node.name}
                    </span>
                </IndentContent>

                {/* Size */}
                {config.showFileSizes && (
                    <div className="w-32 text-right font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0 select-none">
                        {item.node.isDirectory ? "-" : formatFileSize(item.node.size)}
                    </div>
                )}

                {/* Type */}
                <div className="w-24 pl-4 text-xs text-slate-500 dark:text-slate-400 shrink-0 truncate select-none">
                    {item.node.isDirectory ? "Folder" : (item.node.extension || "File").toUpperCase()}
                </div>

                {/* Date */}
                <div className="w-40 pl-4 text-xs text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-2 select-none">
                    {formatDate(item.node.modifiedDate as any)}
                </div>
            </div>
            );
            })}
        </div>
      </div>
      
      {/* Footer Stats Summary */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex justify-between select-none">
         <span>{sortedFlattenedNodes.length} items shown</span>
         <span>Sorted by {sortField} ({sortDirection})</span>
      </div>

       {/* Context Menu */}
       {contextMenu && (
        <ContextMenuPortal
          x={contextMenu.x}
          y={contextMenu.y}
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
        </ContextMenuPortal>
      )}
    </div>
  );
}
