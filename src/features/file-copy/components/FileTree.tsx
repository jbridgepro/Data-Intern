/**
 * File: src/features/file-copy/components/FileTree.tsx
 *
 * Front-end component for displaying file tree structure in the File Copy Tab.
 * Handles file selection, filtering, and directory navigation.
 */

import { useState, useEffect } from "react";
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

interface FileTreeProps {
  rootPath: string;
  selectedPaths: Set<string>;
  onSelectionChange: (entry: FileEntry, isSelected: boolean) => void;
  getDirectoryContents: (path: string) => Promise<FileEntry[]>;
  filterExtensions?: string[];
  searchTerm?: string;
  excludeTemp?: boolean;
}

const FileNode = ({
  entry,
  level,
  selectedPaths,
  onSelectionChange,
  getDirectoryContents,
  filterExtensions,
  searchTerm,
  excludeTemp,
}: {
  entry: FileEntry;
  level: number;
  selectedPaths: Set<string>;
  onSelectionChange: (entry: FileEntry, isSelected: boolean) => void;
  getDirectoryContents: (path: string) => Promise<FileEntry[]>;
  filterExtensions?: string[];
  searchTerm?: string;
  excludeTemp?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isSelected = selectedPaths.has(entry.path);

  // Check visibility based on filters
  let isVisible = true;

  if (filterExtensions && filterExtensions.length > 0 && !entry.isDirectory) {
    const ext = entry.extension ? entry.extension.toLowerCase() : "{no-ext}";
    if (filterExtensions.includes(ext)) {
      isVisible = false;
    }
  }

  if (searchTerm && !entry.isDirectory) {
    if (!entry.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      isVisible = false;
    }
  }

  if (excludeTemp && !entry.isDirectory) {
    // Temp file heuristics
    const name = entry.name;
    if (
      name.startsWith("~$") ||
      name.startsWith(".") ||
      name.endsWith(".tmp") ||
      name.endsWith(".bak") ||
      name === "Thumbs.db" ||
      name === ".DS_Store"
    ) {
      isVisible = false;
    }
  }

  // Always show folders for navigation, unless we implement deep filtering (hard)
  if (entry.isDirectory) isVisible = true;

  if (!isVisible) return null;

  const handleExpand = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!entry.isDirectory) return;

    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (nextExpanded && !hasLoaded) {
      setLoading(true);
      try {
        const entries = await getDirectoryContents(entry.path);
        // Validate entries are in expected format
        if (Array.isArray(entries)) {
          setChildren(entries);
          setHasLoaded(true);
        } else {
          console.error("Invalid entries format:", entries);
          setChildren([]);
          setHasLoaded(true);
        }
      } catch (e) {
        console.error("Failed to load children", e);
        setChildren([]);
        setHasLoaded(true);
      } finally {
        setLoading(false);
      }
    }
  };

  const getIcon = () => {
    if (entry.isDirectory)
      return <Folder className="h-4 w-4 text-blue-500 shrink-0" />;

    // Simple extension mapping
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
    <div>
      <div
        className={cn(
          "flex items-center py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800/50 group cursor-pointer pr-3 transition-colors rounded-sm mx-1",
          isSelected &&
            "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 dark:border-blue-400",
        )}
        style={{ paddingLeft: `${Math.max(8, level * 20 + 8)}px` }}
        onClick={() =>
          !entry.isDirectory && onSelectionChange(entry, !isSelected)
        }
      >
        <div className="flex items-center w-full gap-2">
          {entry.isDirectory ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExpand();
              }}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded shrink-0 transition-colors mr-0.5"
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
            onCheckedChange={(checked) => {
              const isChecked = checked as boolean;
              onSelectionChange(entry, isChecked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />

          <div
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={(e) => {
              if (entry.isDirectory) {
                handleExpand(e);
              } else {
                onSelectionChange(entry, !isSelected);
              }
            }}
          >
            {getIcon()}
            <span className="truncate text-sm select-none text-foreground">
              {/* Highlight search term if it matches */}
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

      {expanded && entry.isDirectory && (
        <div>
          {children.map((child) => (
            <FileNode
              key={child.path}
              entry={child}
              level={level + 1}
              selectedPaths={selectedPaths}
              onSelectionChange={onSelectionChange}
              getDirectoryContents={getDirectoryContents}
              filterExtensions={filterExtensions}
              searchTerm={searchTerm}
              excludeTemp={excludeTemp}
            />
          ))}
          {hasLoaded && children.length === 0 && (
            <div
              className="text-xs text-muted-foreground py-2 italic px-4"
              style={{ paddingLeft: `${(level + 1) * 20 + 28}px` }}
            >
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({
  rootPath,
  selectedPaths,
  onSelectionChange,
  getDirectoryContents,
  filterExtensions,
  searchTerm,
  excludeTemp,
}: FileTreeProps) => {
  const [items, setItems] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rootPath) {
      setLoading(true);
      setError(null);
      getDirectoryContents(rootPath)
        .then(setItems)
        .catch((err) => {
          console.error("Failed to load directory contents:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load directory contents",
          );
          setItems([]);
        })
        .finally(() => setLoading(false));
    } else {
      setItems([]);
      setError(null);
    }
  }, [rootPath, getDirectoryContents]);

  if (loading) {
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
              onClick={() => {
                setError(null);
                if (rootPath) {
                  setLoading(true);
                  getDirectoryContents(rootPath)
                    .then(setItems)
                    .catch((err) => {
                      console.error("Retry failed:", err);
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Failed to load directory contents",
                      );
                    })
                    .finally(() => setLoading(false));
                }
              }}
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

  return (
    <div className="h-full overflow-auto pb-4 px-2">
      {items.length === 0 && !loading ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center space-y-2">
            <File className="h-8 w-8 mx-auto opacity-50" />
            <p className="text-sm">No files found</p>
          </div>
        </div>
      ) : (
        items
          .filter((item) => item && item.path && item.name) // Filter out invalid entries
          .map((item) => {
            try {
              return (
                <FileNode
                  key={item.path}
                  entry={item}
                  level={0}
                  selectedPaths={selectedPaths}
                  onSelectionChange={onSelectionChange}
                  getDirectoryContents={getDirectoryContents}
                  filterExtensions={filterExtensions}
                  searchTerm={searchTerm}
                  excludeTemp={excludeTemp}
                />
              );
            } catch (err) {
              console.error(`Error rendering file node for ${item.path}:`, err);
              return null;
            }
          })
          .filter(Boolean) // Remove null entries
      )}
    </div>
  );
};
