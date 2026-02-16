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


    // Flatten the tree
    const flattenNodes = useMemo(() => {
        if (!rootPath || !filesCache.has(rootPath)) return [];

        const nodes: VirtualNode[] = [];

        // We start with root path contents
        // But we need to process them.
        // We need a recursive function that adds to flat list

        // Helper to process a list of entries at a certain level
        const processEntries = (entries: FileEntry[], level: number) => {
            // Filter first
            // Note: We use the centralized filter logic
            const visibleEntries = entries.filter(e => isFileVisible(e, filterOptions));

            for (const entry of visibleEntries) {
                const expanded = expandedPaths.has(entry.path);
                const loading = loadingPaths.has(entry.path);
                const hasLoaded = filesCache.has(entry.path); // If it's in cache, we've loaded it.

                nodes.push({
                    entry,
                    level,
                    expanded,
                    loading,
                    hasLoaded,
                    index: nodes.length
                });

                if (expanded && entry.isDirectory) {
                    const children = filesCache.get(entry.path);
                    if (children) {
                        processEntries(children, level + 1);
                    } else if (!loading) {
                        // Expanded but no children and not loading? 
                        // Means we might have cleared cache or initial load failed/pending
                        // Or it's currently being fetched (handled by loading check usually).
                        // If it's truly missing, we might show nothing or loading.
                        // But toggleExpand sets loading BEFORE async fetch.
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
