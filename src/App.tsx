/**
 * File: src/App.tsx
 *
 * Frontend: Main application component
 * Integrates panel configuration system for UI layout and visibility control
 */

import { useState, useEffect } from "react";
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
import { EditorsPanel } from "./components/panels/EditorsPanel";
import { BottomPanel } from "./components/panels/BottomPanel";
import { TitleBar } from "./components/layout/TitleBar";
import { StatusBar } from "./components/layout/StatusBar";
// import { cn } from "./lib/utils";

import { AgentSelectionProvider } from "./features/agents/contexts/AgentSelectionContext";
import { EditorProvider } from "./contexts/EditorContext";

function App() {
  const [activeTab, setActiveTab] = useState("mapper");

  // Panel configuration hook - manages UI visibility and layout
  const { configuration, togglePanelVisibility, setPanelVisibility } =
    usePanelConfiguration();

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

      // Toggle Editors panel: ⌘⇧E / Ctrl+Shift+E
      if (modKey && e.shiftKey && e.key === "E") {
        e.preventDefault();
        togglePanelVisibility("editors");
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

  // Handle custom navigation events
  useEffect(() => {
    const handleNavigation = (e: CustomEvent) => {
        if (e.detail?.tab) {
            setActiveTab(e.detail.tab);
        }
    };

    window.addEventListener('filepro:navigate', handleNavigation as EventListener);
    return () => window.removeEventListener('filepro:navigate', handleNavigation as EventListener);
  }, []);

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
          />
        );
      case "panel-config":
        return <PanelConfiguration />;
      default:
        return <FileMapper />;
    }
  };

  // Determine agent sidebar position and visibility
  const agentSidebarVisible =
    configuration.visibility.agents &&
    configuration.layout.agentSidebarPosition !== "hidden" &&
    agentSidebarOpen;
  const agentSidebarPosition = configuration.layout.agentSidebarPosition;

  return (
    <AgentSelectionProvider>
      <EditorProvider>
      <MainLayout>
        {/* Title Bar */}
        <TitleBar
          isVisible={configuration.layout.showTitleBar}
          onSettingsClick={() => setActiveTab("settings")}
        />

        <div className="flex h-full w-full flex-1 min-h-0">
          {/* Agent Sidebar on Left - if configured */}
          {agentSidebarVisible && agentSidebarPosition === "left" && (
            <AgentSidebar
              isOpen={agentSidebarOpen}
              onClose={() => setAgentSidebarOpen(false)}
              position="left"
            />
          )}

          {/* Main Sidebar - controlled by panel configuration */}
          {configuration.visibility.sidebar && (
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              themeMode={themeMode}
              toggleTheme={toggleTheme}
              agentSidebarOpen={agentSidebarOpen}
              onToggleAgentSidebar={handleToggleAgentSidebar}
            />
          )}

          {/* Main Content Area with Editors Panel */}
          <div className="flex-1 flex min-w-0">
            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-slate-100 dark:bg-[#0f1117] relative min-w-0">
              <div className="h-full w-full p-6">{renderContent()}</div>
            </main>

            {/* Editors Panel - on the right */}
            {configuration.visibility.editors && (
              <div className="w-64 shrink-0">
                <EditorsPanel
                  isVisible={configuration.visibility.editors}
                  onClose={() => setPanelVisibility("editors", false)}
                />
              </div>
            )}
          </div>

          {/* Chat Panel - on the right */}
          {configuration.visibility.chat && (
            <div className="w-80 shrink-0">
              <ChatPanel
                isVisible={configuration.visibility.chat}
                onClose={() => setPanelVisibility("chat", false)}
              />
            </div>
          )}

          {/* Agent Sidebar on Right - if configured */}
          {agentSidebarVisible && agentSidebarPosition === "right" && (
            <AgentSidebar
              isOpen={agentSidebarOpen}
              onClose={() => setAgentSidebarOpen(false)}
              position="right"
            />
          )}
        </div>

        {/* Agent Sidebar on Bottom - if configured */}
        {agentSidebarVisible && agentSidebarPosition === "bottom" && (
          <div className="h-64 shrink-0">
            <AgentSidebar
              isOpen={agentSidebarOpen}
              onClose={() => setAgentSidebarOpen(false)}
              position="bottom"
            />
          </div>
        )}

        {/* Bottom Panel */}
        {configuration.visibility.panel && (
          <BottomPanel
            isVisible={configuration.visibility.panel}
            onClose={() => setPanelVisibility("panel", false)}
          />
        )}

        {/* Status Bar */}
        <StatusBar isVisible={configuration.layout.showStatusBar} />

        {/* Agent Floating Button - show when agents are enabled */}
        {configuration.visibility.agents && (
          <AgentFloatingButton
            onClick={() => setAgentSidebarOpen(!agentSidebarOpen)}
            isOpen={agentSidebarOpen}
          />
        )}
      </MainLayout>
      </EditorProvider>
    </AgentSelectionProvider>
  );
}

export default App;
