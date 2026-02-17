// file-pro/src/features/quick-tools/components/QuickToolsTabs.tsx
// Front-end: Quick Tools tabbed UI; Tools Hub is always first and pinned; tools open in new tabs.

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Zap, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getQuickToolPageMeta } from "@/components/layout/toolInfoContent";
import { cn } from "@/lib/utils";
import { QuickToolsHub } from "../QuickToolsHub";

import { SqlFormatter } from "../pages/SqlFormatter";
import { UnitConverter } from "../pages/UnitConverter";

import { PromptOptimizer } from "../pages/PromptOptimizer";

import { DuplicateFinder } from "../pages/DuplicateFinder";
import { AudioTranscription } from "../pages/AudioTranscription";
import { CalculatorTool } from "../pages/Calculator";
import { FileConverter } from "../pages/FileConverter";

/** Fixed id for the pinned Tools Hub tab (always first, not closeable). */
const HUB_TAB_ID = "quick-tools-hub";

/** Pinned hub tab instance; always present as the first tab. */
const HUB_TAB: QuickToolTab = {
  id: HUB_TAB_ID,
  type: "hub",
  name: "Tools Hub",
};

interface QuickToolTab {
  id: string;
  type: "hub" | "tool";
  toolId?: string;
  name: string;
}

/** Normalize saved tabs: ensure Tools Hub is first and only once; rest are tool or extra hub tabs. */
function normalizeTabs(saved: QuickToolTab[] | null): QuickToolTab[] {
  if (!saved || saved.length === 0) return [HUB_TAB];
  const rest = saved.filter((t) => t.id !== HUB_TAB_ID);
  return [HUB_TAB, ...rest];
}

export const QuickToolsTabs = () => {
  const [tabs, setTabs] = useState<QuickToolTab[]>(() => {
    try {
      const saved = localStorage.getItem("quick-tools-tabs");
      if (saved) return normalizeTabs(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load quick tools tabs", e);
    }
    return [HUB_TAB];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const savedTabs = localStorage.getItem("quick-tools-tabs");
      if (savedTabs) {
        const parsed = normalizeTabs(JSON.parse(savedTabs));
        const savedActive = localStorage.getItem("quick-tools-active-tab-id");
        if (savedActive && parsed.some((t) => t.id === savedActive))
          return savedActive;
        if (parsed.length > 0) return parsed[0].id;
      }
    } catch {}
    return HUB_TAB_ID;
  });

  // Persist tabs and active tab id (Tools Hub is always first)
  useEffect(() => {
    localStorage.setItem("quick-tools-tabs", JSON.stringify(tabs));
  }, [tabs]);
  useEffect(() => {
    localStorage.setItem("quick-tools-active-tab-id", activeTabId);
  }, [activeTabId]);

  const createNewTab = () => {
    const newTab: QuickToolTab = {
      id: String(Date.now()),
      type: "hub",
      name: "Tools Hub",
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  /** Close a tab. The pinned Tools Hub (first tab) cannot be closed. */
  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (tabId === HUB_TAB_ID) return;
    if (tabs.length <= 1) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const currentIndex = tabs.findIndex((t) => t.id === tabId);
      const nextIndex = Math.min(currentIndex, newTabs.length - 1);
      setActiveTabId(newTabs[Math.max(0, nextIndex)].id);
    }
  };

  /** Open a tool in a new tab and switch to it (used when selecting a tool from the hub). */
  const openToolInNewTab = useCallback((toolId: string, toolName: string) => {
    const newTab: QuickToolTab = {
      id: String(Date.now()),
      type: "tool",
      toolId,
      name: toolName,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  /** Replace content of a specific tab with a tool (kept for any non-hub flow that might need it). */
  const openTool = useCallback(
    (tabId: string, toolId: string, toolName: string) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabId
            ? { ...tab, type: "tool", toolId, name: toolName }
            : tab,
        ),
      );
    },
    [],
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const pageMeta = getQuickToolPageMeta(
    activeTab ?? { type: "hub", name: "Tools Hub" },
  );

  /** Open a tool (e.g. from sidebar or session); opens in a new tab so the hub stays intact. */
  const openToolInActiveTab = useCallback(
    (toolId: string, toolName: string) => {
      openToolInNewTab(toolId, toolName);
    },
    [openToolInNewTab],
  );

  const consumePendingQuickTool = useCallback(() => {
    const payload = sessionStorage.getItem("quick-tools-open-tool");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { toolId?: string; name?: string };
      sessionStorage.removeItem("quick-tools-open-tool");
      if (parsed.toolId && parsed.name) {
        openToolInActiveTab(parsed.toolId, parsed.name);
      }
    } catch (e) {
      console.error("Failed to open quick tool from sidebar", e);
      sessionStorage.removeItem("quick-tools-open-tool");
    }
  }, [openToolInActiveTab]);

  useEffect(() => {
    consumePendingQuickTool();
  }, [consumePendingQuickTool]);

  useEffect(() => {
    const handleQuickToolOpen = (event: CustomEvent) => {
      if (!event.detail?.toolId || !event.detail?.name) return;
      openToolInActiveTab(event.detail.toolId, event.detail.name);
    };

    window.addEventListener(
      "filepro:quick-tools-open",
      handleQuickToolOpen as EventListener,
    );
    return () =>
      window.removeEventListener(
        "filepro:quick-tools-open",
        handleQuickToolOpen as EventListener,
      );
  }, [openToolInActiveTab]);

  const renderTool = (toolId: string) => {
    switch (toolId) {
      case "sql-formatter":
        return <SqlFormatter />;
      case "unit-converter":
        return <UnitConverter />;

      case "prompt-optimizer":
        return <PromptOptimizer />;

      case "duplicate-finder":
        return <DuplicateFinder />;
      case "audio-transcription":
        return <AudioTranscription />;
      case "calculator":
        return <CalculatorTool />;
      case "file-converter":
        return <FileConverter />;
      default:
        return <QuickToolsHub onOpenTool={openToolInNewTab} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <PageHeader
        icon={Zap}
        title={pageMeta.title}
        subtitle={pageMeta.subtitle}
        info={pageMeta.info}
        toolId={
          activeTab?.type === "tool" && activeTab.toolId
            ? `quick-tool:${activeTab.toolId}`
            : "quick-tools"
        }
      />
      {/* Tab Bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200/60 dark:border-slate-800/60 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "group relative px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer min-w-[120px] max-w-[180px]",
                activeTabId === tab.id
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200/50 dark:border-blue-800/50"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50",
              )}
            >
              {tab.type === "hub" ? (
                <LayoutGrid
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    activeTabId === tab.id ? "text-blue-500" : "text-slate-400",
                  )}
                />
              ) : (
                <Zap
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    activeTabId === tab.id ? "text-blue-500" : "text-slate-400",
                  )}
                />
              )}

              <span className="truncate flex-1">{tab.name}</span>

              {tabs.length > 1 && tab.id !== HUB_TAB_ID && (
                <button
                  type="button"
                  aria-label={`Close ${tab.name}`}
                  onClick={(e) => closeTab(tab.id, e)}
                  className={cn(
                    "p-0.5 rounded transition-all shrink-0",
                    activeTabId === tab.id
                      ? "opacity-60 hover:opacity-100 hover:bg-blue-200/50 dark:hover:bg-blue-800/50"
                      : "opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700",
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="New tab"
          onClick={createNewTab}
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab &&
          (activeTab.type === "hub" ? (
            <QuickToolsHub onOpenTool={openToolInNewTab} />
          ) : (
            renderTool(activeTab.toolId || "")
          ))}
      </div>
    </div>
  );
};
