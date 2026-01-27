/**
 * File: src/components/panels/ChatPanel.tsx
 *
 * Frontend: Chat Panel component
 * Provides a collapsible chat interface that can be toggled via panel configuration
 * Supports minimize functionality for compact view
 */

import { MessageSquare, X, Trash, Minus, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChatInput } from "@/features/ai-assistant/components/ChatInput";
import { useChatContext } from "@/features/chat/contexts/ChatContext";

interface ChatPanelProps {
  /** Whether the panel is visible */
  isVisible: boolean;
  /** Callback to close/hide the panel */
  onClose?: () => void;
  /** Whether the panel is minimized */
  isMinimized?: boolean;
  /** Callback to toggle minimize state */
  onToggleMinimize?: () => void;
}

export const ChatPanel = ({ isVisible, onClose, isMinimized, onToggleMinimize }: ChatPanelProps) => {
  const { activeSession, sendMessage, setInputValue, clearHistory, settings, updateSettings, setDirectory } = useChatContext();
  
  // Use state from context
  const messages = activeSession?.messages || [];
  const input = activeSession?.inputValue || '';
  const isProcessing = activeSession?.isProcessing || false;

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    sendMessage(input);
  };

  if (!isVisible) return null;

  // Minimized state - show compact header only
  if (isMinimized) {
    return (
      <div className="h-full flex flex-col border-l border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex-1 flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMinimize}
            className="flex items-center gap-2"
            title="Expand Chat Panel"
          >
            <ChevronLeft className="h-4 w-4" />
            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-l border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold">Chat</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={clearHistory} title="Clear Chat">
            <Trash className="h-4 w-4" />
          </Button>
          {onToggleMinimize && (
            <Button variant="ghost" size="sm" onClick={onToggleMinimize} title="Minimize Panel">
              <Minus className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} title="Close Panel">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages - min-h-0 is required for flex children to be scrollable */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg p-3",
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100",
                )}
              >
                <div className="text-sm space-y-2">
                   {message.content.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                   ))}
                </div>
              </div>
            </div>
          ))}
          {isProcessing && (
             <div className="flex justify-start">
                <div className="bg-slate-200 dark:bg-slate-800 rounded-lg p-3">
                   <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                   </div>
                </div>
             </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 p-4 border-t border-slate-200/50 dark:border-slate-800/50">
        <ChatInput
          value={input}
          onChange={setInputValue}
          onSend={handleSend}
          isProcessing={isProcessing}
          disabled={isProcessing}
          currentDirectory={activeSession?.currentDirectory}
          onSelectDirectory={setDirectory}
          aiModel={settings.model}
          onModelChange={(model) => updateSettings({ model })}
          provider={settings.provider}
          onProviderChange={(provider) => updateSettings({ provider })}
          ollamaBaseUrl={settings.ollamaBaseUrl}
          placeholder="Ask anything (⌘L), @ to mention, / for workflows"
        />
      </div>
    </div>
  );
};
