/**
 * File: src/components/panels/ChatPanel.tsx
 *
 * Frontend: Chat Panel component
 * Provides a collapsible chat interface that can be toggled via panel configuration
 */

import { useState, useEffect } from "react";
import { MessageSquare, X, Send, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  isVisible: boolean;
  onClose?: () => void;
}

export const ChatPanel = ({ isVisible, onClose }: ChatPanelProps) => {
  const [messages, setMessages] = useState<
    Array<{ id: string; role: "user" | "assistant"; content: string }>
  >(() => {
    const saved = localStorage.getItem("chat-panel-messages");
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: "1",
            role: "assistant",
            content: "Hello! How can I help you today?",
          },
        ];
  });
  const [input, setInput] = useState("");

  useEffect(() => {
    localStorage.setItem("chat-panel-messages", JSON.stringify(messages));
  }, [messages]);

  const clearChat = () => {
      setMessages([{
            id: Date.now().toString(),
            role: "assistant",
            content: "Chat cleared. How can I help?",
      }]);
  };

  if (!isVisible) return null;

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: `I received your message: "${userMessage.content}". This is a placeholder chat, but your messages are now persisted locally.`,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  };

  return (
    <div className="h-full flex flex-col border-l border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold">Chat</h2>
        </div>
        <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={clearChat} title="Clear Chat">
            <Trash className="h-4 w-4" />
        </Button>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
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
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 p-4 border-t border-slate-200/50 dark:border-slate-800/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button onClick={handleSend} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
