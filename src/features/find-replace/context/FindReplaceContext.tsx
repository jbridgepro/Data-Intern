import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core"; // Updated import for Tauri v2
import { listen } from "@tauri-apps/api/event";
import { FileResult } from "../utils/searchLogic"; // We can reuse the interface or update it
import { SearchOptions } from "../utils/searchLogic";

interface SearchStats {
    scanned: number;
    found: number;
}

interface FindReplaceContextType {
    // State
    selectedPath: string;
    setSelectedPath: (path: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    replaceQuery: string;
    setReplaceQuery: (query: string) => void;
    options: SearchOptions;
    setOptions: (options: SearchOptions) => void;
    
    results: FileResult[];
    isSearching: boolean;
    searchStats: SearchStats;
    statusMessage: string | null;
    
    selectedMatches: Set<string>;
    toggleMatchSelection: (id: string, multi?: boolean) => void;
    selectAllMatches: () => void;
    clearSelection: () => void;
    
    // Actions
    startSearch: () => Promise<void>;
    stopSearch: () => void;
    clearResults: () => void;
}

const FindReplaceContext = createContext<FindReplaceContextType | null>(null);

export const useFindReplace = () => {
    const context = useContext(FindReplaceContext);
    if (!context) {
        throw new Error("useFindReplace must be used within a FindReplaceProvider");
    }
    return context;
};

export const FindReplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Persistent State (could use local storage directly or usePersistentState hook if lifted)
    // For now we use local state here, which persists as long as App is mounted.
    
    const [selectedPath, setSelectedPath] = useState<string>(() => localStorage.getItem("fr-path") || "");
    const [searchQuery, setSearchQuery] = useState<string>(() => localStorage.getItem("fr-query") || "");
    const [replaceQuery, setReplaceQuery] = useState<string>(() => localStorage.getItem("fr-replace") || "");
    
    const [options, setOptions] = useState<SearchOptions>(() => {
        const saved = localStorage.getItem("fr-options");
        return saved ? JSON.parse(saved) : {
            matchCase: false,
            useRegex: false,
            wholeWord: false,
            includePattern: "",
            excludePattern: "",
            target: "all"
        };
    });

    const [results, setResults] = useState<FileResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchStats, setSearchStats] = useState<SearchStats>({ scanned: 0, found: 0 });
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());

    // Save persistence
    useEffect(() => { localStorage.setItem("fr-path", selectedPath); }, [selectedPath]);
    useEffect(() => { localStorage.setItem("fr-query", searchQuery); }, [searchQuery]);
    useEffect(() => { localStorage.setItem("fr-replace", replaceQuery); }, [replaceQuery]);
    useEffect(() => { localStorage.setItem("fr-options", JSON.stringify(options)); }, [options]);

    const activeSearchIdRef = useRef<string | null>(null);
    const unlistenRef = useRef<(() => void)[]>([]);

    const cleanupListeners = () => {
        unlistenRef.current.forEach(u => u());
        unlistenRef.current = [];
    };

    const stopSearch = useCallback(async () => {
        // In Rust, we rely on the command finishing or us ignoring events.
        // Ideally we send a cancel command, but for now ignoring events is "stopping" from UI perspective.
        cleanupListeners();
        setIsSearching(false);
        activeSearchIdRef.current = null;
        setStatusMessage("Search stopped.");
    }, []);

    const startSearch = useCallback(async () => {
        if (!selectedPath || !searchQuery) return;
        
        // Stop previous
        if (isSearching) {
            await stopSearch();
        }

        setIsSearching(true);
        setResults([]);
        setSearchStats({ scanned: 0, found: 0 });
        setStatusMessage("Searching...");
        setSelectedMatches(new Set());
        
        const searchId = Date.now().toString();
        activeSearchIdRef.current = searchId;

        try {
            // Listeners
            const unlistenResults = await listen<FileResult[]>(`search-results-${searchId}`, (event) => {
                if (activeSearchIdRef.current !== searchId) return;
                setResults(prev => [...prev, ...event.payload]);
            });
            
            const unlistenProgress = await listen<SearchStats>(`search-progress-${searchId}`, (event) => {
                if (activeSearchIdRef.current !== searchId) return;
                setSearchStats(event.payload);
            });
            
            const unlistenDone = await listen(`search-done-${searchId}`, () => {
                if (activeSearchIdRef.current !== searchId) return;
                setIsSearching(false);
                setStatusMessage((prev) => prev === "Searching..." ? "Done." : prev);
                cleanupListeners();
            });

            unlistenRef.current.push(unlistenResults, unlistenProgress, unlistenDone);

            // Invoke Rust Command
            await invoke("search_filesystem", {
                rootPath: selectedPath,
                query: searchQuery,
                options: {
                    match_case: options.matchCase,
                    use_regex: options.useRegex,
                    whole_word: options.wholeWord,
                    include_pattern: options.includePattern || null,
                    exclude_pattern: options.excludePattern || null,
                    target: options.target
                },
                searchId
            });

        } catch (error: any) {
            console.error("Search failed", error);
            setStatusMessage(`Error: ${error.message || error}`);
            setIsSearching(false);
            cleanupListeners();
        }
    }, [selectedPath, searchQuery, options]);

    const clearResults = useCallback(() => {
        setResults([]);
        setSearchStats({ scanned: 0, found: 0 });
        setStatusMessage(null);
        setSelectedMatches(new Set());
    }, []);
    
    // Selection Helpers
    const toggleMatchSelection = useCallback((id: string) => {
        setSelectedMatches(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAllMatches = useCallback(() => {
        const allIds = new Set<string>();
        results.forEach(res => {
            res.matches.forEach(m => {
                 allIds.add(`${res.path}:${m.line}:${m.matchIndex}`);
            });
        });
        setSelectedMatches(allIds);
    }, [results]);

    const clearSelection = useCallback(() => setSelectedMatches(new Set()), []);

    return (
        <FindReplaceContext.Provider value={{
            selectedPath, setSelectedPath,
            searchQuery, setSearchQuery,
            replaceQuery, setReplaceQuery,
            options, setOptions,
            results, isSearching, searchStats, statusMessage,
            selectedMatches, toggleMatchSelection, selectAllMatches, clearSelection,
            startSearch, stopSearch, clearResults
        }}>
            {children}
        </FindReplaceContext.Provider>
    );
};
