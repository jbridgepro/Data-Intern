/**
 * File: src/features/file-copy/utils/selectionUtils.ts
 *
 * Selection utilities for handling file and folder selection logic.
 * Supports recursive folder selection, indeterminate states, and smart selection operations.
 */

import { FileEntry } from "../hooks/useFileSystem";
import { getAllDescendants, getFilteredDescendants, FilterOptions } from "./filterUtils";
import { dirname } from "@tauri-apps/api/path";

/**
 * Represents the selection state of a folder
 */
export type FolderSelectionState = "none" | "partial" | "full";

/**
 * Gets the selection state of a folder based on its descendants.
 *
 * @returns "none" if no descendants selected, "full" if all selected, "partial" if some selected
 */
export function getFolderSelectionState(
  folderPath: string,
  descendants: FileEntry[],
  selectedPaths: Set<string>
): FolderSelectionState {
  if (descendants.length === 0) {
    return "none";
  }

  const selectedCount = descendants.filter(d => selectedPaths.has(d.path)).length;

  if (selectedCount === 0) {
    return "none";
  } else if (selectedCount === descendants.length) {
    return "full";
  } else {
    return "partial";
  }
}

/**
 * Toggles selection for a folder and all its descendants.
 */
export async function toggleFolderSelection(
  folder: FileEntry,
  currentSelection: Map<string, FileEntry>,
  getDirectoryContents: (path: string) => Promise<FileEntry[]>,
  filterOptions?: FilterOptions
): Promise<Map<string, FileEntry>> {
  const newSelection = new Map(currentSelection);

  // Get all descendants
  // Get all descendants (including folders)
  let descendants: FileEntry[];
  if (filterOptions) {
    descendants = await getFilteredDescendants(folder, getDirectoryContents, filterOptions, true);
  } else {
    descendants = await getAllDescendants(folder, getDirectoryContents, undefined, true);
  }

  // Check current state
  // For checking state, we only care about if *all* descendants are selected.
  // The logic in getFolderSelectionState remains valid, but now descendants includes the folders themselves.

  // Actually, we need to handle the folder itself specially? 
  // No, if includeFolders=true, 'descendants' includes 'folder' itself? 
  // Wait, getAllDescendants does NOT include the root 'prior' entry passed to it.
  // It only returns children. 
  // So we explicitly add the folder to the list of things to toggle.
  const itemsToToggle = [folder, ...descendants];

  // Determine if we are selecting or deselecting based on the FOLDER's current state mostly, 
  // or use the generic "all selected?" check.
  // Let's stick effectively to: if *everything* is selected, deselect. Otherwise select all.
  const allSelected = itemsToToggle.every(d => currentSelection.has(d.path));

  if (allSelected) {
    // Deselect all descendants AND the folder itself
    itemsToToggle.forEach(d => newSelection.delete(d.path));

    // Deselect ancestors to break their "Full" state
    try {
      let parentPath = await dirname(folder.path);
      // We loop up until we find no more parents or hit root (handled by dirname returning same or .)
      let lastPath = folder.path;
      while (parentPath && parentPath !== lastPath && parentPath !== "." && parentPath !== "/") {
        if (newSelection.has(parentPath)) {
          newSelection.delete(parentPath);
        }
        lastPath = parentPath;
        parentPath = await dirname(parentPath);
      }
    } catch (e) {
      console.error("Error handling ancestor deselect:", e);
    }

  } else {
    // Select all descendants (folders and files)
    itemsToToggle.forEach(d => newSelection.set(d.path, d));
  }

  return newSelection;
}

/**
 * Selects all visible files based on current filters.
 */
export async function selectAllVisible(
  rootPath: string,
  getDirectoryContents: (path: string) => Promise<FileEntry[]>,
  filterOptions: FilterOptions
): Promise<Map<string, FileEntry>> {
  const newSelection = new Map<string, FileEntry>();

  try {
    const allFiles = await getDirectoryContents(rootPath);

    for (const entry of allFiles) {
      if (entry.isDirectory) {
        // Check if folder is visible (e.g. not a system folder like .git)
        const { isFileVisible } = await import("./filterUtils");
        if (!isFileVisible(entry, filterOptions)) {
          continue;
        }

        // Recursively get descendants including folders
        const descendants = await getFilteredDescendants(entry, getDirectoryContents, filterOptions, true);
        // Add the folder itself
        newSelection.set(entry.path, entry);
        // Add descendants
        descendants.forEach(d => newSelection.set(d.path, d));
      } else {
        // Check if file is visible
        const { isFileVisible } = await import("./filterUtils");
        if (isFileVisible(entry, filterOptions)) {
          newSelection.set(entry.path, entry);
        }
      }
    }
  } catch (error) {
    console.error("Failed to select all visible files:", error);
  }

  return newSelection;
}

/**
 * Inverts the current selection (select unselected, deselect selected).
 */
export async function invertSelection(
  rootPath: string,
  currentSelection: Map<string, FileEntry>,
  getDirectoryContents: (path: string) => Promise<FileEntry[]>,
  filterOptions: FilterOptions
): Promise<Map<string, FileEntry>> {
  const newSelection = new Map<string, FileEntry>();

  try {
    const allFiles = await getDirectoryContents(rootPath);
    const currentPaths = new Set(currentSelection.keys());

    for (const entry of allFiles) {
      if (entry.isDirectory) {
        // Check if folder is visible
        const { isFileVisible } = await import("./filterUtils");
        if (!isFileVisible(entry, filterOptions)) {
          continue;
        }

        // Recursively get descendants including folders
        const descendants = await getFilteredDescendants(entry, getDirectoryContents, filterOptions, true);

        // Add the folder itself to the list (since getFilteredDescendants only returns children)
        const allItems = [entry, ...descendants];

        // Add if not currently selected
        allItems.forEach(d => {
          if (!currentPaths.has(d.path)) {
            newSelection.set(d.path, d);
          }
        });
      } else {
        // ... (files handled same)
        const { isFileVisible } = await import("./filterUtils");
        if (isFileVisible(entry, filterOptions) && !currentPaths.has(entry.path)) {
          newSelection.set(entry.path, entry);
        }
      }
    }
  } catch (error) {
    console.error("Failed to invert selection:", error);
  }

  return newSelection;
}

/**
 * Selects files in a range (for shift+click support).
 */
export function selectRange(
  entries: FileEntry[],
  startIndex: number,
  endIndex: number,
  currentSelection: Map<string, FileEntry>
): Map<string, FileEntry> {
  const newSelection = new Map(currentSelection);
  const [min, max] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

  for (let i = min; i <= max; i++) {
    const entry = entries[i];
    if (entry && !entry.isDirectory) {
      newSelection.set(entry.path, entry);
    }
  }

  return newSelection;
}

/**
 * Calculates selection statistics.
 */
export interface SelectionStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  filesByExtension: Map<string, number>;
}

export function calculateSelectionStats(selectedFiles: Map<string, FileEntry>): SelectionStats {
  const stats: SelectionStats = {
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
    filesByExtension: new Map(),
  };

  for (const entry of selectedFiles.values()) {
    if (entry.isDirectory) {
      stats.totalFolders++;
    } else {
      stats.totalFiles++;
      stats.totalSize += entry.size || 0;

      const ext = entry.extension ? entry.extension.toLowerCase() : "no-ext";
      stats.filesByExtension.set(ext, (stats.filesByExtension.get(ext) || 0) + 1);
    }
  }

  return stats;
}
