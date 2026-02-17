/**
 * File path: ./src/features/find-replace/components/FindActions.tsx
 *
 * Front-end: Action bar component for Find and Replace feature.
 * Displays search progress, result statistics, selection controls,
 * and action buttons (Find All, Replace Selected, Replace All, Stop).
 */

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Search, ReplaceAll, RefreshCw, X,
    CheckCircle, AlertCircle, Clock,
    CheckSquare, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────── */
/*                  Props                     */
/* ────────────────────────────────────────── */

interface FindActionsProps {
    /* ── Action callbacks ── */
    onFindAll: () => void;
    onReplaceAll: () => void;
    onReplaceSelected: () => void;
    onStop: () => void;

    /* ── Selection callbacks ── */
    onSelectAll: () => void;
    onClearSelection: () => void;

    /* ── Counts ── */
    resultCount: number;
    selectedCount: number;
    fileCount: number;

    /* ── State ── */
    isSearching: boolean;
    searchProgress: number;
    statusMessage: string | null;
    searchDuration: number | null;
    scannedCount: number;
}

/* ────────────────────────────────────────── */
/*               Component                    */
/* ────────────────────────────────────────── */

export const FindActions = ({
    onFindAll,
    onReplaceAll,
    onReplaceSelected,
    onStop,
    onSelectAll,
    onClearSelection,
    resultCount,
    selectedCount,
    fileCount,
    isSearching,
    searchProgress,
    statusMessage,
    searchDuration,
    scannedCount,
}: FindActionsProps) => {

    /** Format milliseconds into a human-friendly duration string */
    const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className="border-t bg-background/95 backdrop-blur shadow-lg z-10 p-4 space-y-3">
            {/* ── Main Action Bar ── */}
            <div className="flex items-center justify-between gap-4">
                {/* ── Stats / Status Area (left side) ── */}
                <div className="flex items-center gap-4 text-sm flex-1 min-w-0">
                    {isSearching ? (
                        /* Active search indicator with progress bar */
                        <div className="flex items-center gap-3 w-full max-w-md">
                            <div className="flex items-center gap-2 text-muted-foreground whitespace-nowrap">
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Searching...</span>
                                {scannedCount > 0 && (
                                    <span className="text-xs text-muted-foreground/70 tabular-nums">
                                        ({scannedCount} files scanned)
                                    </span>
                                )}
                            </div>
                            <Progress value={searchProgress} className="h-1.5 flex-1" />
                        </div>
                    ) : (
                        /* Post-search stats display */
                        <div className="flex items-center gap-3 flex-wrap">
                            {resultCount > 0 ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Total matches & files */}
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <span className="font-semibold text-foreground tabular-nums">
                                            {resultCount}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {resultCount === 1 ? "result" : "results"}
                                        </span>
                                        <span className="text-muted-foreground/50">in</span>
                                        <span className="font-semibold text-foreground tabular-nums">
                                            {fileCount}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {fileCount === 1 ? "file" : "files"}
                                        </span>
                                    </div>

                                    {/* Search duration */}
                                    {searchDuration != null && (
                                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 bg-muted/40 rounded-full px-2 py-0.5">
                                            <Clock className="h-3 w-3" />
                                            <span className="tabular-nums">
                                                {formatDuration(searchDuration)}
                                            </span>
                                        </span>
                                    )}

                                    <span className="text-muted-foreground/30">|</span>

                                    {/* Selection controls */}
                                    {selectedCount > 0 && (
                                        <>
                                            <div className="flex items-center gap-1.5 text-sm">
                                                <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                                                <span className="font-semibold text-foreground tabular-nums">
                                                    {selectedCount}
                                                </span>
                                                <span className="text-muted-foreground">selected</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={onClearSelection}
                                            >
                                                Clear
                                            </Button>
                                        </>
                                    )}
                                    {selectedCount < resultCount && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-1.5 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
                                            onClick={onSelectAll}
                                        >
                                            <Square className="h-3 w-3 mr-1" />
                                            Select All
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-muted-foreground italic text-sm">
                                    Ready to search
                                </div>
                            )}

                            {/* Persistent status message (success / error / info) */}
                            {statusMessage && !isSearching && (
                                <div
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium animate-in fade-in",
                                        (statusMessage.includes("fail") || statusMessage.includes("Error"))
                                            ? "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                                            : (statusMessage.includes("Success") || statusMessage.includes("Done"))
                                              ? "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
                                              : "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"
                                    )}
                                >
                                    {(statusMessage.includes("fail") || statusMessage.includes("Error")) ? (
                                        <AlertCircle className="h-3 w-3" />
                                    ) : (statusMessage.includes("Success") || statusMessage.includes("Done")) ? (
                                        <CheckCircle className="h-3 w-3" />
                                    ) : null}
                                    {statusMessage}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Action Buttons (right side) ── */}
                <div className="flex items-center gap-2 shrink-0">
                    {isSearching ? (
                        <Button
                            variant="destructive"
                            onClick={onStop}
                            className="min-w-[100px]"
                        >
                            <X className="mr-2 h-4 w-4" />
                            Stop
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="secondary"
                                onClick={onFindAll}
                                className="min-w-[110px]"
                            >
                                <Search className="mr-2 h-4 w-4" />
                                Find All
                            </Button>

                            <div className="h-8 w-px bg-border mx-1" />

                            <Button
                                variant="outline"
                                onClick={onReplaceSelected}
                                disabled={selectedCount === 0}
                                className="min-w-[110px]"
                                title={`Replace ${selectedCount} selected match${selectedCount !== 1 ? "es" : ""}`}
                            >
                                Replace
                                {selectedCount > 0 && (
                                    <span className="ml-1.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full px-1.5 py-0 tabular-nums">
                                        {selectedCount}
                                    </span>
                                )}
                            </Button>
                            <Button
                                onClick={onReplaceAll}
                                disabled={resultCount === 0}
                                className="min-w-[120px]"
                            >
                                <ReplaceAll className="mr-2 h-4 w-4" />
                                Replace All
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
