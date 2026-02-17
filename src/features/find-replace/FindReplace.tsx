/**
 * File path: ./src/features/find-replace/FindReplace.tsx
 *
 * Front-end: Main component for Find and Replace functionality.
 * Orchestrates the toolbar, results preview, action bar, and
 * replace confirmation modal. Uses the global FindReplaceContext
 * for background execution and state persistence.
 */

import { useState, useCallback, useEffect } from "react";
import { FindToolbar } from "./components/FindToolbar";
import { FindActions } from "./components/FindActions";
import { ResultsPreview } from "./components/ResultsPreview";
import { AlertCircle, Search, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { findReplaceInfo } from "@/components/layout/toolInfoContent";
import { Button } from "@/components/ui/button";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useFindReplace } from "./context/FindReplaceContext";

export const FindReplace = () => {
    /* ── Pull everything from the global context ── */
    const {
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
    } = useFindReplace();

    /* ── Local UI state ── */

    /** Controls visibility of the replace-confirmation modal */
    const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

    /** Summary data shown inside the replace-confirmation modal */
    const [replacePreview, setReplacePreview] = useState<{
        count: number;
        files: number;
    } | null>(null);

    /** Index of the keyboard-focused match (for arrow-key navigation) */
    const [focusedMatchIndex, setFocusedMatchIndex] = useState<number | null>(null);

    /** List of recently-used folder paths (persisted in localStorage) */
    const [recentPaths, setRecentPaths] = useState<string[]>(() => {
        const saved = localStorage.getItem("find-replace-recent-paths");
        return saved ? JSON.parse(saved) : [];
    });

    /** Status message for replace operations (success / error) */
    const [replaceStatus, setReplaceStatus] = useState<string | null>(null);

    /* ── Save recent folder paths to localStorage ── */
    useEffect(() => {
        if (selectedPath && !recentPaths.includes(selectedPath)) {
            const updated = [selectedPath, ...recentPaths].slice(0, 10);
            setRecentPaths(updated);
            localStorage.setItem("find-replace-recent-paths", JSON.stringify(updated));
        }
    }, [selectedPath]);

    /* ── Clear replace status after a few seconds ── */
    useEffect(() => {
        if (replaceStatus) {
            const timer = setTimeout(() => setReplaceStatus(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [replaceStatus]);

    /* ── Folder browse dialog ── */
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

    /* ── Replace flow ── */

    /** Open the replace-confirmation modal for selected matches */
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

    /** Execute the replace operation via the Rust backend */
    const handleReplace = async () => {
        if (selectedMatches.size === 0) return;

        setShowReplaceConfirm(false);

        /* Group selected matches by file for the Rust command payload */
        const matchesByFile = new Map<string, any[]>();

        results.forEach((res) => {
            res.matches.forEach((m) => {
                const id = `${res.path}:${m.line}:${m.matchIndex}`;
                if (selectedMatches.has(id)) {
                    if (!matchesByFile.has(res.path)) {
                        matchesByFile.set(res.path, []);
                    }

                    /* Use UTF-16 indices for correct JS string extraction */
                    const indexUtf16 = m.matchIndexUtf16 ?? m.matchIndex;
                    const lengthUtf16 = m.lengthUtf16 ?? m.length;
                    const oldText = m.content.substring(indexUtf16, indexUtf16 + lengthUtf16);

                    matchesByFile.get(res.path)?.push({
                        line: m.line,
                        match_index: m.matchIndex, // Send byte index to Rust
                        old_text: oldText,
                        new_text: replaceQuery,
                    });
                }
            });
        });

        const payload = Array.from(matchesByFile.entries()).map(
            ([path, replacements]) => ({ path, replacements })
        );

        try {
            const successCount = await invoke<number>("replace_in_files", {
                files: payload,
                createBackup: true,
            });

            console.log(`Replaced ${successCount} files.`);
            setReplaceStatus(
                `Done — replaced ${selectedMatches.size} match${selectedMatches.size !== 1 ? "es" : ""} in ${successCount} file${successCount !== 1 ? "s" : ""}`
            );
            clearResults();
        } catch (e) {
            console.error("Replace failed", e);
            setReplaceStatus(`Error: Replace failed — ${e}`);
        }
    };

    /** Shortcut: select all matches then open the confirm modal */
    const handleReplaceAll = useCallback(() => {
        selectAllMatches();

        const allIdsCount = results.reduce((acc, r) => acc + r.matches.length, 0);
        const filesCount = results.length;

        setReplacePreview({
            count: allIdsCount,
            files: filesCount,
        });
        setShowReplaceConfirm(true);
    }, [results, selectAllMatches]);

    /* ── Derived values ── */

    /** Approximate search progress percentage (0-100) */
    const searchProgress =
        searchStats.scanned > 0
            ? Math.min(95, (searchStats.scanned / (searchStats.scanned + 100)) * 100)
            : 0;

    /** Total match count across all result files */
    const totalResultCount = results.reduce((acc, r) => acc + r.matches.length, 0);

    /** Merged status message (prefer replace status when present) */
    const displayStatus = replaceStatus || statusMessage;

    /* ─────────────────────── Render ─────────────────────── */

    return (
        <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in duration-300">
            {/* ── Page Header ── */}
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
                            clearResults();
                            setSelectedPath("");
                            setSearchQuery("");
                            setReplaceQuery("");
                            setReplaceStatus(null);
                        }}
                        className="text-xs gap-2 text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                    </Button>
                }
            />

            {/* ── Toolbar (path, search, replace, options) ── */}
            <FindToolbar
                currentPath={selectedPath}
                onPathChange={setSelectedPath}
                onBrowse={handleBrowse}
                recentPaths={recentPaths}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onSearch={startSearch}
                replaceQuery={replaceQuery}
                onReplaceQueryChange={setReplaceQuery}
                matchCase={options.matchCase}
                onToggleMatchCase={() => setOptions({ ...options, matchCase: !options.matchCase })}
                useRegex={options.useRegex}
                onToggleUseRegex={() => setOptions({ ...options, useRegex: !options.useRegex })}
                wholeWord={options.wholeWord}
                onToggleWholeWord={() => setOptions({ ...options, wholeWord: !options.wholeWord })}
                includePattern={options.includePattern}
                onIncludePatternChange={(v) => setOptions({ ...options, includePattern: v })}
                excludePattern={options.excludePattern}
                onExcludePatternChange={(v) => setOptions({ ...options, excludePattern: v })}
                target={options.target}
                onTargetChange={(v) => setOptions({ ...options, target: v })}
                isSearching={isSearching}
                searchHistory={searchHistory}
                onClearSearchHistory={clearSearchHistory}
            />

            {/* ── Results Area ── */}
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
                    onToggleFileSelection={toggleFileSelection}
                    selectedMatches={selectedMatches}
                    searchQuery={searchQuery}
                    replaceQuery={replaceQuery}
                    focusedMatchIndex={focusedMatchIndex}
                    hasSearched={hasSearched}
                    searchDuration={searchDuration}
                />

                {/* ── Replace Confirmation Modal Overlay ── */}
                {showReplaceConfirm && replacePreview && (
                    <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-background rounded-xl shadow-2xl border p-6 max-w-sm w-full animate-in zoom-in-95">
                            <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                                <AlertCircle className="h-6 w-6" />
                                <h3 className="text-lg font-semibold text-foreground">
                                    Confirm Replace
                                </h3>
                            </div>
                            <div className="space-y-3 mb-6 bg-muted/50 p-4 rounded-lg text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Replace:</span>
                                    <span className="font-semibold tabular-nums">
                                        {replacePreview.count} match{replacePreview.count !== 1 ? "es" : ""}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">In:</span>
                                    <span className="font-semibold tabular-nums">
                                        {replacePreview.files} file{replacePreview.files !== 1 ? "s" : ""}
                                    </span>
                                </div>
                                {replaceQuery && (
                                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                                        <span className="text-muted-foreground">With:</span>
                                        <span className="font-mono text-sm bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded max-w-[200px] truncate">
                                            {replaceQuery}
                                        </span>
                                    </div>
                                )}
                                <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                                    This operation cannot be undone. Backup files will be created
                                    automatically.
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowReplaceConfirm(false)}
                                >
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleReplace}>
                                    Yes, Replace
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom Action Bar ── */}
            <FindActions
                onFindAll={startSearch}
                onReplaceAll={handleReplaceAll}
                onReplaceSelected={handleReplaceClick}
                onStop={stopSearch}
                onSelectAll={selectAllMatches}
                onClearSelection={clearSelection}
                resultCount={totalResultCount}
                selectedCount={selectedMatches.size}
                fileCount={results.length}
                isSearching={isSearching}
                searchProgress={searchProgress}
                statusMessage={displayStatus}
                searchDuration={searchDuration}
                scannedCount={searchStats.scanned}
            />
        </div>
    );
};
