/**
 * File: src/features/agents/hooks/useAgentManager.ts
 * 
 * Hook for managing agents - starting, stopping, and tracking their progress.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AgentConfig, AgentState, AgentStatus, AgentType, AgentLog } from '../types';
import { agentService } from '../services/agentService';

/**
 * Agent manager hook.
 */
export const useAgentManager = () => {
  // Initialize state from agent service
  const [agents, setAgents] = useState<AgentConfig[]>(() => agentService.getAgents());
  const [agentStates, setAgentStates] = useState<AgentState[]>(() => agentService.getAgentStates());

  // Subscribe to agent service updates
  useEffect(() => {
    const unsubscribe = agentService.subscribe((updatedAgents, updatedStates) => {
      setAgents(updatedAgents);
      setAgentStates(updatedStates);
    });

    return unsubscribe;
  }, []);

  /**
   * Updates an agent configuration.
   */
  const updateAgent = useCallback((id: string, updates: Partial<AgentConfig>) => {
    agentService.updateAgent(id, updates);
  }, []);

  /**
   * Toggles an agent on/off.
   */
  const toggleAgent = useCallback((id: string) => {
    agentService.toggleAgent(id);
  }, []);

  /**
   * Starts an agent.
   * Uses real agent executors to perform actual file operations.
   */
  const startAgent = useCallback(async (id: string) => {
    await agentService.startAgent(id);
  }, []);

  /**
   * Stops an agent.
   */
  const stopAgent = useCallback((id: string) => {
    agentService.stopAgent(id);
  }, []);

  /**
   * Pauses an agent.
   * Note: Actual pause implementation depends on agent executor support.
   */
  const pauseAgent = useCallback((id: string) => {
    agentService.pauseAgent(id);
  }, []);

  /**
   * Resumes a paused agent.
   */
  const resumeAgent = useCallback((id: string) => {
    agentService.resumeAgent(id);
  }, []);

  /**
   * Clears agent state (removes completed/stopped agent state).
   */
  const clearAgentState = useCallback((id: string) => {
    // Note: This would need to be added to agentService if needed
    // For now, we'll just update local state
    setAgentStates(prev => prev.filter(state => state.id !== id));
  }, []);

  /**
   * Gets agent state.
   */
  const getAgentState = useCallback((id: string): AgentState | undefined => {
    return agentStates.find(state => state.id === id);
  }, [agentStates]);

  /**
   * Gets all active agents (enabled and running).
   */
  const getActiveAgents = useCallback(() => {
    return agents.filter(agent => agent.enabled);
  }, [agents]);

  /**
   * Gets all running agents.
   */
  const getRunningAgents = useCallback(() => {
    return agentService.getRunningAgents();
  }, []);

  return {
    agents,
    agentStates,
    updateAgent,
    toggleAgent,
    startAgent,
    stopAgent,
    pauseAgent,
    resumeAgent,
    clearAgentState,
    getAgentState,
    getActiveAgents,
    getRunningAgents,
  };
};
