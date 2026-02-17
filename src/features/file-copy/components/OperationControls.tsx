/**
 * File: src/features/file-copy/components/OperationControls.tsx
 *
 * Front-end component for the destination and operation controls panel
 * in the Copy/Move tab. Displayed as the header section of the right panel,
 * providing destination selection, advanced options, action buttons,
 * and real-time progress/stats feedback.
 *
 * Layout inspired by the Folder Creation and File Creation preview panel headers.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  FolderOpen,
  Copy,
  ArrowRight,
  X,
  Settings2,
  History,
  BarChart3,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Types for conflict resolution strategies
type ConflictResolution = "overwrite" | "skip" | "rename" | "ask";

interface OperationControlsProps {
  /** Destination directory path */
  destPath: string;
  /** Handler for destination path changes */
  onDestPathChange: (path: string) => void;
  /** Handler for the Browse button to select destination */
  onSelectDest: () => void;

  /** Handler to execute a copy operation */
  onCopy: () => void;
  /** Handler to execute a move operation */
  onMove: () => void;
  /** Handler to cancel the current operation */
  onCancel?: () => void;

  /** Number of files currently selected */
  selectedCount: number;
  /** Total size of selected files in bytes */
  totalSize: number;

  /** Whether an operation is currently in progress */
  isProcessing: boolean;
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current status text describing the operation state */
  status: string;

  /** Selected conflict resolution strategy */
  conflictResolution: ConflictResolution;
  /** Handler for conflict resolution strategy changes */
  onConflictResolutionChange: (val: ConflictResolution) => void;

  /** Whether to preserve the source folder structure in the destination */
  preserveStructure: boolean;
  /** Handler for preserve structure toggle changes */
  onPreserveStructureChange: (val: boolean) => void;

  /** Whether the history overlay panel is visible */
  showHistory: boolean;
  /** Handler to toggle the history overlay panel */
  onToggleHistory: () => void;

  /** Operation statistics shown during/after processing */
  operationStats?: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  } | null;
}

/**
 * Formats a file size in bytes to a human-readable string
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * OperationControls serves as the header section of the right panel in
 * the Copy/Move layout. It displays:
 * - Selection summary (count + total size)
 * - Destination directory selector
 * - Advanced options (conflict resolution, preserve structure)
 * - Copy / Move action buttons
 * - Progress bar during processing
 * - Statistics card with success/fail/skip counts
 * - Animated status messages (success, error, cancelled)
 */
export const OperationControls = ({
  destPath,
  onDestPathChange,
  onSelectDest,
  onCopy,
  onMove,
  onCancel,
  selectedCount,
  totalSize,
  isProcessing,
  progress,
  status,
  conflictResolution,
  onConflictResolutionChange,
  preserveStructure,
  onPreserveStructureChange,
  showHistory,
  onToggleHistory,
  operationStats,
}: OperationControlsProps) => {
  /* Track whether the advanced options collapsible is open */
  const [optionsOpen, setOptionsOpen] = useState(false);

  /* Derive status classification for conditional rendering */
  const isComplete =
    status.toLowerCase().includes("complete") ||
    status.toLowerCase().includes("success");
  const isError =
    status.toLowerCase().includes("error") ||
    status.toLowerCase().includes("fail");
  const isCancelled = status.toLowerCase().includes("cancel");

  return (
    <div className="p-4 border-b space-y-3">
      {/* ── Row 1: Title with selection info + History toggle ── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            Operation Preview
            {selectedCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                {selectedCount} {selectedCount === 1 ? "file" : "files"}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5">
            {selectedCount > 0
              ? `${formatFileSize(totalSize)} ready to copy or move`
              : "Select files from the source panel"}
          </span>
        </div>

        {/* History toggle button */}
        <Button
          variant={showHistory ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleHistory}
          className="shrink-0"
        >
          <History className="h-4 w-4 mr-1.5" />
          History
        </Button>
      </div>

      {/* ── Destination directory section ── */}
      <section className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Destination
        </Label>
        <div className="flex gap-2">
          <Input
            value={destPath}
            onChange={(e) => onDestPathChange(e.target.value)}
            placeholder="Select destination folder..."
            disabled={isProcessing}
            className="bg-background"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={onSelectDest}
            disabled={isProcessing}
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ── Advanced Options (Collapsible) ── */}
      <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Advanced Options
              </span>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {/* Show "Active" indicator when non-default options are set */}
              {(conflictResolution !== "ask" || preserveStructure) && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  Active
                </span>
              )}
              <CollapsibleTrigger>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform text-muted-foreground",
                    optionsOpen && "rotate-90",
                  )}
                />
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <div className="p-4 border-t space-y-4">
              {/* Conflict Resolution dropdown */}
              <div className="space-y-2">
                <Label className="text-xs">Conflict Resolution</Label>
                <Select
                  value={conflictResolution}
                  onValueChange={(v) =>
                    onConflictResolutionChange(v as ConflictResolution)
                  }
                  disabled={isProcessing}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ask">Ask me what to do</SelectItem>
                    <SelectItem value="overwrite">
                      Overwrite existing files
                    </SelectItem>
                    <SelectItem value="skip">Skip existing files</SelectItem>
                    <SelectItem value="rename">Rename (keep both)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preserve Structure toggle */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="preserve-struct"
                  className="text-xs cursor-pointer"
                >
                  Preserve folder structure
                </Label>
                <Switch
                  id="preserve-struct"
                  checked={preserveStructure}
                  onCheckedChange={(c) =>
                    onPreserveStructureChange(c as boolean)
                  }
                  disabled={isProcessing}
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Separator />

      {/* ── Action Buttons ── */}
      <div className="flex items-center gap-2">
        {isProcessing && onCancel ? (
          <Button variant="destructive" onClick={onCancel} className="flex-1">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        ) : (
          <>
            <Button
              onClick={onCopy}
              disabled={!destPath || selectedCount === 0 || isProcessing}
              className="flex-1"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              variant="secondary"
              onClick={onMove}
              disabled={!destPath || selectedCount === 0 || isProcessing}
              className="flex-1"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Move
            </Button>
          </>
        )}
      </div>

      {/* ── Progress Bar (visible during processing) ── */}
      {isProcessing && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* ── Operation Statistics Card (visible during/after processing) ── */}
      {operationStats && operationStats.total > 0 && (
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <BarChart3 className="h-3 w-3" />
              Operation Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{operationStats.total}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Success
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {operationStats.successful}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  Skipped
                </span>
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {operationStats.skipped}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  Failed
                </span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {operationStats.failed}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Status / Completion Messages (Animated) ── */}
      <AnimatePresence mode="wait">
        {!isProcessing && isError && status && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-600 dark:text-red-400 text-xs"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{status}</div>
          </motion.div>
        )}
        {!isProcessing && isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-600 dark:text-green-400 text-xs"
          >
            <CheckCircle className="h-4 w-4 shrink-0" />
            <div className="font-medium">Operation completed successfully!</div>
          </motion.div>
        )}
        {!isProcessing && isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-xs"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div className="font-medium">Operation was cancelled</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing status text (e.g. "Copying file.txt...") */}
      {isProcessing && status && (
        <div className="text-xs text-muted-foreground truncate">{status}</div>
      )}
    </div>
  );
};
