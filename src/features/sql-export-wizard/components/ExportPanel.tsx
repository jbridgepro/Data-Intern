/**
 * File path: src/features/sql-export-wizard/components/ExportPanel.tsx
 *
 * Frontend component for export configuration and execution
 * Handles export settings, format selection, and destination configuration
 */

import { useState, useEffect } from "react";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Code,
  Database,
  Save,
  FolderOpen,
} from "lucide-react";
import {
  DatabaseConnection,
  ExportFormat,
  ExportConfiguration,
  ExportTemplate,
  ImportTemplate,
} from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PresetDialog } from "./PresetDialog";
import { PresetManager } from "./PresetManager";
import {
  getTemplates,
  saveTemplate,
  deleteTemplate,
  addActivityEntry,
} from "../utils/storage";
import { cn } from "@/lib/utils";

interface ExportPanelProps {
  connection: DatabaseConnection | null;
  selectedDatabase?: string;
  selectedTable?: {
    schema: string;
    name: string;
    rowCount?: number;
    size?: number;
    lastUpdated?: string;
  } | null;
  onActivityLogged?: () => void;
}

export function ExportPanel({
  connection,
  selectedDatabase,
  selectedTable,
  onActivityLogged,
}: ExportPanelProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [useCustomQuery, setUseCustomQuery] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [outputFolder, setOutputFolder] = useState("");
  const [fileName, setFileName] = useState("");
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ExportTemplate | null>(
    null,
  );
  const [presets, setPresets] = useState<ExportTemplate[]>([]);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = () => {
    setPresets(getTemplates());
  };

  const getCurrentConfiguration = (): ExportConfiguration => {
    return {
      source: {
        database: selectedDatabase || "",
        schema: "dbo",
        object: selectedTable?.name || "",
        objectType: "table",
        useCustomQuery,
        customQuery: useCustomQuery ? customQuery : undefined,
      },
      format: exportFormat,
      formatOptions: {
        includeHeaders,
        delimiter: ",",
        encoding: "UTF-8",
      },
      destination: {
        folder: outputFolder,
        fileName,
        ifExists: "ask",
      },
      options: {},
    };
  };

  const handleSavePreset = (preset: ExportTemplate | ImportTemplate) => {
    // Type guard: ensure it's an ExportTemplate
    if ('configuration' in preset && 'format' in preset.configuration) {
      const exportPreset = preset as ExportTemplate;
      const presetToSave: ExportTemplate = {
        ...exportPreset,
        configuration: getCurrentConfiguration(),
      };
      saveTemplate(presetToSave);
      loadPresets();
    }
  };

  const handleLoadPreset = (preset: ExportTemplate | ImportTemplate) => {
    // Type guard: ensure it's an ExportTemplate
    if (!('configuration' in preset && 'format' in preset.configuration)) {
      return; // Not an export preset, ignore
    }
    const exportPreset = preset as ExportTemplate;
    const config = preset.configuration;

    // Restore configuration
    if (config.source.useCustomQuery) {
      setUseCustomQuery(true);
      setCustomQuery(config.source.customQuery || "");
    } else {
      setUseCustomQuery(false);
    }

    setExportFormat(config.format);
    setIncludeHeaders(config.formatOptions?.includeHeaders ?? true);
    setOutputFolder(config.destination.folder);
    setFileName(config.destination.fileName);

    // Update last used
    const updatedPreset: ExportTemplate = {
      ...exportPreset,
      lastUsed: new Date(),
    };
    saveTemplate(updatedPreset);
    loadPresets();
  };

  const handleDeletePreset = (presetId: string) => {
    deleteTemplate(presetId);
    loadPresets();
  };

  const steps = [
    { id: "source", label: "Source" },
    { id: "format", label: "Format" },
    { id: "destination", label: "Destination" },
    { id: "review", label: "Review & Run" },
  ];
  const progressValue = Math.round(
    ((stepIndex + 1) / steps.length) * 100,
  );
  const isLastStep = stepIndex === steps.length - 1;

  const formatOptions: {
    id: ExportFormat;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "csv",
      label: "CSV",
      description: "Spreadsheet-friendly rows with configurable delimiters.",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: "excel",
      label: "Excel",
      description: "Create .xlsx files for analysts and ops teams.",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
    {
      id: "json",
      label: "JSON",
      description: "Emit structured arrays or line-delimited events.",
      icon: <Code className="h-4 w-4" />,
    },
    {
      id: "xml",
      label: "XML",
      description: "Legacy integrations and enterprise exchange formats.",
      icon: <Code className="h-4 w-4" />,
    },
    {
      id: "sql",
      label: "SQL Inserts",
      description: "Generate INSERT statements for migrations.",
      icon: <Database className="h-4 w-4" />,
    },
    {
      id: "parquet",
      label: "Parquet",
      description: "Columnar exports tuned for analytics pipelines.",
      icon: <Database className="h-4 w-4" />,
    },
  ];

  const handleExport = () => {
    // In production, this would call a backend API to execute the export
    console.log("Exporting...", {
      connection,
      selectedDatabase,
      selectedTable,
      exportFormat,
      useCustomQuery,
      customQuery,
      outputFolder,
      fileName,
    });

    const tableLabel = selectedTable?.name || "Custom selection";
    const detailParts = [
      exportFormat.toUpperCase(),
      selectedDatabase || "Database",
      tableLabel,
      fileName || "Unnamed file",
    ];
    addActivityEntry({
      id: `export-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "export",
      title: `Exported ${tableLabel}`,
      detail: detailParts.filter(Boolean).join(" • "),
      timestamp: new Date().toISOString(),
      status: "success",
    });
    onActivityLogged?.();
  };

  const handlePreview = () => {
    // In production, this would preview the first 100 rows
    console.log("Previewing export...");
  };

  if (!connection) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-8 text-center shadow-sm">
        <p className="text-slate-500 dark:text-slate-400">
          Please connect to a database to start exporting
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-6 space-y-6 overflow-y-auto h-full shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Download className="h-4 w-4" />
            </span>
            Export Configuration
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure the source, format, and destination for this export.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-slate-900/5 text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {selectedDatabase || "No database"}
          </Badge>
          <Badge
            variant="outline"
            className="border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"
          >
            {selectedTable ? selectedTable.name : "No table selected"}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <span>{progressValue}% complete</span>
        </div>
        <Progress value={progressValue} className="h-2" />
        <div className="flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setStepIndex(index)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition",
                index === stepIndex
                  ? "border-slate-900/20 bg-slate-900/[0.06] text-slate-800 dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
                  : "border-slate-200/70 bg-white/80 text-slate-500 hover:border-slate-300 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400",
              )}
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              {step.label}
            </button>
          ))}
        </div>
      </div>

      {/* Source Configuration */}
      {stepIndex === 0 && (
        <Card className="bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70">
          <CardHeader>
            <CardTitle className="text-sm">Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Database</Label>
              <Input value={selectedDatabase || ""} disabled className="mt-1" />
            </div>
            <div>
              <Label>Schema</Label>
              <Select defaultValue="dbo">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dbo">dbo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Object</Label>
              <Select
                value={selectedTable?.name || ""}
                onValueChange={(value) => {
                  // Handle table selection
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Users">Users</SelectItem>
                  <SelectItem value="Orders">Orders</SelectItem>
                  <SelectItem value="Products">Products</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="export-entire"
                checked={!useCustomQuery}
                onChange={() => setUseCustomQuery(false)}
                className="w-4 h-4"
              />
              <Label
                htmlFor="export-entire"
                className="font-normal cursor-pointer"
              >
                Export entire table
                {selectedTable && " (estimated rows will be shown here)"}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="export-custom"
                checked={useCustomQuery}
                onChange={() => setUseCustomQuery(true)}
                className="w-4 h-4"
              />
              <Label
                htmlFor="export-custom"
                className="font-normal cursor-pointer"
              >
                Use custom query
              </Label>
            </div>
          </div>

          {useCustomQuery && (
            <div>
              <Label>SQL Query</Label>
              <Textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM Users WHERE..."
                className="mt-1 min-h-[120px] font-mono text-sm bg-white/90 dark:bg-slate-950/60"
              />
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Export Format */}
      {stepIndex === 1 && (
        <Card className="bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70">
          <CardHeader>
            <CardTitle className="text-sm">Export Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {formatOptions.map((option) => {
              const isActive = exportFormat === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setExportFormat(option.id)}
                  className={cn(
                    "flex h-full flex-col gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                    isActive
                      ? "border-slate-900/20 bg-slate-900/[0.04] shadow-sm dark:border-white/10 dark:bg-white/5"
                      : "border-slate-200/70 bg-white/80 hover:border-slate-300 dark:border-slate-800/70 dark:bg-slate-900/60",
                  )}
                  aria-pressed={isActive}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        isActive
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                      )}
                    >
                      {option.icon}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {option.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {option.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Format-specific options */}
          {exportFormat === "csv" && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Delimiter</Label>
                  <Select defaultValue=",">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=";">Semicolon (;)</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Encoding</Label>
                  <Select defaultValue="utf-8">
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utf-8">UTF-8</SelectItem>
                      <SelectItem value="utf-16">UTF-16</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-headers"
                  checked={includeHeaders}
                  onCheckedChange={(checked) =>
                    setIncludeHeaders(checked as boolean)
                  }
                />
                <Label
                  htmlFor="include-headers"
                  className="font-normal cursor-pointer"
                >
                  Include headers
                </Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Destination */}
      {stepIndex === 2 && (
        <Card className="bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70">
          <CardHeader>
            <CardTitle className="text-sm">Destination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Output Folder</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={outputFolder}
                  onChange={(e) => setOutputFolder(e.target.value)}
                  placeholder="/Users/justin/Exports"
                />
                <Button variant="outline" size="sm">
                  Browse
                </Button>
              </div>
            </div>
            <div>
              <Label>File Name</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Users_export_2025-01-24.csv"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review & Run */}
      {stepIndex === 3 && (
        <Card className="bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70">
          <CardHeader>
            <CardTitle className="text-sm">Review & Run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Source
                </div>
                <div className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                  {selectedDatabase || "Database"} • {selectedTable?.name || "Table"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {useCustomQuery ? "Custom SQL query" : "Full table export"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Format
                </div>
                <div className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                  {exportFormat.toUpperCase()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {exportFormat === "csv"
                    ? `${includeHeaders ? "With headers" : "No headers"} • UTF-8`
                    : "Default format options"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Destination
                </div>
                <div className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                  {fileName || "Choose a file name"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {outputFolder || "Select an output folder"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPreset(null);
                    setShowPresetDialog(true);
                  }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Preset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPresetManager(true)}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Load Preset
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePreview}>
                  Preview (First 100 Rows)
                </Button>
                <Button onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setStepIndex((prev) => Math.max(0, prev - 1))
            }
            disabled={stepIndex === 0}
          >
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setStepIndex((prev) =>
                Math.min(steps.length - 1, prev + 1),
              )
            }
            disabled={isLastStep}
          >
            Next
          </Button>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {steps[stepIndex].label} • Step {stepIndex + 1} of {steps.length}
        </span>
      </div>

      {/* Preset Dialog */}
      {showPresetDialog && (
        <PresetDialog
          type="export"
          preset={editingPreset}
          onSave={handleSavePreset}
          onClose={() => {
            setShowPresetDialog(false);
            setEditingPreset(null);
          }}
        />
      )}

      {/* Preset Manager */}
      {showPresetManager && (
        <PresetManager
          type="export"
          presets={presets}
          onLoad={handleLoadPreset}
          onDelete={handleDeletePreset}
          onClose={() => setShowPresetManager(false)}
        />
      )}
    </div>
  );
}
