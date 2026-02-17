/**
 * File: src/features/folder-creation/components/FolderForm.tsx
 *
 * Front-end form component for folder creation configuration.
 * Provides all configuration options including naming patterns, date settings,
 * subfolders, and presets. Layout matches the File Creation page for consistency.
 */

import { open } from "@tauri-apps/plugin-dialog";
import { FolderConfig, PreviewNode } from "../utils/folderUtils";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Separator } from "../../../components/ui/separator";
import { Switch } from "../../../components/ui/switch";
import { Slider } from "../../../components/ui/slider";
import {
  FolderOpen,
  Save,
  Download,
  Upload,
  XCircle,
  List,
  Type,
  FileSpreadsheet,
  ChevronRight,
  Hash,
  Calendar,
  Settings2,
  Sparkles,
  FilePlus,
  FolderTree,
  Shuffle,
  Fingerprint,
} from "lucide-react";
import { motion } from "framer-motion";
import { CsvConfigForm } from "../../../components/common/CsvConfigForm";
import { CountInput } from "../../../components/common/CountInput";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { cn } from "../../../lib/utils";
import { useState, useEffect } from "react";
import { FolderPresetTemplates, PresetTemplate } from "./PresetTemplates";
import { FilePreCreationConfig } from "./FilePreCreationConfig";

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
  onLoadPresetTemplate?: (template: PresetTemplate) => void;
  folderNodes?: PreviewNode[];
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
  onLoadPresetTemplate,
  folderNodes = [],
}: FolderFormProps) => {
  // Collapsible section states
  const [namingOpen, setNamingOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [subfoldersOpen, setSubfoldersOpen] = useState(!!config.subfolders);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [filePreCreationOpen, setFilePreCreationOpen] = useState(
    config.enableFilePreCreation || false,
  );

  /**
   * Sync collapsible section states when config changes externally
   * (e.g., preset load, import, or template selection).
   * Opens sections that have active content so the user immediately
   * sees what the preset configured.
   */
  useEffect(() => {
    // Auto-open File Pre-Creation if enabled by the loaded config
    setFilePreCreationOpen(config.enableFilePreCreation || false);

    // Auto-open Subfolders if the config has subfolder definitions
    if (config.subfolders) {
      setSubfoldersOpen(true);
    }

    // Auto-open Advanced Options if any advanced feature is active
    if (
      config.useNumbering ||
      config.useDate ||
      config.useRandomString ||
      config.useUUID
    ) {
      setAdvancedOpen(true);
    }
  }, [
    config.enableFilePreCreation,
    config.subfolders,
    config.useNumbering,
    config.useDate,
    config.useRandomString,
    config.useUUID,
  ]);

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
    <div className="space-y-6">
      {/* ── Section 1: Target Location ── */}
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

      {/* ── Section 2: Creation Mode (segmented control) ── */}
      <section className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Creation Mode
        </Label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-lg">
          {[
            { value: "pattern", label: "Pattern", Icon: Type },
            { value: "list", label: "List", Icon: List },
            { value: "csv", label: "CSV", Icon: FileSpreadsheet },
          ].map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() =>
                setConfig({
                  ...config,
                  creationMode: value as FolderConfig["creationMode"],
                })
              }
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-md transition-all",
                config.creationMode === value ||
                  (!config.creationMode && value === "pattern")
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              disabled={isCreating}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Section 3: Mode-Specific Input ── */}

      {/* List Mode Input */}
      {config.creationMode === "list" && (
        <section className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Folder List
          </Label>
          <textarea
            value={config.folderList}
            onChange={(e) =>
              setConfig({ ...config, folderList: e.target.value })
            }
            placeholder="Enter folder names, separated by newlines or commas..."
            className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isCreating}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "ArrowUp") {
                e.preventDefault();
                e.currentTarget.scrollTop = 0;
                e.currentTarget.setSelectionRange(0, 0);
              }
            }}
          />
          <p className="text-[10px] text-muted-foreground">
            Separate names with newlines or commas.
          </p>
        </section>
      )}

      {/* CSV Mode Config */}
      {config.creationMode === "csv" && (
        <CsvConfigForm
          config={config}
          setConfig={setConfig}
          isCreating={isCreating}
        />
      )}

      {/* ── Section 4: Naming Pattern (collapsible bordered card) ── */}
      <Collapsible open={namingOpen} onOpenChange={setNamingOpen}>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Naming Pattern
              </span>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {(config.customPrefix || config.customSuffix) && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  Active
                </span>
              )}
              <CollapsibleTrigger>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform text-muted-foreground",
                    namingOpen && "rotate-90",
                  )}
                />
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <div className="p-4 border-t space-y-4">
              {/* Base Name & Count (Pattern mode only) */}
              {config.creationMode === "pattern" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Base Name</Label>
                    <Input
                      value={config.baseName}
                      onChange={(e) =>
                        setConfig({ ...config, baseName: e.target.value })
                      }
                      placeholder="e.g. project_folder"
                      className="h-8 text-sm"
                      disabled={isCreating}
                    />
                  </div>
                  <CountInput
                    label="Number of folders"
                    hint="1–1000"
                    value={config.count}
                    onChange={(count) => setConfig({ ...config, count })}
                    disabled={isCreating}
                  />
                </div>
              )}

              {/* Separator */}
              <div className="space-y-2">
                <Label className="text-xs">Separator</Label>
                <Select
                  value={config.separator || "NONE"}
                  onValueChange={(v: string) =>
                    setConfig({ ...config, separator: v === "NONE" ? "" : v })
                  }
                  disabled={isCreating}
                >
                  <SelectTrigger className="h-8 text-sm">
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

              {/* Custom Prefix & Suffix */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Custom Prefix</Label>
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
                  <Label className="text-xs">Custom Suffix</Label>
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
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ── Section 5: Subfolders (collapsible bordered card) ── */}
      <Collapsible open={subfoldersOpen} onOpenChange={setSubfoldersOpen}>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Subfolders
              </span>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {config.subfolders && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {config.subfolders.split(/[,\n]/).filter(Boolean).length}{" "}
                  defined
                </span>
              )}
              <CollapsibleTrigger>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform text-muted-foreground",
                    subfoldersOpen && "rotate-90",
                  )}
                />
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <div className="p-4 border-t space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground">
                  Comma or Newline Separated
                </Label>
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
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="space-y-1">
                    <Label className="text-[10px]">Common Prefix</Label>
                    <Input
                      className="h-7 text-xs"
                      value={config.subfolderPrefix}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          subfolderPrefix: e.target.value,
                        })
                      }
                      placeholder="e.g. 0_"
                      disabled={isCreating}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Common Suffix</Label>
                    <Input
                      className="h-7 text-xs"
                      value={config.subfolderSuffix}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          subfolderSuffix: e.target.value,
                        })
                      }
                      placeholder="e.g. _v1"
                      disabled={isCreating}
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Separator />

      {/* ── Section 6: Advanced Options (single collapsible with sub-sections) ── */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <div className="border rounded-lg overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Advanced Options
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(config.useNumbering ||
                config.useDate ||
                config.useRandomString ||
                config.useUUID) && (
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  Active
                </span>
              )}
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform text-muted-foreground",
                  advancedOpen && "rotate-90",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 border-t space-y-5">
              {/* Numbering */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Numbering
                    </Label>
                  </div>
                  <Switch
                    checked={config.useNumbering}
                    onCheckedChange={(c: boolean) =>
                      setConfig({ ...config, useNumbering: c })
                    }
                    disabled={isCreating}
                  />
                </div>
                {config.useNumbering && (
                  <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 ml-1">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Start From</Label>
                      <Input
                        type="number"
                        value={config.startNumber}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            startNumber: parseInt(e.target.value) || 1,
                          })
                        }
                        className="h-7 text-xs"
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">
                        Padding ({String(1).padStart(config.digitCount, "0")})
                      </Label>
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
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px]">Position</Label>
                      <Select
                        value={config.numberPosition}
                        onValueChange={(v: any) =>
                          setConfig({ ...config, numberPosition: v })
                        }
                        disabled={isCreating}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="suffix">
                            Suffix (Name_001)
                          </SelectItem>
                          <SelectItem value="prefix">
                            Prefix (001_Name)
                          </SelectItem>
                          <SelectItem value="after-prefix">
                            After Prefix
                          </SelectItem>
                          <SelectItem value="before-suffix">
                            Before Suffix
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </section>

              <Separator className="opacity-30" />

              {/* Timestamp */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Timestamp
                    </Label>
                  </div>
                  <Switch
                    checked={config.useDate}
                    onCheckedChange={(c: boolean) =>
                      setConfig({ ...config, useDate: c })
                    }
                    disabled={isCreating}
                  />
                </div>
                {config.useDate && (
                  <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 ml-1">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Format</Label>
                      <Select
                        value={config.dateFormat}
                        onValueChange={(v: any) =>
                          setConfig({ ...config, dateFormat: v })
                        }
                        disabled={isCreating}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1">
                              Standard
                            </SelectLabel>
                            <SelectItem value="YYYY-MM-DD">
                              YYYY-MM-DD
                            </SelectItem>
                            <SelectItem value="YYYYMMDD">YYYYMMDD</SelectItem>
                            <SelectItem value="DD-MM-YYYY">
                              DD-MM-YYYY
                            </SelectItem>
                            <SelectItem value="MM-DD-YYYY">
                              MM-DD-YYYY
                            </SelectItem>
                          </SelectGroup>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1">
                              Short
                            </SelectLabel>
                            <SelectItem value="YY-MM-DD">YY-MM-DD</SelectItem>
                            <SelectItem value="YYMMDD">YYMMDD</SelectItem>
                            <SelectItem value="MM-DD-YY">MM-DD-YY</SelectItem>
                            <SelectItem value="MMDDYY">MMDDYY</SelectItem>
                          </SelectGroup>
                          <SelectSeparator />
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase text-muted-foreground px-2 py-1">
                              Time
                            </SelectLabel>
                            <SelectItem value="YYYY-MM-DD_HH-MM-SS">
                              YYYY-MM-DD_HH-MM-SS
                            </SelectItem>
                            <SelectItem value="YYYYMMDD_HHMMSS">
                              YYYYMMDD_HHMMSS
                            </SelectItem>
                            <SelectItem value="HH-MM-SS">HH-MM-SS</SelectItem>
                            <SelectItem value="HHMMSS">HHMMSS</SelectItem>
                            <SelectItem value="timestamp">
                              Unix Timestamp
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Position</Label>
                      <Select
                        value={config.datePosition}
                        onValueChange={(v: any) =>
                          setConfig({ ...config, datePosition: v })
                        }
                        disabled={isCreating}
                      >
                        <SelectTrigger className="h-7 text-xs">
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

              <Separator className="opacity-30" />

              {/* Random String */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Random String
                    </Label>
                  </div>
                  <Switch
                    checked={config.useRandomString}
                    onCheckedChange={(c: boolean) =>
                      setConfig({ ...config, useRandomString: c })
                    }
                    disabled={isCreating}
                  />
                </div>
                {config.useRandomString && (
                  <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 ml-1">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Length</Label>
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
                        className="h-7 text-xs"
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Position</Label>
                      <Select
                        value={config.randomStringPosition}
                        onValueChange={(v: "prefix" | "suffix") =>
                          setConfig({ ...config, randomStringPosition: v })
                        }
                        disabled={isCreating}
                      >
                        <SelectTrigger className="h-7 text-xs">
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

              <Separator className="opacity-30" />

              {/* UUID */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      UUID
                    </Label>
                  </div>
                  <Switch
                    checked={config.useUUID}
                    onCheckedChange={(c: boolean) =>
                      setConfig({ ...config, useUUID: c })
                    }
                    disabled={isCreating}
                  />
                </div>
                {config.useUUID && (
                  <div className="pl-2 border-l-2 ml-1 space-y-1">
                    <Label className="text-[10px]">Position</Label>
                    <Select
                      value={config.uuidPosition}
                      onValueChange={(v: "prefix" | "suffix") =>
                        setConfig({ ...config, uuidPosition: v })
                      }
                      disabled={isCreating}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prefix">Prefix</SelectItem>
                        <SelectItem value="suffix">Suffix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </section>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Separator />

      {/* ── Section 7: File Pre-Creation (collapsible bordered card) ── */}
      <Collapsible
        open={filePreCreationOpen}
        onOpenChange={setFilePreCreationOpen}
      >
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1">
              <FilePlus className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pre-Create Files
              </span>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.enableFilePreCreation || false}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={(checked) => {
                  setConfig({ ...config, enableFilePreCreation: checked });
                  setFilePreCreationOpen(checked);
                }}
                disabled={isCreating}
              />
              <CollapsibleTrigger>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform text-muted-foreground",
                    filePreCreationOpen && "rotate-90",
                  )}
                />
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            {config.enableFilePreCreation && (
              <FilePreCreationConfig
                config={config}
                setConfig={setConfig}
                folderNodes={folderNodes}
              />
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Separator />

      {/* ── Section 8: Presets & Templates (collapsible bordered card) ── */}
      <Collapsible>
        <div className="border rounded-lg overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Presets & Templates
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 border-t space-y-3">
              {/* Save preset */}
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

              {/* Preset list */}
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
                        aria-label={`Delete preset "${preset.name}"`}
                        title={`Delete preset "${preset.name}"`}
                      >
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Export / Import */}
              <div className="flex gap-2">
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

              {/* Quick Start Templates */}
              {onLoadPresetTemplate && (
                <Collapsible
                  open={templatesOpen}
                  onOpenChange={setTemplatesOpen}
                >
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded transition-colors mt-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Quick Start Templates
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 transition-transform text-muted-foreground",
                        templatesOpen && "rotate-90",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="pt-2"
                    >
                      <FolderPresetTemplates
                        onSelectPreset={onLoadPresetTemplate}
                      />
                    </motion.div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};
