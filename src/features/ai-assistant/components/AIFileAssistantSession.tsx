/**
 * File: src/features/ai-assistant/components/AIFileAssistantSession.tsx
 * 
 * Individual AI File Assistant session component.
 * This is the refactored version of the original AIFileAssistant component.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Bot,
  FolderOpen,
  Settings,
  Sparkles,
  Loader2,
  Mic,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useAIFileAssistant } from "../hooks/useAIFileAssistant";
import { ChatMessage } from "./ChatMessage";
import { PreviewPanel } from "./PreviewPanel";
import { PreviewChanges } from "./PreviewChanges";
import { ToolUsageIndicator } from "./ToolUsageIndicator";
import { TaskProgressTracker } from "./TaskProgressTracker";
import { QuickActions } from "./QuickActions";
import { AgentTools } from "./AgentTools";
import { SettingsPanel } from "./SettingsPanel";
import { OperationStatus } from "./OperationStatus";
import { ChatInput } from "./ChatInput";
import { VoiceToTextPanel } from "./VoiceToTextPanel";
import { ReasoningChain } from "./ReasoningChain";
import { ClarificationPanel } from "../voice/components/ClarificationPanel";
import { ImplementationPlanView } from "../voice/components/ImplementationPlanView";
import { VoiceSettingsPanel } from "../voice/components/VoiceSettingsPanel";
import { ExecutionProgress } from "../voice/components/ExecutionProgress";
import { useVoiceOutput } from "../voice/hooks/useVoiceOutput";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useToolWidget } from "../hooks/useToolWidget";
import { extractWidgetFromMessage, updateWidgetFromNaturalLanguage } from "../utils/widgetExtractor";
import { agentService } from "../../agents/services/agentService";
import { findClawdBotPath } from "../utils/toolsRegistry";
import type { ChatMessageType, FileOperation, AISettings, AIProvider, ToolWidgetData } from "../types";
import type { VoiceSettings, ClarificationQuestion, ImplementationPlan } from "../voice/types";

interface AIFileAssistantSessionProps {
  sessionId: string;
  tabName: string;
  onRename?: (newName: string) => void;
  initialDirectory?: string;
  onDirectoryChange?: (directory: string) => void;
}

export const AIFileAssistantSession = ({
  sessionId,
  tabName,
  onRename,
  initialDirectory,
  onDirectoryChange,
}: AIFileAssistantSessionProps) => {
  // Load current directory from localStorage if available
  const [currentDirectory, setCurrentDirectory] = useState<string>(() => {
    if (initialDirectory) return initialDirectory;
    const saved = localStorage.getItem('ai-assistant-current-directory');
    return saved || '';
  });
  const [messages, setMessages] = useState<ChatMessageType[]>(() => {
    // Load messages for this session from localStorage
    try {
      const saved = localStorage.getItem(`ai-assistant-messages-${sessionId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hi! I can help you organize files, find duplicates, analyze directories, and more. What would you like to do?',
        timestamp: new Date(),
      },
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewOperation, setPreviewOperation] = useState<FileOperation | null>(null);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showVoiceToText, setShowVoiceToText] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [implementationPlan, setImplementationPlan] = useState<ImplementationPlan | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [voiceInputActive, setVoiceInputActive] = useState(false);
  const [currentReasoningSteps, setCurrentReasoningSteps] = useState<any[]>([]);
  const [currentToolExecutions, setCurrentToolExecutions] = useState<any[]>([]);
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);

  // Widget management
  const {
    widgets,
    createWidget,
    updateWidget,
    removeWidget,
    confirmWidget,
    navigateToTool,
    getWidgetsForMessage,
  } = useToolWidget({
    onNavigateToTool: (toolName, params) => {
      // Navigation is handled via sessionStorage and custom event
      console.log('Navigating to tool:', toolName, params);
    },
  });
  const voiceTranscriptHandlerRef = useRef<((text: string) => void) | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Save messages to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(`ai-assistant-messages-${sessionId}`, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }, [messages, sessionId]);

  // Update directory in parent when it changes (only when directory actually changes)
  const prevDirectoryRef = useRef<string>('');
  const onDirectoryChangeRef = useRef(onDirectoryChange);
  
  useEffect(() => {
    onDirectoryChangeRef.current = onDirectoryChange;
  }, [onDirectoryChange]);
  
  useEffect(() => {
    if (onDirectoryChangeRef.current && currentDirectory && currentDirectory !== prevDirectoryRef.current) {
      prevDirectoryRef.current = currentDirectory;
      onDirectoryChangeRef.current(currentDirectory);
    }
  }, [currentDirectory]);

  // Voice settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    const saved = localStorage.getItem('ai-assistant-voice-settings');
    return saved ? JSON.parse(saved) : {
      provider: 'browser-stt',
      activationMode: 'push-to-talk',
      voiceOutputEnabled: true,
      voiceSpeed: 1.0,
      volume: 85,
      updateFrequency: 'milestones',
      language: 'en-US',
      showTranscription: true,
      autoPunctuation: true,
      noiseCancellation: true,
      allowInterruptions: true,
    };
  });

  // Voice output hook
  const { speak, stopSpeaking, speakProgress } = useVoiceOutput(voiceSettings);

  const {
    settings,
    updateSettings,
    analyzeDirectory,
    organizeFiles,
    renameFiles,
    findDuplicates,
    generateWorkflow,
    executeOperation,
    processUserCommand: processCommandWithAI,
  } = useAIFileAssistant(currentDirectory);

  // Check Ollama connection when provider is Ollama
  const [ollamaConnectionStatus, setOllamaConnectionStatus] = useState<{
    checking: boolean;
    connected: boolean | null;
    error: string | null;
  }>({ checking: false, connected: null, error: null });

  // ClawdBot status
  const [clawdbotStatus, setClawdbotStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    error: string | null;
  }>({ checking: false, available: null, error: null });

  useEffect(() => {
    if (settings.provider === 'ollama') {
      // Check connection when provider changes to Ollama
      const checkConnection = async () => {
        setOllamaConnectionStatus({ checking: true, connected: null, error: null });
        try {
          const { checkOllamaConnection } = await import('../utils/ollamaService');
          const isConnected = await checkOllamaConnection(settings.ollamaBaseUrl || 'http://localhost:11434');
          setOllamaConnectionStatus({ 
            checking: false, 
            connected: isConnected, 
            error: isConnected ? null : 'Cannot connect to Ollama. Make sure Ollama is running.' 
          });
        } catch (error: any) {
          setOllamaConnectionStatus({ 
            checking: false, 
            connected: false, 
            error: error.message || 'Failed to check Ollama connection' 
          });
        }
      };
      
      checkConnection();
    } else {
      // Reset status when not using Ollama
      setOllamaConnectionStatus({ checking: false, connected: null, error: null });
    }
  }, [settings.provider, settings.ollamaBaseUrl]);

  // Check ClawdBot availability when enabled
  useEffect(() => {
    if (settings.clawdbotEnabled) {
      const checkClawdBot = async () => {
        setClawdbotStatus({ checking: true, available: null, error: null });
        try {
          // Use the helper function from toolsRegistry to find ClawdBot
          const clawdbotInfo = await findClawdBotPath();
          
          if (clawdbotInfo) {
            setClawdbotStatus({ 
              checking: false, 
              available: true, 
              error: null 
            });
          } else {
            setClawdbotStatus({ 
              checking: false, 
              available: false, 
              error: 'ClawdBot CLI not found. Make sure it is installed and in your PATH, or install it with: npm install -g clawdbot' 
            });
          }
        } catch (error: any) {
          setClawdbotStatus({ 
            checking: false, 
            available: false, 
            error: error.message || 'ClawdBot CLI not available' 
          });
        }
      };
      
      checkClawdBot();
    } else {
      setClawdbotStatus({ checking: false, available: null, error: null });
    }
  }, [settings.clawdbotEnabled]);

  // Voice input hook - will be initialized with a wrapper function
  // We'll update the handler after handleSendMessage is defined
  const voiceTranscriptWrapper = useCallback((text: string) => {
    if (voiceTranscriptHandlerRef.current) {
      voiceTranscriptHandlerRef.current(text);
    }
  }, []);

  const {
    isListening: voiceListening,
    transcribing: voiceTranscribing,
    toggleListening: toggleVoiceListening,
    isAvailable: voiceAvailable,
  } = useVoiceInput(voiceSettings, voiceTranscriptWrapper);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setCurrentDirectory(selected);
        // Store in localStorage for agents to use
        localStorage.setItem('ai-assistant-current-directory', selected);
        addMessage('assistant', `Working directory set to: ${selected}`);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      addMessage('assistant', 'Failed to select directory. Please try again.');
    }
  };

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, metadata?: any): ChatMessageType => {
    const newMessage: ChatMessageType = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      metadata,
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  // Save voice settings
  useEffect(() => {
    localStorage.setItem('ai-assistant-voice-settings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const userMessage = (messageText || inputValue).trim();
    if (!userMessage || isProcessing) return;

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setInputValue('');
    addMessage('user', userMessage);
    setIsProcessing(true);
    setActiveOperation('processing');
    setClarificationQuestions([]);
    setImplementationPlan(null);
    setAwaitingApproval(false);
    setCurrentReasoningSteps([]); // Reset reasoning steps
    setCurrentToolExecutions([]); // Reset tool executions
    setTaskStartTime(Date.now()); // Track task start time

    try {
      // First, try AI-powered processing if available
      let response: { content: string; metadata?: any; operation?: FileOperation };
      let directoryAnalysis: any = null;

      // Get directory analysis if needed for context
      const lowerCommand = userMessage.toLowerCase();
      if (currentDirectory && (lowerCommand.includes('analyze') || lowerCommand.includes('organize') || lowerCommand.includes('what'))) {
        try {
          directoryAnalysis = await analyzeDirectory(currentDirectory);
        } catch (error) {
          console.warn('Failed to get directory analysis:', error);
        }
      }

      // Try AI processing first - check based on provider
      const isAIConfigured = settings.provider === 'anthropic'
        ? !!settings.apiKey
        : settings.provider === 'ollama'; // Ollama doesn't need API key

      if (isAIConfigured) {
        try {
          // Build conversation history from previous messages (excluding the current one)
          const conversationHistory = messages
            .slice(0, -1) // Exclude the current message we just added
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
              role: msg.role,
              content: msg.content,
            }));
          
          // Pass abort signal and conversation history to the AI processing
          response = await processCommandWithAI(
            userMessage, 
            directoryAnalysis, 
            abortControllerRef.current?.signal,
            conversationHistory
          );
          
          // Check if Ollama connection failed
          if (settings.provider === 'ollama' && response.content?.includes('Cannot connect to Ollama')) {
            // Show connection error and suggest checking Ollama
            addMessage('assistant', 
              '⚠️ **Ollama Connection Issue**\n\n' +
              'I cannot connect to Ollama. Please check:\n\n' +
              '1. **Is Ollama running?** Make sure Ollama is installed and running on your system.\n' +
              '2. **Check the base URL:** Verify the Ollama base URL in settings (default: http://localhost:11434)\n' +
              '3. **Check the model:** Ensure the selected model (e.g., ' + settings.model + ') is available in Ollama\n\n' +
              'You can test the connection in Settings → Test Connection.\n\n' +
              'For now, I\'ll use rule-based processing.',
              { isError: true }
            );
            // Fall back to rule-based
            response = await processUserCommandFallback(userMessage);
          }
          
          // Check if model doesn't support tools
          if (settings.provider === 'ollama' && response.metadata?.errorType === 'model_tools_not_supported') {
            // Don't fall back - show the helpful error message
            // The error message already contains recommendations
          }
        } catch (error: any) {
          console.warn('AI processing failed:', error);
          
          // Provide helpful error message for Ollama
          if (settings.provider === 'ollama') {
            const errorMessage = error.message || 'Unknown error';
            if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED')) {
              addMessage('assistant', 
                '⚠️ **Ollama Connection Failed**\n\n' +
                'Cannot connect to Ollama at ' + (settings.ollamaBaseUrl || 'http://localhost:11434') + '\n\n' +
                '**Troubleshooting steps:**\n' +
                '1. Make sure Ollama is installed and running\n' +
                '2. Verify Ollama is accessible at the configured URL\n' +
                '3. Check if the model "' + (settings.model || settings.ollamaModel || 'llama3.2:3b') + '" is available\n' +
                '4. Try testing the connection in Settings\n\n' +
                'Falling back to rule-based processing for now.',
                { isError: true }
              );
            } else {
              addMessage('assistant', 
                '⚠️ **Ollama Error**\n\n' +
                'Error: ' + errorMessage + '\n\n' +
                'Falling back to rule-based processing.',
                { isError: true }
              );
            }
          }
          
          // Fall back to rule-based processing
          response = await processUserCommandFallback(userMessage);
        }
      } else {
        // AI not configured - show helpful message
        if (settings.provider === 'anthropic') {
          response = {
            content: '⚠️ **AI Not Configured**\n\n' +
              'Please configure your Anthropic API key in Settings to enable AI-powered responses.\n\n' +
              'For now, I can help with basic file operations using rule-based processing.',
          };
        } else {
          // Shouldn't happen, but just in case
          response = await processUserCommandFallback(userMessage);
        }
      }

      // Store reasoning steps for real-time display
      if (response.metadata?.reasoningSteps) {
        setCurrentReasoningSteps(response.metadata.reasoningSteps);
      }

      // Store tool executions for real-time display
      if (response.metadata?.toolExecutions) {
        setCurrentToolExecutions(response.metadata.toolExecutions);
      }
      
      // Add assistant response
      const assistantMessage = addMessage('assistant', response.content, response.metadata);

      // Extract and create widget if tool operation detected
      if (assistantMessage && response.metadata?.toolExecutions) {
        const toolExecutions = response.metadata.toolExecutions || [];
        const widgetToolNames = ['folder_creation_tab', 'file_creation_tab', 'file_copy_tab', 'find_replace_tab'];
        
        for (const execution of toolExecutions) {
          if (widgetToolNames.includes(execution.tool) && execution.params) {
            // Create widget from tool execution (more accurate than text extraction)
            createWidget({
              toolName: execution.tool,
              params: execution.params,
              description: `Execute ${execution.tool.replace('_tab', '').replace(/_/g, ' ')}`,
              confidence: 0.9, // High confidence since it came from tool execution
              sourceMessageId: assistantMessage.id,
            });
          }
        }
      }
      
      // Speak the response if voice output is enabled
      if (voiceSettings.voiceOutputEnabled && response.content) {
        speak(response.content);
      }
      
      // Display tool executions if any
      if (response.metadata?.toolExecutions && response.metadata.toolExecutions.length > 0) {
        // Tool executions are already included in metadata, will be displayed in ChatMessage
        
        // If we have tool executions, generate an implementation plan
        if (response.metadata.toolExecutions.length > 1) {
          const { generatePlanFromToolExecutions } = await import('../voice/utils/planGenerator');
          const plan = generatePlanFromToolExecutions(userMessage, response.metadata.toolExecutions);
          setImplementationPlan(plan);
          setAwaitingApproval(true);
          
          // Speak plan summary
          if (voiceSettings.voiceOutputEnabled) {
            speak(
              `I've created a plan with ${plan.steps.length} steps to ${plan.task}. ` +
              `Estimated time: ${Math.round(plan.estimatedTotalTime / 60)} minutes. ` +
              `Please review the plan and say 'approve' to begin, or 'modify' to make changes.`
            );
          }
        }
      }
      
      // Check if AI is asking for clarification
      if (response.metadata?.clarifications) {
        setClarificationQuestions(response.metadata.clarifications);
      }

      // Check if AI generated an implementation plan
      if (response.metadata?.implementationPlan) {
        setImplementationPlan(response.metadata.implementationPlan);
        setAwaitingApproval(true);
      }
      
      if (response.operation) {
        setPreviewOperation(response.operation);
      }
    } catch (error: any) {
      // Don't show error if request was cancelled
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        addMessage('assistant', 'Request cancelled.');
      } else {
        console.error('Error processing command:', error);
        addMessage('assistant', 'I encountered an error processing your request. Please try again or rephrase your command.');
      }
    } finally {
      setIsProcessing(false);
      setActiveOperation(null);
      setTaskStartTime(null); // Reset task timer
      abortControllerRef.current = null;
    }
  }, [inputValue, isProcessing, currentDirectory, settings, processCommandWithAI, analyzeDirectory, addMessage, voiceSettings, speak]);

  const handleCancelOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setActiveOperation(null);
    addMessage('assistant', 'Operation cancelled.');
  }, [addMessage]);

  // Define handleVoiceTranscript after handleSendMessage
  const handleVoiceTranscript = useCallback((text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      console.log('[Voice] Empty transcript, skipping');
      return;
    }

    console.log('[Voice] Inserting transcript into chat input:', trimmedText);

    // Always insert the transcribed text into the chat input
    // This ensures the user can see and edit the text before sending
    setInputValue(trimmedText);
    setVoiceInputActive(true);
    
    // Note: Auto-send is disabled by default to allow user to review/edit the text
    // If you want to enable auto-send, uncomment the code below:
    /*
    // Auto-send if text is complete (only for longer messages)
    if (trimmedText.length > 10) {
      setTimeout(() => {
        handleSendMessage(trimmedText);
        setVoiceInputActive(false);
      }, 2000); // 2 second delay to allow user to see the text
    } else {
      setVoiceInputActive(false);
    }
    */
    
    // For now, just insert the text and let user manually send
    setTimeout(() => {
      setVoiceInputActive(false);
    }, 500);
  }, [handleSendMessage]);

  // Update the ref when handler changes
  useEffect(() => {
    voiceTranscriptHandlerRef.current = handleVoiceTranscript;
  }, [handleVoiceTranscript]);

  // Fallback rule-based command processing
  const processUserCommandFallback = async (command: string): Promise<{ content: string; metadata?: any; operation?: FileOperation }> => {
    const lowerCommand = command.toLowerCase();

    // Analyze directory
    if (lowerCommand.includes('analyze') || lowerCommand.includes('what') || lowerCommand.includes('show me')) {
      if (!currentDirectory) {
        return { content: 'Please select a directory first.' };
      }
      const analysis = await analyzeDirectory(currentDirectory);
      return {
        content: analysis.summary,
        metadata: { analysis },
      };
    }

    // Organize files
    if (lowerCommand.includes('organize') || lowerCommand.includes('sort')) {
      if (!currentDirectory) {
        return { content: 'Please select a directory first.' };
      }
      const operation = await organizeFiles(currentDirectory, command);
      return {
        content: operation.description,
        metadata: { operation },
        operation,
      };
    }

    // Find duplicates
    if (lowerCommand.includes('duplicate') || lowerCommand.includes('find same')) {
      if (!currentDirectory) {
        return { content: 'Please select a directory first.' };
      }
      const duplicates = await findDuplicates(currentDirectory);
      return {
        content: duplicates.summary,
        metadata: { duplicates },
      };
    }

    // Rename files
    if (lowerCommand.includes('rename') || lowerCommand.includes('name')) {
      if (!currentDirectory) {
        return { content: 'Please select a directory first.' };
      }
      const operation = await renameFiles(currentDirectory, command);
      return {
        content: operation.description,
        metadata: { operation },
        operation,
      };
    }

    // Default response for unrecognized commands
    return {
      content: `I understand you want to "${command}". To help you better, I can:\n\n` +
        `• Analyze files in a directory\n` +
        `• Organize files by type, date, or project\n` +
        `• Find and remove duplicate files\n` +
        `• Rename files based on patterns\n` +
        `• Create project structures\n\n` +
        `Try commands like:\n` +
        `- "Organize my Downloads folder by file type"\n` +
        `- "Find all duplicate files"\n` +
        `- "Analyze what's taking up space"\n\n` +
        (settings.apiKey ? '' : '💡 Tip: Configure your API key in settings for AI-powered responses!'),
    };
  };

  const handleQuickAction = async (action: string) => {
    const command = getQuickActionCommand(action);
    setInputValue(command);
    // Trigger send after a brief delay to allow input to update
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const getQuickActionCommand = (action: string): string => {
    const actionMap: Record<string, string> = {
      'auto-organize': `Organize files in ${currentDirectory || 'the current directory'} by file type`,
      'find-duplicates': 'Find all duplicate files',
      'smart-rename': 'Rename files to match a standard naming convention',
      'create-project': 'Create a new project folder structure',
      'archive-old': 'Archive files older than 6 months',
    };
    return actionMap[action] || action;
  };

  const handleExecuteOperation = async (operation: FileOperation) => {
    setActiveOperation('executing');
    try {
      await executeOperation(operation);
      addMessage('assistant', 'Operation completed successfully!');
      setPreviewOperation(null);
    } catch (error) {
      console.error('Error executing operation:', error);
      addMessage('assistant', 'Operation failed. Please check the console for details.');
    } finally {
      setActiveOperation(null);
    }
  };

  const handleCancelPreviewOperation = () => {
    setPreviewOperation(null);
    setActiveOperation(null);
  };

  const [executionProgress, setExecutionProgress] = useState<{
    currentStep: number;
    progress: { current: number; total: number; percentage: number; stage: string };
  } | null>(null);

  const handleApprovePlan = async () => {
    if (!implementationPlan) return;
    
    setAwaitingApproval(false);
    setActiveOperation('executing');
    setTaskStartTime(Date.now()); // Start tracking time
    
    // Speak approval confirmation
    if (voiceSettings.voiceOutputEnabled) {
      speak('Execution approved. Starting now...');
    }
    
    // Execute the plan steps
    try {
      const { toolOrchestrator } = await import('../utils/toolOrchestrator');
      
      for (let i = 0; i < implementationPlan.steps.length; i++) {
        const step = implementationPlan.steps[i];
        setExecutionProgress({
          currentStep: i + 1,
          progress: {
            current: 0,
            total: 100,
            percentage: 0,
            stage: step.description,
          },
        });

        // Speak step start
        if (voiceSettings.voiceOutputEnabled) {
          speak(`Starting step ${i + 1}: ${step.description}`);
        }

        // Execute step using tool orchestrator
        const result = await toolOrchestrator.executeTool(
          step.tool as any,
          step.parameters,
          step.description
        );

        // Update progress
        setExecutionProgress({
          currentStep: i + 1,
          progress: {
            current: 100,
            total: 100,
            percentage: 100,
            stage: `${step.description} - Complete`,
          },
        });

        // Speak step completion
        if (voiceSettings.voiceOutputEnabled && result.success) {
          speak(`Step ${i + 1} complete.`);
        }
      }
      
      const successMessage = `✅ Plan executed successfully! ${implementationPlan.steps.length} steps completed.`;
      addMessage('assistant', successMessage);
      
      if (voiceSettings.voiceOutputEnabled) {
        speak(`All done! Successfully completed ${implementationPlan.steps.length} steps.`);
      }
      
      setImplementationPlan(null);
      setExecutionProgress(null);
    } catch (error) {
      console.error('Error executing plan:', error);
      const errorMessage = '❌ Error executing plan. Please try again.';
      addMessage('assistant', errorMessage);
      
      if (voiceSettings.voiceOutputEnabled) {
        speak('I encountered an error. Please check the details and try again.');
      }
    } finally {
      setActiveOperation(null);
      setExecutionProgress(null);
    }
  };

  const handleCancelPlan = () => {
    setImplementationPlan(null);
    setAwaitingApproval(false);
    addMessage('assistant', 'Plan cancelled. How else can I help?');
  };

  const handleAnswerClarification = (questionId: string, answer: any) => {
    // Remove answered question and continue processing
    setClarificationQuestions(prev => prev.filter(q => q.id !== questionId));
    
    // Continue with the answer
    const answerText = typeof answer === 'string' ? answer : JSON.stringify(answer);
    handleSendMessage(`Answer to question: ${answerText}`);
  };

  const handleVoiceClick = useCallback(() => {
    toggleVoiceListening();
    setVoiceInputActive(!voiceInputActive);
  }, [voiceInputActive, toggleVoiceListening]);

  const handleDictateClick = useCallback(() => {
    setShowVoiceToText(!showVoiceToText);
  }, [showVoiceToText]);

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header - Improved Design */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-200/50 dark:border-blue-800/50">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI Assistant</h1>
              {currentDirectory && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <FolderOpen className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                    {currentDirectory.split('/').pop() || currentDirectory}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Current Directory Full Path (if set) - Tooltip on hover */}
          {currentDirectory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectDirectory}
              className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              title={currentDirectory}
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              <span className="max-w-[120px] truncate hidden sm:inline">
                {currentDirectory.split('/').pop() || currentDirectory}
              </span>
            </Button>
          )}

          {/* Voice Settings Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            title="Voice Settings"
            className={cn(
              "h-8 w-8 p-0",
              showVoiceSettings && "bg-slate-100 dark:bg-slate-800"
            )}
          >
            <Mic className="h-4 w-4" />
          </Button>

          {/* Settings Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
            className={cn(
              "h-8 w-8 p-0",
              showSettings && "bg-slate-100 dark:bg-slate-800"
            )}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className={cn("flex-1 flex flex-col min-h-0 overflow-hidden", previewOperation && "mr-96")}>
          {/* Clarification Panel */}
          {clarificationQuestions.length > 0 && (
            <div className="px-4">
              <ClarificationPanel
                questions={clarificationQuestions}
                onAnswer={handleAnswerClarification}
                onSkip={() => {
                  setClarificationQuestions([]);
                  // Continue with defaults
                }}
              />
            </div>
          )}

          {/* Implementation Plan */}
          {implementationPlan && awaitingApproval && !executionProgress && (
            <div className="px-4">
              <ImplementationPlanView
                plan={implementationPlan}
                onApprove={handleApprovePlan}
                onCancel={handleCancelPlan}
                onModify={() => {
                  setAwaitingApproval(false);
                  addMessage('assistant', 'What would you like to change about the plan?');
                }}
                voiceEnabled={voiceSettings.voiceOutputEnabled}
              />
            </div>
          )}

          {/* Execution Progress */}
          {executionProgress && implementationPlan && (
            <div className="px-4">
              <ExecutionProgress
                planId={implementationPlan.id}
                currentStep={executionProgress.currentStep}
                totalSteps={implementationPlan.steps.length}
                steps={implementationPlan.steps}
                progress={executionProgress.progress}
                voiceEnabled={voiceSettings.voiceOutputEnabled}
                onToggleVoice={() => setVoiceSettings(prev => ({ 
                  ...prev, 
                  voiceOutputEnabled: !prev.voiceOutputEnabled 
                }))}
                onStop={() => {
                  stopSpeaking();
                  setActiveOperation(null);
                  setExecutionProgress(null);
                  addMessage('assistant', 'Execution stopped by user.');
                }}
              />
            </div>
          )}

          {/* Chat Messages - Improved Spacing with Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className="px-5 py-6 space-y-6 max-w-4xl mx-auto">
                {/* Minimal Status Indicator - Only show if there's an issue */}
                {messages.length === 1 && (
                  <>
                    {settings.provider === 'ollama' && ollamaConnectionStatus.connected === false && (
                      <div className="px-4 py-2 -mx-5 -mt-6 mb-4 bg-red-50/30 dark:bg-red-950/20 border-b border-red-200/50 dark:border-red-800/50">
                        <div className="text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                          <Sparkles className="h-3 w-3" />
                          <span>⚠️ Ollama connection failed</span>
                        </div>
                      </div>
                    )}
                    {settings.clawdbotEnabled && clawdbotStatus.available === false && (
                      <div className="px-4 py-2 -mx-5 -mt-6 mb-4 bg-yellow-50/30 dark:bg-yellow-950/20 border-b border-yellow-200/50 dark:border-yellow-800/50">
                        <div className="text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                          <Sparkles className="h-3 w-3" />
                          <span>⚠️ ClawdBot not available: {clawdbotStatus.error || 'CLI not found'}</span>
                        </div>
                      </div>
                    )}
                    {settings.clawdbotEnabled && clawdbotStatus.available === true && (
                      <div className="px-4 py-2 -mx-5 -mt-6 mb-4 bg-green-50/30 dark:bg-green-950/20 border-b border-green-200/50 dark:border-green-800/50">
                        <div className="text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                          <Sparkles className="h-3 w-3" />
                          <span>✨ ClawdBot ready • ClawdHub skills available</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Simplified Quick Actions - Only on default page */}
                {messages.length === 1 && !clarificationQuestions.length && !implementationPlan && (
                  <div className="mb-6">
                    <QuickActions
                      onAction={handleQuickAction}
                      currentDirectory={currentDirectory}
                    />
                    {/* ClawdBot Quick Access - Only show if enabled */}
                    {settings.clawdbotEnabled && clawdbotStatus.available && (
                      <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1 rounded-md bg-orange-50 dark:bg-orange-950/30">
                            <Sparkles className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            ClawdBot
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const clawdbotAgent = agentService.getAgents().find(a => a.type === 'clawdbot');
                              if (clawdbotAgent) {
                                agentService.startAgent(clawdbotAgent.id);
                                addMessage('assistant', `Started ClawdBot agent. You can now use ClawdBot commands in the chat.`);
                              } else {
                                addMessage('assistant', 'ClawdBot agent not found. Please check your agent configuration.');
                              }
                            }}
                            className="h-9 px-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-orange-300 dark:hover:border-orange-700 transition-all"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                            <span className="text-sm text-slate-900 dark:text-slate-100">Start ClawdBot</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const { Command } = await import('@tauri-apps/plugin-shell');
                                const cmd = Command.create('clawdbot', ['plugins', 'list', '--json']);
                                const result = await cmd.execute();
                                if (result.code === 0) {
                                  const cleanOutput = result.stdout.replace(/\u001b\[.*?m/g, '');
                                  const plugins = JSON.parse(cleanOutput);
                                  const count = Array.isArray(plugins) ? plugins.length : 0;
                                  addMessage('assistant', `Found ${count} ClawdHub skill${count !== 1 ? 's' : ''} installed. Use "list ClawdHub skills" to see details.`);
                                } else {
                                  addMessage('assistant', 'Failed to list ClawdHub skills. Make sure ClawdBot is properly configured.');
                                }
                              } catch (error: any) {
                                addMessage('assistant', `Error: ${error.message || 'Failed to list skills'}`);
                              }
                            }}
                            className="h-9 px-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-orange-300 dark:hover:border-orange-700 transition-all"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                            <span className="text-sm text-slate-900 dark:text-slate-100">List Skills</span>
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Agent Tools - Hidden by default to reduce clutter, can be accessed via chat */}
                  </div>
                )}

                {/* Chat Messages */}
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isProcessing={isProcessing}
                  widgets={getWidgetsForMessage(message.id)}
                  aiName={settings.aiName}
                  userName={settings.userName}
                  onWidgetUpdate={(widgetId, updates) => {
                    updateWidget(widgetId, updates, 'user');
                    // If user is editing via natural language, process it
                    if (updates.params && inputValue) {
                      const widget = widgets.find(w => w.id === widgetId);
                      if (widget) {
                        const naturalLanguageUpdates = updateWidgetFromNaturalLanguage(widget, inputValue);
                        if (Object.keys(naturalLanguageUpdates).length > 0) {
                          updateWidget(widgetId, naturalLanguageUpdates, 'user');
                        }
                      }
                    }
                  }}
                  onWidgetNavigate={(widget) => {
                    navigateToTool(widget.id);
                  }}
                  onWidgetConfirm={async (widget) => {
                    confirmWidget(widget.id);
                    // Execute the tool immediately with confirmed parameters
                    // Build a command that will trigger the tool execution
                    const toolCommand = `Execute ${widget.toolName} with these parameters: ${JSON.stringify(widget.params)}`;
                    await handleSendMessage(toolCommand);
                  }}
                  onWidgetDismiss={(widgetId) => {
                    removeWidget(widgetId);
                  }}
                  onConfirmationAction={(action) => {
                    // Handle confirmation button clicks
                    // The action is already a command like "yes", "no", "create", "confirm", etc.
                    handleSendMessage(action);
                  }}
                />
              ))}
                {isProcessing && (
                  <>
                    <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/10 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="text-sm">Thinking...</span>
                    </div>
                    
                    {/* Show active tool usage */}
                    {currentToolExecutions.length > 0 && (
                      <div className="mt-3">
                        <ToolUsageIndicator toolExecutions={currentToolExecutions} />
                      </div>
                    )}

                    {/* Show reasoning chain during processing */}
                    {currentReasoningSteps.length > 0 && (
                      <div className="mt-3">
                        <ReasoningChain
                          steps={currentReasoningSteps}
                          isProcessing={true}
                        />
                      </div>
                    )}

                    {/* Show task progress for longer tasks */}
                    {executionProgress && implementationPlan && taskStartTime && (
                      <div className="mt-3">
                        <TaskProgressTracker
                          taskName={implementationPlan.title || 'Executing Plan'}
                          currentStep={executionProgress.currentStep}
                          totalSteps={implementationPlan.steps.length}
                          currentStage={executionProgress.progress.stage}
                          startTime={taskStartTime}
                          estimatedDuration={implementationPlan.estimatedDuration}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Active Operation Status */}
          {activeOperation && (
            <OperationStatus
              operation={activeOperation}
              onCancel={handleCancelOperation}
            />
          )}

          {/* Chat Input Area - Always Visible - Improved Styling */}
          <div className="shrink-0 px-5 py-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto">
              <ChatInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSendMessage}
              onSelectDirectory={(path) => {
                setCurrentDirectory(path);
                // Store in localStorage for agents to use
                if (path) {
                  localStorage.setItem('ai-assistant-current-directory', path);
                }
                addMessage('assistant', `Working directory set to: ${path}`);
              }}
              currentDirectory={currentDirectory}
              isProcessing={isProcessing}
              disabled={isProcessing}
              placeholder="How can I help you today?"
              aiModel={settings.model}
              onModelChange={(model) => updateSettings({ model: model as AISettings['model'] })}
              provider={settings.provider}
              onProviderChange={(provider) => updateSettings({ provider })}
              ollamaBaseUrl={settings.ollamaBaseUrl}
              onVoiceClick={handleVoiceClick}
              onDictateClick={handleDictateClick}
              isVoiceActive={voiceInputActive}
              isDictateActive={showVoiceToText}
            />
            </div>
          </div>
        </div>

        {/* Preview Changes Panel - Enhanced Sidebar */}
        {previewOperation && (
          <div className="w-96 border-l border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              <PreviewChanges
                operation={previewOperation}
                onExecute={() => handleExecuteOperation(previewOperation)}
                onCancel={handleCancelPreviewOperation}
              />
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onUpdate={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Voice Settings Panel */}
        {showVoiceSettings && (
          <VoiceSettingsPanel
            settings={voiceSettings}
            onUpdate={(updates) => setVoiceSettings(prev => ({ ...prev, ...updates }))}
            onClose={() => setShowVoiceSettings(false)}
          />
        )}

        {/* Voice to Text Panel */}
        {showVoiceToText && (
          <div className="w-96 border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 p-4">
            <VoiceToTextPanel
              settings={voiceSettings}
              onTranscript={handleVoiceTranscript}
              onClose={() => setShowVoiceToText(false)}
              onOpenSettings={() => {
                setShowVoiceToText(false);
                setShowVoiceSettings(true);
              }}
              onInsertToChat={(text) => {
                // Insert text into chat input
                console.log('[Voice] onInsertToChat called with text:', text);
                setInputValue(text);
                // Keep the panel open so user can see transcript history
                // User can manually close it if needed
                // setShowVoiceToText(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
