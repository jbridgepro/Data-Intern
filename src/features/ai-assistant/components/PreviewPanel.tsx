/**
 * File: src/features/ai-assistant/components/PreviewPanel.tsx
 *
 * Component for previewing file operations before execution.
 */

import { X, CheckCircle2, AlertCircle, File, Folder } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { FileOperation } from "../types";

interface PreviewPanelProps {
  operation: FileOperation;
  onExecute: () => void;
  onCancel: () => void;
}

export const PreviewPanel = ({
  operation,
  onExecute,
  onCancel,
}: PreviewPanelProps) => {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "move":
        return "→";
      case "copy":
        return "📋";
      case "rename":
        return "✏️";
      case "delete":
        return "🗑️";
      case "create":
        return "➕";
      default:
        return "•";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.6) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="w-96 border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col bg-slate-50 dark:bg-slate-900/50">
      <Card className="rounded-none border-0 border-b h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Preview Changes</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden">
          {/* Operation Summary */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2">
              {operation.description}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{operation.files.length} files</Badge>
              <span className={getConfidenceColor(operation.confidence)}>
                Confidence: {(operation.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Files List */}
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {operation.files.slice(0, 50).map((file, index) => (
                <div
                  key={index}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">
                      {getActionIcon(file.action)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {file.sourcePath.split("/").pop()}
                      </div>
                      {file.targetPath && (
                        <div className="text-muted-foreground truncate mt-1">
                          → {file.targetPath.split("/").pop()}
                        </div>
                      )}
                      {file.reason && (
                        <div className="text-muted-foreground text-xs mt-1 italic">
                          {file.reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {operation.files.length > 50 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  ... and {operation.files.length - 50} more files
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          {/* Warnings */}
          {operation.requiresConfirmation && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-xs text-yellow-800 dark:text-yellow-200">
                  This operation affects many files. Please review carefully
                  before executing.
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={onExecute}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Execute
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
