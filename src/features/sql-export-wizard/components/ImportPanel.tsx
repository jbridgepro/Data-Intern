/**
 * File path: src/features/sql-export-wizard/components/ImportPanel.tsx
 *
 * Frontend component for import configuration and execution
 * Handles file selection, column mapping, and import options
 */

import { useState, useEffect } from "react";
import { Upload, FileText, ArrowRight, Save, FolderOpen } from "lucide-react";
import {
  DatabaseConnection,
  ImportConfiguration,
  ImportTemplate,
  ExportTemplate,
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
import {
  getImportTemplates,
  saveImportTemplate,
  deleteImportTemplate,
} from "../utils/storage";

interface ImportPanelProps {
  connection: DatabaseConnection | null;
  selectedDatabase?: string;
}

export function ImportPanel({
  connection,
  selectedDatabase,
}: ImportPanelProps) {
  const [sourceFile, setSourceFile] = useState("");
  const [fileType, setFileType] = useState("csv");
  const [delimiter, setDelimiter] = useState(",");
  const [firstRowHeaders, setFirstRowHeaders] = useState(true);
  const [targetTable, setTargetTable] = useState("");
  const [createNewTable, setCreateNewTable] = useState(true);
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
  };

  const handleValidate = () => {
    // In production, this would validate the import configuration
    console.log("Validating import...");
  };

  if (!connection) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          Please connect to a database to start importing
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 space-y-6 overflow-y-auto h-full">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <Upload className="h-5 w-5" />
        IMPORT CONFIGURATION
      </h2>

      {/* Source File */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Source File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>File</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={sourceFile}
                onChange={(e) => setSourceFile(e.target.value)}
                placeholder="/Users/justin/data.csv"
              />
              <Button variant="outline" size="sm">
                Browse
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Drag & Drop Files Here
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p>File Type: {fileType.toUpperCase()} (Auto-detected)</p>
            <p>File Size: 2.3 MB</p>
            <p>Est. Rows: ~5,000</p>
          </div>
        </CardContent>
      </Card>

      {/* File Format Settings */}
      <Card>
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

      {/* Destination */}
      <Card>
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

      {/* Column Mapping Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Column Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
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
