/**
 * File: src/features/ai-assistant/voice/components/ExecutionProgress.tsx
 *
 * Component for showing execution progress with voice updates.
 */

import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ImplementationStep } from "../types";

interface ExecutionProgressProps {
  planId: string;
  currentStep: number;
  totalSteps: number;
  steps: ImplementationStep[];
  progress: {
    current: number;
    total: number;
    percentage: number;
    stage: string;
  };
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

export const ExecutionProgress = ({
  currentStep,
  totalSteps,
  steps,
  progress,
  voiceEnabled,
  onToggleVoice,
  onPause,
  onStop,
}: ExecutionProgressProps) => {
  const currentStepData = steps[currentStep - 1];

  return (
    <Card className="mb-4 border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold">Executing Plan</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleVoice}
                title={
                  voiceEnabled ? "Mute voice updates" : "Enable voice updates"
                }
              >
                {voiceEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
              {onPause && (
                <Button variant="outline" size="sm" onClick={onPause}>
                  Pause
                </Button>
              )}
              {onStop && (
                <Button variant="outline" size="sm" onClick={onStop}>
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">
                Step {currentStep}/{totalSteps} (
                {Math.round((currentStep / totalSteps) * 100)}%)
              </span>
            </div>
            <Progress
              value={(currentStep / totalSteps) * 100}
              className="h-2"
            />
          </div>

          {/* Current Step */}
          {currentStepData && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-blue-100 dark:bg-blue-900/20"
                >
                  Step {currentStep}
                </Badge>
                <span className="text-sm font-medium">
                  {currentStepData.description}
                </span>
              </div>

              {/* Step Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {progress.stage}
                  </span>
                  <span className="font-medium">{progress.percentage}%</span>
                </div>
                <Progress value={progress.percentage} className="h-1.5" />
                <div className="text-xs text-muted-foreground">
                  {progress.current}/{progress.total} items
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Step List */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Steps:
            </div>
            {steps.map((step, index) => {
              const isCompleted = index + 1 < currentStep;
              const isCurrent = index + 1 === currentStep;
              const isPending = index + 1 > currentStep;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2 text-xs p-2 rounded",
                    isCompleted && "bg-green-50 dark:bg-green-900/10",
                    isCurrent && "bg-blue-50 dark:bg-blue-900/10",
                    isPending && "opacity-50",
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-700" />
                  )}
                  <span
                    className={cn(
                      "flex-1",
                      isCompleted && "line-through text-muted-foreground",
                      isCurrent && "font-medium",
                    )}
                  >
                    {step.order}. {step.description}
                  </span>
                  {isCompleted && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-green-100 dark:bg-green-900/20"
                    >
                      Done
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
