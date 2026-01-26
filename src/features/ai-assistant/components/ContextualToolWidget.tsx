/**
 * File: src/features/ai-assistant/components/ContextualToolWidget.tsx
 * 
 * Contextual Tool Widget - A lightweight, compact UI element that appears in chat
 * to preview and refine tool operations before navigating to the full tool page.
 */

import { useState } from "react";
import {
  FolderPlus,
  FilePlus,
  Copy,
  Search,
  ChevronRight,
  Edit2,
  Check,
  X,
  Sparkles,
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
  find_replace_tab: Search,
};

const TOOL_LABELS: Record<string, string> = {
  folder_creation_tab: "Create Folders",
  file_creation_tab: "Create Files",
  file_copy_tab: "Copy Files",
  find_replace_tab: "Find & Replace",
};

export const ContextualToolWidget = ({
  widgetData,
  onUpdate,
  onNavigate,
  onConfirm,
  onDismiss,
  isEditable = true,
}: ContextualToolWidgetProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const Icon = TOOL_ICONS[widgetData.toolName] || Sparkles;
  const toolLabel = TOOL_LABELS[widgetData.toolName] || widgetData.toolName;

  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate(widgetData);
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(widgetData);
    }
  };

  // Render compact preview based on tool type
  const renderPreview = () => {
    switch (widgetData.toolName) {
      case "folder_creation_tab":
        const folderNames = widgetData.params?.folderNames || [];
        const subfolders = widgetData.params?.subfolders || [];
        const rootPath = widgetData.params?.rootPath || "";
        return (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {rootPath ? `In: ${rootPath.split("/").pop() || rootPath}` : "No path specified"}
            </div>
            {folderNames.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {folderNames.slice(0, 3).map((name, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
                {folderNames.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{folderNames.length - 3} more
                  </Badge>
                )}
              </div>
            )}
            {subfolders.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Subfolders: {subfolders.slice(0, 3).join(", ")}
                {subfolders.length > 3 && ` +${subfolders.length - 3} more`}
              </div>
            )}
          </div>
        );

      case "file_creation_tab":
        const count = widgetData.params?.count || 0;
        const extensions = widgetData.params?.extensions || [];
        return (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              {count > 0 ? `${count} file${count !== 1 ? "s" : ""}` : "No count specified"}
            </div>
            {extensions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {extensions.map((ext, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    .{ext}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );

      case "file_copy_tab":
        const sourcePath = widgetData.params?.sourcePath || "";
        const destPath = widgetData.params?.destinationPath || "";
        return (
          <div className="space-y-1 text-xs">
            <div className="text-muted-foreground">
              From: {sourcePath ? sourcePath.split("/").pop() || sourcePath : "Not specified"}
            </div>
            <div className="text-muted-foreground">
              To: {destPath ? destPath.split("/").pop() || destPath : "Not specified"}
            </div>
          </div>
        );

      case "find_replace_tab":
        const searchQuery = widgetData.params?.searchQuery || "";
        const replaceQuery = widgetData.params?.replaceQuery || "";
        return (
          <div className="space-y-1 text-xs">
            <div className="text-muted-foreground">
              Find: {searchQuery || "Not specified"}
            </div>
            {replaceQuery && (
              <div className="text-muted-foreground">
                Replace: {replaceQuery}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-xs text-muted-foreground">
            {Object.keys(widgetData.params || {}).length} parameter
            {Object.keys(widgetData.params || {}).length !== 1 ? "s" : ""}
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="my-2"
    >
      <Card
        className={cn(
          "border-2 transition-all cursor-pointer hover:border-primary/50",
          widgetData.confirmed && "border-primary/30 bg-primary/5"
        )}
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="p-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div className="p-1.5 bg-primary/10 rounded-md text-primary flex-shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{toolLabel}</h4>
                  {widgetData.confidence !== undefined && (
                    <Badge
                      variant={widgetData.confidence > 0.7 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {Math.round(widgetData.confidence * 100)}% match
                    </Badge>
                  )}
                </div>
                {renderPreview()}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {isEditable && !widgetData.confirmed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(!isEditing);
                  }}
                  title="Edit"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Expanded details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 pt-3 border-t space-y-2"
              >
                <div className="text-xs text-muted-foreground">
                  {widgetData.description || "No description available"}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {onConfirm && !widgetData.confirmed && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirm();
                      }}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Looks good
                    </Button>
                  )}
                  {onNavigate && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigate();
                      }}
                    >
                      Open full tool
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
};
