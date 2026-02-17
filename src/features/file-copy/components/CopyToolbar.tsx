import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FolderSearch,
  Bookmark,
  BookmarkCheck,
  Search,
  X,
  Filter,
  Settings2,
  ListFilter,
  Info,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CopyToolbarProps {
  currentPath: string;
  onPathChange: (path: string) => void;
  onBrowseSource: () => void;
  recentPaths: string[];
  favoritePaths: string[];
  onToggleFavorite: (path: string) => void;
  
  searchTerm: string;
  onSearchChange: (term: string) => void;
  
  activeFilters: string[];
  availableExtensions: string[];
  onToggleFilter: (ext: string) => void;
  
  filterMode: "include" | "exclude";
  onToggleFilterMode: () => void;
  
  excludeTemp: boolean;
  onToggleExcludeTemp: (val: boolean) => void;
  
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInvertSelection?: () => void;
  hasSelection: boolean;
  
  isProcessing: boolean;

  onExpandAll: () => void;
  onCollapseAll: () => void;

  /** Number of visible files in the tree (for search result count) */
  visibleFileCount?: number;
}

export const CopyToolbar = ({
  currentPath,
  onPathChange,
  onBrowseSource,
  recentPaths,
  favoritePaths,
  onToggleFavorite,
  searchTerm,
  onSearchChange,
  activeFilters,
  availableExtensions,
  onToggleFilter,
  filterMode,
  onToggleFilterMode,
  excludeTemp,
  onToggleExcludeTemp,
  onSelectAll,
  onClearSelection,
  onInvertSelection,
  hasSelection,
  isProcessing,
  onExpandAll,
  onCollapseAll,
  visibleFileCount
}: CopyToolbarProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 relative z-10">
      {/* Top Bar: Source & Global Actions */}
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-2xl">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <FolderSearch className="h-4 w-4" />
            </div>
            <Input 
              value={currentPath}
              onChange={(e) => onPathChange(e.target.value)}
              placeholder="Source directory path..."
              className="pl-9 pr-20"
              disabled={isProcessing}
            />
             <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
               {currentPath && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onToggleFavorite(currentPath)}
                  title="Bookmark this path"
                >
                  {favoritePaths.includes(currentPath) ? (
                    <BookmarkCheck className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <Bookmark className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
               )}
               <Separator orientation="vertical" className="h-4" />
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={onBrowseSource}
                disabled={isProcessing}
                title="Browse folder"
              >
                 <span className="sr-only">Browse</span>
                 <FolderSearch className="h-4 w-4" />
               </Button>
            </div>
          </div>

          {recentPaths.length > 0 && (
            <Select 
              value={""} 
              onValueChange={onPathChange} 
              disabled={isProcessing}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Recent..." />
              </SelectTrigger>
              <SelectContent>
                {recentPaths.map((path, idx) => (
                  <SelectItem key={idx} value={path} className="truncate max-w-[300px]">
                    <span className="truncate block" title={path}>
                      {path.split(/[/\\]/).pop() || path}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* History button moved to the right panel (OperationControls) */}
      </div>

      <Separator />

      {/* Middle Bar: Search, Selection & Tree Tools */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 gap-3">
        {/* Search Input (flex-1 for full available width) */}
        <div className="relative flex-1 min-w-0 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search files by name..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "h-8 pl-8 text-xs bg-background transition-colors",
              searchTerm
                ? "pr-24 ring-1 ring-primary/30 border-primary/40"
                : "pr-8"
            )}
            disabled={isProcessing}
          />
          {/* Match count badge + clear button when search is active */}
          {searchTerm ? (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {visibleFileCount !== undefined && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {visibleFileCount} {visibleFileCount === 1 ? "match" : "matches"}
                </span>
              )}
              <button
                onClick={() => onSearchChange("")}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : null}
        </div>

        {/* Right Tools: Expand/Collapse, Settings, Selection Actions */}
        <div className="flex items-center gap-2 shrink-0">
           {/* Expand/Collapse All Buttons */}
           <div className="flex items-center bg-muted/50 rounded-md p-0.5 border">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-sm"
                      onClick={onExpandAll}
                      disabled={isProcessing || !currentPath}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Expand All Folders</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Separator orientation="vertical" className="h-4 mx-0.5" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-sm"
                      onClick={onCollapseAll}
                      disabled={isProcessing || !currentPath}
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Collapse All Folders</TooltipContent>
                </Tooltip>
              </TooltipProvider>
           </div>

           <div className="h-4 w-px bg-border/60" />

           {/* View Settings Dropdown */}
           <div className="relative" ref={settingsRef}>
             <Button 
               variant={showSettings ? "secondary" : "ghost"} 
               size="sm" 
               className="h-8 w-8 p-0"
               onClick={() => setShowSettings(!showSettings)}
               title="Settings"
             >
               <Settings2 className="h-4 w-4" />
             </Button>
             
             {showSettings && (
               <div className="absolute right-0 top-full mt-2 w-60 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in zoom-in-95 z-50">
                 <div className="space-y-4">
                   <h4 className="font-medium leading-none">View Settings</h4>
                   <div className="flex items-center justify-between">
                     <Label htmlFor="exclude-temp" className="text-sm">Exclude System/Temp</Label>
                     <Switch 
                       id="exclude-temp"
                       checked={excludeTemp}
                       onCheckedChange={onToggleExcludeTemp}
                     />
                   </div>
                 </div>
               </div>
             )}
           </div>

          <div className="h-4 w-px bg-border/60" />

          {/* Selection Actions */}
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              onClick={onSelectAll}
              disabled={isProcessing || !currentPath}
              title="Select all visible files (Ctrl/Cmd+A)"
            >
              Select All
            </Button>
            {onInvertSelection && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={onInvertSelection}
                disabled={isProcessing || !currentPath}
                title="Invert selection (select unselected, deselect selected)"
              >
                Invert
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={onClearSelection}
              disabled={isProcessing || !hasSelection}
              title="Clear all selections (Ctrl/Cmd+D)"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* File Type Filters Bar (dedicated row for full visibility) */}
      {currentPath && (
        <div className="flex items-center gap-3 px-4 py-2 border-t bg-muted/20">
          {/* Filter Mode Toggle */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                   variant={filterMode === "include" ? "default" : "secondary"}
                   size="sm"
                   className={cn(
                     "h-7 text-[10px] px-3 gap-1.5 transition-all border shrink-0",
                     filterMode === "include" 
                       ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" 
                       : "bg-background hover:bg-muted text-muted-foreground border-border hover:text-foreground"
                   )}
                   onClick={onToggleFilterMode}
                >
                   <ListFilter className="h-3.5 w-3.5"/>
                   <span>{filterMode === "include" ? "Include" : "Exclude"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                <p className="font-semibold mb-1">{filterMode === "include" ? "Include Mode" : "Exclude Mode"}</p>
                <p>{filterMode === "include" 
                  ? "Only files with selected extensions will be shown." 
                  : "Files with selected extensions will be hidden."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-4 w-px bg-border/60" />

          {/* Extension Filter Badges */}
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
            {availableExtensions.length > 0 ? (
               availableExtensions.map(ext => (
                <TooltipProvider key={ext} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={activeFilters.includes(ext)
                          ? (filterMode === "exclude" ? "destructive" : "default")
                          : "outline"}
                        className={cn(
                          "cursor-pointer text-[10px] h-5 px-2 transition-colors shrink-0",
                          activeFilters.includes(ext)
                              ? (filterMode === "exclude" ? "hover:bg-destructive/80" : "hover:bg-primary/80")
                              : "hover:bg-secondary"
                        )}
                        onClick={() => !isProcessing && onToggleFilter(ext)}
                      >
                        {ext === "{no-ext}" ? "No Ext" : `.${ext}`}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {activeFilters.includes(ext)
                        ? filterMode === "exclude"
                          ? `Click to stop hiding .${ext} files`
                          : `Click to stop showing only .${ext} files`
                        : filterMode === "exclude"
                          ? `Click to hide .${ext} files`
                          : `Click to show only .${ext} files`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground italic px-1">
                No extensions found
              </span>
            )}
          </div>

          {/* Active filter count indicator */}
          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => activeFilters.forEach(ext => onToggleFilter(ext))}
              title="Clear all filters"
            >
              <X className="h-3 w-3 mr-1" />
              {activeFilters.length} active
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
