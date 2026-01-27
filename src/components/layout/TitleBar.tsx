/**
 * File: src/components/layout/TitleBar.tsx
 *
 * Frontend: Title Bar component
 * Application title bar that can be toggled via panel configuration
 */

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TitleBarProps {
  isVisible: boolean;
  onSettingsClick?: () => void;
}

export const TitleBar = ({ isVisible, onSettingsClick }: TitleBarProps) => {
  if (!isVisible) return null;

  return (
    <div className="h-8 shrink-0 flex items-center justify-between px-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/50">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          FilePro
        </span>
      </div>
      <div className="flex items-center gap-2">
        {onSettingsClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onSettingsClick}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
