/**
 * File: src/features/empty-files/utils/propagationUtils.ts
 *
 * Back-end: Pattern-based file propagation logic.
 * Expands a single destination into multiple targets based on naming conventions
 * and structural patterns across main folders and subfolders.
 */

import { readDir } from "@tauri-apps/plugin-fs";
import { join, dirname } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";

/** Destination mode for file placement */
export type DestinationMode =
  | "manual"
  | "pattern-main"
  | "pattern-subfolders"
  | "pattern-main-and-subfolders";

/** A single propagation target (folder path where file will be created) */
export interface PropagationTarget {
  folderPath: string;
  displayPath: string;
  /** Whether user has excluded this from creation */
  excluded?: boolean;
}

/** Result of expanding an entry for propagation */
export interface PropagationResult {
  /** Original destination folder */
  sourceFolder: string;
  /** All target folders (before exclusions) */
  targets: PropagationTarget[];
  /** Detected pattern description for UI */
  patternDescription?: string;
}

/**
 * Gets the parent directory of rootPath.
 * Used when rootPath might be a specific main folder - we need its parent to find siblings.
 */
export function getContainerPath(rootPath: string, destinationFolder: string): string {
  // If destination equals root, container is rootPath
  if (destinationFolder === rootPath) return rootPath;
  // If destination is rootPath/Subfolder, container is rootPath
  if (destinationFolder.startsWith(rootPath + "/")) {
    const rest = destinationFolder.slice(rootPath.length + 1);
    const parts = rest.split("/");
    if (parts.length === 1) {
      // destination is rootPath/MainFolder - container is rootPath (parent of main folders)
      return rootPath;
    }
    // destination is rootPath/MainFolder/Subfolder - container is rootPath
    return rootPath;
  }
  return rootPath;
}

/**
 * Extracts the main folder name from a destination path relative to rootPath.
 * E.g. rootPath=/Projects, dest=/Projects/001-Client/Documents -> mainFolder=001-Client
 */
function getMainFolderName(rootPath: string, destPath: string): string | null {
  if (destPath === rootPath) return null;
  const relative = destPath.replace(rootPath + "/", "").replace(rootPath, "");
  const parts = relative.split("/").filter(Boolean);
  return parts[0] ?? null;
}

/**
 * Extracts the subfolder path (relative to main folder) from destination.
 * E.g. dest=/Projects/001-Client/Documents/Reports -> subfolderPath=Documents/Reports
 */
function getSubfolderPath(rootPath: string, destPath: string): string | null {
  if (destPath === rootPath) return null;
  const relative = destPath.replace(rootPath + "/", "").replace(rootPath, "");
  const parts = relative.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(1).join("/");
}

/**
 * Lists direct child directories of a path.
 */
async function getDirectChildFolders(parentPath: string): Promise<string[]> {
  const isBrowser = !(window as any).__TAURI_INTERNALS__;
  if (isBrowser) {
    const sep = parentPath.includes("\\") ? "\\" : "/";
    return [
      `${parentPath}${sep}001-Client-2026-02-16`,
      `${parentPath}${sep}002-Client-2026-03-01`,
      `${parentPath}${sep}003-Client-2026-04-15`,
    ];
  }
  const pathExists = await exists(parentPath);
  if (!pathExists) return [];
  const entries = await readDir(parentPath);
  const dirs = entries.filter((e) => e.isDirectory && !e.name.startsWith("."));
  const paths = await Promise.all(dirs.map((e) => join(parentPath, e.name)));
  return paths.sort((a, b) => a.localeCompare(b));
}

/**
 * Checks if a subfolder exists under a main folder.
 */
async function subfolderExists(mainFolderPath: string, subfolderRelativePath: string): Promise<boolean> {
  const fullPath = await join(mainFolderPath, subfolderRelativePath);
  return exists(fullPath);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Detected pattern info for matching sibling folders */
interface FolderPattern {
  /** Regex to test folder names - null means match all siblings */
  regex: RegExp | null;
  /** Human-readable description of the detected pattern */
  description: string;
}

/**
 * Derives a pattern from a folder name for matching sibling folders.
 * Supports multiple naming conventions:
 * - NNN-Name-YYYY-MM-DD (e.g. 001-Client-2026-02-16)
 * - NNN-Name, Name-NNN, Name_NNN
 * - Name-YYYYMMDD, YYYYMMDD-Name
 * - Prefix-Stem-Suffix with variable date/number segments
 */
function detectFolderPattern(folderName: string): FolderPattern {
  if (!folderName.trim()) {
    return { regex: null, description: "All folders" };
  }

  const parts = folderName.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) {
    return { regex: null, description: "All folders" };
  }

  // Strategy 1: NNN-Name-Date (001-Client-2026-02-16, 002-Client-2026-03-01)
  const leadingNum = parts[0].match(/^\d+$/);
  const trailingDate = parts[parts.length - 1]?.match(/^\d{4}-\d{2}-\d{2}$|^\d{8}$|^\d{6}$/);
  if (leadingNum && parts.length >= 2) {
    const stem = parts[1];
    if (stem && stem.length >= 2 && /^[a-zA-Z]/.test(stem)) {
      const stemEscaped = escapeRegex(stem);
      return {
        regex: new RegExp(`^\\d+[-_]${stemEscaped}`, "i"),
        description: `Folders matching ${stem} (NNN-${stem}-*)`,
      };
    }
  }

  // Strategy 2: Name-NNN or Name_001 (Client-001, Project_002)
  const trailingNum = parts[parts.length - 1]?.match(/^\d+$/);
  if (trailingNum && parts.length >= 2) {
    const stem = parts[0];
    if (stem && stem.length >= 2) {
      const stemEscaped = escapeRegex(stem);
      return {
        regex: new RegExp(`^${stemEscaped}[-_]\\d+`, "i"),
        description: `Folders matching ${stem} (${stem}-NNN)`,
      };
    }
  }

  // Strategy 3: NNN-Name only (001-Client, 002-Client)
  if (leadingNum && parts.length >= 2) {
    const stem = parts.slice(1).join("-");
    if (stem.length >= 2) {
      const stemEscaped = escapeRegex(parts[1]);
      return {
        regex: new RegExp(`^\\d+[-_]${stemEscaped}`, "i"),
        description: `Folders matching *${parts[1]}*`,
      };
    }
  }

  // Strategy 4: YYYYMMDD-Name or Name-YYYYMMDD (20260216-Client)
  const dateLike = parts.find((p) => /^\d{8}$|^\d{6}$/.test(p));
  if (dateLike && parts.length >= 2) {
    const stem = parts.find((p) => /^[a-zA-Z]+/.test(p));
    if (stem) {
      const stemEscaped = escapeRegex(stem);
      return {
        regex: new RegExp(`\\d{6,8}[-_]?${stemEscaped}|${stemEscaped}[-_]?\\d{6,8}`, "i"),
        description: `Folders matching ${stem} with date`,
      };
    }
  }

  // Strategy 5: Extract first meaningful word (min 2 chars, starts with letter)
  const meaningfulPart = parts.find((p) => p.length >= 2 && /^[a-zA-Z]/.test(p));
  if (meaningfulPart) {
    const escaped = escapeRegex(meaningfulPart);
    return {
      regex: new RegExp(escaped, "i"),
      description: `Folders containing "${meaningfulPart}"`,
    };
  }

  // Fallback: match folders that start similarly (first 3+ chars)
  const prefix = folderName.slice(0, 3);
  if (prefix.length >= 2 && /[a-zA-Z0-9]/.test(prefix)) {
    return {
      regex: new RegExp(`^${escapeRegex(prefix)}`, "i"),
      description: `Folders starting with "${prefix}"`,
    };
  }

  return { regex: null, description: "All folders" };
}

/** Tests if a folder name matches the pattern */
function folderMatchesPattern(folderName: string, pattern: FolderPattern): boolean {
  if (!pattern.regex) return true;
  return pattern.regex.test(folderName);
}

/**
 * Main propagation logic: expands a destination into multiple targets.
 *
 * @param rootPath - Root/base path (parent of main folders)
 * @param destinationFolder - User-selected destination
 * @param mode - Destination mode
 * @returns Propagation result with all target folders
 */
export async function expandPropagationTargets(
  rootPath: string,
  destinationFolder: string,
  mode: DestinationMode
): Promise<PropagationResult> {
  const targets: PropagationTarget[] = [];

  if (mode === "manual") {
    targets.push({
      folderPath: destinationFolder,
      displayPath: getDisplayPath(rootPath, destinationFolder),
    });
    return { sourceFolder: destinationFolder, targets };
  }

  // Container: folder that holds main folders. When dest is rootPath, rootPath IS a main folder - container is its parent.
  const containerPath = destinationFolder === rootPath
    ? (await dirname(rootPath))
    : rootPath;
  const mainFolders = await getDirectChildFolders(containerPath);

  if (mode === "pattern-main") {
    const selectedMainName = destinationFolder === rootPath
      ? rootPath.split("/").filter(Boolean).pop() ?? ""
      : getMainFolderName(containerPath, destinationFolder);

    // Match main folders by pattern (or all if at root with no pattern)
    const pattern = selectedMainName ? detectFolderPattern(selectedMainName) : { regex: null, description: "All folders" };
    for (const mf of mainFolders) {
      const name = mf.split("/").filter(Boolean).pop() ?? "";
      if (folderMatchesPattern(name, pattern)) {
        targets.push({ folderPath: mf, displayPath: name });
      }
    }
    if (targets.length === 0) {
      targets.push({
        folderPath: destinationFolder,
        displayPath: getDisplayPath(rootPath, destinationFolder),
      });
    }
    return {
      sourceFolder: destinationFolder,
      targets,
      patternDescription: `${pattern.description} → ${targets.length} folder(s)`,
    };
  }

  if (mode === "pattern-subfolders") {
    // Determine: is rootPath a main folder or the parent of main folders?
    const rootIsMainFolder = destinationFolder.startsWith(rootPath + "/") || destinationFolder === rootPath;
    const effectiveContainer = rootIsMainFolder ? (await dirname(rootPath)) : rootPath;
    const mainFoldersForSub = await getDirectChildFolders(effectiveContainer);

    let subfolderRel: string | null;
    let selectedMainName: string;

    if (rootIsMainFolder && destinationFolder !== rootPath) {
      subfolderRel = destinationFolder.replace(rootPath + "/", "").replace(rootPath, "") || null;
      selectedMainName = rootPath.split("/").filter(Boolean).pop() ?? "";
    } else {
      subfolderRel = getSubfolderPath(effectiveContainer, destinationFolder);
      selectedMainName = getMainFolderName(effectiveContainer, destinationFolder) ?? "";
    }

    if (!subfolderRel) {
      targets.push({
        folderPath: destinationFolder,
        displayPath: getDisplayPath(rootPath, destinationFolder),
      });
      return { sourceFolder: destinationFolder, targets };
    }

    const pattern = selectedMainName ? detectFolderPattern(selectedMainName) : { regex: null, description: "All folders" };
    for (const mf of mainFoldersForSub) {
      const name = mf.split("/").filter(Boolean).pop() ?? "";
      const matches = folderMatchesPattern(name, pattern);
      if (matches) {
        const exists = await subfolderExists(mf, subfolderRel);
        if (exists) {
          const fullPath = await join(mf, subfolderRel);
          const displayPath = `${name}/${subfolderRel}`;
          targets.push({ folderPath: fullPath, displayPath });
        }
      }
    }
    if (targets.length === 0) {
      targets.push({
        folderPath: destinationFolder,
        displayPath: getDisplayPath(rootPath, destinationFolder),
      });
    }
    return {
      sourceFolder: destinationFolder,
      targets,
      patternDescription: `${pattern.description} → "${subfolderRel}" in ${targets.length} folder(s)`,
    };
  }

  // pattern-main-and-subfolders: propagate to BOTH main folder AND same subfolder in each matching main folder
  if (mode === "pattern-main-and-subfolders") {
    const rootIsMainFolder = destinationFolder.startsWith(rootPath + "/") || destinationFolder === rootPath;
    const effectiveContainer = rootIsMainFolder ? (await dirname(rootPath)) : rootPath;
    const mainFoldersAll = await getDirectChildFolders(effectiveContainer);

    let subfolderRel: string | null;
    let selectedMainName: string;

    if (rootIsMainFolder && destinationFolder !== rootPath) {
      subfolderRel = destinationFolder.replace(rootPath + "/", "").replace(rootPath, "") || null;
      selectedMainName = rootPath.split("/").filter(Boolean).pop() ?? "";
    } else {
      subfolderRel = getSubfolderPath(effectiveContainer, destinationFolder);
      selectedMainName = getMainFolderName(effectiveContainer, destinationFolder) ?? "";
    }

    const pattern = selectedMainName ? detectFolderPattern(selectedMainName) : { regex: null, description: "All folders" };

    for (const mf of mainFoldersAll) {
      const name = mf.split("/").filter(Boolean).pop() ?? "";
      if (!folderMatchesPattern(name, pattern)) continue;

      // Always add main folder target
      targets.push({ folderPath: mf, displayPath: name });

      // If we have a subfolder path, also add subfolder target where it exists
      if (subfolderRel) {
        const folderExists = await subfolderExists(mf, subfolderRel);
        if (folderExists) {
          const fullPath = await join(mf, subfolderRel);
          targets.push({ folderPath: fullPath, displayPath: `${name}/${subfolderRel}` });
        }
      }
    }

    if (targets.length === 0) {
      targets.push({
        folderPath: destinationFolder,
        displayPath: getDisplayPath(rootPath, destinationFolder),
      });
    }

    const scope = subfolderRel ? "main + " + `"${subfolderRel}"` : "main only";
    return {
      sourceFolder: destinationFolder,
      targets,
      patternDescription: `${pattern.description} → ${scope} (${targets.length} target(s))`,
    };
  }

  return { sourceFolder: destinationFolder, targets: [{ folderPath: destinationFolder, displayPath: getDisplayPath(rootPath, destinationFolder) }] };
}

function getDisplayPath(rootPath: string, fullPath: string): string {
  if (fullPath === rootPath) return "Root";
  const rel = fullPath.replace(rootPath + "/", "").replace(rootPath, "");
  return rel || (fullPath.split("/").filter(Boolean).pop() ?? fullPath);
}

/**
 * Builds the full list of file creation targets from mapped entries,
 * applying propagation and exclusions.
 */
export interface ResolvedCreationTarget {
  entryId: string;
  fileName: string;
  extension: string;
  folderPath: string;
  fullPath: string;
  displayPath: string;
}

export async function resolvePropagationTargets(
  rootPath: string,
  entries: Array<{ id: string; fileName: string; extension: string; destinationFolder: string }>,
  mode: DestinationMode,
  exclusions: Set<string> // "entryId::folderPath" for excluded targets
): Promise<ResolvedCreationTarget[]> {
  const result: ResolvedCreationTarget[] = [];

  for (const entry of entries) {
    const prop = await expandPropagationTargets(
      rootPath,
      entry.destinationFolder,
      mode
    );

    const fullFileName = `${entry.fileName}.${entry.extension}`;

    for (const t of prop.targets) {
      const key = `${entry.id}::${t.folderPath}`;
      if (exclusions.has(key)) continue;

      const fullPath = await join(t.folderPath, fullFileName);
      result.push({
        entryId: entry.id,
        fileName: entry.fileName,
        extension: entry.extension,
        folderPath: t.folderPath,
        fullPath,
        displayPath: `${t.displayPath}/${fullFileName}`,
      });
    }
  }

  return result;
}
