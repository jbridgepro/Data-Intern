/**
 * File path: src/features/sql-export-wizard/SQLExportWizard.tsx
 *
 * Frontend main component for SQL Export Wizard feature
 * Comprehensive database import/export tool with query capabilities
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
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { DatabaseConnection } from "./types";
import { ActivityEntry, ActivityType } from "./types";
import { ConnectionManager } from "./components/ConnectionManager";
import { DatabaseExplorer } from "./components/DatabaseExplorer";
import { ExportPanel } from "./components/ExportPanel";
import { ImportPanel } from "./components/ImportPanel";
import { QueryPanel } from "./components/QueryPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 shadow-sm">
        <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-gradient-to-br from-sky-400/20 via-blue-400/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-400/10 via-cyan-400/10 to-transparent blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <Sparkles className="h-4 w-4" />
                Workflow Studio
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
                <Database className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                SQL Export Wizard
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Orchestrate exports, imports, and SQL investigations with a guided,
                production-grade flow built for fast iteration and confident delivery.
              </p>
            </div>
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
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                <Server className="h-3 w-3" />
                Connection
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {connectionLabel}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {connectionSubtitle}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                <Database className="h-3 w-3" />
                Database
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {selectedDatabase || "Select a database"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Active schema: dbo
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                <Table2 className="h-3 w-3" />
                Target
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {tableLabel}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {selectedTable ? "Table selected from explorer" : "Choose a table or view"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                <Activity className="h-3 w-3" />
                Current Mode
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {modeMeta[operationMode].label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {modeMeta[operationMode].description}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Manager */}
      <ConnectionManager
        activeConnection={activeConnection}
        onConnectionChange={handleConnectionChange}
        onDatabaseChange={setSelectedDatabase}
      />

      {/* Activity Timeline */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Activity Timeline
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Recent exports and imports across your workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
        </div>
        <div className="mt-4 space-y-3">
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

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Database Explorer - Left Sidebar */}
        <div className="col-span-3 flex flex-col min-h-0 gap-4">
          <div className="flex-1 min-h-0">
            <DatabaseExplorer
              connection={activeConnection}
              selectedDatabase={selectedDatabase}
              selectedTable={selectedTable}
              onTableSelect={handleTableSelect}
            />
          </div>
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Table Quick Preview
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Row count, size, and freshness at a glance.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"
              >
                {selectedTable ? `${selectedTable.schema}.${selectedTable.name}` : "No table"}
              </Badge>
            </div>
            {selectedTable ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Row Count
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {selectedTable.rowCount?.toLocaleString() ?? "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Table Size
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {formatFileSize(selectedTable.size)}
                  </div>
                </div>
                <div className="col-span-2 rounded-lg border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Last Updated
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatLastUpdated(selectedTable.lastUpdated)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200/70 p-4 text-xs text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                Select a table from the explorer to populate real metrics.
              </div>
            )}
          </div>
        </div>

        {/* Operation Panel - Right Side */}
        <div className="col-span-9 flex flex-col min-h-0 space-y-4">
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
                      aria-pressed={isActive}
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

      {/* Results Preview / Status Bar */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Status
            </span>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
              Ready
            </Badge>
            <span className="text-xs">Awaiting your next action.</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Last operation: No operations yet
          </div>
        </div>
      </div>
    </div>
  );
}
