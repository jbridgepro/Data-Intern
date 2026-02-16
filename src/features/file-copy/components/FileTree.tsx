/**
 * File: src/features/file-copy/components/FileTree.tsx
 *
 * Front-end component for displaying file tree structure in the File Copy Tab.
 * Handles file selection, filtering, and directory navigation.
 * Now supports folder selection, indeterminate states, and better visual feedback.
 * Virtualized for performance.
 */

import { useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  FileText,
  Component,
  Database,
  Image as ImageIcon,
  Music,
  Video,
  Loader2,
  FolderSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileEntry } from "../hooks/useFileSystem";
import { Checkbox } from "@/components/ui/checkbox";
import { useVirtualizer } from "@tanstack/react-virtual";
import { VirtualNode } from "../hooks/useVirtualFileTree";

interface FileTreeProps {
  rootPath: string;
  selectedPaths: Set<string>;
  onSelectionChange: (entry: FileEntry, isSelected: boolean) => void;
  onFolderSelectionToggle?: (folder: FileEntry) => Promise<void>;
  getDirectoryContents: (path: string) => Promise<FileEntry[]>;
  filterExtensions?: string[];
  filterMode?: "include" | "exclude";
  searchTerm?: string;
  excludeTemp?: boolean;
  lastClickedIndex?: number;
  onItemClick?: (index: number, entry: FileEntry, shiftKey: boolean) => void;
  // Controlled props
  rows: VirtualNode[];
  toggleExpand: (entry: FileEntry) => void;
  rootLoading: boolean;
  error: string | null;
  refreshRoot: () => void;
}

const VirtualizedFileRow = ({
  node,
  style,
  onToggleExpand,
  selectedPaths,
  onSelectionChange,
  onFolderSelectionToggle,
  onItemClick,
  searchTerm,
}: {
  node: VirtualNode;
  style: React.CSSProperties;
  onToggleExpand: (entry: FileEntry) => void;
  selectedPaths: Set<string>;
  onSelectionChange: (entry: FileEntry, isSelected: boolean) => void;
  onFolderSelectionToggle?: (folder: FileEntry) => Promise<void>;
  onItemClick?: (index: number, entry: FileEntry, shiftKey: boolean) => void;
  searchTerm?: string;
}) => {
  const { entry, level, expanded, loading, index } = node;
  const isSelected = selectedPaths.has(entry.path);

  const handleCheckboxChange = async (checked: boolean | "indeterminate") => {
    if (entry.isDirectory && onFolderSelectionToggle) {
      await onFolderSelectionToggle(entry);
    } else if (!entry.isDirectory) {
      onSelectionChange(entry, checked as boolean);
    }
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (entry.isDirectory) {
      onToggleExpand(entry);
    } else {
      if (index !== undefined && onItemClick) {
        onItemClick(index, entry, e.shiftKey);
      } else {
        onSelectionChange(entry, !isSelected);
      }
    }
  };

  const getIcon = () => {
    if (entry.isDirectory)
      return <Folder className="h-4 w-4 text-blue-500 shrink-0" />;

    const ext = entry.extension;
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

    return <File className="h-4 w-4 text-gray-400 shrink-0" />;
  };

  return (
    <div
      style={{
        ...style,
        paddingLeft: `${Math.max(8, level * 20 + 8)}px`,
      }}
      className={cn(
        "flex items-center hover:bg-slate-100 dark:hover:bg-slate-800/50 group cursor-pointer pr-3 transition-colors rounded-sm mx-1 absolute left-0 w-full box-border",
        isSelected &&
          "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 dark:border-blue-400"
      )}
      onClick={handleRowClick}
    >
      <div className="flex items-center w-full gap-2">
        {entry.isDirectory ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(entry);
            }}
            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded shrink-0 transition-colors mr-0.5"
            onKeyDown={(e) => {
               if (e.key === 'Enter' || e.key === ' ') {
                   e.stopPropagation();
                   onToggleExpand(entry);
               }
            }}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getIcon()}
          <span className="truncate text-sm select-none text-foreground">
             {searchTerm && !entry.isDirectory && entry.name
                ? (() => {
                    const searchLower = searchTerm.toLowerCase();
                    const nameLower = entry.name.toLowerCase();
                    const index = nameLower.indexOf(searchLower);
                    if (index !== -1) {
                      return (
                        <span>
                          {entry.name.substring(0, index)}
                          <span className="bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100 px-0.5 rounded">
                            {entry.name.substring(
                              index,
                              index + searchTerm.length,
                            )}
                          </span>
                          {entry.name.substring(index + searchTerm.length)}
                        </span>
                      );
                    }
                    return entry.name;
                  })()
                : entry.name || ""}
          </span>
          
           {entry.size !== undefined && !entry.isDirectory && (
              <span className="text-xs text-muted-foreground ml-auto shrink-0 font-mono px-2">
                {entry.size < 1024
                  ? `${entry.size} B`
                  : entry.size < 1024 * 1024
                    ? `${(entry.size / 1024).toFixed(1)} KB`
                    : `${(entry.size / (1024 * 1024)).toFixed(2)} MB`}
              </span>
            )}
        </div>
      </div>
    </div>
  );
};

export const FileTree = ({
  rootPath,
  selectedPaths,
  onSelectionChange,
  onFolderSelectionToggle,
  searchTerm,
  lastClickedIndex,
  onItemClick,
  rows,
  toggleExpand,
  rootLoading,
  error,
  refreshRoot
}: FileTreeProps) => {

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // Approximate row height
    overscan: 10,
  });

  if (rootLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading files...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-red-300 dark:border-red-700 rounded-xl bg-red-50/50 dark:bg-red-900/30 max-w-md">
          <File className="h-12 w-12 text-red-500 dark:text-red-400 opacity-50" />
          <div className="space-y-2">
            <p className="text-base font-medium text-red-700 dark:text-red-300">
              Error loading directory
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={refreshRoot}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 max-w-md">
          <FolderSearch className="h-12 w-12 text-muted-foreground opacity-50" />
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">
              No source folder selected
            </p>
            <p className="text-sm text-muted-foreground">
              Select a source folder using the Browse button above to begin
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center space-y-2">
            <File className="h-8 w-8 mx-auto opacity-50" />
            <p className="text-sm">No files found</p>
          </div>
        </div>
      );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto px-2 relative"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const node = rows[virtualRow.index];
          return (
            <VirtualizedFileRow
              key={node.entry.path}
              node={node}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onToggleExpand={toggleExpand}
              selectedPaths={selectedPaths}
              onSelectionChange={onSelectionChange}
              onFolderSelectionToggle={onFolderSelectionToggle}
              onItemClick={onItemClick}
              searchTerm={searchTerm}
            />
          );
        })}
      </div>
    </div>
  );
};
