/**
 * File: src/features/ai-assistant/components/AgentTools.tsx
 *
 * Frontend: Component for displaying agent tools as selectable options in AI Assistant.
 * Allows users to quickly start agents directly from the AI Assistant interface.
 */

import { useState, useEffect } from "react";
import { Sparkles, Play, Loader2, Settings2, CalendarClock, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { agentService } from "../../agents/services/agentService";
import { getAgentMetadata } from "../../agents/agentRegistry";
import type { AgentConfig, AgentState } from "../../agents/types";
import { AgentAutonomySettings } from "../../agents/components/AgentAutonomySettings";
import { cn } from "@/lib/utils";

interface AgentToolsProps {
  currentDirectory?: string;
  onAgentStart?: (agentId: string, agentName: string) => void;
}

export const AgentTools = ({
  currentDirectory,
  onAgentStart,
}: AgentToolsProps) => {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentStates, setAgentStates] = useState<AgentState[]>([]);
  const [startingAgent, setStartingAgent] = useState<string | null>(null);
  const [settingsOpenFor, setSettingsOpenFor] = useState<string | null>(null);

  // Subscribe to agent service updates
  useEffect(() => {
    // Load initial agents
    setAgents(agentService.getAgents());
    setAgentStates(agentService.getAgentStates());

    // Subscribe to updates
    const unsubscribe = agentService.subscribe(
      (updatedAgents, updatedStates) => {
        setAgents(updatedAgents);
        setAgentStates(updatedStates);
      },
    );

    return unsubscribe;
  }, []);

  /**
   * Handles starting an agent when clicked.
   * Configures the agent with current directory if needed, then starts it.
   */
  const handleStartAgent = async (agent: AgentConfig) => {
    try {
      setStartingAgent(agent.id);

      // Check if agent needs configuration
      const needsConfig =
        (agent.type === "file-organizer" ||
          agent.type === "duplicate-finder" ||
          agent.type === "file-analyzer") &&
        !agent.params?.targetDirectory;

      // Configure agent with current directory if available and needed
      if (needsConfig && currentDirectory) {
        agentService.updateAgent(agent.id, {
          params: {
            ...agent.params,
            targetDirectory: currentDirectory,
          },
        });
      }

      // Enable agent if not enabled
      if (!agent.enabled) {
        agentService.updateAgent(agent.id, { enabled: true });
      }

      // Start the agent
      await agentService.startAgent(agent.id);

      // Notify parent component
      if (onAgentStart) {
        onAgentStart(agent.id, agent.name);
      }
    } catch (error: any) {
      console.error(`Failed to start agent ${agent.name}:`, error);
      alert(
        `Failed to start ${agent.name}: ${error.message || "Unknown error"}`,
      );
    } finally {
      setStartingAgent(null);
    }
  };

  /**
   * Gets the status badge for an agent.
   */
  const getStatusBadge = (agentId: string) => {
    const state = agentStates.find((s) => s.id === agentId);
    if (!state) return null;

    switch (state.status) {
      case "running":
        return (
          <Badge
            variant="outline"
            className="bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs"
          >
            Running
          </Badge>
        );
      case "paused":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-xs"
          >
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs"
          >
            Completed
          </Badge>
        );
      case "error":
        return (
          <Badge
            variant="outline"
            className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs"
          >
            Error
          </Badge>
        );
      default:
        return null;
    }
  };

  if (agents.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/30">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Agent Tools
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => {
          const metadata = getAgentMetadata(agent.type);
          const Icon = metadata.icon;
          const state = agentStates.find((s) => s.id === agent.id);
          const isStarting = startingAgent === agent.id;
          const isRunning =
            state?.status === "running" || state?.status === "paused";

          const scheduleLabel = agent.schedule?.enabled
            ? agent.schedule.frequency === "on-change"
              ? "On file change"
              : agent.schedule.frequency === "hourly"
                ? "Hourly"
                : `${agent.schedule.frequency[0].toUpperCase()}${agent.schedule.frequency.slice(1)} ${agent.schedule.time || "09:00"}`
            : null;
          const pending = state?.status === "completed" ? state.results?.pendingChanges : 0;

          return (
            <div key={agent.id} className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStartAgent(agent)}
              disabled={isStarting || isRunning}
              className={cn(
                "h-auto py-3 px-4 flex flex-col items-start gap-2 text-left relative",
                "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all",
                "hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm",
                isRunning &&
                  "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20",
                isStarting && "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="flex items-start justify-between w-full gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={cn("p-1.5 rounded shrink-0", metadata.bgColor)}
                  >
                    <Icon className={cn("h-4 w-4", metadata.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {agent.name}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {agent.description}
                    </div>
                  </div>
                </div>
                {getStatusBadge(agent.id)}
              </div>

              {/* Progress indicator for running agents */}
              {state?.status === "running" && state.progress && (
                <div className="w-full mt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="truncate">{state.progress.stage}</span>
                    <span className="ml-2 shrink-0">
                      {state.progress.percentage}%
                    </span>
                  </div>
                  <Progress
                    value={state.progress.percentage}
                    className="h-1.5"
                  />
                </div>
              )}

              {/* Starting indicator */}
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 rounded">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              )}

              {/* Action indicator */}
              {!isStarting && !isRunning && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Play className="h-3 w-3" />
                  <span>Click to start</span>
                </div>
              )}
            </Button>
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setSettingsOpenFor(settingsOpenFor === agent.id ? null : agent.id)}
              >
                <Settings2 className="h-3 w-3" />
                Schedule & approval
              </button>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {scheduleLabel && (
                  <span className="flex items-center gap-0.5" title="Runs on its own">
                    <CalendarClock className="h-3 w-3" /> {scheduleLabel}
                  </span>
                )}
                {pending ? (
                  <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400" title="Waiting in the Approval Inbox (Agents panel)">
                    <Inbox className="h-3 w-3" /> {pending} to review
                  </span>
                ) : null}
              </div>
            </div>
            {settingsOpenFor === agent.id && (
              <AgentAutonomySettings
                agent={agent}
                onUpdate={(updates) => agentService.updateAgent(agent.id, updates)}
              />
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
