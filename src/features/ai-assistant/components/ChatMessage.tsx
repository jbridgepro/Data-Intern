/**
 * File: src/features/ai-assistant/components/ChatMessage.tsx
 *
 * Component for displaying chat messages in the AI Assistant interface.
 */

import { Bot, User, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToolExecutionCard, type ToolExecutionInfo } from "./ToolExecutionCard";
import { ReasoningChain, type ReasoningStep } from "./ReasoningChain";
import { ContextualToolWidget } from "./ContextualToolWidget";
import { ConfirmationButtons, extractConfirmationActions } from "./ConfirmationButtons";
import type { ChatMessageType, ToolWidgetData } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
  isProcessing?: boolean;
  widgets?: ToolWidgetData[];
  onWidgetUpdate?: (widgetId: string, updates: Partial<ToolWidgetData>) => void;
  onWidgetNavigate?: (widget: ToolWidgetData) => void;
  onWidgetConfirm?: (widget: ToolWidgetData) => void;
  onWidgetDismiss?: (widgetId: string) => void;
  onConfirmationAction?: (action: string) => void;
  aiName?: string; // Custom name for the AI assistant
  userName?: string; // Custom name for the user
}

export const ChatMessage = ({
  message,
  isProcessing = false,
  widgets = [],
  onWidgetUpdate,
  onWidgetNavigate,
  onWidgetConfirm,
  onWidgetDismiss,
  onConfirmationAction,
  aiName,
  userName,
}: ChatMessageProps) => {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const [copied, setCopied] = useState(false);
  
  // Use custom names or defaults
  const displayUserName = userName || "You";
  const displayAiName = aiName || "AI Assistant";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract confirmation actions from assistant messages
  const confirmationActions = isAssistant && onConfirmationAction
    ? extractConfirmationActions(message.content)
    : [];

  return (
    <div 
      className={cn(
        "flex gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300 group", 
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {isAssistant && (
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-400/10 dark:to-blue-400/10 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center justify-center mt-0.5 shadow-sm">
          <Bot className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
        </div>
      )}

      <div className={cn("flex flex-col gap-1.5 max-w-[80%] sm:max-w-[75%]", isUser && "items-end")}>
        <div className="flex items-center gap-2 px-1.5">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
             {isUser ? displayUserName : displayAiName}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <Card 
          className={cn(
            "relative overflow-hidden shadow-sm transition-all duration-200",
            isUser 
              ? "bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white border-0" 
              : "bg-white dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 group-hover:shadow-md"
          )}
        >
          <CardContent className="p-4 sm:p-5">
            <div className={cn(
              "whitespace-pre-wrap leading-relaxed", 
              isUser 
                ? "text-sm text-white/95" 
                : "text-sm text-slate-800 dark:text-slate-100"
            )}>
              {message.content}
            </div>
            
            {/* Action Buttons for Assistant - Improved Visibility */}
            {isAssistant && (
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost" 
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}

            {/* Metadata Badges - Improved Design */}
            {(message.metadata?.analysis || message.metadata?.operation) && (
              <div className={cn(
                "mt-4 pt-3.5 flex flex-wrap gap-2 border-t", 
                isUser 
                  ? "border-white/20" 
                  : "border-slate-200 dark:border-slate-800"
              )}>
                {message.metadata?.analysis && (
                  <>
                    <Badge variant="outline" className={cn(
                      "text-xs font-medium", 
                      isUser 
                        ? "bg-white/10 text-white/90 border-white/30" 
                        : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    )}>
                      {message.metadata.analysis.totalFiles} files
                    </Badge>
                    <Badge variant="outline" className={cn(
                      "text-xs font-medium", 
                      isUser 
                        ? "bg-white/10 text-white/90 border-white/30" 
                        : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    )}>
                      Score: {message.metadata.analysis.organizationScore}/100
                    </Badge>
                  </>
                )}
                {message.metadata?.operation && (
                  <Badge variant="outline" className={cn(
                    "text-xs font-medium", 
                    isUser 
                      ? "bg-white/10 text-white/90 border-white/30" 
                      : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  )}>
                    {message.metadata.operation.files.length} files affected
                  </Badge>
                )}
              </div>
            )}

            {/* Confirmation Buttons - Show when AI asks for confirmation */}
            {confirmationActions.length > 0 && (
              <ConfirmationButtons
                actions={confirmationActions}
                onAction={(action) => {
                  if (onConfirmationAction) {
                    onConfirmationAction(action);
                  }
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Reasoning Chain Display - Shows AI's chain of thought */}
        {/* Auto-collapses when AI finishes thinking, user can expand to see reasoning */}
        {message.metadata?.reasoningSteps && 
         Array.isArray(message.metadata.reasoningSteps) && 
         message.metadata.reasoningSteps.length > 0 && (
          <div className="w-full mt-2">
            <ReasoningChain
              steps={message.metadata.reasoningSteps as ReasoningStep[]}
              isProcessing={isProcessing && message.role === 'assistant'}
              startCollapsed={!isProcessing} // Start collapsed for completed messages
              autoCollapseOnComplete={true}
            />
          </div>
        )}

        {/* Tool Executions Display - Outside the bubble for better width handling */}
        {message.metadata?.toolExecutions && 
         Array.isArray(message.metadata.toolExecutions) && 
         message.metadata.toolExecutions.length > 0 && (
          <div className="w-full mt-2 space-y-2.5">
            {message.metadata.toolExecutions.map(
              (execution: ToolExecutionInfo, index: number) => (
                <ToolExecutionCard
                  key={index}
                  execution={execution}
                  stepNumber={index + 1}
                  totalSteps={message.metadata!.toolExecutions.length}
                />
              ),
            )}
          </div>
        )}

        {/* Contextual Tool Widgets - Display widgets associated with this message */}
        {isAssistant && widgets.length > 0 && (
          <div className="w-full mt-2 space-y-2">
            {widgets
              .filter((w) => w.sourceMessageId === message.id)
              .map((widget) => (
                <ContextualToolWidget
                  key={widget.id}
                  widgetData={widget}
                  onUpdate={(updates) => onWidgetUpdate?.(widget.id, updates)}
                  onNavigate={(w) => onWidgetNavigate?.(w)}
                  onConfirm={(w) => onWidgetConfirm?.(w)}
                  onDismiss={() => onWidgetDismiss?.(widget.id)}
                  isEditable={!widget.confirmed}
                />
              ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-400/10 dark:to-indigo-400/10 border border-blue-200/50 dark:border-blue-800/50 flex items-center justify-center mt-0.5 shadow-sm">
          <User className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
        </div>
      )}
    </div>
  );
};
