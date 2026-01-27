/**
 * File: src/features/ai-assistant/components/ReasoningChain.tsx
 * 
 * Component for displaying AI's chain of thought/reasoning steps.
 * Features:
 * - Auto-expands while AI is thinking (isProcessing = true)
 * - Auto-collapses when AI finishes and provides an answer
 * - User can manually toggle expand/collapse at any time
 */

import { Brain, ChevronRight, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

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
  /** If true, starts collapsed. Default: false (starts expanded while processing) */
  startCollapsed?: boolean;
  /** If true, auto-collapses when processing completes. Default: true */
  autoCollapseOnComplete?: boolean;
}

export const ReasoningChain = ({ 
  steps, 
  isProcessing = false, 
  className,
  startCollapsed = false,
  autoCollapseOnComplete = true,
}: ReasoningChainProps) => {
  // Track if user manually toggled the expansion
  const userToggledRef = useRef(false);
  const wasProcessingRef = useRef(isProcessing);
  
  // Default: expanded while processing, respect startCollapsed otherwise
  const [isExpanded, setIsExpanded] = useState(() => {
    if (isProcessing) return true;
    return !startCollapsed;
  });

  // Auto-expand when processing starts, auto-collapse when processing ends
  useEffect(() => {
    // If processing just started
    if (isProcessing && !wasProcessingRef.current) {
      setIsExpanded(true);
      userToggledRef.current = false; // Reset user toggle tracking
    }
    
    // If processing just ended (was processing, now not)
    if (!isProcessing && wasProcessingRef.current && autoCollapseOnComplete) {
      // Only auto-collapse if user didn't manually toggle during processing
      if (!userToggledRef.current) {
        // Small delay before collapsing so user can see the final step
        const timer = setTimeout(() => {
          setIsExpanded(false);
        }, 1500); // 1.5 second delay before auto-collapse
        return () => clearTimeout(timer);
      }
    }
    
    wasProcessingRef.current = isProcessing;
  }, [isProcessing, autoCollapseOnComplete]);

  const handleToggle = () => {
    userToggledRef.current = true; // User manually toggled
    setIsExpanded(!isExpanded);
  };

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

  // Calculate summary for collapsed state
  const getCollapsedSummary = () => {
    if (steps.length === 0) return 'Thinking...';
    const lastStep = steps[steps.length - 1];
    if (lastStep.type === 'conclusion') return 'Completed reasoning';
    const toolsUsed = steps.filter(s => s.toolUsed).map(s => s.toolUsed);
    if (toolsUsed.length > 0) {
      return `Used ${toolsUsed.length} tool${toolsUsed.length > 1 ? 's' : ''}`;
    }
    return `${steps.length} reasoning step${steps.length > 1 ? 's' : ''}`;
  };

  return (
    <Card className={cn(
      "mt-3 border-2 transition-all duration-300",
      isProcessing 
        ? "border-purple-300 dark:border-purple-700 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/20 dark:to-blue-900/20 shadow-lg shadow-purple-100/50 dark:shadow-purple-900/20" 
        : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30",
      className
    )}>
      <button
        onClick={handleToggle}
        className="w-full text-left"
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isProcessing ? (
                <div className="relative">
                  <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <Sparkles className="absolute -top-1 -right-1 h-2.5 w-2.5 text-purple-500 animate-pulse" />
                </div>
              ) : (
                <Brain className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              )}
              <span className={cn(
                "text-sm font-semibold",
                isProcessing 
                  ? "text-purple-900 dark:text-purple-100" 
                  : "text-slate-700 dark:text-slate-300"
              )}>
                {isProcessing ? "Thinking..." : "Chain of Thought"}
              </span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  isProcessing
                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                {steps.length} {steps.length === 1 ? 'step' : 'steps'}
              </Badge>
              {isProcessing && (
                <Loader2 className="h-3 w-3 animate-spin text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Show summary when collapsed */}
              {!isExpanded && !isProcessing && (
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  {getCollapsedSummary()}
                </span>
              )}
              {isExpanded ? (
                <ChevronDown className={cn(
                  "h-4 w-4 transition-colors",
                  isProcessing ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-slate-400"
                )} />
              ) : (
                <ChevronRight className={cn(
                  "h-4 w-4 transition-colors",
                  isProcessing ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-slate-400"
                )} />
              )}
            </div>
          </div>
        </CardContent>
      </button>

      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "relative pl-6 border-l-2 transition-colors duration-300",
                  isProcessing 
                    ? "border-purple-200 dark:border-purple-800" 
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                {/* Step Number Badge */}
                <div className="absolute -left-3 top-0">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-slate-900 transition-all duration-300",
                    getStepColor(step.type)
                  )}>
                    {step.step}
                  </div>
                </div>

                {/* Step Content */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
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

                {/* Connector Line (except for last step when not processing) */}
                {(index < steps.length - 1 || isProcessing) && (
                  <div className={cn(
                    "absolute -left-[1px] top-6 bottom-0 w-0.5 transition-colors duration-300",
                    isProcessing 
                      ? "bg-purple-200 dark:bg-purple-800" 
                      : "bg-slate-200 dark:bg-slate-700"
                  )} />
                )}
              </div>
            ))}

            {/* Active Thinking Indicator */}
            {isProcessing && (
              <div className={cn(
                "relative pl-6 border-l-2 border-purple-200 dark:border-purple-800"
              )}>
                <div className="absolute -left-3 top-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-slate-900 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30">
                    <Loader2 className="h-3 w-3 animate-spin text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg animate-pulse">💭</span>
                    <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 animate-pulse">
                      Processing...
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                    Working on next step...
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
