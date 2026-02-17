/**
 * File path: ./src/features/find-replace/context/FindReplaceContext.tsx
 *
 * Front-end: Global context for Find and Replace feature.
 * Manages search state, results, selection, search history,
 * and timing for background execution via Tauri backend.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FileResult, SearchOptions } from "../utils/searchLogic";

/** Stats tracked during an active search */
interface SearchStats {
    scanned: number;
    found: number;
}

/** Shape of the context exposed to consumers */
interface FindReplaceContextType {
    /* ── Inputs ── */
    selectedPath: string;
    setSelectedPath: (path: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    replaceQuery: string;
    setReplaceQuery: (query: string) => void;
    options: SearchOptions;
    setOptions: (options: SearchOptions) => void;

    /* ── Results & Progress ── */
    results: FileResult[];
    isSearching: boolean;
    searchStats: SearchStats;
    statusMessage: string | null;
    hasSearched: boolean;
    searchDuration: number | null;

    /* ── Search History ── */
    searchHistory: string[];
    clearSearchHistory: () => void;

    /* ── Selection ── */
    selectedMatches: Set<string>;
    toggleMatchSelection: (id: string) => void;
    toggleFileSelection: (matchIds: string[], select: boolean) => void;
    selectAllMatches: () => void;
    clearSelection: () => void;

    /* ── Actions ── */
    startSearch: () => Promise<void>;
    stopSearch: () => void;
    clearResults: () => void;
}

const FindReplaceContext = createContext<FindReplaceContextType | null>(null);

/**
 * Hook to consume the FindReplace context.
 * Must be called within a FindReplaceProvider.
 */
export const useFindReplace = () => {
    const context = useContext(FindReplaceContext);
    if (!context) {
        throw new Error("useFindReplace must be used within a FindReplaceProvider");
    }
    return context;
};

/** Maximum number of search history entries to persist */
const MAX_SEARCH_HISTORY = 20;

/**
 * Provider component for the Find & Replace feature.
 * Encapsulates all search state, history, selection logic,
 * and communication with the Rust backend.
 */
export const FindReplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    /* ── Persisted input state ── */
    const [selectedPath, setSelectedPath] = useState<string>(() =>
        localStorage.getItem("fr-path") || ""
    );
    const [searchQuery, setSearchQuery] = useState<string>(() =>
        localStorage.getItem("fr-query") || ""
    );
    const [replaceQuery, setReplaceQuery] = useState<string>(() =>
        localStorage.getItem("fr-replace") || ""
    );
    const [options, setOptions] = useState<SearchOptions>(() => {
        const saved = localStorage.getItem("fr-options");
        return saved
            ? JSON.parse(saved)
            : {
                  matchCase: false,
                  useRegex: false,
                  wholeWord: false,
                  includePattern: "",
                  excludePattern: "",
                  target: "all",
              };
    });

    /* ── Search history ── */
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        const saved = localStorage.getItem("fr-search-history");
        return saved ? JSON.parse(saved) : [];
    });

    /* ── Results & progress state ── */
    const [results, setResults] = useState<FileResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchStats, setSearchStats] = useState<SearchStats>({ scanned: 0, found: 0 });
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
    const [hasSearched, setHasSearched] = useState(false);
    const [searchDuration, setSearchDuration] = useState<number | null>(null);

    /* ── Refs for active search lifecycle ── */
    const activeSearchIdRef = useRef<string | null>(null);
    const unlistenRef = useRef<(() => void)[]>([]);
    const searchStartTimeRef = useRef<number | null>(null);

    /* ── Persist inputs to localStorage ── */
    useEffect(() => { localStorage.setItem("fr-path", selectedPath); }, [selectedPath]);
    useEffect(() => { localStorage.setItem("fr-query", searchQuery); }, [searchQuery]);
    useEffect(() => { localStorage.setItem("fr-replace", replaceQuery); }, [replaceQuery]);
    useEffect(() => { localStorage.setItem("fr-options", JSON.stringify(options)); }, [options]);

    /** Add a query to the search history (deduped, most-recent-first) */
    const addToSearchHistory = useCallback((query: string) => {
        if (!query.trim()) return;
        setSearchHistory((prev) => {
            const deduped = prev.filter((item) => item !== query);
            const updated = [query, ...deduped].slice(0, MAX_SEARCH_HISTORY);
            localStorage.setItem("fr-search-history", JSON.stringify(updated));
            return updated;
        });
    }, []);

    /** Clear entire search history */
    const clearSearchHistory = useCallback(() => {
        setSearchHistory([]);
        localStorage.removeItem("fr-search-history");
    }, []);

    /** Remove all active Tauri event listeners */
    const cleanupListeners = () => {
        unlistenRef.current.forEach((u) => u());
        unlistenRef.current = [];
    };

    /** Stop the current search (from the UI perspective) */
    const stopSearch = useCallback(async () => {
        cleanupListeners();
        setIsSearching(false);
        activeSearchIdRef.current = null;

        /* Calculate duration if the search was in progress */
        if (searchStartTimeRef.current !== null) {
            setSearchDuration(Date.now() - searchStartTimeRef.current);
            searchStartTimeRef.current = null;
        }
        setStatusMessage("Search stopped.");
    }, []);

    /** Launch a search against the Rust backend */
    const startSearch = useCallback(async () => {
        if (!selectedPath || !searchQuery) return;

        /* Stop any previous search first */
        if (isSearching) {
            await stopSearch();
        }

        /* Reset UI state for the new search */
        setIsSearching(true);
        setHasSearched(true);
        setResults([]);
        setSearchStats({ scanned: 0, found: 0 });
        setStatusMessage("Searching...");
        setSelectedMatches(new Set());
        setSearchDuration(null);

        /* Record the start time so we can compute duration later */
        searchStartTimeRef.current = Date.now();

        /* Track query in search history */
        addToSearchHistory(searchQuery);

        const searchId = Date.now().toString();
        activeSearchIdRef.current = searchId;

        try {
            /* ── Subscribe to Tauri events for this search run ── */
            const unlistenResults = await listen<FileResult[]>(
                `search-results-${searchId}`,
                (event) => {
                    if (activeSearchIdRef.current !== searchId) return;
                    setResults((prev) => [...prev, ...event.payload]);
                }
            );

            const unlistenProgress = await listen<SearchStats>(
                `search-progress-${searchId}`,
                (event) => {
                    if (activeSearchIdRef.current !== searchId) return;
                    setSearchStats(event.payload);
                }
            );

            const unlistenDone = await listen(`search-done-${searchId}`, () => {
                if (activeSearchIdRef.current !== searchId) return;
                setIsSearching(false);

                /* Compute final search duration */
                if (searchStartTimeRef.current !== null) {
                    setSearchDuration(Date.now() - searchStartTimeRef.current);
                    searchStartTimeRef.current = null;
                }

                setStatusMessage((prev) => (prev === "Searching..." ? "Done." : prev));
                cleanupListeners();
            });

            unlistenRef.current.push(unlistenResults, unlistenProgress, unlistenDone);

            /* ── Invoke the Rust search command ── */
            await invoke("search_filesystem", {
                rootPath: selectedPath,
                query: searchQuery,
                options: {
                    match_case: options.matchCase,
                    use_regex: options.useRegex,
                    whole_word: options.wholeWord,
                    include_pattern: options.includePattern || null,
                    exclude_pattern: options.excludePattern || null,
                    target: options.target,
                },
                searchId,
            });
        } catch (error: any) {
            console.error("Search failed", error);
            setStatusMessage(`Error: ${error.message || error}`);
            setIsSearching(false);

            if (searchStartTimeRef.current !== null) {
                setSearchDuration(Date.now() - searchStartTimeRef.current);
                searchStartTimeRef.current = null;
            }
            cleanupListeners();
        }
    }, [selectedPath, searchQuery, options, isSearching, stopSearch, addToSearchHistory]);

    /** Clear all search results and reset UI state */
    const clearResults = useCallback(() => {
        setResults([]);
        setSearchStats({ scanned: 0, found: 0 });
        setStatusMessage(null);
        setSelectedMatches(new Set());
        setSearchDuration(null);
        setHasSearched(false);
    }, []);

    /* ── Selection helpers ── */

    /** Toggle a single match by its composite ID */
    const toggleMatchSelection = useCallback((id: string) => {
        setSelectedMatches((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    /** Bulk-select or bulk-deselect a set of match IDs (e.g., all matches in a file) */
    const toggleFileSelection = useCallback((matchIds: string[], select: boolean) => {
        setSelectedMatches((prev) => {
            const next = new Set(prev);
            matchIds.forEach((id) => {
                if (select) next.add(id);
                else next.delete(id);
            });
            return next;
        });
    }, []);

    /** Select every match in the current result set */
    const selectAllMatches = useCallback(() => {
        const allIds = new Set<string>();
        results.forEach((res) => {
            res.matches.forEach((m) => {
                allIds.add(`${res.path}:${m.line}:${m.matchIndex}`);
            });
        });
        setSelectedMatches(allIds);
    }, [results]);

    /** Deselect all matches */
    const clearSelection = useCallback(() => setSelectedMatches(new Set()), []);

    return (
        <FindReplaceContext.Provider
            value={{
                selectedPath, setSelectedPath,
                searchQuery, setSearchQuery,
                replaceQuery, setReplaceQuery,
                options, setOptions,

                results, isSearching, searchStats, statusMessage,
                hasSearched, searchDuration,

                searchHistory, clearSearchHistory,

                selectedMatches, toggleMatchSelection, toggleFileSelection,
                selectAllMatches, clearSelection,

                startSearch, stopSearch, clearResults,
            }}
        >
            {children}
        </FindReplaceContext.Provider>
    );
};
