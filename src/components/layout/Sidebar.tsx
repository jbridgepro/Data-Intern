/**
 * File: src/components/layout/Sidebar.tsx
 *
 * Frontend: Main application sidebar component with enhanced features
 * - Search/filter functionality
 * - Keyboard shortcuts display
 * - Grouped navigation sections
 * - Recent items tracking
 * - Improved animations and UX
 * - Minimized/Collapsed mode support
 * - Hover-expand and auto-collapse functionality
 * - Pinned/Unpinned state management
 */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  FolderTree,
  Copy,
  FolderPlus,
  FilePlus,
  Terminal,
  Settings,
  Search,
  Sparkles,
  Moon,
  Sun,
  Bot,
  Database,
  Layout,
  ChevronDown,
  ChevronRight,
  X,
  Clock,
  Menu,
  ChevronLeft,
  Pin,
  PinOff,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../ui/badge";
import { Input } from "@/components/ui/input";
import { useAgentManager } from "../../features/agents/hooks/useAgentManager";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  themeMode: "light" | "dark";
  toggleTheme: () => void;
  agentSidebarOpen: boolean;
  onToggleAgentSidebar: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

// Navigation item interface with additional metadata
interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  category: "file-operations" | "tools" | "ai" | "system";
  description?: string;
}

// Navigation sections configuration
const NAV_SECTIONS = {
  "file-operations": {
    label: "File Operations",
    icon: FolderTree,
    defaultExpanded: true,
  },
  tools: {
    label: "Tools",
    icon: Terminal,
    defaultExpanded: true,
  },
  ai: {
    label: "AI & Assistant",
    icon: Sparkles,
    defaultExpanded: true,
  },
  system: {
    label: "System",
    icon: Settings,
    defaultExpanded: true,
  },
};

export const Sidebar = ({
  activeTab,
  setActiveTab,
  themeMode,
  toggleTheme,
  agentSidebarOpen,
  onToggleAgentSidebar,
  isMinimized = false,
  onToggleMinimize,
}: SidebarProps) => {
  const { getRunningAgents } = useAgentManager();
  const runningAgents = getRunningAgents();
  const hasRunningAgents = runningAgents.length > 0;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(
      Object.keys(NAV_SECTIONS).filter(
        (key) => NAV_SECTIONS[key as keyof typeof NAV_SECTIONS].defaultExpanded,
      ),
    ),
  );
  const [recentItems, setRecentItems] = useState<string[]>(() => {
    const saved = localStorage.getItem("sidebar-recent-items");
    return saved ? JSON.parse(saved) : [];
  });

  const [isHovered, setIsHovered] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Effective expanded state: If not minimized OR if currently hovered (while minimized)
  const isExpanded = !isMinimized || isHovered;

  // Get modifier key symbol for display (platform-aware) - memoized
  const modifierSymbol = useMemo(() => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    return isMac ? "⌘" : "Ctrl";
  }, []);

  // Navigation items with categories and metadata
  const navItems: NavItem[] = [
    {
      id: "mapper",
      label: "File Mapper",
      icon: FolderTree,
      category: "file-operations",
      description: "Map and visualize file structures",
      shortcut: "1",
    },
    {
      id: "copy",
      label: "Copy / Move",
      icon: Copy,
      category: "file-operations",
      description: "Copy files and directories",
      shortcut: "2",
    },
    {
      id: "folder",
      label: "Folder Creation",
      icon: FolderPlus,
      category: "file-operations",
      description: "Create folder structures",
      shortcut: "3",
    },
    {
      id: "empty",
      label: "File Creation",
      icon: FilePlus,
      category: "file-operations",
      description: "Create empty files",
      shortcut: "4",
    },
    {
      id: "terminal",
      label: "Terminal",
      icon: Terminal,
      category: "tools",
      description: "Integrated terminal",
      shortcut: "5",
    },
    {
      id: "find-replace",
      label: "Find & Replace",
      icon: Search,
      category: "tools",
      description: "Search and replace in files",
      shortcut: "6",
    },
    {
      id: "sql-export",
      label: "SQL Wizard",
      icon: Database,
      category: "tools",
      description: "Export data to SQL",
      shortcut: "7",
    },
    {
      id: "ai-assistant",
      label: "AI Assistant",
      icon: Sparkles,
      category: "ai",
      description: "AI-powered file operations",
      shortcut: "8",
    },
    {
      id: "panel-config",
      label: "Panel Config",
      icon: Layout,
      category: "system",
      description: "Configure UI panels",
      shortcut: "9",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      category: "system",
      description: "Application settings",
      shortcut: "0",
    },
  ];

  // Track recent items when active tab changes
  useEffect(() => {
    if (activeTab) {
      setRecentItems((prev) => {
        const filtered = prev.filter((id) => id !== activeTab);
        const updated = [activeTab, ...filtered].slice(0, 5); // Keep last 5
        localStorage.setItem("sidebar-recent-items", JSON.stringify(updated));
        return updated;
      });
    }
  }, [activeTab]);

  // Filter navigation items based on search query
  const filteredNavItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const query = searchQuery.toLowerCase();
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    filteredNavItems.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredNavItems]);

  // Toggle section expansion
  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === "k" && !e.shiftKey) {
        e.preventDefault();
        if (isExpanded) {
          searchInputRef.current?.focus();
        } else if (onToggleMinimize) {
          onToggleMinimize();
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
        return;
      }

      if (
        e.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        setSearchQuery("");
        searchInputRef.current?.blur();
        return;
      }

      if (!searchQuery && document.activeElement !== searchInputRef.current) {
        const numberKey = e.key;
        const item = navItems.find((item) => item.shortcut === numberKey);
        if (item && modKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          setActiveTab(item.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, setActiveTab, isExpanded, onToggleMinimize]);

  // Get recent items (excluding current active tab)
  const recentNavItems = useMemo(() => {
    return recentItems
      .filter((id) => id !== activeTab)
      .map((id) => navItems.find((item) => item.id === id))
      .filter((item): item is NavItem => item !== undefined)
      .slice(0, 3); // Show max 3 recent items
  }, [recentItems, activeTab]);

  // Render navigation item (Refactored for reuse)
  const renderNavItem = (item: NavItem, showTooltip: boolean) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    const content = (
      <button
        key={item.id}
        onClick={() => {
          setActiveTab(item.id);
          // If we are in hover-expand mode (minimized but expanded via hover),
          // we might want to collapse on select.
          if (isMinimized && isHovered) {
            // Optional: setIsHovered(false);
          }
        }}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group overflow-hidden w-full",
          !isExpanded ? "justify-center px-0 py-3" : "",
          isActive
            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50",
        )}
        title={!isExpanded ? undefined : item.description}
        aria-label={item.label}
      >
        {isActive && isExpanded && (
          <motion.div
            layoutId="activeTabSidebar"
            className="absolute left-0 w-1 h-6 bg-blue-600 dark:bg-blue-400 rounded-r-full"
            initial={false}
          />
        )}

        <Icon
          className={cn(
            "h-5 w-5 transition-colors flex-shrink-0",
            isActive
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200",
          )}
        />

        {isExpanded && (
          <div className="flex-1 text-left truncate flex items-center justify-between">
            <span className="truncate">{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded border dark:border-slate-700">
                {modifierSymbol}
                {item.shortcut}
              </span>
            )}
          </div>
        )}
      </button>
    );

    if (showTooltip && !isExpanded) {
      return (
        <Tooltip key={item.id} delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="flex flex-col gap-0.5"
          >
            <p className="font-medium">{item.label}</p>
            {item.description && (
              <p className="text-[10px] text-slate-400 max-w-[150px]">
                {item.description}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          "h-full flex flex-col glass transition-all duration-300 relative z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50",
          !isExpanded ? "w-16 items-center" : "w-[260px]",
          isMinimized &&
            isHovered &&
            "absolute left-0 top-0 shadow-2xl h-screen",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setSearchQuery("");
          if (document.activeElement === searchInputRef.current) {
            searchInputRef.current?.blur();
          }
        }}
      >
        {/* Header Section */}
        <div
          className={cn(
            "shrink-0 flex items-center w-full",
            !isExpanded ? "flex-col gap-4 py-4" : "p-4 justify-between",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2",
              !isExpanded && "justify-center",
            )}
          >
            <img
              src="/logo.svg"
              alt="File Pro Logo"
              className={cn(
                "object-contain drop-shadow-sm transition-all duration-300",
                !isExpanded ? "h-8 w-8" : "h-9 w-auto",
              )}
            />
          </div>

          {/* Toggle/Pin Controls */}
          <div className="flex items-center gap-1">
            {/* NOTE: Avoid tooltips on the pin button so they never block clicks */}
            {isExpanded && (
              <>
                {isMinimized ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (onToggleMinimize) {
                        onToggleMinimize();
                      }
                    }}
                    title="Pin Sidebar"
                    aria-label="Pin Sidebar"
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (onToggleMinimize) {
                        onToggleMinimize();
                      }
                    }}
                    title="Unpin Sidebar"
                    aria-label="Unpin Sidebar"
                  >
                    <PinOff className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}

            {!isExpanded && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400"
                onClick={(event) => {
                  event.stopPropagation();
                  if (onToggleMinimize) {
                    onToggleMinimize();
                  }
                }}
                title="Pin Sidebar"
                aria-label="Pin Sidebar"
              >
                <Pin className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div
          className={cn(
            "px-4 mb-2 pb-2 border-b border-transparent transition-all",
            isExpanded ? "opacity-100" : "opacity-0 h-0 hidden",
          )}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={`Search... (${modifierSymbol}K)`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 transition-all rounded-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3 w-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Search Icon (Minimized Only) */}
        {!isExpanded && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 mb-4"
                onClick={() => {
                  if (onToggleMinimize) onToggleMinimize();
                  setTimeout(() => searchInputRef.current?.focus(), 150);
                }}
              >
                <Search className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Search ({modifierSymbol}K)
            </TooltipContent>
          </Tooltip>
        )}

        {/* Navigation Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden w-full px-2 py-2 scrollbar-none hover:scrollbar-thin">
          {/* Recent Items (Expanded Only) */}
          {isExpanded && !searchQuery && recentNavItems.length > 0 && (
            <div className="mb-4 space-y-1">
              <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <Clock className="h-3 w-3" />
                Recent
              </div>
              {recentNavItems.map((item) => renderNavItem(item, false))}
              <div className="h-px bg-slate-200/50 dark:bg-slate-800/50 my-2 mx-2" />
            </div>
          )}

          <div className="space-y-4">
            {Object.entries(NAV_SECTIONS).map(([sectionKey, sectionConfig]) => {
              const sectionItems = groupedItems[sectionKey] || [];
              if (sectionItems.length === 0) return null;

              const isSectionExpanded = expandedSections.has(sectionKey);

              // Minimized Mode: Just show items directly
              if (!isExpanded) {
                return (
                  <div
                    key={sectionKey}
                    className="space-y-2 border-t border-slate-200/50 dark:border-slate-800/50 pt-3 first:border-0 first:pt-0"
                  >
                    {sectionItems.map((item) => renderNavItem(item, true))}
                  </div>
                );
              }

              // Expanded Mode: Show with headers
              return (
                <div key={sectionKey} className="space-y-1">
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors group"
                  >
                    {isSectionExpanded ? (
                      <ChevronDown className="h-2.5 w-2.5 transition-transform opacity-70" />
                    ) : (
                      <ChevronRight className="h-2.5 w-2.5 transition-transform opacity-70" />
                    )}
                    <span className="flex-1 text-left">
                      {sectionConfig.label}
                    </span>
                    <span className="text-[10px] opacity-40">
                      {sectionItems.length}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isSectionExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-0.5 mt-1">
                          {sectionItems.map((item) =>
                            renderNavItem(item, false),
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* No Results Message */}
          {isExpanded && searchQuery && filteredNavItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                <Search className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-medium">No results found</p>
              <p className="text-xs text-slate-400 mt-1">
                Try a different search term
              </p>
            </div>
          )}
        </div>

        {/* Footer Section */}
        <div
          className={cn(
            "shrink-0 border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 backdrop-blur-md",
            !isExpanded
              ? "p-2 space-y-4 flex flex-col items-center pb-4"
              : "p-3 space-y-1",
          )}
        >
          {/* Agent Sidebar Toggle */}
          <TooltipProvider>
            {!isExpanded ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleAgentSidebar}
                    className={cn(
                      "flex items-center justify-center h-10 w-10 rounded-lg transition-all duration-200 relative",
                      agentSidebarOpen
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50",
                    )}
                  >
                    <Bot className="h-5 w-5" />
                    {hasRunningAgents && (
                      <span className="absolute top-2 right-2 h-2 w-2 bg-green-500 rounded-full border border-white dark:border-slate-900" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Toggle Agents</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={onToggleAgentSidebar}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border relative overflow-hidden group",
                  agentSidebarOpen
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-transparent",
                )}
              >
                <div className="relative flex-shrink-0">
                  <Bot className="h-4 w-4" />
                  {hasRunningAgents && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                  )}
                </div>
                <span className="flex-1 text-left">Agents</span>
                {hasRunningAgents && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4.5 px-1.5 ml-auto"
                  >
                    {runningAgents.length}
                  </Badge>
                )}
              </button>
            )}
          </TooltipProvider>

          {/* Theme Toggle */}
          <TooltipProvider>
            {!isExpanded ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center h-10 w-10 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {themeMode === "dark" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Toggle Theme</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-all duration-200"
              >
                {themeMode === "dark" ? (
                  <>
                    <Sun className="h-4 w-4" />
                    <span className="flex-1 text-left">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" />
                    <span className="flex-1 text-left">Dark Mode</span>
                  </>
                )}
              </button>
            )}
          </TooltipProvider>
        </div>
      </div>
    </TooltipProvider>
  );
};
