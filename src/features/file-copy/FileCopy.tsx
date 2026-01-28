/**
 * File: src/features/file-copy/FileCopy.tsx
 *
 * Front-end component for the File Copy Tab.
 * Now refactored to use CopyToolbar and OperationControls components.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useFileSystem, FileEntry } from "./hooks/useFileSystem";
import { FileTree } from "./components/FileTree";
import { OperationControls } from "./components/OperationControls";
import { CopyToolbar } from "./components/CopyToolbar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  X,
  CheckCircle,
  RotateCcw
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { join, dirname, basename } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { usePersistentState } from "../../hooks/usePersistentState";

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

  const [destPath, setDestPath, resetDestPath] = usePersistentState("file-copy-dest-path", "");
  const [selectedFiles, setSelectedFiles] = useState<Map<string, FileEntry>>(
    new Map(),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [treeKey, setTreeKey] = useState(0); // For forcing refresh
  const cancelRef = useRef(false);

  // Conflict resolution
  const [conflictResolution, setConflictResolution, resetConflictResolution] =
    usePersistentState<ConflictResolution>("file-copy-conflict-res", "ask");
  const [preserveStructure, setPreserveStructure, resetPreserveStructure] = usePersistentState("file-copy-preserve-struct", false);

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
  const [filterMode, setFilterMode, resetFilterMode] = usePersistentState<"include" | "exclude">("file-copy-filter-mode", "exclude");
  const [excludeTemp, setExcludeTemp, resetExcludeTemp] = usePersistentState("file-copy-exclude-temp", true);
  const [availableExtensions, setAvailableExtensions] = useState<string[]>([]);

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
            const ext = file.extension ? file.extension.toLowerCase() : "{no-ext}";
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: Select all visible files
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !isProcessing) {
        // Only if focus is not in an input
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
            e.preventDefault();
            handleSelectAll();
        }
      }
      // Ctrl/Cmd + D: Deselect all
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && !isProcessing) {
         if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
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

  const handleSelectAll = useCallback(async () => {
    if (!currentPath) return;
    try {
      const allFiles = await getDirectoryContents(currentPath);
      // Apply filters
      const newSelection = new Map<string, FileEntry>();
      
      allFiles.forEach((file) => {
        let isVisible = true;

        // Check extension filtering
        if (!file.isDirectory) {
             const ext = file.extension ? file.extension.toLowerCase() : "{no-ext}";
             
             if (filterMode === "exclude") {
                 // Exclude mode: only hide if in activeFilters
                 if (activeFilters.length > 0 && activeFilters.includes(ext)) {
                     isVisible = false;
                 }
             } else {
                 // Include mode: hide if NOT in activeFilters
                 // If activeFilters is empty, strictly nothing is included -> hide all
                 if (activeFilters.length === 0 || !activeFilters.includes(ext)) {
                     isVisible = false;
                 }
             }
        }

        if (
          searchTerm &&
          !file.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          isVisible = false;
        }

        if (excludeTemp) {
          const name = file.name;
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

        if (isVisible) {
          newSelection.set(file.path, file);
        }
      });

      setSelectedFiles(newSelection);
    } catch (error) {
      console.error("Failed to select all files:", error);
    }
  }, [
    currentPath,
    getDirectoryContents,
    activeFilters,
    filterMode,
    searchTerm,
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

    const total = selectedFiles.size;
    let completed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    const files = Array.from(selectedFiles.values());
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

    // Helper for recursive copy/move
    const processEntry = async (entryPath: string, targetPath: string, isMove: boolean): Promise<void> => {
        const parentDir = await dirname(entryPath);
        const stats = await getDirectoryContents(parentDir).then(files => files.find(f => f.path === entryPath));
        const isDir = stats?.isDirectory;
        
        if (isDir) {
           await mkdir(targetPath, { recursive: true });
           const children = await getDirectoryContents(entryPath);
           for (const child of children) {
              const childTarget = await join(targetPath, child.name);
              await processEntry(child.path, childTarget, isMove);
           }
           if (isMove) {
              // Delete source directory after moving children? 
              // tauri's rename might handle directory moves atomically if on same device, 
              // but for safety/consistency with copy structure we might leave this to specific moveFile impl 
              // or assume specific moveFile handles directories if supported.
              // Actually, standard rename DOES handle directories. 
              // So for Move, we can likely skip recursion if rename works.
              // BUT if rename fails (cross-device), we'd need copy+delete. 
              // For now, let's assume rename works for directories.
           }
        } else {
           if (isMove) {
               await moveFile(entryPath, targetPath);
           } else {
               await copyFile(entryPath, targetPath);
           }
        }
    };

    for (const file of files) {
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
            } catch (e) { /* ignore */ }
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
            } catch (e) { /* ignore */ }
            
            // Try atomic move first
            try {
                await moveFile(file.path, targetPath);
            } catch (err) {
                // If atomic move fails (e.g. directory), fall back to recursive copy + delete?
                // Or just error for now. 
                // Let's assume file.isDirectory -> special handling if we want robust directory move
                 if (file.isDirectory) {
                     // For directories, if simple rename failed, we might need recursion if cross-device
                     // But simpler to just use processEntry-like logic for copy
                     // For now let's hope rename works for dirs (it should on same volume)
                     // If not, we error.
                     throw err; 
                 }
                 throw err;
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

  return (
    <div className="h-full flex flex-col bg-background text-foreground animate-in fade-in duration-300">
      
      {/* 1. Top Toolbar */}
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
        onToggleFilterMode={() => setFilterMode(prev => prev === "include" ? "exclude" : "include")}
        excludeTemp={excludeTemp}
        onToggleExcludeTemp={setExcludeTemp}
        onSelectAll={handleSelectAll}
        onClearSelection={() => setSelectedFiles(new Map())}
        hasSelection={selectedFiles.size > 0}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory(!showHistory)}
        isProcessing={isProcessing}
      />
      
      {/* Reset Bar */}
      <div className="flex justify-end p-2 bg-slate-50 border-b dark:bg-slate-900 border-slate-200 dark:border-slate-800">
           <Button
             variant="ghost" 
             size="sm"
             onClick={() => {
                 resetDestPath();
                 resetConflictResolution();
                 resetPreserveStructure();
                 resetFilterMode();
                 resetExcludeTemp();
                 
                 // Local UI
                 setSelectedFiles(new Map());
                 setSearchTerm("");
                 setActiveFilters([]);
             }}
             className="text-xs gap-2 text-muted-foreground hover:text-foreground"
           >
             <RotateCcw className="h-3 w-3" />
             Reset Copy Tool
           </Button>
      </div>

      {/* 2. Main Content Area (Stack) */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        
        {/* History Overlay Panel */}
        {showHistory && operationHistory.length > 0 && (
          <div className="absolute top-0 right-0 w-[420px] h-full bg-background/95 backdrop-blur-sm border-l z-20 shadow-2xl overflow-y-auto transition-transform animate-in slide-in-from-right-4">
            <div className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between">
              <h3 className="font-semibold">Operation History</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {operationHistory.map((op, idx) => (
                <Card
                  key={idx}
                  className="shadow-sm border-muted"
                >
                  <CardHeader className="pb-2 p-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="capitalize font-semibold flex items-center gap-2">
                        {op.type === 'copy' ? <CheckCircle className="h-4 w-4 text-blue-500"/> : <CheckCircle className="h-4 w-4 text-orange-500"/>}
                        {op.type}
                      </span>
                      <span className="text-xs text-muted-foreground font-normal">
                        {op.startTime.toLocaleTimeString()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
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
                    {/* Log details toggle (could be added) */}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* File Tree */}
        <ErrorBoundary>
          <FileTree
            key={treeKey}
            rootPath={currentPath}
            selectedPaths={new Set(selectedFiles.keys())}
            onSelectionChange={handleSelectionChange}
            getDirectoryContents={getDirectoryContents}
            filterExtensions={activeFilters}
            filterMode={filterMode}
            searchTerm={searchTerm}
            excludeTemp={excludeTemp}
          />
        </ErrorBoundary>
      </div>

      {/* 3. Footer Operations */}
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
      />
    </div>
  );
};
