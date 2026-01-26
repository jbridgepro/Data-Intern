/**
 * File: src/features/file-mapper/components/QuickActions.tsx
 *
 * Frontend component for quick action buttons
 */

import { Camera, RefreshCw, Save, Copy, Share2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onScreenshot?: () => void;
  onRefresh?: () => void;
  onSave?: () => void;
  onCopyTree?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
  disabled?: boolean;
}

export function QuickActions({
  onScreenshot,
  onRefresh,
  onSave,
  onCopyTree,
  onShare,
  onSettings,
  disabled = false,
}: QuickActionsProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          ⚡ Quick Actions
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onScreenshot}
          disabled={disabled}
          title="Screenshot"
        >
          <Camera className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={disabled}
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={disabled}
          title="Save Preset"
        >
          <Save className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyTree}
          disabled={disabled}
          title="Copy Tree"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onShare}
          disabled={disabled}
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSettings}
          disabled={disabled}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
