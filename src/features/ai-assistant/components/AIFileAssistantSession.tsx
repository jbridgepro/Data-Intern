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
  AlertCircle,
  ExternalLink,
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
import { AIProviderSetupWizard } from "./AIProviderSetupWizard";
import {
  shouldShowSetupWizard,
  markSetupCompleted,
  markSetupSkipped,
  checkProviderConfiguration,
  getProviderHelpUrl,
} from "../utils/providerStatus";
import {
  TaskUnderstanding,
  type TaskUnderstandingData,
} from "./TaskUnderstanding";
import { ResultsSummary, type ResultsSummaryData } from "./ResultsSummary";
import { useVoiceOutput } from "../voice/hooks/useVoiceOutput";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useToolWidget } from "../hooks/useToolWidget";
import { updateWidgetFromNaturalLanguage } from "../utils/widgetExtractor";
import { agentService } from "../../agents/services/agentService";
import { generateChatTitleSummary } from "../utils/aiService";
import { useVoiceServiceManager } from "../voice/hooks/useVoiceServiceManager";
import { voiceCommandRecognizer } from "../voice/command/voiceCommand";
import type { VoiceCommand } from "../voice/command/voiceCommand";
import { voiceCommandAnalytics } from "../voice/command/voiceCommandAnalytics";
import { EntityExtractor } from "../voice/command/entityExtractor";
import type { FileOperation, AISettings } from "../types";
import type {
  VoiceSettings,
  ClarificationQuestion,
  ImplementationPlan,
} from "../voice/types";
import { VoiceModeOverlay } from "./VoiceModeOverlay";
import { useChatContext } from "../../chat/contexts/ChatContext";

interface AIFileAssistantSessionProps {
  sessionId: string;
  tabName: string;
  onRename?: (newName: string) => void;
  initialDirectory?: string;
  onDirectoryChange?: (directory: string) => void;
}

/** Maximum length for auto-generated chat/agent names. */
const CONTEXTUAL_NAME_MAX_LENGTH = 40;

type VoiceShortcutSource = "voice-mode" | "dictation";
type VoiceShortcutActionType = "message" | "widget";

interface PendingVoiceShortcut {
  id: string;
  source: VoiceShortcutSource;
  actionType: VoiceShortcutActionType;
  summary: string;
  message?: string;
  toolName?: string;
  params?: Record<string, any>;
  widgetId?: string;
  confidence: number;
  createdAt: number;
}

/**
 * Returns true if the name is a generic placeholder we can safely overwrite
 * with a context-derived name (e.g. "Agent Chat", "Chat 2", "New Task Agent").
 */
function isGenericAgentOrTabName(name: string): boolean {
  if (!name || typeof name !== "string") return true;
  const n = name.trim();
  return n === "Agent Chat" || n.startsWith("New Task") || /^Chat \d+$/.test(n);
}

/**
 * Trims and truncates a string for use as a tab/agent name.
 * Collapses whitespace to single spaces and caps length at CONTEXTUAL_NAME_MAX_LENGTH.
 */
function sanitizeContextualName(raw: string): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length <= CONTEXTUAL_NAME_MAX_LENGTH) return oneLine;
  return oneLine.substring(0, CONTEXTUAL_NAME_MAX_LENGTH - 3) + "...";
}

export const AIFileAssistantSession = ({
  initialDirectory,
  onDirectoryChange,
  onRename,
  tabName,
}: AIFileAssistantSessionProps) => {
  // Consume unified chat context
  const {
    activeSession,
    sendMessage,
    setInputValue,
    setDirectory,
    activeAgentId,
    addMessage: contextAddMessage,
    deleteMessage,
  } = useChatContext();

  // Other state needed for UI - MOVED UP
  const [currentDirectory, setCurrentDirectory] = useState(
    initialDirectory || activeSession?.currentDirectory || "",
  );

  // Keep local state in sync with active session directory
  useEffect(() => {
    if (
      activeSession?.currentDirectory &&
      activeSession.currentDirectory !== currentDirectory
    ) {
      setCurrentDirectory(activeSession.currentDirectory);
    }
  }, [activeSession?.currentDirectory, currentDirectory]);

  // Voice Settings State
  const [voiceSettings, setVoiceSettingsState] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem("voice-settings");
      return saved
        ? JSON.parse(saved)
        : {
            provider: "faster-whisper",
            activationMode: "push-to-talk",
            voiceOutputEnabled: true,
            voiceSpeed: 1.0,
            volume: 100,
            updateFrequency: "milestones",
            language: "en",
            showTranscription: true,
            autoPunctuation: true,
            noiseCancellation: true,
            allowInterruptions: true,
            voicePersona: "friendly",
          };
    } catch (e) {
      return {
        provider: "faster-whisper",
        activationMode: "push-to-talk",
        voiceOutputEnabled: true,
        voiceSpeed: 1.0,
        volume: 100,
        updateFrequency: "milestones",
        language: "en",
        showTranscription: true,
        autoPunctuation: true,
        noiseCancellation: true,
        allowInterruptions: true,
        voicePersona: "friendly",
      };
    }
  });

  const setVoiceSettings = (
    update: VoiceSettings | ((prev: VoiceSettings) => VoiceSettings),
  ) => {
    setVoiceSettingsState((prev) => {
      const next =
        typeof update === "function" ? (update as any)(prev) : update;
      localStorage.setItem("voice-settings", JSON.stringify(next));
      return next;
    });
  };

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const voiceTranscriptHandlerRef = useRef<((text: string) => void) | null>(
    null,
  );
  const lastSentMessageRef = useRef<{ text: string; timestamp: number } | null>(
    null,
  );
  const showVoiceToTextRef = useRef(false);
  // Use browser-safe timeout type instead of NodeJS.Timeout
  const pendingTranscriptRef = useRef<{
    text: string;
    timestamp: number;
    timeoutId: ReturnType<typeof setTimeout> | null;
  } | null>(null);

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
  const {
    isListening,
    toggleListening,
    startListening,
    stopListening,
    transcribing: voiceTranscribing,
  } = useVoiceInput(
    voiceSettings,
    showVoiceToText ? () => {} : handleTranscript, // Disable when panel is open
  );

  // Map voice variables for compatibility
  const voiceInputActive = isListening;
  const toggleVoiceListening = toggleListening;
  const setVoiceInputActive = (active: boolean) =>
    active ? startListening() : stopListening();
  const voiceListening = isListening;

  // AI Assistant Hook
  const { settings, updateSettings, executeOperation } =
    useAIFileAssistant(currentDirectory);

  // Setup wizard state - check if user needs to configure an AI provider
  const [showSetupWizard, setShowSetupWizard] = useState(() => {
    return shouldShowSetupWizard(settings);
  });
  const [providerConfigStatus, setProviderConfigStatus] = useState(() =>
    checkProviderConfiguration(settings),
  );

  // Re-check provider configuration when settings change
  useEffect(() => {
    const status = checkProviderConfiguration(settings);
    setProviderConfigStatus(status);

    // If provider becomes configured, hide the wizard
    if (status.isConfigured && showSetupWizard) {
      setShowSetupWizard(false);
    }
  }, [settings, showSetupWizard]);

  // Handle setup wizard completion
  const handleSetupComplete = useCallback(() => {
    markSetupCompleted();
    setShowSetupWizard(false);
  }, []);

  // Handle setup wizard skip
  const handleSetupSkip = useCallback(() => {
    markSetupSkipped();
    setShowSetupWizard(false);
  }, []);

  // Mock statuses that are no longer returned by the hook
  const ollamaConnectionStatus = {
    connected: true,
    isConnected: true,
    model: settings.ollamaModel || "unknown",
  };
  const clawdbotStatus = {
    running: false,
    isRunning: false,
    available: false,
    error: null,
  };

  // Other state needed for UI
  // currentDirectory is already declared above
  const [setIsProcessing] = useState<any>(null); // Dummy setter since processing is in context now
  const [activeOperation, setActiveOperation] = useState<
    "analyzing" | "organizing" | "executing" | null
  >(null);
  const [previewOperation, setPreviewOperation] =
    useState<FileOperation | null>(null);

  // Tool Execution State
  const [taskUnderstanding, setTaskUnderstanding] =
    useState<TaskUnderstandingData | null>(null);
  const [implementationPlan, setImplementationPlan] =
    useState<ImplementationPlan | null>(null);
  const [executionResults, setExecutionResults] =
    useState<ResultsSummaryData | null>(null);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<
    ClarificationQuestion[]
  >([]);
  const [pendingVoiceShortcut, setPendingVoiceShortcut] =
    useState<PendingVoiceShortcut | null>(null);
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const currentToolExecutions = activeSession?.currentToolExecutions || [];
  const currentReasoningSteps =
    settings.reasoningLive === false
      ? []
      : activeSession?.currentReasoningSteps || [];

  // Helpers/Adapters
  const addMessage = useCallback(
    (role: "user" | "assistant" | "system", content: string) => {
      if (activeAgentId) {
        contextAddMessage(activeAgentId, {
          id: Date.now().toString(),
          role: role as any,
          content,
          timestamp: new Date(),
        });
      }
    },
    [activeAgentId, contextAddMessage],
  );

  const handleSendMessage = useCallback(
    async (content?: string) => {
      const textToSend = content || activeSession?.inputValue || "";
      if (!textToSend.trim()) return;

      // Prevent duplicate sends within 2 seconds
      const now = Date.now();
      if (lastSentMessageRef.current) {
        const timeSinceLastSend = now - lastSentMessageRef.current.timestamp;
        if (
          timeSinceLastSend < 2000 &&
          lastSentMessageRef.current.text === textToSend.trim()
        ) {
          console.log("[Chat] Duplicate message prevented:", textToSend);
          return;
        }
      }

      // Record this send
      lastSentMessageRef.current = {
        text: textToSend.trim(),
        timestamp: now,
      };

      await sendMessage(textToSend);
    },
    [activeSession?.inputValue, sendMessage],
  );

  const applyDirectoryChange = useCallback(
    (nextDirectory: string) => {
      const trimmed = nextDirectory.trim();
      if (!trimmed) return;

      setCurrentDirectory(trimmed);
      setDirectory(trimmed);
      if (onDirectoryChange) onDirectoryChange(trimmed);
      localStorage.setItem("ai-assistant-current-directory", trimmed);
    },
    [onDirectoryChange, setCurrentDirectory, setDirectory],
  );

  const deriveHomeDirectory = useCallback((path: string): string => {
    if (!path) return "";

    const normalized = path.replace(/\\/g, "/");
    const macMatch = normalized.match(/^\/Users\/[^/]+/);
    if (macMatch) return macMatch[0];

    const linuxMatch = normalized.match(/^\/home\/[^/]+/);
    if (linuxMatch) return linuxMatch[0];

    const windowsMatch = path.match(/^[A-Z]:\\Users\\[^\\]+/i);
    if (windowsMatch) return windowsMatch[0];

    return "";
  }, []);

  const resolveVoicePaths = useCallback(
    (text: string) => {
      const homeDirectory = deriveHomeDirectory(currentDirectory);
      const fallbackDirectory = currentDirectory || homeDirectory || "/";
      const commonFolders = new Map<string, string>([
        ["Downloads", `${homeDirectory || fallbackDirectory}/Downloads`],
        ["Documents", `${homeDirectory || fallbackDirectory}/Documents`],
        ["Desktop", `${homeDirectory || fallbackDirectory}/Desktop`],
        ["Pictures", `${homeDirectory || fallbackDirectory}/Pictures`],
        ["Videos", `${homeDirectory || fallbackDirectory}/Videos`],
        ["Music", `${homeDirectory || fallbackDirectory}/Music`],
      ]);

      const extractor = new EntityExtractor({
        currentDirectory: fallbackDirectory,
        recentPaths: [],
        userHomeDirectory: homeDirectory || fallbackDirectory,
        commonFolders,
      });

      return extractor
        .extractPaths(text)
        .map((entity) => String(entity.value))
        .filter(Boolean);
    },
    [currentDirectory, deriveHomeDirectory],
  );

  const extractVoiceEntities = useCallback(
    (text: string) => {
      const homeDirectory = deriveHomeDirectory(currentDirectory);
      const fallbackDirectory = currentDirectory || homeDirectory || "/";
      const commonFolders = new Map<string, string>([
        ["Downloads", `${homeDirectory || fallbackDirectory}/Downloads`],
        ["Documents", `${homeDirectory || fallbackDirectory}/Documents`],
        ["Desktop", `${homeDirectory || fallbackDirectory}/Desktop`],
        ["Pictures", `${homeDirectory || fallbackDirectory}/Pictures`],
        ["Videos", `${homeDirectory || fallbackDirectory}/Videos`],
        ["Music", `${homeDirectory || fallbackDirectory}/Music`],
      ]);

      const extractor = new EntityExtractor({
        currentDirectory: fallbackDirectory,
        recentPaths: [],
        userHomeDirectory: homeDirectory || fallbackDirectory,
        commonFolders,
      });

      return extractor.extractAll(text);
    },
    [currentDirectory, deriveHomeDirectory],
  );

  const formatDirectoryLabel = useCallback((path: string) => {
    const normalized = path.replace(/\/+$/, "");
    const parts = normalized.split("/").filter(Boolean);
    return parts[parts.length - 1] || normalized;
  }, []);

  const handleSelectDirectory = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: currentDirectory || undefined,
      });
      if (selected && typeof selected === "string") {
        applyDirectoryChange(selected);
      }
    } catch (err) {
      console.error("Failed to select directory", err);
    }
  }, [applyDirectoryChange, currentDirectory]);

  // Tools
  const {
    widgets,
    createWidget,
    updateWidget,
    removeWidget,
    getWidgetsForMessage,
    confirmWidget,
    navigateToTool,
  } = useToolWidget();
  const voiceServiceManager = useVoiceServiceManager(voiceSettings);

  // Redirect to first agent if no active session (should be handled by tabs/context, but safety check)
  if (!activeSession && activeAgentId) {
    // Wait for context to sync
  }

  // Use state from context
  const messages = activeSession?.messages || [];
  const inputValue = activeSession?.inputValue || "";
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
    addMessage("assistant", "Operation cancelled.");
  }, [addMessage]);

  // Update agent name based on task understanding or implementation plan (voice flow)
  useEffect(() => {
    if (!activeAgentId) return;
    const tabNameGeneric = isGenericAgentOrTabName(tabName ?? "");

    // Prioritize implementation plan task name
    if (implementationPlan?.task) {
      const currentAgent = agentService.getAgent(activeAgentId);
      const newName = sanitizeContextualName(implementationPlan.task);
      if (
        currentAgent &&
        tabNameGeneric &&
        isGenericAgentOrTabName(currentAgent.name) &&
        currentAgent.name !== newName
      ) {
        agentService.updateAgent(activeAgentId, { name: newName });
        onRename?.(newName);
      }
      return;
    }

    // Fallback to initial task understanding intent for faster feedback
    if (taskUnderstanding?.intent) {
      const currentAgent = agentService.getAgent(activeAgentId);
      const newName = sanitizeContextualName(taskUnderstanding.intent);
      if (
        currentAgent &&
        tabNameGeneric &&
        isGenericAgentOrTabName(currentAgent.name) &&
        currentAgent.name !== newName
      ) {
        agentService.updateAgent(activeAgentId, { name: newName });
        onRename?.(newName);
      }
    }
  }, [
    activeAgentId,
    implementationPlan?.task,
    taskUnderstanding?.intent,
    onRename,
    tabName,
  ]);

  // Derive contextual name from chat, optionally via AI summary, and update agent + tab
  useEffect(() => {
    if (!activeAgentId || !activeSession) return;

    const messages = activeSession.messages ?? [];
    let rawContext: string | null = null;

    // Prefer implementation plan task from latest assistant message metadata
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant" || !msg.metadata) continue;
      const task = msg.metadata?.implementationPlan?.task;
      if (typeof task === "string" && task.trim()) {
        rawContext = task.trim().replace(/\s+/g, " ");
        break;
      }
    }

    // Fallback: first user message (skip welcome / empty)
    if (!rawContext) {
      const firstUser = messages.find(
        (m) => m.role === "user" && m.content?.trim() && m.id !== "welcome",
      );
      if (firstUser?.content?.trim()) {
        rawContext = firstUser.content.trim().replace(/\s+/g, " ");
      }
    }

    if (!rawContext) return;

    const currentAgent = agentService.getAgent(activeAgentId);
    const agentNameGeneric =
      currentAgent && isGenericAgentOrTabName(currentAgent.name);
    const tabNameGeneric = isGenericAgentOrTabName(tabName ?? "");
    if (!currentAgent || !agentNameGeneric || !tabNameGeneric) return;

    let cancelled = false;

    (async () => {
      const summary = await generateChatTitleSummary(rawContext!, settings);
      if (cancelled) return;
      const contextualName = summary
        ? summary.trim().slice(0, CONTEXTUAL_NAME_MAX_LENGTH) ||
          sanitizeContextualName(rawContext!)
        : sanitizeContextualName(rawContext!);
      if (currentAgent.name === contextualName) return;

      agentService.updateAgent(activeAgentId, { name: contextualName });
      onRename?.(contextualName);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeAgentId, activeSession?.messages, onRename, tabName, settings]);

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
      "auto-organize": `Organize files in ${
        currentDirectory || "the current directory"
      } by file type`,
      "find-duplicates": "Find all duplicate files",
      "smart-rename": "Rename files to match a standard naming convention",
      "create-project": "Create a new project folder structure",
      "archive-old": "Archive files older than 6 months",
    };
    return actionMap[action] || action;
  };

  const handleExecuteOperation = async (operation: FileOperation) => {
    setActiveOperation("executing");
    try {
      await executeOperation(operation);
      addMessage("assistant", "Operation completed successfully!");
      setPreviewOperation(null);
    } catch (error) {
      console.error("Error executing operation:", error);
      addMessage(
        "assistant",
        "Operation failed. Please check the console for details.",
      );
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
    progress: {
      current: number;
      total: number;
      percentage: number;
      stage: string;
    };
  } | null>(null);

  const handleApprovePlan = async () => {
    if (!implementationPlan) return;

    setAwaitingApproval(false);
    setActiveOperation("executing");
    setTaskStartTime(Date.now()); // Start tracking time

    // Speak approval confirmation
    if (voiceSettings.voiceOutputEnabled) {
      speak("Execution approved. Starting now...");
    }

    // Execute the plan steps
    try {
      const { toolOrchestrator } = await import("../utils/toolOrchestrator");

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
          step.description,
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
      addMessage("assistant", successMessage);

      if (voiceSettings.voiceOutputEnabled) {
        speak(
          `All done! Successfully completed ${implementationPlan.steps.length} steps.`,
        );
      }

      setImplementationPlan(null);
      setExecutionProgress(null);
    } catch (error) {
      console.error("Error executing plan:", error);
      const errorMessage = "❌ Error executing plan. Please try again.";
      addMessage("assistant", errorMessage);

      if (voiceSettings.voiceOutputEnabled) {
        speak(
          "I encountered an error. Please check the details and try again.",
        );
      }
    } finally {
      setActiveOperation(null);
      setExecutionProgress(null);
    }
  };

  const handleCancelPlan = () => {
    setImplementationPlan(null);
    setAwaitingApproval(false);
    addMessage("assistant", "Plan cancelled. How else can I help?");
  };

  const createVoiceShortcutMessage = useCallback(
    (content: string) => {
      if (!activeAgentId) return null;
      const messageId = `voice-shortcut-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      contextAddMessage(activeAgentId, {
        id: messageId,
        role: "assistant",
        content,
        timestamp: new Date(),
      });
      return messageId;
    },
    [activeAgentId, contextAddMessage],
  );

  const buildVoiceShortcut = useCallback(
    (command: VoiceCommand, text: string): PendingVoiceShortcut | null => {
      if (command.intent !== "execute_tool" && command.intent !== "query") {
        return null;
      }

      const entities = extractVoiceEntities(text);
      const paths = resolveVoicePaths(text);
      const primaryPath = paths[0] || currentDirectory;
      const pathLabel = primaryPath
        ? formatDirectoryLabel(primaryPath)
        : "current directory";

      const strategyEntity = entities.find((entity) => entity.type === "strategy");
      const strategyValue =
        typeof strategyEntity?.value === "string" ? strategyEntity.value : "";
      const strategyLabel = strategyValue
        ? strategyValue.replace(/^by-/, "by ").replace(/-/g, " ")
        : "";

      switch (command.tool) {
        case "organize_files": {
          const summary = `organize ${pathLabel}${
            strategyLabel ? ` ${strategyLabel}` : ""
          }`;
          const message = `Organize files in ${
            primaryPath || "the current directory"
          }${strategyLabel ? ` ${strategyLabel}` : ""}.`;
          return {
            id: `shortcut-${Date.now()}`,
            source: "voice-mode",
            actionType: "message",
            summary,
            message,
            toolName: command.tool,
            confidence: command.confidence,
            createdAt: Date.now(),
          };
        }

        case "find_duplicates": {
          const summary = `find duplicates in ${pathLabel}`;
          const message = `Find duplicate files in ${
            primaryPath || "the current directory"
          }.`;
          return {
            id: `shortcut-${Date.now()}`,
            source: "voice-mode",
            actionType: "message",
            summary,
            message,
            toolName: command.tool,
            confidence: command.confidence,
            createdAt: Date.now(),
          };
        }

        case "search_files": {
          const query =
            typeof command.parameters?.query === "string"
              ? command.parameters?.query
              : "";
          if (!query) return null;
          const summary = `search for "${query}" in ${pathLabel}`;
          const message = `Search for "${query}" in ${
            primaryPath || "the current directory"
          }.`;
          return {
            id: `shortcut-${Date.now()}`,
            source: "voice-mode",
            actionType: "message",
            summary,
            message,
            toolName: command.tool,
            confidence: command.confidence,
            createdAt: Date.now(),
          };
        }

        case "delete_files": {
          const pattern =
            typeof command.parameters?.pattern === "string"
              ? command.parameters?.pattern
              : "";
          if (!pattern) return null;
          const summary = `delete "${pattern}" files in ${pathLabel}`;
          const message = `Delete "${pattern}" files in ${
            primaryPath || "the current directory"
          }.`;
          return {
            id: `shortcut-${Date.now()}`,
            source: "voice-mode",
            actionType: "message",
            summary,
            message,
            toolName: command.tool,
            confidence: command.confidence,
            createdAt: Date.now(),
          };
        }

        case "analyze_directory": {
          const summary = `analyze ${pathLabel}`;
          const message = `Analyze ${
            primaryPath || "the current directory"
          }.`;
          return {
            id: `shortcut-${Date.now()}`,
            source: "voice-mode",
            actionType: "message",
            summary,
            message,
            toolName: command.tool,
            confidence: command.confidence,
            createdAt: Date.now(),
          };
        }

        case "list_directory_contents": {
          const summary = `list contents of ${pathLabel}`;
          const message = `List the contents of ${
            primaryPath || "the current directory"
          }.`;
          return {
            id: `shortcut-${Date.now()}`,
            source: "voice-mode",
            actionType: "message",
            summary,
            message,
            toolName: command.tool,
            confidence: command.confidence,
            createdAt: Date.now(),
          };
        }

        case "file_copy_tab": {
          const sourcePath =
            paths[0] ||
            (typeof command.parameters?.sourcePath === "string"
              ? command.parameters?.sourcePath
              : "");
          const destinationPath =
            paths[1] ||
            (typeof command.parameters?.destinationPath === "string"
              ? command.parameters?.destinationPath
              : "");
          if (!sourcePath || !destinationPath) return null;

          const summary = `copy from ${formatDirectoryLabel(
            sourcePath,
          )} to ${formatDirectoryLabel(destinationPath)}`;
          return {
            id: `shortcut-${Date.now()}`,
            source: "voice-mode",
            actionType: "widget",
            summary,
            toolName: "file_copy_tab",
            params: {
              sourcePath,
              destinationPath,
              operation: "copy",
              includeSubdirectories: true,
              overwrite: false,
            },
            confidence: command.confidence,
            createdAt: Date.now(),
          };
        }

        case "folder_creation_tab": {
          const folderNames = Array.isArray(command.parameters?.folderNames)
            ? command.parameters?.folderNames
            : [];
          if (folderNames.length === 0) return null;

          const rootPath = primaryPath || currentDirectory;
          const summary = `create ${folderNames.length} folder${
            folderNames.length === 1 ? "" : "s"
          } in ${pathLabel}`;

          return {
            id: `shortcut-${Date.now()}`,
            source: "voice-mode",
            actionType: "widget",
            summary,
            toolName: "folder_creation_tab",
            params: {
              rootPath,
              folderNames,
            },
            confidence: command.confidence,
            createdAt: Date.now(),
          };
        }

        default:
          return null;
      }
    },
    [
      currentDirectory,
      extractVoiceEntities,
      formatDirectoryLabel,
      resolveVoicePaths,
    ],
  );

  const enqueueVoiceShortcut = useCallback(
    (shortcut: PendingVoiceShortcut) => {
      if (pendingVoiceShortcut) {
        if (voiceSettings.voiceOutputEnabled) {
          speak("I still need confirmation. Say confirm or cancel.");
        }
        return;
      }

      const prompt = `I can ${shortcut.summary}. Say "confirm" to proceed or "cancel" to stop.`;
      const messageId = createVoiceShortcutMessage(prompt);

      let widgetId: string | undefined;
      if (
        shortcut.actionType === "widget" &&
        shortcut.toolName &&
        shortcut.params &&
        messageId
      ) {
        const widget = createWidget({
          toolName: shortcut.toolName,
          params: shortcut.params,
          description: shortcut.summary,
          confidence: shortcut.confidence,
          sourceMessageId: messageId,
        });
        widgetId = widget.id;
      }

      setPendingVoiceShortcut({
        ...shortcut,
        widgetId,
      });

      if (voiceSettings.voiceOutputEnabled) {
        speak(prompt);
      }
    },
    [
      createVoiceShortcutMessage,
      createWidget,
      pendingVoiceShortcut,
      speak,
      voiceSettings.voiceOutputEnabled,
    ],
  );

  const confirmPendingVoiceShortcut = useCallback(async () => {
    if (!pendingVoiceShortcut) return;

    if (pendingVoiceShortcut.actionType === "widget" && pendingVoiceShortcut.widgetId) {
      const widget = widgets.find((item) => item.id === pendingVoiceShortcut.widgetId);
      if (widget) {
        confirmWidget(widget.id);
        const toolCommand = `Execute ${widget.toolName} with these parameters: ${JSON.stringify(
          widget.params,
        )}`;
        await handleSendMessage(toolCommand);
      }
    } else if (pendingVoiceShortcut.message) {
      await handleSendMessage(pendingVoiceShortcut.message);
    }

    setPendingVoiceShortcut(null);
  }, [confirmWidget, handleSendMessage, pendingVoiceShortcut, widgets]);

  const cancelPendingVoiceShortcut = useCallback(() => {
    if (!pendingVoiceShortcut) return;
    if (pendingVoiceShortcut.widgetId) {
      removeWidget(pendingVoiceShortcut.widgetId);
    }
    setPendingVoiceShortcut(null);
    addMessage("assistant", "Voice shortcut cancelled.");
    if (voiceSettings.voiceOutputEnabled) {
      speak("Cancelled.");
    }
  }, [
    addMessage,
    pendingVoiceShortcut,
    removeWidget,
    speak,
    voiceSettings.voiceOutputEnabled,
  ]);

  const handleStopExecution = useCallback(() => {
    stopSpeaking();
    setActiveOperation(null);
    setExecutionProgress(null);
    addMessage("assistant", "Execution stopped by user.");
  }, [addMessage, stopSpeaking]);

  const isLikelyVoiceCommand = useCallback((text: string) => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return false;
    return /^(organize|find|search|delete|backup|copy|rename|create|analyze|list|show|go to|open|help|approve|confirm|cancel|stop|yes|no|what|how)\b/.test(
      normalized,
    );
  }, []);

  const handleVoiceCommandAction = useCallback(
    (text: string, source: "voice-mode" | "dictation") => {
      const command = voiceCommandRecognizer.parseCommand(text);
      if (command.intent !== "unknown" || isLikelyVoiceCommand(text)) {
        voiceCommandAnalytics.record(command, text);
      }

      if (command.intent === "approval" && awaitingApproval) {
        void handleApprovePlan();
        return true;
      }

      if (command.intent === "cancel" && awaitingApproval) {
        handleCancelPlan();
        return true;
      }

      if (pendingVoiceShortcut) {
        if (command.intent === "approval") {
          void confirmPendingVoiceShortcut();
          return true;
        }
        if (command.intent === "cancel") {
          cancelPendingVoiceShortcut();
          return true;
        }
        if (voiceSettings.voiceOutputEnabled) {
          speak("Please say confirm or cancel.");
        }
        return true;
      }

      if (command.intent === "cancel" && (executionProgress || activeOperation)) {
        handleStopExecution();
        return true;
      }

      if (command.intent === "navigate" && source === "voice-mode") {
        const [resolvedPath] = resolveVoicePaths(command.rawText);
        if (!resolvedPath) return false;

        applyDirectoryChange(resolvedPath);

        const label = formatDirectoryLabel(resolvedPath);
        if (voiceSettings.voiceOutputEnabled) {
          speak(`Switched to ${label}.`);
        }
        addMessage("assistant", `Switched to ${resolvedPath}.`);
        return true;
      }

      const shortcut = buildVoiceShortcut(command, text);
      if (shortcut) {
        enqueueVoiceShortcut({ ...shortcut, source });
        return true;
      }

      return false;
    },
    [
      activeOperation,
      addMessage,
      applyDirectoryChange,
      awaitingApproval,
      buildVoiceShortcut,
      cancelPendingVoiceShortcut,
      confirmPendingVoiceShortcut,
      enqueueVoiceShortcut,
      executionProgress,
      formatDirectoryLabel,
      handleApprovePlan,
      handleCancelPlan,
      handleStopExecution,
      isLikelyVoiceCommand,
      pendingVoiceShortcut,
      resolveVoicePaths,
      speak,
      voiceSettings.voiceOutputEnabled,
    ],
  );

  // Define handleVoiceTranscript after voice command handlers
  // This handler accumulates transcripts and only sends when user has clearly finished speaking
  const handleVoiceTranscript = useCallback(
    (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        console.log("[Voice] Empty transcript, skipping");
        return;
      }

      console.log("[Voice] Received transcript:", trimmedText);

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
        const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
        if (wordCount < 3) return true;

        // Ends with common incomplete indicators
        if (/\.\.\.$/.test(text)) return true; // Ends with ...
        if (/,\s*$/.test(text)) return true; // Ends with comma

        // Contains filler words that suggest it might be incomplete
        if (/^(um|uh|so|and|but|or|well|like|okay|ok|h,|right)\b/i.test(text))
          return true;

        // Common incomplete starting phrases (user is likely saying more)
        if (
          /^(i want to|i need to|i would like|i'd like|can you|could you|please|let me|what about|how about|tell me|show me)\b/i.test(
            text,
          ) &&
          wordCount < 5
        )
          return true;

        // Ends with prepositions/conjunctions (more likely to come)
        if (
          /\s(to|for|with|about|from|in|on|at|by|of|and|or|but|the|a|an)\s*$/i.test(
            text,
          )
        )
          return true;

        // Ends with "I" or "you" alone (sentence cut off)
        if (/\s(i|you)\s*$/i.test(text)) return true;

        // Very short sentences ending in punctuation might be transcription artifacts
        // e.g., "H, right." is likely not a complete thought
        if (text.length < 20 && /[.,!?]$/.test(text)) {
          // Check if it looks like a real complete sentence
          // Real sentences typically have a subject and verb
          if (
            !/\b(is|are|was|were|have|has|had|do|does|did|will|would|can|could|should|might|must|want|need|like|know|think|see|go|come|make|get|take)\b/i.test(
              text,
            )
          ) {
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
        const isRefinement = trimmedText
          .toLowerCase()
          .startsWith(
            prevText.toLowerCase().substring(0, Math.min(10, prevText.length)),
          );

        if (isRefinement) {
          // New text is a more complete version - replace
          console.log("[Voice] Replacing with more complete version");
          pendingTranscriptRef.current.text = trimmedText;
        } else {
          // New text is different - might be a continuation, accumulate with space
          // But only if the previous one looked incomplete
          if (looksIncomplete(prevText)) {
            console.log("[Voice] Accumulating as continuation");
            pendingTranscriptRef.current.text = prevText + " " + trimmedText;
          } else {
            // Previous looked complete, this is a new sentence
            console.log("[Voice] New sentence detected");
            pendingTranscriptRef.current.text = trimmedText;
          }
        }
        pendingTranscriptRef.current.timestamp = now;
      } else {
        // New transcript (no pending or too much time passed)
        pendingTranscriptRef.current = {
          text: trimmedText,
          timestamp: now,
          timeoutId: null,
        };
      }

      // Update the input value immediately so user can see it
      setInputValue(pendingTranscriptRef.current.text);
      setVoiceInputActive(true);

      // Determine debounce time based on whether transcript looks complete
      const currentText = pendingTranscriptRef.current.text;
      const incomplete = looksIncomplete(currentText);
      const endsWithPunctuation = /[.!?]$/.test(currentText);
      const wordCount = currentText
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

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

      console.log(
        `[Voice] Debouncing for ${debounceTime}ms (incomplete: ${incomplete}, words: ${wordCount})`,
      );

      // Debounce: Wait for silence before processing
      pendingTranscriptRef.current.timeoutId = setTimeout(() => {
        const finalText = pendingTranscriptRef.current?.text.trim();
        if (!finalText) {
          pendingTranscriptRef.current = null;
          setVoiceInputActive(false);
          return;
        }

        console.log(
          "[Voice] Processing final transcript after debounce:",
          finalText,
        );

        // Allow voice commands to short-circuit before length checks
        if (
          handleVoiceCommandAction(
            finalText,
            showVoiceMode ? "voice-mode" : "dictation",
          )
        ) {
          setInputValue("");
          setVoiceInputActive(false);
          pendingTranscriptRef.current = null;
          return;
        }

        // Validate minimum length
        if (finalText.length < 5) {
          console.log("[Voice] Transcript too short, keeping in buffer");
          // Don't clear - keep accumulating
          setVoiceInputActive(false);
          return;
        }

        // For normal mode (not voice mode), just insert the text
        // User must manually send by clicking the send button or pressing Enter
        // This prevents any auto-sending of partial transcripts
        if (!showVoiceMode) {
          console.log(
            "[Voice] Text inserted into input, user must manually send",
          );
          setVoiceInputActive(false);
          // Keep the pending transcript in case more comes
          // Only clear after user actually sends
          return;
        }

        // Auto-send logic ONLY for immersive voice mode
        if (showVoiceMode) {
          // Relaxed validation - allow shorter but meaningful commands
          // Reduced from 25 to 10 chars to support commands like "yes", "help me"
          const MIN_VOICE_SEND_LENGTH = 10;
          if (finalText.length < MIN_VOICE_SEND_LENGTH) {
            console.log(
              `[Voice] Voice mode: Transcript too short (${finalText.length} < ${MIN_VOICE_SEND_LENGTH}), waiting for more`,
            );
            setVoiceInputActive(false);
            return;
          }

          // Check if it looks incomplete
          if (looksIncomplete(finalText)) {
            console.log(
              "[Voice] Voice mode: Transcript looks incomplete, waiting for more",
            );
            setVoiceInputActive(false);
            return;
          }

          // Relaxed check: require at least 2 words for voice mode
          const wordCount = finalText
            .split(/\s+/)
            .filter((w) => w.length > 0).length;
          if (wordCount < 2) {
            console.log(
              `[Voice] Voice mode: Not enough words (${wordCount} < 2), waiting for more`,
            );
            setVoiceInputActive(false);
            return;
          }

          console.log(
            "[Voice] Voice mode: Sending complete message:",
            finalText,
          );
          handleSendMessage(finalText);
          setInputValue("");
          setVoiceInputActive(false);
          pendingTranscriptRef.current = null;
        }
      }, debounceTime);
    },
    [
      handleSendMessage,
      handleVoiceCommandAction,
      setInputValue,
      setVoiceInputActive,
      showVoiceMode,
    ],
  );

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

  const handleVoiceModeTranscript = useCallback(
    (text: string) => {
      if (handleVoiceCommandAction(text, "voice-mode")) return;
      handleSendMessage(text);
    },
    [handleSendMessage, handleVoiceCommandAction],
  );

  const handleAnswerClarification = (questionId: string, answer: any) => {
    // Remove answered question and continue processing
    setClarificationQuestions((prev) =>
      prev.filter((q) => q.id !== questionId),
    );

    // Continue with the answer
    const answerText =
      typeof answer === "string" ? answer : JSON.stringify(answer);
    handleSendMessage(`Answer to question: ${answerText}`);
  };

  const handleVoiceClick = useCallback(() => {
    toggleVoiceListening();
    setVoiceInputActive(!voiceInputActive);
  }, [voiceInputActive, toggleVoiceListening]);

  const handleDictateClick = useCallback(() => {
    setShowVoiceMode((prev) => !prev);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-950/50 dark:to-slate-900 text-foreground">
      {/* Header - Enhanced Modern Design */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          {/* Directory Selector - Compact Pill */}
          {currentDirectory ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectDirectory}
              className="h-9 px-3 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200/50 dark:border-slate-700/50 transition-all duration-200"
              title={currentDirectory}
            >
              <FolderOpen className="h-4 w-4 text-violet-500 dark:text-violet-400 mr-2" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                {currentDirectory.split("/").pop() || currentDirectory}
              </span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectDirectory}
              className="h-9 px-3 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-xl border border-violet-200/50 dark:border-violet-800/50 text-violet-600 dark:text-violet-400 transition-all duration-200"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Select Folder</span>
            </Button>
          )}

          {/* Provider Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                settings.provider === "anthropic"
                  ? "bg-violet-500"
                  : settings.provider === "openrouter"
                  ? "bg-blue-500"
                  : "bg-emerald-500",
              )}
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {settings.provider === "anthropic"
                ? "Claude"
                : settings.provider === "openrouter"
                ? "OpenRouter"
                : "Ollama"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Voice Settings Button - Enhanced */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            title="Voice Settings"
            className={cn(
              "h-9 w-9 p-0 rounded-xl transition-all duration-200",
              showVoiceSettings
                ? "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400"
                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400",
            )}
          >
            <Mic className="h-4 w-4" />
          </Button>

          {/* Settings Button - Enhanced */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            title="AI Settings"
            className={cn(
              "h-9 w-9 p-0 rounded-xl transition-all duration-200",
              showSettings
                ? "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400"
                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400",
            )}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div
          className={cn(
            "flex-1 flex flex-col min-h-0 overflow-hidden relative",
            previewOperation && "mr-96",
          )}
        >
          {/* Voice Mode Overlay */}
          {showVoiceMode && (
            <VoiceModeOverlay
              settings={voiceSettings}
              onClose={() => setShowVoiceMode(false)}
              onTranscript={handleVoiceModeTranscript}
              onOpenSettings={() => setShowVoiceSettings(true)}
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
                  addMessage(
                    "assistant",
                    "What would you like to change about the plan?",
                  );
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
                onToggleVoice={() =>
                  setVoiceSettings((prev) => ({
                    ...prev,
                    voiceOutputEnabled: !prev.voiceOutputEnabled,
                  }))
                }
                onStop={handleStopExecution}
              />
            </div>
          )}

          {/* Chat Messages - Enhanced Spacing with Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className="px-5 py-6 space-y-6 max-w-4xl mx-auto">
                {/* Setup Wizard - Show when no provider is configured */}
                {showSetupWizard && (
                  <div className="py-4">
                    <AIProviderSetupWizard
                      settings={settings}
                      onUpdate={updateSettings}
                      onComplete={handleSetupComplete}
                      onSkip={handleSetupSkip}
                    />
                  </div>
                )}

                {/* Provider Configuration Warning Banner - Show when provider needs attention */}
                {!showSetupWizard &&
                  !providerConfigStatus.isConfigured &&
                  messages.length === 1 && (
                    <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                            AI Provider Not Configured
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                            {providerConfigStatus.message}
                            {providerConfigStatus.details.length > 0 && (
                              <span className="block mt-1">
                                {providerConfigStatus.details.join(". ")}
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => setShowSetupWizard(true)}
                            >
                              <Sparkles className="h-4 w-4 mr-1.5" />
                              Set Up AI Provider
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                              onClick={() => setShowSettings(true)}
                            >
                              <Settings className="h-4 w-4 mr-1.5" />
                              Open Settings
                            </Button>
                            {getProviderHelpUrl(settings.provider) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-amber-600 dark:text-amber-400"
                                onClick={() =>
                                  window.open(
                                    getProviderHelpUrl(settings.provider),
                                    "_blank",
                                  )
                                }
                              >
                                <ExternalLink className="h-4 w-4 mr-1.5" />
                                Get Help
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Status Indicators - Compact and Modern */}
                {!showSetupWizard && messages.length === 1 && (
                  <div className="space-y-2">
                    {settings.provider === "ollama" &&
                      ollamaConnectionStatus.connected === false && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">
                            Ollama connection failed
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-6 px-2 text-xs text-red-600 hover:text-red-700"
                            onClick={() => setShowSetupWizard(true)}
                          >
                            Fix Setup
                          </Button>
                        </div>
                      )}
                    {settings.clawdbotEnabled &&
                      clawdbotStatus.available === false && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            ClawdBot unavailable:{" "}
                            {clawdbotStatus.error || "CLI not found"}
                          </span>
                        </div>
                      )}
                    {settings.clawdbotEnabled &&
                      clawdbotStatus.available === true && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            ClawdBot ready • ClawdHub skills available
                          </span>
                        </div>
                      )}
                  </div>
                )}

                {/* Welcome State with Quick Actions */}
                {!showSetupWizard &&
                  messages.length === 1 &&
                  !clarificationQuestions.length &&
                  !implementationPlan && (
                    <div className="mb-8">
                      {/* Welcome Header */}
                      <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25 mb-4">
                          <Sparkles className="h-8 w-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                          How can I help you today?
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                          I can organize files, find duplicates, rename with
                          patterns, and more. Just describe what you need.
                        </p>
                      </div>

                      {/* Quick Actions */}
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
                                const clawdbotAgent = agentService
                                  .getAgents()
                                  .find((a) => a.type === "clawdbot");
                                if (clawdbotAgent) {
                                  agentService.startAgent(clawdbotAgent.id);
                                  addMessage(
                                    "assistant",
                                    `Started ClawdBot agent. You can now use ClawdBot commands in the chat.`,
                                  );
                                } else {
                                  addMessage(
                                    "assistant",
                                    "ClawdBot agent not found. Please check your agent configuration.",
                                  );
                                }
                              }}
                              className="h-9 px-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-orange-300 dark:hover:border-orange-700 transition-all"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                              <span className="text-sm text-slate-900 dark:text-slate-100">
                                Start ClawdBot
                              </span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const { Command } = await import(
                                    "@tauri-apps/plugin-shell"
                                  );
                                  const cmd = Command.create("clawdbot", [
                                    "plugins",
                                    "list",
                                    "--json",
                                  ]);
                                  const result = await cmd.execute();
                                  if (result.code === 0) {
                                    const cleanOutput = result.stdout.replace(
                                      /\u001b\[.*?m/g,
                                      "",
                                    );
                                    const plugins = JSON.parse(cleanOutput);
                                    const count = Array.isArray(plugins)
                                      ? plugins.length
                                      : 0;
                                    addMessage(
                                      "assistant",
                                      `Found ${count} ClawdHub skill${
                                        count !== 1 ? "s" : ""
                                      } installed. Use "list ClawdHub skills" to see details.`,
                                    );
                                  } else {
                                    addMessage(
                                      "assistant",
                                      "Failed to list ClawdHub skills. Make sure ClawdBot is properly configured.",
                                    );
                                  }
                                } catch (error: any) {
                                  addMessage(
                                    "assistant",
                                    `Error: ${
                                      error.message || "Failed to list skills"
                                    }`,
                                  );
                                }
                              }}
                              className="h-9 px-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-orange-300 dark:hover:border-orange-700 transition-all"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                              <span className="text-sm text-slate-900 dark:text-slate-100">
                                List Skills
                              </span>
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
                    onDelete={() =>
                      activeAgentId && deleteMessage(activeAgentId, message.id)
                    }
                    onWidgetUpdate={(widgetId, updates) => {
                      updateWidget(widgetId, updates, "user");
                      // If user is editing via natural language, process it
                      if (updates.params && inputValue) {
                        const widget = widgets.find((w) => w.id === widgetId);
                        if (widget) {
                          const naturalLanguageUpdates =
                            updateWidgetFromNaturalLanguage(widget, inputValue);
                          if (Object.keys(naturalLanguageUpdates).length > 0) {
                            updateWidget(
                              widgetId,
                              naturalLanguageUpdates,
                              "user",
                            );
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
                      const toolCommand = `Execute ${
                        widget.toolName
                      } with these parameters: ${JSON.stringify(
                        widget.params,
                      )}`;
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
                        <ToolUsageIndicator
                          toolExecutions={currentToolExecutions}
                        />
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
                    {executionProgress &&
                      implementationPlan &&
                      taskStartTime && (
                        <div className="mt-3">
                          <TaskProgressTracker
                            taskName={
                              implementationPlan.task || "Executing Plan"
                            }
                            currentStep={executionProgress.currentStep}
                            totalSteps={implementationPlan.steps.length}
                            currentStage={executionProgress.progress.stage}
                            startTime={taskStartTime}
                            estimatedDuration={
                              implementationPlan.estimatedTotalTime
                            }
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
                        console.log("Verify results");
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

          {/* Chat Input Area - Modern Design */}
          <div className="shrink-0 px-5 py-4 bg-gradient-to-t from-white via-white to-white/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/80 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto">
              <ChatInput
                value={
                  voiceListening
                    ? inputValue +
                      (voiceTranscribing ? " " + voiceTranscribing : "...")
                    : inputValue
                }
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
                  setDirectory(path);
                  // Store in localStorage for agents to use
                  if (path) {
                    localStorage.setItem(
                      "ai-assistant-current-directory",
                      path,
                    );
                  }
                  addMessage("assistant", `Working directory set to: ${path}`);
                }}
                currentDirectory={currentDirectory}
                isProcessing={isProcessing}
                disabled={isProcessing}
                placeholder="How can I help you today?"
                aiModel={settings.model}
                onModelChange={(model) =>
                  updateSettings({ model: model as AISettings["model"] })
                }
                provider={settings.provider}
                onProviderChange={(provider) => updateSettings({ provider })}
                ollamaBaseUrl={settings.ollamaBaseUrl}
                onVoiceClick={handleVoiceClick}
                onDictateClick={handleDictateClick}
                isVoiceActive={voiceInputActive}
                isDictateActive={showVoiceToText}
                onConnectorsClick={() => {
                  setShowVoiceToText(false);
                  setShowSettings(true);
                }}
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
            onUpdate={(updates) =>
              setVoiceSettings((prev: VoiceSettings) => ({
                ...prev,
                ...updates,
              }))
            }
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
                console.log("[Voice] onInsertToChat called with text:", text);
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
