/**
 * File path: src/features/sql-export-wizard/components/QueryPanel.tsx
 *
 * Frontend component for running SQL against the connected database.
 * Two-pane layout: SQL editor (left) and results (right) for an intuitive
 * run-and-view flow. Building and formatting SQL is in Quick Tools → SQL Formatter.
 */

import { useState, useCallback, useEffect } from "react";
import {
  Play,
  Copy,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Table2,
  Keyboard,
} from "lucide-react";
import { DatabaseConnection } from "../types";
import { Button } from "@/components/ui/button";
import { ResultsGrid } from "./ResultsGrid";
import { cn } from "@/lib/utils";

interface QueryPanelProps {
  connection: DatabaseConnection | null;
  selectedDatabase?: string;
}

/** Default placeholder query for the editor */
const DEFAULT_SQL =
  "SELECT TOP 10 * FROM INFORMATION_SCHEMA.TABLES;\n-- Or write your own query and click Execute.";

/**
 * Opens the SQL Formatter in Quick Tools so the user can build or format
 * a query there, then return to the Wizard to run it.
 */
function openSqlFormatterInQuickTools() {
  const payload = { toolId: "sql-formatter", name: "SQL Formatter" };
  try {
    sessionStorage.setItem("quick-tools-open-tool", JSON.stringify(payload));
  } catch {
    // ignore
  }
  window.dispatchEvent(
    new CustomEvent("filepro:navigate", { detail: { tab: "quick-tools" } }),
  );
}

export function QueryPanel({ connection, selectedDatabase }: QueryPanelProps) {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopySql = useCallback(() => {
    if (!sql.trim()) return;
    navigator.clipboard.writeText(sql);
    setCopySuccess(true);
    window.setTimeout(() => setCopySuccess(false), 2000);
  }, [sql]);

  const handleExecute = useCallback(async () => {
    if (!sql.trim()) return;
    if (!connection) {
      setError("Connect to a database first.");
      return;
    }

    setExecuting(true);
    setError(null);
    setResults([]);

    // In production this would call a backend API to execute the query
    await new Promise((resolve) => setTimeout(resolve, 800));

    setResults([
      {
        TABLE_CATALOG: selectedDatabase || "master",
        TABLE_SCHEMA: "dbo",
        TABLE_NAME: "Users",
        TABLE_TYPE: "BASE TABLE",
      },
      {
        TABLE_CATALOG: selectedDatabase || "master",
        TABLE_SCHEMA: "dbo",
        TABLE_NAME: "Orders",
        TABLE_TYPE: "BASE TABLE",
      },
      {
        TABLE_CATALOG: selectedDatabase || "master",
        TABLE_SCHEMA: "dbo",
        TABLE_NAME: "Products",
        TABLE_TYPE: "BASE TABLE",
      },
    ]);
    setExecuting(false);
  }, [sql, connection, selectedDatabase]);

  // Ctrl+Enter / Cmd+Enter to run
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleExecute();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleExecute]);

  if (!connection) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-8 text-center shadow-sm">
        <p className="text-slate-500 dark:text-slate-400">
          Connect to a database above to run queries.
        </p>
      </div>
    );
  }

  const databaseLabel = selectedDatabase || connection.database || "default";
  const hasResults = results.length > 0 && !executing;

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-3">
      {/* Inline error or executing banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-300 shrink-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {executing && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200/80 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-900/20 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300 shrink-0">
          <div className="h-4 w-4 shrink-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          Executing query…
        </div>
      )}

      {/* Two-pane layout: editor (left) | results (right); stack on small screens */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 min-w-0">
        {/* Left: SQL Editor */}
        <div className="flex flex-col min-h-0 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                SQL Editor
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
                {databaseLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleCopySql}
                disabled={!sql.trim()}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copySuccess ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                onClick={handleExecute}
                disabled={executing || !sql.trim()}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Run
              </Button>
            </div>
          </div>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="Enter SQL and click Run..."
            className="flex-1 min-h-[180px] w-full resize-none p-4 font-mono text-sm leading-relaxed bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/20"
            spellCheck={false}
          />
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              <Keyboard className="h-3 w-3" />
              Ctrl+Enter to run
            </span>
            <button
              type="button"
              onClick={openSqlFormatterInQuickTools}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Build or format in SQL Formatter
            </button>
          </div>
        </div>

        {/* Right: Results — always visible so user knows where output goes */}
        <div className="flex flex-col min-h-0 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
            {hasResults ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Results
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {results.length} row{results.length !== 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <>
                <Table2 className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Results
                </span>
              </>
            )}
          </div>
          <div className="flex-1 min-h-[200px] overflow-auto">
            {hasResults ? (
              <ResultsGrid data={results} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] px-6 py-8 text-center">
                <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4 mb-3">
                  <Table2 className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  No results yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px]">
                  Write or paste SQL in the editor, then click Run or press
                  Ctrl+Enter. Results will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
