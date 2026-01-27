/**
 * File: src/features/ai-assistant/voice/components/ImplementationPlanView.tsx
 *
 * Visual implementation plan display with approval options.
 */

import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Play,
  X,
  Edit,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ImplementationPlan } from "../types";

interface ImplementationPlanViewProps {
  plan: ImplementationPlan;
  onApprove: () => void;
  onCancel: () => void;
  onModify?: () => void;
  onSaveWorkflow?: () => void;
  voiceEnabled?: boolean;
}

export const ImplementationPlanView = ({
  plan,
  onApprove,
  onCancel,
  onModify,
  onSaveWorkflow,
  voiceEnabled = false,
}: ImplementationPlanViewProps) => {
  const getRiskColor = () => {
    switch (plan.riskLevel) {
      case "low":
        return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20";
      case "high":
        return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20";
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  };

  return (
    <Card className="mb-4 border-2 border-blue-200 dark:border-blue-800">
      <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Implementation Plan
          </CardTitle>
          <Badge className={getRiskColor()}>
            {plan.riskLevel.toUpperCase()} Risk
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Plan Summary */}
        <div>
          <h3 className="font-semibold mb-2">{plan.task}</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {plan.description}
          </p>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Estimated Time:</span>
              <span className="font-medium">
                {formatDuration(plan.estimatedTotalTime)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Steps:</span>
              <span className="font-medium">{plan.steps.length}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Execution Steps */}
        <div>
          <h4 className="font-semibold mb-3">Execution Steps:</h4>
          <div className="space-y-4">
            {plan.steps.map((step, index) => (
              <div key={step.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-sm font-medium text-blue-600 dark:text-blue-400">
                    {step.order}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{step.description}</span>
                      <Badge variant="outline" className="text-xs">
                        {step.tool}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {Object.entries(step.parameters)
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <div key={key}>
                            • <span className="font-medium">{key}:</span>{" "}
                            {Array.isArray(value)
                              ? value.join(", ")
                              : String(value)}
                          </div>
                        ))}
                      {Object.keys(step.parameters).length > 3 && (
                        <div className="text-xs italic">
                          ... and {Object.keys(step.parameters).length - 3} more
                          parameters
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Duration: ~{formatDuration(step.estimatedDuration)}
                    </div>
                  </div>
                </div>
                {index < plan.steps.length - 1 && (
                  <div className="ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-800">
                    <div className="h-2" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Safety Checks */}
        {plan.safetyChecks.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                Safety Checks:
              </h4>
              <div className="space-y-1">
                {plan.safetyChecks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {check}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Preview (if available) */}
        {plan.preview && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Preview:</h4>
              <div className="text-sm text-muted-foreground">
                Structure preview available - expand to view
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Approval Actions */}
        <div className="space-y-3">
          {voiceEnabled && (
            <div className="text-center text-sm text-muted-foreground p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              🎤 Say "Approve" or "Start" to begin
              <br />
              🎤 Say "Cancel" or "Stop" to abort
              <br />
              🎤 Say "Modify" to adjust the plan
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              onClick={onApprove}
              size="lg"
              className="flex-1 min-w-[140px]"
            >
              <Play className="h-4 w-4 mr-2" />
              Approve & Execute
            </Button>
            {onModify && (
              <Button
                variant="outline"
                size="lg"
                onClick={onModify}
                className="flex-1 min-w-[140px]"
              >
                <Edit className="h-4 w-4 mr-2" />
                Modify Plan
              </Button>
            )}
            {onSaveWorkflow && (
              <Button
                variant="outline"
                size="lg"
                onClick={onSaveWorkflow}
                className="flex-1 min-w-[140px]"
              >
                <Save className="h-4 w-4 mr-2" />
                Save as Workflow
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={onCancel}
              className="flex-1 min-w-[140px]"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
