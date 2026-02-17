/**
 * File path: ./src/features/find-replace/components/ResultsPreview.tsx
 *
 * Front-end: Results preview component for Find and Replace feature.
 * Displays search results organised by source type (folder / filename / content),
 * with collapsible file groups, file-level selection, match highlighting,
 * replace preview, keyboard navigation, and a summary bar.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
    FileText, Check, ChevronDown, ChevronRight,
    Folder, File, Copy, Search, Clock, Minus,
    ExternalLink
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip, TooltipTrigger, TooltipContent, TooltipProvider
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FileResult, Match } from "../utils/searchLogic";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

/* ────────────────────────────────────────── */
/*                  Props                     */
/* ────────────────────────────────────────── */

interface ResultsPreviewProps {
    /** Grouped search results from the backend */
    results: FileResult[];
    /** Toggle a single match's selection by file path + local index */
    onSelectMatch: (file: string, matchIdx: number) => void;
    /** Bulk-select or deselect all matches whose IDs are in the list */
    onToggleFileSelection: (matchIds: string[], select: boolean) => void;
    /** Set of currently-selected composite match IDs */
    selectedMatches: Set<string>;
    /** Active search query (used for highlighting) */
    searchQuery: string;
    /** Active replace query (used for inline preview) */
    replaceQuery?: string;
    /** Global index of the keyboard-focused match (if any) */
    focusedMatchIndex?: number | null;
    /** Whether at least one search has been executed in this session */
    hasSearched?: boolean;
    /** Duration of the last completed search in milliseconds */
    searchDuration?: number | null;
}

/* ────────────────────────────────────────── */
/*               Component                    */
/* ────────────────────────────────────────── */

export const ResultsPreview = ({
    results,
    onSelectMatch,
    onToggleFileSelection,
    selectedMatches,
    searchQuery,
    replaceQuery,
    focusedMatchIndex,
    hasSearched = false,
    searchDuration,
}: ResultsPreviewProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const focusedElementRef = useRef<HTMLDivElement>(null);

    /** Tracks which file groups are collapsed (keys: "filePath:sectionKey") */
    const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

    /** Tracks a recently-copied path for brief visual feedback */
    const [copiedPath, setCopiedPath] = useState<string | null>(null);

    /* Scroll to the focused match when using keyboard navigation */
    useEffect(() => {
        if (
            focusedMatchIndex !== null &&
            focusedMatchIndex !== undefined &&
            focusedElementRef.current
        ) {
            focusedElementRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [focusedMatchIndex]);

    /* Reset collapsed state when result set changes significantly */
    useEffect(() => {
        setCollapsedFiles(new Set());
    }, [results.length]);

    /* ── Collapse / Expand helpers ── */

    /** Toggle a single file group between collapsed and expanded */
    const toggleCollapse = useCallback((fileKey: string) => {
        setCollapsedFiles((prev) => {
            const next = new Set(prev);
            if (next.has(fileKey)) next.delete(fileKey);
            else next.add(fileKey);
            return next;
        });
    }, []);

    /** Collapse or expand every file group in a section at once */
    const toggleCollapseAll = useCallback(
        (fileKeys: string[], collapse: boolean) => {
            setCollapsedFiles((prev) => {
                const next = new Set(prev);
                fileKeys.forEach((key) => {
                    if (collapse) next.add(key);
                    else next.delete(key);
                });
                return next;
            });
        },
        []
    );

    /* ── Clipboard helper ── */

    /** Copy a file path to the clipboard with brief UI feedback */
    const handleCopyPath = useCallback(async (path: string) => {
        try {
            await navigator.clipboard.writeText(path);
            setCopiedPath(path);
            setTimeout(() => setCopiedPath(null), 2000);
        } catch (e) {
            console.error("Failed to copy path", e);
        }
    }, []);

    /** Open the file's parent directory in the system file manager (e.g. Finder) */
    const handleRevealInFinder = useCallback(async (path: string) => {
        try {
            await revealItemInDir(path);
        } catch (e) {
            console.error("Failed to reveal item in directory:", e);
        }
    }, []);

    /* ── File-level selection helper ── */

    /** Toggle all matches within a single file (select-all or deselect-all) */
    const handleFileToggle = useCallback(
        (fileResult: FileResult) => {
            const matchIds = fileResult.matches.map(
                (m) => `${fileResult.path}:${m.line}:${m.matchIndex}`
            );
            const allSelected = matchIds.every((id) => selectedMatches.has(id));
            onToggleFileSelection(matchIds, !allSelected);
        },
        [selectedMatches, onToggleFileSelection]
    );

    /* ────────────────────────── Empty States ────────────────────────── */

    /* Initial state – no search performed yet */
    if (!hasSearched && results.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <div className="rounded-2xl bg-muted/30 p-6 mb-4">
                    <Search className="h-12 w-12 opacity-30" />
                </div>
                <p className="text-sm font-medium">Start a search</p>
                <p className="text-xs opacity-60 mt-1 max-w-xs text-center">
                    Enter a search query and select a folder to find matches across your files
                </p>
                {/* Quick-reference shortcut hints */}
                <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted-foreground/70">
                    <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                        <kbd className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-mono">Enter</kbd>
                        <span>Search</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                        <kbd className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-mono">Aa</kbd>
                        <span>Match case</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                        <kbd className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-mono">.*</kbd>
                        <span>Regex</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
                        <kbd className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-mono">Ab</kbd>
                        <span>Whole word</span>
                    </div>
                </div>
            </div>
        );
    }

    /* Post-search empty state – search completed but found nothing */
    if (results.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <FileText className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs opacity-60 mt-1">
                    Try adjusting your search terms or options
                </p>
                <div className="mt-4 text-xs text-muted-foreground/70 space-y-1">
                    <p>• Check your search query spelling</p>
                    <p>• Try different search options (case-sensitive, regex, etc.)</p>
                    <p>• Verify the selected folder contains the files you're looking for</p>
                </div>
            </div>
        );
    }

    /* ─────────────────── Organise results by source type ────────────────── */

    let globalMatchIndex = 0;

    const folderResults: FileResult[] = [];
    const fileResults: FileResult[] = [];
    const contentResults: FileResult[] = [];

    /**
     * Infer the source of a match when the backend doesn't provide one.
     * The Rust backend sets line=0 for filename matches and line>=1 for
     * content matches; it currently doesn't emit folder matches.
     */
    const inferSource = (match: Match): Match["source"] => {
        if (match.source) return match.source;
        if (match.line === 0) return "filename";
        return "content";
    };

    results.forEach((res) => {
        const folderMatches = res.matches.filter((m) => inferSource(m) === "folder");
        const filenameMatches = res.matches.filter((m) => inferSource(m) === "filename");
        const docMatches = res.matches.filter((m) => inferSource(m) === "content");

        if (folderMatches.length > 0) folderResults.push({ ...res, matches: folderMatches });
        if (filenameMatches.length > 0) fileResults.push({ ...res, matches: filenameMatches });
        if (docMatches.length > 0) contentResults.push({ ...res, matches: docMatches });
    });

    /* Total match counts per section */
    const folderMatchCount = folderResults.reduce((acc, r) => acc + r.matches.length, 0);
    const fileMatchCount = fileResults.reduce((acc, r) => acc + r.matches.length, 0);
    const contentMatchCount = contentResults.reduce((acc, r) => acc + r.matches.length, 0);
    const totalMatchCount = folderMatchCount + fileMatchCount + contentMatchCount;

    /* ─────────────────── Render helpers ──────────────────── */

    /** Render a single match row with highlight + replace preview */
    const renderMatchRow = (fileResult: FileResult, match: Match, idx: number) => {
        const matchId = `${fileResult.path}:${match.line}:${match.matchIndex}`;
        const isSelected = selectedMatches.has(matchId);
        const currentGlobalIndex = globalMatchIndex++;
        const isFocused = focusedMatchIndex === currentGlobalIndex;

        /* Use UTF-16 indices for correct JS string slicing */
        const charIndex = match.matchIndexUtf16 ?? match.matchIndex;
        const charLength = match.lengthUtf16 ?? match.length;

        const before = match.content.substring(0, charIndex);
        const matched = match.content.substring(charIndex, charIndex + charLength);
        const after = match.content.substring(charIndex + charLength);

        /* Infer match source before using it in lookups */
        const matchSource = inferSource(match);

        /* Resolve the original match index for the callback */
        const originalRes = results.find((r) => r.path === fileResult.path);
        const originalIdx =
            originalRes?.matches.findIndex(
                (m) =>
                    m.line === match.line &&
                    m.matchIndex === match.matchIndex &&
                    inferSource(m) === matchSource
            ) ?? -1;

        return (
            <div
                key={`${match.line}-${match.matchIndex}-${matchSource}-${idx}`}
                ref={isFocused ? focusedElementRef : null}
                className={cn(
                    "flex items-start gap-3 px-3 py-2.5 transition-all cursor-pointer group/match",
                    "hover:bg-accent/50 dark:hover:bg-accent/20",
                    isSelected && "bg-blue-50/60 dark:bg-blue-900/15",
                    isFocused &&
                        "ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50/80 dark:bg-blue-900/25"
                )}
                onClick={() => originalIdx !== -1 && onSelectMatch(fileResult.path, originalIdx)}
            >
                {/* Selection checkbox */}
                <div
                    className={cn(
                        "mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                        isSelected
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "border-slate-300 dark:border-slate-600 group-hover/match:border-blue-400"
                    )}
                >
                    {isSelected && <Check className="h-3 w-3" />}
                </div>

                {/* Line number */}
                <span className="text-[11px] font-mono text-muted-foreground/60 w-8 pt-0.5 shrink-0 text-right tabular-nums">
                    {match.line}
                </span>

                {/* Content with search-term highlighting + replace preview */}
                <div className="flex-1 text-sm font-mono text-foreground/80 break-all whitespace-pre-wrap min-w-0 leading-relaxed">
                    <span className="text-muted-foreground/80">{before}</span>
                    <span className="bg-yellow-200/80 dark:bg-yellow-500/30 text-foreground font-semibold px-0.5 rounded">
                        {matched}
                    </span>
                    {replaceQuery !== undefined && replaceQuery !== "" && (
                        <>
                            <span className="mx-1 text-muted-foreground/40">→</span>
                            <span className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-semibold px-0.5 rounded border border-green-200/60 dark:border-green-800/60">
                                {replaceQuery}
                            </span>
                        </>
                    )}
                    <span className="text-muted-foreground/80">{after}</span>
                </div>
            </div>
        );
    };

    /** Render a collapsible file group with a header and match rows */
    const renderFileGroup = (fileResult: FileResult, sectionKey: string) => {
        const fileKey = `${fileResult.path}:${sectionKey}`;
        const isCollapsed = collapsedFiles.has(fileKey);

        /* Determine file-level selection state for the header checkbox */
        const fileMatchIds = fileResult.matches.map(
            (m) => `${fileResult.path}:${m.line}:${m.matchIndex}`
        );
        const selectedInFile = fileMatchIds.filter((id) => selectedMatches.has(id)).length;
        const allSelected = selectedInFile === fileMatchIds.length;
        const someSelected = selectedInFile > 0 && !allSelected;

        return (
            <div
                key={fileKey}
                className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow group/file"
            >
                {/* ── File Header ── */}
                <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center gap-2">
                    {/* Collapse / expand toggle */}
                    <button
                        onClick={() => toggleCollapse(fileKey)}
                        className="p-0.5 rounded hover:bg-muted/60 transition-colors shrink-0"
                        aria-label={isCollapsed ? "Expand" : "Collapse"}
                    >
                        {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                    </button>

                    {/* File-level selection checkbox */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleFileToggle(fileResult);
                        }}
                        className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                            allSelected
                                ? "bg-blue-500 border-blue-500 text-white"
                                : someSelected
                                  ? "bg-blue-200 border-blue-400 dark:bg-blue-800 dark:border-blue-600"
                                  : "border-muted-foreground/30 hover:border-blue-400"
                        )}
                        aria-label="Toggle file selection"
                    >
                        {allSelected && <Check className="h-3 w-3" />}
                        {someSelected && <Minus className="h-2 w-2 text-blue-600 dark:text-blue-300" />}
                    </button>

                    {/* File path (clicking also toggles collapse) */}
                    <span
                        className="text-xs font-mono text-muted-foreground truncate flex-1 cursor-pointer"
                        title={fileResult.path}
                        onClick={() => toggleCollapse(fileKey)}
                    >
                        {fileResult.path}
                    </span>

                    {/* Action buttons (visible on hover) */}
                    <TooltipProvider delayDuration={200}>
                        {/* Copy path */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyPath(fileResult.path);
                                    }}
                                    className="p-1 rounded hover:bg-muted/60 transition-colors opacity-0 group-hover/file:opacity-100 shrink-0"
                                    aria-label="Copy path"
                                >
                                    {copiedPath === fileResult.path ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                        <Copy className="h-3 w-3 text-muted-foreground" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Copy path</TooltipContent>
                        </Tooltip>

                        {/* Open file location in system file manager */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRevealInFinder(fileResult.path);
                                    }}
                                    className="p-1 rounded hover:bg-muted/60 transition-colors opacity-0 group-hover/file:opacity-100 shrink-0"
                                    aria-label="Open file location"
                                >
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Open file location</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Match count badge */}
                    <Badge
                        variant="secondary"
                        className="text-[10px] px-2 py-0 h-5 shrink-0 tabular-nums"
                    >
                        {fileResult.matches.length}{" "}
                        {fileResult.matches.length === 1 ? "match" : "matches"}
                        {selectedInFile > 0 && (
                            <span className="ml-1 text-blue-500 dark:text-blue-400">
                                ({selectedInFile})
                            </span>
                        )}
                    </Badge>
                </div>

                {/* ── Match Rows (hidden when collapsed) ── */}
                {!isCollapsed && (
                    <div className="divide-y divide-border/30">
                        {fileResult.matches.map((match, idx) =>
                            renderMatchRow(fileResult, match, idx)
                        )}
                    </div>
                )}
            </div>
        );
    };

    /** Render a full section (Folder / File Name / Content) */
    const renderSection = (
        title: string,
        items: FileResult[],
        totalMatches: number,
        icon: React.ReactNode,
        sectionKey: string
    ) => {
        if (items.length === 0) return null;

        const sectionFileKeys = items.map((r) => `${r.path}:${sectionKey}`);
        const allCollapsed = sectionFileKeys.every((k) => collapsedFiles.has(k));

        return (
            <div className="space-y-2 mb-6">
                {/* Section header – sticky for scroll context */}
                <div className="flex items-center justify-between px-1 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 py-1.5 rounded-lg">
                    <div className="flex items-center gap-2">
                        {icon}
                        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
                        <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 font-normal tabular-nums"
                        >
                            {items.length} {items.length === 1 ? "file" : "files"}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5 tabular-nums"
                        >
                            {totalMatches} {totalMatches === 1 ? "match" : "matches"}
                        </Badge>
                    </div>

                    {/* Collapse / Expand all in this section */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => toggleCollapseAll(sectionFileKeys, !allCollapsed)}
                    >
                        {allCollapsed ? "Expand All" : "Collapse All"}
                    </Button>
                </div>

                {/* File groups */}
                <div className="space-y-2">
                    {items.map((fileResult) => renderFileGroup(fileResult, sectionKey))}
                </div>
            </div>
        );
    };

    /* ─────────────────────── Main Render ─────────────────────── */

    return (
        <div className="h-full flex-1 overflow-hidden" ref={scrollRef}>
            <ScrollArea className="h-full p-4">
                {/* Summary bar at the top of results */}
                <div className="flex items-center gap-3 mb-4 px-3 py-2.5 bg-muted/20 rounded-lg text-xs text-muted-foreground border border-border/30">
                    <div className="flex items-center gap-1.5">
                        <Search className="h-3 w-3 shrink-0" />
                        <span className="font-semibold text-foreground tabular-nums">
                            {totalMatchCount}
                        </span>
                        <span>matches in</span>
                        <span className="font-semibold text-foreground tabular-nums">
                            {results.length}
                        </span>
                        <span>files</span>
                    </div>

                    {/* Per-source breakdown pills */}
                    <div className="flex items-center gap-1.5 ml-2">
                        {folderMatchCount > 0 && (
                            <span className="inline-flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full px-2 py-0.5 text-[10px] font-medium">
                                <Folder className="h-2.5 w-2.5" />
                                {folderMatchCount}
                            </span>
                        )}
                        {fileMatchCount > 0 && (
                            <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full px-2 py-0.5 text-[10px] font-medium">
                                <File className="h-2.5 w-2.5" />
                                {fileMatchCount}
                            </span>
                        )}
                        {contentMatchCount > 0 && (
                            <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 text-[10px] font-medium">
                                <FileText className="h-2.5 w-2.5" />
                                {contentMatchCount}
                            </span>
                        )}
                    </div>

                    {/* Search duration (shown when available) */}
                    {searchDuration != null && (
                        <div className="flex items-center gap-1 ml-auto">
                            <Clock className="h-3 w-3" />
                            <span className="tabular-nums">
                                {searchDuration < 1000
                                    ? `${searchDuration}ms`
                                    : `${(searchDuration / 1000).toFixed(1)}s`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Result sections */}
                {renderSection(
                    "Folder Matches",
                    folderResults,
                    folderMatchCount,
                    <Folder className="h-4 w-4 text-orange-500" />,
                    "folder"
                )}
                {renderSection(
                    "File Name Matches",
                    fileResults,
                    fileMatchCount,
                    <File className="h-4 w-4 text-blue-500" />,
                    "filename"
                )}
                {renderSection(
                    "Content Matches",
                    contentResults,
                    contentMatchCount,
                    <FileText className="h-4 w-4 text-green-500" />,
                    "content"
                )}
            </ScrollArea>
        </div>
    );
};
