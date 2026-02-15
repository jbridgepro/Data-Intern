/**
 * File: src/features/file-mapper/components/PresetTemplates.tsx
 *
 * Frontend component for preset templates
 */

import { VisualizationConfig, VisualizationStyle } from "../types";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Layers, List } from "lucide-react";

interface PresetTemplate {
  name: string;
  description: string;
  icon: any;
  config: Partial<VisualizationConfig>;
  style: VisualizationStyle;
}

interface PresetTemplatesProps {
  onSelectPreset: (preset: PresetTemplate) => void;
}

const PRESETS: PresetTemplate[] = [
  {
    name: "Documentation Tree",
    description: "Tree View, Include files, Show sizes, Export as Markdown",
    icon: FileText,
    style: "tree",
    config: {
      showFileSizes: true,
      showFileCounts: true,
      lineStyle: "unicode",
      iconStyle: "emoji",
      maxDepth: 5,
    },
  },
  {
    name: "Project Overview",
    description: "Sunburst, Code files only, Color by file type",
    icon: BarChart3,
    style: "sunburst",
    config: {
      colorBy: "type",
      showFileSizes: true,
      maxDepth: 4,
    },
  },
  {
    name: "Storage Analysis",
    description: "Treemap, All files, Size heat map, Find large files",
    icon: Layers,
    style: "treemap",
    config: {
      colorBy: "size",
      showFileSizes: true,
      maxDepth: 5,
    },
  },
  {
    name: "Quick Structure",
    description: "Indented list, Folders only, Max 3 levels",
    icon: List,
    style: "indented",
    config: {
      showFileSizes: false,
      showFileCounts: false,
      maxDepth: 3,
    },
  },
];

export function PresetTemplates({ onSelectPreset }: PresetTemplatesProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          📚 Preset Templates
        </span>
      </div>
      <div className="space-y-2">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.name}
              onClick={() => onSelectPreset(preset)}
              className="w-full text-left p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">
                    {preset.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {preset.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
