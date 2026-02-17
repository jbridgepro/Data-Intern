/**
 * File: src/features/file-copy/utils/filterUtils.ts
 *
 * Centralized filtering logic for file selection and visibility.
 * Ensures consistency between tree rendering and selection operations.
 */

import { FileEntry } from "../hooks/useFileSystem";

export interface FilterOptions {
  searchTerm?: string;
  filterExtensions?: string[];
  filterMode?: "include" | "exclude";
  excludeTemp?: boolean;
}

/**
 * Checks if a file/folder name matches system or temporary file patterns.
 */
export function isSystemOrTemp(name: string): boolean {
  return (
    name.startsWith("~$") ||
    name.startsWith(".") ||
    name.endsWith(".tmp") ||
    name.endsWith(".bak") ||
    name === "Thumbs.db" ||
    name === ".DS_Store" ||
    name === "node_modules" // Explicitly exclude node_modules as well
  );
}

/**
 * Checks if a file entry should be visible based on current filters.
 * This function is used for both rendering and selection operations.
 */
export function isFileVisible(entry: FileEntry, options: FilterOptions): boolean {
  const {
    searchTerm,
    filterExtensions = [],
    filterMode = "exclude",
    excludeTemp = false,
  } = options;

  // 1. System/Temp exclusion (applies to both files and folders)
  if (excludeTemp && isSystemOrTemp(entry.name)) {
    return false;
  }

  // 2. Folders are otherwise visible (if not excluded by above)
  if (entry.isDirectory) {
    return true;
  }

  // 3. Extension filtering (Files only)
  // When extensions are actively selected, apply them as a filter.
  // When NO extensions are selected: in exclude mode show everything,
  // in include mode show everything ONLY if a search term is active
  // (so the search isn't blocked), otherwise hide all files.
  const hasActiveSearch = searchTerm && searchTerm.trim().length > 0;

  if (filterExtensions.length > 0) {
    const ext = entry.extension ? entry.extension.toLowerCase() : "{no-ext}";

    if (filterMode === "exclude") {
      // In exclude mode, hide if extension is in the filter list
      if (filterExtensions.includes(ext)) {
        return false;
      }
    } else {
      // In include mode, hide if extension is NOT in the filter list
      if (!filterExtensions.includes(ext)) {
        return false;
      }
    }
  } else if (filterMode === "include" && !hasActiveSearch) {
    // In include mode with no extensions selected AND no search active,
    // hide all files (user needs to pick at least one extension).
    // When search IS active, skip this rule so matching files of any type show.
    return false;
  }

  // 4. Search term filtering (Files only)
  // We typically don't filter folders by search term to allow navigation to children that match
  if (hasActiveSearch) {
    if (!entry.name.toLowerCase().includes(searchTerm!.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * Filters an array of file entries based on the given options.
 */
export function filterEntries(entries: FileEntry[], options: FilterOptions): FileEntry[] {
  return entries.filter(entry => isFileVisible(entry, options));
}

/**
 * Gets all visible (non-directory) files from a list, respecting filters.
 */
export function getVisibleFiles(entries: FileEntry[], options: FilterOptions): FileEntry[] {
  return entries.filter(entry => !entry.isDirectory && isFileVisible(entry, options));
}

/**
 * Counts visible files in an array of entries.
 */
export function countVisibleFiles(entries: FileEntry[], options: FilterOptions): number {
  return getVisibleFiles(entries, options).length;
}

/**
 * Gets all descendant file entries from a folder using queue-based traversal.
 * Prevents stack overflow on deeply nested directories.
 * Used for folder selection and recursive operations.
 */
export async function getAllDescendants(
  entry: FileEntry,
  getDirectoryContents: (path: string) => Promise<FileEntry[]>,
  options?: FilterOptions,
  includeFolders: boolean = false
): Promise<FileEntry[]> {
  if (!entry.isDirectory) {
    return [entry];
  }

  const descendants: FileEntry[] = [];
  const queue: FileEntry[] = [entry];
  const maxItems = 100_000; // Revised safety limit
  const processedPaths = new Set<string>();

  while (queue.length > 0 && descendants.length < maxItems) {
    const current = queue.shift()!;

    // Avoid cycles or redundant processing
    if (processedPaths.has(current.path)) continue;
    processedPaths.add(current.path);

    try {
      if (current.isDirectory) {
        // Skip traversal if it's a system/temp folder and we are excluding them
        if (options?.excludeTemp && isSystemOrTemp(current.name)) {
          continue;
        }

        const children = await getDirectoryContents(current.path);

        for (const child of children) {
          if (child.isDirectory) {
            // Check visibility/exclusion before adding to queue
            if (options?.excludeTemp && isSystemOrTemp(child.name)) {
              continue;
            }

            // Add the directory itself if requested
            if (includeFolders) {
              descendants.push(child);
            }
            // Add directory to queue for processing its children
            queue.push(child);
          } else {
            // Add file to descendants
            descendants.push(child);
          }
        }
      } else {
        // Not a directory, add as descendant
        descendants.push(current);
      }
    } catch (error) {
      //   console.error(`Failed to get descendants of ${current.path}:`, error);
      // Suppress error log for permission issues during bulk traversal
      // or maybe just warn
    }
  }

  if (descendants.length >= maxItems) {
    console.warn(`getAllDescendants hit safety limit of ${maxItems} items`);
  }

  return descendants;
}

/**
 * Recursively gets all descendant file entries from a folder, respecting filters.
 */
export async function getFilteredDescendants(
  entry: FileEntry,
  getDirectoryContents: (path: string) => Promise<FileEntry[]>,
  options: FilterOptions,
  includeFolders: boolean = false
): Promise<FileEntry[]> {
  // Pass options to getAllDescendants to enable optimized traversal (skipping ignored folders)
  const allDescendants = await getAllDescendants(entry, getDirectoryContents, options, includeFolders);
  return allDescendants.filter(file => isFileVisible(file, options));
}
