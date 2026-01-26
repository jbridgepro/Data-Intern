/**
 * File path: src/features/sql-export-wizard/SQLExportWizard.tsx
 *
 * Frontend main component for SQL Export Wizard feature
 * Comprehensive database import/export tool with query capabilities
 */

import { useState } from "react";
import { Database, Download, Upload, Search } from "lucide-react";
import { DatabaseConnection } from "./types";
import { ConnectionManager } from "./components/ConnectionManager";
import { DatabaseExplorer } from "./components/DatabaseExplorer";
import { ExportPanel } from "./components/ExportPanel";
import { ImportPanel } from "./components/ImportPanel";
import { QueryPanel } from "./components/QueryPanel";
import { ResultsGrid } from "./components/ResultsGrid";
import { Button } from "@/components/ui/button";
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
  } | null>(null);

  const handleConnectionChange = (connection: DatabaseConnection | null) => {
    setActiveConnection(connection);
    if (connection) {
      setSelectedDatabase(
        connection.database || connection.defaultDatabase || "",
      );
    }
  };

  const handleTableSelect = (table: { schema: string; name: string }) => {
    setSelectedTable(table);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Database className="h-6 w-6" />
          SQL Export Wizard
        </h1>
      </div>

      {/* Connection Manager */}
      <ConnectionManager
        activeConnection={activeConnection}
        onConnectionChange={handleConnectionChange}
        onDatabaseChange={setSelectedDatabase}
      />

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Database Explorer - Left Sidebar */}
        <div className="col-span-3 flex flex-col min-h-0">
          <DatabaseExplorer
            connection={activeConnection}
            selectedDatabase={selectedDatabase}
            onTableSelect={handleTableSelect}
          />
        </div>

        {/* Operation Panel - Right Side */}
        <div className="col-span-9 flex flex-col min-h-0 space-y-4">
          {/* Operation Mode Selector */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Operation Mode:
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant={operationMode === "export" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOperationMode("export")}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button
                  variant={operationMode === "import" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOperationMode("import")}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
                <Button
                  variant={operationMode === "query" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOperationMode("query")}
                  className="flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  Query
                </Button>
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
              />
            )}
            {operationMode === "import" && (
              <ImportPanel
                connection={activeConnection}
                selectedDatabase={selectedDatabase}
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
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Status: Ready
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Last operation: No operations yet
          </span>
        </div>
      </div>
    </div>
  );
}
