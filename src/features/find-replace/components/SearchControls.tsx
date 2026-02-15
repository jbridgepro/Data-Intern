/**
 * File path: ./src/features/find-replace/components/SearchControls.tsx
 *
 * Front-end: Search controls component for Find and Replace feature.
 * Provides input fields and options for search configuration.
 */

import {
  Search,
  SlidersHorizontal,
  ArrowLeftRight,
  FileCode,
  Ban,
  Keyboard,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchControlsProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  replaceQuery: string;
  setReplaceQuery: (q: string) => void;
  options: {
    matchCase: boolean;
    useRegex: boolean;
    wholeWord: boolean;
    includePattern: string;
    excludePattern: string;
  };
  setOptions: (opts: any) => void;
  onSearch: () => void;
  isSearching: boolean;
  searchInputRef?: RefObject<HTMLInputElement>;
}

export const SearchControls = ({
  searchQuery,
  setSearchQuery,
  replaceQuery,
  setReplaceQuery,
  options,
  setOptions,
  onSearch,
  isSearching,
  searchInputRef,
}: SearchControlsProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="p-4 space-y-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      {/* Find Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Find
          </Label>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`text-xs flex items-center gap-1 ${showAdvanced ? "text-blue-600" : "text-slate-400 hover:text-slate-600"} transition-colors`}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Options
          </button>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery) {
                onSearch();
              }
            }}
            placeholder="Search for... (Ctrl+F to focus, Enter to search)"
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Replace Input */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Replace With
        </Label>
        <div className="relative group">
          <ArrowLeftRight className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-green-500 transition-colors" />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="Replace with..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Advanced Options */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-4 pt-2"
          >
            {/* File Filters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileCode className="h-3 w-3" /> Include Files
                </Label>
                <input
                  type="text"
                  value={options.includePattern}
                  onChange={(e) =>
                    setOptions({ ...options, includePattern: e.target.value })
                  }
                  placeholder="e.g. *.ts, src/**"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Ban className="h-3 w-3" /> Exclude Files
                </Label>
                <input
                  type="text"
                  value={options.excludePattern}
                  onChange={(e) =>
                    setOptions({ ...options, excludePattern: e.target.value })
                  }
                  placeholder="e.g. node_modules"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggles - Always Visible */}
      <div className="flex flex-wrap gap-4 pt-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="match-case"
            checked={options.matchCase}
            onCheckedChange={(c) => setOptions({ ...options, matchCase: c })}
          />
          <Label
            htmlFor="match-case"
            className="text-xs text-slate-600 dark:text-slate-300"
          >
            Match Case
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="regex"
            checked={options.useRegex}
            onCheckedChange={(c) => setOptions({ ...options, useRegex: c })}
          />
          <Label
            htmlFor="regex"
            className="text-xs text-slate-600 dark:text-slate-300"
          >
            Regex
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="whole-word"
            checked={options.wholeWord}
            onCheckedChange={(c) => setOptions({ ...options, wholeWord: c })}
          />
          <Label
            htmlFor="whole-word"
            className="text-xs text-slate-600 dark:text-slate-300"
          >
            Whole Word
          </Label>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 space-y-2">
        <button
          onClick={onSearch}
          disabled={isSearching || !searchQuery}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSearching ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Searching...
            </>
          ) : (
            <>
              Find All
              <span className="text-xs opacity-70 ml-1">(Enter)</span>
            </>
          )}
        </button>

        {/* Keyboard Shortcuts Help */}
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 transition-colors"
        >
          <Keyboard className="h-3 w-3" />
          Keyboard Shortcuts
        </button>

        <AnimatePresence>
          {showShortcuts && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Focus Search:</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300">
                    Ctrl+F
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Search:</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300">
                    Enter
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Navigate Results:</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300">
                    ↑↓
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Toggle Selection:</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300">
                    Space
                  </kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cancel:</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300">
                    Esc
                  </kbd>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
