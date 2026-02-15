import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAgentSelection } from '../../agents/contexts/AgentSelectionContext';
import { ChatMessageType, FileOperation, AISettings } from '../../ai-assistant/types';
import { useAIFileAssistant } from '../../ai-assistant/hooks/useAIFileAssistant';
import { homeDir } from '@tauri-apps/api/path';

// Define the shape of a single chat session
export interface ChatSession {
  agentId: string;
  messages: ChatMessageType[];
  currentDirectory: string;
  isProcessing: boolean;
  inputValue: string;
  currentToolExecutions?: any[];
  currentReasoningSteps?: any[];
  // Metadata for the session
  lastActive: number;
}

interface ChatContextType {
  // State
  sessions: Record<string, ChatSession>;
  activeSession: ChatSession | undefined;
  activeAgentId: string | null;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  addMessage: (agentId: string, message: ChatMessageType) => void;
  setInputValue: (value: string) => void;
  setDirectory: (directory: string) => void;
  clearHistory: () => void;
  deleteMessage: (agentId: string, messageId: string) => void;
  
  // Helper to get a specific session
  getSession: (agentId: string) => ChatSession | undefined;

  // Settings
  settings: AISettings;
  updateSettings: (updates: Partial<AISettings>) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { selectedAgentId } = useAgentSelection();
  
  // Main state store for all sessions
  const [sessions, setSessions] = useState<Record<string, ChatSession>>(() => {
    try {
      const saved = localStorage.getItem('chat-sessions');
      if (saved) {
        // Parse and revive dates
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(key => {
          if (parsed[key].messages) {
            parsed[key].messages = parsed[key].messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
          }
        });
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load chat sessions', e);
    }
    return {};
  });

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem('chat-sessions', JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save chat sessions', e);
    }
  }, [sessions]);

  // Ensure active session exists
  useEffect(() => {
    if (selectedAgentId && !sessions[selectedAgentId]) {
      // Create new session with home directory as default
      const createSession = async () => {
        let defaultDirectory = '';
        try {
          defaultDirectory = await homeDir();
        } catch (e) {
          console.error('Failed to get home directory for new session:', e);
        }

        setSessions(prev => {
          // Double-check session doesn't exist (race condition protection)
          if (prev[selectedAgentId]) return prev;

          return {
            ...prev,
            [selectedAgentId]: {
              agentId: selectedAgentId,
              messages: [{
                id: 'welcome',
                role: 'assistant',
                content: 'Hi! I am your AI assistant. How can I help you with this task?',
                timestamp: new Date()
              }],
              currentDirectory: defaultDirectory,
              isProcessing: false,
              inputValue: '',
              currentToolExecutions: [],
              currentReasoningSteps: [],
              lastActive: Date.now()
            }
          };
        });
      };
      createSession();
    }
  }, [selectedAgentId, sessions]);

  const activeSession = selectedAgentId ? sessions[selectedAgentId] : undefined;

  // We need `useAIFileAssistant` to actually process messages. 
  // However, that hook requires `currentDirectory`.
  // We'll trust the hook acts efficiently or we might need to restructure if we want 
  // centralized processing logic inside the context.
  // Ideally, the Context just holds state, and the UI component (AIFileAssistantSession) 
  // calls the processing hook. BUT, if we want ChatPanel to work *independently*,
  // the processing logic needs to be reachable from here or shared.
  
  // For this refactor, we will keep the processing logic in the Context to ensure
  // ChatPanel can trigger it. 
  
  const { 
    processUserCommand,
    settings,
    updateSettings
  } = useAIFileAssistant(activeSession?.currentDirectory || '');
  const aiReasoningLive = settings.reasoningLive !== false;

  // Ref to track last sent message to prevent duplicates
  const lastSentMessageRef = useRef<{ text: string; timestamp: number; agentId: string } | null>(null);

  const setInputValue = useCallback((value: string) => {
    if (!selectedAgentId) return;
    setSessions(prev => ({
      ...prev,
      [selectedAgentId]: {
        ...prev[selectedAgentId],
        inputValue: value
      }
    }));
  }, [selectedAgentId]);

  const setDirectory = useCallback((directory: string) => {
    if (!selectedAgentId) return;
    setSessions(prev => ({
      ...prev,
      [selectedAgentId]: {
        ...prev[selectedAgentId],
        currentDirectory: directory
      }
    }));
    if (directory) {
      try {
        localStorage.setItem('ai-assistant-current-directory', directory);
      } catch (e) {
        console.warn('Failed to persist current directory', e);
      }
    }
  }, [selectedAgentId]);

  const addMessage = useCallback((agentId: string, message: ChatMessageType) => {
    setSessions(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        messages: [...prev[agentId].messages, message]
      }
    }));
  }, []);

  const deleteMessage = useCallback((agentId: string, messageId: string) => {
    setSessions(prev => {
      const session = prev[agentId];
      if (!session) return prev;

      const msgIndex = session.messages.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return prev;

      const newMessages = [...session.messages];
      const targetMsg = newMessages[msgIndex];

      // Remove the target message
      newMessages.splice(msgIndex, 1);

      // logic: if we deleted a USER message, and the NEXT message (now at msgIndex) is an ASSISTANT message, delete that too.
      // because "Undo" implies reverting the interaction.
      let newInputValue = session.inputValue;
      if (targetMsg.role === 'user') {
         // Populate input with deleted message content so user can edit it
         newInputValue = targetMsg.content;
         
         if (newMessages.length > msgIndex) {
             if (newMessages[msgIndex].role === 'assistant') {
                 newMessages.splice(msgIndex, 1);
             }
         }
      }

      return {
        ...prev,
        [agentId]: {
          ...session,
          messages: newMessages,
          inputValue: newInputValue
        }
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    if (!selectedAgentId) return;
    setSessions(prev => ({
      ...prev,
      [selectedAgentId]: {
        ...prev[selectedAgentId],
        messages: [{
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Chat history cleared.',
          timestamp: new Date()
        }]
      }
    }));
  }, [selectedAgentId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!selectedAgentId || !content.trim()) return;
    
    const agentId = selectedAgentId; // Capture for closure
    const trimmedContent = content.trim();
    
    // Prevent duplicate sends within 3 seconds for the same agent
    const now = Date.now();
    if (lastSentMessageRef.current) {
      const timeSinceLastSend = now - lastSentMessageRef.current.timestamp;
      if (
        lastSentMessageRef.current.agentId === agentId &&
        timeSinceLastSend < 3000 &&
        lastSentMessageRef.current.text === trimmedContent
      ) {
        console.log('[ChatContext] Duplicate message prevented:', trimmedContent);
        return;
      }
    }
    
    // Check if already processing for this agent
    if (sessions[agentId]?.isProcessing) {
      console.log('[ChatContext] Already processing a message for this agent, ignoring duplicate');
      return;
    }
    
    // Record this send
    lastSentMessageRef.current = {
      text: trimmedContent,
      timestamp: now,
      agentId
    };
    
    // 1. Add User Message
    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedContent,
      timestamp: new Date()
    };
    addMessage(agentId, userMsg);
    setInputValue('');
    
    // Set processing state
    setSessions(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], isProcessing: true }
    }));
    setSessions(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        currentToolExecutions: [],
        currentReasoningSteps: []
      }
    }));

    try {
      // 2. Process with AI
      // Note: In a real app, we might need AbortController here too
      // We are essentially duplicating the logic from AIFileAssistantSession here
      // but simplifying it for the centralized context.
      
      // Get history for context
      const history = sessions[agentId]?.messages.map(m => ({ 
        role: m.role, 
        content: m.content 
      })) || [];

      const response = await processUserCommand(
        trimmedContent,
        null,
        undefined,
        history,
        undefined,
        {
          onToolExecutions: (tools) => {
            setSessions(prev => ({
              ...prev,
              [agentId]: {
                ...prev[agentId],
                currentToolExecutions: tools
              }
            }));
          },
          onReasoningSteps: aiReasoningLive
            ? (steps) => {
                setSessions(prev => ({
                  ...prev,
                  [agentId]: {
                    ...prev[agentId],
                    currentReasoningSteps: steps
                  }
                }));
              }
            : undefined
        }
      );
      
      // 3. Add Assistant Message
      const aiMsg: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: response.metadata
      };
      addMessage(agentId, aiMsg);

    } catch (error: any) {
      console.error('Chat processing error:', error);
      const errorMsg: ChatMessageType = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong'}`,
        timestamp: new Date(),
        metadata: { isError: true }
      };
      addMessage(agentId, errorMsg);
    } finally {
      setSessions(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          isProcessing: false,
          currentToolExecutions: prev[agentId]?.currentToolExecutions || [],
          currentReasoningSteps: prev[agentId]?.currentReasoningSteps || []
        }
      }));
    }
  }, [selectedAgentId, sessions, processUserCommand, addMessage, setInputValue]);

  const value = {
    sessions,
    activeSession,
    activeAgentId: selectedAgentId,
    sendMessage,
    addMessage,
    setInputValue,
    setDirectory,
    clearHistory,
    deleteMessage,
    getSession: (id: string) => sessions[id],
    settings,
    updateSettings
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
