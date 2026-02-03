/**
 * File path: src/features/sql-export-wizard/components/ImportPanel.tsx
 *
 * Frontend component for import configuration and execution
 * Handles file selection, column mapping, and import options
 */

import { useState, useEffect } from "react";
import { Upload, ArrowRight, Save, FolderOpen } from "lucide-react";
import {
  DatabaseConnection,
  ImportConfiguration,
  ImportTemplate,
  ExportTemplate,
} from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PresetDialog } from "./PresetDialog";
import { PresetManager } from "./PresetManager";
import {
  getImportTemplates,
  saveImportTemplate,
  deleteImportTemplate,
  addActivityEntry,
} from "../utils/storage";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ImportPanelProps {
  connection: DatabaseConnection | null;
  selectedDatabase?: string;
  onActivityLogged?: () => void;
}

export function ImportPanel({
  connection,
  selectedDatabase,
  onActivityLogged,
}: ImportPanelProps) {
  const [sourceFile, setSourceFile] = useState("");
  const [fileType, setFileType] = useState("csv");
  const [delimiter, setDelimiter] = useState(",");
  const [firstRowHeaders, setFirstRowHeaders] = useState(true);
  const [targetTable, setTargetTable] = useState("");
  const [createNewTable, setCreateNewTable] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ImportTemplate | null>(
    null,
  );
  const [presets, setPresets] = useState<ImportTemplate[]>([]);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = () => {
    setPresets(getImportTemplates());
  };

  const getCurrentConfiguration = (): ImportConfiguration => {
    return {
      source: {
        file: sourceFile,
        fileType,
        delimiter,
        encoding: "UTF-8",
        firstRowHeaders,
        skipEmptyRows: true,
        trimWhitespace: false,
        skipRows: 0,
      },
      destination: {
        server: connection?.server || "",
        database: selectedDatabase || "",
        schema: "dbo",
        table: targetTable,
        createNew: createNewTable,
      },
      columnMapping: [],
      options: {
        onRowExists: "insert-only",
        batchSize: 1000,
        useTransactions: true,
        validateData: true,
        createIndexes: false,
        errorHandling: "stop",
      },
    };
  };

  const handleSavePreset = (preset: ExportTemplate | ImportTemplate) => {
    // Type guard: ensure it's an ImportTemplate
    if ('configuration' in preset && 'columnMapping' in preset.configuration) {
      const importPreset = preset as ImportTemplate;
      const presetToSave: ImportTemplate = {
        ...importPreset,
        configuration: getCurrentConfiguration(),
      };
      saveImportTemplate(presetToSave);
      loadPresets();
    }
  };

  const handleLoadPreset = (preset: ExportTemplate | ImportTemplate) => {
    // Type guard: ensure it's an ImportTemplate
    if (!('configuration' in preset && 'columnMapping' in preset.configuration)) {
      return; // Not an import preset, ignore
    }
    const importPreset = preset as ImportTemplate;
    const config = importPreset.configuration;

    // Restore configuration
    setSourceFile(config.source.file);
    setFileType(config.source.fileType);
    setDelimiter(config.source.delimiter || ",");
    setFirstRowHeaders(config.source.firstRowHeaders ?? true);
    setTargetTable(config.destination.table);
    setCreateNewTable(config.destination.createNew);

    // Update last used
    const updatedPreset: ImportTemplate = {
      ...importPreset,
      lastUsed: new Date(),
    };
    saveImportTemplate(updatedPreset);
    loadPresets();
  };

  const handleDeletePreset = (presetId: string) => {
    deleteImportTemplate(presetId);
    loadPresets();
  };

  const steps = [
    { id: "source", label: "Source File" },
    { id: "format", label: "Format" },
    { id: "destination", label: "Destination" },
    { id: "mapping", label: "Mapping & Run" },
  ];
  const progressValue = Math.round(
    ((stepIndex + 1) / steps.length) * 100,
  );
  const isLastStep = stepIndex === steps.length - 1;

  const handleImport = () => {
    // In production, this would call a backend API to execute the import
    console.log("Importing...", {
      connection,
      selectedDatabase,
      sourceFile,
      fileType,
      delimiter,
      firstRowHeaders,
      targetTable,
      createNewTable,
    });

    const targetLabel = createNewTable
      ? targetTable || "New table"
      : "Existing table";
    const detailParts = [
      fileType.toUpperCase(),
      selectedDatabase || "Database",
      targetLabel,
      sourceFile || "No file selected",
    ];
    addActivityEntry({
      id: `import-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "import",
      title: `Imported to ${targetLabel}`,
      detail: detailParts.filter(Boolean).join(" • "),
      timestamp: new Date().toISOString(),
      status: "success",
    });
    onActivityLogged?.();
  };

  const handleValidate = () => {
    // In production, this would validate the import configuration
    console.log("Validating import...");
  };

  if (!connection) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-8 text-center shadow-sm">
        <p className="text-slate-500 dark:text-slate-400">
          Please connect to a database to start importing
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
              <Upload className="h-4 w-4" />
            </span>
            Import Configuration
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Map incoming data, validate rows, and choose a destination table.
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
            {createNewTable ? "Create new table" : "Append to existing"}
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

      {/* Source File */}
      {stepIndex === 0 && (
        <Card className="bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70">
          <CardHeader>
            <CardTitle className="text-sm">Source File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div>
            <Label>File</Label>
            <div className="mt-1 rounded-lg border border-dashed border-slate-300 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Input
                  value={sourceFile}
                  onChange={(e) => setSourceFile(e.target.value)}
                  placeholder="/Users/justin/data.csv"
                  className="bg-transparent"
                />
                <Button variant="outline" size="sm">
                  Browse
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Drag & drop a file, paste a path, or browse to select.
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p>File Type: {fileType.toUpperCase()} (Auto-detected)</p>
            <p>File Size: 2.3 MB</p>
            <p>Est. Rows: ~5,000</p>
          </div>
        </CardContent>
      </Card>
      )}

      {/* File Format Settings */}
      {stepIndex === 1 && (
        <Card className="bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70">
          <CardHeader>
            <CardTitle className="text-sm">File Format Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Delimiter</Label>
              <Select value={delimiter} onValueChange={setDelimiter}>
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
              <Label>Text Qualifier</Label>
              <Select defaultValue='"'>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='"'>&quot; (Double Quote)</SelectItem>
                  <SelectItem value="'">' (Single Quote)</SelectItem>
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
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="first-row-headers"
                checked={firstRowHeaders}
                onCheckedChange={(checked) =>
                  setFirstRowHeaders(checked as boolean)
                }
              />
              <Label
                htmlFor="first-row-headers"
                className="font-normal cursor-pointer"
              >
                First row contains headers
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="skip-empty" defaultChecked />
              <Label
                htmlFor="skip-empty"
                className="font-normal cursor-pointer"
              >
                Skip empty rows
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="trim-whitespace" />
              <Label
                htmlFor="trim-whitespace"
                className="font-normal cursor-pointer"
              >
                Trim whitespace
              </Label>
            </div>
          </div>
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
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Server</Label>
              <Input value={connection.server} disabled className="mt-1" />
            </div>
            <div>
              <Label>Database</Label>
              <Select value={selectedDatabase || ""}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Analytics">Analytics</SelectItem>
                </SelectContent>
              </Select>
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
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="create-new"
                checked={createNewTable}
                onChange={() => setCreateNewTable(true)}
                className="w-4 h-4"
              />
              <Label
                htmlFor="create-new"
                className="font-normal cursor-pointer"
              >
                Create new:
              </Label>
              <Input
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                placeholder="ImportedUsers"
                className="flex-1 ml-2"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="append-existing"
                checked={!createNewTable}
                onChange={() => setCreateNewTable(false)}
                className="w-4 h-4"
              />
              <Label
                htmlFor="append-existing"
                className="font-normal cursor-pointer"
              >
                Append to existing:
              </Label>
              <div className="flex-1 ml-2">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Table" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Users">Users</SelectItem>
                    <SelectItem value="Orders">Orders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Column Mapping Preview */}
      {stepIndex === 3 && (
        <Card className="bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70">
          <CardHeader>
            <CardTitle className="text-sm">Column Mapping</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="space-y-2 text-sm rounded-lg border border-slate-200/70 bg-white/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/40">
            <div className="grid grid-cols-3 gap-4 font-medium text-slate-700 dark:text-slate-300 pb-2 border-b">
              <span>CSV Column</span>
              <span className="flex items-center justify-center">
                <ArrowRight className="h-4 w-4" />
              </span>
              <span>Database Column</span>
            </div>
            <div className="grid grid-cols-3 gap-4 py-2">
              <span className="text-slate-600 dark:text-slate-400">
                user_id
              </span>
              <span className="flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                UserID (INT)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 py-2">
              <span className="text-slate-600 dark:text-slate-400">
                username
              </span>
              <span className="flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                Username (NVARCHAR(50))
              </span>
            </div>
            <div className="pt-2">
              <Button variant="outline" size="sm">
                Auto-Map Columns
              </Button>
              <Button variant="outline" size="sm" className="ml-2">
                Edit Mapping...
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
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
              <Button variant="outline" onClick={handleValidate}>
                Validate
              </Button>
              <Button variant="outline" onClick={() => console.log("Preview")}>
                Preview Data (First 100 Rows)
              </Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                Import
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
          type="import"
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
          type="import"
          presets={presets}
          onLoad={handleLoadPreset}
          onDelete={handleDeletePreset}
          onClose={() => setShowPresetManager(false)}
        />
      )}
    </div>
  );
}
