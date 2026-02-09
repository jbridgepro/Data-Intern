/**
 * File: src/features/ai-assistant/components/AssistantHubView.tsx
 *
 * Hub view for the AI Assistant. Shown when the pinned "Assistant Hub" tab is active.
 * Lets users start a new chat (opens in a new tab) or switch to an existing chat.
 */

import React from "react";
import { MessageSquarePlus, MessageSquare, Sparkles } from "lucide-react";

interface AssistantHubViewProps {
  onNewChat: () => void;
  recentChats: { id: string; name: string }[];
  onOpenChat: (id: string) => void;
}

export const AssistantHubView: React.FC<AssistantHubViewProps> = ({
  onNewChat,
  recentChats,
  onOpenChat,
}) => {
  return (
    <div className="h-full w-full overflow-y-auto p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500/10 to-blue-500/10 dark:from-violet-500/20 dark:to-blue-500/20">
            <Sparkles className="h-8 w-8 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-blue-400">
            AI Assistant
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Start a new chat or continue with an existing one.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={onNewChat}
            className="group flex items-center gap-4 rounded-xl border border-violet-200 bg-white/50 p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-violet-800 dark:bg-slate-900/50 dark:hover:border-violet-700 w-full"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <MessageSquarePlus className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                New chat
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Opens in a new tab
              </p>
            </div>
            <span className="text-sm font-medium text-violet-600 dark:text-violet-400 opacity-0 transition-opacity group-hover:opacity-100">
              Start →
            </span>
          </button>

          {recentChats.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                Recent chats
              </h3>
              <ul className="space-y-2">
                {recentChats.map((chat) => (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => onOpenChat(chat.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-200/60 bg-white/40 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800/60 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                        {chat.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
