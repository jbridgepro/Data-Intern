/**
 * File: src/features/ai-assistant/components/ChatMessage.tsx
 *
 * Component for displaying chat messages in the AI Assistant interface.
 * Features modern design with enhanced avatars, message bubbles, and interactions.
 */

import {
  Bot,
  User,
  Copy,
  Check,
  Sparkles,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToolExecutionCard, type ToolExecutionInfo } from "./ToolExecutionCard";
import { ReasoningChain, type ReasoningStep } from "./ReasoningChain";
import { ContextualToolWidget } from "./ContextualToolWidget";
import {
  ConfirmationButtons,
  extractConfirmationActions,
} from "./ConfirmationButtons";
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
  onDelete?: () => void;
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
  onDelete,
  aiName,
  userName,
}: ChatMessageProps) => {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Use custom names or defaults
  const displayUserName = userName || "You";
  const displayAiName = aiName || "AI Assistant";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract confirmation actions from assistant messages
  const confirmationActions =
    isAssistant && onConfirmationAction
      ? extractConfirmationActions(message.content)
      : [];

  return (
    <div
      className={cn(
        "flex gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300 group",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {/* AI Avatar - Enhanced Design */}
      {isAssistant && (
        <div className="flex-shrink-0 relative">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {/* Online Indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-1.5 max-w-[80%] sm:max-w-[75%]",
          isUser && "items-end",
        )}
      >
        {/* Name and Timestamp */}
        <div className="flex items-center gap-2 px-1">
          <span
            className={cn(
              "text-xs font-semibold",
              isUser
                ? "text-blue-600 dark:text-blue-400"
                : "text-violet-600 dark:text-violet-400",
            )}
          >
            {isUser ? displayUserName : displayAiName}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Message Bubble - Enhanced Design */}
        <div
          className={cn(
            "relative overflow-hidden transition-all duration-200",
            isUser
              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-md shadow-lg shadow-blue-500/20"
              : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl rounded-tl-md shadow-sm group-hover:shadow-md",
          )}
        >
          <div className="p-4 sm:p-5">
            {/* Message Content */}
            <div
              className={cn(
                "whitespace-pre-wrap leading-relaxed",
                isUser
                  ? "text-sm text-white"
                  : "text-sm text-slate-800 dark:text-slate-100",
              )}
            >
              {message.content}
            </div>

            {/* Metadata Badges - Enhanced Design */}
            {(message.metadata?.analysis || message.metadata?.operation) && (
              <div
                className={cn(
                  "mt-4 pt-3.5 flex flex-wrap gap-2 border-t",
                  isUser
                    ? "border-white/20"
                    : "border-slate-200/60 dark:border-slate-800/60",
                )}
              >
                {message.metadata?.analysis && (
                  <>
                    <Badge
                      className={cn(
                        "text-xs font-medium px-2.5 py-0.5",
                        isUser
                          ? "bg-white/20 text-white border-0"
                          : "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-0",
                      )}
                    >
                      {message.metadata.analysis.totalFiles} files
                    </Badge>
                    <Badge
                      className={cn(
                        "text-xs font-medium px-2.5 py-0.5",
                        isUser
                          ? "bg-white/20 text-white border-0"
                          : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0",
                      )}
                    >
                      Score: {message.metadata.analysis.organizationScore}/100
                    </Badge>
                  </>
                )}
                {message.metadata?.operation && (
                  <Badge
                    className={cn(
                      "text-xs font-medium px-2.5 py-0.5",
                      isUser
                        ? "bg-white/20 text-white border-0"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0",
                    )}
                  >
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
          </div>

          {/* Action Buttons - Enhanced for Assistant Messages */}
          {isAssistant && (
            <div
              className={cn(
                "absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200",
                "bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-slate-200/50 dark:border-slate-700/50",
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                onClick={handleCopy}
                title={copied ? "Copied!" : "Copy message"}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  feedback === "up"
                    ? "text-emerald-500"
                    : "text-slate-500 hover:text-emerald-500",
                )}
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
                title="Good response"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  feedback === "down"
                    ? "text-red-500"
                    : "text-slate-500 hover:text-red-500",
                )}
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
                title="Could be better"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Action Buttons - For User Messages (Undo/Delete) */}
          {isUser && onDelete && (
            <div
              className={cn(
                "absolute top-2 left-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200",
                "bg-white/20 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-0.5 shadow-sm",
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                onClick={onDelete}
                title="Undo message"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Reasoning Chain Display - Shows AI's chain of thought */}
        {/* Auto-collapses when AI finishes thinking, user can expand to see reasoning */}
        {message.metadata?.reasoningSteps &&
          Array.isArray(message.metadata.reasoningSteps) &&
          message.metadata.reasoningSteps.length > 0 && (
            <div className="w-full mt-2">
              <ReasoningChain
                steps={message.metadata.reasoningSteps as ReasoningStep[]}
                isProcessing={isProcessing && message.role === "assistant"}
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

      {/* User Avatar - Enhanced Design */}
      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <User className="h-5 w-5 text-white" />
          </div>
        </div>
      )}
    </div>
  );
};
