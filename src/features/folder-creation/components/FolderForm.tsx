/**
 * File: src/features/folder-creation/components/FolderForm.tsx
 *
 * Front-end form component for folder creation configuration.
 * Provides all configuration options including naming patterns, date settings, and subfolders.
 */

import { open } from "@tauri-apps/plugin-dialog";
import { FolderConfig } from "../utils/folderUtils";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Separator } from "../../../components/ui/separator";
import { Switch } from "../../../components/ui/switch";
import { Slider } from "../../../components/ui/slider";
import { FolderOpen, Save, Download, Upload, XCircle, List, Type } from "lucide-react";
import { motion } from "framer-motion";

interface ConfigPreset {
  name: string;
  config: FolderConfig;
}

interface FolderFormProps {
  config: FolderConfig;
  setConfig: (config: FolderConfig) => void;
  isCreating: boolean;
  presets?: ConfigPreset[];
  presetName?: string;
  setPresetName?: (name: string) => void;
  onSavePreset?: () => void;
  onLoadPreset?: (preset: ConfigPreset) => void;
  onDeletePreset?: (index: number) => void;
  onExportConfig?: () => void;
  onImportConfig?: () => void;
}

export const FolderForm = ({
  config,
  setConfig,
  isCreating,
  presets = [],
  presetName = "",
  setPresetName,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onExportConfig,
  onImportConfig,
}: FolderFormProps) => {
  const handleSelectRoot = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Root Folder",
      });

      if (selected && typeof selected === "string") {
        setConfig({ ...config, rootPath: selected });
      }
    } catch (err) {
      console.error("Failed to select directory", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Target Location */}
      <section className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Location
        </Label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={config.rootPath || ""}
            placeholder="Select destination folder..."
            className="bg-background font-mono text-xs"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleSelectRoot}
            disabled={isCreating}
          >
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
            onClick={() => setConfig({ ...config, creationMode: 'pattern' })}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
              config.creationMode === 'pattern' || !config.creationMode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            disabled={isCreating}
          >
            <Type className="h-4 w-4" />
            Pattern
          </button>
          <button
            onClick={() => setConfig({ ...config, creationMode: 'list' })}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
              config.creationMode === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            disabled={isCreating}
          >
            <List className="h-4 w-4" />
            List
          </button>
        </div>
      </section>

      <Separator />

      {/* List Mode Input */}
      {config.creationMode === 'list' && (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
             <div className="space-y-2">
                <Label>Folder List</Label>
                <textarea
                  value={config.folderList}
                  onChange={(e) => setConfig({ ...config, folderList: e.target.value })}
                  placeholder="Enter folder names, separated by newlines or commas..."
                  className="flex min-h-[300px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isCreating}
                />
                <p className="text-[10px] text-muted-foreground">
                  Separate names with newlines or commas.
                </p>
             </div>
        </motion.div>
      )}

      <Separator />

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
                    setConfig({ ...config, baseName: e.target.value })
                  }
                  placeholder="e.g. project_folder"
                  disabled={isCreating}
                />
              </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Separator</Label>
              <Select
                value={config.separator}
                onValueChange={(v: string) =>
                  setConfig({
                    ...config,
                    separator: v === "NONE" ? "" : v,
                  })
                }
                disabled={isCreating}
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
                    setConfig({
                      ...config,
                      count: parseInt(e.target.value) || 1,
                    })
                  }
                  disabled={isCreating}
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
                setConfig({ ...config, customPrefix: e.target.value })
              }
              placeholder="e.g. project_"
              className="h-8 text-sm"
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Suffix</Label>
            <Input
              value={config.customSuffix}
              onChange={(e) =>
                setConfig({ ...config, customSuffix: e.target.value })
              }
              placeholder="e.g. _final"
              className="h-8 text-sm"
              disabled={isCreating}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Numbering Options */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Numbering
          </Label>
          <Switch
            checked={config.useNumbering}
            onCheckedChange={(c: boolean) =>
              setConfig({ ...config, useNumbering: c })
            }
            disabled={isCreating}
          />
        </div>

        {config.useNumbering && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="grid grid-cols-2 gap-4 pl-2 border-l-2 ml-1"
          >
            <div className="space-y-2">
              <Label className="text-xs">Start From</Label>
              <Input
                type="number"
                value={config.startNumber}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    startNumber: parseInt(e.target.value) || 1,
                  })
                }
                className="h-8"
                disabled={isCreating}
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
                    setConfig({ ...config, digitCount: v })
                  }
                  disabled={isCreating}
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
                  v: "prefix" | "suffix" | "after-prefix" | "before-suffix"
                ) => setConfig({ ...config, numberPosition: v })}
                disabled={isCreating}
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
          </motion.div>
        )}
      </section>

      <Separator />

      {/* Date Options */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Timestamp
          </Label>
          <Switch
            checked={config.useDate}
            onCheckedChange={(c: boolean) =>
              setConfig({ ...config, useDate: c })
            }
            disabled={isCreating}
          />
        </div>

        {config.useDate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="grid grid-cols-2 gap-4 pl-2 border-l-2 ml-1"
          >
            <div className="space-y-2">
              <Label className="text-xs">Format</Label>
              <Select
                value={config.dateFormat}
                onValueChange={(v: any) =>
                  setConfig({ ...config, dateFormat: v })
                }
                disabled={isCreating}
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
                  setConfig({ ...config, datePosition: v })
                }
                disabled={isCreating}
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
          </motion.div>
        )}
      </section>

      <Separator />

      {/* Random String Options */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Random String
          </Label>
          <Switch
            checked={config.useRandomString}
            onCheckedChange={(c: boolean) =>
              setConfig({ ...config, useRandomString: c })
            }
            disabled={isCreating}
          />
        </div>

        {config.useRandomString && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="grid grid-cols-2 gap-4 pl-2 border-l-2 ml-1"
          >
            <div className="space-y-2">
              <Label className="text-xs">Length</Label>
              <Input
                type="number"
                min={1}
                max={32}
                value={config.randomStringLength}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    randomStringLength: parseInt(e.target.value) || 8,
                  })
                }
                className="h-8"
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Position</Label>
              <Select
                value={config.randomStringPosition}
                onValueChange={(v: "prefix" | "suffix") =>
                  setConfig({ ...config, randomStringPosition: v })
                }
                disabled={isCreating}
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
          </motion.div>
        )}
      </section>

      <Separator />

      {/* UUID Options */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            UUID
          </Label>
          <Switch
            checked={config.useUUID}
            onCheckedChange={(c: boolean) =>
              setConfig({ ...config, useUUID: c })
            }
            disabled={isCreating}
          />
        </div>

        {config.useUUID && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="pl-2 border-l-2 ml-1"
          >
            <div className="space-y-2">
              <Label className="text-xs">Position</Label>
              <Select
                value={config.uuidPosition}
                onValueChange={(v: "prefix" | "suffix") =>
                  setConfig({ ...config, uuidPosition: v })
                }
                disabled={isCreating}
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
          </motion.div>
        )}
      </section>
      


      <Separator />

      {/* Subfolder Configuration (Shared) */}
      <section className="space-y-4">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Subfolders
        </Label>

        <div className="space-y-2">
          <Label className="text-xs">List (Comma or Newline Separated)</Label>
          <textarea
            value={config.subfolders}
            onChange={(e) =>
              setConfig({ ...config, subfolders: e.target.value })
            }
            placeholder="Docs, Images, Assets..."
            disabled={isCreating}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {config.subfolders && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-4 pt-2"
          >
            <div className="space-y-1">
              <Label className="text-xs">Common Prefix</Label>
              <Input
                className="h-7 text-xs"
                value={config.subfolderPrefix}
                onChange={(e) =>
                  setConfig({ ...config, subfolderPrefix: e.target.value })
                }
                placeholder="e.g. 0_"
                disabled={isCreating}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Common Suffix</Label>
              <Input
                className="h-7 text-xs"
                value={config.subfolderSuffix}
                onChange={(e) =>
                  setConfig({ ...config, subfolderSuffix: e.target.value })
                }
                placeholder="e.g. _v1"
                disabled={isCreating}
              />
            </div>
          </motion.div>
        )}
      </section>

      <Separator />

      {/* Configuration Presets */}
      <section className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Presets
        </Label>
        <div className="flex gap-2">
          <Input
            value={presetName}
            onChange={(e) => setPresetName?.(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSavePreset?.()}
            placeholder="Preset name..."
            className="h-8 text-sm"
            disabled={isCreating}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={onSavePreset}
            disabled={!presetName.trim() || isCreating}
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
                  onClick={() => onLoadPreset?.(preset)}
                  className="flex-1 text-left text-xs truncate"
                  disabled={isCreating}
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => onDeletePreset?.(index)}
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                  disabled={isCreating}
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
            onClick={onExportConfig}
            className="flex-1"
            disabled={isCreating}
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onImportConfig}
            className="flex-1"
            disabled={isCreating}
          >
            <Upload className="h-3 w-3 mr-1" />
            Import
          </Button>
        </div>
      </section>
    </div>
  );
};
