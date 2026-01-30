/**
 * File: src/features/ai-assistant/components/OperationHistoryPanel.tsx
 *
 * Frontend: Operation History Panel for viewing and managing undo/redo operations.
 * Displays recent file operations and allows users to undo/redo changes.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Undo2,
  Redo2,
  History,
  Trash2,
  FileText,
  Folder,
  Move,
  Copy,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Clock,
  FileEdit,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// Note: Using custom dialog implementation instead of AlertDialog
import { cn } from "@/lib/utils";
import { operationHistory } from "../utils/operationHistory";
import type { OperationRecord, OperationType, OperationStatus, UndoResult } from "../types";

/**
 * Props for the OperationHistoryPanel component.
 */
interface OperationHistoryPanelProps {
  onClose?: () => void;
  compact?: boolean;
}

/**
 * Operation History Panel Component
 * Displays recent file operations with undo/redo functionality.
 */
export const OperationHistoryPanel = ({
  onClose,
  compact = false,
}: OperationHistoryPanelProps) => {
  const [history, setHistory] = useState<OperationRecord[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isUndoing, setIsUndoing] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [lastResult, setLastResult] = useState<UndoResult | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Load history and subscribe to changes
  useEffect(() => {
    const loadHistory = async () => {
      await operationHistory.initialize();
      setHistory(operationHistory.getRecentOperations(20));
      const stackInfo = operationHistory.getStackInfo();
      setUndoCount(stackInfo.undoCount);
      setRedoCount(stackInfo.redoCount);
    };

    loadHistory();

    // Subscribe to history changes
    const unsubscribe = operationHistory.addListener((newHistory, undo, redo) => {
      setHistory([...newHistory].reverse().slice(0, 20));
      setUndoCount(undo);
      setRedoCount(redo);
    });

    return () => unsubscribe();
  }, []);

  // Handle undo action
  const handleUndo = useCallback(async () => {
    setIsUndoing(true);
    setLastResult(null);
    try {
      const result = await operationHistory.undo();
      setLastResult(result);
    } catch (error) {
      console.error("Undo failed:", error);
    } finally {
      setIsUndoing(false);
    }
  }, []);

  // Handle redo action
  const handleRedo = useCallback(async () => {
    setIsRedoing(true);
    setLastResult(null);
    try {
      const result = await operationHistory.redo();
      setLastResult(result);
    } catch (error) {
      console.error("Redo failed:", error);
    } finally {
      setIsRedoing(false);
    }
  }, []);

  // Handle clearing history
  const handleClearHistory = useCallback(() => {
    operationHistory.clearHistory();
    setShowClearDialog(false);
  }, []);

  // Toggle expanded state for an operation
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Get icon for operation type
  const getOperationIcon = (type: OperationType) => {
    switch (type) {
      case "create_file":
      case "bulk_create":
        return <FileText className="h-4 w-4 text-green-500" />;
      case "delete_file":
      case "delete_directory":
      case "bulk_delete":
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case "move_file":
      case "move_directory":
      case "bulk_move":
        return <Move className="h-4 w-4 text-blue-500" />;
      case "copy_file":
      case "bulk_copy":
        return <Copy className="h-4 w-4 text-purple-500" />;
      case "rename_file":
        return <FileEdit className="h-4 w-4 text-yellow-500" />;
      case "create_directory":
        return <Folder className="h-4 w-4 text-green-500" />;
      case "write_content":
      case "find_replace":
        return <FileEdit className="h-4 w-4 text-orange-500" />;
      case "organize":
        return <Folder className="h-4 w-4 text-indigo-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: OperationStatus) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "undone":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Undo2 className="h-3 w-3 mr-1" />
            Undone
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Compact view for embedding in other panels
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Operations</span>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleUndo}
                    disabled={undoCount === 0 || isUndoing}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo ({undoCount})</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleRedo}
                    disabled={redoCount === 0 || isRedoing}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo ({redoCount})</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No operations recorded yet
          </p>
        ) : (
          <div className="space-y-1">
            {history.slice(0, 5).map((op) => (
              <div
                key={op.id}
                className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-800/50 text-xs"
              >
                {getOperationIcon(op.type)}
                <span className="flex-1 truncate">{op.description}</span>
                <span className="text-muted-foreground">
                  {formatTimestamp(op.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full panel view
  return (
    <div className="w-80 border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      <Card className="rounded-none border-0 border-b h-full flex flex-col">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Operation History
            </CardTitle>
            <CardDescription>
              {history.length} operations • {undoCount} undoable
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col p-4">
          {/* Undo/Redo Buttons */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleUndo}
              disabled={undoCount === 0 || isUndoing}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Undo ({undoCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleRedo}
              disabled={redoCount === 0 || isRedoing}
            >
              <Redo2 className="h-4 w-4 mr-2" />
              Redo ({redoCount})
            </Button>
          </div>

          {/* Last Result Notification */}
          {lastResult && (
            <div
              className={cn(
                "p-3 rounded-lg mb-4 text-sm",
                lastResult.success
                  ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
              )}
            >
              {lastResult.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Successfully {lastResult.operation?.status === "undone" ? "undone" : "redone"}{" "}
                    {lastResult.restoredFiles.length} file(s)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  <span>{lastResult.error || "Operation failed"}</span>
                </div>
              )}
            </div>
          )}

          <Separator className="mb-4" />

          {/* History List */}
          <ScrollArea className="flex-1">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No operations recorded yet</p>
                <p className="text-xs">File operations will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((op) => (
                  <div
                    key={op.id}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      op.status === "undone"
                        ? "bg-slate-100/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 opacity-60"
                        : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {/* Operation Header */}
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => toggleExpanded(op.id)}
                    >
                      <button className="p-0.5">
                        {expandedItems.has(op.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {getOperationIcon(op.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {op.description}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(op.timestamp)}
                          <span>•</span>
                          <span>{op.filesAffected} file(s)</span>
                        </div>
                      </div>
                      {getStatusBadge(op.status)}
                    </div>

                    {/* Expanded Details */}
                    {expandedItems.has(op.id) && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="text-xs text-muted-foreground">
                          <strong>Tool:</strong> {op.toolName}
                        </div>
                        {op.changes.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium">Changes:</div>
                            {op.changes.slice(0, 5).map((change, idx) => (
                              <div
                                key={idx}
                                className="text-xs text-muted-foreground pl-2 truncate"
                              >
                                • {change.type}: {change.sourcePath.split("/").pop()}
                              </div>
                            ))}
                            {op.changes.length > 5 && (
                              <div className="text-xs text-muted-foreground pl-2">
                                ... and {op.changes.length - 5} more
                              </div>
                            )}
                          </div>
                        )}
                        {!op.canUndo && op.undoBlockedReason && (
                          <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {op.undoBlockedReason}
                          </div>
                        )}
                        {op.hasBackup && (
                          <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Backup available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Clear History Button */}
          {history.length > 0 && (
            <>
              <Separator className="my-4" />
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => setShowClearDialog(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear History
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Clear History Confirmation Dialog */}
      {showClearDialog && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 m-4 max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Clear Operation History?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete all recorded operations. You will not be
              able to undo any previous changes after this.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearHistory}
              >
                Clear History
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact Undo/Redo toolbar component for embedding in headers.
 */
export const UndoRedoToolbar = () => {
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadCounts = async () => {
      await operationHistory.initialize();
      const stackInfo = operationHistory.getStackInfo();
      setUndoCount(stackInfo.undoCount);
      setRedoCount(stackInfo.redoCount);
    };

    loadCounts();

    const unsubscribe = operationHistory.addListener((_, undo, redo) => {
      setUndoCount(undo);
      setRedoCount(redo);
    });

    return () => unsubscribe();
  }, []);

  const handleUndo = async () => {
    setIsLoading(true);
    await operationHistory.undo();
    setIsLoading(false);
  };

  const handleRedo = async () => {
    setIsLoading(true);
    await operationHistory.redo();
    setIsLoading(false);
  };

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleUndo}
              disabled={undoCount === 0 || isLoading}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo ({undoCount} available)</p>
            <p className="text-xs text-muted-foreground">Ctrl+Z</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRedo}
              disabled={redoCount === 0 || isLoading}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo ({redoCount} available)</p>
            <p className="text-xs text-muted-foreground">Ctrl+Shift+Z</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
