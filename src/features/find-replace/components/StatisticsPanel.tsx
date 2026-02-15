/**
 * File path: ./src/features/find-replace/components/StatisticsPanel.tsx
 *
 * Front-end: Statistics panel component for Find and Replace feature.
 * Displays search metrics and statistics.
 */

import { FileResult } from "../utils/searchLogic";
import { FileText, Folder, Search, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatisticsPanelProps {
  results: FileResult[];
  searchStats: { scanned: number; found: number };
  selectedMatches: Set<string>;
  isSearching: boolean;
}

export const StatisticsPanel = ({
  results,
  searchStats,
  selectedMatches,
  isSearching,
}: StatisticsPanelProps) => {
  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
  const totalFiles = results.length;

  return (
    <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-500" />
          Search Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Files Scanned
              </span>
            </div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-200">
              {isSearching
                ? searchStats.scanned.toLocaleString()
                : totalFiles.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1.5">
              <Search className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Matches Found
              </span>
            </div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-200">
              {isSearching
                ? searchStats.found.toLocaleString()
                : totalMatches.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1.5">
              <Folder className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Files with Matches
              </span>
            </div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-200">
              {totalFiles.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Selected
              </span>
            </div>
            <div className="text-xl font-bold text-slate-700 dark:text-slate-200">
              {selectedMatches.size.toLocaleString()}
            </div>
          </div>
        </div>

        {totalMatches > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                Selection Progress
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {Math.round((selectedMatches.size / totalMatches) * 100)}%
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{
                  width: `${(selectedMatches.size / totalMatches) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
