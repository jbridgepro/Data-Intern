/**
 * File: src/features/ai-assistant/components/ContextualToolWidget.tsx
 *
 * Contextual Tool Widget - A premium, interactive UI element that appears in chat
 * to preview and refine tool operations before navigating to the full tool page.
 */

import { useState } from "react";
import {
  FolderPlus,
  FilePlus,
  Copy,
  ChevronRight,
  Edit2,
  Check,
  X,
  Sparkles,
  ArrowRight,
  FolderTree,
  FileType,
  Replace,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { ToolWidgetData } from "../types";

interface ContextualToolWidgetProps {
  widgetData: ToolWidgetData;
  onUpdate?: (updates: Partial<ToolWidgetData>) => void;
  onNavigate?: (widgetData: ToolWidgetData) => void;
  onConfirm?: (widgetData: ToolWidgetData) => void;
  onDismiss?: () => void;
  isEditable?: boolean;
}

const TOOL_ICONS: Record<string, any> = {
  folder_creation_tab: FolderPlus,
  file_creation_tab: FilePlus,
  file_copy_tab: Copy,
  find_replace_tab: Replace,
  write_file_content: FilePlus,
};

const TOOL_COLORS: Record<string, string> = {
  folder_creation_tab: "text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  file_creation_tab: "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  file_copy_tab: "text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
  find_replace_tab: "text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
  write_file_content: "text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  default: "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
};

const TOOL_LABELS: Record<string, string> = {
  folder_creation_tab: "New Folder Structure",
  file_creation_tab: "Create New Files",
  file_copy_tab: "Copy & Move Files",
  find_replace_tab: "Find & Replace",
  write_file_content: "Create Document",
};

export const ContextualToolWidget = ({
  widgetData,
  onUpdate: _onUpdate, // Kept for future use, prefixed to suppress lint
  onNavigate,
  onConfirm,
  onDismiss,
  isEditable = true,
}: ContextualToolWidgetProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const Icon = TOOL_ICONS[widgetData.toolName] || Sparkles;
  const toolLabel = TOOL_LABELS[widgetData.toolName] || widgetData.toolName.replace(/_/g, ' ');
  const colorClass = TOOL_COLORS[widgetData.toolName] || TOOL_COLORS.default;

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNavigate) {
      onNavigate(widgetData);
    }
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onConfirm) {
      onConfirm(widgetData);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDismiss) {
      onDismiss();
    }
  };

  // Render rich preview based on tool type
  const renderRichPreview = () => {
    switch (widgetData.toolName) {
      case "folder_creation_tab":
        const folderNames = widgetData.params?.folderNames || [];
        const subfolders = widgetData.params?.subfolders || [];
        const rootPath = widgetData.params?.rootPath || "";
        
        return (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800">
               <FolderTree className="h-3.5 w-3.5 opacity-70" />
               <span className="font-mono">{rootPath ? `/${rootPath.split("/").filter(Boolean).pop()}/` : "./"}</span>
            </div>
            
            <div className="space-y-1">
               <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-0.5">Folders to Create</div>
               <div className="flex flex-wrap gap-1.5">
                {folderNames.map((name: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/20 pl-1.5">
                    <FolderPlus className="h-3 w-3 mr-1.5 opacity-60" />
                    {name}
                  </Badge>
                ))}
              </div>
            </div>

            {subfolders.length > 0 && (
              <div className="space-y-1">
                 <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-0.5">Subfolders</div>
                 <div className="flex flex-wrap gap-1.5">
                  {subfolders.slice(0, 5).map((sub: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs text-muted-foreground font-normal">
                      {sub}
                    </Badge>
                  ))}
                  {subfolders.length > 5 && (
                    <span className="text-xs text-muted-foreground self-center px-1">+{subfolders.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "file_creation_tab":
        const count = widgetData.params?.count || 0;
        const extensions = widgetData.params?.extensions || [];
        
        return (
          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded-md border border-blue-100 dark:border-blue-900/30 text-center min-w-[60px]">
                 <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{count}</div>
                 <div className="text-[10px] uppercase font-bold text-blue-400 dark:text-blue-500">Files</div>
              </div>
              
              <div className="flex-1 space-y-1.5">
                 <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Types</div>
                 <div className="flex flex-wrap gap-1.5">
                    {extensions.map((ext: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs font-mono bg-slate-50 dark:bg-slate-900/40">
                         <FileType className="h-3 w-3 mr-1.5 opacity-50" />
                         .{ext}
                      </Badge>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        );

      case "file_copy_tab":
        const sourcePath = widgetData.params?.sourcePath || "";
        const destPath = widgetData.params?.destinationPath || "";
        
        return (
          <div className="space-y-2 pt-1">
             <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800 text-xs break-all">
                  <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-0.5">Source</div>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {sourcePath ? sourcePath.split("/").pop() : "Source"}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate opacity-60 mt-0.5">{sourcePath}</div>
                </div>
                
                <div className="flex flex-col items-center justify-center text-purple-400 dark:text-purple-500">
                   <ArrowRight className="h-4 w-4" />
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/10 p-2 rounded border border-purple-100 dark:border-purple-900/30 text-xs break-all">
                  <div className="text-[10px] uppercase text-purple-600/70 dark:text-purple-400/70 font-semibold mb-0.5">Destination</div>
                  <div className="font-mono text-purple-900 dark:text-purple-100">
                    {destPath ? destPath.split("/").pop() : "Dest"}
                  </div>
                  <div className="text-[9px] text-purple-700/60 dark:text-purple-300/60 truncate mt-0.5">{destPath}</div>
                </div>
             </div>
          </div>
        );

      case "find_replace_tab":
        const searchQuery = widgetData.params?.searchQuery || "";
        const replaceQuery = widgetData.params?.replaceQuery || "";
        
        return (
          <div className="space-y-2 pt-1">
             <div className="grid grid-cols-1 gap-1.5">
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded p-2 text-xs font-mono relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-1 bg-red-100 dark:bg-red-900/40 text-[9px] font-bold text-red-600 dark:text-red-400 rounded-bl">FIND</div>
                   <code className="text-red-800 dark:text-red-200 block whitespace-pre-wrap">{searchQuery || "(empty)"}</code>
                </div>
                
                <div className="flex justify-center -my-2 z-10">
                   <div className="bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-white dark:border-slate-700 shadow-sm">
                      <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
                   </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded p-2 text-xs font-mono relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-1 bg-green-100 dark:bg-green-900/40 text-[9px] font-bold text-green-600 dark:text-green-400 rounded-bl">REPLACE</div>
                   <code className="text-green-800 dark:text-green-200 block whitespace-pre-wrap">{replaceQuery || "(empty)"}</code>
                </div>
             </div>
          </div>
        );

      case "write_file_content":
        const filePath = widgetData.params?.path || "";
        const content = widgetData.params?.content || "";
        const fileName = filePath ? filePath.split("/").pop() : "New Document";
        
        return (
          <div className="space-y-2 pt-1">
            <div className="bg-green-50 dark:bg-green-900/10 p-2 rounded border border-green-100 dark:border-green-900/30">
              <div className="text-[10px] uppercase tracking-wider text-green-600/70 dark:text-green-400/70 font-semibold mb-1">File Name</div>
              <div className="text-xs font-mono text-green-900 dark:text-green-100 break-all flex items-center gap-1.5">
                <FileType className="h-3 w-3 opacity-50" />
                {fileName}
              </div>
            </div>
            {content && (
              <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Content Preview</div>
                <div className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                  {content.length > 100 ? content.substring(0, 100) + "..." : content || "(empty)"}
                </div>
              </div>
            )}
            {filePath && (
              <div className="text-[10px] text-muted-foreground truncate">
                {filePath}
              </div>
            )}
          </div>
        );

      default:
        // Generic Parameter View
        const params = widgetData.params || {};
        const paramKeys = Object.keys(params);
        
        return (
          <div className="space-y-2 pt-1">
             {paramKeys.slice(0, 3).map(key => (
               <div key={key} className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">{key}</span>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-800 text-xs font-mono break-all text-slate-700 dark:text-slate-300">
                     {typeof params[key] === 'object' ? JSON.stringify(params[key]) : String(params[key])}
                  </div>
               </div>
             ))}
             {paramKeys.length > 3 && (
               <div className="text-xs text-muted-foreground italic pl-1">
                 +{paramKeys.length - 3} more parameters...
               </div>
             )}
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.3, type: "spring", bounce: 0.2 }}
      className="my-3 group"
    >
      <Card
        className={cn(
          "overflow-hidden border transition-all duration-300",
          !isExpanded ? "hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600" : "shadow-lg scale-[1.01]",
          widgetData.confirmed ? "border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-900/5" : "bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm"
        )}
      >
        {/* Header Section */}
        <div 
           className="p-3 cursor-pointer"
           onClick={() => !isEditing && setIsExpanded(!isExpanded)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn("p-2 rounded-lg shadow-sm flex-shrink-0 transition-colors duration-300", colorClass)}>
                <Icon className="h-4 w-4" />
              </div>
              
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-foreground">{toolLabel}</h4>
                  {widgetData.confidence !== undefined && (
                    <div className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                      widgetData.confidence > 0.8 
                        ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                        : "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                    )}>
                      {Math.round(widgetData.confidence * 100)}% Match
                    </div>
                  )}
                  {widgetData.confirmed && (
                     <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 gap-1 pl-1">
                        <Check className="h-3 w-3" />
                        Confirmed
                     </Badge>
                  )}
                </div>
                
                {/* Collapsed Description */}
                {!isExpanded && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                     {widgetData.description || "Click to view details and options"}
                  </p>
                )}
              </div>
            </div>

            {/* Top Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
               {!isExpanded && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
                     <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
               )}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-900/20"
            >
              <div className="p-3 pt-2 space-y-3">
                 <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {widgetData.description || "Review the parameters below before executing the tool."}
                 </div>
                 
                 {/* Rich Preview Area */}
                 <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 p-2.5 shadow-sm">
                    {renderRichPreview()}
                 </div>

                 {/* Action Bar */}
                 <div className="flex items-center justify-between pt-1 gap-2">
                    <div className="flex items-center gap-1">
                       {onDismiss && (
                          <Button
                             variant="ghost"
                             size="sm"
                             onClick={handleDismiss}
                             className="text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 h-8"
                          >
                             <X className="h-3.5 w-3.5 mr-1.5" />
                             Dismiss
                          </Button>
                       )}
                       {isEditable && !widgetData.confirmed && (
                          <Button
                             variant="ghost"
                             size="sm"
                             onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(!isEditing);
                             }}
                             className="text-xs text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 h-8"
                          >
                             <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                             Edit Parameters
                          </Button>
                       )}
                    </div>

                    <div className="flex items-center gap-2">
                       {onNavigate && (
                          <Button
                             variant="outline"
                             size="sm"
                             onClick={handleNavigate}
                             className="text-xs h-8"
                          >
                             <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                             Full Tool
                          </Button>
                       )}
                       {onConfirm && !widgetData.confirmed && (
                          <Button
                             variant="default"
                             size="sm"
                             onClick={handleConfirm}
                             className="text-xs h-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm"
                          >
                             <Check className="h-3.5 w-3.5 mr-1.5" />
                             Run Tool
                          </Button>
                       )}
                    </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};
