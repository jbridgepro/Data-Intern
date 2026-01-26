import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Folder
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface FindToolbarProps {
  // Scope
  currentPath: string;
  onPathChange: (path: string) => void;
  onBrowse: () => void;
  recentPaths: string[]; // Mock or passed down

  // Search
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearch: () => void;
  
  // Replace
  replaceQuery: string;
  onReplaceQueryChange: (q: string) => void;

  // Options
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

  target: 'content' | 'filename' | 'folder';
  onTargetChange: (val: 'content' | 'filename' | 'folder') => void;

  isSearching: boolean;
}

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

  isSearching
}: FindToolbarProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close advanced popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowAdvanced(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col border-b bg-background/95 backdrop-blur z-20 shadow-sm relative">
      
      {/* 1. Path Selection Bar */}
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
           >
             <FolderSearch className="h-4 w-4" />
           </Button>
        </div>
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
                   <span className="truncate max-w-[200px] block" title={p}>
                     {p.split(/[/\\]/).pop() || p}
                   </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 2. Main Search & Replace Area */}
      <div className="px-4 py-3 space-y-3 bg-muted/20">
        {/* Search Row */}
        <div className="flex items-center gap-3">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               value={searchQuery}
               onChange={(e) => onSearchQueryChange(e.target.value)}
               placeholder="Search..."
               className="pl-9 pr-24"
               onKeyDown={(e) => e.key === "Enter" && onSearch()}
             />
             
             {/* Inline Options */}
             <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
               <Button
                 variant={matchCase ? "secondary" : "ghost"}
                 size="icon"
                 className={cn("h-7 w-7", matchCase && "bg-accent text-accent-foreground")}
                 onClick={onToggleMatchCase}
                 title="Match Case"
               >
                 <CaseSensitive className="h-4 w-4" />
               </Button>
               <Button
                 variant={wholeWord ? "secondary" : "ghost"}
                 size="icon"
                 className={cn("h-7 w-7", wholeWord && "bg-accent text-accent-foreground")}
                 onClick={onToggleWholeWord}
                 title="Whole Word"
               >
                 <WholeWord className="h-4 w-4" />
               </Button>
               <Button
                 variant={useRegex ? "secondary" : "ghost"}
                 size="icon"
                 className={cn("h-7 w-7", useRegex && "bg-accent text-accent-foreground")}
                 onClick={onToggleUseRegex}
                 title="Use Regular Expression"
               >
                 <Regex className="h-4 w-4" />
               </Button>
             </div>
           </div>

           {/* Search Target Selector */}
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
             </SelectContent>
           </Select>
        </div>

        {/* Replace Row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Replace className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               value={replaceQuery}
               onChange={(e) => onReplaceQueryChange(e.target.value)}
               placeholder="Replace with..."
               className="pl-9"
             />
          </div>
          
          <div className="relative" ref={settingsRef}>
             <Button
               variant={showAdvanced ? "secondary" : "outline"}
               className="gap-2"
               onClick={() => setShowAdvanced(!showAdvanced)}
             >
               <Settings2 className="h-4 w-4" />
               <span className="sr-only md:not-sr-only">Filters</span>
             </Button>

             {showAdvanced && (
               <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-lg border bg-popover text-popover-foreground shadow-xl z-50 animate-in fade-in zoom-in-95">
                 <div className="space-y-4">
                   <h4 className="font-medium text-sm">File Filters</h4>
                   <div className="space-y-2">
                     <Label className="text-xs text-muted-foreground">Files to include</Label>
                     <Input 
                       value={includePattern} 
                       onChange={(e) => onIncludePatternChange(e.target.value)}
                       placeholder="e.g. *.ts, src/**"
                       className="h-8 text-xs"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-xs text-muted-foreground">Files to exclude</Label>
                     <Input 
                       value={excludePattern} 
                       onChange={(e) => onExcludePatternChange(e.target.value)}
                       placeholder="e.g. node_modules, dist"
                       className="h-8 text-xs"
                     />
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
