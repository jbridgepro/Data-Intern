/**
 * File: src/components/layout/Sidebar.tsx
 * 
 * Frontend: Main application sidebar component with enhanced features
 * - Search/filter functionality
 * - Keyboard shortcuts display
 * - Grouped navigation sections
 * - Recent items tracking
 * - Improved animations and UX
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
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../ui/badge";
import { Input } from "@/components/ui/input";
import { useAgentManager } from "../../features/agents/hooks/useAgentManager";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  themeMode: "light" | "dark";
  toggleTheme: () => void;
  agentSidebarOpen: boolean;
  onToggleAgentSidebar: () => void;
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
}: SidebarProps) => {
  const { getRunningAgents } = useAgentManager();
  const runningAgents = getRunningAgents();
  const hasRunningAgents = runningAgents.length > 0;
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(Object.keys(NAV_SECTIONS).filter((key) => NAV_SECTIONS[key as keyof typeof NAV_SECTIONS].defaultExpanded))
  );
  const [recentItems, setRecentItems] = useState<string[]>(() => {
    const saved = localStorage.getItem("sidebar-recent-items");
    return saved ? JSON.parse(saved) : [];
  });
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get modifier key symbol for display (platform-aware) - memoized
  const modifierSymbol = useMemo(() => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    return isMac ? "⌘" : "Ctrl";
  }, []);

  // Navigation items with categories and metadata
  const navItems: NavItem[] = [
    { id: "mapper", label: "File Mapper", icon: FolderTree, category: "file-operations", description: "Map and visualize file structures", shortcut: "1" },
    { id: "copy", label: "Copy / Move", icon: Copy, category: "file-operations", description: "Copy files and directories", shortcut: "2" },
    { id: "folder", label: "Folder Creation", icon: FolderPlus, category: "file-operations", description: "Create folder structures", shortcut: "3" },
    { id: "empty", label: "File Creation", icon: FilePlus, category: "file-operations", description: "Create empty files", shortcut: "4" },
    { id: "terminal", label: "Terminal", icon: Terminal, category: "tools", description: "Integrated terminal", shortcut: "5" },
    { id: "find-replace", label: "Find & Replace", icon: Search, category: "tools", description: "Search and replace in files", shortcut: "6" },
    { id: "sql-export", label: "SQL Export Wizard", icon: Database, category: "tools", description: "Export data to SQL", shortcut: "7" },
    { id: "ai-assistant", label: "AI Assistant", icon: Sparkles, category: "ai", description: "AI-powered file operations", shortcut: "8" },
    { id: "panel-config", label: "Panel Config", icon: Layout, category: "system", description: "Configure UI panels", shortcut: "9" },
    { id: "settings", label: "Settings", icon: Settings, category: "system", description: "Application settings", shortcut: "0" },
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
        item.id.toLowerCase().includes(query)
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
      // Focus search on Cmd/Ctrl + K
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (modKey && e.key === "k" && !e.shiftKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Clear search on Escape
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
        return;
      }

      // Number shortcuts with modifier key (Cmd/Ctrl + #) - only when search is not focused
      // This prevents interference when typing numbers in input fields
      if (!searchQuery && document.activeElement !== searchInputRef.current) {
        const numberKey = e.key;
        const item = navItems.find((item) => item.shortcut === numberKey);
        // Require modifier key (Cmd/Ctrl) to navigate - prevents interference with typing
        if (item && modKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          setActiveTab(item.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, setActiveTab]);

  // Get recent items (excluding current active tab)
  const recentNavItems = useMemo(() => {
    return recentItems
      .filter((id) => id !== activeTab)
      .map((id) => navItems.find((item) => item.id === id))
      .filter((item): item is NavItem => item !== undefined)
      .slice(0, 3); // Show max 3 recent items
  }, [recentItems, activeTab]);

  return (
    <div className="w-full h-full flex flex-col glass transition-colors duration-300 relative z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      {/* Header Section */}
      <div className="p-4 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            FilePro
          </h1>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800"
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

      {/* Navigation Content - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <nav className="p-3 space-y-4">
          {/* Recent Items Section - Only show when not searching */}
          {!searchQuery && recentNavItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                Recent
              </div>
              {recentNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`recent-${item.id}`}
                    onClick={() => setActiveTab(item.id)}
                    className="relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    title={item.description}
                  >
                    <Icon className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                  </button>
                );
              })}
              <div className="h-px bg-slate-200/50 dark:bg-slate-800/50 my-3" />
            </div>
          )}

          {/* Grouped Navigation Sections */}
          <AnimatePresence>
            {Object.entries(NAV_SECTIONS).map(([sectionKey, sectionConfig]) => {
              const sectionItems = groupedItems[sectionKey] || [];
              if (sectionItems.length === 0) return null;

              const isExpanded = expandedSections.has(sectionKey);
              const SectionIcon = sectionConfig.icon;

              return (
                <motion.div
                  key={sectionKey}
                  initial={false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 transition-transform" />
                    ) : (
                      <ChevronRight className="h-3 w-3 transition-transform" />
                    )}
                    <SectionIcon className="h-3 w-3" />
                    <span className="flex-1 text-left">{sectionConfig.label}</span>
                    <span className="text-slate-400 dark:text-slate-600">
                      {sectionItems.length}
                    </span>
                  </button>

                  {/* Section Items */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-1 overflow-hidden"
                      >
                        {sectionItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActiveTab(item.id)}
                              className={cn(
                                "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group overflow-hidden",
                                isActive
                                  ? "text-white shadow-md shadow-blue-500/20"
                                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
                              )}
                              title={item.description}
                              aria-label={`${item.label}${item.shortcut ? ` (Shortcut: ${modifierSymbol} + ${item.shortcut})` : ""}`}
                            >
                              {isActive && (
                                <motion.div
                                  layoutId="activeTab"
                                  className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg"
                                  initial={false}
                                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                              )}

                              <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
                                <Icon
                                  className={cn(
                                    "h-4 w-4 transition-colors flex-shrink-0",
                                    isActive
                                      ? "text-white"
                                      : "text-slate-500 dark:text-slate-400 group-hover:text-blue-500",
                                  )}
                                />
                                <span className="flex-1 text-left truncate">{item.label}</span>
                                {item.shortcut && (
                                  <kbd
                                    className={cn(
                                      "px-1.5 py-0.5 text-xs rounded border flex-shrink-0 transition-colors font-mono",
                                      isActive
                                        ? "bg-white/20 text-white border-white/30"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
                                    )}
                                    title={`${modifierSymbol} + ${item.shortcut}`}
                                  >
                                    {modifierSymbol}{item.shortcut}
                                  </kbd>
                                )}
                              </div>

                              {!isActive && (
                                <motion.div
                                  className="absolute inset-0 bg-slate-200/50 dark:bg-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                                  whileHover={{ opacity: 1 }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* No Results Message */}
          {searchQuery && filteredNavItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No results found for "{searchQuery}"
              </p>
            </div>
          )}
        </nav>
      </div>

      {/* Footer Section */}
      <div className="p-3 border-t border-slate-200/50 dark:border-slate-800/50 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
        {/* Agent Sidebar Toggle */}
        <button
          onClick={onToggleAgentSidebar}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border relative overflow-hidden group",
            agentSidebarOpen
              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-transparent hover:border-slate-300 dark:hover:border-slate-700",
          )}
          aria-label={`${agentSidebarOpen ? "Close" : "Open"} Agents sidebar`}
        >
          <div className="relative flex-shrink-0">
            <Bot className="h-4 w-4" />
            {hasRunningAgents && (
              <motion.span
                className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </div>
          <span className="flex-1 text-left">Agents</span>
          {hasRunningAgents && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs flex-shrink-0",
                agentSidebarOpen
                  ? "bg-white/20 text-white border-white/30"
                  : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
              )}
            >
              {runningAgents.length}
            </Badge>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-sm font-medium transition-all duration-200 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 group"
          aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
        >
          {themeMode === "dark" ? (
            <>
              <Sun className="h-4 w-4 group-hover:text-yellow-500 transition-colors" />
              <span className="flex-1 text-left">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 group-hover:text-blue-500 transition-colors" />
              <span className="flex-1 text-left">Dark Mode</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
