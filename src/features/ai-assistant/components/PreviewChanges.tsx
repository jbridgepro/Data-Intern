/**
 * File: src/features/ai-assistant/components/PreviewChanges.tsx
 * 
 * Component for previewing file operations before execution.
 * Shows what files will be affected and what changes will be made.
 */

import { FileText, Folder, ArrowRight, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { FileOperation, FileOperationItem } from '../types';
import { basename } from '@tauri-apps/api/path';

interface PreviewChangesProps {
  operation: FileOperation;
  onExecute: () => void;
  onCancel: () => void;
  onViewDetails?: () => void;
  className?: string;
}

export const PreviewChanges = ({
  operation,
  onExecute,
  onCancel,
  onViewDetails,
  className,
}: PreviewChangesProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getOperationIcon = () => {
    switch (operation.type) {
      case 'move':
        return <ArrowRight className="h-4 w-4" />;
      case 'copy':
        return <FileText className="h-4 w-4" />;
      case 'rename':
        return <FileText className="h-4 w-4" />;
      case 'delete':
        return <X className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getOperationColor = () => {
    switch (operation.type) {
      case 'delete':
        return 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10';
      case 'move':
        return 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10';
      case 'copy':
        return 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10';
      default:
        return 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10';
    }
  };

  // Group files by action type
  const groupedFiles = operation.files.reduce((acc, file) => {
    const key = file.action || operation.type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {} as Record<string, FileOperationItem[]>);

  const totalFiles = operation.files.length;
  const requiresConfirmation = operation.requiresConfirmation !== false;

  return (
    <Card className={cn("border-2 shadow-lg", getOperationColor(), className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getOperationIcon()}
            <CardTitle className="text-base">Preview Changes</CardTitle>
          </div>
          {requiresConfirmation && (
            <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300">
              Requires Confirmation
            </Badge>
          )}
        </div>
        {operation.description && (
          <p className="text-sm text-muted-foreground mt-2">{operation.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="space-y-2">
          <button
            onClick={() => toggleSection('summary')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-sm font-semibold">Summary</span>
            <span className={cn(
              "text-xs transition-transform",
              expandedSections.has('summary') && "rotate-180"
            )}>
              ▼
            </span>
          </button>
          {expandedSections.has('summary') && (
            <div className="pl-4 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Operation Type:</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {operation.type}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Files Affected:</span>
                <span className="font-medium">{totalFiles}</span>
              </div>
              {operation.confidence && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="font-medium">{operation.confidence}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* File Changes Preview */}
        <div className="space-y-2">
          <button
            onClick={() => toggleSection('files')}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-sm font-semibold">Files ({totalFiles})</span>
            <span className={cn(
              "text-xs transition-transform",
              expandedSections.has('files') && "rotate-180"
            )}>
              ▼
            </span>
          </button>
          {expandedSections.has('files') && (
            <ScrollArea className="h-[300px] pl-4">
              <div className="space-y-2">
                {Object.entries(groupedFiles).map(([type, files]) => (
                  <div key={type} className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {type} ({files.length})
                    </div>
                    <div className="space-y-1">
                      {files.slice(0, 50).map((file, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-2 rounded bg-slate-100/50 dark:bg-slate-800/50 text-xs"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{file.sourcePath}</div>
                            {file.targetPath && file.targetPath !== file.sourcePath && (
                              <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                                <ArrowRight className="h-3 w-3" />
                                <span className="truncate">{file.targetPath}</span>
                              </div>
                            )}
                            {file.reason && (
                              <div className="text-[10px] text-muted-foreground italic mt-0.5">
                                {file.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {files.length > 50 && (
                        <div className="text-xs text-muted-foreground italic pl-4">
                          +{files.length - 50} more files
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Warning for Destructive Operations */}
        {operation.type === 'delete' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-100/50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800 dark:text-yellow-200">
              <div className="font-medium mb-1">Warning: Destructive Operation</div>
              <div>This will permanently delete {totalFiles} file{totalFiles !== 1 ? 's' : ''}. This action cannot be undone.</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            onClick={onExecute}
            className="flex-1"
            variant={operation.type === 'delete' ? 'destructive' : 'default'}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Execute {operation.type === 'delete' ? 'Delete' : 'Operation'}
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
            Cancel
          </Button>
          {onViewDetails && (
            <Button
              onClick={onViewDetails}
              variant="ghost"
              size="sm"
            >
              View Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
