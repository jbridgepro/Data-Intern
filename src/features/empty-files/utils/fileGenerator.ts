/**
 * File: src/features/empty-files/utils/fileGenerator.ts
 * 
 * Utility functions for generating empty file names and previews.
 * Handles various naming patterns including numbering, dates, timestamps, random strings, and UUIDs.
 */

// import { join } from "@tauri-apps/api/path";

export interface FileConfig {
    rootPath: string;
    baseName: string;
    extensions: string[]; // e.g. ['txt', 'md']

    // Numbering
    useNumbering: boolean;
    count: number;
    startNumber: number;
    digitCount: number; // 1, 2, 3, 4 (padding)
    numberPosition: 'prefix' | 'suffix' | 'after-prefix' | 'before-suffix';

    // Formatting
    separator: string; // "-", "_", "."

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

    overwrite: boolean;

    // Creation Mode
    creationMode: 'pattern' | 'list' | 'csv';
    fileList: string;

    // CSV Configuration
    csvDelimiter: string;
    csvColumnOrder: string[];
    csvColumnConfig: Record<string, {
        enabled: boolean;
        prefix: string;
        suffix: string;
    }>;
    csvRows: Record<string, string>[];
    csvHeaders: string[];
}

export interface GeneratedFile {
    id: string; // for React keys
    name: string;
    path: string; // full path
    status: 'pending' | 'success' | 'error' | 'exists';
    errorMessage?: string; // Detailed error message if status is 'error'
}

export interface GenerationStats {
    total: number;
    success: number;
    error: number;
    exists: number;
    pending: number;
}

/**
 * Formats date/time according to the specified format
 * @param format - The date/time format to use
 * @returns Formatted date/time string
 */
const formatDate = (format: string): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    switch (format) {
        case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
        case 'YYYYMMDD': return `${year}${month}${day}`;
        case 'DD-MM-YYYY': return `${day}-${month}-${year}`;
        case 'MM-DD-YYYY': return `${month}-${day}-${year}`;
        case 'YYYY-MM-DD_HH-MM-SS': return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
        case 'YYYYMMDD_HHMMSS': return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        case 'timestamp': return String(d.getTime());
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
 * Generates a preview list of files based on the configuration
 * @param config - File generation configuration
 * @returns Array of generated file objects
 */
/**
 * Generates a single file name based on configuration and index
 * @param index - The file index (1-based)
 * @param config - File configuration
 * @param customBaseName - Optional base name override (for List Mode)
 * @param dateStr - Pre-calculated date string
 * @returns Generated file name without extension
 */
const generateFileNameNoExt = (
    index: number,
    config: FileConfig,
    customBaseName?: string,
    dateStr: string = '',
    csvRow?: Record<string, string> // Added for CSV mode
): string => {
    const {
        baseName,
        useNumbering, startNumber, digitCount, numberPosition,
        separator,
        customPrefix, customSuffix,
        useRandomString, randomStringLength, randomStringPosition,
        useUUID, uuidPosition,
        creationMode, // Added
        csvDelimiter, // Added
        csvColumnOrder, // Added
        csvColumnConfig // Added
    } = config;

    const currentNum = startNumber + (index - 1);
    const numStr = useNumbering
        ? String(currentNum).padStart(digitCount, '0')
        : '';

    // Generate random string and UUID per file (if enabled)
    const randomStr = useRandomString ? generateRandomString(randomStringLength) : '';
    const uuidStr = useUUID ? generateUUID() : '';

    // Build file name parts in order: [Prefix Items] [Base] [Suffix Items]
    let prefixParts: string[] = [];
    let suffixParts: string[] = [];
    let middleParts: string[] = [];

    // Add custom prefix
    if (customPrefix) prefixParts.push(customPrefix);

    // Add date/time to prefix if specified
    if (config.useDate && config.datePosition === 'prefix') prefixParts.push(dateStr);

    // Add UUID to prefix if specified
    if (useUUID && uuidPosition === 'prefix') prefixParts.push(uuidStr);

    // Add random string to prefix if specified
    if (useRandomString && randomStringPosition === 'prefix') prefixParts.push(randomStr);

    // Add number to prefix if specified
    if (useNumbering && numberPosition === 'prefix') prefixParts.push(numStr);

    // Add base name
    if (creationMode === 'csv' && csvRow) {
        // Build base name from CSV columns
        const csvParts: string[] = [];
        const order = csvColumnOrder && csvColumnOrder.length > 0 ? csvColumnOrder : [];

        order.forEach(colId => {
            const colConfig = csvColumnConfig?.[colId];
            if (colConfig?.enabled !== false) {
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
    if (config.useDate && config.datePosition === 'suffix') suffixParts.push(dateStr);

    // Add custom suffix
    if (customSuffix) suffixParts.push(customSuffix);

    // Combine all parts
    const allParts = [...prefixParts, ...middleParts, ...suffixParts].filter(p => p.length > 0);
    return allParts.length > 0 ? allParts.join(separator) : 'file';
};

/**
 * Generates a preview list of files based on the configuration
 * @param config - File generation configuration
 * @returns Array of generated file objects
 */
export const generatePreview = async (config: FileConfig): Promise<GeneratedFile[]> => {
    const files: GeneratedFile[] = [];
    const {
        rootPath, extensions, count,
        useDate, dateFormat
    } = config;

    // Pre-calculate date string if needed (same for all files in preview)
    const dateStr = useDate ? formatDate(dateFormat) : '';
    const activeExtensions = extensions.length > 0 ? extensions : ['']; // Ensure at least one pass if no extension

    if (config.creationMode === 'list') {
        const lines = config.fileList
            .split(/[\n,]/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        let fileIndex = 0;
        for (const lineName of lines) {
            fileIndex++;
            const fileNameNoExt = generateFileNameNoExt(fileIndex, config, lineName, dateStr);

            for (const ext of activeExtensions) {
                const fullExt = ext.startsWith('.') || ext === '' ? ext : `.${ext}`;
                const fileName = `${fileNameNoExt}${fullExt}`;
                // Construct full path (simplified for preview)
                const fullPath = rootPath ? `${rootPath}/${fileName}` : fileName;

                files.push({
                    id: `file-list-${fileIndex}-${ext}-${Date.now()}`,
                    name: fileName,
                    path: fullPath,
                    status: 'pending'
                });
            }
        }
    } else if (config.creationMode === 'csv') {
        if (!config.csvRows || config.csvRows.length === 0) return [];

        const rows = config.csvRows.slice(0, 50); // Limit to 50 for preview

        rows.forEach((row, index) => {
            const fileNameNoExt = generateFileNameNoExt(index + 1, config, undefined, dateStr, row);

            for (const ext of activeExtensions) {
                const fullExt = ext.startsWith('.') || ext === '' ? ext : `.${ext}`;
                const fileName = `${fileNameNoExt}${fullExt}`;
                const fullPath = rootPath ? `${rootPath}/${fileName}` : fileName;

                files.push({
                    id: `file-csv-${index}-${ext}-${Date.now()}`,
                    name: fileName,
                    path: fullPath,
                    status: 'pending'
                });
            }
        });

    } else {
        // Pattern Mode
        for (let i = 1; i <= count; i++) {
            const fileNameNoExt = generateFileNameNoExt(i, config, undefined, dateStr);

            for (const ext of activeExtensions) {
                const fullExt = ext.startsWith('.') || ext === '' ? ext : `.${ext}`;
                const fileName = `${fileNameNoExt}${fullExt}`;

                // Construct full path (simplified for preview)
                const fullPath = rootPath ? `${rootPath}/${fileName}` : fileName;

                files.push({
                    id: `file-${i}-${ext}-${Date.now()}`,
                    name: fileName,
                    path: fullPath,
                    status: 'pending'
                });
            }
        }
    }

    return files;
};

/**
 * Calculates statistics from generated files
 * @param files - Array of generated files
 * @returns Statistics object
 */
export const calculateStats = (files: GeneratedFile[]): GenerationStats => {
    return files.reduce((stats, file) => {
        stats.total++;
        stats[file.status]++;
        return stats;
    }, {
        total: 0,
        success: 0,
        error: 0,
        exists: 0,
        pending: 0
    });
};
