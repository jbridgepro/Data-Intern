/**
 * File: src/features/panel-configuration/components/PanelConfiguration.tsx
 *
 * Frontend: Panel Configuration component for managing UI layout and visibility
 * Provides interface similar to Cursor/Antigravity for configuring panels, sidebars, and layout
 */

import { useState, useEffect } from "react";
import {
  Layout,
  RectangleHorizontal,
  Sidebar as SidebarIcon,
  MessageSquare,
  FileCode,
  Bot,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { usePanelConfiguration } from "../hooks/usePanelConfiguration";
import { ViewMode, PanelPosition } from "../types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Panel Configuration Component
 * Main component for configuring panel visibility and layout settings
 */
interface PanelConfigurationProps {
  onNavigateToSettings?: () => void;
}

export const PanelConfiguration = ({
  onNavigateToSettings,
}: PanelConfigurationProps) => {
  const {
    configuration,
    togglePanelVisibility,
    setAgentSidebarPosition,
    toggleTitleBar,
    toggleStatusBar,
    applyViewModePreset,
    saveCustomViewMode,
    deleteCustomViewMode,
  } = usePanelConfiguration();

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newModeName, setNewModeName] = useState("");

  const [selectedViewMode, setSelectedViewMode] = useState<ViewMode>(
    configuration.viewMode,
  );

  // Sync selected view mode with configuration
  useEffect(() => {
    setSelectedViewMode(configuration.viewMode);
  }, [configuration.viewMode]);

  /**
   * Handle view mode selection
   */
  const handleViewModeChange = (mode: ViewMode) => {
    setSelectedViewMode(mode);
    applyViewModePreset(mode);
  };

  /**
   * Format keyboard shortcut for display
   */
  const formatShortcut = (keys: string): string => {
    // Convert to platform-specific format
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    return keys
      .replace(/⌘/g, isMac ? "⌘" : "Ctrl")
      .replace(/⇧/g, isMac ? "⇧" : "Shift");
  };

  /**
   * Panel toggle items with icons and shortcuts
   */
  const panelItems = [
    {
      id: "agents" as const,
      label: "Agents",
      icon: Bot,
      shortcut: "⌘⇧S",
      description: "Toggle Agents sidebar",
    },
    {
      id: "chat" as const,
      label: "Chat",
      icon: MessageSquare,
      shortcut: "⌘⇧B",
      description: "Toggle Chat panel",
    },
    {
      id: "editors" as const,
      label: "Editors",
      icon: FileCode,
      shortcut: "⌘⇧E",
      description: "Toggle Editors panel",
    },
    {
      id: "panel" as const,
      label: "Panel",
      icon: RectangleHorizontal,
      shortcut: "⌘J",
      description: "Toggle bottom Panel",
    },
    {
      id: "sidebar" as const,
      label: "Sidebar",
      icon: SidebarIcon,
      shortcut: "⌘B",
      description: "Toggle main Sidebar",
    },
  ];

  /**
   * View mode options
   */
  const viewModes: Array<{
    mode: ViewMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { mode: "agent", label: "Agent", icon: Bot },
    { mode: "editor", label: "Editor", icon: FileCode },
    { mode: "zen", label: "Zen", icon: Layout },
    { mode: "browser", label: "Browser", icon: Layout },
  ];

  const handleSaveMode = () => {
    if (newModeName.trim()) {
      saveCustomViewMode(newModeName.trim());
      setNewModeName("");
      setIsAddingMode(false);
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-2xl shadow-xl overflow-hidden relative min-h-0">
      <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 p-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Layout className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Panel Configuration
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Customize your workspace layout and panel visibility
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 min-h-0">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* View Mode Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>View Mode</CardTitle>
                <CardDescription>
                  Select a preset view mode for your workspace
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {viewModes.map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      onClick={() => handleViewModeChange(mode)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                        selectedViewMode === mode
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/25"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50",
                      )}
                    >
                      <div
                        className={cn(
                          "p-3 rounded-lg",
                          selectedViewMode === mode
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          selectedViewMode === mode
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-700 dark:text-slate-300",
                        )}
                      >
                        {label}
                      </span>
                    </button>
                  ))}
                  {configuration.customViewModes.map((customMode) => (
                    <div
                      key={customMode.id}
                      className={cn(
                        "relative group flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                        selectedViewMode === customMode.id
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/25"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                      onClick={() => handleViewModeChange(customMode.id)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomViewMode(customMode.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      
                      <div
                        className={cn(
                          "p-3 rounded-lg",
                          selectedViewMode === customMode.id
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        <Layout className="h-6 w-6" />
                      </div>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          selectedViewMode === customMode.id
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {customMode.name}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 flex flex-col gap-3">
                  {isAddingMode ? (
                    <div className="flex items-center gap-2 max-w-sm">
                      <Input
                        value={newModeName}
                        onChange={(e) => setNewModeName(e.target.value)}
                        placeholder="View mode name..."
                        className="h-8"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveMode();
                          if (e.key === "Escape") setIsAddingMode(false);
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveMode}>Save</Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setIsAddingMode(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-dashed w-fit"
                      onClick={() => setIsAddingMode(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add current layout as preset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Panel Visibility Toggles */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Panel Visibility</CardTitle>
                <CardDescription>
                  Toggle visibility of UI components
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {panelItems.map((item) => {
                  const Icon = item.icon;
                  const isVisible = configuration.visibility[item.id];

                  return (
                    <div key={item.id}>
                      <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className={cn(
                              "p-2 rounded-lg",
                              isVisible
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <Label
                              htmlFor={`panel-${item.id}`}
                              className="text-base font-medium cursor-pointer"
                            >
                              {item.label}
                            </Label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {item.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300">
                              {formatShortcut(item.shortcut)}
                            </kbd>
                            <Switch
                              id={`panel-${item.id}`}
                              checked={isVisible}
                              onCheckedChange={() =>
                                togglePanelVisibility(item.id)
                              }
                            />
                          </div>
                        </div>
                      </div>
                      {item.id !== panelItems[panelItems.length - 1].id && (
                        <Separator className="my-2" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Layout Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Layout Settings</CardTitle>
                <CardDescription>
                  Configure layout and positioning options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Agent Sidebar Position */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="agent-sidebar-position"
                      className="text-base font-medium"
                    >
                      Agent Sidebar
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Position of the Agent Sidebar
                    </p>
                  </div>
                  <Select
                    value={configuration.layout.agentSidebarPosition}
                    onValueChange={(value: PanelPosition) =>
                      setAgentSidebarPosition(value)
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Title Bar Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="title-bar"
                      className="text-base font-medium"
                    >
                      Title Bar
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Show or hide the application title bar
                    </p>
                  </div>
                  <Switch
                    id="title-bar"
                    checked={configuration.layout.showTitleBar}
                    onCheckedChange={toggleTitleBar}
                  />
                </div>

                <Separator />

                {/* Status Bar Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="status-bar"
                      className="text-base font-medium"
                    >
                      Status Bar
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Show or hide the status bar at the bottom
                    </p>
                  </div>
                  <Switch
                    id="status-bar"
                    checked={configuration.layout.showStatusBar}
                    onCheckedChange={toggleStatusBar}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Additional configuration options
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (onNavigateToSettings) {
                        onNavigateToSettings();
                      } else {
                        window.location.hash = "#settings";
                      }
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Cursor Settings
                  </Button>
                  <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300">
                    {formatShortcut("⇧⌘J")}
                  </kbd>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
