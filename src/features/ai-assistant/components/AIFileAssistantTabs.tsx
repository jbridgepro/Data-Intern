/**
 * File: src/features/ai-assistant/components/AIFileAssistantTabs.tsx
 * 
 * Tabs management component for AI File Assistant.
 * Allows multiple concurrent chat sessions with modern UI design.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, MessageSquare, Sparkles, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIFileAssistantSession } from './AIFileAssistantSession';
import { useAgentSelection } from "../../agents/contexts/AgentSelectionContext";
import { agentService } from "../../agents/services/agentService";

interface AIAssistantTab {
  id: string;
  name: string;
  directory?: string;
}

export const AIFileAssistantTabs = () => {
  const { selectedAgentId, selectAgent, createAndSelectAgent, deleteAgent } = useAgentSelection();

  const [tabs, setTabs] = useState<AIAssistantTab[]>(() => {
    // Load tabs from localStorage or create default
    try {
      const saved = localStorage.getItem('ai-assistant-tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Failed to load tabs:', error);
    }
    return [{ id: '1', name: 'Chat 1' }];
  });

  // Derived active state
  // If selectedAgentId is null/undefined, fallback to the first tab
  const activeTabId = selectedAgentId || tabs[0]?.id || '1';

  // Effect: Ensure selected agent exists in tabs list when selectedAgentId changes
  const prevSelectedAgentIdRef = useRef<string | null>(selectedAgentId);
  
  useEffect(() => {
    // Only add tab if selectedAgentId changed and doesn't exist
    if (selectedAgentId && selectedAgentId !== prevSelectedAgentIdRef.current) {
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
  
  // Effect: Initialize - select first tab if no agent selected (only once on mount)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedRef.current && !selectedAgentId && tabs.length > 0) {
      hasInitializedRef.current = true;
      const firstTabId = tabs[0]?.id;
      if (firstTabId) {
        selectAgent(firstTabId);
      }
    }
  }, []); // Empty deps - only run once on mount

  // Save tabs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ai-assistant-tabs', JSON.stringify(tabs));
    } catch (error) {
      console.error('Failed to save tabs:', error);
    }
  }, [tabs]);
  
  // Note: We no longer save 'ai-assistant-active-tab' separately because 
  // 'selected-agent-id' in AgentSelectionContext handles the active persistence globally.

  // Create new tab -> Create new Agent
  const createNewTab = async () => {
    const newName = `Chat ${tabs.length + 1}`;
    // This will trigger the useEffect above to add the tab
    await createAndSelectAgent(newName);
  };

  // Close tab
  const closeTab = (tabId: string) => {
    if (tabs.length === 1) {
      // Don't close the last tab, just reset it?
      // Or maybe allow closing if we really want empty state?
      // Current logic: keep one tab.
      return;
    }

    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    // Delete the agent (this stops it if running and removes it from persistence)
    deleteAgent(tabId);

    if (activeTabId === tabId) {
      const nextTab = newTabs[0];
      if (nextTab) {
          selectAgent(nextTab.id);
      } else {
          selectAgent(null);
      }
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
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Enhanced Tab Bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        {/* Logo/Brand */}
        <div className="flex items-center gap-2 pr-3 mr-2 border-r border-slate-200 dark:border-slate-800">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/10 to-blue-500/10 dark:from-violet-500/20 dark:to-blue-500/20">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 hidden sm:inline">
            AI Assistant
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={cn(
                'group relative px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer min-w-[120px] max-w-[180px]',
                activeTabId === tab.id
                  ? 'bg-gradient-to-r from-violet-500/10 to-blue-500/10 dark:from-violet-500/20 dark:to-blue-500/20 text-violet-700 dark:text-violet-300 shadow-sm border border-violet-200/50 dark:border-violet-800/50'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
              )}
              onClick={() => selectAgent(tab.id)}
            >
              {/* Tab Icon */}
              <MessageSquare className={cn(
                "h-3.5 w-3.5 shrink-0 transition-colors",
                activeTabId === tab.id 
                  ? "text-violet-500 dark:text-violet-400" 
                  : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400"
              )} />
              
              {/* Tab Name */}
              <span className="truncate flex-1">{tab.name}</span>
              
              {/* Close Button - Enhanced visibility */}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "p-0.5 rounded transition-all shrink-0",
                    activeTabId === tab.id
                      ? "opacity-60 hover:opacity-100 hover:bg-violet-200/50 dark:hover:bg-violet-800/50"
                      : "opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                  title="Close tab"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Active Tab Indicator */}
              {activeTabId === tab.id && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full" />
              )}
            </div>
          ))}
        </div>

        {/* New Tab Button - Enhanced */}
        <button
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

      {/* Active Session */}
      {activeTab && (
        <div className="flex-1 relative overflow-hidden">
          <AIFileAssistantSession
            key={activeTab.id}
            sessionId={activeTab.id}
            tabName={activeTab.name}
            onRename={(newName) => renameTab(activeTab.id, newName)}
            initialDirectory={activeTab.directory}
            onDirectoryChange={handleDirectoryChange}
          />
        </div>
      )}
    </div>
  );
};
