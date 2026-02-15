/**
 * File: src/features/agents/services/agentService.ts
 * 
 * Agent service that provides programmatic access to agent management.
 * This service can be used by both React components and AI Assistant tools.
 */

import type { AgentConfig, AgentState, AgentLog } from '../types';
import { DEFAULT_AGENTS } from '../agentRegistry';
import { getAgentExecutor } from '../utils/agentExecutors';
import type { AgentExecutionContext } from '../utils/agentExecutors';

/**
 * Global agent storage (simplified for service layer).
 * In a real implementation, this would be managed by a state management system.
 */
class AgentService {
  private agents: Map<string, AgentConfig> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  private agentStopFlags: Map<string, boolean> = new Map();
  private agentPauseFlags: Map<string, boolean> = new Map();
  private agentExecutions: Map<string, Promise<void>> = new Map();
  private listeners: Set<(agents: AgentConfig[], states: AgentState[]) => void> = new Set();

  constructor() {
    // Initialize with default agents
    this.loadAgents();
  }

  /**
   * Loads agents from localStorage.
   */
  private loadAgents() {
    const saved = localStorage.getItem('filepro-agents');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.forEach((agent: AgentConfig) => {
          this.agents.set(agent.id, agent);
        });

        // Ensure new default agents are added
        this.ensureDefaultAgents();
      } catch {
        this.initializeDefaultAgents();
      }
    } else {
      this.initializeDefaultAgents();
    }
  }

  /**
   * Initializes default agents.
   */
  private initializeDefaultAgents() {
    DEFAULT_AGENTS.forEach((agent, index) => {
      const agentConfig: AgentConfig = {
        ...agent,
        id: `agent-${index}`,
      };
      this.agents.set(agentConfig.id, agentConfig);
    });
    this.saveAgents();
  }

  /**
   * Ensures all default agents exist in the list.
   */
  private ensureDefaultAgents() {
    let changed = false;

    DEFAULT_AGENTS.forEach((defaultAgent) => {
      // Check if an agent of this type already exists
      const exists = Array.from(this.agents.values()).some(a => a.type === defaultAgent.type);

      if (!exists) {
        // Add the missing agent
        const newId = `agent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newAgent: AgentConfig = {
          ...defaultAgent,
          id: newId,
        };
        this.agents.set(newId, newAgent);
        changed = true;
      }
    });

    if (changed) {
      this.saveAgents();
    }
  }

  /**
   * Saves agents to localStorage.
   */
  private saveAgents() {
    const agentsArray = Array.from(this.agents.values());
    localStorage.setItem('filepro-agents', JSON.stringify(agentsArray));
    this.notifyListeners();
  }

  /**
   * Notifies all listeners of state changes.
   */
  private notifyListeners() {
    const agents = Array.from(this.agents.values());
    const states = Array.from(this.agentStates.values());
    this.listeners.forEach(listener => listener(agents, states));
  }

  /**
   * Subscribes to agent state changes.
   */
  subscribe(listener: (agents: AgentConfig[], states: AgentState[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Gets all agents.
   */
  getAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  /**
   * Gets an agent by ID.
   */
  getAgent(id: string): AgentConfig | undefined {
    return this.agents.get(id);
  }

  /**
   * Gets agent state by ID.
   */
  getAgentState(id: string): AgentState | undefined {
    return this.agentStates.get(id);
  }

  /**
   * Gets all agent states.
   */
  getAgentStates(): AgentState[] {
    return Array.from(this.agentStates.values());
  }

  /**
   * Updates an agent configuration.
   */
  updateAgent(id: string, updates: Partial<AgentConfig>) {
    const agent = this.agents.get(id);
    if (!agent) return;

    const updated = { ...agent, ...updates };
    this.agents.set(id, updated);
    this.saveAgents();
  }

  /**
   * Adds a new agent.
   */
  addAgent(agent: AgentConfig) {
    this.agents.set(agent.id, agent);
    this.saveAgents();
  }

  /**
   * Deletes an agent.
   */
  deleteAgent(id: string) {
    console.log('AgentService: Deleting agent', id);
    // Stop if running
    this.stopAgent(id);

    // Remove from maps
    this.agents.delete(id);
    this.agentStates.delete(id);
    this.agentStopFlags.delete(id);
    this.agentPauseFlags.delete(id);

    // Save
    this.saveAgents();
  }

  /**
   * Starts an agent.
   */
  async startAgent(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (!agent || !agent.enabled) {
      throw new Error('Agent not found or not enabled');
    }

    // Check if already running
    const existingState = this.agentStates.get(id);
    if (existingState?.status === 'running') {
      return;
    }

    // Reset flags
    this.agentStopFlags.set(id, false);
    this.agentPauseFlags.set(id, false);

    // Initialize state
    const initialState: AgentState = {
      id,
      status: 'running',
      progress: {
        current: 0,
        total: 100,
        percentage: 0,
        stage: 'Initializing...',
      },
      startedAt: new Date(),
      logs: [],
    };

    this.agentStates.set(id, initialState);
    this.notifyListeners();

    // Create execution context
    const context: AgentExecutionContext = {
      onProgress: (progress: number, stage: string) => {
        const state = this.agentStates.get(id);
        if (!state) return;

        this.agentStates.set(id, {
          ...state,
          progress: {
            current: progress,
            total: 100,
            percentage: progress,
            stage,
          },
        });
        this.notifyListeners();
      },
      onLog: (log) => {
        const state = this.agentStates.get(id);
        if (!state) return;

        this.agentStates.set(id, {
          ...state,
          logs: [...state.logs, log].slice(-50),
        });
        this.notifyListeners();
      },
      onError: (error: string) => {
        const state = this.agentStates.get(id);
        if (!state) return;

        this.agentStates.set(id, {
          ...state,
          status: 'error',
          error,
          logs: [
            ...state.logs,
            {
              timestamp: new Date(),
              level: 'error',
              message: error,
            } as AgentLog,
          ].slice(-50),
        });
        this.notifyListeners();
      },
      shouldStop: () => this.agentStopFlags.get(id) === true,
      shouldPause: () => this.agentPauseFlags.get(id) === true,
    };

    // Execute agent
    const executionPromise = (async () => {
      try {
        const executor = getAgentExecutor(agent.type);
        const results = await executor(agent, context);

        if (this.agentStopFlags.get(id)) {
          const state = this.agentStates.get(id);
          if (state) {
            this.agentStates.set(id, {
              ...state,
              status: 'stopped',
              progress: { ...state.progress, stage: 'Stopped' },
            });
            this.notifyListeners();
          }
          return;
        }

        // Mark as completed
        const state = this.agentStates.get(id);
        if (state) {
          this.agentStates.set(id, {
            ...state,
            status: 'completed',
            progress: {
              current: 100,
              total: 100,
              percentage: 100,
              stage: 'Completed',
            },
            completedAt: new Date(),
            results,
            logs: [
              ...state.logs,
              {
                timestamp: new Date(),
                level: 'success',
                message: 'Agent completed successfully',
              } as AgentLog,
            ].slice(-50),
          });
          this.notifyListeners();
        }
      } catch (error: any) {
        const state = this.agentStates.get(id);
        if (state) {
          this.agentStates.set(id, {
            ...state,
            status: 'error',
            error: error.message || 'Agent execution failed',
            logs: [
              ...state.logs,
              {
                timestamp: new Date(),
                level: 'error',
                message: error.message || 'Agent execution failed',
              } as AgentLog,
            ].slice(-50),
          });
          this.notifyListeners();
        }
      } finally {
        this.agentExecutions.delete(id);
      }
    })();

    this.agentExecutions.set(id, executionPromise);
  }

  /**
   * Stops an agent.
   */
  stopAgent(id: string) {
    this.agentStopFlags.set(id, true);
    this.agentPauseFlags.set(id, false);

    const state = this.agentStates.get(id);
    if (state) {
      this.agentStates.set(id, {
        ...state,
        status: 'stopped',
        progress: {
          ...state.progress,
          stage: 'Stopped',
        },
        logs: [
          ...state.logs,
          {
            timestamp: new Date(),
            level: 'warning',
            message: 'Agent stopped by user',
          } as AgentLog,
        ].slice(-50),
      });
      this.notifyListeners();
    }
  }

  /**
   * Pauses an agent.
   */
  pauseAgent(id: string) {
    this.agentPauseFlags.set(id, true);

    const state = this.agentStates.get(id);
    if (state) {
      this.agentStates.set(id, {
        ...state,
        status: 'paused',
        progress: {
          ...state.progress,
          stage: 'Paused',
        },
        logs: [
          ...state.logs,
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Agent paused',
          } as AgentLog,
        ].slice(-50),
      });
      this.notifyListeners();
    }
  }

  /**
   * Resumes a paused agent.
   */
  resumeAgent(id: string) {
    this.agentPauseFlags.set(id, false);

    const state = this.agentStates.get(id);
    if (state && state.status === 'paused') {
      this.agentStates.set(id, {
        ...state,
        status: 'running',
        progress: {
          ...state.progress,
          stage: state.progress.stage || 'Resuming...',
        },
        logs: [
          ...state.logs,
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Agent resumed',
          } as AgentLog,
        ].slice(-50),
      });
      this.notifyListeners();
    }
  }

  /**
   * Clears an agent's execution state.
   * Removes stored state/logs and resets stop/pause flags.
   */
  clearAgentState(id: string) {
    this.agentStates.delete(id);
    this.agentStopFlags.delete(id);
    this.agentPauseFlags.delete(id);
    this.agentExecutions.delete(id);
    this.notifyListeners();
  }

  /**
   * Toggles an agent's enabled state.
   */
  toggleAgent(id: string) {
    const agent = this.agents.get(id);
    if (!agent) return;

    const newEnabled = !agent.enabled;
    if (!newEnabled) {
      this.stopAgent(id);
    }

    this.agents.set(id, { ...agent, enabled: newEnabled });
    this.saveAgents();
  }

  /**
   * Gets running agents.
   */
  getRunningAgents(): AgentState[] {
    return Array.from(this.agentStates.values()).filter(
      state => state.status === 'running' || state.status === 'paused'
    );
  }
}

/**
 * Singleton instance of the agent service.
 */
export const agentService = new AgentService();
