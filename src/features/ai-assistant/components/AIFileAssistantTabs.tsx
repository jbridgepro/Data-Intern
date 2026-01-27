/**
 * File: src/features/ai-assistant/components/AIFileAssistantTabs.tsx
 * 
 * Tabs management component for AI File Assistant.
 * Allows multiple concurrent chat sessions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIFileAssistantSession } from './AIFileAssistantSession';
import { useAgentSelection } from "../../agents/contexts/AgentSelectionContext";

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
      setTabs(prev => {
        const exists = prev.some(t => t.id === selectedAgentId);
        if (!exists) {
          return [...prev, { id: selectedAgentId, name: 'Agent Chat' }];
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
    <div className="flex flex-col h-full bg-background">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'px-3 py-1.5 rounded-t-lg text-xs font-medium flex items-center gap-2 transition-colors relative cursor-pointer',
              activeTabId === tab.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-t border-x border-slate-200 dark:border-slate-800'
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
            )}
            onClick={() => selectAgent(tab.id)}
          >
            <span className="truncate max-w-[120px]">{tab.name}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded p-0.5 ml-1 shrink-0"
                title="Close tab"
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={createNewTab}
          className="px-2 py-1 rounded text-xs hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          title="New Chat Tab"
        >
          <Plus className="h-4 w-4" />
        </button>

        <div className="flex-1" />
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
