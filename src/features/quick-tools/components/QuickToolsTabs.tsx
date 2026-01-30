
import { useState, useEffect, useCallback } from "react";
import { Plus, X, Zap, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickToolsHub } from "../QuickToolsHub";
import { JsonParser } from "../pages/JsonParser";
import { SqlFormatter } from "../pages/SqlFormatter";
import { UnitConverter } from "../pages/UnitConverter";
import { JwtDecoder } from "../pages/JwtDecoder";
import { PromptOptimizer } from "../pages/PromptOptimizer";
import { ScreenshotTool } from "../pages/ScreenshotTool";
import { TextDiff } from "../pages/TextDiff";
import { DuplicateFinder } from "../pages/DuplicateFinder";
import { AudioTranscription } from "../pages/AudioTranscription";
import { CalculatorTool } from "../pages/Calculator";

interface QuickToolTab {
  id: string;
  type: "hub" | "tool";
  toolId?: string;
  name: string;
}

export const QuickToolsTabs = () => {
  const [tabs, setTabs] = useState<QuickToolTab[]>(() => {
    try {
      const saved = localStorage.getItem("quick-tools-tabs");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load quick tools tabs", e);
    }
    return [{ id: "1", type: "hub", name: "Tools Hub" }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
      // Default to the first tab's ID if available, or just use "1" which is the default init
      // We can rely on the effect below to fix it if it doesn't exist, 
      // but creating consistency with initial tabs state is better.
      try {
          const savedTabs = localStorage.getItem("quick-tools-tabs");
          if (savedTabs) {
             const parsed = JSON.parse(savedTabs);
             if (parsed.length > 0) return parsed[0].id;
          }
      } catch {}
      return "1";
  });

  // Save tabs
  useEffect(() => {
    localStorage.setItem("quick-tools-tabs", JSON.stringify(tabs));
  }, [tabs]);

  const createNewTab = () => {
    const newTab: QuickToolTab = {
      id: String(Date.now()),
      type: "hub",
      name: "Tools Hub",
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (tabs.length === 1) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const openTool = (tabId: string, toolId: string, toolName: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, type: "tool", toolId, name: toolName }
          : tab
      )
    );
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const renderTool = (toolId: string) => {
    switch (toolId) {
      case "json-parser":
        return <JsonParser />;
      case "sql-formatter":
        return <SqlFormatter />;
      case "unit-converter":
        return <UnitConverter />;
      case "jwt-decoder":
        return <JwtDecoder />;
      case "prompt-optimizer":
        return <PromptOptimizer />;
      case "screenshot":
        return <ScreenshotTool />;
      case "text-diff":
        return <TextDiff />;
      case "duplicate-finder":
        return <DuplicateFinder />;
      case "audio-transcription":
        return <AudioTranscription />;
      case "calculator":
        return <CalculatorTool />;
      default:
        return <QuickToolsHub onOpenTool={(id, name) => openTool(activeTab?.id || "", id, name)} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Tab Bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 pr-3 mr-2 border-r border-slate-200 dark:border-slate-800">
           <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
             <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
           </div>
           <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 hidden sm:inline">
             Quick Tools
           </span>
         </div>

        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "group relative px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer min-w-[120px] max-w-[180px]",
                activeTabId === tab.id
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/50 dark:border-blue-800/50"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              {tab.type === "hub" ? (
                <LayoutGrid className={cn("h-3.5 w-3.5 shrink-0", activeTabId === tab.id ? "text-blue-500" : "text-slate-400")} />
              ) : (
                <Zap className={cn("h-3.5 w-3.5 shrink-0", activeTabId === tab.id ? "text-blue-500" : "text-slate-400")} />
              )}
              
              <span className="truncate flex-1">{tab.name}</span>

              {tabs.length > 1 && (
                <button
                  onClick={(e) => closeTab(tab.id, e)}
                  className={cn(
                    "p-0.5 rounded transition-all shrink-0",
                     activeTabId === tab.id
                      ? "opacity-60 hover:opacity-100 hover:bg-blue-200/50 dark:hover:bg-blue-800/50"
                      : "opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={createNewTab}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab && (
          activeTab.type === "hub" ? (
             <QuickToolsHub onOpenTool={(toolId, name) => openTool(activeTab.id, toolId, name)} />
          ) : (
            renderTool(activeTab.toolId || "")
          )
        )}
      </div>
    </div>
  );
};
