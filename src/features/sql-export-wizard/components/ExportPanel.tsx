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
import { getTemplates, saveTemplate, deleteTemplate } from "../utils/storage";

interface ExportPanelProps {
  connection: DatabaseConnection | null;
  selectedDatabase?: string;
  selectedTable?: { schema: string; name: string } | null;
}

export function ExportPanel({
  connection,
  selectedDatabase,
  selectedTable,
}: ExportPanelProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [useCustomQuery, setUseCustomQuery] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [outputFolder, setOutputFolder] = useState("");
  const [fileName, setFileName] = useState("");
  const [includeHeaders, setIncludeHeaders] = useState(true);
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

  const formatIcons: Record<ExportFormat, React.ReactNode> = {
    csv: <FileText className="h-4 w-4" />,
    excel: <FileSpreadsheet className="h-4 w-4" />,
    json: <Code className="h-4 w-4" />,
    xml: <Code className="h-4 w-4" />,
    sql: <Database className="h-4 w-4" />,
    parquet: <Database className="h-4 w-4" />,
  };

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
  };

  const handlePreview = () => {
    // In production, this would preview the first 100 rows
    console.log("Previewing export...");
  };

  if (!connection) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          Please connect to a database to start exporting
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 space-y-6 overflow-y-auto h-full">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <Download className="h-5 w-5" />
        EXPORT CONFIGURATION
      </h2>

      {/* Source Configuration */}
      <Card>
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
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM Users WHERE..."
                className="w-full mt-1 p-2 border rounded-md font-mono text-sm min-h-[100px] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Export Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                "csv",
                "excel",
                "json",
                "xml",
                "sql",
                "parquet",
              ] as ExportFormat[]
            ).map((format) => (
              <div
                key={format}
                className={`
                    border rounded-lg p-3 cursor-pointer transition-colors
                    ${
                      exportFormat === format
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }
                  `}
                onClick={() => setExportFormat(format)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={exportFormat === format}
                    onChange={() => setExportFormat(format)}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatIcons[format]}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {format.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
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

      {/* Destination */}
      <Card>
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

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
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
