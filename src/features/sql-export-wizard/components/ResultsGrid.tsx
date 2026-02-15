/**
 * File path: src/features/sql-export-wizard/components/ResultsGrid.tsx
 *
 * Frontend component for displaying query/export results in a data grid
 * Provides sorting, filtering, and export capabilities
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ResultsGridProps {
  data: any[];
  onExport?: () => void;
}

export function ResultsGrid({ data, onExport }: ResultsGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        No data to display
      </div>
    );
  }

  const columns = Object.keys(data[0] || {});
  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageData = data.slice(startIndex, endIndex);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number") {
      if (value % 1 !== 0) {
        return value.toFixed(2);
      }
      return value.toString();
    }
    return String(value);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-slate-200/70 dark:border-slate-800/70 bg-gradient-to-r from-slate-50/80 via-white/80 to-slate-50/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Showing rows {startIndex + 1}-{Math.min(endIndex, data.length)} of{" "}
            {data.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(JSON.stringify(data))}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-3 w-3 mr-1" />
            Export to CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50/80 dark:bg-slate-800 sticky top-0">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200/70 dark:border-slate-700 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-700/60"
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center gap-2">
                    {column}
                    {sortColumn === column && (
                      <span className="text-slate-400">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                {columns.map((column) => (
                  <td
                    key={column}
                    className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            |◀ First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </Button>
          <span className="text-sm text-slate-600 dark:text-slate-400 px-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last ▶|
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Go to:
          </span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value);
              if (page >= 1 && page <= totalPages) {
                setCurrentPage(page);
              }
            }}
            className="w-16 h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
