/**
 * File path: ./src/features/find-replace/components/FindToolbar.tsx
 *
 * Front-end: Toolbar component for Find and Replace feature.
 * Contains the folder path selector, search input with inline options,
 * replace input, search history dropdown, target selector, and advanced
 * file-filter popover.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    FolderSearch,
    Search,
    Replace,
    Settings2,
    Regex,
    CaseSensitive,
    WholeWord,
    FileText,
    File,
    Folder,
    History,
    X,
    Trash2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────── */
/*                  Props                     */
/* ────────────────────────────────────────── */

interface FindToolbarProps {
    /* ── Scope ── */
    currentPath: string;
    onPathChange: (path: string) => void;
    onBrowse: () => void;
    recentPaths: string[];

    /* ── Search ── */
    searchQuery: string;
    onSearchQueryChange: (q: string) => void;
    onSearch: () => void;

    /* ── Replace ── */
    replaceQuery: string;
    onReplaceQueryChange: (q: string) => void;

    /* ── Options ── */
    matchCase: boolean;
    onToggleMatchCase: () => void;
    useRegex: boolean;
    onToggleUseRegex: () => void;
    wholeWord: boolean;
    onToggleWholeWord: () => void;

    includePattern: string;
    onIncludePatternChange: (val: string) => void;
    excludePattern: string;
    onExcludePatternChange: (val: string) => void;

    target: "content" | "filename" | "folder" | "all";
    onTargetChange: (val: "content" | "filename" | "folder" | "all") => void;

    /* ── State ── */
    isSearching: boolean;

    /* ── Search History ── */
    searchHistory: string[];
    onClearSearchHistory: () => void;
}

/* ────────────────────────────────────────── */
/*               Component                    */
/* ────────────────────────────────────────── */

export const FindToolbar = ({
    currentPath,
    onPathChange,
    onBrowse,
    recentPaths,

    searchQuery,
    onSearchQueryChange,
    onSearch,

    replaceQuery,
    onReplaceQueryChange,

    matchCase,
    onToggleMatchCase,
    useRegex,
    onToggleUseRegex,
    wholeWord,
    onToggleWholeWord,

    includePattern,
    onIncludePatternChange,
    excludePattern,
    onExcludePatternChange,

    target,
    onTargetChange,

    isSearching,

    searchHistory,
    onClearSearchHistory,
}: FindToolbarProps) => {
    /** Visibility toggle for the advanced file-filter popover */
    const [showAdvanced, setShowAdvanced] = useState(false);

    /** Visibility toggle for the search history dropdown */
    const [showHistory, setShowHistory] = useState(false);

    /** Ref for the advanced-settings popover (used for click-outside) */
    const settingsRef = useRef<HTMLDivElement>(null);

    /** Ref for the history dropdown (used for click-outside) */
    const historyRef = useRef<HTMLDivElement>(null);

    /** Ref for the search input (used for focusing) */
    const searchInputRef = useRef<HTMLInputElement>(null);

    /* Close popovers when clicking outside */
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                settingsRef.current &&
                !settingsRef.current.contains(event.target as Node)
            ) {
                setShowAdvanced(false);
            }
            if (
                historyRef.current &&
                !historyRef.current.contains(event.target as Node)
            ) {
                setShowHistory(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    /** Select a query from search history and immediately trigger search */
    const handleHistorySelect = useCallback(
        (query: string) => {
            onSearchQueryChange(query);
            setShowHistory(false);
            /* Give React a tick to flush the state update before triggering search */
            setTimeout(() => onSearch(), 0);
        },
        [onSearchQueryChange, onSearch]
    );

    /** Count of active filters for the badge */
    const activeFilterCount = [
        includePattern.trim(),
        excludePattern.trim(),
    ].filter(Boolean).length;

    return (
        <div className="flex flex-col border-b bg-background/95 backdrop-blur z-20 shadow-sm relative">
            {/* ── 1. Path Selection Bar ── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                <div className="relative flex-1 max-w-2xl">
                    <FolderSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={currentPath}
                        onChange={(e) => onPathChange(e.target.value)}
                        placeholder="Folder to search in..."
                        className="pl-9 pr-12"
                        disabled={isSearching}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={onBrowse}
                        disabled={isSearching}
                        title="Browse for folder"
                    >
                        <FolderSearch className="h-4 w-4" />
                    </Button>
                </div>

                {/* Recent folder paths dropdown */}
                {recentPaths.length > 0 && (
                    <Select
                        value=""
                        onValueChange={onPathChange}
                        disabled={isSearching}
                    >
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Recent..." />
                        </SelectTrigger>
                        <SelectContent>
                            {recentPaths.map((p, i) => (
                                <SelectItem key={i} value={p}>
                                    <span
                                        className="truncate max-w-[200px] block"
                                        title={p}
                                    >
                                        {p.split(/[/\\]/).pop() || p}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* ── 2. Main Search & Replace Area ── */}
            <div className="px-4 py-3 space-y-3 bg-muted/20">
                {/* ── Search Row ── */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1" ref={historyRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                            placeholder="Search..."
                            className="pl-9 pr-32"
                            onKeyDown={(e) => e.key === "Enter" && onSearch()}
                            onFocus={() => {
                                /* Show history when focusing an empty search field */
                                if (!searchQuery && searchHistory.length > 0) {
                                    setShowHistory(true);
                                }
                            }}
                        />

                        {/* Inline option toggles */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                            {/* Search history toggle */}
                            {searchHistory.length > 0 && (
                                <Button
                                    variant={showHistory ? "secondary" : "ghost"}
                                    size="icon"
                                    className={cn(
                                        "h-7 w-7",
                                        showHistory && "bg-accent text-accent-foreground"
                                    )}
                                    onClick={() => setShowHistory(!showHistory)}
                                    title="Search History"
                                >
                                    <History className="h-3.5 w-3.5" />
                                </Button>
                            )}

                            <div className="w-px h-4 bg-border mx-0.5" />

                            <Button
                                variant={matchCase ? "secondary" : "ghost"}
                                size="icon"
                                className={cn(
                                    "h-7 w-7",
                                    matchCase && "bg-accent text-accent-foreground"
                                )}
                                onClick={onToggleMatchCase}
                                title="Match Case"
                            >
                                <CaseSensitive className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={wholeWord ? "secondary" : "ghost"}
                                size="icon"
                                className={cn(
                                    "h-7 w-7",
                                    wholeWord && "bg-accent text-accent-foreground"
                                )}
                                onClick={onToggleWholeWord}
                                title="Whole Word"
                            >
                                <WholeWord className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={useRegex ? "secondary" : "ghost"}
                                size="icon"
                                className={cn(
                                    "h-7 w-7",
                                    useRegex && "bg-accent text-accent-foreground"
                                )}
                                onClick={onToggleUseRegex}
                                title="Use Regular Expression"
                            >
                                <Regex className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* ── Search History Dropdown ── */}
                        {showHistory && searchHistory.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border bg-popover text-popover-foreground shadow-xl z-50 animate-in fade-in zoom-in-95 overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Recent Searches
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClearSearchHistory();
                                            setShowHistory(false);
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Clear
                                    </Button>
                                </div>
                                <div className="max-h-48 overflow-y-auto py-1">
                                    {searchHistory.map((query, i) => (
                                        <button
                                            key={`${query}-${i}`}
                                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2 group"
                                            onClick={() => handleHistorySelect(query)}
                                        >
                                            <History className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                            <span className="truncate font-mono text-xs">
                                                {query}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Search Target Selector ── */}
                    <Select
                        value={target}
                        onValueChange={(v: any) => onTargetChange(v)}
                        disabled={isSearching}
                    >
                        <SelectTrigger className="w-[140px] shrink-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="content">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-3.5 w-3.5 opacity-70" />
                                    <span>Content</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="filename">
                                <div className="flex items-center gap-2">
                                    <File className="h-3.5 w-3.5 opacity-70" />
                                    <span>File Name</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="folder">
                                <div className="flex items-center gap-2">
                                    <Folder className="h-3.5 w-3.5 opacity-70" />
                                    <span>Folder Name</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="all">
                                <div className="flex items-center gap-2 font-medium">
                                    <Search className="h-3.5 w-3.5 text-blue-500" />
                                    <span>All</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* ── Replace Row ── */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Replace className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={replaceQuery}
                            onChange={(e) => onReplaceQueryChange(e.target.value)}
                            placeholder="Replace with..."
                            className="pl-9"
                        />
                        {/* Clear button for replace input */}
                        {replaceQuery && (
                            <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                                onClick={() => onReplaceQueryChange("")}
                                title="Clear replace text"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* ── Advanced Filters Popover ── */}
                    <div className="relative" ref={settingsRef}>
                        <Button
                            variant={showAdvanced ? "secondary" : "outline"}
                            className="gap-2"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            <Settings2 className="h-4 w-4" />
                            <span className="sr-only md:not-sr-only">Filters</span>
                            {/* Badge indicating active filter count */}
                            {activeFilterCount > 0 && (
                                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold -mr-1">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>

                        {showAdvanced && (
                            <div className="absolute right-0 top-full mt-2 w-80 p-4 rounded-lg border bg-popover text-popover-foreground shadow-xl z-50 animate-in fade-in zoom-in-95">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm">File Filters</h4>
                                        {activeFilterCount > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                                                onClick={() => {
                                                    onIncludePatternChange("");
                                                    onExcludePatternChange("");
                                                }}
                                            >
                                                Clear Filters
                                            </Button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">
                                            Files to include
                                        </Label>
                                        <Input
                                            value={includePattern}
                                            onChange={(e) =>
                                                onIncludePatternChange(e.target.value)
                                            }
                                            placeholder="e.g. *.ts, src/**"
                                            className="h-8 text-xs"
                                        />
                                        <p className="text-[10px] text-muted-foreground/60">
                                            Comma-separated glob patterns
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">
                                            Files to exclude
                                        </Label>
                                        <Input
                                            value={excludePattern}
                                            onChange={(e) =>
                                                onExcludePatternChange(e.target.value)
                                            }
                                            placeholder="e.g. node_modules, dist"
                                            className="h-8 text-xs"
                                        />
                                        <p className="text-[10px] text-muted-foreground/60">
                                            Comma-separated glob patterns
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
