import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileEntry } from '../hooks/useFileSystem';
import { isFileVisible, FilterOptions } from '../utils/filterUtils';

export interface VirtualNode {
    entry: FileEntry;
    level: number;
    expanded: boolean;
    loading: boolean;
    hasLoaded: boolean; // Add this to track if we've ever loaded this folder
    index: number; // Unique index in the flat list
}

interface UseVirtualFileTreeProps {
    rootPath: string;
    getDirectoryContents: (path: string) => Promise<FileEntry[]>;
    filterOptions: FilterOptions;
}

export const useVirtualFileTree = ({
    rootPath,
    getDirectoryContents,
    filterOptions,
}: UseVirtualFileTreeProps) => {
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [filesCache, setFilesCache] = useState<Map<string, FileEntry[]>>(new Map());
    const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [rootLoading, setRootLoading] = useState(false);

    // Initial load of root path
    useEffect(() => {
        if (!rootPath) {
            setFilesCache(new Map());
            setExpandedPaths(new Set());
            return;
        }

        const loadRoot = async () => {
            setRootLoading(true);
            setError(null);
            try {
                const entries = await getDirectoryContents(rootPath);
                setFilesCache(prev => {
                    const next = new Map(prev);
                    next.set(rootPath, entries);
                    return next;
                });
            } catch (err: any) {
                console.error("Failed to load root:", err);
                setError(err.message || String(err));
            } finally {
                setRootLoading(false);
            }
        };
        loadRoot();
    }, [rootPath, getDirectoryContents]);

    const toggleExpand = useCallback(async (entry: FileEntry) => {
        if (!entry.isDirectory) return;

        const isExpanded = expandedPaths.has(entry.path);

        if (isExpanded) {
            // Collapse
            setExpandedPaths(prev => {
                const next = new Set(prev);
                next.delete(entry.path);
                return next;
            });
        } else {
            // Expand
            setExpandedPaths(prev => {
                const next = new Set(prev);
                next.add(entry.path);
                return next;
            });

            // Load children if not cached
            if (!filesCache.has(entry.path)) {
                setLoadingPaths(prev => {
                    const next = new Set(prev);
                    next.add(entry.path);
                    return next;
                });

                try {
                    const children = await getDirectoryContents(entry.path);
                    setFilesCache(prev => {
                        const next = new Map(prev);
                        next.set(entry.path, children);
                        return next;
                    });
                } catch (err) {
                    console.error(`Failed to load children for ${entry.path}`, err);
                } finally {
                    setLoadingPaths(prev => {
                        const next = new Set(prev);
                        next.delete(entry.path);
                        return next;
                    });
                }
            }
        }
    }, [expandedPaths, filesCache, getDirectoryContents]);


    // Flatten the tree into a virtual list with smart search behavior
    const flattenNodes = useMemo(() => {
        if (!rootPath || !filesCache.has(rootPath)) return [];

        const nodes: VirtualNode[] = [];
        const activeSearchTerm = filterOptions.searchTerm?.trim().toLowerCase() || "";
        const isSearchActive = activeSearchTerm.length > 0;

        /**
         * When search is active, checks if a directory (or its loaded descendants)
         * contains any entries matching the current search term and filters.
         * Returns false for unloaded directories — we can only confirm matches
         * for directories whose contents have been cached (previously expanded).
         * Directories whose names match the search term are handled separately
         * in processEntries via the dirNameMatches check.
         */
        const hasMatchingDescendants = (dirPath: string): boolean => {
            const children = filesCache.get(dirPath);
            if (!children) return false; // Not loaded — can't confirm any matches

            return children.some(child => {
                if (child.isDirectory) {
                    // Directory counts as matching if its name matches the search
                    // OR if any of its own loaded descendants match
                    return child.name.toLowerCase().includes(activeSearchTerm) ||
                           hasMatchingDescendants(child.path);
                }
                // For files, use the full filter check (extension filters + search term)
                return isFileVisible(child, filterOptions);
            });
        };

        /**
         * Recursively processes entries into the flat virtual node list.
         * When search is active: auto-expands loaded dirs and hides empty non-matching dirs.
         */
        const processEntries = (entries: FileEntry[], level: number) => {
            const visibleEntries = entries.filter(e => isFileVisible(e, filterOptions));

            for (const entry of visibleEntries) {
                // When search is active, hide directories with no matching name or descendants
                if (isSearchActive && entry.isDirectory) {
                    const dirNameMatches = entry.name.toLowerCase().includes(activeSearchTerm);
                    if (!dirNameMatches && !hasMatchingDescendants(entry.path)) {
                        continue;
                    }
                }

                // When search is active, auto-expand all loaded directories to reveal matches
                const isExpanded = isSearchActive
                    ? (entry.isDirectory && filesCache.has(entry.path))
                    : expandedPaths.has(entry.path);
                const loading = loadingPaths.has(entry.path);
                const hasLoaded = filesCache.has(entry.path);

                nodes.push({
                    entry,
                    level,
                    expanded: isExpanded,
                    loading,
                    hasLoaded,
                    index: nodes.length
                });

                if (isExpanded && entry.isDirectory) {
                    const children = filesCache.get(entry.path);
                    if (children) {
                        processEntries(children, level + 1);
                    }
                }
            }
        };

        const rootEntries = filesCache.get(rootPath) || [];
        processEntries(rootEntries, 0);

        return nodes;
    }, [rootPath, filesCache, expandedPaths, loadingPaths, filterOptions]);

    const collapseAll = useCallback(() => {
        setExpandedPaths(new Set());
    }, []);

    const expandAll = useCallback(() => {
        // Expand all currently known directories in the cache
        const allPaths = new Set<string>();
        filesCache.forEach((_, path) => {
            allPaths.add(path);
        });
        setExpandedPaths(allPaths);
    }, [filesCache]);

    return {
        rows: flattenNodes,
        toggleExpand,
        collapseAll,
        expandAll,
        rootLoading,
        error,
        refreshRoot: () => {
            // Simple re-trigger
            setFilesCache(new Map());
            setExpandedPaths(new Set());
        }
    };
};
