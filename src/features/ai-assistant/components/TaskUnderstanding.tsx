/**
 * File: src/features/ai-assistant/components/TaskUnderstanding.tsx
 * 
 * Component that displays the AI's understanding of the user's task.
 * Shows intent, extracted parameters, and planned actions before execution.
 */

import { Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TaskUnderstandingData {
  intent: string; // What the user wants to do
  taskType: 'question' | 'action' | 'creation' | 'organization' | 'analysis';
  parameters: Record<string, any>; // Extracted parameters
  tools: Array<{
    name: string;
    description: string;
    params: Record<string, any>;
  }>;
  requiresConfirmation: boolean;
  estimatedTime?: string;
  filesAffected?: number;
}

interface TaskUnderstandingProps {
  understanding: TaskUnderstandingData;
  onConfirm?: () => void;
  onModify?: () => void;
  className?: string;
}

export const TaskUnderstanding = ({
  understanding,
  onConfirm,
  onModify,
  className,
}: TaskUnderstandingProps) => {
  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'question':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'action':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'creation':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'organization':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'analysis':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <Card className={cn("border-2 border-indigo-200/50 dark:border-indigo-800/50 shadow-lg", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <CardTitle className="text-base font-semibold">Understanding Your Request</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Intent */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Intent</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-6">{understanding.intent}</p>
        </div>

        {/* Task Type */}
        <div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">
            Task Type
          </span>
          <Badge className={getTaskTypeColor(understanding.taskType)}>
            {understanding.taskType.charAt(0).toUpperCase() + understanding.taskType.slice(1)}
          </Badge>
        </div>

        {/* Tools to Use */}
        {understanding.tools.length > 0 && (
          <div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">
              Planned Actions
            </span>
            <div className="space-y-2">
              {understanding.tools.map((tool, index) => (
                <div
                  key={index}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {tool.name.replace(/_/g, ' ').replace(/_tab/g, '')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{tool.description}</p>
                  {Object.keys(tool.params).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(tool.params).slice(0, 3).map(([key, value]) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {key}: {String(value).substring(0, 20)}
                          {String(value).length > 20 ? '...' : ''}
                        </Badge>
                      ))}
                      {Object.keys(tool.params).length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{Object.keys(tool.params).length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Parameters */}
        {Object.keys(understanding.parameters).length > 0 && (
          <div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">
              Key Details
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(understanding.parameters).map(([key, value]) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="text-xs"
                >
                  {key}: {String(value).substring(0, 30)}
                  {String(value).length > 30 ? '...' : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
          {understanding.filesAffected !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Files: {understanding.filesAffected}
              </span>
            </div>
          )}
          {understanding.estimatedTime && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Est. time: {understanding.estimatedTime}
              </span>
            </div>
          )}
          {understanding.requiresConfirmation && (
            <div className="flex items-center gap-1.5 ml-auto">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Requires confirmation
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
