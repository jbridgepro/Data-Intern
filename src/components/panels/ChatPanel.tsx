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
import { ChatMessage } from "@/features/ai-assistant/components/ChatMessage";
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
  const { activeSession, sendMessage, setInputValue, clearHistory, settings, updateSettings, setDirectory, deleteMessage, activeAgentId } = useChatContext();
  
  // Use state from context
  const messages = activeSession?.messages || [];
  const input = activeSession?.inputValue || '';
  const isProcessing = activeSession?.isProcessing || false;

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    sendMessage(input);
  };

  if (!isVisible) return null;

  // Minimized state - show compact strip with clear "Chat" label so the panel is identifiable
  if (isMinimized) {
    return (
      <div
        className="h-full flex flex-col border-l border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 min-w-[64px]"
        title="Chat — Click to expand"
      >
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-3 px-2">
          <MessageSquare className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider select-none">
            Chat
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 mt-1"
            onClick={onToggleMinimize}
            title="Expand Chat Panel"
            aria-label="Expand Chat Panel"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-l border-slate-200/50 dark:border-slate-800/50">
      {/* Header */}
      <div className="shrink-0 p-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/10 to-blue-500/10 dark:from-violet-500/20 dark:to-blue-500/20">
            <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chat</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearHistory} title="Clear Chat">
            <Trash className="h-4 w-4 text-slate-400 hover:text-red-500 transition-colors" />
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
        <div className="p-4 space-y-6">
          {messages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              userName="You"
              aiName="Assistant"
              onDelete={() => activeAgentId && deleteMessage(activeAgentId, message.id)}
            />
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
      <div className="shrink-0 p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
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
