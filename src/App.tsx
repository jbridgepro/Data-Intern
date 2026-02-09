/**
 * File: src/App.tsx
 *
 * Frontend: Main application component
 * Integrates panel configuration system for UI layout and visibility control
 * Supports resizable and minimizable panels for all major UI sections
 */

import { useState, useEffect } from "react";
import { usePersistentState } from "./hooks/usePersistentState";
import { MainLayout } from "./components/layout/MainLayout";
import { Sidebar } from "./components/layout/Sidebar";
import { FileMapper } from "./features/file-mapper/FileMapper";
import { FileCopy } from "./features/file-copy/FileCopy";
import { FolderCreation } from "./features/folder-creation/FolderCreation";
import { EmptyFiles } from "./features/empty-files/EmptyFiles";
import { Terminal } from "./features/terminal/Terminal";
import { FindReplace } from "./features/find-replace/FindReplace";
import { SQLExportWizard } from "./features/sql-export-wizard/SQLExportWizard";
import { AIFileAssistant } from "./features/ai-assistant/AIFileAssistant";
import { Settings } from "./features/settings/Settings";
import { AgentSidebar } from "./features/agents/components/AgentSidebar";
import { AgentFloatingButton } from "./features/agents/components/AgentFloatingButton";
import { PanelConfiguration } from "./features/panel-configuration/components/PanelConfiguration";
import { usePanelConfiguration } from "./features/panel-configuration/hooks/usePanelConfiguration";
import { ChatPanel } from "./components/panels/ChatPanel";
import { QuickToolsTabs } from "./features/quick-tools/components/QuickToolsTabs";

import { BottomPanel } from "./components/panels/BottomPanel";
import { TitleBar } from "./components/layout/TitleBar";
import { StatusBar } from "./components/layout/StatusBar";
import { ResizablePanel } from "./components/ui/resizable-panel";

import { AgentSelectionProvider } from "./features/agents/contexts/AgentSelectionContext";
import { ChatProvider } from "./features/chat/contexts/ChatContext";
import { EditorProvider } from "./contexts/EditorContext";
import { AudioTranscriptionProvider } from "./features/quick-tools/contexts/AudioTranscriptionContext";
import {
  applyThemePreferences,
  loadThemePreferences,
} from "./lib/themePreferences";

function App() {
  // Use persistent state for active tab
  const [activeTab, setActiveTab] = usePersistentState(
    "app-active-tab",
    "mapper",
  );

  // When navigating to Settings with a section (e.g. from "Open AI Settings" link), scroll to that section
  const [pendingSettingsSection, setPendingSettingsSection] = useState<string | null>(null);

  // Panel configuration hook - manages UI visibility, layout, and panel sizes
  const {
    configuration,
    togglePanelVisibility,
    setPanelVisibility,
    setPanelSize,
    togglePanelMinimized,
    setPanelMinimized,
  } = usePanelConfiguration();

  // Agent sidebar state - synced with panel configuration
  const [agentSidebarOpen, setAgentSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("agent-sidebar-open");
    return saved === "true";
  });

  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    // 1. Check saved preference
    const saved = localStorage.getItem("theme-mode") as "light" | "dark" | null;
    if (saved) return saved;
    // 2. Check system preference
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });

  // Sync agent sidebar with panel configuration visibility
  // This ensures the sidebar state matches the panel configuration
  useEffect(() => {
    setAgentSidebarOpen(configuration.visibility.agents);
  }, [configuration.visibility.agents]);

  // Handle manual agent sidebar toggle - updates both state and configuration
  const handleToggleAgentSidebar = () => {
    const newState = !agentSidebarOpen;
    setAgentSidebarOpen(newState);
    setPanelVisibility("agents", newState);
  };

  useEffect(() => {
    // Apply theme to html element
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(themeMode);

    // Persist choice
    localStorage.setItem("theme-mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    applyThemePreferences(loadThemePreferences());
  }, []);

  useEffect(() => {
    // Persist agent sidebar state
    localStorage.setItem("agent-sidebar-open", agentSidebarOpen.toString());
  }, [agentSidebarOpen]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Keyboard shortcuts for panel toggles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Toggle Agents sidebar: ⌘⇧S / Ctrl+Shift+S
      if (modKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        togglePanelVisibility("agents");
        return;
      }

      // Toggle Chat panel: ⌘⇧B / Ctrl+Shift+B
      if (modKey && e.shiftKey && e.key === "B") {
        e.preventDefault();
        togglePanelVisibility("chat");
        return;
      }

      // Toggle bottom Panel: ⌘J / Ctrl+J
      if (modKey && !e.shiftKey && e.key === "j") {
        e.preventDefault();
        togglePanelVisibility("panel");
        return;
      }

      // Toggle main Sidebar: ⌘B / Ctrl+B
      if (modKey && !e.shiftKey && e.key === "b") {
        e.preventDefault();
        togglePanelVisibility("sidebar");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePanelVisibility]);

  // Handle custom navigation events (e.g. from Tool Info "Open AI Settings" link)
  useEffect(() => {
    const handleNavigation = (e: CustomEvent<{ tab?: string; section?: string }>) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
        if (e.detail.tab === "settings" && e.detail.section) {
          setPendingSettingsSection(e.detail.section);
        } else {
          setPendingSettingsSection(null);
        }
      }
    };

    window.addEventListener(
      "filepro:navigate",
      handleNavigation as EventListener,
    );
    return () =>
      window.removeEventListener(
        "filepro:navigate",
        handleNavigation as EventListener,
      );
  }, []);

  // Handle URL parameters for navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get("tool");
    if (toolParam === "quick-tools") {
      setActiveTab("quick-tools");
    }
  }, [setActiveTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "mapper":
        return <FileMapper />;
      case "copy":
        return <FileCopy />;
      case "folder":
        return <FolderCreation />;
      case "empty":
        return <EmptyFiles />;
      case "terminal":
        return <Terminal />;
      case "find-replace":
        return <FindReplace />;
      case "sql-export":
        return <SQLExportWizard />;
      case "ai-assistant":
        return <AIFileAssistant />;
      case "settings":
        return (
          <Settings
            themeMode={themeMode}
            toggleTheme={toggleTheme}
            onNavigateToPanelConfig={() => setActiveTab("panel-config")}
            initialSection={pendingSettingsSection ?? undefined}
            onInitialSectionHandled={() => setPendingSettingsSection(null)}
          />
        );
      case "panel-config":
        return (
          <PanelConfiguration
            onNavigateToSettings={() => setActiveTab("settings")}
          />
        );
      case "quick-tools":
        return <QuickToolsTabs />;
      default:
        return <FileMapper />;
    }
  };

  // Determine agent sidebar position and visibility
  const agentSidebarVisible =
    configuration.visibility.agents &&
    configuration.layout.agentSidebarPosition !== "hidden" &&
    agentSidebarOpen;

  // Determine if agent sidebar should be shown based on panel configuration and its own state
  const shouldShowAgentSidebar = agentSidebarVisible;

  return (
    <AudioTranscriptionProvider>
    <AgentSelectionProvider>
      <ChatProvider>
        <EditorProvider>
          <div className="flex h-screen flex-col bg-background font-sans text-foreground overflow-hidden">
            {/* Title Bar */}
            <TitleBar
              isVisible={configuration.layout.showTitleBar}
              onSettingsClick={() => setActiveTab("settings")}
            />

            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Main Content Area */}
              <div className="flex flex-1 overflow-hidden min-h-0 relative">
                {/* Main Sidebar - Resizable */}
                {configuration.visibility.sidebar && (
                  <ResizablePanel
                    size={configuration.panelSizes.sidebar.size}
                    minSize={configuration.panelSizes.sidebar.minSize}
                    maxSize={configuration.panelSizes.sidebar.maxSize}
                    isMinimized={configuration.panelSizes.sidebar.isMinimized}
                    onSizeChange={(size) => setPanelSize("sidebar", size)}
                    // Frontend: keep ResizablePanel minimized state in sync with panel configuration
                    // Use the boolean value provided by the resizable panel instead of always toggling.
                    onMinimizeChange={(minimized) =>
                      setPanelMinimized("sidebar", minimized)
                    }
                    direction="right"
                    className="z-50 overflow-visible"
                    renderChildrenWhenMinimized={true}
                  >
                    <Sidebar
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      themeMode={themeMode}
                      toggleTheme={toggleTheme}
                      agentSidebarOpen={agentSidebarOpen}
                      onToggleAgentSidebar={handleToggleAgentSidebar}
                      isMinimized={configuration.panelSizes.sidebar.isMinimized}
                      // Frontend: explicit toggle so sidebar hover/auto-hide tracks configuration correctly
                      onToggleMinimize={() =>
                        setPanelMinimized(
                          "sidebar",
                          !configuration.panelSizes.sidebar.isMinimized,
                        )
                      }
                    />
                  </ResizablePanel>
                )}

                {/* Agent Sidebar - Left Position - Resizable; render when minimized so AgentSidebar shows its collapsed UI */}
                {configuration.layout.agentSidebarPosition === "left" &&
                  shouldShowAgentSidebar && (
                    <ResizablePanel
                      size={configuration.panelSizes.agents.size}
                      minSize={configuration.panelSizes.agents.minSize}
                      maxSize={configuration.panelSizes.agents.maxSize}
                      isMinimized={configuration.panelSizes.agents.isMinimized}
                      onSizeChange={(size) => setPanelSize("agents", size)}
                      onMinimizeChange={() => togglePanelMinimized("agents")}
                      direction="right"
                      className="shrink-0"
                      renderChildrenWhenMinimized={true}
                    >
                      <AgentSidebar
                        isOpen={true}
                        onClose={handleToggleAgentSidebar}
                        position="left"
                        isMinimized={
                          configuration.panelSizes.agents.isMinimized
                        }
                        onToggleMinimize={() => togglePanelMinimized("agents")}
                      />
                    </ResizablePanel>
                  )}

                {/* Main View Area */}
                <main className="flex-1 overflow-hidden relative flex flex-col min-h-0 h-full">
                  <MainLayout>{renderContent()}</MainLayout>
                </main>

                {/* Chat Panel (Right Side) - Resizable; render when minimized so ChatPanel shows its collapsed UI */}
                {configuration.visibility.chat && (
                  <ResizablePanel
                    size={configuration.panelSizes.chat.size}
                    minSize={configuration.panelSizes.chat.minSize}
                    maxSize={configuration.panelSizes.chat.maxSize}
                    isMinimized={configuration.panelSizes.chat.isMinimized}
                    onSizeChange={(size) => setPanelSize("chat", size)}
                    onMinimizeChange={() => togglePanelMinimized("chat")}
                    direction="left"
                    className="shrink-0"
                    renderChildrenWhenMinimized={true}
                  >
                    <ChatPanel
                      isVisible={configuration.visibility.chat}
                      onClose={() => setPanelVisibility("chat", false)}
                      isMinimized={configuration.panelSizes.chat.isMinimized}
                      onToggleMinimize={() => togglePanelMinimized("chat")}
                    />
                  </ResizablePanel>
                )}

                {/* Agent Sidebar - Right Position - Resizable; render when minimized so AgentSidebar shows its collapsed UI */}
                {configuration.layout.agentSidebarPosition === "right" &&
                  shouldShowAgentSidebar && (
                    <ResizablePanel
                      size={configuration.panelSizes.agents.size}
                      minSize={configuration.panelSizes.agents.minSize}
                      maxSize={configuration.panelSizes.agents.maxSize}
                      isMinimized={configuration.panelSizes.agents.isMinimized}
                      onSizeChange={(size) => setPanelSize("agents", size)}
                      onMinimizeChange={() => togglePanelMinimized("agents")}
                      direction="left"
                      className="shrink-0"
                      renderChildrenWhenMinimized={true}
                    >
                      <AgentSidebar
                        isOpen={true}
                        onClose={handleToggleAgentSidebar}
                        position="right"
                        isMinimized={
                          configuration.panelSizes.agents.isMinimized
                        }
                        onToggleMinimize={() => togglePanelMinimized("agents")}
                      />
                    </ResizablePanel>
                  )}
              </div>
            </div>

            {/* Bottom Panel - Resizable; render when minimized so BottomPanel shows its collapsed UI */}
            {configuration.visibility.panel && (
              <ResizablePanel
                size={configuration.panelSizes.panel.size}
                minSize={configuration.panelSizes.panel.minSize}
                maxSize={configuration.panelSizes.panel.maxSize}
                isMinimized={configuration.panelSizes.panel.isMinimized}
                onSizeChange={(size) => setPanelSize("panel", size)}
                onMinimizeChange={() => togglePanelMinimized("panel")}
                direction="top"
                className="border-t border-slate-200/50 dark:border-slate-800/50"
                minimizedSize={40}
                renderChildrenWhenMinimized={true}
              >
                <BottomPanel
                  isVisible={configuration.visibility.panel}
                  onClose={() => setPanelVisibility("panel", false)}
                  isMinimized={configuration.panelSizes.panel.isMinimized}
                  onToggleMinimize={() => togglePanelMinimized("panel")}
                />
              </ResizablePanel>
            )}

            {/* Status Bar */}
            <StatusBar isVisible={configuration.layout.showStatusBar} />

            {/* Agent Sidebar - Bottom Position - Resizable; render when minimized so AgentSidebar shows its collapsed UI */}
            {configuration.layout.agentSidebarPosition === "bottom" &&
              shouldShowAgentSidebar && (
                <ResizablePanel
                  size={configuration.panelSizes.agents.size}
                  minSize={configuration.panelSizes.agents.minSize}
                  maxSize={configuration.panelSizes.agents.maxSize}
                  isMinimized={configuration.panelSizes.agents.isMinimized}
                  onSizeChange={(size) => setPanelSize("agents", size)}
                  onMinimizeChange={() => togglePanelMinimized("agents")}
                  direction="top"
                  className="shrink-0 border-t border-slate-200/50 dark:border-slate-800/50"
                  minimizedSize={40}
                  renderChildrenWhenMinimized={true}
                >
                  <AgentSidebar
                    isOpen={true}
                    onClose={handleToggleAgentSidebar}
                    position="bottom"
                    isMinimized={configuration.panelSizes.agents.isMinimized}
                    onToggleMinimize={() => togglePanelMinimized("agents")}
                  />
                </ResizablePanel>
              )}

            {/* Floating Action Button for Agents (Mobile/Collapsed) */}
            {!shouldShowAgentSidebar && configuration.visibility.agents && (
              <AgentFloatingButton
                onClick={handleToggleAgentSidebar}
                isOpen={agentSidebarOpen}
              />
            )}
          </div>
        </EditorProvider>
      </ChatProvider>
    </AgentSelectionProvider>
    </AudioTranscriptionProvider>
  );
}

export default App;
