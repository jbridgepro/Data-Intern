/**
 * File: src/features/folder-creation/utils/folderUtils.ts
 * 
 * Back-end utility functions for folder creation, preview generation, and statistics tracking.
 * Handles folder naming patterns, date formatting, and folder structure generation.
 */

import { mkdir, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

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
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD' | 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD_HH-MM-SS' | 'YYYYMMDD_HHMMSS' | 'timestamp';
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
}

export interface PreviewNode {
    id: string;
    name: string;
    type: "folder" | "file";
    children?: PreviewNode[];
    status?: 'pending' | 'success' | 'error' | 'exists';
    errorMessage?: string;
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
 * Formats date/time according to the specified format
 * @param format - The date/time format to use
 * @param date - Optional date object (defaults to current date)
 * @returns Formatted date/time string
 */
export const formatDate = (format: string, date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    switch (format) {
        case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
        case 'YYYYMMDD': return `${year}${month}${day}`;
        case 'DD-MM-YYYY': return `${day}-${month}-${year}`;
        case 'MM-DD-YYYY': return `${month}-${day}-${year}`;
        case 'YYYY-MM-DD_HH-MM-SS': return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
        case 'YYYYMMDD_HHMMSS': return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        case 'timestamp': return String(date.getTime());
        default: return `${year}-${month}-${day}`;
    }
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
            return shownNodes;
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
        stats[status]++;

        if (node.children) {
            node.children.forEach(countNode);
        }
    };

    nodes.forEach(countNode);
    return stats;
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
    onNodeUpdate?: (updatedNodes: PreviewNode[]) => void
): Promise<{ success: boolean; error?: string }> => {
    if (!config.rootPath) {
        return { success: false, error: "Root path is required" };
    }

    // We only create nodes that are NOT placeholders
    const validNodes = nodes.filter(n => n.id !== 'more-placeholder');
    const updatedNodes = [...validNodes];

    const totalCount = config.count;
    let createdCount = 0;
    const errors: string[] = [];

    // 1. Create editable nodes (The PreviewNodes are the Source of Truth)
    for (let i = 0; i < validNodes.length; i++) {
        const node = validNodes[i];
        createdCount++;
        const fullPath = await join(config.rootPath, node.name);

        onProgress(createdCount, totalCount, `Creating ${node.name}...`);

        try {
            const folderExists = await exists(fullPath);

            if (folderExists && !config.overwrite) {
                updatedNodes[i] = { ...node, status: 'exists' };
                onNodeUpdate?.([...updatedNodes]);
                continue;
            }

            await mkdir(fullPath, { recursive: true });

            // Create subfolders
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    // Skip if child name is empty or invalid
                    if (!child.name || child.name.trim().length === 0) {
                        continue;
                    }
                    const subPath = await join(fullPath, child.name);
                    try {
                        await mkdir(subPath, { recursive: true });
                        console.log(`Created subfolder: ${subPath}`);
                    } catch (subError: any) {
                        console.error(`Failed to create subfolder ${subPath}:`, subError);
                        // Continue with other subfolders even if one fails
                    }
                }
            }

            updatedNodes[i] = { ...node, status: 'success' };
            onNodeUpdate?.([...updatedNodes]);
        } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error occurred';
            errors.push(`${node.name}: ${errorMessage}`);
            updatedNodes[i] = { ...node, status: 'error', errorMessage };
            onNodeUpdate?.([...updatedNodes]);
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

                if (folderExists && !config.overwrite) {
                    continue;
                }

                await mkdir(fullPath, { recursive: true });

                for (const sub of subfolderNames) {
                    // Apply subfolder prefix/suffix here too for consistent behavior on non-previewed items
                    const subName = `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`;
                    const subPath = await join(fullPath, subName);
                    await mkdir(subPath, { recursive: true });
                }
            } catch (error: any) {
                const errorMessage = error?.message || 'Unknown error occurred';
                errors.push(`${folderName}: ${errorMessage}`);
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
                    if (folderExists && !config.overwrite) continue;

                    await mkdir(fullPath, { recursive: true });

                    for (const sub of subfolderNames) {
                        const subName = `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`;
                        const subPath = await join(fullPath, subName);
                        await mkdir(subPath, { recursive: true });
                    }

                } catch (error: any) {
                    const errorMessage = error?.message || 'Unknown error occurred';
                    errors.push(`${folderName}: ${errorMessage}`);
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
                    if (folderExists && !config.overwrite) continue;

                    await mkdir(fullPath, { recursive: true });

                    for (const sub of subfolderNames) {
                        const subName = `${config.subfolderPrefix}${sub}${config.subfolderSuffix}`;
                        const subPath = await join(fullPath, subName);
                        await mkdir(subPath, { recursive: true });
                    }
                } catch (error: any) {
                    const errorMessage = error?.message || 'Unknown error occurred';
                    errors.push(`${folderName}: ${errorMessage}`);
                    console.error(`Failed to create ${fullPath}`, error);
                }
            }
        }
    }

    return {
        success: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined
    };
};
