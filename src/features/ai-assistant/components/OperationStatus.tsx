/**
 * File: src/features/ai-assistant/components/OperationStatus.tsx
 *
 * Component for displaying active operation status.
 */

import { Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface OperationStatusProps {
  operation: string;
  onCancel?: () => void;
  progress?: number;
}

export const OperationStatus = ({
  operation,
  onCancel,
  progress,
}: OperationStatusProps) => {
  const getStatusText = () => {
    switch (operation) {
      case "processing":
        return "Processing your request...";
      case "executing":
        return "Executing file operations...";
      case "analyzing":
        return "Analyzing files...";
      default:
        return "Working...";
    }
  };

  return (
    <Card className="m-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <div className="text-sm font-medium">{getStatusText()}</div>
            {progress !== undefined && (
              <Progress value={progress} className="mt-2 h-1" />
            )}
          </div>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
