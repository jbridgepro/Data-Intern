
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";

export interface SearchOptions {
    matchCase: boolean;
    useRegex: boolean;
    wholeWord: boolean;
    includePattern: string;
    excludePattern: string;
    target: 'content' | 'filename' | 'folder' | 'all';
}

export interface Match {
    file: string;
    line: number;
    content: string;
    matchIndex: number;
    length: number;
    source: 'content' | 'filename' | 'folder';
}

export interface FileResult {
    path: string;
    matches: Match[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RESULTS = 1000;

export async function searchFiles(
    rootPath: string,
    query: string,
    options: SearchOptions,
    onProgress: (scanned: number, found: number) => void,
    shouldCancel: () => boolean
): Promise<FileResult[]> {
    const results: FileResult[] = [];
    let scannedCount = 0;
    let matchCount = 0;

    // Use default if target is missing
    const target = options.target || 'content';

    const isBrowser = !(window as any).__TAURI_INTERNALS__;
    if (isBrowser) {
        // Mock search logic not updated for target demo
        return [];
    }

    async function traverse(currentPath: string) {
        if (shouldCancel() || matchCount >= MAX_RESULTS) return;

        try {
            const entries = await readDir(currentPath);

            for (const entry of entries) {
                if (shouldCancel() || matchCount >= MAX_RESULTS) return;

                const fullPath = `${currentPath}/${entry.name}`;
                const relativePath = fullPath.replace(rootPath, '').replace(/^\//, '');

                const isDir = entry.isDirectory;

                if (isDir) {
                    // 1. Exclude Standard Directories
                    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                    if (matchesExclude(relativePath, options.excludePattern)) continue;

                    // 2. Check if searching for folders
                    if (target === 'folder' || target === 'all') {
                        // Check match on folder name
                        const folderMatches = findInContent(entry.name, query, options, fullPath);
                        if (folderMatches.length > 0) {
                            // Map matches to use the folder path
                            results.push({
                                path: fullPath,
                                matches: folderMatches.map(m => ({ ...m, content: entry.name, line: 1, source: 'folder' as const }))
                            });
                            matchCount += folderMatches.length;
                        }
                        // Even if matched, we traverse deeper
                    }

                    await traverse(fullPath);
                } else {
                    // File Handling
                    if (target === 'folder') continue; // Skip files if looking for folders ONLY

                    if (isBinaryFile(entry.name)) continue;
                    if (!matchesFilters(relativePath, options.includePattern, options.excludePattern)) continue;

                    scannedCount++;
                    if (scannedCount % 10 === 0) onProgress(scannedCount, matchCount);

                    // 3. Search Target Logic
                    const fileMatches: Match[] = [];

                    // Check Filename (if target is filename OR all)
                    if (target === 'filename' || target === 'all') {
                        const nameMatches = findInContent(entry.name, query, options, fullPath);
                        if (nameMatches.length > 0) {
                            fileMatches.push(...nameMatches.map(m => ({ ...m, content: entry.name, line: 1, source: 'filename' as const })));
                        }
                    }

                    // Check Content (if target is content OR all)
                    if (target === 'content' || target === 'all') {
                        try {
                            const content = await readTextFile(fullPath);
                            if (content.length <= MAX_FILE_SIZE) {
                                const contentMatches = findInContent(content, query, options, fullPath);
                                if (contentMatches.length > 0) {
                                    fileMatches.push(...contentMatches.map(m => ({ ...m, source: 'content' as const })));
                                }
                            }
                        } catch (e) {
                            // Skip unreadable
                        }
                    }

                    if (fileMatches.length > 0) {
                        results.push({ path: fullPath, matches: fileMatches });
                        matchCount += fileMatches.length;
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to read ${currentPath}`, e);
        }
    }

    await traverse(rootPath);
    return results;
}

function findInContent(content: string, query: string, options: SearchOptions, filePath: string): Match[] {
    const matches: Match[] = [];
    const lines = content.split('\n');

    let regex: RegExp;
    try {
        let pattern = query;
        if (!options.useRegex) {
            pattern = escapeRegExp(query);
        }
        if (options.wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        regex = new RegExp(pattern, options.matchCase ? 'g' : 'gi');
    } catch (e) {
        return []; // Invalid regex
    }

    lines.forEach((line, lineIdx) => {
        let match;
        regex.lastIndex = 0;

        while ((match = regex.exec(line)) !== null) {
            matches.push({
                file: filePath,
                line: lineIdx + 1,
                content: line,
                matchIndex: match.index,
                length: match[0].length
            });
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }
    });

    return matches;
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isBinaryFile(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'zip', 'tar', 'gz', 'mp4', 'mp3', 'exe', 'bin', 'dll'];
    return binaryExts.includes(ext || '');
}

// Simple Glob Matching Logic
function matchesFilters(path: string, include: string, exclude: string): boolean {
    const includes = include.split(',').map(s => s.trim()).filter(Boolean);
    const excludes = exclude.split(',').map(s => s.trim()).filter(Boolean);

    const matchesInclude = includes.length === 0 || includes.some(pattern => globMatch(path, pattern));
    const matchesExclude = excludes.some(pattern => globMatch(path, pattern));

    return matchesInclude && !matchesExclude;
}

function matchesExclude(path: string, exclude: string): boolean {
    const excludes = exclude.split(',').map(s => s.trim()).filter(Boolean);
    return excludes.some(pattern => globMatch(path, pattern));
}

function globMatch(path: string, pattern: string): boolean {
    const filename = path.split('/').pop() || '';

    const toRegex = (glob: string) => {
        let r = glob
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '___RECURSIVE___')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/___RECURSIVE___/g, '.*');
        return new RegExp(`^${r}$`, 'i');
    };

    const regex = toRegex(pattern);

    if (!pattern.includes('/')) {
        if (regex.test(filename)) return true;
        const recursiveRegex = toRegex(`**/${pattern}`);
        if (recursiveRegex.test(path)) return true;
    }

    return regex.test(path);
}
