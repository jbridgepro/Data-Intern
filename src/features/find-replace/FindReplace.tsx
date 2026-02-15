/**
 * File path: ./src/features/find-replace/FindReplace.tsx
 *
 * Main component for Find and Replace functionality.
 * Refactored to use FindToolbar and FindActions.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { FindToolbar } from "./components/FindToolbar";
import { FindActions } from "./components/FindActions";
import { ResultsPreview } from "./components/ResultsPreview";
import { searchFiles, SearchOptions, FileResult } from "./utils/searchLogic";
import { replaceInFile } from "./utils/replaceLogic";
import { AlertCircle, Search, X, CheckCircle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { findReplaceInfo } from "@/components/layout/toolInfoContent";
import { Button } from "@/components/ui/button";
import { open } from "@tauri-apps/plugin-dialog";
import { useFileSystem } from "../file-copy/hooks/useFileSystem";
import { usePersistentState } from "../../hooks/usePersistentState";

export const FindReplace = () => {
  // Use file system hook for consistency if needed, but we manage path locally for flexibility
  // Actually reusing useFileSystem might be good for recent paths logic if it was shared.
  // For now we'll implement local recent paths similar to Copy feature.

  const [selectedPath, setSelectedPath, resetSelectedPath] = usePersistentState<string>("find-replace-path", "");
  const [searchQuery, setSearchQuery, resetSearchQuery] = usePersistentState("find-replace-search-query", "");
  const [replaceQuery, setReplaceQuery, resetReplaceQuery] = usePersistentState("find-replace-replace-query", "");
  
  const [options, setOptions, resetOptions] = usePersistentState<SearchOptions>("find-replace-options", {
    matchCase: false,
    useRegex: false,
    wholeWord: false,
    includePattern: "",
    excludePattern: "",
    target: "all"
  });

  const [results, setResults] = useState<FileResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStats, setSearchStats] = useState({ scanned: 0, found: 0 });
  
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [replacePreview, setReplacePreview] = useState<{
    count: number;
    files: number;
  } | null>(null);
  
  const [focusedMatchIndex, setFocusedMatchIndex] = useState<number | null>(null);
  
  const [recentPaths, setRecentPaths] = useState<string[]>(() => {
      const saved = localStorage.getItem("find-replace-recent-paths");
      return saved ? JSON.parse(saved) : [];
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Save recent paths
  useEffect(() => {
    if (selectedPath && !recentPaths.includes(selectedPath)) {
      const updated = [selectedPath, ...recentPaths].slice(0, 10);
      setRecentPaths(updated);
      localStorage.setItem("find-replace-recent-paths", JSON.stringify(updated));
    }
  }, [selectedPath]);

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setSelectedPath(selected);
      }
    } catch (e) {
      console.error("Failed to browse", e);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!selectedPath) {
      setStatusMessage("Please select a folder first");
      return;
    }
    if (!searchQuery) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setResults([]);
    setSearchStats({ scanned: 0, found: 0 });
    setStatusMessage(null);
    setSelectedMatches(new Set());
    setFocusedMatchIndex(null);

    try {
      const foundResults = await searchFiles(
        selectedPath,
        searchQuery,
        options,
        (scanned, found) => setSearchStats({ scanned, found }),
        () => abortControllerRef.current?.signal.aborted ?? false,
      );
      setResults(foundResults);

      if (foundResults.length === 0) {
        setStatusMessage("No matches found");
      } else {
        setStatusMessage(`Found ${foundResults.reduce((acc, r) => acc + r.matches.length, 0)} matches`);
        // Auto-select all
        const allIds = new Set<string>();
        foundResults.forEach((res) => {
          res.matches.forEach((m) => {
            allIds.add(`${res.path}:${m.line}:${m.matchIndex}`);
          });
        });
        setSelectedMatches(allIds);
      }
    } catch (e: any) {
      if (e.message !== "Aborted") {
        console.error(e);
        setStatusMessage("Search failed: " + e.message);
      }
    } finally {
      setIsSearching(false);
      abortControllerRef.current = null;
    }
  }, [selectedPath, searchQuery, options]);

  const toggleMatchSelection = useCallback((matchId: string) => {
    setSelectedMatches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  }, []);

  // Replace logic
  const handleReplaceClick = () => {
    if (selectedMatches.size === 0) return;

    const filesToModify = new Set<string>();
    results.forEach((res) => {
      res.matches.forEach((m) => {
        const id = `${res.path}:${m.line}:${m.matchIndex}`;
        if (selectedMatches.has(id)) {
          filesToModify.add(res.path);
        }
      });
    });

    setReplacePreview({
      count: selectedMatches.size,
      files: filesToModify.size,
    });
    setShowReplaceConfirm(true);
  };

  const handleReplace = async () => {
    if (selectedMatches.size === 0) return;

    setShowReplaceConfirm(false);
    setIsSearching(true); // Show progress state
    setStatusMessage("Replacing...");

    const matchesByFile = new Map<string, any[]>();

    results.forEach((res) => {
      res.matches.forEach((m) => {
        const id = `${res.path}:${m.line}:${m.matchIndex}`;
        if (selectedMatches.has(id)) {
          if (!matchesByFile.has(res.path)) {
            matchesByFile.set(res.path, []);
          }
          matchesByFile.get(res.path)?.push({
            line: m.line,
            oldText: m.content.substring(m.matchIndex, m.matchIndex + m.length),
            newText: replaceQuery,
            matchIndex: m.matchIndex,
            length: m.length,
          });
        }
      });
    });

    let successCount = 0;
    let failCount = 0;

    for (const [path, replacements] of matchesByFile.entries()) {
      const success = await replaceInFile(path, replacements);
      if (success) successCount++;
      else failCount++;
    }

    if (successCount > 0) {
      setStatusMessage(
        `✓ Replaced ${selectedMatches.size} occurrence${selectedMatches.size > 1 ? "s" : ""} in ${successCount} file${successCount > 1 ? "s" : ""}.`
      );
    } else {
      setStatusMessage("Replace failed.");
    }
    
    setIsSearching(false);
    
    // Clear to force re-search or reset
    setResults([]);
    setSelectedMatches(new Set());
    setReplacePreview(null);
  };

  const handleSelectAllMatches = useCallback(() => {
      const allIds = new Set<string>();
      results.forEach((res) => {
        res.matches.forEach((m) => {
          allIds.add(`${res.path}:${m.line}:${m.matchIndex}`);
        });
      });
      setSelectedMatches(allIds);
  }, [results]);

  const handleClearSelection = useCallback(() => {
      setSelectedMatches(new Set());
  }, []);

  const handleReplaceAll = useCallback(() => {
      // Use logic similar to select all if nothing is explicitly selected?
      // Or usually "Replace All" implies replacing everything found, regardless of selection.
      // But typically "Replace All" means "Replace everything in the result set".
      // Let's stick to current logic which auto-selects all if needed in `handleReplaceAll` implementation above?
      // Wait, line 220 `handleReplaceAll` logic currently selects all then opens confirm.
      // So this is consistent.
      
      const allIds = new Set<string>();
      results.forEach((res) => {
        res.matches.forEach((m) => {
          allIds.add(`${res.path}:${m.line}:${m.matchIndex}`);
        });
      });
      setSelectedMatches(allIds);
      
      const filesToModify = new Set<string>();
      results.forEach(res => filesToModify.add(res.path));
      
      setReplacePreview({
          count: allIds.size,
          files: filesToModify.size
      });
      setShowReplaceConfirm(true);
  }, [results]);

  const searchProgress = searchStats.scanned > 0
      ? Math.min(95, (searchStats.scanned / (searchStats.scanned + 100)) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in duration-300">
      <PageHeader
        icon={Search}
        title="Find & Replace"
        subtitle="Search and replace text across files"
        info={findReplaceInfo}
        right={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetSelectedPath();
              resetSearchQuery();
              resetReplaceQuery();
              resetOptions();
              setResults([]);
              setSearchStats({ scanned: 0, found: 0 });
              setStatusMessage(null);
              setSelectedMatches(new Set());
            }}
            className="text-xs gap-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        }
      />
      <FindToolbar
        currentPath={selectedPath}
        onPathChange={setSelectedPath}
        onBrowse={handleBrowse}
        recentPaths={recentPaths}
        
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleSearch}
        
        replaceQuery={replaceQuery}
        onReplaceQueryChange={setReplaceQuery}
        
        matchCase={options.matchCase}
        onToggleMatchCase={() => setOptions({...options, matchCase: !options.matchCase})}
        useRegex={options.useRegex}
        onToggleUseRegex={() => setOptions({...options, useRegex: !options.useRegex})}
        wholeWord={options.wholeWord}
        onToggleWholeWord={() => setOptions({...options, wholeWord: !options.wholeWord})}
        
        includePattern={options.includePattern}
        onIncludePatternChange={(v) => setOptions({...options, includePattern: v})}
        excludePattern={options.excludePattern}
        onExcludePatternChange={(v) => setOptions({...options, excludePattern: v})}

        target={options.target}
        onTargetChange={(v) => setOptions({...options, target: v})}
        
        isSearching={isSearching}
      />

      <div className="flex-1 overflow-hidden bg-slate-50/30 dark:bg-slate-900/10 relative">
        <ResultsPreview
            results={results}
            onSelectMatch={(path, matchIdx) => {
                const res = results.find((r) => r.path === path);
                if (res && res.matches[matchIdx]) {
                    const m = res.matches[matchIdx];
                    toggleMatchSelection(`${path}:${m.line}:${m.matchIndex}`);
                }
            }}
            selectedMatches={selectedMatches}
            searchQuery={searchQuery}
            replaceQuery={replaceQuery}
            focusedMatchIndex={focusedMatchIndex}
        />
        
        {/* Replace Confirmation Modal Overlay */}
        {showReplaceConfirm && replacePreview && (
             <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                 <div className="bg-background rounded-xl shadow-2xl border p-6 max-w-sm w-full animate-in zoom-in-95">
                    <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-6 w-6" />
                        <h3 className="text-lg font-semibold text-foreground">Confirm Replace</h3>
                    </div>
                    <div className="space-y-3 mb-6 bg-muted/50 p-3 rounded-lg text-sm">
                         <div className="flex justify-between">
                             <span className="text-muted-foreground">Replace:</span>
                             <span className="font-semibold">{replacePreview.count} matches</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-muted-foreground">In:</span>
                             <span className="font-semibold">{replacePreview.files} files</span>
                         </div>
                         <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                            This operation cannot be undone. Backup files will be created automatically.
                         </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowReplaceConfirm(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReplace}>Yes, Replace</Button>
                    </div>
                 </div>
             </div>
        )}
      </div>

      <FindActions 
        onFindAll={handleSearch}
        onReplaceAll={handleReplaceAll}
        onReplaceSelected={handleReplaceClick}
        onStop={() => abortControllerRef.current?.abort()}
        
        onSelectAll={handleSelectAllMatches}
        onClearSelection={handleClearSelection}
        
        resultCount={results.reduce((acc, r) => acc + r.matches.length, 0)}
        selectedCount={selectedMatches.size}
        
        isSearching={isSearching}
        searchProgress={searchProgress}
        statusMessage={statusMessage}
      />
    </div>
  );
};
