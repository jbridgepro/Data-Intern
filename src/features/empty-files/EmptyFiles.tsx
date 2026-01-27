/**
 * File: src/features/empty-files/EmptyFiles.tsx
 *
 * Main component for the Empty File Generator feature.
 * Allows users to bulk create empty files with customizable naming patterns.
 */

import { useState, useEffect, useCallback } from "react";
import {
  FilePlus,
  FolderOpen,
  Play,
  Loader2,
  Save,
  Download,
  Upload,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  List,
  Type,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

import {
  FileConfig,
  GeneratedFile,
  generatePreview,
  calculateStats,
  GenerationStats,
} from "./utils/fileGenerator";
import { PreviewList } from "./components/PreviewList";
import { ExtensionSelector } from "./components/ExtensionSelector";
import { SettingsAccordion } from "./components/SettingsAccordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Configuration preset type
interface ConfigPreset {
  name: string;
  config: FileConfig;
}

export const EmptyFiles = () => {
  const [config, setConfig] = useState<FileConfig>({
    rootPath: "",
    creationMode: "pattern",
    fileList: "",
    baseName: "file",
    extensions: ["txt"],
    useNumbering: true,
    count: 1,
    startNumber: 1,
    digitCount: 3,
    numberPosition: "suffix",
    separator: "_",
    customPrefix: "",
    customSuffix: "",
    useDate: false,
    dateFormat: "YYYY-MM-DD",
    datePosition: "prefix",
    useRandomString: false,
    randomStringLength: 8,
    randomStringPosition: "suffix",
    useUUID: false,
    uuidPosition: "suffix",
    overwrite: false,
  });

  const [previewFiles, setPreviewFiles] = useState<GeneratedFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newExtension, setNewExtension] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [stats, setStats] = useState<GenerationStats>({
    total: 0,
    success: 0,
    error: 0,
    exists: 0,
    pending: 0,
  });
  const [presets, setPresets] = useState<ConfigPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  // Map to store edited file names: fileId -> editedName
  const [editedNames, setEditedNames] = useState<Map<string, string>>(
    new Map(),
  );

  // Update preview when config changes
  // Preserve edited names if file IDs still exist
  useEffect(() => {
    generatePreview(config).then((files) => {
      // Apply edited names to files that still exist
      setPreviewFiles((prevFiles) => {
        const updatedFiles = files.map((file) => {
          // Check if this file ID had an edited name
          const editedName = editedNames.get(file.id);
          if (editedName) {
            return { ...file, name: editedName };
          }
          return file;
        });
        setStats(calculateStats(updatedFiles));
        return updatedFiles;
      });
    });
    // Only regenerate when config changes, not when editedNames changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("emptyFileGeneratorPresets");
      if (saved) {
        setPresets(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load presets:", e);
    }
  }, []);

  // Save presets to localStorage
  const savePresets = useCallback((newPresets: ConfigPreset[]) => {
    try {
      localStorage.setItem(
        "emptyFileGeneratorPresets",
        JSON.stringify(newPresets),
      );
      setPresets(newPresets);
    } catch (e) {
      console.error("Failed to save presets:", e);
    }
  }, []);

  const handlePathSelect = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setConfig((prev) => ({ ...prev, rootPath: selected }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addExtension = (ext?: string) => {
    const targetExt = ext || newExtension;
    if (targetExt && !config.extensions.includes(targetExt)) {
      const cleanExt = targetExt.replace(/^\./, "");
      setConfig((prev) => ({
        ...prev,
        extensions: [...prev.extensions, cleanExt],
      }));
      setNewExtension("");
    }
  };

  const removeExtension = (ext: string) => {
    setConfig((prev) => ({
      ...prev,
      extensions: prev.extensions.filter((e) => e !== ext),
    }));
  };

  /**
   * Handles renaming a file in the preview
   */
  const handleRename = (fileId: string, newName: string) => {
    // Update the edited names map
    setEditedNames((prev) => {
      const updated = new Map(prev);
      updated.set(fileId, newName);
      return updated;
    });

    // Update the preview files immediately
    setPreviewFiles((prev) => {
      const updated = prev.map((file) =>
        file.id === fileId ? { ...file, name: newName } : file,
      );
      setStats(calculateStats(updated));
      return updated;
    });
  };

  /**
   * Handles file creation with progress tracking and real-time updates
   * Uses edited names if available
   */
  const handleCreate = async () => {
    if (!config.rootPath) return;
    setIsGenerating(true);
    setGenerationProgress(0);

    // Use current preview files (which may have edited names) instead of regenerating
    const files = previewFiles.map((file) => {
      // Ensure we use the edited name if it exists
      const editedName = editedNames.get(file.id);
      return editedName ? { ...file, name: editedName } : file;
    });

    const results = [...files];
    const total = results.length;

    for (let i = 0; i < results.length; i++) {
      const file = results[i];
      try {
        const fullPath = await join(config.rootPath, file.name);
        const fileExists = await exists(fullPath);

        if (fileExists && !config.overwrite) {
          results[i] = { ...file, status: "exists" };
        } else {
          await writeTextFile(fullPath, "");
          results[i] = { ...file, status: "success" };
        }
      } catch (e: any) {
        console.error(`Failed to create ${file.name}`, e);
        const errorMessage = e?.message || "Unknown error occurred";
        results[i] = { ...file, status: "error", errorMessage };
      }

      // Update progress and UI in real-time
      const progress = ((i + 1) / total) * 100;
      setGenerationProgress(progress);
      setPreviewFiles([...results]);
      setStats(calculateStats(results));

      // Small delay to allow UI to update (optional, can be removed for faster generation)
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    setIsGenerating(false);
    setGenerationProgress(100);
  };

  /**
   * Saves current configuration as a preset
   */
  const savePreset = () => {
    if (!presetName.trim()) return;
    const newPreset: ConfigPreset = {
      name: presetName.trim(),
      config: { ...config },
    };
    const updatedPresets = [...presets, newPreset];
    savePresets(updatedPresets);
    setPresetName("");
  };

  /**
   * Loads a preset configuration
   */
  const loadPreset = (preset: ConfigPreset) => {
    setConfig({ ...preset.config });
  };

  /**
   * Deletes a preset
   */
  const deletePreset = (index: number) => {
    const updatedPresets = presets.filter((_, i) => i !== index);
    savePresets(updatedPresets);
  };

  /**
   * Exports current configuration as JSON
   */
  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "empty-file-generator-config.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Imports configuration from JSON file
   */
  const importConfig = async () => {
    try {
      const selected = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        // Note: In a real Tauri app, you'd use readTextFile from @tauri-apps/plugin-fs
        // For now, this is a placeholder - you'd need to implement file reading
        console.log("Import config from:", selected);
      }
    } catch (e) {
      console.error("Failed to import config:", e);
    }
  };



  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <FilePlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">File Creation</h2>
            <p className="text-xs text-muted-foreground">
              Bulk create files with patterns or custom lists
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Config Panel - Left */}
        <div className="w-[400px] border-r overflow-y-auto p-6 space-y-8 bg-card/30">
          {/* Target Location */}
          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Location
            </Label>
            <div className="flex gap-2">
              <Input
                value={config.rootPath}
                readOnly
                placeholder="Select destination folder..."
                className="bg-background"
              />
              <Button variant="outline" size="icon" onClick={handlePathSelect}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </section>

          
          <Separator />
          
          {/* Mode Selection */}
          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Creation Mode
            </Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setConfig(prev => ({ ...prev, creationMode: 'pattern' }))}
                className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  config.creationMode === 'pattern' || !config.creationMode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                disabled={isGenerating}
              >
                <Type className="h-4 w-4" />
                Pattern
              </button>
              <button
                onClick={() => setConfig(prev => ({ ...prev, creationMode: 'list' }))}
                className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  config.creationMode === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                disabled={isGenerating}
              >
                <List className="h-4 w-4" />
                List
              </button>
            </div>
          </section>

          <Separator />

          {/* List Mode Input */}
          {config.creationMode === 'list' && (
            <>
                <section className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File List</Label>
                    <textarea
                    value={config.fileList}
                    onChange={(e) => setConfig(prev => ({ ...prev, fileList: e.target.value }))}
                    placeholder="Enter file names, separated by newlines or commas..."
                    className="flex min-h-[300px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isGenerating}
                    />
                    <p className="text-[10px] text-muted-foreground">
                    Separate names with newlines or commas. Extensions will be appended automatically.
                    </p>
                </section>
                <Separator />
            </>
          )}

          {/* Core Naming */}
          <section className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Naming Pattern
            </Label>

            <div className="grid gap-4">
              {config.creationMode !== 'list' && (
                  <div className="space-y-2">
                    <Label>Base Name</Label>
                    <Input
                    value={config.baseName}
                    onChange={(e) =>
                        setConfig((prev) => ({ ...prev, baseName: e.target.value }))
                    }
                    placeholder="e.g. project_file"
                    />
                  </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Separator</Label>
                  <Select
                    value={config.separator}
                    onValueChange={(v: string) =>
                      setConfig((prev) => ({
                        ...prev,
                        separator: v === "NONE" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Underscore (_)</SelectItem>
                      <SelectItem value="-">Hyphen (-)</SelectItem>
                      <SelectItem value=".">Dot (.)</SelectItem>
                      <SelectItem value=" ">Space ( )</SelectItem>
                      <SelectItem value="NONE">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {config.creationMode !== 'list' && (
                  <div className="space-y-2">
                    <Label>Count</Label>
                    <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={config.count}
                        onChange={(e) =>
                        setConfig((prev) => ({
                            ...prev,
                            count: parseInt(e.target.value) || 1,
                        }))
                        }
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
          <Separator />
          {/* Custom Prefix/Suffix */}
          <section className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Custom Prefix & Suffix
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Prefix</Label>
                <Input
                  value={config.customPrefix}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      customPrefix: e.target.value,
                    }))
                  }
                  placeholder="e.g. project_"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Suffix</Label>
                <Input
                  value={config.customSuffix}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      customSuffix: e.target.value,
                    }))
                  }
                  placeholder="e.g. _final"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </section>
          <Separator />
          {/* Extensions */}
          <Separator />
          
          {/* Extensions */}
          <section className="space-y-3">
            <ExtensionSelector 
              selectedExtensions={config.extensions}
              onAdd={addExtension}
              onRemove={removeExtension}
            />
          </section>

          <Separator />

          {/* Advanced Naming Options */}
          <SettingsAccordion title="Advanced Naming Options">
            {/* Numbering Options */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Numbering
                </Label>
                <Switch
                  checked={config.useNumbering}
                  onCheckedChange={(c: boolean) =>
                    setConfig((prev) => ({ ...prev, useNumbering: c }))
                  }
                />
              </div>

              {config.useNumbering && (
                <div className="grid grid-cols-2 gap-4 pl-2 border-l-2 ml-1">
                  <div className="space-y-2">
                    <Label className="text-xs">Start From</Label>
                    <Input
                      type="number"
                      value={config.startNumber}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          startNumber: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Padding (001)</Label>
                    <div className="pt-2">
                      <Slider
                        min={1}
                        max={6}
                        step={1}
                        value={[config.digitCount]}
                        onValueChange={([v]: number[]) =>
                          setConfig((prev) => ({ ...prev, digitCount: v }))
                        }
                      />
                      <div className="text-right text-[10px] text-muted-foreground mt-1">
                        {config.digitCount} digits
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={config.numberPosition}
                      onValueChange={(
                        v: "prefix" | "suffix" | "after-prefix" | "before-suffix",
                      ) => setConfig((prev) => ({ ...prev, numberPosition: v }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="suffix">Suffix (Name_001)</SelectItem>
                        <SelectItem value="prefix">Prefix (001_Name)</SelectItem>
                        <SelectItem value="after-prefix">
                          After Prefix (Name_001)
                        </SelectItem>
                        <SelectItem value="before-suffix">
                          Before Suffix (001_Name)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </section>

            <Separator className="opacity-50" />

            {/* Date Options */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Timestamp
                </Label>
                <Switch
                  checked={config.useDate}
                  onCheckedChange={(c: boolean) =>
                    setConfig((prev) => ({ ...prev, useDate: c }))
                  }
                />
              </div>

              {config.useDate && (
                <div className="grid grid-cols-2 gap-4 pl-2 border-l-2 ml-1">
                  <div className="space-y-2">
                    <Label className="text-xs">Format</Label>
                    <Select
                      value={config.dateFormat}
                      onValueChange={(v: any) =>
                        setConfig((prev) => ({ ...prev, dateFormat: v }))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        <SelectItem value="YYYYMMDD">YYYYMMDD</SelectItem>
                        <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                        <SelectItem value="MM-DD-YYYY">MM-DD-YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD_HH-MM-SS">
                          YYYY-MM-DD_HH-MM-SS
                        </SelectItem>
                        <SelectItem value="YYYYMMDD_HHMMSS">
                          YYYYMMDD_HHMMSS
                        </SelectItem>
                        <SelectItem value="timestamp">Unix Timestamp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={config.datePosition}
                      onValueChange={(v: any) =>
                        setConfig((prev) => ({ ...prev, datePosition: v }))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prefix">Prefix</SelectItem>
                        <SelectItem value="suffix">Suffix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </section>
            
            <Separator className="opacity-50" />

            {/* Random String Options */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Random String
                </Label>
                <Switch
                  checked={config.useRandomString}
                  onCheckedChange={(c: boolean) =>
                    setConfig((prev) => ({ ...prev, useRandomString: c }))
                  }
                />
              </div>

              {config.useRandomString && (
                <div className="grid grid-cols-2 gap-4 pl-2 border-l-2 ml-1">
                  <div className="space-y-2">
                    <Label className="text-xs">Length</Label>
                    <Input
                      type="number"
                      min={1}
                      max={32}
                      value={config.randomStringLength}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          randomStringLength: parseInt(e.target.value) || 8,
                        }))
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={config.randomStringPosition}
                      onValueChange={(v: "prefix" | "suffix") =>
                        setConfig((prev) => ({
                          ...prev,
                          randomStringPosition: v,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prefix">Prefix</SelectItem>
                        <SelectItem value="suffix">Suffix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </section>
            
            <Separator className="opacity-50" />

            {/* UUID Options */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  UUID
                </Label>
                <Switch
                  checked={config.useUUID}
                  onCheckedChange={(c: boolean) =>
                    setConfig((prev) => ({ ...prev, useUUID: c }))
                  }
                />
              </div>

              {config.useUUID && (
                <div className="pl-2 border-l-2 ml-1">
                  <div className="space-y-2">
                    <Label className="text-xs">Position</Label>
                    <Select
                      value={config.uuidPosition}
                      onValueChange={(v: "prefix" | "suffix") =>
                        setConfig((prev) => ({ ...prev, uuidPosition: v }))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prefix">Prefix</SelectItem>
                        <SelectItem value="suffix">Suffix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </section>
          </SettingsAccordion>
          
          <Separator />
          
          {/* Configuration Presets */}
          <SettingsAccordion title="Saved Presets">
            <section className="space-y-3 pt-1">
              <div className="flex gap-2">
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && savePreset()}
                  placeholder="Preset name..."
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={savePreset}
                  disabled={!presetName.trim()}
                >
                  <Save className="h-3 w-3" />
                </Button>
              </div>
              {presets.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {presets.map((preset, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 group"
                    >
                      <button
                        onClick={() => loadPreset(preset)}
                        className="flex-1 text-left text-xs truncate"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => deletePreset(index)}
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportConfig}
                  className="flex-1"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={importConfig}
                  className="flex-1"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Import
                </Button>
              </div>
            </section>
          </SettingsAccordion>
          <div className="h-4" /> {/* Spacer */}
        </div>

        {/* Preview Panel - Right */}
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  Live Preview ({previewFiles.length} files)
                </span>
                <span className="text-xs text-muted-foreground">
                  Click names to edit
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="overwrite" className="text-xs cursor-pointer">
                    Overwrite existing
                  </Label>
                  <Switch
                    id="overwrite"
                    checked={config.overwrite}
                    onCheckedChange={(c: boolean) =>
                      setConfig((prev) => ({ ...prev, overwrite: c }))
                    }
                  />
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={
                    !config.rootPath ||
                    isGenerating ||
                    previewFiles.length === 0
                  }
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Generate Files
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(generationProgress)}%</span>
                </div>
                <Progress value={generationProgress} className="h-2" />
              </div>
            )}

            {/* Statistics Dashboard */}
            {stats.total > 0 && (
              <Card className="bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <BarChart3 className="h-3 w-3" />
                    Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold">{stats.total}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Success
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {stats.success}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        Exists
                      </span>
                      <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                        {stats.exists}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-500" />
                        Error
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {stats.error}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex-1 p-4 overflow-hidden">
            <PreviewList files={previewFiles} onRename={handleRename} />
          </div>
        </div>
      </div>
    </div>
  );
};
