/**
 * File: src/features/agents/components/AgentSidebar.tsx
 * 
 * Frontend: Enhanced Agent Sidebar component with improved UI/UX
 * - Smooth animations and transitions
 * - Keyboard shortcuts support
 * - Filter and sort options
 * - Better visual hierarchy
 * - Agent statistics overview
 * - Improved empty states
 * - Confirmation dialogs
 * - Minimize/maximize support
 */

import { useState, useMemo, useEffect } from "react";
import { 
  Plus, 
  X, 
  Filter, 
  ArrowUpDown, 
  BarChart3,
  Bot,
  Sparkles,
  Store,
  Minus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentManager } from "../hooks/useAgentManager";
import { AgentCard } from "./AgentCard";
import { AgentSearch } from "./AgentSearch";
import { useAgentSelection } from "../contexts/AgentSelectionContext";
import { SkillBrowser } from "./SkillBrowser";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentDeleteDialog } from "./AgentDeleteDialog";

interface AgentSidebarProps {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Callback to close/hide the sidebar */
  onClose: () => void;
  /** Position of the sidebar */
  position?: "left" | "right" | "bottom";
  /** Whether the sidebar is minimized */
  isMinimized?: boolean;
  /** Callback to toggle minimize state */
  onToggleMinimize?: () => void;
}

type Tab = 'agents' | 'my-skills' | 'skill-store';
type SortOption = 'name' | 'status' | 'date' | 'running-first';
type FilterOption = 'all' | 'running' | 'paused' | 'completed' | 'error' | 'idle';

export const AgentSidebar = ({
  isOpen,
  onClose,
  position = "right",
  isMinimized,
  onToggleMinimize,
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
  const [sortOption, setSortOption] = useState<SortOption>('running-first');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [showStats, setShowStats] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || activeTab !== 'agents') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: Create new agent
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateAgent();
      }
      // Escape: Close sidebar
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab]);

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

  // Calculate statistics
  const stats = useMemo(() => {
    const taskAgents = agents.filter(a => a.type === 'task-agent');
    const running = agentStates.filter(s => s.status === 'running').length;
    const paused = agentStates.filter(s => s.status === 'paused').length;
    const completed = agentStates.filter(s => s.status === 'completed').length;
    const error = agentStates.filter(s => s.status === 'error').length;
    const idle = taskAgents.length - running - paused - completed - error;

    return {
      total: taskAgents.length,
      running,
      paused,
      completed,
      error,
      idle,
    };
  }, [agents, agentStates]);

  const filteredAgents = useMemo(() => {
    // Filter out tool agents, only show "task-agent" type or any future AI types
    const notebookAgents = agents.filter(a => a.type === 'task-agent');

    // Apply search filter
    let filtered = notebookAgents;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (agent) => 
          agent.name.toLowerCase().includes(query) || 
          agent.description.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterOption !== 'all') {
      filtered = filtered.filter((agent) => {
        const state = agentStates.find(s => s.id === agent.id);
        return state?.status === filterOption;
      });
    }

    return filtered;
  }, [agents, searchQuery, filterOption, agentStates]);

  // Sort agents
  const sortedAgents = useMemo(() => {
    return [...filteredAgents].sort((a, b) => {
      const aState = agentStates.find(s => s.id === a.id);
      const bState = agentStates.find(s => s.id === b.id);
      
      switch (sortOption) {
        case 'running-first':
          const aRunning = aState?.status === 'running' ? 1 : 0;
          const bRunning = bState?.status === 'running' ? 1 : 0;
          if (aRunning !== bRunning) return bRunning - aRunning;
          return a.name.localeCompare(b.name);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          const aStatus = aState?.status || 'idle';
          const bStatus = bState?.status || 'idle';
          return aStatus.localeCompare(bStatus);
        case 'date':
          const aDate = aState?.startedAt ? new Date(aState.startedAt).getTime() : 0;
          const bDate = bState?.startedAt ? new Date(bState.startedAt).getTime() : 0;
          return bDate - aDate;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [filteredAgents, agentStates, sortOption]);

  const handleDeleteClick = (agentId: string, agentName: string) => {
    setAgentToDelete({ id: agentId, name: agentName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (agentToDelete) {
      deleteAgent(agentToDelete.id);
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  };

  if (!isOpen) return null;

  const borderClass =
    position === "left"
      ? "border-r"
      : position === "bottom"
        ? "border-t"
        : "border-l";

  const sizeClass = position === "bottom" ? "w-full h-full" : "w-full h-full";

  // Get the appropriate expand icon based on position
  const getExpandIcon = () => {
    switch (position) {
      case "left": return <ChevronRight className="h-4 w-4" />;
      case "right": return <ChevronLeft className="h-4 w-4" />;
      case "bottom": return <ChevronUp className="h-4 w-4" />;
      default: return <ChevronLeft className="h-4 w-4" />;
    }
  };

  // Minimized state - show compact view with expand button
  if (isMinimized) {
    const runningCount = agentStates.filter(s => s.status === 'running').length;
    
    return (
      <div className={cn(
        sizeClass,
        borderClass,
        "border-border/50 flex flex-col bg-background/95 backdrop-blur-sm z-50",
      )}>
        <div className="flex-1 flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMinimize}
            className="flex items-center gap-2"
            title="Expand Agent Sidebar"
          >
            {getExpandIcon()}
            <Bot className="h-5 w-5 text-primary" />
            {runningCount > 0 && (
              <Badge variant="default" className="bg-blue-500 text-[10px] px-1.5 py-0">
                {runningCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: position === 'left' ? -20 : position === 'right' ? 20 : 0, y: position === 'bottom' ? 20 : 0 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: position === 'left' ? -20 : position === 'right' ? 20 : 0, y: position === 'bottom' ? 20 : 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          sizeClass,
          borderClass,
          "border-border/50 flex flex-col bg-background/95 backdrop-blur-sm z-50 shadow-lg",
        )}
      >
        {/* Header with Close Button */}
        <div className="shrink-0 p-3 border-b border-border/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">Agents</h2>
            {activeTab === 'agents' && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {stats.total}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onToggleMinimize && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onToggleMinimize}
                title="Minimize sidebar"
              >
                <Minus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search and Create Button */}
        {activeTab === 'agents' && (
          <div className="shrink-0 p-3 space-y-3 border-b border-border/50">
            <AgentSearch value={searchQuery} onChange={setSearchQuery} />
            
            <div className="flex gap-2">
              <Button 
                className="flex-1 text-sm font-normal" 
                variant="outline"
                onClick={handleCreateAgent}
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" /> New Agent
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setShowStats(!showStats)}
                title="Toggle statistics"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>

            {/* Statistics Panel */}
            <AnimatePresence>
              {showStats && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Running:</span>
                      <Badge variant="default" className="bg-blue-500">{stats.running}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Paused:</span>
                      <Badge variant="secondary">{stats.paused}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Completed:</span>
                      <Badge variant="secondary" className="bg-green-500">{stats.completed}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Errors:</span>
                      <Badge variant="destructive">{stats.error}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Idle:</span>
                      <Badge variant="outline">{stats.idle}</Badge>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filter and Sort Controls */}
            <div className="flex gap-2">
              <Select value={filterOption} onValueChange={(value) => setFilterOption(value as FilterOption)}>
                <SelectTrigger size="sm" className="flex-1 h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                <SelectTrigger size="sm" className="flex-1 h-8 text-xs">
                  <ArrowUpDown className="h-3 w-3 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="running-first">Running First</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          <button 
            onClick={() => setActiveTab('agents')}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium text-center uppercase tracking-wider hover:bg-muted/50 transition-colors relative",
              activeTab === 'agents' ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Bot className="h-3.5 w-3.5 mx-auto mb-1" />
            Agents
            {activeTab === 'agents' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('my-skills')}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium text-center uppercase tracking-wider hover:bg-muted/50 transition-colors relative",
              activeTab === 'my-skills' ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 mx-auto mb-1" />
            My Skills
            {activeTab === 'my-skills' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('skill-store')}
            className={cn(
              "flex-1 py-2.5 text-xs font-medium text-center uppercase tracking-wider hover:bg-muted/50 transition-colors relative",
              activeTab === 'skill-store' ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Store className="h-3.5 w-3.5 mx-auto mb-1" />
            Store
            {activeTab === 'skill-store' && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'agents' ? (
              <motion.div
                key="agents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <ScrollArea className="h-full">
                  <div className="pb-4">
                    {sortedAgents.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-8 text-center space-y-3"
                      >
                        <Bot className="h-12 w-12 mx-auto text-muted-foreground/30" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">No agents found</p>
                          <p className="text-xs text-muted-foreground">
                            {searchQuery || filterOption !== 'all' 
                              ? "Try adjusting your search or filter"
                              : "Create your first agent to get started"}
                          </p>
                        </div>
                        {!searchQuery && filterOption === 'all' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleCreateAgent}
                            className="mt-2"
                          >
                            <Plus className="mr-2 h-4 w-4" /> Create Agent
                          </Button>
                        )}
                      </motion.div>
                    ) : (
                      sortedAgents.map((agent) => {
                        const state = agentStates.find((s) => s.id === agent.id);
                        const isExpanded = expandedAgents.has(agent.id);

                        return (
                          <motion.div
                            key={agent.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            onClick={() => handleSelectAgent(agent.id)}
                          >
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
                              onDelete={() => handleDeleteClick(agent.id, agent.name)}
                            />
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
            ) : activeTab === 'my-skills' ? (
              <motion.div
                key="my-skills"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <SkillBrowser key="installed" viewMode="installed" />
              </motion.div>
            ) : (
              <motion.div
                key="skill-store"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <SkillBrowser key="available" viewMode="available" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      {agentToDelete && (
        <AgentDeleteDialog
          isOpen={deleteDialogOpen}
          agentName={agentToDelete.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteDialogOpen(false);
            setAgentToDelete(null);
          }}
        />
      )}
    </>
  );
};
