/**
 * File: src/features/ai-assistant/components/ChatInput.tsx
 *
 * Chat input component matching the design specification.
 * Features integrated folder selection, AI model selector, attachment menu, and send button.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Plus,
  Send,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Folder,
  Grid3x3,
  Check,
  Server,
  Cloud,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import type { AIProvider } from "../types";
import { listOllamaModels } from "../utils/ollamaService";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSelectDirectory?: (path: string) => void;
  currentDirectory?: string;
  isProcessing?: boolean;
  disabled?: boolean;
  placeholder?: string;
  aiModel: string;
  onModelChange: (model: string) => void;
  provider?: AIProvider;
  onProviderChange?: (provider: AIProvider) => void;
  ollamaBaseUrl?: string;
  onVoiceClick?: () => void;
  onDictateClick?: () => void;
  isVoiceActive?: boolean;
  isDictateActive?: boolean;
  className?: string;
}

interface RecentFolder {
  name: string;
  path: string;
  lastAccessed: number;
}

const STORAGE_KEY_RECENT_FOLDERS = "ai-assistant-recent-folders";
const MAX_RECENT_FOLDERS = 5;

export const ChatInput = ({
  value,
  onChange,
  onSend,
  onSelectDirectory,
  currentDirectory,
  isProcessing = false,
  disabled = false,
  placeholder = "How can I help you today?",
  aiModel,
  onModelChange,
  provider = "anthropic",
  onProviderChange,
  ollamaBaseUrl = "http://localhost:11434",
  onVoiceClick,
  onDictateClick,
  isVoiceActive = false,
  isDictateActive = false,
  className,
}: ChatInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showMoreModels, setShowMoreModels] = useState(false);
  const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);
  const [ollamaConnectionError, setOllamaConnectionError] = useState<
    string | null
  >(null);

  // Define addToRecentFolders before it's used in useEffect
  const addToRecentFolders = useCallback((path: string) => {
    setRecentFolders((prev) => {
      // Remove if already exists
      const filtered = prev.filter((f) => f.path !== path);

      // Extract folder name from path
      const name = path.split("/").pop() || path;

      // Add to beginning
      const updated = [
        { name, path, lastAccessed: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT_FOLDERS);

      return updated;
    });
  }, []);

  // Define loadOllamaModels before it's used in useEffect
  const loadOllamaModels = useCallback(async () => {
    setIsLoadingOllamaModels(true);
    setOllamaConnectionError(null);
    try {
      const models = await listOllamaModels(ollamaBaseUrl);
      setOllamaModels(models);
    } catch (error: any) {
      console.error("Failed to load Ollama models:", error);
      setOllamaModels([]);
      setOllamaConnectionError(error.message || "Failed to connect to Ollama");
    } finally {
      setIsLoadingOllamaModels(false);
    }
  }, [ollamaBaseUrl]);

  // Load recent folders from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECENT_FOLDERS);
      if (saved) {
        setRecentFolders(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load recent folders:", error);
    }
  }, []);

  // Save recent folders to localStorage
  useEffect(() => {
    if (recentFolders.length > 0) {
      try {
        localStorage.setItem(
          STORAGE_KEY_RECENT_FOLDERS,
          JSON.stringify(recentFolders),
        );
      } catch (error) {
        console.error("Failed to save recent folders:", error);
      }
    }
  }, [recentFolders]);

  // Add current directory to recent folders when it changes
  useEffect(() => {
    if (currentDirectory) {
      addToRecentFolders(currentDirectory);
    }
  }, [currentDirectory, addToRecentFolders]);

  // Load Ollama models when provider is Ollama
  useEffect(() => {
    if (provider === "ollama") {
      loadOllamaModels();
    }
  }, [provider, ollamaBaseUrl, loadOllamaModels]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        folderMenuRef.current &&
        !folderMenuRef.current.contains(event.target as Node)
      ) {
        setShowFolderMenu(false);
      }
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target as Node)
      ) {
        setShowAttachmentMenu(false);
      }
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(event.target as Node)
      ) {
        setShowModelMenu(false);
        setShowMoreModels(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFolderSelect = useCallback(
    (path: string) => {
      addToRecentFolders(path);
      if (onSelectDirectory) {
        onSelectDirectory(path);
      }
      setShowFolderMenu(false);
    },
    [onSelectDirectory, addToRecentFolders],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isProcessing && !disabled) {
        onSend();
      }
    }
  };

  const handleSelectDirectoryClick = async () => {
    setShowFolderMenu(!showFolderMenu);
    setShowAttachmentMenu(false);
  };

  const handleChooseDifferentFolder = async () => {
    setShowFolderMenu(false);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        handleFolderSelect(selected);
      }
    } catch (error) {
      console.error("Error selecting directory:", error);
    }
  };

  const handleAttachmentClick = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
    setShowFolderMenu(false);
  };

  const handleAddFiles = () => {
    setShowAttachmentMenu(false);
    // TODO: Implement file selection
    console.log("Add files clicked");
  };

  const handleIncludeProject = () => {
    setShowAttachmentMenu(false);
    // TODO: Implement project inclusion
    console.log("Include project clicked");
  };

  const handleConnectors = () => {
    setShowAttachmentMenu(false);
    // TODO: Implement connectors
    console.log("Connectors clicked");
  };

  const getModelDisplayName = (model: string): string => {
    const modelMap: Record<string, string> = {
      "claude-sonnet": "Sonnet 4.5",
      "claude-opus": "Opus 4.5",
      "claude-haiku": "Haiku 4.5",
      "claude-sonnet-4": "Sonnet 4",
      "claude-opus-3": "Opus 3",
      "claude-haiku-3.5": "Haiku 3.5",
    };
    return modelMap[model] || model;
  };

  const getModelDescription = (model: string): string => {
    const descriptions: Record<string, string> = {
      "claude-sonnet": "Best for everyday tasks",
      "claude-opus": "Most capable for complex work",
      "claude-haiku": "Fastest for quick answers",
    };
    return descriptions[model] || "";
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative flex items-center gap-2.5 px-4 py-3 rounded-2xl",
          "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
          "shadow-sm transition-all duration-200",
          isFocused && "ring-2 ring-blue-500/30 border-blue-500/50 shadow-md",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {/* Left Side - Folder and Plus Icons */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          {/* Folder Button with Recent Menu */}
          <div className="relative" ref={folderMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectDirectoryClick}
              disabled={disabled}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Select directory"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>

            {/* Recent Folders Menu */}
            {showFolderMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  Recent Folders
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {recentFolders.length > 0 ? (
                    recentFolders.map((folder) => (
                      <button
                        key={folder.path}
                        onClick={() => handleFolderSelect(folder.path)}
                        className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-start gap-2.5 group transition-colors"
                      >
                        <Folder className="h-4 w-4 mt-0.5 text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-900 dark:text-slate-100 truncate font-medium">
                            {folder.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {folder.path}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                      No recent folders
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  <button
                    onClick={handleChooseDifferentFolder}
                    className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Choose a different folder
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Plus Button with Attachment Menu */}
          <div className="relative" ref={attachmentMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAttachmentClick}
              disabled={disabled}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Add files, connectors, and more"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {/* Attachment Menu */}
            {showAttachmentMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                <button
                  onClick={handleAddFiles}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center gap-3 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                >
                  <Paperclip className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  Add files or photos
                </button>
                <button
                  onClick={handleIncludeProject}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm text-slate-900 dark:text-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    Include project
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </button>
                <button
                  onClick={handleConnectors}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm text-slate-900 dark:text-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Grid3x3 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    Connectors
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Input Field */}
        <div className="flex-1 relative min-h-[44px] flex items-center">
          <Textarea
            ref={inputRef as any}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled || isProcessing}
            className={cn(
              "w-full border-0 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "text-sm pr-2 resize-none min-h-[24px] max-h-[200px] py-2",
              "scrollbar-hide",
            )}
            rows={1}
            style={{
              height: "auto",
              minHeight: "24px",
            }}
          />
        </div>

        {/* Right Side - AI Model Selector and Send */}
        <div className="flex items-center gap-2 shrink-0 relative">
          {/* AI Model Selector */}
          {provider === "ollama" ? (
            // Ollama: Model selector dropdown
            <div className="relative" ref={modelMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowModelMenu(!showModelMenu);
                  if (!showModelMenu && ollamaModels.length === 0) {
                    loadOllamaModels();
                  }
                }}
                disabled={disabled || isProcessing}
                className="h-8 px-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs min-w-[130px] justify-between transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Server
                    className={cn(
                      "h-3 w-3 shrink-0",
                      ollamaConnectionError
                        ? "text-red-500"
                        : "text-purple-500 dark:text-purple-400",
                    )}
                  />
                  <span
                    className="truncate"
                    title={ollamaConnectionError || aiModel}
                  >
                    {ollamaConnectionError
                      ? "Connection Failed"
                      : aiModel || "llama3.2:3b"}
                  </span>
                  {ollamaConnectionError && (
                    <div
                      className="h-2 w-2 rounded-full bg-red-500 ml-1 shrink-0 animate-pulse"
                      title="Connection failed"
                    />
                  )}
                </div>
                <ChevronDown className="h-3 w-3 opacity-50 ml-1 shrink-0" />
              </Button>

              {/* Ollama Model Selection Menu */}
              {showModelMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                  {/* Provider Selector */}
                  {onProviderChange && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                        Provider
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            onProviderChange("ollama");
                            setShowModelMenu(false);
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                            <span className="text-slate-900 dark:text-slate-100">
                              Ollama (Local LLM)
                            </span>
                          </div>
                          <Check className="h-4 w-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => {
                            onProviderChange("anthropic");
                            setShowModelMenu(false);
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                            <span className="text-slate-900 dark:text-slate-100">
                              Anthropic Claude (Cloud)
                            </span>
                          </div>
                          {/* Anthropic not active */}
                        </button>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-800" />
                    </>
                  )}

                  {isLoadingOllamaModels ? (
                    <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                      Loading models...
                    </div>
                  ) : ollamaModels.length > 0 ? (
                    <>
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                            Tools
                          </span>
                          <span className="text-xs">
                            = Supports file operations
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium">
                            No Tools
                          </span>
                          <span className="text-xs">
                            = Limited functionality
                          </span>
                        </div>
                      </div>
                      <div className="py-1 max-h-64 overflow-y-auto">
                        {ollamaModels.map((model) => {
                          // Models known to support tools
                          const modelsWithToolSupport = [
                            "llama3.2:3b",
                            "llama3.2:1b",
                            "llama3.1:8b",
                            "llama3.1:70b",
                            "qwen2.5:7b",
                            "qwen2.5:14b",
                            "qwen2.5:32b",
                            "mistral:7b",
                            "mistral:8x7b",
                          ];

                          // Check if model supports tools (exact match or starts with)
                          const supportsTools =
                            modelsWithToolSupport.some(
                              (supported) =>
                                model === supported ||
                                model.startsWith(supported.split(":")[0] + ":"),
                            ) ||
                            model.includes("3.2") ||
                            model.includes("3.1") ||
                            model.includes("qwen2.5");

                          // Models known NOT to support tools
                          const modelsWithoutToolSupport = [
                            "llama3:latest",
                            "llama3",
                          ];
                          const knownNoTools = modelsWithoutToolSupport.some(
                            (noTools) =>
                              model === noTools ||
                              model.startsWith(noTools + ":"),
                          );

                          const hasToolSupport =
                            !knownNoTools &&
                            (supportsTools || !model.includes("llama3:"));

                          return (
                            <button
                              key={model}
                              onClick={() => {
                                onModelChange(model);
                                setShowModelMenu(false);
                              }}
                              className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-slate-900 dark:text-slate-100 truncate">
                                  {model}
                                </span>
                                {hasToolSupport && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium shrink-0">
                                    Tools
                                  </span>
                                )}
                                {knownNoTools && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium shrink-0">
                                    No Tools
                                  </span>
                                )}
                              </div>
                              {aiModel === model && (
                                <Check className="h-4 w-4 text-blue-500 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                      <div
                        className={
                          ollamaConnectionError
                            ? "text-red-500 dark:text-red-400"
                            : ""
                        }
                      >
                        {ollamaConnectionError || "No models found"}
                      </div>
                      <div className="text-xs mt-1 text-slate-400 dark:text-slate-500">
                        {ollamaConnectionError
                          ? "Check if Ollama is running"
                          : "Make sure you have pulled a model"}
                      </div>
                      {ollamaConnectionError && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadOllamaModels();
                          }}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <button
                      onClick={() => {
                        loadOllamaModels();
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 transition-colors"
                    >
                      Refresh models
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Anthropic: Enhanced model selector with descriptions
            <div className="relative" ref={modelMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowModelMenu(!showModelMenu);
                  setShowMoreModels(false);
                }}
                disabled={disabled || isProcessing}
                className="h-8 px-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs min-w-[130px] justify-between transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Cloud className="h-3 w-3 text-blue-500 dark:text-blue-400 shrink-0" />
                  <span className="truncate">
                    {getModelDisplayName(aiModel)}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 opacity-50 ml-1 shrink-0" />
              </Button>

              {/* Model Selection Menu */}
              {showModelMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                  {/* Provider Selector */}
                  {onProviderChange && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                        Provider
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            onProviderChange("anthropic");
                            setShowModelMenu(false);
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                            <span className="text-slate-900 dark:text-slate-100">
                              Anthropic Claude (Cloud)
                            </span>
                          </div>
                          {/* Anthropic active */}
                          <Check className="h-4 w-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => {
                            onProviderChange("ollama");
                            setShowModelMenu(false);
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                            <span className="text-slate-900 dark:text-slate-100">
                              Ollama (Local LLM)
                            </span>
                          </div>
                          {/* Ollama not active */}
                        </button>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-800" />
                    </>
                  )}

                  {/* Main Models */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        onModelChange("claude-opus");
                        setShowModelMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                    >
                      <div>
                        <div className="text-slate-900 dark:text-slate-100 font-medium">
                          Opus 4.5
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Most capable for complex work
                        </div>
                      </div>
                      {aiModel === "claude-opus" && (
                        <Check className="h-4 w-4 text-blue-500" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onModelChange("claude-sonnet");
                        setShowModelMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                    >
                      <div>
                        <div className="text-slate-900 dark:text-slate-100 font-medium">
                          Sonnet 4.5
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Best for everyday tasks
                        </div>
                      </div>
                      {aiModel === "claude-sonnet" && (
                        <Check className="h-4 w-4 text-blue-500" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onModelChange("claude-haiku");
                        setShowModelMenu(false);
                      }}
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                    >
                      <div>
                        <div className="text-slate-900 dark:text-slate-100 font-medium">
                          Haiku 4.5
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Fastest for quick answers
                        </div>
                      </div>
                      {aiModel === "claude-haiku" && (
                        <Check className="h-4 w-4 text-blue-500" />
                      )}
                    </button>
                  </div>

                  {/* More Models Option */}
                  <div className="border-t border-slate-200 dark:border-slate-800 relative">
                    <button
                      onClick={() => setShowMoreModels(!showMoreModels)}
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm text-slate-900 dark:text-slate-100 transition-colors"
                    >
                      <span>More models</span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform",
                          showMoreModels && "rotate-90",
                        )}
                      />
                    </button>

                    {/* Nested More Models Menu */}
                    {showMoreModels && (
                      <div className="absolute right-full top-0 mr-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
                        <button
                          onClick={() => {
                            onModelChange("claude-sonnet-4");
                            setShowModelMenu(false);
                            setShowMoreModels(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                        >
                          Sonnet 4
                        </button>
                        <button
                          onClick={() => {
                            onModelChange("claude-opus-3");
                            setShowModelMenu(false);
                            setShowMoreModels(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                        >
                          Opus 3
                        </button>
                        <button
                          onClick={() => {
                            onModelChange("claude-haiku-3.5");
                            setShowModelMenu(false);
                            setShowMoreModels(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                        >
                          Haiku 3.5
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Voice Button - Quick Voice Input */}
          {onVoiceClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onVoiceClick}
              disabled={disabled || isProcessing}
              className={cn(
                "h-8 w-8 p-0 rounded-full transition-colors",
                isVoiceActive
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
              )}
              title="Voice input"
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}

          {/* Dictate Button - Open Voice-to-Text Panel */}
          {onDictateClick && (
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                onClick={onDictateClick}
                disabled={disabled || isProcessing}
                className={cn(
                  "h-8 w-8 p-0 rounded-full transition-colors",
                  isDictateActive
                    ? "bg-slate-900 dark:bg-slate-800 text-white"
                    : "bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white",
                )}
                title="Dictate"
              >
                {/* Sound wave bars icon */}
                <div className="flex items-center justify-center gap-0.5 h-full">
                  <div className="h-2 w-0.5 bg-white rounded-full" />
                  <div className="h-3 w-0.5 bg-white rounded-full" />
                  <div className="h-4 w-0.5 bg-white rounded-full" />
                </div>
              </Button>
              {/* Tooltip */}
              <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Dictate
                <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
              </div>
            </div>
          )}

          {/* Send Button */}
          <Button
            onClick={onSend}
            disabled={!value.trim() || isProcessing || disabled}
            className={cn(
              "h-8 w-8 p-0 rounded-lg",
              "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
              "text-white border-0",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all shadow-sm hover:shadow-md",
            )}
            title="Send message"
          >
            {isProcessing ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
