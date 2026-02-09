/**
 * File path: src/features/sql-export-wizard/SQLExportWizard.tsx
 *
 * Frontend main component for SQL Export Wizard feature
 * Comprehensive database import/export tool with query capabilities
 * Layout: step-based flow, collapsible sections, compact context bar for reactive desktop.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  Upload,
  Search,
  Server,
  Table2,
  Activity,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { DatabaseConnection } from "./types";
import { ActivityEntry, ActivityType } from "./types";
import { ConnectionManager } from "./components/ConnectionManager";
import { DatabaseExplorer } from "./components/DatabaseExplorer";
import { ExportPanel } from "./components/ExportPanel";
import { ImportPanel } from "./components/ImportPanel";
import { QueryPanel } from "./components/QueryPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { sqlExportWizardInfo } from "@/components/layout/toolInfoContent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { clearActivityEntries, getActivityEntries } from "./utils/storage";
import { cn } from "@/lib/utils";

type OperationMode = "export" | "import" | "query";

export function SQLExportWizard() {
  const [activeConnection, setActiveConnection] =
    useState<DatabaseConnection | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");
  const [operationMode, setOperationMode] = useState<OperationMode>("export");
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    name: string;
    rowCount?: number;
    size?: number;
    lastUpdated?: string;
  } | null>(null);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityType | "all">(
    "all",
  );
  const [connectionOpen, setConnectionOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);

  useEffect(() => {
    setActivityEntries(getActivityEntries());
  }, []);

  const modeMeta = useMemo(
    () => ({
      export: {
        label: "Export",
        description: "Extract tables or custom queries to shareable files.",
        icon: Download,
      },
      import: {
        label: "Import",
        description: "Load files into a database with mapping and validation.",
        icon: Upload,
      },
      query: {
        label: "Query",
        description: "Design SQL visually or with natural language input.",
        icon: Search,
      },
    }),
    [],
  );

  const connectionLabel = activeConnection
    ? activeConnection.name
    : "Not connected";
  const connectionSubtitle = activeConnection
    ? `${activeConnection.server}${activeConnection.instance ? `\\${activeConnection.instance}` : ""}`
    : "Choose a saved connection or create a new one.";
  const tableLabel = selectedTable
    ? `${selectedTable.schema}.${selectedTable.name}`
    : "No table selected";

  // Wizard steps for progress and guidance: Connect → Select target → Workflow → Configure
  const wizardSteps = useMemo(
    () => [
      { id: 1, label: "Connect", short: "1. Connect", done: !!activeConnection },
      {
        id: 2,
        label: "Select target",
        short: "2. Target",
        done: !!(selectedDatabase && (operationMode === "query" || selectedTable)),
      },
      { id: 3, label: "Workflow", short: "3. Workflow", done: true },
      { id: 4, label: "Configure", short: "4. Configure", done: false },
    ],
    [activeConnection, selectedDatabase, selectedTable, operationMode],
  );
  const currentWizardStep = activeConnection
    ? selectedDatabase
      ? 3
      : 2
    : 1;

  const formatFileSize = (bytes?: number): string => {
    if (!bytes && bytes !== 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatLastUpdated = (value?: string): string => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const formatActivityTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleActivityLogged = () => {
    setActivityEntries(getActivityEntries());
  };

  const handleClearTimeline = () => {
    clearActivityEntries();
    setActivityEntries([]);
  };

  const filteredActivityEntries =
    activityFilter === "all"
      ? activityEntries
      : activityEntries.filter((entry) => entry.type === activityFilter);

  const handleConnectionChange = (connection: DatabaseConnection | null) => {
    setActiveConnection(connection);
    setSelectedTable(null);
    if (connection) {
      setSelectedDatabase(
        connection.database || connection.defaultDatabase || "",
      );
    } else {
      setSelectedDatabase("");
    }
  };

  const handleTableSelect = (table: {
    schema: string;
    name: string;
    rowCount?: number;
    size?: number;
    lastUpdated?: string;
  }) => {
    setSelectedTable(table);
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 animate-in fade-in duration-300 overflow-y-auto pr-1">
      <PageHeader
        icon={Database}
        title="SQL Export Wizard"
        subtitle="Export, import, and query databases with a guided workflow"
        info={sqlExportWizardInfo}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200",
                !activeConnection &&
                  "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
              )}
            >
              {activeConnection ? "Connected" : "Not connected"}
            </Badge>
            <Badge variant="secondary" className="bg-slate-900/5 text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {modeMeta[operationMode].label} Mode
            </Badge>
          </div>
        }
      />

      {/* Compact context bar: wizard progress + current context at a glance */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200/70 bg-card/50 px-4 py-2.5 shadow-sm dark:border-slate-800/70">
          {wizardSteps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                index < wizardSteps.length - 1 && "pr-2 border-r border-slate-200/70 dark:border-slate-700/70",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  step.done
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : currentWizardStep === step.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                )}
              >
                {step.done ? "✓" : step.id}
              </span>
              <span
                className={cn(
                  "font-medium",
                  currentWizardStep === step.id
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" />
            <strong className="text-foreground">{connectionLabel}</strong>
            {activeConnection && (
              <span className="truncate max-w-[180px]">{connectionSubtitle}</span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            <strong className="text-foreground">{selectedDatabase || "—"}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <Table2 className="h-3.5 w-3.5" />
            <strong className="text-foreground">{tableLabel}</strong>
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {modeMeta[operationMode].label}
          </Badge>
        </div>
      </div>

      {/* Connection Manager: collapsible; open when not connected, collapsed when connected */}
      <Collapsible
        open={connectionOpen}
        onOpenChange={setConnectionOpen}
        defaultOpen={!activeConnection}
      >
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
              aria-expanded={connectionOpen ? "true" : "false"}
            >
              <div className="flex items-center gap-2">
                {connectionOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Connection
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    activeConnection
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                      : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400",
                  )}
                >
                  {activeConnection ? connectionLabel : "Not connected"}
                </Badge>
              </div>
              {!connectionOpen && activeConnection && (
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                  {connectionSubtitle}
                </span>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-slate-200/70 dark:border-slate-800/70 px-4 pb-4 pt-2">
              <ConnectionManager
                activeConnection={activeConnection}
                onConnectionChange={handleConnectionChange}
                onDatabaseChange={setSelectedDatabase}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Activity Timeline: collapsible to save space; progressive disclosure */}
      <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
              aria-expanded={activityOpen ? "true" : "false"}
            >
              <div className="flex items-center gap-2">
                {activityOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Activity Timeline
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {filteredActivityEntries.length} recent
                </span>
              </div>
              {!activityOpen && filteredActivityEntries.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                  {filteredActivityEntries[0]?.title}
                </span>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-slate-200/70 dark:border-slate-800/70 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/80 p-1 text-xs dark:border-slate-800/70 dark:bg-slate-900/60">
                  {(["all", "export", "import"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActivityFilter(filter)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                        activityFilter === filter
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={handleClearTimeline}>
                  Clear Timeline
                </Button>
              </div>
              <div className="space-y-3">
                {filteredActivityEntries.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200/70 p-4 text-xs text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                    No activity yet. Run an export or import to populate the timeline.
                  </div>
                )}
                {filteredActivityEntries.map((item) => {
                  const isExport = item.type === "export";
                  const statusStyles =
                    item.status === "success"
                      ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                      : item.status === "error"
                        ? "bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-200"
                        : "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200";
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                        {isExport ? (
                          <Download className="h-4 w-4" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {item.title}
                          </span>
                          <Badge className={cn("text-xs", statusStyles)}>
                            {item.status === "success"
                              ? "Success"
                              : item.status === "error"
                                ? "Failed"
                                : "Needs Review"}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.detail}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {item.status === "success" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : item.status === "error" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span>{formatActivityTime(item.timestamp)}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Main Content Area: responsive grid; left = explorer + collapsible preview */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 min-w-0">
        {/* Database Explorer - Left sidebar; collapsible to maximize space for operation panel */}
        <div
          className={cn(
            "flex flex-col min-h-0 gap-3 transition-all duration-200",
            explorerCollapsed ? "lg:col-span-1" : "lg:col-span-3",
          )}
        >
          <div className="flex items-center justify-between gap-2 lg:justify-end">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 lg:sr-only">
              Explorer
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-500 shrink-0"
              onClick={() => setExplorerCollapsed(!explorerCollapsed)}
              aria-label={explorerCollapsed ? "Expand explorer" : "Collapse explorer"}
            >
              {explorerCollapsed ? "Show explorer" : "Hide explorer"}
            </Button>
          </div>
          {!explorerCollapsed && (
            <>
              <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                <DatabaseExplorer
                  connection={activeConnection}
                  selectedDatabase={selectedDatabase}
                  selectedTable={selectedTable}
                  onTableSelect={handleTableSelect}
                />
              </div>
              <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
                <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-sm overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      aria-expanded={previewOpen ? "true" : "false"}
                    >
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        Table Quick Preview
                      </span>
                      {previewOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-slate-200/70 dark:border-slate-800/70 px-3 pb-3 pt-2">
                      {selectedTable ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-slate-200/70 bg-slate-50/80 p-2 dark:border-slate-800/70 dark:bg-slate-950/40">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Rows
                            </div>
                            <div className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {selectedTable.rowCount?.toLocaleString() ?? "—"}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200/70 bg-slate-50/80 p-2 dark:border-slate-800/70 dark:bg-slate-950/40">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Size
                            </div>
                            <div className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {formatFileSize(selectedTable.size)}
                            </div>
                          </div>
                          <div className="col-span-2 rounded-lg border border-slate-200/70 bg-slate-50/80 p-2 dark:border-slate-800/70 dark:bg-slate-950/40">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Last updated
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                              {formatLastUpdated(selectedTable.lastUpdated)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                          Select a table from the explorer.
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </>
          )}
        </div>

        {/* Operation Panel - Right side; expands when explorer collapsed */}
        <div
          className={cn(
            "flex flex-col min-h-0 space-y-4 min-w-0",
            explorerCollapsed ? "lg:col-span-11" : "lg:col-span-9",
          )}
        >
          {/* Operation Mode Selector */}
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Choose your workflow
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Pick an action and configure it below.
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(Object.keys(modeMeta) as OperationMode[]).map((mode) => {
                  const Icon = modeMeta[mode].icon;
                  const isActive = operationMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setOperationMode(mode)}
                      className={cn(
                        "flex h-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition-all",
                        isActive
                          ? "border-slate-900/15 bg-slate-900/[0.04] shadow-sm dark:border-white/10 dark:bg-white/5"
                          : "border-slate-200/70 bg-white/80 hover:border-slate-300 dark:border-slate-800/70 dark:bg-slate-900/70",
                      )}
                      aria-pressed={isActive ? "true" : "false"}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            isActive
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {modeMeta[mode].label}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {modeMeta[mode].description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Operation Panel Content */}
          <div className="flex-1 min-h-0">
            {operationMode === "export" && (
              <ExportPanel
                connection={activeConnection}
                selectedDatabase={selectedDatabase}
                selectedTable={selectedTable}
                onActivityLogged={handleActivityLogged}
              />
            )}
            {operationMode === "import" && (
              <ImportPanel
                connection={activeConnection}
                selectedDatabase={selectedDatabase}
                onActivityLogged={handleActivityLogged}
              />
            )}
            {operationMode === "query" && (
              <QueryPanel
                connection={activeConnection}
                selectedDatabase={selectedDatabase}
              />
            )}
          </div>
        </div>
      </div>

      {/* Compact status bar: current status and last operation */}
      <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Status
            </span>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 text-[10px]">
              Ready
            </Badge>
            <span>Awaiting your next action.</span>
          </div>
          <span className="text-slate-500 dark:text-slate-400">
            Last operation: No operations yet
          </span>
        </div>
      </div>
    </div>
  );
}
