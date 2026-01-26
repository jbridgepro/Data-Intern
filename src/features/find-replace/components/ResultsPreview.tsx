/**
 * File path: ./src/features/find-replace/components/ResultsPreview.tsx
 *
 * Front-end: Results preview component for Find and Replace feature.
 * Displays search results with match highlighting and selection controls.
 */

import { FileText, Check, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";

interface Match {
  file: string;
  line: number;
  content: string;
  matchIndex: number; // Start index of match in content
  length: number;
}

interface FileResult {
  path: string;
  matches: Match[];
}

interface ResultsPreviewProps {
  results: FileResult[];
  onSelectMatch: (file: string, matchIdx: number) => void;
  selectedMatches: Set<string>; // composite key "file:line:index"
  searchQuery: string;
  focusedMatchIndex?: number | null;
}

export const ResultsPreview = ({
  results,
  onSelectMatch,
  selectedMatches,
  searchQuery,
  focusedMatchIndex,
}: ResultsPreviewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusedElementRef = useRef<HTMLDivElement>(null);

  // Scroll to focused match when keyboard navigating
  useEffect(() => {
    if (
      focusedMatchIndex !== null &&
      focusedMatchIndex !== undefined &&
      focusedElementRef.current
    ) {
      focusedElementRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [focusedMatchIndex]);

  if (results.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
        <FileText className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-sm font-medium">No results found</p>
        <p className="text-xs opacity-60 mt-1">
          Try adjusting your search terms or options
        </p>
        <div className="mt-4 text-xs text-slate-400 space-y-1">
          <p>• Check your search query spelling</p>
          <p>• Try different search options (case-sensitive, regex, etc.)</p>
          <p>
            • Verify the selected folder contains the files you're looking for
          </p>
        </div>
      </div>
    );
  }

  // Calculate global match index for keyboard navigation
  let globalMatchIndex = 0;

  return (
    <div
      className="flex-1 overflow-hidden bg-slate-50/30 dark:bg-slate-900/10"
      ref={scrollRef}
    >
      <ScrollArea className="h-full p-4">
        <div className="space-y-4">
          {results.map((fileResult) => (
            <div
              key={fileResult.path}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
            >
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span
                  className="text-xs font-mono text-slate-500 truncate flex-1"
                  title={fileResult.path}
                >
                  {fileResult.path}
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full ml-2">
                  {fileResult.matches.length}{" "}
                  {fileResult.matches.length === 1 ? "match" : "matches"}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {fileResult.matches.map((match, idx) => {
                  const matchId = `${fileResult.path}:${match.line}:${match.matchIndex}`;
                  const isSelected = selectedMatches.has(matchId);
                  const currentGlobalIndex = globalMatchIndex++;
                  const isFocused = focusedMatchIndex === currentGlobalIndex;

                  // Highlight logic
                  const before = match.content.substring(0, match.matchIndex);
                  const matched = match.content.substring(
                    match.matchIndex,
                    match.matchIndex + match.length,
                  );
                  const after = match.content.substring(
                    match.matchIndex + match.length,
                  );

                  return (
                    <div
                      key={`${match.line}-${idx}`}
                      ref={isFocused ? focusedElementRef : null}
                      className={`flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer group ${
                        isSelected ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                      } ${
                        isFocused
                          ? "ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50/70 dark:bg-blue-900/20"
                          : ""
                      }`}
                      onClick={() => onSelectMatch(fileResult.path, idx)}
                    >
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                          isSelected
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500 w-8 pt-0.5 flex-shrink-0">
                        {match.line}
                      </span>
                      <div className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-300 break-all whitespace-pre-wrap min-w-0">
                        <span>{before}</span>
                        <span className="bg-yellow-200 dark:bg-yellow-500/30 text-slate-900 dark:text-slate-100 font-bold px-0.5 rounded">
                          {matched}
                        </span>
                        <span>{after}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
