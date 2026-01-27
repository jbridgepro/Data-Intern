/**
 * File: src/features/ai-assistant/components/TaskProgressTracker.tsx
 * 
 * Enhanced progress tracker for long-running tasks with time estimates.
 */

import { Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface TaskProgressTrackerProps {
  taskName: string;
  currentStep: number;
  totalSteps: number;
  currentStage?: string;
  startTime?: number;
  estimatedDuration?: number; // in milliseconds
  className?: string;
}

export const TaskProgressTracker = ({
  taskName,
  currentStep,
  totalSteps,
  currentStage,
  startTime,
  estimatedDuration,
  className,
}: TaskProgressTrackerProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);

      // Calculate estimated time remaining
      if (estimatedDuration && currentStep > 0 && totalSteps > 0) {
        const progress = currentStep / totalSteps;
        if (progress > 0) {
          const estimatedTotal = elapsed / progress;
          const remaining = estimatedTotal - elapsed;
          setEstimatedTimeRemaining(Math.max(0, remaining));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, estimatedDuration, currentStep, totalSteps]);

  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const isComplete = currentStep >= totalSteps;

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <Card className={cn("border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
            )}
            <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              {taskName}
            </span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              isComplete
                ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                : "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
            )}
          >
            {currentStep}/{totalSteps}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 mb-3">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
            <span>{Math.round(progress)}% complete</span>
            {estimatedTimeRemaining !== null && !isComplete && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ~{formatTime(estimatedTimeRemaining)} remaining
              </span>
            )}
          </div>
        </div>

        {/* Current Stage */}
        {currentStage && (
          <div className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100/50 dark:bg-indigo-900/20 rounded px-2 py-1.5">
            <div className="font-medium mb-0.5">Current Step:</div>
            <div className="truncate">{currentStage}</div>
          </div>
        )}

        {/* Time Information */}
        {startTime && (
          <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400">
            <span>Elapsed: {formatTime(elapsedTime)}</span>
            {estimatedDuration && (
              <span>Est. total: {formatTime(estimatedDuration)}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
