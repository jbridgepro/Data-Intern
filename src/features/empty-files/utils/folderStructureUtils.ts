/**
 * File: src/features/empty-files/utils/folderStructureUtils.ts
 *
 * Back-end: Utilities for loading and representing folder structure.
 * Used by the File Creation page to support folder mapping for multi-file creation.
 * Supports lazy-loading of deep directory trees for performance.
 */

import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";

/** Represents a folder in the tree with optional lazy-loaded children */
export interface FolderTreeNode {
  /** Unique identifier: full path */
  id: string;
  /** Display name of the folder */
  name: string;
  /** Full absolute path */
  path: string;
  /** Relative display path from root (e.g. "Documents/Reports") */
  displayPath: string;
  /** Child folders - populated on expand (lazy load) */
  children?: FolderTreeNode[];
  /** Whether children have been loaded */
  loaded?: boolean;
  /** Depth from root (0 = root) */
  depth: number;
}

/** Flat option for dropdown selection */
export interface FolderOption {
  value: string;
  label: string;
  /** Full path for display and creation */
  path: string;
  /** Display path relative to root (e.g. "Root" or "Documents/Reports") */
  displayPath: string;
}

/**
 * Loads immediate subfolders of a given path (one level).
 * Used for lazy-loading deep structures.
 *
 * @param rootPath - Root directory path
 * @param currentPath - Path to load children for
 * @returns Array of folder nodes for direct children
 */
export async function loadFolderChildren(
  rootPath: string,
  currentPath: string
): Promise<FolderTreeNode[]> {
  const isBrowser = !(window as any).__TAURI_INTERNALS__;
  if (isBrowser) {
    // Mock data for browser dev
    const mockNames = ["Documents", "Downloads", "Projects", "Assets", "Deliverables", "Communications"];
    return mockNames.map((name) => ({
      id: `${currentPath}/${name}`,
      name,
      path: `${currentPath}/${name}`,
      displayPath: rootPath === currentPath ? name : `${currentPath.replace(rootPath + "/", "")}/${name}`,
      depth: currentPath.split("/").filter(Boolean).length - rootPath.split("/").filter(Boolean).length + 1,
      loaded: false,
    }));
  }

  const pathExists = await exists(currentPath);
  if (!pathExists) return [];

  const entries = await readDir(currentPath);
  const dirs = entries.filter((e) => e.isDirectory && !e.name.startsWith("."));
  const folderNodes: FolderTreeNode[] = [];

  const rootDisplayBase = rootPath === currentPath ? "" : currentPath.replace(rootPath + "/", "") + "/";

  for (const entry of dirs) {
    const fullPath = await join(currentPath, entry.name);
    const displayPath = rootPath === currentPath ? entry.name : `${rootDisplayBase}${entry.name}`;

    folderNodes.push({
      id: fullPath,
      name: entry.name,
      path: fullPath,
      displayPath,
      depth: currentPath.split("/").filter(Boolean).length - rootPath.split("/").filter(Boolean).length + 1,
      loaded: false,
    });
  }

  return folderNodes.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively loads folder structure up to a given depth.
 * Used when user selects root path - loads initial tree for display.
 *
 * @param rootPath - Root directory path
 * @param maxDepth - Maximum depth to load (default 4 for performance)
 * @returns Root node with children (or flat list of options)
 */
export async function loadFolderTree(
  rootPath: string,
  maxDepth: number = 4
): Promise<FolderTreeNode[]> {
  return loadFolderChildrenRecursive(rootPath, rootPath, 0, maxDepth);
}

async function loadFolderChildrenRecursive(
  rootPath: string,
  currentPath: string,
  depth: number,
  maxDepth: number
): Promise<FolderTreeNode[]> {
  if (depth >= maxDepth) return [];

  const children = await loadFolderChildren(rootPath, currentPath);

  for (const child of children) {
    if (depth + 1 < maxDepth) {
      child.children = await loadFolderChildrenRecursive(rootPath, child.path, depth + 1, maxDepth);
      child.loaded = true;
    }
  }

  return children;
}

/**
 * Flattens folder tree into a list of options for dropdown/selection.
 * Includes root as first option, then all nested folders with display paths.
 *
 * @param rootPath - Root directory path
 * @param tree - Loaded folder tree (direct children of root)
 * @returns Flat array of folder options
 */
export function flattenFolderOptions(
  rootPath: string,
  tree: FolderTreeNode[]
): FolderOption[] {
  const options: FolderOption[] = [
    { value: rootPath, label: "Root Folder", path: rootPath, displayPath: "Root" },
  ];

  function walk(nodes: FolderTreeNode[], prefix: string) {
    for (const node of nodes) {
      const displayPath = prefix ? `${prefix}/${node.name}` : node.name;
      options.push({
        value: node.path,
        label: displayPath,
        path: node.path,
        displayPath,
      });
      if (node.children && node.children.length > 0) {
        walk(node.children, displayPath);
      }
    }
  }

  walk(tree, "");
  return options;
}

/**
 * Builds flat folder options from root path by loading structure.
 * Convenience function that loads and flattens in one call.
 */
export async function getFolderOptions(rootPath: string): Promise<FolderOption[]> {
  const tree = await loadFolderTree(rootPath);
  return flattenFolderOptions(rootPath, tree);
}
