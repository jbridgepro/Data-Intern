/**
 * File path: src/features/sql-export-wizard/components/QueryPanel.tsx
 *
 * Frontend component for SQL query execution
 * Provides SQL editor and query results display
 */

import { useState } from "react";
import { Play, FileText, Code2 } from "lucide-react";
import { DatabaseConnection } from "../types";
import { Button } from "@/components/ui/button";
import { ResultsGrid } from "./ResultsGrid";

interface QueryPanelProps {
  connection: DatabaseConnection | null;
  selectedDatabase?: string;
}

export function QueryPanel({ connection, selectedDatabase }: QueryPanelProps) {
  const [query, setQuery] = useState("");
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!query.trim()) return;

    setExecuting(true);
    setError(null);

    // In production, this would call a backend API to execute the query
    setTimeout(() => {
      // Mock results
      setResults([
        {
          UserID: 1001,
          Username: "jdoe",
          Email: "john@example.com",
          OrderID: 50241,
          Total: 150.0,
        },
        {
          UserID: 1001,
          Username: "jdoe",
          Email: "john@example.com",
          OrderID: 50389,
          Total: 275.5,
        },
        {
          UserID: 1023,
          Username: "asmith",
          Email: "alice@example.com",
          OrderID: 50192,
          Total: 99.99,
        },
      ]);
      setExecuting(false);
    }, 1000);
  };

  if (!connection) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          Please connect to a database to execute queries
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col h-full">
      {/* SQL Editor */}
      <div className="flex-1 flex flex-col border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              SQL EDITOR
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <FileText className="h-3 w-3 mr-1" />
              Format SQL
            </Button>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={executing || !query.trim()}
            >
              <Play className="h-3 w-3 mr-1" />
              {executing ? "Executing..." : "Execute (F5)"}
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT u.UserID, u.Username, u.Email, o.OrderID, o.OrderDate, o.TotalAmount
FROM Users u
INNER JOIN Orders o ON u.UserID = o.UserID
WHERE o.OrderDate >= '2024-01-01'
  AND o.TotalAmount > 100
ORDER BY o.OrderDate DESC;"
            className="w-full h-full p-3 border rounded-md font-mono text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ fontFamily: "monospace" }}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {!error && executing && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              ✓ Query executed successfully. (247 rows affected) Execution time:
              0.234 seconds
            </p>
          </div>
        )}
      </div>

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="flex-1 min-h-[300px]">
          <ResultsGrid data={results} />
        </div>
      )}

      {results.length === 0 && !executing && (
        <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
          <p>Execute a query to see results here</p>
        </div>
      )}
    </div>
  );
}
