/**
 * File: src/features/ai-assistant/components/ResultsSummary.tsx
 * 
 * Component that displays a structured summary of tool execution results
 * with actionable next steps and verification.
 */

import { CheckCircle2, XCircle, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ExecutionResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
  filesCreated?: number;
  filesMoved?: number;
  filesDeleted?: number;
  foldersCreated?: number;
  message?: string;
}

export interface ResultsSummaryData {
  overallSuccess: boolean;
  results: ExecutionResult[];
  totalTime?: number; // in milliseconds
  summary: string;
  nextSteps?: string[];
  canUndo?: boolean;
  verificationNeeded?: boolean;
}

interface ResultsSummaryProps {
  results: ResultsSummaryData;
  onUndo?: () => void;
  onVerify?: () => void;
  onNextStep?: (step: string) => void;
  className?: string;
}

export const ResultsSummary = ({
  results,
  onUndo,
  onVerify,
  onNextStep,
  className,
}: ResultsSummaryProps) => {
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getSummaryStats = () => {
    const stats = {
      filesCreated: 0,
      filesMoved: 0,
      filesDeleted: 0,
      foldersCreated: 0,
    };

    results.results.forEach((result) => {
      if (result.success) {
        stats.filesCreated += result.filesCreated || 0;
        stats.filesMoved += result.filesMoved || 0;
        stats.filesDeleted += result.filesDeleted || 0;
        stats.foldersCreated += result.foldersCreated || 0;
      }
    });

    return stats;
  };

  const stats = getSummaryStats();

  return (
    <Card className={cn(
      "border-2 shadow-lg",
      results.overallSuccess
        ? "border-green-200 dark:border-green-800/50"
        : "border-red-200 dark:border-red-800/50",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {results.overallSuccess ? (
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            )}
            <CardTitle className="text-base font-semibold">
              {results.overallSuccess ? 'Task Completed' : 'Task Completed with Errors'}
            </CardTitle>
          </div>
          {results.totalTime && (
            <Badge variant="outline" className="text-xs">
              {formatTime(results.totalTime)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Message */}
        <div>
          <p className="text-sm text-slate-700 dark:text-slate-300">{results.summary}</p>
        </div>

        {/* Statistics */}
        {(stats.filesCreated > 0 || stats.filesMoved > 0 || stats.filesDeleted > 0 || stats.foldersCreated > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stats.filesCreated > 0 && (
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="text-xs text-blue-600 dark:text-blue-400 mb-0.5">Files Created</div>
                <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                  {stats.filesCreated}
                </div>
              </div>
            )}
            {stats.foldersCreated > 0 && (
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="text-xs text-purple-600 dark:text-purple-400 mb-0.5">Folders Created</div>
                <div className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                  {stats.foldersCreated}
                </div>
              </div>
            )}
            {stats.filesMoved > 0 && (
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <div className="text-xs text-orange-600 dark:text-orange-400 mb-0.5">Files Moved</div>
                <div className="text-lg font-semibold text-orange-700 dark:text-orange-300">
                  {stats.filesMoved}
                </div>
              </div>
            )}
            {stats.filesDeleted > 0 && (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="text-xs text-red-600 dark:text-red-400 mb-0.5">Files Deleted</div>
                <div className="text-lg font-semibold text-red-700 dark:text-red-300">
                  {stats.filesDeleted}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Individual Results */}
        {results.results.length > 1 && (
          <div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">
              Step Results
            </span>
            <div className="space-y-1.5">
              {results.results.map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg text-xs",
                    result.success
                      ? "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800"
                  )}
                >
                  {result.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  )}
                  <span className="flex-1 text-slate-700 dark:text-slate-300">
                    {result.tool.replace(/_/g, ' ').replace(/_tab/g, '')}
                  </span>
                  {result.message && (
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                      {result.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {results.nextSteps && results.nextSteps.length > 0 && (
          <div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">
              Suggested Next Steps
            </span>
            <div className="space-y-1.5">
              {results.nextSteps.map((step, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-auto py-2"
                  onClick={() => onNextStep?.(step)}
                >
                  <ArrowRight className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                  <span className="text-left">{step}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          {results.canUndo && onUndo && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUndo}
              className="text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Undo
            </Button>
          )}
          {results.verificationNeeded && onVerify && (
            <Button
              variant="outline"
              size="sm"
              onClick={onVerify}
              className="text-xs"
            >
              <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
              Verify Results
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
