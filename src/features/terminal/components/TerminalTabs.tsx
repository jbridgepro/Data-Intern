// File path: ./src/features/terminal/components/TerminalTabs.tsx
// Front-end: Terminal tabs management component

import { useState, useEffect } from "react";
import { Plus, X, Settings, Download, Upload, Terminal as TerminalIcon } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { terminalInfo } from "../../../components/layout/toolInfoContent";
import { TerminalSession } from "./TerminalSession";
import {
  TerminalTheme,
  getTheme,
  terminalThemes,
} from "../utils/terminalThemes";
import {
  loadTheme,
  saveTheme,
  exportHistory,
  importHistory,
  loadHistory,
  saveHistory,
} from "../utils/terminalStorage";
import { useTerminalAliases } from "../hooks/useTerminalAliases";
import { cn } from "../../../lib/utils";

interface TerminalTab {
  id: string;
  name: string;
  directory?: string;
}

export const TerminalTabs = () => {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: "1", name: "Terminal 1" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("1");
  const [theme, setTheme] = useState<TerminalTheme>(getTheme(loadTheme()));
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const aliases = useTerminalAliases();

  // Load theme on mount
  useEffect(() => {
    const themeId = loadTheme();
    setTheme(getTheme(themeId));
  }, []);

  // Create new tab
  const createNewTab = () => {
    const newTabId = String(Date.now());
    const newTab: TerminalTab = {
      id: newTabId,
      name: `Terminal ${tabs.length + 1}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  // Close tab
  const closeTab = (tabId: string) => {
    if (tabs.length === 1) {
      // Don't close the last tab, just reset it
      return;
    }

    setTabs((prev) => prev.filter((tab) => tab.id !== tabId));

    if (activeTabId === tabId) {
      const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
      setActiveTabId(remainingTabs[0]?.id || "1");
    }
  };

  // Change theme
  const changeTheme = (themeId: string) => {
    const newTheme = getTheme(themeId);
    setTheme(newTheme);
    saveTheme(themeId);
    setShowThemeSelector(false);
  };

  // Export history
  const handleExportHistory = () => {
    const history = loadHistory();
    const json = exportHistory(history);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terminal-history-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import history
  const handleImportHistory = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const commands = importHistory(text);
          saveHistory(commands);
          alert(`Imported ${commands.length} commands from history.`);
        } catch (error) {
          alert(
            `Failed to import history: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    };
    input.click();
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <PageHeader
        icon={TerminalIcon}
        title="Terminal"
        subtitle="Run commands and scripts"
        info={terminalInfo}
      />
      {/* Tab Bar */}
      <div
        className="flex items-center gap-1 p-2 border-b"
        style={{
          backgroundColor: theme.colors.selection,
          borderColor: theme.colors.background,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={cn(
              "px-3 py-1 rounded-t-lg text-xs font-medium flex items-center gap-2 transition-colors",
              activeTabId === tab.id
                ? "bg-opacity-100"
                : "bg-opacity-50 hover:bg-opacity-75",
            )}
            style={{
              backgroundColor:
                activeTabId === tab.id
                  ? theme.colors.background
                  : theme.colors.selection,
              color: theme.colors.foreground,
            }}
          >
            <span>{tab.name}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="hover:bg-opacity-50 rounded p-0.5"
                style={{ color: theme.colors.foreground }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </button>
        ))}

        <button
          onClick={createNewTab}
          className="px-2 py-1 rounded text-xs hover:bg-opacity-50"
          style={{
            backgroundColor: theme.colors.selection,
            color: theme.colors.foreground,
          }}
          title="New Terminal Tab"
        >
          <Plus className="h-4 w-4" />
        </button>

        <div className="flex-1" />

        {/* Premium Features Menu */}
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-2 py-1 rounded text-xs hover:bg-opacity-50"
            style={{
              backgroundColor: theme.colors.selection,
              color: theme.colors.foreground,
            }}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {showSettings && (
            <div
              className="absolute right-0 mt-2 p-2 rounded shadow-lg border z-50 min-w-48"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.selection,
                color: theme.colors.foreground,
              }}
            >
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setShowThemeSelector(!showThemeSelector);
                    setShowSettings(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-opacity-50 text-sm"
                  style={{
                    backgroundColor: theme.colors.selection,
                    color: theme.colors.foreground,
                  }}
                >
                  Change Theme
                </button>
                <button
                  onClick={handleExportHistory}
                  className="w-full text-left px-2 py-1 rounded hover:bg-opacity-50 text-sm flex items-center gap-2"
                  style={{
                    backgroundColor: theme.colors.selection,
                    color: theme.colors.foreground,
                  }}
                >
                  <Download className="h-3 w-3" />
                  Export History
                </button>
                <button
                  onClick={handleImportHistory}
                  className="w-full text-left px-2 py-1 rounded hover:bg-opacity-50 text-sm flex items-center gap-2"
                  style={{
                    backgroundColor: theme.colors.selection,
                    color: theme.colors.foreground,
                  }}
                >
                  <Upload className="h-3 w-3" />
                  Import History
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Theme Selector */}
      {showThemeSelector && (
        <div
          className="absolute top-16 right-4 p-4 rounded shadow-lg border z-50 max-w-xs"
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.selection,
            color: theme.colors.foreground,
          }}
        >
          <h3 className="text-sm font-bold mb-2">Select Theme</h3>
          <div className="space-y-1">
            {Object.values(terminalThemes).map((themeOption) => (
              <button
                key={themeOption.id}
                onClick={() => changeTheme(themeOption.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2",
                  theme.id === themeOption.id && "ring-2",
                )}
                style={{
                  backgroundColor:
                    theme.id === themeOption.id
                      ? theme.colors.selection
                      : "transparent",
                  color: theme.colors.foreground,
                  // ringColor is not a standard CSS property, using CSS variable instead
                  // @ts-expect-error - Custom property for ring color
                  ['--ring-color']: theme.colors.brightBlue,
                }}
              >
                <div
                  className="w-4 h-4 rounded border"
                  style={{
                    backgroundColor: themeOption.colors.background,
                    borderColor: themeOption.colors.foreground,
                  }}
                />
                <span>{themeOption.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowThemeSelector(false)}
            className="mt-2 w-full px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: theme.colors.selection,
              color: theme.colors.foreground,
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Active Terminal Session */}
      {activeTab && (
        <div className="flex-1 relative">
          <TerminalSession
            key={activeTab.id}
            sessionId={activeTab.id}
            theme={theme}
            onClose={tabs.length > 1 ? () => closeTab(activeTab.id) : undefined}
            initialDirectory={activeTab.directory}
          />
        </div>
      )}
    </div>
  );
};
