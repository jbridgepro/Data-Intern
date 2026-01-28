/**
 * File: src/features/file-mapper/utils/fileSystemScanner.ts
 * 
 * Backend utility for scanning directory structures and collecting metadata
 * including file sizes, dates, types, and hierarchical relationships.
 */

import { readDir, DirEntry, stat, rename, copyFile, mkdir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

// Extended file entry with full metadata
export interface FileSystemNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number; // in bytes
  modifiedDate: Date | null;
  createdDate: Date | null;
  extension: string;
  children?: FileSystemNode[];
  parent?: FileSystemNode;
  depth: number;
  fileCount?: number; // for directories: number of files within
  folderCount?: number; // for directories: number of subfolders
}

// Configuration for scanning
export interface ScanConfig {
  maxDepth: number;
  includeHidden: boolean;
  includeFiles: boolean;
  includeFolders: boolean;
  fileExtensions?: string[];
  excludeExtensions?: string[];
  excludePatterns?: string[];
  minSize?: number;
  maxSize?: number;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}

// Default configuration
const defaultConfig: ScanConfig = {
  maxDepth: 5,
  includeHidden: false,
  includeFiles: true,
  includeFolders: true,
};

/**
 * Recursively scan a directory and build a tree structure
 */
export async function scanDirectory(
  rootPath: string,
  config: Partial<ScanConfig> = {}
): Promise<FileSystemNode | null> {
  const finalConfig = { ...defaultConfig, ...config };

  try {
    const isBrowser = !(window as any).__TAURI_INTERNALS__;

    if (isBrowser) {
      // Return mock data for browser testing
      return createMockTree();
    }

    const rootNode = await scanDirectoryRecursive(
      rootPath,
      rootPath,
      0,
      finalConfig
    );

    // Calculate file and folder counts for directories
    if (rootNode) {
      calculateCounts(rootNode);
    }

    return rootNode;
  } catch (error) {
    console.error("Error scanning directory:", error);
    return null;
  }
}

/**
 * Recursive helper function to scan directory
 */
async function scanDirectoryRecursive(
  currentPath: string,
  rootPath: string,
  depth: number,
  config: ScanConfig
): Promise<FileSystemNode | null> {
  // Check depth limit
  if (depth > config.maxDepth) {
    return null;
  }

  try {
    // Get file stats
    const fileStat = await stat(currentPath);
    const isDirectory = fileStat.isDirectory;

    // Extract name and extension
    const pathParts = currentPath.split(/[/\\]/);
    const name = pathParts[pathParts.length - 1] || currentPath;
    const extension = isDirectory ? "" : name.split(".").pop()?.toLowerCase() || "";

    // Check if should be excluded
    if (shouldExclude(name, currentPath, config)) {
      return null;
    }

    // Check hidden files
    if (!config.includeHidden && name.startsWith(".")) {
      return null;
    }

    // Create node
    const node: FileSystemNode = {
      name,
      path: currentPath,
      isDirectory,
      size: fileStat.size || 0,
      modifiedDate: fileStat.mtime ? new Date(fileStat.mtime) : null,
      createdDate: fileStat.birthtime ? new Date(fileStat.birthtime) : null,
      extension,
      depth,
      children: [],
    };

    // If it's a directory, scan children
    if (isDirectory && config.includeFolders) {
      try {
        const entries = await readDir(currentPath);

        for (const entry of entries) {
          const childPath = `${currentPath}/${entry.name}`;
          const childNode = await scanDirectoryRecursive(
            childPath,
            rootPath,
            depth + 1,
            config
          );

          if (childNode) {
            childNode.parent = node;
            node.children!.push(childNode);
          }
        }

        // Sort children: folders first, then by name
        node.children!.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
      } catch (err) {
        console.warn(`Cannot read directory ${currentPath}:`, err);
      }
    }

    // Apply filters
    if (!passesFilters(node, config)) {
      return null;
    }

    return node;
  } catch (error) {
    console.error(`Error processing ${currentPath}:`, error);
    return null;
  }
}

/**
 * Check if a file/folder should be excluded
 */
function shouldExclude(
  name: string,
  path: string,
  config: ScanConfig
): boolean {
  // Check exclude patterns
  if (config.excludePatterns) {
    for (const pattern of config.excludePatterns) {
      if (name.includes(pattern) || path.includes(pattern)) {
        return true;
      }
    }
  }

  // Check exclude extensions
  if (config.excludeExtensions && !name.includes(".")) {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (config.excludeExtensions.includes(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a node passes all filters
 */
function passesFilters(node: FileSystemNode, config: ScanConfig): boolean {
  // File type filters
  if (!node.isDirectory) {
    if (!config.includeFiles) return false;

    // Extension filter
    if (config.fileExtensions && config.fileExtensions.length > 0) {
      const ext = node.extension;
      const matches = config.fileExtensions.some(
        (pattern) => pattern.replace("*", "") === ext || pattern === `*.${ext}`
      );
      if (!matches) return false;
    }

    // Size filters
    if (config.minSize !== undefined && node.size < config.minSize) {
      return false;
    }
    if (config.maxSize !== undefined && node.size > config.maxSize) {
      return false;
    }

    // Date filters
    if (config.modifiedAfter && node.modifiedDate) {
      if (node.modifiedDate < config.modifiedAfter) return false;
    }
    if (config.modifiedBefore && node.modifiedDate) {
      if (node.modifiedDate > config.modifiedBefore) return false;
    }
  } else {
    if (!config.includeFolders) return false;
  }

  return true;
}

/**
 * Calculate file and folder counts for directories
 */
function calculateCounts(node: FileSystemNode): void {
  if (!node.isDirectory || !node.children) {
    return;
  }

  let fileCount = 0;
  let folderCount = 0;

  for (const child of node.children) {
    if (child.isDirectory) {
      folderCount++;
      calculateCounts(child);
      fileCount += child.fileCount || 0;
      folderCount += child.folderCount || 0;
    } else {
      fileCount++;
    }
  }

  node.fileCount = fileCount;
  node.folderCount = folderCount;
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get total size of a directory tree
 */
export function getTotalSize(node: FileSystemNode): number {
  if (!node.isDirectory || !node.children) {
    return node.size;
  }

  return node.children.reduce((total, child) => total + getTotalSize(child), 0);
}

/**
 * Get total file count
 */
export function getTotalFileCount(node: FileSystemNode): number {
  if (!node.isDirectory || !node.children) {
    return node.isDirectory ? 0 : 1;
  }

  return node.children.reduce(
    (total, child) => total + getTotalFileCount(child),
    0
  );
}

/**
 * Get total folder count
 */
export function getTotalFolderCount(node: FileSystemNode): number {
  if (!node.isDirectory || !node.children) {
    return 0;
  }

  return (
    1 +
    node.children.reduce(
      (total, child) => total + getTotalFolderCount(child),
      0
    )
  );
}

/**
 * Create mock tree for browser testing
 */
function createMockTree(): FileSystemNode {
  return {
    name: "Projects",
    path: "/Users/justin/Projects",
    isDirectory: true,
    size: 0,
    modifiedDate: new Date(),
    createdDate: new Date(),
    extension: "",
    depth: 0,
    children: [
      {
        name: "WebApp",
        path: "/Users/justin/Projects/WebApp",
        isDirectory: true,
        size: 0,
        modifiedDate: new Date(),
        createdDate: new Date(),
        extension: "",
        depth: 1,
        children: [
          {
            name: "src",
            path: "/Users/justin/Projects/WebApp/src",
            isDirectory: true,
            size: 0,
            modifiedDate: new Date(),
            createdDate: new Date(),
            extension: "",
            depth: 2,
            children: [
              {
                name: "components",
                path: "/Users/justin/Projects/WebApp/src/components",
                isDirectory: true,
                size: 0,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "",
                depth: 3,
                children: [
                  {
                    name: "Header.jsx",
                    path: "/Users/justin/Projects/WebApp/src/components/Header.jsx",
                    isDirectory: false,
                    size: 2350,
                    modifiedDate: new Date(),
                    createdDate: new Date(),
                    extension: "jsx",
                    depth: 4,
                  },
                  {
                    name: "Footer.jsx",
                    path: "/Users/justin/Projects/WebApp/src/components/Footer.jsx",
                    isDirectory: false,
                    size: 1840,
                    modifiedDate: new Date(),
                    createdDate: new Date(),
                    extension: "jsx",
                    depth: 4,
                  },
                  {
                    name: "Sidebar.jsx",
                    path: "/Users/justin/Projects/WebApp/src/components/Sidebar.jsx",
                    isDirectory: false,
                    size: 3100,
                    modifiedDate: new Date(),
                    createdDate: new Date(),
                    extension: "jsx",
                    depth: 4,
                  },
                ],
              },
              {
                name: "utils",
                path: "/Users/justin/Projects/WebApp/src/utils",
                isDirectory: true,
                size: 0,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "",
                depth: 3,
                children: [
                  {
                    name: "helpers.js",
                    path: "/Users/justin/Projects/WebApp/src/utils/helpers.js",
                    isDirectory: false,
                    size: 4200,
                    modifiedDate: new Date(),
                    createdDate: new Date(),
                    extension: "js",
                    depth: 4,
                  },
                  {
                    name: "validation.js",
                    path: "/Users/justin/Projects/WebApp/src/utils/validation.js",
                    isDirectory: false,
                    size: 2900,
                    modifiedDate: new Date(),
                    createdDate: new Date(),
                    extension: "js",
                    depth: 4,
                  },
                ],
              },
              {
                name: "index.js",
                path: "/Users/justin/Projects/WebApp/src/index.js",
                isDirectory: false,
                size: 1200,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "js",
                depth: 3,
              },
            ],
          },
          {
            name: "public",
            path: "/Users/justin/Projects/WebApp/public",
            isDirectory: true,
            size: 0,
            modifiedDate: new Date(),
            createdDate: new Date(),
            extension: "",
            depth: 2,
            children: [
              {
                name: "logo.png",
                path: "/Users/justin/Projects/WebApp/public/logo.png",
                isDirectory: false,
                size: 45000,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "png",
                depth: 3,
              },
              {
                name: "index.html",
                path: "/Users/justin/Projects/WebApp/public/index.html",
                isDirectory: false,
                size: 1100,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "html",
                depth: 3,
              },
            ],
          },
          {
            name: "package.json",
            path: "/Users/justin/Projects/WebApp/package.json",
            isDirectory: false,
            size: 892,
            modifiedDate: new Date(),
            createdDate: new Date(),
            extension: "json",
            depth: 2,
          },
          {
            name: "README.md",
            path: "/Users/justin/Projects/WebApp/README.md",
            isDirectory: false,
            size: 1500,
            modifiedDate: new Date(),
            createdDate: new Date(),
            extension: "md",
            depth: 2,
          },
        ],
      },
      {
        name: "DataAnalysis",
        path: "/Users/justin/Projects/DataAnalysis",
        isDirectory: true,
        size: 0,
        modifiedDate: new Date(),
        createdDate: new Date(),
        extension: "",
        depth: 1,
        children: [
          {
            name: "notebooks",
            path: "/Users/justin/Projects/DataAnalysis/notebooks",
            isDirectory: true,
            size: 0,
            modifiedDate: new Date(),
            createdDate: new Date(),
            extension: "",
            depth: 2,
            children: [
              {
                name: "exploration.ipynb",
                path: "/Users/justin/Projects/DataAnalysis/notebooks/exploration.ipynb",
                isDirectory: false,
                size: 124000,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "ipynb",
                depth: 3,
              },
              {
                name: "analysis.ipynb",
                path: "/Users/justin/Projects/DataAnalysis/notebooks/analysis.ipynb",
                isDirectory: false,
                size: 98000,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "ipynb",
                depth: 3,
              },
            ],
          },
          {
            name: "data",
            path: "/Users/justin/Projects/DataAnalysis/data",
            isDirectory: true,
            size: 0,
            modifiedDate: new Date(),
            createdDate: new Date(),
            extension: "",
            depth: 2,
            children: [
              {
                name: "sales_2024.csv",
                path: "/Users/justin/Projects/DataAnalysis/data/sales_2024.csv",
                isDirectory: false,
                size: 2300000,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "csv",
                depth: 3,
              },
              {
                name: "customers.csv",
                path: "/Users/justin/Projects/DataAnalysis/data/customers.csv",
                isDirectory: false,
                size: 1800000,
                modifiedDate: new Date(),
                createdDate: new Date(),
                extension: "csv",
                depth: 3,
              },
            ],
          },
        ],
      },
      {
        name: ".gitignore",
        path: "/Users/justin/Projects/.gitignore",
        isDirectory: false,
        size: 234,
        modifiedDate: new Date(),
        createdDate: new Date(),
        extension: "gitignore",
        depth: 1,
      },
    ],
  };
}
/**
 * Move a file or directory
 */
export async function moveNode(
  sourcePath: string,
  destPath: string
): Promise<void> {
  const isBrowser = !(window as any).__TAURI_INTERNALS__;
  if (isBrowser) {
    console.log(`[Mock] Moving ${sourcePath} to ${destPath}`);
    return;
  }

  try {
    await rename(sourcePath, destPath);
  } catch (error) {
    console.error(`Error moving ${sourcePath} to ${destPath}:`, error);
    throw error;
  }
}

/**
 * Copy a file or directory (recursive)
 */
export async function copyNode(
  sourcePath: string,
  destPath: string,
  isDirectory: boolean
): Promise<void> {
  const isBrowser = !(window as any).__TAURI_INTERNALS__;
  if (isBrowser) {
    console.log(`[Mock] Copying ${sourcePath} to ${destPath}`);
    return;
  }

  try {
    if (isDirectory) {
      // Create destination directory
      await mkdir(destPath, { recursive: true });

      // Read source directory
      const entries = await readDir(sourcePath);

      // Recursively copy contents
      for (const entry of entries) {
        const srcChildPath = `${sourcePath}/${entry.name}`; // Simple concatenation for now, ideal to use join if possible but basic string op works for exact paths usually
        const destChildPath = `${destPath}/${entry.name}`;

        // We need to know if child is directory. 
        // In current tauri-plugin-fs, readDir returns DirEntry which has isDirectory (if detailed) OR name only.
        // Actually readDir returns Array<DirEntry> where DirEntry { name: string, isDirectory: boolean, ... }

        await copyNode(srcChildPath, destChildPath, entry.isDirectory);
      }
    } else {
      await copyFile(sourcePath, destPath);
    }
  } catch (error) {
    console.error(`Error copying ${sourcePath} to ${destPath}:`, error);
    throw error;
  }
}
