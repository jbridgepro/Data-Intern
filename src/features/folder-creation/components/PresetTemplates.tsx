/**
 * File: src/features/folder-creation/components/PresetTemplates.tsx
 *
 * Predefined preset templates for common folder structures
 */

import { FolderConfig } from "../utils/folderUtils";
import { FolderTree, Briefcase, Code, Camera, BookOpen, Boxes } from "lucide-react";

export interface PresetTemplate {
  name: string;
  description: string;
  icon: any;
  config: Partial<FolderConfig>;
}

export const FOLDER_PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: "Project Structure",
    description: "Standard project folders with documentation and assets",
    icon: FolderTree,
    config: {
      creationMode: "list",
      folderList: "src, docs, tests, assets, config, dist",
      useNumbering: false,
      separator: "-",
    },
  },
  {
    name: "Client Projects",
    description: "Numbered client project folders with subfolders",
    icon: Briefcase,
    config: {
      creationMode: "pattern",
      baseName: "Client",
      count: 5,
      useNumbering: true,
      startNumber: 1,
      digitCount: 3,
      numberPosition: "prefix",
      separator: "-",
      subfolders: "Documents, Deliverables, Communications, Assets",
    },
  },
  {
    name: "Development Workspace",
    description: "Code project structure with common dev folders",
    icon: Code,
    config: {
      creationMode: "list",
      folderList: "src, public, components, utils, hooks, styles, tests, build, node_modules",
      useNumbering: false,
      separator: "-",
    },
  },
  {
    name: "Media Library",
    description: "Organized media folders by date",
    icon: Camera,
    config: {
      creationMode: "pattern",
      baseName: "Media",
      count: 12,
      useNumbering: false,
      useDate: true,
      dateFormat: "YYYY-MM-DD",
      datePosition: "suffix",
      separator: "-",
      subfolders: "Photos, Videos, Raw, Edited",
    },
  },
  {
    name: "Documentation Site",
    description: "Structured documentation folders",
    icon: BookOpen,
    config: {
      creationMode: "list",
      folderList: "Getting Started, API Reference, Guides, Tutorials, Examples, FAQ, Changelog",
      useNumbering: true,
      startNumber: 1,
      digitCount: 2,
      numberPosition: "prefix",
      separator: "-",
    },
  },
  {
    name: "Batch Archive",
    description: "Timestamped archive folders",
    icon: Boxes,
    config: {
      creationMode: "pattern",
      baseName: "Archive",
      count: 1,
      useNumbering: false,
      useDate: true,
      dateFormat: "YYYY-MM-DD_HH-MM-SS",
      datePosition: "suffix",
      separator: "_",
    },
  },
  {
    name: "CSV Template: Client-Project",
    description: "CSV with columns: ClientName, ProjectCode, Year",
    icon: FolderTree,
    config: {
      creationMode: "csv",
      csvDelimiter: "-",
      csvColumnOrder: ["ClientName", "ProjectCode", "Year"],
      csvColumnConfig: {
        ClientName: { enabled: true, prefix: "", suffix: "" },
        ProjectCode: { enabled: true, prefix: "", suffix: "" },
        Year: { enabled: true, prefix: "", suffix: "" },
      },
      csvRows: [],
      csvHeaders: [],
    },
  },
];

interface PresetTemplatesProps {
  onSelectPreset: (preset: PresetTemplate) => void;
}

export function FolderPresetTemplates({ onSelectPreset }: PresetTemplatesProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          📁 Quick Start Templates
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {FOLDER_PRESET_TEMPLATES.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.name}
              onClick={() => onSelectPreset(preset)}
              className="w-full text-left p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-700 dark:text-slate-200 mb-1 text-sm">
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
