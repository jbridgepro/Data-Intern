/**
 * File: src/features/ai-assistant/components/AIFileAssistantTabs.tsx
 *
 * Tabs management for AI File Assistant. Assistant Hub is always the first tab
 * and cannot be closed; new chats open in a new tab (same UX as Quick Tools).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, MessageSquare, Sparkles, MoreHorizontal, LayoutGrid } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { aiAssistantInfo } from '@/components/layout/toolInfoContent';
import { cn } from '@/lib/utils';
import { AIFileAssistantSession } from './AIFileAssistantSession';
import { AssistantHubView } from './AssistantHubView';
import { useAgentSelection } from "../../agents/contexts/AgentSelectionContext";
import { agentService } from "../../agents/services/agentService";

interface AIAssistantTab {
  id: string;
  name: string;
  directory?: string;
}

/** Fixed id for the pinned Assistant Hub tab (always first, not closeable). */
const HUB_TAB_ID = 'ai-assistant-hub';

/** Pinned hub tab; always present as the first tab. */
const HUB_TAB: AIAssistantTab = {
  id: HUB_TAB_ID,
  name: 'Assistant Hub',
};

/** Ensure saved tabs have the hub first and only once. */
function normalizeTabs(saved: AIAssistantTab[] | null): AIAssistantTab[] {
  if (!saved || saved.length === 0) return [HUB_TAB];
  const rest = saved.filter((t) => t.id !== HUB_TAB_ID);
  return [HUB_TAB, ...rest];
}

export const AIFileAssistantTabs = () => {
  const { selectedAgentId, selectAgent, createAndSelectAgent, deleteAgent } = useAgentSelection();

  const [tabs, setTabs] = useState<AIAssistantTab[]>(() => {
    try {
      const saved = localStorage.getItem('ai-assistant-tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return normalizeTabs(parsed);
      }
    } catch (error) {
      console.error('Failed to load tabs:', error);
    }
    return [HUB_TAB];
  });

  // When on hub we use null; when on a chat we use the agent id. Hub is always first tab.
  const activeTabId = selectedAgentId === null ? HUB_TAB_ID : selectedAgentId;

  // Effect: when an agent is selected that isn't in tabs yet, add a new tab (new chat opens in new tab)
  const prevSelectedAgentIdRef = useRef<string | null>(selectedAgentId);

  useEffect(() => {
    if (selectedAgentId && selectedAgentId !== HUB_TAB_ID && selectedAgentId !== prevSelectedAgentIdRef.current) {
      prevSelectedAgentIdRef.current = selectedAgentId;
      setTabs((prev) => {
        const exists = prev.some((t) => t.id === selectedAgentId);
        if (!exists) {
          const agent = agentService.getAgent(selectedAgentId);
          const tabName = agent?.name?.trim() || "Agent Chat";
          return [...prev, { id: selectedAgentId, name: tabName }];
        }
        return prev;
      });
    } else if (!selectedAgentId) {
      prevSelectedAgentIdRef.current = null;
    }
  }, [selectedAgentId]);

  // Save tabs to localStorage (hub is always first)
  useEffect(() => {
    try {
      localStorage.setItem('ai-assistant-tabs', JSON.stringify(tabs));
    } catch (error) {
      console.error('Failed to save tabs:', error);
    }
  }, [tabs]);

  // If the selected agent is no longer in tabs or in the agent service (e.g. after reload with stale id), switch to hub
  useEffect(() => {
    if (
      selectedAgentId &&
      selectedAgentId !== HUB_TAB_ID &&
      !tabs.some((t) => t.id === selectedAgentId) &&
      !agentService.getAgent(selectedAgentId)
    ) {
      selectAgent(null);
    }
  }, [selectedAgentId, tabs, selectAgent]);

  /** Create new chat in a new tab (called from hub or + button). */
  const createNewTab = async () => {
    const agentCount = tabs.filter((t) => t.id !== HUB_TAB_ID).length;
    const newName = `Chat ${agentCount + 1}`;
    await createAndSelectAgent(newName);
  };

  /** Close a tab. The pinned Assistant Hub cannot be closed. */
  const closeTab = (tabId: string) => {
    if (tabId === HUB_TAB_ID) return;
    if (tabs.length <= 1) return;

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    deleteAgent(tabId);

    if (activeTabId === tabId) {
      const currentIndex = tabs.findIndex((t) => t.id === tabId);
      const nextTab = newTabs[Math.min(currentIndex, newTabs.length - 1)] ?? newTabs[0];
      selectAgent(nextTab && nextTab.id !== HUB_TAB_ID ? nextTab.id : null);
    }
  };

  // Rename tab
  const renameTab = useCallback((tabId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, name: newName } : tab))
    );
  }, []);

  // Memoize directory change handler to prevent recreation
  const handleDirectoryChange = useCallback((directory: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, directory } : tab
      )
    );
  }, [activeTabId]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <PageHeader
        icon={Sparkles}
        title="AI Assistant"
        subtitle="Chat with agents and manage files"
        info={aiAssistantInfo}
      />
      {/* Tab Bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/60 dark:border-slate-800/60 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'group relative px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer min-w-[120px] max-w-[180px]',
                activeTabId === tab.id
                  ? 'bg-linear-to-r from-violet-500/10 to-blue-500/10 dark:from-violet-500/20 dark:to-blue-500/20 text-violet-700 dark:text-violet-300 shadow-sm border border-violet-200/50 dark:border-violet-800/50'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              )}
              onClick={() => (tab.id === HUB_TAB_ID ? selectAgent(null) : selectAgent(tab.id))}
            >
              {/* Hub tab uses grid icon; chat tabs use message icon */}
              {tab.id === HUB_TAB_ID ? (
                <LayoutGrid className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-colors",
                  activeTabId === tab.id ? "text-violet-500 dark:text-violet-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400"
                )} />
              ) : (
                <MessageSquare className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-colors",
                  activeTabId === tab.id ? "text-violet-500 dark:text-violet-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400"
                )} />
              )}

              <span className="truncate flex-1">{tab.name}</span>

              {/* Close button only on non-hub tabs */}
              {tabs.length > 1 && tab.id !== HUB_TAB_ID && (
                <button
                  type="button"
                  aria-label={`Close ${tab.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "p-0.5 rounded transition-all shrink-0",
                    activeTabId === tab.id
                      ? "opacity-60 hover:opacity-100 hover:bg-violet-200/50 dark:hover:bg-violet-800/50"
                      : "opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                  title="Close tab"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Active Tab Indicator */}
              {activeTabId === tab.id && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-linear-to-r from-violet-500 to-blue-500 rounded-full" />
              )}
            </div>
          ))}
        </div>

        {/* New Tab Button - opens new chat in a new tab */}
        <button
          type="button"
          aria-label="New chat tab"
          onClick={createNewTab}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all duration-200 group"
          title="New Chat Tab"
        >
          <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
        </button>

        {/* More Options Button (placeholder for future features) */}
        <button
          className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Content: Hub view when Assistant Hub is active; otherwise the chat session */}
      {activeTab && (
        <div className="flex-1 relative overflow-hidden">
          {activeTab.id === HUB_TAB_ID ? (
            <AssistantHubView
              onNewChat={createNewTab}
              recentChats={tabs.filter((t) => t.id !== HUB_TAB_ID).map((t) => ({ id: t.id, name: t.name }))}
              onOpenChat={(id) => selectAgent(id)}
            />
          ) : (
            <AIFileAssistantSession
              key={activeTab.id}
              sessionId={activeTab.id}
              tabName={activeTab.name}
              onRename={(newName) => renameTab(activeTab.id, newName)}
              initialDirectory={activeTab.directory}
              onDirectoryChange={handleDirectoryChange}
            />
          )}
        </div>
      )}
    </div>
  );
};
