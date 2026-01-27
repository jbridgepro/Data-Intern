/**
 * File: src/features/ai-assistant/components/AIFileAssistantSession.tsx
 * 
 * Individual AI File Assistant session component.
 * This is the refactored version of the original AIFileAssistant component.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  FolderOpen,
  Settings,
  Sparkles,
  Loader2,
  Mic,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useAIFileAssistant } from "../hooks/useAIFileAssistant";
import { ChatMessage } from "./ChatMessage";
import { PreviewChanges } from "./PreviewChanges";
import { ToolUsageIndicator } from "./ToolUsageIndicator";
import { TaskProgressTracker } from "./TaskProgressTracker";
import { QuickActions } from "./QuickActions";
import { SettingsPanel } from "./SettingsPanel";
import { OperationStatus } from "./OperationStatus";
import { ChatInput } from "./ChatInput";
import { VoiceToTextPanel } from "./VoiceToTextPanel";
import { ReasoningChain } from "./ReasoningChain";
import { ClarificationPanel } from "../voice/components/ClarificationPanel";
import { ImplementationPlanView } from "../voice/components/ImplementationPlanView";
import { VoiceSettingsPanel } from "../voice/components/VoiceSettingsPanel";
import { ExecutionProgress } from "../voice/components/ExecutionProgress";
import { TaskUnderstanding, type TaskUnderstandingData } from "./TaskUnderstanding";
import { ResultsSummary, type ResultsSummaryData } from "./ResultsSummary";
import { useVoiceOutput } from "../voice/hooks/useVoiceOutput";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useToolWidget } from "../hooks/useToolWidget";
import { updateWidgetFromNaturalLanguage } from "../utils/widgetExtractor";
import { agentService } from "../../agents/services/agentService";
import { useVoiceServiceManager } from "../voice/hooks/useVoiceServiceManager";
import type { FileOperation, AISettings } from "../types";
import type { VoiceSettings, ClarificationQuestion, ImplementationPlan } from "../voice/types";
import { VoiceModeOverlay } from "./VoiceModeOverlay";
import { useChatContext } from "../../chat/contexts/ChatContext";

interface AIFileAssistantSessionProps {
  sessionId: string;
  tabName: string;
  onRename?: (newName: string) => void;
  initialDirectory?: string;
  onDirectoryChange?: (directory: string) => void;
}

export const AIFileAssistantSession = ({
  initialDirectory,
  onDirectoryChange,
}: AIFileAssistantSessionProps) => {
  // Consume unified chat context
  const { activeSession, sendMessage, setInputValue, activeAgentId, addMessage: contextAddMessage } = useChatContext();
  
  // Other state needed for UI - MOVED UP
  const [currentDirectory, setCurrentDirectory] = useState(initialDirectory || '');

  // Voice Settings State
  const [voiceSettings, setVoiceSettingsState] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem('voice-settings');
      return saved ? JSON.parse(saved) : {
        provider: 'faster-whisper',
        activationMode: 'push-to-talk',
        voiceOutputEnabled: true,
        voiceSpeed: 1.0,
        volume: 100,
        updateFrequency: 'milestones',
        language: 'en',
        showTranscription: true,
        autoPunctuation: true,
        noiseCancellation: true,
        allowInterruptions: true,
        voicePersona: 'friendly'
      };
    } catch (e) {
      return {
        provider: 'faster-whisper',
        activationMode: 'push-to-talk',
        voiceOutputEnabled: true,
        voiceSpeed: 1.0,
        volume: 100,
        updateFrequency: 'milestones',
        language: 'en',
        showTranscription: true,
        autoPunctuation: true,
        noiseCancellation: true,
        allowInterruptions: true,
        voicePersona: 'friendly'
      };
    }
  });

  const setVoiceSettings = (update: VoiceSettings | ((prev: VoiceSettings) => VoiceSettings)) => {
    setVoiceSettingsState(prev => {
       const next = typeof update === 'function' ? (update as any)(prev) : update;
       localStorage.setItem('voice-settings', JSON.stringify(next));
       return next;
    });
  };

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const voiceTranscriptHandlerRef = useRef<((text: string) => void) | null>(null);
  const lastSentMessageRef = useRef<{ text: string; timestamp: number } | null>(null);
  const showVoiceToTextRef = useRef(false);
  const pendingTranscriptRef = useRef<{ text: string; timestamp: number; timeoutId: NodeJS.Timeout | null } | null>(null);

  // Local state for UI toggles and non-persistent data (moved up to avoid initialization order issues)
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showVoiceToText, setShowVoiceToText] = useState(false);
  const [showVoiceMode, setShowVoiceMode] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    showVoiceToTextRef.current = showVoiceToText;
  }, [showVoiceToText]);

  // Voice Hooks
  const { speak, stopSpeaking } = useVoiceOutput(voiceSettings);
  
  const handleTranscript = useCallback((text: string) => {
    // Only process transcripts from useVoiceInput if VoiceToTextPanel is NOT open
    // This prevents duplicate processing when both systems are active
    // Use ref to avoid dependency on state that might not be initialized yet
    if (!showVoiceToTextRef.current && voiceTranscriptHandlerRef.current) {
      voiceTranscriptHandlerRef.current(text);
    }
  }, []);

  // Only initialize useVoiceInput when VoiceToTextPanel is closed
  // This prevents duplicate voice processing
  const { isListening, toggleListening, startListening, stopListening, transcribing: voiceTranscribing } = useVoiceInput(
    voiceSettings, 
    showVoiceToText ? () => {} : handleTranscript // Disable when panel is open
  );
  
  // Map voice variables for compatibility
  const voiceInputActive = isListening;
  const toggleVoiceListening = toggleListening;
  const setVoiceInputActive = (active: boolean) => active ? startListening() : stopListening();
  const voiceListening = isListening;

  // AI Assistant Hook
  const { 
    settings, 
    updateSettings,
    executeOperation
  } = useAIFileAssistant(currentDirectory);
  
  // Mock statuses that are no longer returned by the hook
  const ollamaConnectionStatus = { connected: true, isConnected: true, model: settings.ollamaModel || 'unknown' }; 
  const clawdbotStatus = { running: false, isRunning: false, available: false, error: null };

  // Other state needed for UI
  // currentDirectory is already declared above
  const [setIsProcessing] = useState<any>(null); // Dummy setter since processing is in context now
  const [activeOperation, setActiveOperation] = useState<'analyzing' | 'organizing' | 'executing' | null>(null);
  const [previewOperation, setPreviewOperation] = useState<FileOperation | null>(null);
  
  // Tool Execution State
  const [taskUnderstanding, setTaskUnderstanding] = useState<TaskUnderstandingData | null>(null);
  const [implementationPlan, setImplementationPlan] = useState<ImplementationPlan | null>(null);
  const [executionResults, setExecutionResults] = useState<ResultsSummaryData | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const [currentToolExecutions] = useState<any[]>([]);
  const [currentReasoningSteps] = useState<any[]>([]);

  // Helpers/Adapters
  const addMessage = useCallback((role: 'user' | 'assistant' | 'system', content: string) => {
    if (activeAgentId) {
      contextAddMessage(activeAgentId, {
        id: Date.now().toString(),
        role: role as any,
        content,
        timestamp: new Date()
      });
    }
  }, [activeAgentId, contextAddMessage]);

  const handleSendMessage = useCallback(async (content?: string) => {
    const textToSend = content || activeSession?.inputValue || '';
    if (!textToSend.trim()) return;
    
    // Prevent duplicate sends within 2 seconds
    const now = Date.now();
    if (lastSentMessageRef.current) {
      const timeSinceLastSend = now - lastSentMessageRef.current.timestamp;
      if (timeSinceLastSend < 2000 && lastSentMessageRef.current.text === textToSend.trim()) {
        console.log('[Chat] Duplicate message prevented:', textToSend);
        return;
      }
    }
    
    // Record this send
    lastSentMessageRef.current = {
      text: textToSend.trim(),
      timestamp: now
    };
    
    await sendMessage(textToSend);
  }, [activeSession?.inputValue, sendMessage]);

  const handleSelectDirectory = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: currentDirectory || undefined,
      });
      if (selected && typeof selected === 'string') {
        setCurrentDirectory(selected);
        if (onDirectoryChange) onDirectoryChange(selected);
      }
    } catch (err) {
      console.error('Failed to select directory', err);
    }
  }, [currentDirectory, onDirectoryChange]);

  
  // Tools
  const { widgets, updateWidget, removeWidget, getWidgetsForMessage, confirmWidget, navigateToTool } = useToolWidget();
  const voiceServiceManager = useVoiceServiceManager(voiceSettings);


  // Redirect to first agent if no active session (should be handled by tabs/context, but safety check)
  if (!activeSession && activeAgentId) {
     // Wait for context to sync
  }

  // Use state from context
  const messages = activeSession?.messages || [];
  const inputValue = activeSession?.inputValue || '';
  const isProcessing = activeSession?.isProcessing || false;


 
  // ... rest of the component ...
  
  // We need to replace the local 'messages' state with the one from context.
  // And 'handleSendMessage' should delegate to context.sendMessage.
  
  // Let's replace the whole top part of the component logic.

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
  // This handler accumulates transcripts and only sends when user has clearly finished speaking
  const handleVoiceTranscript = useCallback((text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      console.log('[Voice] Empty transcript, skipping');
      return;
    }

    console.log('[Voice] Received transcript:', trimmedText);

    // Clear any pending transcript timeout
    if (pendingTranscriptRef.current?.timeoutId) {
      clearTimeout(pendingTranscriptRef.current.timeoutId);
      pendingTranscriptRef.current.timeoutId = null;
    }

    const now = Date.now();
    
    // Detect incomplete sentences (likely not finished speaking)
    // Be aggressive - prefer waiting for more input over sending partial messages
    const looksIncomplete = (t: string): boolean => {
      const text = t.trim().toLowerCase();
      
      // Very short transcripts are almost certainly incomplete
      if (text.length < 15) return true;
      
      // Count words - single or two word sentences are usually incomplete
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < 3) return true;
      
      // Ends with common incomplete indicators
      if (/\.\.\.$/.test(text)) return true; // Ends with ...
      if (/,\s*$/.test(text)) return true; // Ends with comma
      
      // Contains filler words that suggest it might be incomplete
      if (/^(um|uh|so|and|but|or|well|like|okay|ok|h,|right)\b/i.test(text)) return true;
      
      // Common incomplete starting phrases (user is likely saying more)
      if (/^(i want to|i need to|i would like|i'd like|can you|could you|please|let me|what about|how about|tell me|show me)\b/i.test(text) && wordCount < 5) return true;
      
      // Ends with prepositions/conjunctions (more likely to come)
      if (/\s(to|for|with|about|from|in|on|at|by|of|and|or|but|the|a|an)\s*$/i.test(text)) return true;
      
      // Ends with "I" or "you" alone (sentence cut off)
      if (/\s(i|you)\s*$/i.test(text)) return true;
      
      // Very short sentences ending in punctuation might be transcription artifacts
      // e.g., "H, right." is likely not a complete thought
      if (text.length < 20 && /[.,!?]$/.test(text)) {
        // Check if it looks like a real complete sentence
        // Real sentences typically have a subject and verb
        if (!/\b(is|are|was|were|have|has|had|do|does|did|will|would|can|could|should|might|must|want|need|like|know|think|see|go|come|make|get|take)\b/i.test(text)) {
          return true; // Doesn't have a verb, probably incomplete
        }
      }
      
      return false;
    };

    // Check if this looks like a continuation of the previous thought
    const timeSinceLast = pendingTranscriptRef.current 
      ? now - pendingTranscriptRef.current.timestamp 
      : Infinity;
    
    // If within 8 seconds and there's a pending transcript, accumulate them
    // This gives users time to pause and think between phrases
    if (pendingTranscriptRef.current && timeSinceLast < 8000) {
      const prevText = pendingTranscriptRef.current.text;
      
      // Check if new text is a refinement (starts similarly) or a continuation
      const isRefinement = trimmedText.toLowerCase().startsWith(prevText.toLowerCase().substring(0, Math.min(10, prevText.length)));
      
      if (isRefinement) {
        // New text is a more complete version - replace
        console.log('[Voice] Replacing with more complete version');
        pendingTranscriptRef.current.text = trimmedText;
      } else {
        // New text is different - might be a continuation, accumulate with space
        // But only if the previous one looked incomplete
        if (looksIncomplete(prevText)) {
          console.log('[Voice] Accumulating as continuation');
          pendingTranscriptRef.current.text = prevText + ' ' + trimmedText;
        } else {
          // Previous looked complete, this is a new sentence
          console.log('[Voice] New sentence detected');
          pendingTranscriptRef.current.text = trimmedText;
        }
      }
      pendingTranscriptRef.current.timestamp = now;
    } else {
      // New transcript (no pending or too much time passed)
      pendingTranscriptRef.current = {
        text: trimmedText,
        timestamp: now,
        timeoutId: null
      };
    }

    // Update the input value immediately so user can see it
    setInputValue(pendingTranscriptRef.current.text);
    setVoiceInputActive(true);

    // Determine debounce time based on whether transcript looks complete
    const currentText = pendingTranscriptRef.current.text;
    const incomplete = looksIncomplete(currentText);
    const endsWithPunctuation = /[.!?]$/.test(currentText);
    const wordCount = currentText.split(/\s+/).filter(w => w.length > 0).length;
    
    // Longer debounce for incomplete sentences
    // For complete-looking sentences with punctuation, still wait a bit to catch continuations
    // Minimum 2.5s even for "complete" sentences, up to 5s for incomplete ones
    let debounceTime: number;
    if (incomplete) {
      debounceTime = 5000; // 5 seconds for incomplete
    } else if (wordCount < 5) {
      debounceTime = 4000; // 4 seconds for short but "complete" sentences
    } else if (endsWithPunctuation) {
      debounceTime = 2500; // 2.5 seconds for longer complete sentences
    } else {
      debounceTime = 4000; // 4 seconds for longer sentences without punctuation
    }
    
    console.log(`[Voice] Debouncing for ${debounceTime}ms (incomplete: ${incomplete}, words: ${wordCount})`);

    // Debounce: Wait for silence before processing
    pendingTranscriptRef.current.timeoutId = setTimeout(() => {
      const finalText = pendingTranscriptRef.current?.text.trim();
      if (!finalText) {
        pendingTranscriptRef.current = null;
        setVoiceInputActive(false);
        return;
      }

      console.log('[Voice] Processing final transcript after debounce:', finalText);

      // Validate minimum length
      if (finalText.length < 5) {
        console.log('[Voice] Transcript too short, keeping in buffer');
        // Don't clear - keep accumulating
        setVoiceInputActive(false);
        return;
      }

      // For normal mode (not voice mode), just insert the text
      // User must manually send by clicking the send button or pressing Enter
      // This prevents any auto-sending of partial transcripts
      if (!showVoiceMode) {
        console.log('[Voice] Text inserted into input, user must manually send');
        setVoiceInputActive(false);
        // Keep the pending transcript in case more comes
        // Only clear after user actually sends
        return;
      }

      // Auto-send logic ONLY for immersive voice mode
      if (showVoiceMode) {
        // Additional validation for voice mode - be VERY conservative
        // Require minimum length of 25 characters to avoid sending transcription artifacts
        const MIN_VOICE_SEND_LENGTH = 25;
        if (finalText.length < MIN_VOICE_SEND_LENGTH) {
          console.log(`[Voice] Voice mode: Transcript too short (${finalText.length} < ${MIN_VOICE_SEND_LENGTH}), waiting for more`);
          setVoiceInputActive(false);
          return;
        }
        
        // Check if it looks incomplete
        if (looksIncomplete(finalText)) {
          console.log('[Voice] Voice mode: Transcript looks incomplete, waiting for more');
          setVoiceInputActive(false);
          return;
        }
        
        // Final check: require at least 4 words for voice mode
        const wordCount = finalText.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount < 4) {
          console.log(`[Voice] Voice mode: Not enough words (${wordCount} < 4), waiting for more`);
          setVoiceInputActive(false);
          return;
        }
        
        console.log('[Voice] Voice mode: Sending complete message:', finalText);
        handleSendMessage(finalText);
        setInputValue('');
        setVoiceInputActive(false);
        pendingTranscriptRef.current = null;
      }
    }, debounceTime);
  }, [handleSendMessage, showVoiceMode]);

  // Update the ref when handler changes
  useEffect(() => {
    voiceTranscriptHandlerRef.current = handleVoiceTranscript;
  }, [handleVoiceTranscript]);

  // Cleanup pending transcript timeout on unmount
  useEffect(() => {
    return () => {
      if (pendingTranscriptRef.current?.timeoutId) {
        clearTimeout(pendingTranscriptRef.current.timeoutId);
      }
    };
  }, []);

  // Update agent name based on task understanding or implementation plan
  useEffect(() => {
    if (!activeAgentId) return;

    // Prioritize implementation plan task name
    if (implementationPlan?.task) {
      const currentAgent = agentService.getAgent(activeAgentId);
      if (currentAgent && currentAgent.name !== implementationPlan.task) {
        // Update agent name to match the task
        agentService.updateAgent(activeAgentId, { name: implementationPlan.task });
      }
      return;
    }

    // Fallback to initial task understanding intent for faster feedback
    if (taskUnderstanding?.intent) {
      const currentAgent = agentService.getAgent(activeAgentId);
      if (currentAgent && currentAgent.name.startsWith("New Task")) {
        // Create a short name from the intent
        const newName = taskUnderstanding.intent.length > 40 
          ? taskUnderstanding.intent.substring(0, 37) + '...' 
          : taskUnderstanding.intent;
          
        if (currentAgent.name !== newName) {
          agentService.updateAgent(activeAgentId, { name: newName });
        }
      }
    }
  }, [activeAgentId, implementationPlan?.task, taskUnderstanding?.intent]);


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
          step.parameters as any,
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
    setShowVoiceMode(prev => !prev);
  }, []);

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
        <div className={cn("flex-1 flex flex-col min-h-0 overflow-hidden relative", previewOperation && "mr-96")}>
          
          {/* Voice Mode Overlay */}
          {showVoiceMode && (
            <VoiceModeOverlay
              settings={voiceSettings}
              onClose={() => setShowVoiceMode(false)}
              onTranscript={(text) => {
                // Auto-send in voice mode
                handleSendMessage(text);
              }}
            />
          )}

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
                {/* Stage 1: Task Understanding */}
                {taskUnderstanding && !isProcessing && !executionResults && (
                  <div className="mt-3">
                    <TaskUnderstanding
                      understanding={taskUnderstanding}
                      onConfirm={() => {
                        // Clear understanding and proceed with execution
                        setTaskUnderstanding(null);
                        // The AI will handle execution based on confirmation
                      }}
                    />
                  </div>
                )}

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
                          taskName={implementationPlan.task || 'Executing Plan'}
                          currentStep={executionProgress.currentStep}
                          totalSteps={implementationPlan.steps.length}
                          currentStage={executionProgress.progress.stage}
                          startTime={taskStartTime}
                          estimatedDuration={implementationPlan.estimatedTotalTime}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Stage 4: Results Summary */}
                {executionResults && !isProcessing && (
                  <div className="mt-3">
                    <ResultsSummary
                      results={executionResults}
                      onVerify={() => {
                        // TODO: Implement verification
                        console.log('Verify results');
                      }}
                      onNextStep={(step) => {
                        // Clear results and send next step as a message
                        setExecutionResults(null);
                        handleSendMessage(step);
                      }}
                    />
                  </div>
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
              value={voiceListening ? (inputValue + (voiceTranscribing ? ' ' + voiceTranscribing : '...')) : inputValue}
              onChange={(newValue) => {
                // Determine if the change is from the user typing or the voice transcript being committed
                // If it's voice transcript updating the value, we don't want to interfere
                // But if user edits, we update inputValue
                if (!voiceListening) {
                   setInputValue(newValue);
                }
              }}
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
            onUpdate={(updates) => setVoiceSettings((prev: VoiceSettings) => ({ ...prev, ...updates }))}
            onClose={() => setShowVoiceSettings(false)}
            serviceManager={voiceServiceManager}
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
