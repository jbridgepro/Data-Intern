/**
 * File path: ./src/features/find-replace/components/QuickActions.tsx
 *
 * Front-end: Quick actions component for Find and Replace feature.
 * Provides quick access to common operations.
 */

import {
  RefreshCw,
  Download,
  Copy,
  X,
  CheckSquare,
  Square,
  FileX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickActionsProps {
  onClearResults?: () => void;
  onExportResults?: () => void;
  onCopyResults?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onClearSearch?: () => void;
  hasResults: boolean;
  hasSelection: boolean;
  disabled?: boolean;
}

export const QuickActions = ({
  onClearResults,
  onExportResults,
  onCopyResults,
  onSelectAll,
  onDeselectAll,
  onClearSearch,
  hasResults,
  hasSelection,
  disabled = false,
}: QuickActionsProps) => {
  return (
    <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span>⚡</span>
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-2">
          {onSelectAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              disabled={disabled || !hasResults}
              title="Select all matches"
              className="text-xs"
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              Select All
            </Button>
          )}
          {onDeselectAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeselectAll}
              disabled={disabled || !hasSelection}
              title="Deselect all matches"
              className="text-xs"
            >
              <Square className="h-3.5 w-3.5 mr-1" />
              Deselect
            </Button>
          )}
          {onClearSearch && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSearch}
              disabled={disabled}
              title="Clear search query"
              className="text-xs"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
          {onExportResults && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportResults}
              disabled={disabled || !hasResults}
              title="Export results"
              className="text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
          )}
          {onCopyResults && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyResults}
              disabled={disabled || !hasResults}
              title="Copy results to clipboard"
              className="text-xs"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
          )}
          {onClearResults && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearResults}
              disabled={disabled || !hasResults}
              title="Clear all results"
              className="text-xs"
            >
              <FileX className="h-3.5 w-3.5 mr-1" />
              Clear Results
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
