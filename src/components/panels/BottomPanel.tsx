import { useState } from "react";
import { Terminal as TerminalIcon, AlertCircle, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Terminal } from "@/features/terminal/Terminal";
import { usePanelConfiguration } from "@/features/panel-configuration/hooks/usePanelConfiguration";

interface BottomPanelProps {
  isVisible: boolean;
  onClose?: () => void;
}

type PanelTab = "terminal" | "problems" | "output";

export const BottomPanel = ({ isVisible, onClose }: BottomPanelProps) => {
  const { configuration, setBottomPanelTab } = usePanelConfiguration();
  const activeTab = configuration.bottomPanelActiveTab || "terminal";
  const [isMinimized, setIsMinimized] = useState(false);

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

  return (
    <div
      className={cn(
        "border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 flex flex-col transition-all",
        isMinimized ? "h-8" : "h-64",
      )}
    >
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
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <ScrollArea className="flex-1 p-4">
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
      )}
    </div>
  );
};
