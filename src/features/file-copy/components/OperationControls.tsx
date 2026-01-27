import { Button } from "@/components/ui/button";
import { FolderOpen, Copy, ArrowRight, X, Settings } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ConflictResolution = "overwrite" | "skip" | "rename" | "ask";

interface OperationControlsProps {
  destPath: string;
  onDestPathChange: (path: string) => void;
  onSelectDest: () => void;
  
  onCopy: () => void;
  onMove: () => void;
  onCancel?: () => void;
  
  selectedCount: number;
  totalSize: number;
  
  isProcessing: boolean;
  progress: number;
  status: string;
  
  conflictResolution: ConflictResolution;
  onConflictResolutionChange: (val: ConflictResolution) => void;
  
  preserveStructure: boolean;
  onPreserveStructureChange: (val: boolean) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

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
  onPreserveStructureChange
}: OperationControlsProps) => {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="border-t bg-background/95 backdrop-blur shadow-lg z-10 p-4 space-y-4">
      
      {/* Destination & Main Actions */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Destination Directory
          </Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input 
                value={destPath}
                onChange={(e) => onDestPathChange(e.target.value)}
                placeholder="Select destination..."
                disabled={isProcessing}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={onSelectDest}
                disabled={isProcessing}
                className="absolute right-0 top-0 h-full text-muted-foreground hover:text-foreground"
              >
                 <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <Button
          variant={showOptions ? "secondary" : "outline"}
          size="icon"
          onClick={() => setShowOptions(!showOptions)}
          title="Advanced Options"
          className="mb-0.5"
        >
          <Settings className={cn("h-4 w-4 transition-transform", showOptions && "rotate-45")} />
        </Button>
      </div>

      {/* Advanced Options (Collapsible) */}
      {showOptions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/40 rounded-lg border animate-in slide-in-from-top-2">
          <div className="space-y-2">
            <Label className="text-sm">Conflict Resolution</Label>
            <Select 
              value={conflictResolution} 
              onValueChange={(v) => onConflictResolutionChange(v as ConflictResolution)}
              disabled={isProcessing}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">Ask me what to do</SelectItem>
                <SelectItem value="overwrite">Overwrite existing files</SelectItem>
                <SelectItem value="skip">Skip existing files</SelectItem>
                <SelectItem value="rename">Rename (keep both)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox 
              id="preserve-struct"
              checked={preserveStructure}
              onCheckedChange={(c) => onPreserveStructureChange(c as boolean)}
              disabled={isProcessing}
            />
            <Label htmlFor="preserve-struct" className="cursor-pointer font-normal">
              Preserve folder structure relative to source
            </Label>
          </div>
        </div>
      )}

      <div className="h-px bg-border" />

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-4">
        
        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
           <div className="flex items-center gap-2">
             <div className="px-2 py-0.5 rounded-md bg-muted text-foreground font-mono font-medium text-xs">
                {selectedCount}
             </div>
             <span className="text-muted-foreground">files selected</span>
           </div>
           <div className="flex items-center gap-2">
             <span className="text-muted-foreground">Total size:</span>
             <span className="font-mono font-medium text-foreground">
                {formatFileSize(totalSize)}
             </span>
           </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {isProcessing && onCancel ? (
             <Button 
               variant="destructive" 
               onClick={onCancel}
               className="min-w-[100px]"
             >
               <X className="mr-2 h-4 w-4" />
               Cancel
             </Button>
          ) : (
            <>
              <Button 
                onClick={onCopy}
                disabled={!destPath || selectedCount === 0 || isProcessing}
                className="min-w-[120px]"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button 
                variant="secondary"
                onClick={onMove}
                disabled={!destPath || selectedCount === 0 || isProcessing}
                className="min-w-[120px]"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Move
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress & Status */}
      {(isProcessing || status) && (
        <div className="space-y-1.5 animate-in fade-in">
          <div className="flex justify-between items-center text-xs px-1">
            <span className={cn(
              "font-medium transition-colors",
              status.toLowerCase().includes("error") || status.toLowerCase().includes("fail") ? "text-red-500" :
              status.toLowerCase().includes("complete") || status.toLowerCase().includes("success") ? "text-green-500" :
              "text-muted-foreground"
            )}>
              {status}
            </span>
            {isProcessing && <span className="font-mono">{Math.round(progress)}%</span>}
          </div>
          {isProcessing ? (
            <Progress value={progress} className="h-1.5" />
          ) : (
            <div className="h-1.5" /> /* Spacer to prevent jump */
          )}
        </div>
      )}
    </div>
  );
};
