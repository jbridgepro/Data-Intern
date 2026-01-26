import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAgentManager } from "../hooks/useAgentManager";
import { AgentCard } from "./AgentCard";
import { AgentSearch } from "./AgentSearch";
import { useAgentSelection } from "../contexts/AgentSelectionContext";

import { SkillBrowser } from "./SkillBrowser";

interface AgentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  position?: "left" | "right" | "bottom";
}

type Tab = 'agents' | 'my-skills' | 'skill-store';

export const AgentSidebar = ({
  isOpen,
  // onClose, // Unused in new design where search/button replaces header. Can be re-added if we want a close button.
  position = "right",
}: AgentSidebarProps) => {
  const {
    agents,
    agentStates,
    toggleAgent,
    startAgent,
    stopAgent,
    pauseAgent,
    resumeAgent,
    clearAgentState,
  } = useAgentManager();

  const { selectAgent, createAndSelectAgent, selectedAgentId, deleteAgent } = useAgentSelection();

  const handleSelectAgent = (agentId: string) => {
    selectAgent(agentId);
    window.dispatchEvent(new CustomEvent('filepro:navigate', { detail: { tab: 'ai-assistant' } }));
  };

  const handleCreateAgent = async () => {
    await createAndSelectAgent("New Task Agent");
    window.dispatchEvent(new CustomEvent('filepro:navigate', { detail: { tab: 'ai-assistant' } }));
  };

  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [searchQuery, setSearchQuery] = useState("");

  const toggleExpanded = (id: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredAgents = useMemo(() => {
    // Filter out tool agents, only show "task-agent" type or any future AI types
    // For now, we only show 'task-agent' type in this sidebar.
    // The "Tools" are available in the main view or another panel.
    const notebookAgents = agents.filter(a => a.type === 'task-agent');

    if (!searchQuery.trim()) return notebookAgents;
    const query = searchQuery.toLowerCase();
    return notebookAgents.filter(
      (agent) => 
        agent.name.toLowerCase().includes(query) || 
        agent.description.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  // Sort: Running first, then by name
  const sortedAgents = useMemo(() => {
    return [...filteredAgents].sort((a, b) => {
      const aState = agentStates.find(s => s.id === a.id);
      const bState = agentStates.find(s => s.id === b.id);
      
      const aRunning = aState?.status === 'running' ? 1 : 0;
      const bRunning = bState?.status === 'running' ? 1 : 0;
      
      if (aRunning !== bRunning) return bRunning - aRunning;
      return a.name.localeCompare(b.name);
    });
  }, [filteredAgents, agentStates]);

  if (!isOpen) return null;

  const borderClass =
    position === "left"
      ? "border-r"
      : position === "bottom"
        ? "border-t"
        : "border-l";

  const sizeClass = position === "bottom" ? "w-full h-full" : "w-80 h-full";

  return (
    <div
      className={cn(
        sizeClass,
        borderClass,
        "border-border/50 flex flex-col bg-background/95 backdrop-blur-sm z-50",
      )}
    >
      {/* Search and Header Area */}
      <div className="shrink-0 p-3 space-y-3 border-b border-border/50">
        <AgentSearch value={searchQuery} onChange={setSearchQuery} />
        
        <Button 
            className="w-full text-sm font-normal" 
            variant="outline"
            onClick={activeTab === 'agents' ? handleCreateAgent : () => {}}
            disabled={activeTab !== 'agents'}
        >
           <Plus className="mr-2 h-4 w-4" /> {activeTab === 'agents' ? 'New Agent' : 'Install Skill'}
        </Button>
      </div>

      <div className="flex border-b border-border/50">
        <button 
          onClick={() => setActiveTab('agents')}
          className={cn(
            "flex-1 py-2 text-xs font-medium text-center uppercase tracking-wider hover:bg-muted/50 transition-colors",
            activeTab === 'agents' ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
          )}
        >
          Agents
        </button>
        <button 
          onClick={() => setActiveTab('my-skills')}
          className={cn(
            "flex-1 py-2 text-xs font-medium text-center uppercase tracking-wider hover:bg-muted/50 transition-colors",
            activeTab === 'my-skills' ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
          )}
        >
          My Skills
        </button>
        <button 
          onClick={() => setActiveTab('skill-store')}
          className={cn(
            "flex-1 py-2 text-xs font-medium text-center uppercase tracking-wider hover:bg-muted/50 transition-colors",
            activeTab === 'skill-store' ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
          )}
        >
          Store
        </button>
      </div>

      <div className="px-3 pt-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider flex justify-between items-center">
        <span>{activeTab === 'agents' ? 'My Agents' : 'ClawdHub'}</span>
        {activeTab === 'agents' && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{sortedAgents.length}</span>}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'agents' ? (
        <ScrollArea className="h-full">
          <div className="pb-4">
            {sortedAgents.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No agents found. Create one to get started.
              </div>
            ) : (
                sortedAgents.map((agent) => {
                const state = agentStates.find((s) => s.id === agent.id);
                const isExpanded = expandedAgents.has(agent.id);

                return (
                  <div key={agent.id} onClick={() => handleSelectAgent(agent.id)}>
                      <AgentCard
                        agent={agent}
                        state={state}
                        isExpanded={isExpanded}
                        isSelected={selectedAgentId === agent.id}
                        onToggleExpand={(e) => { e?.stopPropagation(); toggleExpanded(agent.id); }}
                        onToggleEnabled={() => toggleAgent(agent.id)}
                        onStart={() => startAgent(agent.id)}
                        onStop={() => stopAgent(agent.id)}
                        onPause={() => pauseAgent(agent.id)}
                        onResume={() => resumeAgent(agent.id)}
                        onClear={() => clearAgentState(agent.id)}
                        onDelete={() => {
                            console.log('Delete requested for:', agent.id);
                            if (confirm(`Are you sure you want to delete agent "${agent.name}"?`)) {
                                console.log('Delete confirmed for:', agent.id);
                                deleteAgent(agent.id);
                            }
                        }}
                      />
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
        ) : activeTab === 'my-skills' ? (
          <SkillBrowser key="installed" viewMode="installed" />
        ) : (
          <SkillBrowser key="available" viewMode="available" />
        )}
      </div>
    </div>
  );
};
