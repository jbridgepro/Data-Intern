/**
 * File: src/components/layout/StatusBar.tsx
 *
 * Frontend: Status Bar component
 * Status bar at the bottom that can be toggled via panel configuration
 */

import { CheckCircle2, AlertCircle } from "lucide-react";

interface StatusBarProps {
  isVisible: boolean;
}

export const StatusBar = ({ isVisible }: StatusBarProps) => {
  if (!isVisible) return null;

  return (
    <div className="h-6 shrink-0 flex items-center justify-between px-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-800/50 text-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
          <span>Ready</span>
        </div>
        <div className="text-slate-500 dark:text-slate-500">
          Panel Configuration Active
        </div>
      </div>
      <div className="flex items-center gap-4 text-slate-500 dark:text-slate-500">
        <span>Ln 1, Col 1</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
};
