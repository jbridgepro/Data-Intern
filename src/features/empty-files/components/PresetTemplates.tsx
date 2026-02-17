/**
 * File: src/features/empty-files/components/PresetTemplates.tsx
 *
 * Predefined preset templates for common file creation patterns
 */

import { FileConfig } from "../utils/fileGenerator";
import { FileText, Code, Image, FileSpreadsheet, File, Database } from "lucide-react";

export interface FilePresetTemplate {
  name: string;
  description: string;
  icon: any;
  config: Partial<FileConfig>;
}

export const FILE_PRESET_TEMPLATES: FilePresetTemplate[] = [
  {
    name: "Documentation Set",
    description: "README, LICENSE, CHANGELOG, and CONTRIBUTING files",
    icon: FileText,
    config: {
      creationMode: "list",
      fileList: "README.md, LICENSE.md, CHANGELOG.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md",
      useNumbering: false,
      extensions: ["md"],
    },
  },
  {
    name: "Web Components",
    description: "Numbered React component files",
    icon: Code,
    config: {
      creationMode: "pattern",
      baseName: "Component",
      count: 5,
      useNumbering: true,
      startNumber: 1,
      digitCount: 2,
      numberPosition: "suffix",
      separator: "",
      extensions: ["tsx"],
    },
  },
  {
    name: "Test Files",
    description: "Test files with .test extension",
    icon: FileText,
    config: {
      creationMode: "pattern",
      baseName: "test",
      count: 10,
      useNumbering: true,
      startNumber: 1,
      digitCount: 2,
      numberPosition: "suffix",
      separator: "_",
      extensions: ["test.ts"],
    },
  },
  {
    name: "Placeholder Images",
    description: "Numbered placeholder image files",
    icon: Image,
    config: {
      creationMode: "pattern",
      baseName: "placeholder",
      count: 20,
      useNumbering: true,
      startNumber: 1,
      digitCount: 3,
      numberPosition: "suffix",
      separator: "_",
      extensions: ["jpg"],
    },
  },
  {
    name: "Data CSV Files",
    description: "Timestamped CSV data files",
    icon: FileSpreadsheet,
    config: {
      creationMode: "pattern",
      baseName: "data",
      count: 1,
      useNumbering: false,
      useDate: true,
      dateFormat: "YYYY-MM-DD",
      datePosition: "suffix",
      separator: "_",
      extensions: ["csv"],
    },
  },
  {
    name: "Configuration Files",
    description: "Common config files for projects",
    icon: File,
    config: {
      creationMode: "list",
      fileList: ".env, .gitignore, .eslintrc, .prettierrc, tsconfig.json, package.json",
      useNumbering: false,
      extensions: ["json"],
    },
  },
  {
    name: "Database Scripts",
    description: "Numbered SQL migration scripts",
    icon: Database,
    config: {
      creationMode: "pattern",
      baseName: "migration",
      count: 5,
      useNumbering: true,
      startNumber: 1,
      digitCount: 3,
      numberPosition: "prefix",
      separator: "_",
      useDate: true,
      dateFormat: "YYYYMMDD",
      datePosition: "suffix",
      extensions: ["sql"],
    },
  },
  {
    name: "CSV Template: User-ID-Email",
    description: "CSV with columns: Username, UserID, Email",
    icon: FileSpreadsheet,
    config: {
      creationMode: "csv",
      extensions: ["txt"],
      csvDelimiter: "_",
      csvColumnOrder: ["Username", "UserID", "Email"],
      csvColumnConfig: {
        Username: { enabled: true, prefix: "", suffix: "" },
        UserID: { enabled: true, prefix: "ID", suffix: "" },
        Email: { enabled: true, prefix: "", suffix: "" },
      },
      csvRows: [],
      csvHeaders: [],
    },
  },
];

interface FilePresetTemplatesProps {
  onSelectPreset: (preset: FilePresetTemplate) => void;
}

export function FilePresetTemplates({ onSelectPreset }: FilePresetTemplatesProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          📄 Quick Start Templates
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {FILE_PRESET_TEMPLATES.map((preset) => {
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
