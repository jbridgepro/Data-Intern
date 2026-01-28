import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  History, 
  FolderSearch, 
  Bookmark, 
  BookmarkCheck, 
  Search, 
  X, 
  Filter, 
  Settings2,
  ListFilter,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

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
  hasSelection: boolean;
  
  showHistory: boolean;
  onToggleHistory: () => void;
  
  isProcessing: boolean;
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
  hasSelection,
  showHistory,
  onToggleHistory,
  isProcessing
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
    <div className="flex flex-col border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-10">
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

        <div className="flex items-center gap-2">
          <Button
            variant={showHistory ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleHistory}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
        </div>
      </div>

      <Separator />

      {/* Bottom Bar: Filtering & Selection Tools */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 gap-4">
        {/* Search & Badges */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative w-64 shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter files..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-8 pr-8 text-xs bg-background"
              disabled={isProcessing}
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-border/60" />

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mask-grad-right">
            <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            
            {availableExtensions.length > 0 ? (
               availableExtensions.map(ext => (
                <Badge
                  key={ext}
                  variant={activeFilters.includes(ext) 
                    ? (filterMode === "exclude" ? "destructive" : "default") 
                    : "outline"}
                  className={cn(
                    "cursor-pointer text-[10px] h-5 px-2 transition-colors",
                    activeFilters.includes(ext) 
                        ? (filterMode === "exclude" ? "hover:bg-destructive/80" : "hover:bg-primary/80")
                        : "hover:bg-secondary"
                  )}
                  onClick={() => !isProcessing && onToggleFilter(ext)}
                >
                  {ext === "{no-ext}" ? "No Ext" : `.${ext}`}
                </Badge>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground italic px-2">
                No extensions found
              </span>
            )}
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-3 shrink-0">
           {/* View Settings Dropdown */}
           <div className="relative" ref={settingsRef}>
             <Button 
               variant={showSettings ? "secondary" : "ghost"} 
               size="sm" 
               className="h-8 w-8 p-0"
               onClick={() => setShowSettings(!showSettings)}
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
                   
                   <Separator />
                   
                   <div className="space-y-2">
                        <div className="flex items-center justify-between">
                           <Label className="text-sm">Filter Mode</Label>
                            <Button
                               variant="outline"
                               size="sm"
                               className="h-6 text-[10px] px-2 gap-1"
                               onClick={onToggleFilterMode}
                            >
                               <ListFilter className="h-3 w-3"/>
                               {filterMode === "exclude" ? "Exclude Selected" : "Include Selected"}
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                           {filterMode === "exclude" 
                               ? "Selected extensions will be hidden from the list." 
                               : "Only selected extensions will be shown."}
                        </p>
                   </div>
                 </div>
               </div>
             )}
           </div>

          <div className="h-4 w-px bg-border/60" />

          <div className="flex gap-1">
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-xs" 
              onClick={onSelectAll}
              disabled={isProcessing || !currentPath}
            >
              Select All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs"
              onClick={onClearSelection}
              disabled={isProcessing || !hasSelection}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
