/**
 * File: src/features/folder-creation/utils/folderUtils.ts
 * 
 * Back-end utility functions for folder creation, preview generation, and statistics tracking.
 * Handles folder naming patterns, date formatting, and folder structure generation.
 */

import { mkdir, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { formatDate as sharedFormatDate } from "../../../utils/dateUtils";

/**
 * Configuration for a pre-created file
 */
export interface PreCreationFileConfig {
    id: string;                    // Unique ID for React keys
    fileName: string;              // User-defined name (without extension)
    extension: string;             // File extension (e.g., "txt", "md")

    // Pattern-Based Propagation Fields
    propagationMode: 'manual' | 'all-main-folders' | 'matching-subfolders';
    templateDestination: string;  // The selected example (e.g., "folder-1")
    excludedDestinations?: string[];  // User-opted-out folder IDs

    // Legacy field for backward compatibility
    destination?: 'root' | string;  // 'root' or folder node ID (deprecated, use templateDestination)

    enabled: boolean;              // Allow disabling without deleting
}

export interface FolderConfig {
    rootPath: string;
    baseName: string; // The "Base Name" (renamed from prefix to match file tab)
    count: number;
    subfolders: string; // Comma separated

    // Numbering
    useNumbering: boolean;
    startNumber: number;
    digitCount: number; // 1, 2, 3, 4 (padding)
    numberPosition: 'prefix' | 'suffix' | 'after-prefix' | 'before-suffix';

    // Formatting
    separator: string; // "-", "_", ".", " ", or "" (NONE)

    // Custom prefix and suffix
    customPrefix: string;
    customSuffix: string;

    // Date/Time
    useDate: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD' | 'YY-MM-DD' | 'YYMMDD' | 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'MM-DD-YY' | 'MMDDYY' | 'YYYY-MM-DD_HH-MM-SS' | 'YYYYMMDD_HHMMSS' | 'YYMMDD_HHMMSS' | 'HH-MM-SS' | 'HHMMSS' | 'timestamp' | 'custom';
    customDateFormat?: string;
    datePosition: 'prefix' | 'suffix';

    // Random string generation
    useRandomString: boolean;
    randomStringLength: number;
    randomStringPosition: 'prefix' | 'suffix';

    // UUID generation
    useUUID: boolean;
    uuidPosition: 'prefix' | 'suffix';

    // Subfolder customizations
    subfolderPrefix: string;
    subfolderSuffix: string;

    // Overwrite option
    overwrite?: boolean;

    // Creation Mode
    creationMode: 'pattern' | 'list' | 'csv';
    folderList: string;

    // CSV Configuration
    csvDelimiter: string; // The configured delimiter for combining columns
    csvColumnOrder: string[]; // IDs of columns in order
    csvColumnConfig: Record<string, {
        enabled: boolean;
        prefix: string;
        suffix: string;
    }>;
    csvRows: Record<string, string>[]; // Parsed CSV data (for preview/generation)
    csvHeaders: string[]; // Original headers or generated Column_X

    // File Pre-Creation Configuration
    enableFilePreCreation: boolean;
    preCreationFiles: PreCreationFileConfig[];
}

export interface PreviewNode {
    id: string;
    name: string;
    type: "folder" | "file";
    children?: PreviewNode[];
    status?: 'pending' | 'success' | 'error' | 'exists';
    errorMessage?: string;
    isPreCreationFile?: boolean;  // Mark files from pre-creation feature
    originalFileName?: string;    // Store original name for reference

    // Pattern-based file fields
    propagationMode?: 'manual' | 'all-main-folders' | 'matching-subfolders';
    sourceFileId?: string;  // Link back to source PreCreationFileConfig.id
}

/**
 * Statistics interface for tracking folder creation results
 */
export interface FolderCreationStats {
    total: number;
    success: number;
    error: number;
    exists: number;
    pending: number;
}
/**
 * Calculates the total number of folders to be created based on configuration
 * This is used for statistics display without generating the full preview tree
 */
export const getTotalCount = (config: FolderConfig): number => {
    if (config.creationMode === 'list') {
        const lines = config.folderList
            .split(/[\n,]/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
        return lines.length;
    }

    if (config.creationMode === 'csv') {
        return config.csvRows?.length || 0;
    }

    // Pattern mode
    return config.count;
};

/**
 * Formats date/time according to the specified format
 * @param format - The date/time format to use
 * @param date - Optional date object (defaults to current date)
 * @returns Formatted date/time string
 */
export const formatDate = (format: string, date: Date = new Date(), customFormat?: string): string => {
    if (format === 'custom' && customFormat) {
        return sharedFormatDate(customFormat, date);
    }
    return sharedFormatDate(format, date);
};

/**
 * Generates a random alphanumeric string of specified length
 * @param length - Length of the random string
 * @returns Random string
 */
const generateRandomString = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Generates a UUID v4
 * @returns UUID string
 */
const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * Generates a folder name based on the configuration and index
 * Uses the same naming pattern logic as the file tab
 * @param index - The folder index (1-based)
 * @param config - Folder configuration
 * @param currentDate - Optional date object (defaults to current date)
 * @param customBaseName - Optional custom base name (for list mode)
 * @param csvRow - Optional CSV row data
 * @returns Generated folder name
 */
export const generateFolderName = (
    index: number,
    config: FolderConfig,
    currentDate: Date = new Date(),
    customBaseName?: string,
    csvRow?: Record<string, string>
): string => {
    const {
        baseName,
        useNumbering, startNumber, digitCount, numberPosition,
        separator, useDate, dateFormat, datePosition,
        customPrefix, customSuffix,
        useRandomString, randomStringLength, randomStringPosition,
        useUUID, uuidPosition,
        creationMode,
        csvDelimiter,
        csvColumnOrder,
        csvColumnConfig
    } = config;

    const currentNum = startNumber + (index - 1);
    const numStr = useNumbering
        ? String(currentNum).padStart(digitCount, '0')
        : '';

    // Generate random string and UUID per folder (if enabled)
    const randomStr = useRandomString ? generateRandomString(randomStringLength) : '';
    const uuidStr = useUUID ? generateUUID() : '';

    // Pre-calculate date string if needed (same for all folders in preview)
    const dateStr = useDate ? formatDate(dateFormat, currentDate) : '';

    // Build folder name parts in order: [Prefix Items] [Base] [Suffix Items]
    let prefixParts: string[] = [];
    let suffixParts: string[] = [];
    let middleParts: string[] = [];

    // Add custom prefix
    if (customPrefix) prefixParts.push(customPrefix);

    // Add date/time to prefix if specified
    if (useDate && datePosition === 'prefix') prefixParts.push(dateStr);

    // Add UUID to prefix if specified
    if (useUUID && uuidPosition === 'prefix') prefixParts.push(uuidStr);

    // Add random string to prefix if specified
    if (useRandomString && randomStringPosition === 'prefix') prefixParts.push(randomStr);

    // Add number to prefix if specified
    if (useNumbering && numberPosition === 'prefix') prefixParts.push(numStr);

    // Determine Base Name
    if (creationMode === 'csv' && csvRow) {
        // Build base name from CSV columns
        const csvParts: string[] = [];
        const order = csvColumnOrder && csvColumnOrder.length > 0 ? csvColumnOrder : [];

        order.forEach(colId => {
            const colConfig = csvColumnConfig?.[colId];
            if (colConfig?.enabled !== false) { // Default to true if not config
                let val = csvRow[colId] || '';
                if (val) {
                    const p = colConfig?.prefix || '';
                    const s = colConfig?.suffix || '';
                    csvParts.push(`${p}${val}${s}`);
                }
            }
        });

        middleParts.push(csvParts.join(csvDelimiter || separator || ' '));

    } else if (customBaseName !== undefined) {
        if (customBaseName) middleParts.push(customBaseName);
    } else if (baseName) {
        middleParts.push(baseName);
    }

    // Add number after base name (for 'after-prefix' position)
    if (useNumbering && numberPosition === 'after-prefix') middleParts.push(numStr);

    // Add number before suffix (for 'before-suffix' position)
    if (useNumbering && numberPosition === 'before-suffix') suffixParts.push(numStr);

    // Add number to suffix if specified
    if (useNumbering && numberPosition === 'suffix') suffixParts.push(numStr);

    // Add random string to suffix if specified
    if (useRandomString && randomStringPosition === 'suffix') suffixParts.push(randomStr);

    // Add UUID to suffix if specified
    if (useUUID && uuidPosition === 'suffix') suffixParts.push(uuidStr);

    // Add date/time to suffix if specified
    if (useDate && datePosition === 'suffix') suffixParts.push(dateStr);

    // Add custom suffix
    if (customSuffix) suffixParts.push(customSuffix);

    // Combine all parts
    const allParts = [...prefixParts, ...middleParts, ...suffixParts].filter(p => p.length > 0);
    return allParts.length > 0 ? allParts.join(separator) : 'folder';
};

/**
 * Metadata about a folder ID
 */
interface FolderMetadata {
    type: 'pattern-main' | 'pattern-sub' | 'list-main' | 'list-sub' | 'csv-main' | 'csv-sub' | 'root';
    creationMode: 'pattern' | 'list' | 'csv' | 'root';
    isMainFolder: boolean;
    index?: number;
    subIndex?: number;
    subfolderName?: string;
}

/**
 * Analyzes a folder ID to determine its type and metadata.
 * Returns 'root' metadata as fallback for undefined/null IDs.
 */
const analyzeFolderId = (folderId: string, folderNodes: PreviewNode[]): FolderMetadata => {
    // Guard against undefined/null folderId (legacy configs without templateDestination)
    if (!folderId || folderId === 'root') {
        return { type: 'root', creationMode: 'root', isMainFolder: true };
    }

    // Pattern mode: folder-1, folder-2
    const patternMainMatch = folderId.match(/^folder-(\d+)$/);
    if (patternMainMatch) {
        return {
            type: 'pattern-main',
            creationMode: 'pattern',
            isMainFolder: true,
            index: parseInt(patternMainMatch[1])
        };
    }

    // Pattern subfolder: folder-1-sub-0
    const patternSubMatch = folderId.match(/^folder-(\d+)-sub-(\d+)$/);
    if (patternSubMatch) {
        const subfolderName = getSubfolderNameById(folderId, folderNodes);
        return {
            type: 'pattern-sub',
            creationMode: 'pattern',
            isMainFolder: false,
            index: parseInt(patternSubMatch[1]),
            subIndex: parseInt(patternSubMatch[2]),
            subfolderName
        };
    }

    // List mode: folder-list-0
    const listMainMatch = folderId.match(/^folder-list-(\d+)$/);
    if (listMainMatch) {
        return {
            type: 'list-main',
            creationMode: 'list',
            isMainFolder: true,
            index: parseInt(listMainMatch[1])
        };
    }

    // List subfolder: folder-list-0-sub-0
    const listSubMatch = folderId.match(/^folder-list-(\d+)-sub-(\d+)$/);
    if (listSubMatch) {
        const subfolderName = getSubfolderNameById(folderId, folderNodes);
        return {
            type: 'list-sub',
            creationMode: 'list',
            isMainFolder: false,
            index: parseInt(listSubMatch[1]),
            subIndex: parseInt(listSubMatch[2]),
            subfolderName
        };
    }

    // CSV mode: folder-csv-0
    const csvMainMatch = folderId.match(/^folder-csv-(\d+)$/);
    if (csvMainMatch) {
        return {
            type: 'csv-main',
            creationMode: 'csv',
            isMainFolder: true,
            index: parseInt(csvMainMatch[1])
        };
    }

    // CSV subfolder: folder-csv-0-sub-0
    const csvSubMatch = folderId.match(/^folder-csv-(\d+)-sub-(\d+)$/);
    if (csvSubMatch) {
        const subfolderName = getSubfolderNameById(folderId, folderNodes);
        return {
            type: 'csv-sub',
            creationMode: 'csv',
            isMainFolder: false,
            index: parseInt(csvSubMatch[1]),
            subIndex: parseInt(csvSubMatch[2]),
            subfolderName
        };
    }

    return { type: 'root', creationMode: 'root', isMainFolder: true };
};

/**
 * Helper to get subfolder name from folder node by ID
 */
const getSubfolderNameById = (folderId: string, folderNodes: PreviewNode[]): string | undefined => {
    const findNode = (nodes: PreviewNode[]): PreviewNode | undefined => {
        for (const node of nodes) {
            if (node.id === folderId) return node;
            if (node.children) {
                const found = findNode(node.children);
                if (found) return found;
            }
        }
        return undefined;
    };

    const node = findNode(folderNodes);
    return node?.name;
};

/**
 * Finds all main folder IDs for a given creation mode
 */
const findAllMainFolders = (
    creationMode: 'pattern' | 'list' | 'csv' | 'root',
    folderNodes: PreviewNode[],
    config: FolderConfig
): string[] => {
    if (creationMode === 'root') return ['root'];

    const mainFolders: string[] = [];

    if (creationMode === 'pattern') {
        const totalCount = config.count;
        for (let i = 1; i <= totalCount; i++) {
            mainFolders.push(`folder-${i}`);
        }
    } else if (creationMode === 'list') {
        const lines = config.folderList
            .split(/[\n,]/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        for (let i = 0; i < lines.length; i++) {
            mainFolders.push(`folder-list-${i}`);
        }
    } else if (creationMode === 'csv') {
        const rows = config.csvRows || [];
        for (let i = 0; i < rows.length; i++) {
            mainFolders.push(`folder-csv-${i}`);
        }
    }

    return mainFolders;
};

/**
 * Finds all subfolder IDs with matching name across all main folders
 */
const findMatchingSubfolders = (
    targetSubfolderName: string,
    creationMode: 'pattern' | 'list' | 'csv' | 'root',
    folderNodes: PreviewNode[],
    config: FolderConfig
): string[] => {
    const matchingSubfolders: string[] = [];

    // Get subfolder names from config
    const configuredSubfolders = config.subfolders
        .split(/[\n,]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    // Apply prefix/suffix to match actual names
    const actualSubfolderNames = configuredSubfolders.map(
        sub => `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`
    );

    // Find the subfolder index
    const subIndex = actualSubfolderNames.indexOf(targetSubfolderName);

    if (subIndex === -1) return [];

    // Generate IDs for all matching subfolders
    const mainFolders = findAllMainFolders(creationMode, folderNodes, config);

    for (const mainFolderId of mainFolders) {
        const subId = `${mainFolderId}-sub-${subIndex}`;
        matchingSubfolders.push(subId);
    }

    return matchingSubfolders;
};

/**
 * Expands a template destination into all matching destinations based on propagation mode
 */
export const expandDestinations = (
    templateDestination: string,
    propagationMode: 'manual' | 'all-main-folders' | 'matching-subfolders',
    excludedDestinations: string[],
    folderNodes: PreviewNode[],
    config: FolderConfig
): string[] => {
    // Fallback for undefined/null templateDestination (legacy configs)
    const safeDest = templateDestination || 'root';

    // Manual mode: single destination
    if (propagationMode === 'manual') {
        return [safeDest];
    }

    const metadata = analyzeFolderId(safeDest, folderNodes);
    let destinations: string[] = [];

    // All Main Folders Mode
    if (propagationMode === 'all-main-folders') {
        if (metadata.type === 'root') {
            destinations.push('root');
        } else if (metadata.isMainFolder) {
            destinations = findAllMainFolders(metadata.creationMode, folderNodes, config);
        } else {
            // Fallback to manual if subfolder selected
            destinations.push(safeDest);
        }
    }

    // Matching Subfolders Mode
    if (propagationMode === 'matching-subfolders') {
        if (metadata.isMainFolder) {
            // Fallback to manual if main folder selected
            destinations.push(safeDest);
        } else if (metadata.subfolderName) {
            destinations = findMatchingSubfolders(
                metadata.subfolderName,
                metadata.creationMode,
                folderNodes,
                config
            );
        }
    }

    // Filter out excluded destinations
    return destinations.filter(dest => !excludedDestinations.includes(dest));
};

/**
 * Injects pre-creation files into the folder preview tree.
 * Supports pattern-based propagation: files can be replicated across
 * all main folders or all matching subfolders based on propagation mode.
 * 
 * @param nodes - Array of folder preview nodes
 * @param files - Array of file configurations
 * @param config - Folder configuration (used for pattern expansion)
 * @returns Updated array with files injected at appropriate destinations
 */
const injectPreCreationFiles = (
    nodes: PreviewNode[],
    files: PreCreationFileConfig[],
    config: FolderConfig
): PreviewNode[] => {
    const enabledFiles = files.filter(f => f.enabled);
    if (enabledFiles.length === 0) return nodes;

    // Migrate legacy configs that lack propagationMode (backward compatibility)
    const migratedFiles = enabledFiles.map(file => {
        if (!file.propagationMode) {
            return {
                ...file,
                propagationMode: 'manual' as const,
                templateDestination: file.destination || 'root',
                excludedDestinations: [] as string[]
            };
        }
        return file;
    });

    // Expand all file destinations based on propagation mode
    // Maps destination folder ID → list of files that should be placed there
    const expandedFileMap = new Map<string, PreCreationFileConfig[]>();

    migratedFiles.forEach(file => {
        const destinations = expandDestinations(
            file.templateDestination,
            file.propagationMode,
            file.excludedDestinations || [],
            nodes,
            config
        );

        destinations.forEach(dest => {
            if (!expandedFileMap.has(dest)) {
                expandedFileMap.set(dest, []);
            }
            expandedFileMap.get(dest)!.push(file);
        });
    });

    // Recursively inject files into matching destination folders
    const injectIntoNode = (node: PreviewNode): PreviewNode => {
        const filesForThisNode = expandedFileMap.get(node.id) || [];

        // Create file nodes with pattern metadata for visual distinction
        const fileNodes: PreviewNode[] = filesForThisNode.map(file => ({
            id: `file-${file.id}-${node.id}`,
            name: `${file.fileName}.${file.extension}`,
            type: 'file' as const,
            status: 'pending' as const,
            isPreCreationFile: true,
            originalFileName: `${file.fileName}.${file.extension}`,
            propagationMode: file.propagationMode,
            sourceFileId: file.id
        }));

        const updatedChildren = [
            ...(node.children || []).map(child =>
                child.type === 'folder' ? injectIntoNode(child) : child
            ),
            ...fileNodes
        ];

        return {
            ...node,
            children: updatedChildren.length > 0 ? updatedChildren : undefined
        };
    };

    const updatedNodes = nodes.map(node => injectIntoNode(node));

    // Add root-level files (from expandedFileMap for 'root' destination)
    const rootLevelFiles = (expandedFileMap.get('root') || []).map(file => ({
        id: `file-${file.id}-root`,
        name: `${file.fileName}.${file.extension}`,
        type: 'file' as const,
        status: 'pending' as const,
        isPreCreationFile: true,
        originalFileName: `${file.fileName}.${file.extension}`,
        propagationMode: file.propagationMode,
        sourceFileId: file.id
    }));

    return [...updatedNodes, ...rootLevelFiles];
};

/**
 * Generates a preview of folder nodes based on the configuration
 * Uses the same naming pattern logic as the file tab
 * @param config - Folder configuration
 * @returns Array of preview nodes
 */
export const generatePreview = (config: FolderConfig): PreviewNode[] => {
    const nodes: PreviewNode[] = [];
    const subfolderNames = config.subfolders
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    // List Mode Logic
    if (config.creationMode === 'list') {
        const lines = config.folderList
            .split(/[\n,]/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // Deduplicate names to avoid conflicts in preview (though actual creation might defer to overwrite policy)
        // For preview, let's just map them 1:1.

        const currentDate = new Date(); // Need date for decorators

        lines.forEach((lineName, index) => {
            // Apply decorators using the line content as the base name
            const finalName = generateFolderName(index + 1, config, currentDate, lineName);

            const parentId = `folder-list-${index}`; // Unique ID for list items

            const children: PreviewNode[] = subfolderNames.map((sub, subIndex) => ({
                id: `${parentId}-sub-${subIndex}`,
                name: `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`,
                type: "folder",
            }));

            nodes.push({
                id: parentId,
                name: finalName,
                type: "folder",
                children,
            });
        });

        // Pagination for list mode if wildly large?
        // Let's cap visual preview at 50 for safety, similar to pattern mode.
        if (nodes.length > 50) {
            const hiddenCount = nodes.length - 50;
            const shownNodes = nodes.slice(0, 50);
            shownNodes.push({
                id: 'more-placeholder',
                name: `... (${hiddenCount} more - not editable in preview)`,
                type: "folder"
            });
            // Inject pre-creation files if enabled
            if (config.enableFilePreCreation && config.preCreationFiles && config.preCreationFiles.length > 0) {
                return injectPreCreationFiles(shownNodes, config.preCreationFiles, config);
            }
            return shownNodes;
        }

        // Inject pre-creation files if enabled
        if (config.enableFilePreCreation && config.preCreationFiles && config.preCreationFiles.length > 0) {
            return injectPreCreationFiles(nodes, config.preCreationFiles, config);
        }
        return nodes;
    }

    // CSV Mode Logic
    if (config.creationMode === 'csv') {
        if (!config.csvRows || config.csvRows.length === 0) return [];

        const currentDate = new Date();
        const rows = config.csvRows;

        // Visualize first 50
        const previewRows = rows.slice(0, 50);

        previewRows.forEach((row, index) => {
            const finalName = generateFolderName(index + 1, config, currentDate, undefined, row);
            const parentId = `folder-csv-${index}`;

            const children: PreviewNode[] = subfolderNames.map((sub, subIndex) => ({
                id: `${parentId}-sub-${subIndex}`,
                name: `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`,
                type: "folder",
            }));

            nodes.push({
                id: parentId,
                name: finalName,
                type: "folder",
                children
            });
        });

        if (rows.length > 50) {
            nodes.push({
                id: 'more-placeholder',
                name: `... (${rows.length - 50} more - not editable in preview)`,
                type: "folder"
            });
        }

        // Inject pre-creation files if enabled
        if (config.enableFilePreCreation && config.preCreationFiles && config.preCreationFiles.length > 0) {
            return injectPreCreationFiles(nodes, config.preCreationFiles, config);
        }
        return nodes;
    }

    // Pattern Mode Logic (Existing)
    const currentDate = new Date();

    // For the editable version, we might want to generate ALL nodes if count is reasonable,
    // or paginate. For V1 editable, let's limit to 50 to prevent performance issues.
    const previewCount = Math.min(config.count, 50);

    for (let i = 1; i <= previewCount; i++) {
        const folderName = generateFolderName(i, config, currentDate);
        const parentId = `folder-${i}`;

        const children: PreviewNode[] = subfolderNames.map((sub, subIndex) => ({
            id: `${parentId}-sub-${subIndex}`,
            name: `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`, // Apply subfolder prefix/suffix
            type: "folder",
        }));

        nodes.push({
            id: parentId,
            name: folderName,
            type: "folder",
            children,
        });
    }

    if (config.count > 50) {
        nodes.push({
            id: 'more-placeholder',
            name: `... (${config.count - 50} more - not editable)`,
            type: "folder"
        })
    }

    // Inject pre-creation files if enabled
    if (config.enableFilePreCreation && config.preCreationFiles && config.preCreationFiles.length > 0) {
        return injectPreCreationFiles(nodes, config.preCreationFiles, config);
    }
    return nodes;
};

// Helper to update a node's name by ID in the tree
export const updateNodeName = (nodes: PreviewNode[], id: string, newName: string): PreviewNode[] => {
    return nodes.map(node => {
        if (node.id === id) {
            return { ...node, name: newName };
        }
        if (node.children) {
            return { ...node, children: updateNodeName(node.children, id, newName) };
        }
        return node;
    });
};

/**
 * Calculates statistics from folder nodes
 * @param nodes - Array of preview nodes
 * @returns Statistics object
 */
export const calculateStats = (nodes: PreviewNode[]): FolderCreationStats => {
    const stats: FolderCreationStats = {
        total: 0,
        success: 0,
        error: 0,
        exists: 0,
        pending: 0
    };

    const countNode = (node: PreviewNode) => {
        if (node.id === 'more-placeholder') return;

        stats.total++;
        const status = node.status || 'pending';
        // Type guard or cast to ensure status is a valid key, though it should be by definition
        if (status === 'pending' || status === 'success' || status === 'error' || status === 'exists') {
            stats[status]++;
        } else {
            stats.pending++;
        }

        if (node.children) {
            node.children.forEach(countNode);
        }
    };

    nodes.forEach(countNode);
    return stats;
};

/**
 * Helper to update file node status recursively in the tree
 */
const updateFileNodeStatus = (
    nodes: PreviewNode[],
    fileId: string,
    status: 'success' | 'exists' | 'error',
    errorMessage?: string
): boolean => {
    for (const node of nodes) {
        if (node.id === fileId) {
            node.status = status;
            if (errorMessage) {
                node.errorMessage = errorMessage;
            }
            return true;
        }
        if (node.children && updateFileNodeStatus(node.children, fileId, status, errorMessage)) {
            return true;
        }
    }
    return false;
};

/**
 * Creates pre-creation files within the folder structure
 * @param config - Folder configuration
 * @param nodes - Preview nodes with folders and files
 * @param currentProgress - Current progress count (after folder creation)
 * @param totalItems - Total items including files
 * @param onProgress - Progress callback
 * @param onNodeUpdate - Callback to update node status
 * @returns Result with success status and any errors
 */
const createPreCreationFiles = async (
    config: FolderConfig,
    nodes: PreviewNode[],
    currentProgress: number,
    totalItems: number,
    onProgress: (current: number, total: number, status: string) => void,
    onNodeUpdate?: (updatedNodes: PreviewNode[]) => void
): Promise<{ success: boolean; errors: string[] }> => {
    const errors: string[] = [];
    const updatedNodes = [...nodes];

    // Collect all file nodes from tree
    const fileNodes: Array<{ node: PreviewNode; folderPath: string }> = [];

    const collectFiles = async (nodes: PreviewNode[], currentPath: string) => {
        for (const node of nodes) {
            if (node.type === 'file' && node.isPreCreationFile && node.id !== 'more-placeholder') {
                fileNodes.push({ node, folderPath: currentPath });
            }
            if (node.type === 'folder' && node.children) {
                const nodePath = await join(currentPath, node.name);
                await collectFiles(node.children, nodePath);
            }
        }
    };

    await collectFiles(nodes, config.rootPath);

    // Import writeTextFile dynamically
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");

    // Create files sequentially
    for (let i = 0; i < fileNodes.length; i++) {
        const { node, folderPath } = fileNodes[i];
        const filePath = await join(folderPath, node.name);

        onProgress(
            currentProgress + i + 1,
            totalItems,
            `Creating file ${node.name}...`
        );

        try {
            const fileExists = await exists(filePath);
            let currentStatus: 'success' | 'exists' | 'error' = 'success';

            if (fileExists && !config.overwrite) {
                currentStatus = 'exists';
            } else {
                await writeTextFile(filePath, "");
                currentStatus = 'success';
            }

            // Update node status in tree
            updateFileNodeStatus(updatedNodes, node.id, currentStatus);
            onNodeUpdate?.(updatedNodes);

        } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error';
            errors.push(`${node.name}: ${errorMessage}`);
            updateFileNodeStatus(updatedNodes, node.id, 'error', errorMessage);
            onNodeUpdate?.(updatedNodes);
        }
    }

    return { success: errors.length === 0, errors };
};

/**
 * Creates folders based on configuration and preview nodes
 * Updates node status in real-time and handles errors gracefully
 * @param config - Folder configuration
 * @param nodes - Preview nodes (may include edited names)
 * @param onProgress - Progress callback
 * @param onNodeUpdate - Callback to update node status
 */
export const createFolders = async (
    config: FolderConfig,
    nodes: PreviewNode[],
    onProgress: (current: number, total: number, status: string) => void,
    onNodeUpdate?: (updatedNodes: PreviewNode[]) => void,
    onStatsUpdate?: (stats: FolderCreationStats) => void
): Promise<{ success: boolean; error?: string }> => {
    if (!config.rootPath) {
        return { success: false, error: "Root path is required" };
    }

    // We only create nodes that are NOT placeholders
    const validNodes = nodes.filter(n => n.id !== 'more-placeholder');
    const updatedNodes = [...validNodes];

    const totalCount = getTotalCount(config); // Use the true total count
    let createdCount = 0;
    const errors: string[] = [];

    // Initialize stats
    const currentStats: FolderCreationStats = {
        total: totalCount,
        success: 0,
        error: 0,
        exists: 0,
        pending: totalCount
    };

    // Helper to update stats
    const updateStats = (status: 'success' | 'error' | 'exists') => {
        currentStats.pending--;
        currentStats[status]++;
        onStatsUpdate?.({ ...currentStats });
    };

    // 1. Create editable nodes (The PreviewNodes contain potential renames)
    // We must prioritize these and assume they map 1:1 to the first N items of the execution list.
    for (let i = 0; i < validNodes.length; i++) {
        const node = validNodes[i];
        createdCount++;
        const fullPath = await join(config.rootPath, node.name);

        onProgress(createdCount, totalCount, `Creating ${node.name}...`);

        try {
            const folderExists = await exists(fullPath);

            let currentStatus: 'success' | 'exists' | 'error' = 'success';

            if (folderExists && !config.overwrite) {
                currentStatus = 'exists';
                // Use the existing folder
            } else {
                await mkdir(fullPath, { recursive: true });
            }

            updateStats(currentStatus);

            // Create subfolders
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    // Skip if child name is empty or invalid
                    if (!child.name || child.name.trim().length === 0) {
                        continue;
                    }
                    const subPath = await join(fullPath, child.name);
                    try {
                        const subExists = await exists(subPath);
                        if (!subExists || config.overwrite) {
                            await mkdir(subPath, { recursive: true });
                            console.log(`Created subfolder: ${subPath}`);
                        }
                    } catch (subError: any) {
                        console.error(`Failed to create subfolder ${subPath}:`, subError);
                        // Continue with other subfolders even if one fails
                    }
                }
            }

            updatedNodes[i] = { ...node, status: currentStatus };
            onNodeUpdate?.([...updatedNodes]);

        } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error occurred';
            errors.push(`${node.name}: ${errorMessage}`);
            updatedNodes[i] = { ...node, status: 'error', errorMessage };
            onNodeUpdate?.([...updatedNodes]);
            updateStats('error');
            console.error(`Failed to create ${fullPath}`, error);
        }
    }

    // 2. Create remaining folders (if any) generated procedurally
    // This handles the > 50 case where we didn't show them in preview
    if (config.creationMode === 'pattern' && totalCount > validNodes.length) {
        const subfolderNames = config.subfolders
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        const currentDate = new Date();

        for (let i = validNodes.length + 1; i <= totalCount; i++) {
            const folderName = generateFolderName(i, config, currentDate);
            const fullPath = await join(config.rootPath, folderName);

            onProgress(i, totalCount, `Creating ${folderName}...`);

            try {
                const folderExists = await exists(fullPath);

                let currentStatus: 'success' | 'exists' | 'error' = 'success';

                if (folderExists && !config.overwrite) {
                    currentStatus = 'exists';
                    // Logic proceeds to subfolders
                } else {
                    await mkdir(fullPath, { recursive: true });
                }

                updateStats(currentStatus);

                for (const sub of subfolderNames) {
                    // Apply subfolder prefix/suffix here too for consistent behavior on non-previewed items
                    const subName = `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`;
                    const subPath = await join(fullPath, subName);

                    const subExists = await exists(subPath);
                    if (!subExists || config.overwrite) {
                        await mkdir(subPath, { recursive: true });
                    }
                }
            } catch (error: any) {
                const errorMessage = error?.message || 'Unknown error occurred';
                errors.push(`${folderName}: ${errorMessage}`);
                updateStats('error');
                console.error(`Failed to create ${fullPath}`, error);
            }
        }
    } else if (config.creationMode === 'list') {
        const allListItems = config.folderList
            .split(/[\n,]/)
            .map(l => l.trim())
            .filter(l => l.length > 0);

        // If there are more items than previewed (cap 50), create the rest
        if (allListItems.length > validNodes.length) {
            const subfolderNames = config.subfolders
                .split(/[\n,]/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0);

            const currentDate = new Date();

            for (let i = validNodes.length; i < allListItems.length; i++) {
                const rawName = allListItems[i];
                const folderName = generateFolderName(i + 1, config, currentDate, rawName);

                const fullPath = await join(config.rootPath, folderName);

                onProgress(i + 1, allListItems.length, `Creating ${folderName}...`);

                try {
                    const folderExists = await exists(fullPath);
                    let currentStatus: 'success' | 'exists' | 'error' = 'success';

                    if (folderExists && !config.overwrite) {
                        currentStatus = 'exists';
                    } else {
                        await mkdir(fullPath, { recursive: true });
                    }

                    updateStats(currentStatus);

                    for (const sub of subfolderNames) {
                        const subName = `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`;
                        const subPath = await join(fullPath, subName);

                        const subExists = await exists(subPath);
                        if (!subExists || config.overwrite) {
                            await mkdir(subPath, { recursive: true });
                        }
                    }

                } catch (error: any) {
                    const errorMessage = error?.message || 'Unknown error occurred';
                    errors.push(`${folderName}: ${errorMessage}`);
                    updateStats('error');
                    console.error(`Failed to create ${fullPath}`, error);
                }
            }
        }
    } else if (config.creationMode === 'csv') {
        // CSV creation for > 50 items (or all items, really we should just loop all if we want to be safe, but we follow the pattern)
        // Actually, recreate ALL for consistency or just the remaining?
        // The 'validNodes' logic above creates the first 50 (or whatever was previewed/edited).
        // So we only need to create the Rest.

        const rows = config.csvRows || [];
        if (rows.length > validNodes.length) {
            const subfolderNames = config.subfolders
                .split(/[\n,]/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0);

            const currentDate = new Date();

            for (let i = validNodes.length; i < rows.length; i++) {
                const row = rows[i];
                const folderName = generateFolderName(i + 1, config, currentDate, undefined, row);
                const fullPath = await join(config.rootPath, folderName);

                onProgress(i + 1, rows.length, `Creating ${folderName}...`);

                try {
                    const folderExists = await exists(fullPath);
                    let currentStatus: 'success' | 'exists' | 'error' = 'success';

                    if (folderExists && !config.overwrite) {
                        currentStatus = 'exists';
                    } else {
                        await mkdir(fullPath, { recursive: true });
                    }

                    updateStats(currentStatus);

                    for (const sub of subfolderNames) {
                        const subName = `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`;
                        const subPath = await join(fullPath, subName);

                        const subExists = await exists(subPath);
                        if (!subExists || config.overwrite) {
                            await mkdir(subPath, { recursive: true });
                        }
                    }
                } catch (error: any) {
                    const errorMessage = error?.message || 'Unknown error occurred';
                    errors.push(`${folderName}: ${errorMessage}`);
                    updateStats('error');
                    console.error(`Failed to create ${fullPath}`, error);
                }
            }
        }
    }

    // Create pre-creation files if enabled
    if (config.enableFilePreCreation && config.preCreationFiles && config.preCreationFiles.length > 0) {
        const enabledFileCount = config.preCreationFiles.filter(f => f.enabled).length;
        const fileCreationResult = await createPreCreationFiles(
            config,
            updatedNodes,
            createdCount,  // Continue progress from where folders left off
            totalCount + enabledFileCount,
            onProgress,
            onNodeUpdate
        );

        if (!fileCreationResult.success) {
            errors.push(...fileCreationResult.errors);
        }
    }

    return {
        success: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined
    };
};
