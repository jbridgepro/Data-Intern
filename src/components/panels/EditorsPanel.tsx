import { FileCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useEditor } from "@/contexts/EditorContext";

interface EditorsPanelProps {
  isVisible: boolean;
  onClose?: () => void;
}

export const EditorsPanel = ({ isVisible, onClose }: EditorsPanelProps) => {
  const { openFiles, activeFileId, activateFile, closeFile } = useEditor();

  if (!isVisible) return null;

  return (
    <div className="h-full flex flex-col border-l border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold">Editors</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {openFiles.length === 0 ? (
             <div className="p-4 text-sm text-slate-500 text-center">No files open</div>
          ) : (
            openFiles.map((tab) => (
            <button
              key={tab.id}
              onClick={() => activateFile(tab.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                tab.id === activeFileId
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300",
              )}
            >
              <FileCode className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">{tab.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-slate-300/50 dark:hover:bg-slate-700/50"
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </button>
          )))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 p-2 border-t border-slate-200/50 dark:border-slate-800/50 text-xs text-slate-500 dark:text-slate-400 text-center">
        {openFiles.length} {openFiles.length === 1 ? "editor" : "editors"} open
      </div>
    </div>
  );
};
