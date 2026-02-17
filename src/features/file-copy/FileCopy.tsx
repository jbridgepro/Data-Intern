/**
 * File: src/features/file-copy/FileCopy.tsx
 *
 * Front-end component for the File Copy Tab.
 * Uses a left/right split panel layout inspired by Folder Creation
 * and File Creation pages:
 *   - Left panel: Source file tree with toolbar, search, filters, and selection tools
 *   - Right panel: Destination controls, operation preview, and selected files list
 *
 * This layout makes it intuitive to see what is being copied/moved (left)
 * and where it is going (right).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useFileSystem, FileEntry } from "./hooks/useFileSystem";
import { FileTree } from "./components/FileTree";
import { OperationControls } from "./components/OperationControls";
import { CopyToolbar } from "./components/CopyToolbar";
import { SelectionPreview } from "./components/SelectionPreview";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageHeader } from "@/components/layout/PageHeader";
import { fileCopyInfo } from "@/components/layout/toolInfoContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Copy, CheckCircle, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { join, dirname, basename } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { usePersistentState } from "../../hooks/usePersistentState";
import { toggleFolderSelection, selectRange } from "./utils/selectionUtils";
import { isFileVisible } from "./utils/filterUtils";
import { useVirtualFileTree } from "./hooks/useVirtualFileTree";

// Types for conflict resolution
type ConflictResolution = "overwrite" | "skip" | "rename" | "ask";

interface OperationLogEntry {
  id: string;
  fileName: string;
  status: "success" | "error" | "skipped";
  message: string;
  timestamp: Date;
}

interface OperationHistory {
  type: "copy" | "move";
  totalFiles: number;
  successful: number;
  failed: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
  logs: OperationLogEntry[];
}

export const FileCopy = () => {
  const {
    currentPath,
    selectDirectory,
    getDirectoryContents,
    copyFile,
    moveFile,
    setCurrentPath,
  } = useFileSystem();

  const [destPath, setDestPath, resetDestPath] = usePersistentState(
    "file-copy-dest-path",
    "",
  );
  const [selectedFiles, setSelectedFiles] = useState<Map<string, FileEntry>>(
    new Map(),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [treeKey, setTreeKey] = useState(0); // For forcing refresh
  const cancelRef = useRef(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);
  const [allVisibleEntries, setAllVisibleEntries] = useState<FileEntry[]>([]);

  // Conflict resolution
  const [conflictResolution, setConflictResolution, resetConflictResolution] =
    usePersistentState<ConflictResolution>("file-copy-conflict-res", "ask");
  const [preserveStructure, setPreserveStructure, resetPreserveStructure] =
    usePersistentState("file-copy-preserve-struct", false);

  // Operation history
  const [operationHistory, setOperationHistory] = useState<OperationHistory[]>(
    [],
  );
  const [currentOperation, setCurrentOperation] =
    useState<OperationHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Recent paths
  const [recentPaths, setRecentPaths] = useState<string[]>(() => {
    const saved = localStorage.getItem("file-copy-recent-paths");
    return saved ? JSON.parse(saved) : [];
  });
  const [favoritePaths, setFavoritePaths] = useState<string[]>(() => {
    const saved = localStorage.getItem("file-copy-favorite-paths");
    return saved ? JSON.parse(saved) : [];
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterMode, setFilterMode, resetFilterMode] = usePersistentState<
    "include" | "exclude"
  >("file-copy-filter-mode", "exclude");
  const [excludeTemp, setExcludeTemp, resetExcludeTemp] = usePersistentState(
    "file-copy-exclude-temp",
    true,
  );
  const [availableExtensions, setAvailableExtensions] = useState<string[]>([]);

  // Lifted state for FileTree
  const {
    rows,
    toggleExpand,
    collapseAll,
    expandAll,
    rootLoading,
    error: treeError,
    refreshRoot,
  } = useVirtualFileTree({
    rootPath: currentPath,
    getDirectoryContents,
    filterOptions: {
      filterExtensions: activeFilters,
      filterMode,
      searchTerm,
      excludeTemp,
    },
  });

  // Update available extensions when directory contents change
  useEffect(() => {
    const fetchExtensions = async () => {
      if (!currentPath) return;
      try {
        const files = await getDirectoryContents(currentPath);
        const extensions = new Set<string>();
        files.forEach((file) => {
          if (!file.isDirectory) {
            // Normalize to lowercase and handle missing extensions
            const ext = file.extension
              ? file.extension.toLowerCase()
              : "{no-ext}";
            extensions.add(ext);
          }
        });
        setAvailableExtensions(Array.from(extensions).sort());
      } catch (error) {
        console.error("Failed to fetch extensions:", error);
      }
    };
    fetchExtensions();
  }, [currentPath, getDirectoryContents]); // Re-run when path or getter changes

  // Save recent paths to localStorage
  useEffect(() => {
    if (currentPath && !recentPaths.includes(currentPath)) {
      const updated = [currentPath, ...recentPaths].slice(0, 10);
      setRecentPaths(updated);
      localStorage.setItem("file-copy-recent-paths", JSON.stringify(updated));
    }
  }, [currentPath]);

  useEffect(() => {
    localStorage.setItem(
      "file-copy-favorite-paths",
      JSON.stringify(favoritePaths),
    );
  }, [favoritePaths]);

  // Force tree refresh when move operation completes or path changes
  useEffect(() => {
    if (treeKey > 0) {
      refreshRoot();
    }
  }, [treeKey]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: Select all visible files
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !isProcessing) {
        // Only if focus is not in an input
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          handleSelectAll();
        }
      }
      // Ctrl/Cmd + D: Deselect all
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && !isProcessing) {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          e.preventDefault();
          setSelectedFiles(new Map());
        }
      }
      // Escape: Cancel operation
      if (e.key === "Escape" && isProcessing) {
        handleCancelOperation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProcessing]); // Added dependencies to ensure correctness

  const handleSelectionChange = useCallback(
    (entry: FileEntry, isSelected: boolean) => {
      setSelectedFiles((prev) => {
        const next = new Map(prev);
        if (isSelected) {
          next.set(entry.path, entry);
        } else {
          next.delete(entry.path);
        }
        return next;
      });
    },
    [],
  );

  // Select All: selects every item currently displayed in the tree (rows).
  // Uses the visible rows from useVirtualFileTree so selection matches what the user sees.
  const handleSelectAll = useCallback(() => {
    if (!currentPath || rows.length === 0) return;
    const newSelection = new Map<string, FileEntry>();
    for (const row of rows) {
      newSelection.set(row.entry.path, row.entry);
    }
    setSelectedFiles(newSelection);
  }, [currentPath, rows]);

  // Invert: selects all visible items that are unselected, deselects the rest.
  // Uses rows (same as Select All) so behavior matches what the user sees.
  const handleInvertSelection = useCallback(() => {
    if (!currentPath || rows.length === 0) return;
    const newSelection = new Map<string, FileEntry>();
    for (const row of rows) {
      if (!selectedFiles.has(row.entry.path)) {
        newSelection.set(row.entry.path, row.entry);
      }
    }
    setSelectedFiles(newSelection);
  }, [currentPath, rows, selectedFiles]);

  const handleFolderSelectionToggle = useCallback(
    async (folder: FileEntry) => {
      try {
        const newSelection = await toggleFolderSelection(
          folder,
          selectedFiles,
          getDirectoryContents,
          {
            searchTerm,
            filterExtensions: activeFilters,
            filterMode,
            excludeTemp,
          },
        );
        setSelectedFiles(newSelection);
      } catch (error) {
        console.error("Failed to toggle folder selection:", error);
      }
    },
    [
      selectedFiles,
      getDirectoryContents,
      activeFilters,
      filterMode,
      searchTerm,
      excludeTemp,
    ],
  );

  const handleItemClick = useCallback(
    (index: number, entry: FileEntry, shiftKey: boolean) => {
      if (shiftKey && lastClickedIndex >= 0 && allVisibleEntries.length > 0) {
        // Range selection
        const newSelection = selectRange(
          allVisibleEntries,
          lastClickedIndex,
          index,
          selectedFiles,
        );
        setSelectedFiles(newSelection);
      } else {
        // Single selection
        setSelectedFiles((prev) => {
          const next = new Map(prev);
          if (selectedFiles.has(entry.path)) {
            next.delete(entry.path);
          } else {
            next.set(entry.path, entry);
          }
          return next;
        });
      }
      setLastClickedIndex(index);
    },
    [lastClickedIndex, allVisibleEntries, selectedFiles],
  );

  // Track visible entries for shift-click range selection
  useEffect(() => {
    const updateVisibleEntries = async () => {
      if (!currentPath) {
        setAllVisibleEntries([]);
        return;
      }

      try {
        const allFiles = await getDirectoryContents(currentPath);
        const visible = allFiles.filter((entry) =>
          isFileVisible(entry, {
            searchTerm,
            filterExtensions: activeFilters,
            filterMode,
            excludeTemp,
          }),
        );
        setAllVisibleEntries(visible);
      } catch (error) {
        console.error("Failed to update visible entries:", error);
      }
    };

    updateVisibleEntries();
  }, [
    currentPath,
    getDirectoryContents,
    searchTerm,
    activeFilters,
    filterMode,
    excludeTemp,
  ]);

  const handleCancelOperation = () => {
    cancelRef.current = true;
    setIsProcessing(false);
    setStatus("Operation cancelled");
    if (currentOperation) {
      setCurrentOperation((prev) =>
        prev ? { ...prev, endTime: new Date() } : null,
      );
    }
  };

  const toggleFavorite = (path: string) => {
    setFavoritePaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const handleSelectDest = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setDestPath(selected);
      }
    } catch (e) {
      console.error("Failed to select dest", e);
    }
  };

  const generateUniquePath = async (
    basePath: string,
    fileName: string,
    extension: string,
  ): Promise<string> => {
    let counter = 1;
    let newPath = await join(basePath, fileName);

    while (await exists(newPath)) {
      const nameWithoutExt = fileName.replace(
        new RegExp(`\\.${extension}$`),
        "",
      );
      const newFileName = `${nameWithoutExt} (${counter}).${extension}`;
      newPath = await join(basePath, newFileName);
      counter++;
    }

    return newPath;
  };

  const executeOperation = async (type: "copy" | "move") => {
    if (!destPath || selectedFiles.size === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setStatus("Starting...");
    cancelRef.current = false;

    // Use a list to track paths we've processed (folders) to avoid processing their children again
    const processedFolders = new Set<string>();

    // Sort files by path length (shortest first) so we process parents before children
    const sortedFiles = Array.from(selectedFiles.values()).sort(
      (a, b) => a.path.length - b.path.length,
    );

    // Filter to only top-level operations (skip descendants of selected folders)
    const uniqueOperations: FileEntry[] = [];

    for (const file of sortedFiles) {
      // Check if this file is inside a folder we've already decided to process
      let isDescendant = false;
      for (const folderPath of processedFolders) {
        if (
          file.path.startsWith(folderPath) &&
          file.path.length > folderPath.length
        ) {
          const charAfter = file.path[folderPath.length];
          if (charAfter === "/" || charAfter === "\\") {
            isDescendant = true;
            break;
          }
        }
      }

      if (!isDescendant) {
        uniqueOperations.push(file);
        if (file.isDirectory) {
          processedFolders.add(file.path);
        }
      }
    }

    const total = uniqueOperations.length;
    let completed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    const operationLogs: OperationLogEntry[] = [];

    const operation: OperationHistory = {
      type,
      totalFiles: total,
      successful: 0,
      failed: 0,
      skipped: 0,
      startTime: new Date(),
      logs: [],
    };

    setCurrentOperation(operation);

    // Helper for recursive copy/move of directory contents
    const processEntry = async (
      entryPath: string,
      targetPath: string,
      isMove: boolean,
    ): Promise<void> => {
      const parentDir = await dirname(entryPath);
      const stats = await getDirectoryContents(parentDir).then((files) =>
        files.find((f) => f.path === entryPath),
      );
      const isDir = stats?.isDirectory;

      if (isDir) {
        await mkdir(targetPath, { recursive: true });
        const children = await getDirectoryContents(entryPath);
        for (const child of children) {
          const childTarget = await join(targetPath, child.name);
          await processEntry(child.path, childTarget, isMove);
        }
      } else {
        if (isMove) {
          await moveFile(entryPath, targetPath);
        } else {
          await copyFile(entryPath, targetPath);
        }
      }
    };

    for (const file of uniqueOperations) {
      if (cancelRef.current) {
        setStatus("Operation cancelled");
        break;
      }

      try {
        setStatus(`${type === "copy" ? "Copying" : "Moving"} ${file.name}...`);

        let targetPath: string;
        // Logic for preserve structure
        if (preserveStructure && file.path.startsWith(currentPath)) {
          // Preserve relative directory structure
          const relativePath = file.path.substring(currentPath.length + 1);
          const relativeDir = await dirname(relativePath);
          if (relativeDir && relativeDir !== "." && relativeDir !== "") {
            const targetDir = await join(destPath, relativeDir);
            try {
              await mkdir(targetDir, { recursive: true });
            } catch (e) {
              /* ignore */
            }
            targetPath = await join(targetDir, await basename(file.path));
          } else {
            targetPath = await join(destPath, file.name);
          }
        } else {
          targetPath = await join(destPath, file.name);
        }

        // Check for conflicts
        const fileExists = await exists(targetPath);
        if (fileExists) {
          if (conflictResolution === "skip") {
            skipped++;
            operationLogs.push({
              id: `${Date.now()}-${completed}`,
              fileName: file.name,
              status: "skipped",
              message: "File already exists, skipped",
              timestamp: new Date(),
            });
            completed++;
            setProgress((completed / total) * 100);
            continue;
          } else if (conflictResolution === "rename") {
            const ext = file.extension || "";
            targetPath = await generateUniquePath(destPath, file.name, ext);
          }
        }

        if (type === "move") {
          // Ensure target directory exists
          const targetDir = await dirname(targetPath);
          try {
            await mkdir(targetDir, { recursive: true });
          } catch (e) {
            /* ignore */
          }

          // Try atomic move first
          try {
            await moveFile(file.path, targetPath);
          } catch (err) {
            // If atomic move fails (e.g. directory cross-device), fall back to recursive
            if (file.isDirectory) {
              await processEntry(file.path, targetPath, true);
            } else {
              throw err;
            }
          }
        } else {
          // Copy Operation
          if (file.isDirectory) {
            await processEntry(file.path, targetPath, false);
          } else {
            await copyFile(file.path, targetPath);
          }
        }

        successful++;
        operationLogs.push({
          id: `${Date.now()}-${completed}`,
          fileName: file.name,
          status: "success",
          message: `${type === "copy" ? "Copied" : "Moved"} successfully`,
          timestamp: new Date(),
        });
      } catch (e: any) {
        failed++;
        const errorMsg = e?.message || String(e);
        operationLogs.push({
          id: `${Date.now()}-${completed}`,
          fileName: file.name,
          status: "error",
          message: errorMsg,
          timestamp: new Date(),
        });
        console.error(`Failed to ${type} ${file.name}`, e);
      }

      completed++;
      setProgress((completed / total) * 100);

      // Update current operation in real-time
      operation.successful = successful;
      operation.failed = failed;
      operation.skipped = skipped;
      operation.logs = operationLogs;
      setCurrentOperation({ ...operation });
    }

    operation.endTime = new Date();
    operation.successful = successful;
    operation.failed = failed;
    operation.skipped = skipped;
    operation.logs = operationLogs;

    setOperationHistory((prev) => [operation, ...prev].slice(0, 20));
    setCurrentOperation(null);

    // Final Status
    if (cancelRef.current) {
      setStatus("Operation cancelled");
    } else {
      setStatus("Complete");
    }

    setIsProcessing(false);

    if (type === "move" && !cancelRef.current) {
      setSelectedFiles(new Map());
      setTreeKey((prev) => prev + 1); // Refresh tree
    }
  };

  const toggleFilter = (ext: string) => {
    setActiveFilters((prev) =>
      prev.includes(ext) ? prev.filter((f) => f !== ext) : [...prev, ext],
    );
  };

  const totalSize = Array.from(selectedFiles.values()).reduce(
    (acc, curr) => acc + (curr.size || 0),
    0,
  );

  // Count visible (non-directory) files in the tree for search result count
  const visibleFileCount = rows.filter((r) => !r.entry.isDirectory).length;

  /**
   * Compute operation statistics for the right panel display.
   * Shows live stats during processing (from currentOperation),
   * or final stats after the last completed operation.
   */
  const operationStats = currentOperation
    ? {
        total: currentOperation.totalFiles,
        successful: currentOperation.successful,
        failed: currentOperation.failed,
        skipped: currentOperation.skipped,
      }
    : operationHistory.length > 0 &&
        (status === "Complete" || status.includes("cancel"))
      ? {
          total: operationHistory[0].totalFiles,
          successful: operationHistory[0].successful,
          failed: operationHistory[0].failed,
          skipped: operationHistory[0].skipped,
        }
      : null;

  return (
    <div className="h-full flex flex-col bg-background text-foreground animate-in fade-in duration-300">
      <PageHeader
        icon={Copy}
        title="Copy / Move"
        subtitle="Copy or move files between locations"
        info={fileCopyInfo}
        toolId="copy"
        right={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetDestPath();
              resetConflictResolution();
              resetPreserveStructure();
              resetFilterMode();
              resetExcludeTemp();
              setSelectedFiles(new Map());
              setSearchTerm("");
              setActiveFilters([]);
              setStatus("");
            }}
            className="text-xs gap-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        }
      />

      {/* ── Main Content: Left/Right Split Panel Layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Panel: Source Files ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Source toolbar with path, search, filters, and selection controls */}
          <CopyToolbar
            currentPath={currentPath}
            onPathChange={setCurrentPath}
            onBrowseSource={selectDirectory}
            recentPaths={recentPaths}
            favoritePaths={favoritePaths}
            onToggleFavorite={toggleFavorite}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            availableExtensions={availableExtensions}
            onToggleFilter={toggleFilter}
            filterMode={filterMode}
            onToggleFilterMode={() =>
              setFilterMode((prev) =>
                prev === "include" ? "exclude" : "include",
              )
            }
            excludeTemp={excludeTemp}
            onToggleExcludeTemp={setExcludeTemp}
            onSelectAll={handleSelectAll}
            onClearSelection={() => setSelectedFiles(new Map())}
            onInvertSelection={handleInvertSelection}
            hasSelection={selectedFiles.size > 0}
            isProcessing={isProcessing}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            visibleFileCount={searchTerm ? visibleFileCount : undefined}
          />

          {/* File Tree (takes remaining vertical space) */}
          <div className="flex-1 overflow-hidden">
            <ErrorBoundary>
              <FileTree
                key={treeKey}
                rootPath={currentPath}
                selectedPaths={new Set(selectedFiles.keys())}
                onSelectionChange={handleSelectionChange}
                onFolderSelectionToggle={handleFolderSelectionToggle}
                getDirectoryContents={getDirectoryContents}
                filterExtensions={activeFilters}
                filterMode={filterMode}
                searchTerm={searchTerm}
                excludeTemp={excludeTemp}
                lastClickedIndex={lastClickedIndex}
                onItemClick={handleItemClick}
                rows={rows}
                toggleExpand={toggleExpand}
                rootLoading={rootLoading}
                error={treeError}
                refreshRoot={refreshRoot}
              />
            </ErrorBoundary>
          </div>

          {/* Selection summary footer (visible when files are selected) */}
          {selectedFiles.size > 0 && (
            <div className="border-t px-4 py-2 flex items-center gap-3 bg-muted/30 text-xs">
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono font-semibold">
                  {selectedFiles.size}
                </div>
                <span className="text-muted-foreground">files selected</span>
              </div>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground font-mono">
                {totalSize < 1024
                  ? `${totalSize} B`
                  : totalSize < 1024 * 1024
                    ? `${(totalSize / 1024).toFixed(1)} KB`
                    : `${(totalSize / (1024 * 1024)).toFixed(2)} MB`}
              </span>
            </div>
          )}
        </div>

        {/* ── Right Panel: Destination & Preview ── */}
        <div className="w-[420px] border-l flex flex-col bg-slate-50/50 dark:bg-slate-900/50 relative">
          {/* Destination controls, options, action buttons, progress, and stats */}
          <div className="shrink-0 overflow-y-auto">
            <OperationControls
              destPath={destPath}
              onDestPathChange={setDestPath}
              onSelectDest={handleSelectDest}
              onCopy={() => executeOperation("copy")}
              onMove={() => executeOperation("move")}
              onCancel={handleCancelOperation}
              selectedCount={selectedFiles.size}
              totalSize={totalSize}
              isProcessing={isProcessing}
              progress={progress}
              status={status}
              conflictResolution={conflictResolution}
              onConflictResolutionChange={setConflictResolution}
              preserveStructure={preserveStructure}
              onPreserveStructureChange={setPreserveStructure}
              showHistory={showHistory}
              onToggleHistory={() => setShowHistory(!showHistory)}
              operationStats={operationStats}
            />
          </div>

          {/* Selected files preview area with history overlay */}
          <div className="flex-1 overflow-hidden relative min-h-0">
            {/* History Overlay Panel (slides over the preview when toggled) */}
            {showHistory && operationHistory.length > 0 && (
              <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-20 overflow-y-auto animate-in fade-in duration-200">
                <div className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Operation History</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowHistory(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 space-y-3">
                  {operationHistory.map((op, idx) => (
                    <Card key={idx} className="shadow-sm border-muted">
                      <CardHeader className="pb-2 p-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span className="capitalize font-semibold flex items-center gap-2">
                            {op.type === "copy" ? (
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-orange-500" />
                            )}
                            {op.type}
                          </span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {op.startTime.toLocaleTimeString()}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-2">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="text-green-600 font-medium">
                            {op.successful} ok
                          </div>
                          {op.failed > 0 && (
                            <div className="text-red-600 font-medium">
                              {op.failed} failed
                            </div>
                          )}
                          {op.skipped > 0 && (
                            <div className="text-yellow-600 font-medium">
                              {op.skipped} skip
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Selected files preview (only shows what has been selected) */}
            <div className="p-4 h-full">
              <SelectionPreview
                selectedFiles={selectedFiles}
                sourcePath={currentPath}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
