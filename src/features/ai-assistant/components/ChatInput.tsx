/**
 * File: src/features/ai-assistant/components/ChatInput.tsx
 *
 * Modern chat input component with enhanced design.
 * Features integrated folder selection, AI model selector, attachment menu, and send button.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Mic,
  AudioLines,
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
  Globe,
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
  /** Send message. If content is provided, that is sent; otherwise the handler may use context input. */
  onSend: (content?: string) => void;
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
  /** Called when user clicks "Connectors" in the attachment menu; e.g. open Settings. */
  onConnectorsClick?: () => void;
  /** Called when user selects files via "Add files or photos"; optional. */
  onFilesSelected?: (paths: string[]) => void;
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
  onConnectorsClick,
  onFilesSelected,
  className,
}: ChatInputProps) => {
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
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
      const textToSend = value.trim();
      if (textToSend && !isProcessing && !disabled) {
        onSend(textToSend);
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

  /** Add files or photos: open file picker, append selected paths to input. */
  const handleAddFiles = useCallback(async () => {
    setShowAttachmentMenu(false);
    try {
      const selected = await open({
        directory: false,
        multiple: true,
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          const prefix = value.trim() ? value.trimEnd() + "\n\n" : "";
          const fileList = `[Attached ${paths.length} file${paths.length > 1 ? "s" : ""}]\n${paths.join("\n")}`;
          onChange(prefix + fileList);
          onFilesSelected?.(paths);
        }
      }
    } catch (error) {
      console.error("Error selecting files:", error);
    }
  }, [value, onChange, onFilesSelected]);

  /** Include project: open directory picker and set as working directory (same as "Choose folder"). */
  const handleIncludeProject = useCallback(async () => {
    setShowAttachmentMenu(false);
    await handleChooseDifferentFolder();
  }, [handleChooseDifferentFolder]);

  /** Connectors: open Settings/connectors config (e.g. MCP). */
  const handleConnectors = useCallback(() => {
    setShowAttachmentMenu(false);
    onConnectorsClick?.();
  }, [onConnectorsClick]);

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



  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative flex flex-col gap-3 p-4 rounded-2xl",
          "bg-white dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80",
          "shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50 transition-all duration-300",
          isFocused && "ring-2 ring-violet-500/20 border-violet-300/50 dark:border-violet-700/50 shadow-xl shadow-violet-500/10",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {/* Input Field (Top) - Enhanced */}
        <div className="w-full relative min-h-[28px]">
          <Textarea
            ref={(ref) => {
              // Handle both the internal ref and the forwarded ref logic if needed
              // For now we just use a local ref for resizing
              if (ref) {
                // Auto-resize logic could go here if not handled by component
              }
              // We can cast the ref to any if needed, but for now we just ignore
            }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isVoiceActive ? "Listening..." : placeholder}
            className={cn(
              "min-h-[28px] max-h-[200px] w-full resize-none border-0 bg-transparent p-0",
              "placeholder:text-slate-400 dark:placeholder:text-slate-500",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "text-base leading-relaxed text-slate-900 dark:text-slate-100",
              disabled && "opacity-50 cursor-not-allowed",
              isVoiceActive && "placeholder:text-violet-500/70 dark:placeholder:text-violet-400/70"
            )}
            disabled={disabled || isProcessing}
            rows={1}
            style={{
              height: "auto", 
              overflowY: value.split('\n').length > 8 ? "auto" : "hidden"
            }}
            // Auto-resize
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
          
          {/* Voice Active Indicator - Enhanced */}
          {isVoiceActive && (
            <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 pointer-events-none">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-gradient-to-r from-violet-500 to-purple-500"></span>
              </span>
            </div>
          )}
        </div>

        {/* Toolbar (Bottom) - Enhanced */}
        <div className="w-full flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/50">
          {/* Left Side - Folder and Plus Icons */}
          <div className="flex items-center gap-1 shrink-0 relative">
            {/* Plus Button with Attachment Menu */}
            <div className="relative" ref={attachmentMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAttachmentClick}
                disabled={disabled}
                className="h-8 w-8 p-0 text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-xl transition-all duration-200"
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

            {/* Folder Button with Recent Menu */}
            <div className="relative" ref={folderMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectDirectoryClick}
                disabled={disabled}
                className="h-8 px-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:border-violet-200 dark:hover:border-violet-800 text-slate-600 dark:text-slate-300 text-xs gap-1.5 rounded-xl transition-all duration-200"
                title={currentDirectory || "Select working directory"}
              >
                <FolderOpen className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400 shrink-0" />
                <span className="max-w-[100px] truncate font-medium">
                   {currentDirectory ? currentDirectory.split("/").pop() : "Context"}
                </span>
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
          </div>

          {/* Right Side - AI Model Selector, Voice, and Send */}
          <div className="flex items-center gap-1.5 shrink-0 relative">
            {/* AI Model Selector */}
            {provider === "ollama" ? (
              // Ollama: Model selector dropdown - Compact version
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
                  className="h-7 px-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs max-w-[100px] justify-between transition-colors rounded-full"
                  title={ollamaConnectionError || aiModel || "Select model"}
                >
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <Server
                      className={cn(
                        "h-3 w-3 shrink-0",
                        ollamaConnectionError
                          ? "text-red-500"
                          : "text-purple-500 dark:text-purple-400",
                      )}
                    />
                    <span
                      className="truncate text-[10px] leading-tight"
                      title={ollamaConnectionError || aiModel}
                    >
                      {ollamaConnectionError
                        ? "Error"
                        : aiModel 
                          ? (() => {
                              // Abbreviate long model names intelligently
                              if (aiModel.length > 10) {
                                // For models like "deepseek-r1:8b" -> "deepseek:8b"
                                const parts = aiModel.split(':');
                                if (parts.length > 1) {
                                  let firstPart = parts[0];
                                  firstPart = firstPart.replace(/-r\d+$/, '');
                                  if (firstPart.length > 8) {
                                    firstPart = firstPart.substring(0, 8);
                                  }
                                  return firstPart + ':' + parts[1];
                                }
                                return aiModel.substring(0, 10);
                              }
                              return aiModel;
                            })()
                          : "llama3.2"}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-0.5 shrink-0" />
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
                            {provider === "ollama" && <Check className="h-4 w-4 text-purple-500 shrink-0" />}
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
                            {provider === "anthropic" && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                          </button>
                          <button
                            onClick={() => {
                              onProviderChange("openrouter");
                              setShowModelMenu(false);
                            }}
                            className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                              <span className="text-slate-900 dark:text-slate-100">
                                OpenRouter (Multi-Model)
                              </span>
                            </div>
                            {provider === "openrouter" && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
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
                          {ollamaModels.map((model) => (
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
                              </div>
                              {aiModel === model && (
                                <Check className="h-4 w-4 text-purple-500 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                        <div className={ollamaConnectionError ? "text-red-500" : ""}>
                          {ollamaConnectionError || "No models found"}
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
                        onClick={() => loadOllamaModels()}
                        className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 transition-colors"
                      >
                        Refresh models
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : provider === "openrouter" ? (
              // OpenRouter: Compact selector – model configured in Settings
              <div className="relative" ref={modelMenuRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  disabled={disabled || isProcessing}
                  className="h-7 px-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs max-w-[120px] justify-between transition-colors rounded-full"
                  title={aiModel || "OpenRouter – configure in Settings"}
                >
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <Globe className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span className="truncate text-[10px] leading-tight">
                      {aiModel ? (aiModel.length > 12 ? aiModel.replace(/^[^/]+\//, "").substring(0, 12) + "…" : aiModel) : "OpenRouter"}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-0.5 shrink-0" />
                </Button>
                {showModelMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                    {onProviderChange && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                          Provider
                        </div>
                        <div className="py-1">
                          <button
                            onClick={() => { onProviderChange("openrouter"); setShowModelMenu(false); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                              <span className="text-slate-900 dark:text-slate-100">OpenRouter (Multi-Model)</span>
                            </div>
                            <Check className="h-4 w-4 text-blue-500 shrink-0" />
                          </button>
                          <button
                            onClick={() => { onProviderChange("anthropic"); setShowModelMenu(false); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Cloud className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                              <span className="text-slate-900 dark:text-slate-100">Anthropic Claude (Cloud)</span>
                            </div>
                          </button>
                          <button
                            onClick={() => { onProviderChange("ollama"); setShowModelMenu(false); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                              <span className="text-slate-900 dark:text-slate-100">Ollama (Local LLM)</span>
                            </div>
                          </button>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50">
                          Model: configure in Settings
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Anthropic: Enhanced model selector - Compact version
              <div className="relative" ref={modelMenuRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  disabled={disabled || isProcessing}
                  className="h-7 px-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs max-w-[100px] justify-between transition-colors rounded-full"
                  title={getModelDisplayName(aiModel)}
                >
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <Cloud className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span className="truncate text-[10px] leading-tight">
                      {(() => {
                        const displayName = getModelDisplayName(aiModel);
                        if (displayName.length > 12) {
                          return displayName.replace(/Claude/g, "C").substring(0, 12);
                        }
                        return displayName;
                      })()}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-0.5 shrink-0" />
                </Button>

                {showModelMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                    {onProviderChange && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                          Provider
                        </div>
                        <div className="py-1">
                          <button
                            onClick={() => { onProviderChange("anthropic"); setShowModelMenu(false); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Cloud className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                              <span className="text-slate-900 dark:text-slate-100">Anthropic Claude (Cloud)</span>
                            </div>
                            {provider === "anthropic" && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                          </button>
                          <button
                            onClick={() => { onProviderChange("openrouter"); setShowModelMenu(false); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                              <span className="text-slate-900 dark:text-slate-100">OpenRouter (Multi-Model)</span>
                            </div>
                            {provider === "openrouter" && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                          </button>
                          <button
                            onClick={() => { onProviderChange("ollama"); setShowModelMenu(false); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                              <span className="text-slate-900 dark:text-slate-100">Ollama (Local LLM)</span>
                            </div>
                            {provider === "ollama" && <Check className="h-4 w-4 text-purple-500 shrink-0" />}
                          </button>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-800" />
                      </>
                    )}
                    <div className="py-1">
                      {["claude-opus", "claude-sonnet", "claude-haiku"].map((m) => (
                        <button
                          key={m}
                          onClick={() => { onModelChange(m); setShowModelMenu(false); }}
                          className="w-full px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between text-sm transition-colors"
                        >
                          <div className="text-slate-900 dark:text-slate-100 font-medium">
                            {getModelDisplayName(m)}
                          </div>
                          {aiModel === m && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Voice Button */}
            {onVoiceClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onVoiceClick}
                disabled={disabled || isProcessing}
                className={cn(
                  "h-7 w-7 p-0 rounded-full transition-colors",
                  isVoiceActive
                    ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
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
                    "h-7 w-7 p-0 rounded-full transition-colors",
                    isDictateActive
                      ? "bg-slate-900 dark:bg-slate-800 text-white"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                  )}
                  title="Dictate"
                >
                  <AudioLines className="h-4 w-4" />
                </Button>
                {/* Tooltip */}
                <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Voice Mode
                  <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                </div>
              </div>
            )}

            {/* Send Button - Pass current value so send always uses what's in the input */}
            <Button
              type="button"
              onClick={() => {
                const textToSend = value.trim();
                if (textToSend && !isProcessing && !disabled) {
                  onSend(textToSend);
                }
              }}
              disabled={!value.trim() || isProcessing || disabled}
              className={cn(
                "h-9 w-9 p-0 rounded-xl ml-1.5",
                "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700",
                "text-white border-0",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500",
                "transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30",
                "hover:scale-105 active:scale-95",
              )}
              title="Send message"
              aria-label="Send message"
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
    </div>
  );
};
