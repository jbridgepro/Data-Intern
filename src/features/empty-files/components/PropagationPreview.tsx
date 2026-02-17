/**
 * File: src/features/empty-files/components/PropagationPreview.tsx
 *
 * Front-end: Propagation preview with per-target exclude checkboxes.
 * Shows all folders where files will be created and allows user to
 * remove specific targets before execution.
 */

import { useState, useEffect, useCallback } from "react";
import { Folder, FileText, Loader2, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MappedFileEntry } from "./MappedFileEntryForm";
import {
  expandPropagationTargets,
  type DestinationMode,
  type PropagationTarget,
} from "../utils/propagationUtils";
import { cn } from "@/lib/utils";

interface PropagationPreviewProps {
  rootPath: string;
  entries: MappedFileEntry[];
  destinationMode: DestinationMode;
  /** Keys "entryId::folderPath" that user has excluded */
  excludedKeys: Set<string>;
  onExcludedKeysChange: (keys: Set<string>) => void;
  className?: string;
}

interface ExpandedEntry {
  entry: MappedFileEntry;
  targets: PropagationTarget[];
  patternDescription?: string;
}

export function PropagationPreview({
  rootPath,
  entries,
  destinationMode,
  excludedKeys,
  onExcludedKeysChange,
  className,
}: PropagationPreviewProps) {
  const [expanded, setExpanded] = useState<ExpandedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadExpansion = useCallback(async () => {
    if (!rootPath || entries.length === 0) {
      setExpanded([]);
      return;
    }
    setIsLoading(true);
    try {
      const results = await Promise.all(
        entries.map(async (entry) => {
          const prop = await expandPropagationTargets(
            rootPath,
            entry.destinationFolder,
            destinationMode,
          );
          return {
            entry,
            targets: prop.targets,
            patternDescription: prop.patternDescription,
          };
        }),
      );
      setExpanded(results);
    } finally {
      setIsLoading(false);
    }
  }, [rootPath, entries, destinationMode]);

  useEffect(() => {
    loadExpansion();
  }, [loadExpansion]);

  const toggleExcluded = (entryId: string, folderPath: string) => {
    const key = `${entryId}::${folderPath}`;
    const next = new Set(excludedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onExcludedKeysChange(next);
  };

  const totalTargets = expanded.reduce((sum, e) => sum + e.targets.length, 0);
  const excludedCount = expanded.reduce((sum, e) => {
    return (
      sum +
      e.targets.filter((t) =>
        excludedKeys.has(`${e.entry.id}::${t.folderPath}`),
      ).length
    );
  }, 0);
  const includedCount = totalTargets - excludedCount;

  if (entries.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-muted-foreground text-sm",
          className,
        )}
      >
        <FileText className="h-10 w-10 opacity-30 mb-2" />
        <p>Add files to see propagation preview</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p className="text-sm">Detecting matching folders...</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Propagation Preview
        </Label>
        <span className="text-xs text-muted-foreground">
          {includedCount} target(s) • Uncheck to exclude
        </span>
      </div>

      <ScrollArea className="h-[280px] rounded-lg border bg-card/50">
        <div className="p-3 space-y-4">
          {expanded.map(({ entry, targets, patternDescription }) => {
            const fullFileName = `${entry.fileName}.${entry.extension}`;
            return (
              <div key={entry.id} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-mono">
                  <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span>{fullFileName}</span>
                  {patternDescription && (
                    <span className="text-[10px] text-muted-foreground font-sans">
                      {patternDescription}
                    </span>
                  )}
                </div>
                <div className="ml-5 space-y-1">
                  {targets.map((t) => {
                    const key = `${entry.id}::${t.folderPath}`;
                    const isExcluded = excludedKeys.has(key);
                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex items-center gap-2 py-1.5 px-2 rounded text-xs transition-colors",
                          isExcluded && "opacity-50",
                        )}
                      >
                        <Checkbox
                          id={key}
                          checked={!isExcluded}
                          onCheckedChange={() =>
                            toggleExcluded(entry.id, t.folderPath)
                          }
                          aria-label={`Include ${fullFileName} in ${t.displayPath}`}
                        />
                        <label
                          htmlFor={key}
                          className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                        >
                          <Folder className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="truncate" title={t.folderPath}>
                            {t.displayPath}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
