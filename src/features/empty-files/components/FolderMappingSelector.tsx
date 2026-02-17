/**
 * File: src/features/empty-files/components/FolderMappingSelector.tsx
 *
 * Front-end: Searchable dropdown for selecting a destination folder within
 * an existing folder structure. Used by the File Creation page in Map mode.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Search, Folder, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderOption,
  loadFolderTree,
  flattenFolderOptions,
} from "../utils/folderStructureUtils";
import { cn } from "@/lib/utils";

interface FolderMappingSelectorProps {
  /** Root path - folder structure is loaded from here */
  rootPath: string;
  /** Currently selected folder path */
  value: string;
  /** Callback when user selects a folder */
  onChange: (folderPath: string) => void;
  /** Placeholder when no selection */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Compact mode for inline use */
  compact?: boolean;
  /** Optional class name */
  className?: string;
}

export function FolderMappingSelector({
  rootPath,
  value,
  onChange,
  placeholder = "Select destination folder...",
  disabled = false,
  compact = false,
  className,
}: FolderMappingSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [options, setOptions] = useState<FolderOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load folder options when root path changes
  useEffect(() => {
    if (!rootPath?.trim()) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const tree = await loadFolderTree(rootPath, 5);
        const opts = flattenFolderOptions(rootPath, tree);
        if (!cancelled) {
          setOptions(opts);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load folders",
          );
          setOptions([
            {
              value: rootPath,
              label: "Root Folder",
              path: rootPath,
              displayPath: "Root",
            },
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.displayPath.toLowerCase().includes(query) ||
        opt.label.toLowerCase().includes(query),
    );
  }, [options, searchQuery]);

  const selectedOption =
    options.find((o) => o.path === value) ??
    options.find((o) => o.value === value);

  const handleSelect = useCallback(
    (opt: FolderOption) => {
      onChange(opt.path);
      setIsOpen(false);
      setSearchQuery("");
    },
    [onChange],
  );

  return (
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled || !rootPath}
        className={cn(
          "flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 text-left text-sm transition-colors",
          compact ? "h-8" : "h-9",
          disabled && "opacity-50 cursor-not-allowed",
          "hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring",
        )}
      >
        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate text-left">
          {selectedOption
            ? selectedOption.displayPath
            : value
              ? value.split("/").filter(Boolean).pop() || "Selected"
              : placeholder}
        </span>
        {isLoading && !options.length ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-full min-w-[240px] max-h-[280px] flex flex-col rounded-md border bg-popover shadow-lg">
            {/* Search input */}
            <div className="p-2 border-b sticky top-0 bg-popover">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search folders..."
                  className="h-8 pl-8 pr-8 text-xs"
                  autoFocus
                  aria-label="Search folders"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Options list */}
            <div className="overflow-y-auto p-1 max-h-[220px]">
              {error && (
                <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
              )}
              {filteredOptions.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground text-center">
                  {searchQuery ? "No folders match" : "No subfolders found"}
                </p>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.path === value;
                  return (
                    <button
                      key={opt.path}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 text-left text-xs rounded-md transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent text-foreground",
                      )}
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">{opt.displayPath}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Full path preview for selected */}
            {selectedOption && (
              <div className="px-2 py-1.5 border-t text-[10px] text-muted-foreground truncate bg-muted/30">
                {selectedOption.path}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
