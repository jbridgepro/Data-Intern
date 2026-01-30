/**
 * File: src/components/panels/BottomPanel.tsx
 *
 * Frontend: Bottom Panel component
 * Provides tabbed interface for Terminal, Problems, and Output
 * Supports minimize functionality controlled by parent ResizablePanel
 */

import { Terminal as TerminalIcon, AlertCircle, X, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Terminal } from "@/features/terminal/Terminal";
import { usePanelConfiguration } from "@/features/panel-configuration/hooks/usePanelConfiguration";

interface BottomPanelProps {
  /** Whether the panel is visible */
  isVisible: boolean;
  /** Callback to close/hide the panel */
  onClose?: () => void;
  /** Whether the panel is minimized (controlled by parent) */
  isMinimized?: boolean;
  /** Callback to toggle minimize state */
  onToggleMinimize?: () => void;
}

type PanelTab = "terminal" | "problems" | "output";

export const BottomPanel = ({ isVisible, onClose, isMinimized, onToggleMinimize }: BottomPanelProps) => {
  const { configuration, setBottomPanelTab } = usePanelConfiguration();
  const activeTab = configuration.bottomPanelActiveTab || "terminal";

  if (!isVisible) return null;

  const tabs: Array<{
    id: PanelTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "terminal", label: "Terminal", icon: TerminalIcon },
    { id: "problems", label: "Problems", icon: AlertCircle },
    { id: "output", label: "Output", icon: TerminalIcon },
  ];

  // Minimized state - show compact strip with clear panel title so it's identifiable
  if (isMinimized) {
    return (
      <div
        className="h-full flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50"
        title="Bottom panel — Terminal, Problems, Output"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0 py-1 pr-2 border-r border-slate-200/60 dark:border-slate-700/60">
            <TerminalIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Panel
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setBottomPanelTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors shrink-0",
                    activeTab === tab.id
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleMinimize}
              title="Expand Panel"
              aria-label="Expand bottom panel"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
              title="Close Panel"
              aria-label="Close bottom panel"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setBottomPanelTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded text-sm transition-colors",
                  activeTab === tab.id
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          {onToggleMinimize && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleMinimize}
              title="Minimize Panel"
            >
              <Minus className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
              title="Close Panel"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0 p-4">
        <div className="font-mono text-sm">
          {activeTab === "terminal" && (
            <div className="h-full">
              <Terminal />
            </div>
          )}
          {activeTab === "problems" && (
            <div className="text-slate-600 dark:text-slate-400">
              No problems detected. All checks passed.
            </div>
          )}
          {activeTab === "output" && (
            <div className="text-slate-600 dark:text-slate-400">
              Output panel - logs and build information will appear here.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
