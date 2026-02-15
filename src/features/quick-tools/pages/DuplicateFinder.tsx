
import React, { useState, useCallback } from "react";
import { Files, Folder, Search, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileEntry {
  name: string;
  path: string;
  size: number;
  hash?: string;
}

interface DuplicateGroup {
  hash: string;
  files: FileEntry[];
  size: number;
}

export const DuplicateFinder: React.FC = () => {
  const [directory, setDirectory] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectDirectory = async () => {
    try {
      // Use Tauri's dialog if available, otherwise fallback
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Directory to Scan",
      });

      if (selected && typeof selected === "string") {
        setDirectory(selected);
      }
    } catch (err) {
      // Fallback for web environment
      setError("Directory picker not available in this environment.");
    }
  };

  const scanForDuplicates = async () => {
    if (!directory) return;

    setIsScanning(true);
    setError(null);
    setDuplicates([]);

    try {
      // Use Tauri's fs plugin to read directory
      const { readDir } = await import("@tauri-apps/plugin-fs");

      const entries = await readDir(directory);

      // Group files by size first (quick filter)
      const filesBySize: Map<number, FileEntry[]> = new Map();

      for (const entry of entries) {
        if (entry.isFile && entry.name) {
          const size = 0; // In real implementation, get actual size
          const file: FileEntry = {
            name: entry.name,
            path: `${directory}/${entry.name}`,
            size,
          };

          if (!filesBySize.has(size)) {
            filesBySize.set(size, []);
          }
          filesBySize.get(size)!.push(file);
        }
      }

      // Find groups with more than one file (potential duplicates)
      const potentialDuplicates: DuplicateGroup[] = [];

      for (const [size, files] of filesBySize) {
        if (files.length > 1) {
          // In a real implementation, compute hash for each file
          // For now, group by name similarity
          const nameGroups: Map<string, FileEntry[]> = new Map();

          for (const file of files) {
            const baseName = file.name.replace(/\s*\(\d+\)/, "").toLowerCase();
            if (!nameGroups.has(baseName)) {
              nameGroups.set(baseName, []);
            }
            nameGroups.get(baseName)!.push(file);
          }

          for (const [name, group] of nameGroups) {
            if (group.length > 1) {
              potentialDuplicates.push({
                hash: name,
                files: group,
                size,
              });
            }
          }
        }
      }

      setDuplicates(potentialDuplicates);

      // Calculate potential savings
      const savings = potentialDuplicates.reduce(
        (acc, group) => acc + group.size * (group.files.length - 1),
        0
      );
      setTotalSaved(savings);
    } catch (err: any) {
      setError(err.message || "Failed to scan directory");
    } finally {
      setIsScanning(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
            <Files className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Duplicate Finder
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Find and manage duplicate files
            </p>
          </div>
        </div>
        <button
          onClick={scanForDuplicates}
          disabled={!directory || isScanning}
          className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {isScanning ? "Scanning..." : "Scan"}
        </button>
      </div>

      {/* Directory Selector */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Directory to Scan
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            placeholder="/path/to/directory"
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          />
          <button
            onClick={selectDirectory}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Folder className="h-4 w-4" />
            Browse
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {duplicates.length} duplicate group(s) found
          </span>
          {totalSaved > 0 && (
            <span className="text-sm text-rose-600 dark:text-rose-400">
              Potential savings: {formatSize(totalSaved)}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {duplicates.length === 0 && !isScanning && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Files className="h-12 w-12 mb-4" />
              <p className="text-sm">No duplicates found yet. Select a directory and scan.</p>
            </div>
          )}

          {duplicates.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-4"
            >
              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                {group.files.length} duplicates
              </div>
              <ul className="space-y-1">
                {group.files.map((file, fileIndex) => (
                  <li
                    key={fileIndex}
                    className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 font-mono"
                  >
                    <span className="truncate">{file.path}</span>
                    <span className="text-xs text-slate-400">{formatSize(file.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
