import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, ReplaceAll, RefreshCw, X, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FindActionsProps {
  onFindAll: () => void;
  onReplaceAll: () => void;
  onReplaceSelected: () => void;
  onStop: () => void;
  
  onSelectAll: () => void;
  onClearSelection: () => void;
  
  resultCount: number;
  selectedCount: number;
  
  isSearching: boolean;
  searchProgress: number; // 0-100
  statusMessage: string | null;
}

export const FindActions = ({
  onFindAll,
  onReplaceAll,
  onReplaceSelected,
  onStop,
  onSelectAll,
  onClearSelection,
  resultCount,
  selectedCount,
  isSearching,
  searchProgress,
  statusMessage
}: FindActionsProps) => {

  return (
    <div className="border-t bg-background/95 backdrop-blur shadow-lg z-10 p-4 space-y-4">
      
      {/* Action Bar */}
      <div className="flex items-center justify-between gap-4">
        
        {/* Stats / Status Area */}
        <div className="flex items-center gap-4 text-sm flex-1 min-w-0">
           {isSearching ? (
             <div className="flex items-center gap-3 w-full max-w-sm">
                <div className="flex items-center gap-2 text-muted-foreground whitespace-nowrap">
                   <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                   Searching...
                </div>
                <Progress value={searchProgress} className="h-1.5 flex-1" />
             </div>
           ) : (
             <div className="flex items-center gap-4">
               {resultCount > 0 ? (
                 <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{resultCount}</span>
                    <span className="text-muted-foreground">results found</span>
                    {selectedCount > 0 && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="font-semibold text-foreground">{selectedCount}</span>
                        <span className="text-muted-foreground">selected</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground ml-2"
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
                            Select All
                        </Button>
                    )}
                 </div>
               ) : (
                 <div className="text-muted-foreground italic">Ready to search</div>
               )}
               
               {/* Persistent Status Message (Success/Error) */}
               {statusMessage && !isSearching && (
                 <div className={cn(
                   "flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium animate-in fade-in",
                   (statusMessage.includes("fail") || statusMessage.includes("✗")) ? "text-red-600 bg-red-50 dark:bg-red-900/20" : 
                   (statusMessage.includes("Success") || statusMessage.includes("✓")) ? "text-green-600 bg-green-50 dark:bg-green-900/20" :
                   "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                 )}>
                    {(statusMessage.includes("fail") || statusMessage.includes("✗")) ? <AlertCircle className="h-3 w-3" /> :
                     (statusMessage.includes("Success") || statusMessage.includes("✓")) ? <CheckCircle className="h-3 w-3" /> : null}
                    {statusMessage}
                 </div>
               )}
             </div>
           )}
        </div>

        {/* Buttons */}
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
                title="Replace selected matches"
              >
                Replace
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
