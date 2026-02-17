/**
 * File: src/components/layout/Sidebar.tsx
 *
 * Frontend: Main application sidebar component with enhanced features
 * - Search/filter functionality
 * - Keyboard shortcuts display
 * - Grouped navigation sections
 * - Favorites section with drag-to-reorder support
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
  Zap,
  Star,
  GripVertical,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { Badge } from "../ui/badge";
import { Input } from "@/components/ui/input";
import { useAgentManager } from "../../features/agents/hooks/useAgentManager";
import { toolsConfig } from "@/features/quick-tools/config/tools";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useFavorites } from "@/contexts/FavoritesContext";

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
  category: "file-operations" | "tools" | "quick-tools" | "ai" | "system";
  description?: string;
  isQuickTool?: boolean;
  toolId?: string;
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
  "quick-tools": {
    label: "Quick Tools",
    icon: Zap,
    defaultExpanded: false,
  },
  ai: {
    label: "AI & Assistant",
    icon: Sparkles,
    defaultExpanded: false, // Collapsed by default for cleaner UI
  },
  system: {
    label: "System",
    icon: Settings,
    defaultExpanded: false, // Collapsed by default for cleaner UI
  },
};

/**
 * FavoriteDraggableItem: A single favorite item that can be dragged to reorder.
 * Uses Framer Motion's Reorder.Item for smooth drag-and-drop.
 */
interface FavoriteDraggableItemProps {
  item: NavItem;
  isActive: boolean;
  onNavigate: () => void;
  onRemoveFavorite: () => void;
  isMinimized: boolean;
  isHovered: boolean;
}

const FavoriteDraggableItem = ({
  item,
  isActive,
  onNavigate,
  onRemoveFavorite,
  isMinimized,
  isHovered,
}: FavoriteDraggableItemProps) => {
  const Icon = item.icon;
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors group cursor-default select-none",
        isActive
          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50",
      )}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        zIndex: 50,
      }}
    >
      {/* Drag handle - visible on hover */}
      <span
        onPointerDown={(e) => dragControls.start(e)}
        className="cursor-grab active:cursor-grabbing p-0.5 rounded opacity-0 group-hover:opacity-60 hover:opacity-100! transition-opacity shrink-0 text-slate-400 dark:text-slate-500 touch-none"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>

      {/* Clickable navigation area */}
      <button
        onClick={onNavigate}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        aria-label={item.label}
      >
        {isActive && (
          <motion.div
            layoutId="activeTabFavSidebar"
            className="absolute left-0 w-1 h-6 bg-blue-600 dark:bg-blue-400 rounded-r-full"
            initial={false}
          />
        )}

        <Icon
          className={cn(
            "h-4.5 w-4.5 transition-colors shrink-0",
            isActive
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200",
          )}
        />

        <span className="truncate">{item.label}</span>
      </button>

      {/* Remove from favorites button */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onRemoveFavorite();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onRemoveFavorite();
          }
        }}
        className="p-0.5 rounded text-amber-400 dark:text-amber-300 opacity-80 hover:opacity-100 transition-opacity shrink-0"
        title="Remove from Favorites"
        aria-label="Remove from Favorites"
      >
        <Star className="h-3.5 w-3.5" fill="currentColor" />
      </span>
    </Reorder.Item>
  );
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

  // Persist expanded sections to localStorage (includes "favorites" key)
  const [expandedSectionsArray, setExpandedSectionsArray] = usePersistentState<string[]>(
    "sidebar-expanded-sections",
    [
      ...Object.keys(NAV_SECTIONS).filter(
        (key) => NAV_SECTIONS[key as keyof typeof NAV_SECTIONS].defaultExpanded,
      ),
      "favorites", // Favorites section expanded by default
    ],
  );

  // Convert array to Set for easier manipulation
  const expandedSections = useMemo(() => new Set(expandedSectionsArray), [expandedSectionsArray]);

  // Favorites: shared state from FavoritesContext (persisted to localStorage)
  const {
    favoriteItemIds,
    setFavoriteItemIds,
    toggleFavorite,
    isFavorite: isFavoriteCheck,
  } = useFavorites();

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
      id: "quick-tools",
      label: "Quick Tools",
      icon: Zap,
      category: "tools",
      description: "Productivity utilities",
      shortcut: "t",
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

  const quickToolsNavItems: NavItem[] = useMemo(
    () =>
      toolsConfig.map((tool) => ({
        id: `quick-tool:${tool.id}`,
        label: tool.name,
        icon: tool.icon,
        category: "quick-tools",
        description: tool.description,
        isQuickTool: true,
        toolId: tool.id,
      })),
    [],
  );

  // All navigable items combined (used for favorites look-ups)
  const allNavItems = useMemo(
    () => [...navItems, ...quickToolsNavItems],
    [quickToolsNavItems],
  );

  // Resolve favorite IDs to full NavItem objects (preserves user-defined order)
  const favoriteNavItems = useMemo(() => {
    return favoriteItemIds
      .map((id) => allNavItems.find((item) => item.id === id))
      .filter((item): item is NavItem => item !== undefined);
  }, [favoriteItemIds, allNavItems]);

  // Whether to show the Favorites section
  const shouldShowFavorites = useMemo(() => {
    // Don't show during search
    if (searchQuery.trim()) return false;
    return favoriteNavItems.length > 0;
  }, [searchQuery, favoriteNavItems.length]);

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
    const searchableItems = [...navItems, ...quickToolsNavItems];
    const query = searchQuery.toLowerCase();
    return searchableItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query),
    );
  }, [searchQuery, quickToolsNavItems]);

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
    setExpandedSectionsArray((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return Array.from(next);
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

  // Smart recent items - only show when appropriate
  const shouldShowRecent = useMemo(() => {
    // Don't show during search
    if (searchQuery.trim()) return false;

    // Only show if there are recent items
    if (recentNavItems.length === 0) return false;

    // Only show after user has visited at least 2 different tabs
    const uniqueVisitedTabs = new Set(recentItems);
    return uniqueVisitedTabs.size >= 2;
  }, [searchQuery, recentNavItems.length, recentItems]);

  const isSearching = searchQuery.trim().length > 0;

  // Highlight matching text in search results
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return (
          <mark
            key={index}
            className="bg-yellow-200/60 dark:bg-yellow-900/40 text-slate-900 dark:text-slate-100 px-0.5 rounded"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Render navigation item (Refactored for reuse)
  const handleNavItemClick = (item: NavItem) => {
    if (item.isQuickTool && item.toolId) {
      const payload = { toolId: item.toolId, name: item.label };
      sessionStorage.setItem("quick-tools-open-tool", JSON.stringify(payload));
      window.dispatchEvent(
        new CustomEvent("filepro:quick-tools-open", { detail: payload }),
      );
      setActiveTab("quick-tools");
      return;
    }

    setActiveTab(item.id);
  };

  /**
   * Render a single navigation item with optional tooltip and favorite toggle.
   * @param item - The navigation item to render
   * @param showTooltip - Whether to wrap in a tooltip (used in minimized mode)
   * @param hideFavoriteStar - If true, the star toggle is hidden (e.g. inside Favorites section)
   */
  const renderNavItem = (
    item: NavItem,
    showTooltip: boolean,
    hideFavoriteStar = false,
  ) => {
    const Icon = item.icon;
    const isActive = !item.isQuickTool && activeTab === item.id;
    const isFavorited = isFavoriteCheck(item.id);

    const content = (
      <button
        key={item.id}
        onClick={() => {
          handleNavItemClick(item);
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
            "h-5 w-5 transition-colors shrink-0",
            isActive
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200",
          )}
        />

        {isExpanded && (
          <div className="flex-1 text-left truncate flex items-center justify-between gap-1">
            <span className="truncate">
              {searchQuery ? highlightMatch(item.label, searchQuery) : item.label}
            </span>

            <div className="flex items-center gap-0.5 shrink-0">
              {/* Favorite star toggle - visible on hover or when favorited */}
              {!hideFavoriteStar && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(item.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite(item.id);
                    }
                  }}
                  className={cn(
                    "p-0.5 rounded transition-all",
                    isFavorited
                      ? "text-amber-400 dark:text-amber-300 opacity-100"
                      : "text-slate-400 opacity-0 group-hover:opacity-60 hover:opacity-100!",
                  )}
                  title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
                  aria-label={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star
                    className="h-3.5 w-3.5"
                    fill={isFavorited ? "currentColor" : "none"}
                  />
                </span>
              )}

              {/* Keyboard shortcut badge */}
              {item.shortcut && (
                <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded border dark:border-slate-700">
                  {modifierSymbol}
                  {item.shortcut}
                </span>
              )}
            </div>
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
            "absolute left-0 top-0 shadow-2xl h-full",
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

          {/* Search Results Count */}
          {searchQuery && filteredNavItems.length > 0 && (
            <div className="px-1 py-1 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              {filteredNavItems.length} result{filteredNavItems.length !== 1 ? 's' : ''}
            </div>
          )}
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

          {/* ===== Favorites Section (Expanded Mode) - Drag-to-Reorder ===== */}
          {isExpanded && shouldShowFavorites && (
            <div className="mb-4 space-y-1">
              <button
                onClick={() => toggleSection("favorites")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest hover:text-amber-600 dark:hover:text-amber-300 transition-colors group"
              >
                {expandedSections.has("favorites") ? (
                  <ChevronDown className="h-2.5 w-2.5 transition-transform opacity-70" />
                ) : (
                  <ChevronRight className="h-2.5 w-2.5 transition-transform opacity-70" />
                )}
                <Star className="h-3 w-3" fill="currentColor" />
                <span className="flex-1 text-left">Favorites</span>
                <span className="text-[10px] opacity-40">
                  {favoriteNavItems.length}
                </span>
              </button>

              <AnimatePresence>
                {expandedSections.has("favorites") && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {/* Reorderable favorites list */}
                    <Reorder.Group
                      axis="y"
                      values={favoriteItemIds}
                      onReorder={setFavoriteItemIds}
                      className="space-y-0.5 mt-1"
                    >
                      {favoriteNavItems.map((item) => (
                        <FavoriteDraggableItem
                          key={item.id}
                          item={item}
                          isActive={!item.isQuickTool && activeTab === item.id}
                          onNavigate={() => handleNavItemClick(item)}
                          onRemoveFavorite={() => toggleFavorite(item.id)}
                          isMinimized={isMinimized}
                          isHovered={isHovered}
                        />
                      ))}
                    </Reorder.Group>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="h-px bg-slate-200/50 dark:bg-slate-800/50 my-2 mx-2" />
            </div>
          )}

          {/* ===== Favorites Section (Minimized/Icon Mode) ===== */}
          {!isExpanded && favoriteNavItems.length > 0 && (
            <div className="space-y-2 mb-3 pb-3 border-b border-amber-200/30 dark:border-amber-800/30">
              {favoriteNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = !item.isQuickTool && activeTab === item.id;

                return (
                  <Tooltip key={`fav-min-${item.id}`} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNavItemClick(item)}
                        className={cn(
                          "relative flex items-center justify-center px-0 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full",
                          isActive
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50",
                        )}
                        aria-label={item.label}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors shrink-0",
                            isActive
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-500 dark:text-slate-400",
                          )}
                        />
                        {/* Small star indicator in minimized mode */}
                        <Star
                          className="absolute top-1.5 right-1.5 h-2 w-2 text-amber-400"
                          fill="currentColor"
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      sideOffset={10}
                      className="flex flex-col gap-0.5"
                    >
                      <p className="font-medium flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="text-[10px] text-slate-400 max-w-[150px]">
                          {item.description}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {/* Recent Items (Expanded Only) - Smart display */}
          {isExpanded && shouldShowRecent && (
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

              const isSectionExpanded = isSearching
                ? true
                : expandedSections.has(sectionKey);

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
                <div className="relative shrink-0">
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
