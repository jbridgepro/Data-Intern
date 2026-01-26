/**
 * File: src/features/ai-assistant/components/ReasoningChain.tsx
 * 
 * Component for displaying AI's chain of thought/reasoning steps.
 */

import { Brain, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Simple collapsible implementation
import { cn } from '@/lib/utils';
import { useState } from 'react';

export interface ReasoningStep {
  id: string;
  step: number;
  type: 'analysis' | 'planning' | 'tool_selection' | 'execution' | 'conclusion';
  content: string;
  timestamp: number;
  toolUsed?: string;
  result?: 'success' | 'error' | 'pending';
}

interface ReasoningChainProps {
  steps: ReasoningStep[];
  isProcessing?: boolean;
  className?: string;
}

export const ReasoningChain = ({ steps, isProcessing = false, className }: ReasoningChainProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (steps.length === 0 && !isProcessing) {
    return null;
  }

  const getStepIcon = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'analysis':
        return '🔍';
      case 'planning':
        return '📋';
      case 'tool_selection':
        return '🔧';
      case 'execution':
        return '⚙️';
      case 'conclusion':
        return '✅';
      default:
        return '💭';
    }
  };

  const getStepColor = (type: ReasoningStep['type']) => {
    switch (type) {
      case 'analysis':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'planning':
        return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
      case 'tool_selection':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'execution':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'conclusion':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20';
    }
  };

  return (
    <Card className={cn("mt-3 border-2 border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full"
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                AI Reasoning Chain
              </span>
              <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                {steps.length} {steps.length === 1 ? 'step' : 'steps'}
              </Badge>
              {isProcessing && (
                <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-blue-600 dark:text-blue-400 transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </div>
        </CardContent>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 pb-4">
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="relative pl-6 border-l-2 border-blue-200 dark:border-blue-800"
                >
                  {/* Step Number Badge */}
                  <div className="absolute -left-3 top-0">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-slate-900",
                      getStepColor(step.type)
                    )}>
                      {step.step}
                    </div>
                  </div>

                  {/* Step Content */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStepIcon(step.type)}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs capitalize", getStepColor(step.type))}
                      >
                        {step.type.replace('_', ' ')}
                      </Badge>
                      {step.toolUsed && (
                        <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {step.toolUsed}
                        </Badge>
                      )}
                      {step.result && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            step.result === 'success' && "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300",
                            step.result === 'error' && "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300",
                            step.result === 'pending' && "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300"
                          )}
                        >
                          {step.result}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {step.content}
                    </p>
                  </div>

                  {/* Connector Line (except for last step) */}
                  {index < steps.length - 1 && (
                    <div className="absolute -left-[2px] top-6 bottom-0 w-0.5 bg-blue-200 dark:bg-blue-800" />
                  )}
                </div>
              ))}

              {isProcessing && (
                <div className="relative pl-6 border-l-2 border-blue-200 dark:border-blue-800">
                  <div className="absolute -left-3 top-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-slate-900 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💭</span>
                      <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                        Thinking...
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      Processing next step...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
    </Card>
  );
};
