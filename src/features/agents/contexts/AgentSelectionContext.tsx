import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { agentService } from '../services/agentService';
import { AgentConfig } from '../types';

interface AgentSelectionContextType {
  selectedAgentId: string | null;
  selectAgent: (id: string | null) => void;
  createAndSelectAgent: (name?: string) => Promise<string>;
  deleteAgent: (id: string) => void;
}

const AgentSelectionContext = createContext<AgentSelectionContextType | undefined>(undefined);

export const AgentSelectionProvider = ({ children }: { children: ReactNode }) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  
  // We use agentService directly here to avoid circular dependency issues if we were to use the hook
  // But for creating we might need it. Actually, agentService is a singleton service, so we can use it directly.

  const selectAgent = useCallback((id: string | null) => {
    setSelectedAgentId(id);
    // Persist to local storage if needed?
    if (id) {
        localStorage.setItem('selected-agent-id', id);
    } else {
        localStorage.removeItem('selected-agent-id');
    }
  }, []);

  const createAndSelectAgent = useCallback(async (name: string = "New Task Agent") => {
    // Generate a unique ID
    const newAgentId = `agent-${Date.now()}`;
    
    const newAgent: AgentConfig = {
        id: newAgentId,
        type: 'task-agent',
        name: name,
        description: 'New AI Agent',
        enabled: true,
        autoStart: false,
    };
    
    console.log('[AgentSelectionContext] Creating new agent:', newAgent);
    agentService.addAgent(newAgent); 
    
    selectAgent(newAgentId);
    return newAgentId;
  }, [selectAgent]);

  const deleteAgent = useCallback((id: string) => {
    console.log('Context: deleting agent', id);
    agentService.deleteAgent(id);
    if (selectedAgentId === id) {
        selectAgent(null);
    }
  }, [selectedAgentId, selectAgent]);

  // Load initial state
  React.useEffect(() => {
    const saved = localStorage.getItem('selected-agent-id');
    if (saved) {
        setSelectedAgentId(saved);
    }
  }, []);

  return (
    <AgentSelectionContext.Provider value={{ selectedAgentId, selectAgent, createAndSelectAgent, deleteAgent }}>
      {children}
    </AgentSelectionContext.Provider>
  );
};

export const useAgentSelection = () => {
  const context = useContext(AgentSelectionContext);
  if (context === undefined) {
    throw new Error('useAgentSelection must be used within an AgentSelectionProvider');
  }
  return context;
};
