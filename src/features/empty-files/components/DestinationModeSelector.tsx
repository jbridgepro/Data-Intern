/**
 * File: src/features/empty-files/components/DestinationModeSelector.tsx
 *
 * Front-end: Compact selector for destination behavior - Manual vs Pattern-Based propagation.
 * Uses a segmented button group (matching folder creation's collapsible section style).
 * Controls whether files are placed in a single location or auto-propagated across
 * matching main folders or subfolders.
 */

import { MapPin, Folder, FolderTree, Layers } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { DestinationMode } from "../utils/propagationUtils";
import { cn } from "@/lib/utils";

interface DestinationModeSelectorProps {
  value: DestinationMode;
  onChange: (mode: DestinationMode) => void;
  disabled?: boolean;
  className?: string;
}

const MODES: Array<{
  value: DestinationMode;
  label: string;
  shortLabel: string;
  icon: typeof MapPin;
}> = [
  {
    value: "manual",
    label: "Single location only",
    shortLabel: "Manual",
    icon: MapPin,
  },
  {
    value: "pattern-main",
    label: "Match main folders",
    shortLabel: "Main Folders",
    icon: Folder,
  },
  {
    value: "pattern-subfolders",
    label: "Match subfolders only",
    shortLabel: "Subfolders",
    icon: FolderTree,
  },
  {
    value: "pattern-main-and-subfolders",
    label: "Main + subfolders",
    shortLabel: "Both",
    icon: Layers,
  },
];

export function DestinationModeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: DestinationModeSelectorProps) {
  const selectedMode = MODES.find((m) => m.value === value);

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Destination Mode
      </Label>

      {/* Compact 2x2 grid selector */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-muted rounded-lg">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = value === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => !disabled && onChange(mode.value)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-md transition-all",
                isSelected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{mode.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Active mode description */}
      {selectedMode && (
        <p className="text-[10px] text-muted-foreground px-1">
          {selectedMode.label}
        </p>
      )}
    </div>
  );
}
