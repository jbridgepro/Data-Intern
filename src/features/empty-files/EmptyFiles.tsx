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
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  List,
  Type,
  FileSpreadsheet,
  Sparkles,
  ChevronRight,
  MapPin,
  RotateCcw,
  Hash,
  Calendar,
  Settings2,
  Shuffle,
  Fingerprint,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

import {
  FileConfig,
  GeneratedFile,
  generatePreview,
  calculateStats,
  getTotalCount,
  generateExecutionList,
  GenerationStats,
} from "./utils/fileGenerator";
import { PreviewList } from "./components/PreviewList";
import {
  MappedFileEntryForm,
  MappedFileEntry,
} from "./components/MappedFileEntryForm";
import { DestinationModeSelector } from "./components/DestinationModeSelector";
import { PropagationPreview } from "./components/PropagationPreview";
import { FolderMappingSelector } from "./components/FolderMappingSelector";
import {
  resolvePropagationTargets,
  expandPropagationTargets,
  type DestinationMode,
} from "./utils/propagationUtils";
import { ExtensionSelector } from "./components/ExtensionSelector";
import { SettingsAccordion } from "./components/SettingsAccordion";
import {
  FilePresetTemplates,
  FilePresetTemplate,
} from "./components/PresetTemplates";
import { CsvConfigForm } from "@/components/common/CsvConfigForm";
import { CountInput } from "@/components/common/CountInput";
import { PageHeader } from "@/components/layout/PageHeader";
import { fileCreationInfo } from "@/components/layout/toolInfoContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Configuration preset type for File Creation.
 * Stores the full FileConfig plus additional state that lives outside
 * the config object: mapped file entries (Map mode) and destination mode.
 */
interface ConfigPreset {
  name: string;
  config: FileConfig;
  /** Mapped file entries for Map mode (persisted separately from FileConfig) */
  mappedFileEntries?: MappedFileEntry[];
  /** Destination/propagation mode (persisted separately from FileConfig) */
  destinationMode?: DestinationMode;
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

    // CSV Defaults
    csvDelimiter: ",",
    csvColumnOrder: [],
    csvColumnConfig: {},
    csvRows: [],
    csvHeaders: [],
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
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // Map to store edited file names: fileId -> editedName
  const [editedNames, setEditedNames] = useState<Map<string, string>>(
    new Map(),
  );
  // Mapped file entries for Map mode (per-file folder mapping)
  const [mappedFileEntries, setMappedFileEntries] = useState<MappedFileEntry[]>(
    [],
  );
  // Destination mode: manual vs pattern-based propagation (default: pattern-main)
  const [destinationMode, setDestinationMode] =
    useState<DestinationMode>("pattern-main");
  // Excluded propagation targets: Set of "entryId::folderPath" keys
  const [excludedPropagationKeys, setExcludedPropagationKeys] = useState<
    Set<string>
  >(new Set());
  // Template destination folder for Pattern/List/CSV propagation (default: rootPath)
  const [propagationDestination, setPropagationDestination] =
    useState<string>("");
  // Tracks the number of propagation target folders for non-Map modes
  const [propagationTargetCount, setPropagationTargetCount] =
    useState<number>(1);

  // Collapsible section states for organized layout
  const [namingOpen, setNamingOpen] = useState(true);
  const [propagationOpen, setPropagationOpen] = useState(false);

  // Status/error messaging (matching Folder Creation UX)
  const [creationStatus, setCreationStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [creationError, setCreationError] = useState<string | null>(null);

  /**
   * Sync collapsible section states when destination mode changes externally
   * (e.g., preset load). Auto-opens propagation section if non-manual mode.
   */
  useEffect(() => {
    if (destinationMode !== "manual") {
      setPropagationOpen(true);
    }
  }, [destinationMode]);

  // Sync propagation destination when rootPath changes
  useEffect(() => {
    if (config.rootPath) {
      setPropagationDestination(config.rootPath);
    }
  }, [config.rootPath]);

  // Update propagation target count when destination mode or destination changes
  useEffect(() => {
    if (config.creationMode === "map" || destinationMode === "manual") {
      setPropagationTargetCount(1);
      return;
    }

    if (!config.rootPath || !propagationDestination) {
      setPropagationTargetCount(1);
      return;
    }

    // Resolve propagation targets to get the count
    let cancelled = false;
    expandPropagationTargets(
      config.rootPath,
      propagationDestination,
      destinationMode,
    )
      .then((result) => {
        if (!cancelled) {
          const activeCount = result.targets.filter(
            (t) => !excludedPropagationKeys.has(`bulk::${t.folderPath}`),
          ).length;
          setPropagationTargetCount(Math.max(1, activeCount));
        }
      })
      .catch(() => {
        if (!cancelled) setPropagationTargetCount(1);
      });

    return () => {
      cancelled = true;
    };
  }, [
    config.rootPath,
    config.creationMode,
    propagationDestination,
    destinationMode,
    excludedPropagationKeys,
  ]);

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

        // Calculate initial stats, using getTotalCount for the true total
        const currentStats = calculateStats(updatedFiles);
        const totalCount = getTotalCount(config);
        setStats({
          ...currentStats,
          total: totalCount,
          pending: totalCount, // Reset pending to total
        });

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
   * Handles file creation with progress tracking and real-time updates.
   * Supports pattern-based propagation: when destinationMode is not 'manual',
   * files are created in all matching target folders (not just rootPath).
   * Uses edited names if available.
   */
  const handleCreate = async () => {
    if (!config.rootPath) return;
    setIsGenerating(true);
    setGenerationProgress(0);

    // Apply edits to current preview files before generating full list
    const currentPreviewWithEdits = previewFiles.map((file) => {
      const editedName = editedNames.get(file.id);
      return editedName ? { ...file, name: editedName } : file;
    });

    // Generate full list for execution
    const results = await generateExecutionList(
      config,
      currentPreviewWithEdits,
    );

    // Resolve propagation targets for Pattern/List/CSV modes
    let targetFolders: string[] = [config.rootPath];

    if (destinationMode !== "manual" && propagationDestination) {
      try {
        const propagationResult = await expandPropagationTargets(
          config.rootPath,
          propagationDestination,
          destinationMode,
        );
        // Filter out excluded targets (keyed as "bulk::folderPath")
        targetFolders = propagationResult.targets
          .filter((t) => !excludedPropagationKeys.has(`bulk::${t.folderPath}`))
          .map((t) => t.folderPath);
      } catch (e) {
        console.error(
          "Propagation expansion failed, falling back to rootPath:",
          e,
        );
        targetFolders = [config.rootPath];
      }
    }

    // Total files = files × target folders
    const total = results.length * targetFolders.length;

    // Initialize execution stats
    const currentStats: GenerationStats = {
      total: total,
      success: 0,
      error: 0,
      exists: 0,
      pending: total,
    };
    setStats({ ...currentStats });

    // Create files across all target folders
    let completedCount = 0;
    for (const targetFolder of targetFolders) {
      for (let i = 0; i < results.length; i++) {
        const file = results[i];
        let newStatus: "success" | "exists" | "error" = "success";
        let errorMsg: string | undefined = undefined;

        try {
          const fullPath = await join(targetFolder, file.name);
          const fileExists = await exists(fullPath);

          if (fileExists && !config.overwrite) {
            newStatus = "exists";
          } else {
            await writeTextFile(fullPath, "");
            newStatus = "success";
          }
        } catch (e: any) {
          console.error(`Failed to create ${file.name} in ${targetFolder}`, e);
          errorMsg = e?.message || "Unknown error occurred";
          newStatus = "error";
        }

        // Update status for the first target folder (preview list reflects rootPath)
        if (targetFolder === targetFolders[0]) {
          results[i] = { ...file, status: newStatus, errorMessage: errorMsg };
        }

        // Update stats incrementally
        completedCount++;
        currentStats.pending--;
        currentStats[newStatus]++;

        // Update progress and UI in real-time (throttled for performance)
        const progress = (completedCount / total) * 100;
        setGenerationProgress(progress);

        if (completedCount % 10 === 0 || completedCount === total) {
          setStats({ ...currentStats });
          if (targetFolder === targetFolders[0]) {
            setPreviewFiles([...results]);
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }
    }

    setIsGenerating(false);
    setGenerationProgress(100);

    // Set success/error status for visual feedback
    if (currentStats.error > 0) {
      setCreationStatus("error");
      setCreationError(`${currentStats.error} file(s) failed to create.`);
    } else {
      setCreationStatus("success");
      setCreationError(null);
    }
  };

  /**
   * Handles atomic batch creation for Map mode.
   * Uses propagation logic to expand targets, then validates and creates.
   * If any validation or creation fails, aborts entire operation.
   */
  const handleCreateMap = async () => {
    if (!config.rootPath || mappedFileEntries.length === 0) return;

    setIsGenerating(true);
    setGenerationProgress(0);

    const { validateFileNameChars, validateExtension } =
      await import("@/utils/fileValidation");

    // Phase 1: Resolve propagation targets (respects exclusions)
    const entriesToCreate = await resolvePropagationTargets(
      config.rootPath,
      mappedFileEntries,
      destinationMode,
      excludedPropagationKeys,
    );

    for (const e of entriesToCreate) {
      const nameErr = validateFileNameChars(e.fileName);
      const extErr = validateExtension(e.extension);
      if (nameErr || extErr) {
        alert(
          `Validation failed for "${e.fileName}.${e.extension}": ${nameErr || extErr}`,
        );
        setIsGenerating(false);
        return;
      }
    }

    const keyCount = new Map<string, number>();
    entriesToCreate.forEach((e) => {
      const key = `${e.folderPath}::${e.fileName}.${e.extension}`;
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    });
    const hasDuplicates = [...keyCount.values()].some((c) => c > 1);
    if (hasDuplicates) {
      alert(
        "Duplicate file names in the same folder detected. Please fix before creating.",
      );
      setIsGenerating(false);
      return;
    }

    // Phase 4: Check existing files (unless overwrite)
    if (!config.overwrite) {
      const { exists: fsExists } = await import("@tauri-apps/plugin-fs");
      for (const e of entriesToCreate) {
        const fileExists = await fsExists(e.fullPath);
        if (fileExists) {
          alert(
            `File already exists: ${e.fullPath}\nEnable "Overwrite existing" or remove this file from the list.`,
          );
          setIsGenerating(false);
          return;
        }
      }
    }

    // Phase 5: Create all files atomically (abort on first creation failure)
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const total = entriesToCreate.length;
    let created = 0;

    try {
      for (const e of entriesToCreate) {
        await writeTextFile(e.fullPath, "");
        created++;
        setGenerationProgress((created / total) * 100);
      }
      setCreationStatus("success");
      setCreationError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const failedEntry = entriesToCreate[created];
      setCreationStatus("error");
      setCreationError(
        `File creation failed at "${failedEntry?.fileName}.${failedEntry?.extension}": ${msg}. ${created} of ${total} files were created.`,
      );
    } finally {
      setIsGenerating(false);
      setGenerationProgress(100);
    }
  };

  /**
   * Saves current configuration as a preset.
   * Includes FileConfig, mapped file entries (Map mode), and destination mode.
   * CSV row data is excluded to keep presets lightweight.
   */
  const savePreset = () => {
    if (!presetName.trim()) return;
    const newPreset: ConfigPreset = {
      name: presetName.trim(),
      config: { ...config, csvRows: [] },
      mappedFileEntries:
        mappedFileEntries.length > 0 ? mappedFileEntries : undefined,
      destinationMode: destinationMode,
    };
    const updatedPresets = [...presets, newPreset];
    savePresets(updatedPresets);
    setPresetName("");
  };

  /**
   * Loads a preset configuration.
   * Restores FileConfig, mapped file entries, destination mode, and resets
   * exclusions and edited names since they're context-dependent.
   */
  const loadPreset = (preset: ConfigPreset) => {
    setConfig({ ...preset.config });

    // Restore mapped file entries (Map mode)
    if (preset.mappedFileEntries && preset.mappedFileEntries.length > 0) {
      setMappedFileEntries(preset.mappedFileEntries);
    } else {
      setMappedFileEntries([]);
    }

    // Restore destination mode
    if (preset.destinationMode) {
      setDestinationMode(preset.destinationMode);
    } else {
      setDestinationMode("pattern-main");
    }

    // Reset context-dependent state
    setExcludedPropagationKeys(new Set());
    setEditedNames(new Map());
    resetStatus();
  };

  /**
   * Deletes a preset
   */
  const deletePreset = (index: number) => {
    const updatedPresets = presets.filter((_, i) => i !== index);
    savePresets(updatedPresets);
  };

  /** Resets the creation status (clears success/error messages) */
  const resetStatus = () => {
    if (creationStatus !== "idle") {
      setCreationStatus("idle");
      setCreationError(null);
    }
  };

  /** Resets the entire configuration to defaults */
  const resetConfig = () => {
    setConfig({
      rootPath: config.rootPath, // Keep rootPath
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
      csvDelimiter: ",",
      csvColumnOrder: [],
      csvColumnConfig: {},
      csvRows: [],
      csvHeaders: [],
    });
    setEditedNames(new Map());
    setMappedFileEntries([]);
    resetStatus();
  };

  /**
   * Exports current configuration as JSON.
   * Includes FileConfig, mapped file entries, and destination mode
   * so the full state can be restored on import.
   */
  const exportConfig = () => {
    const exportData = {
      config: { ...config, csvRows: [] },
      mappedFileEntries:
        mappedFileEntries.length > 0 ? mappedFileEntries : undefined,
      destinationMode: destinationMode,
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "file-creation-config.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Imports configuration from JSON file.
   * Handles both the new format (with mappedFileEntries/destinationMode wrapper)
   * and legacy format (plain FileConfig at root level).
   */
  const importConfig = async () => {
    try {
      const selected = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const fileContent = await readTextFile(selected);
        const parsed = JSON.parse(fileContent);

        // Detect format: new format has a nested 'config' key; legacy is a flat FileConfig
        if (parsed.config && typeof parsed.config === "object") {
          // New format: { config, mappedFileEntries?, destinationMode? }
          setConfig(parsed.config as FileConfig);

          if (
            parsed.mappedFileEntries &&
            Array.isArray(parsed.mappedFileEntries)
          ) {
            setMappedFileEntries(parsed.mappedFileEntries as MappedFileEntry[]);
          } else {
            setMappedFileEntries([]);
          }

          if (parsed.destinationMode) {
            setDestinationMode(parsed.destinationMode as DestinationMode);
          }
        } else {
          // Legacy format: plain FileConfig at root
          setConfig(parsed as FileConfig);
          setMappedFileEntries([]);
        }

        // Reset context-dependent state
        setEditedNames(new Map());
        setExcludedPropagationKeys(new Set());
        resetStatus();
      }
    } catch (e: any) {
      console.error("Failed to import config:", e);
      alert(`Failed to import configuration: ${e?.message || "Unknown error"}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <PageHeader
        icon={FilePlus}
        title="File Creation"
        subtitle="Bulk create files with patterns or custom lists"
        info={fileCreationInfo}
        toolId="empty"
        right={
          <Button
            variant="ghost"
            size="icon"
            onClick={resetConfig}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Reset Configuration"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Config Panel (Left) ── */}
        <div className="w-[400px] border-r overflow-y-auto p-6 space-y-6 bg-card/30">
          {/* ── Section 1: Target Location ── */}
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

          {/* ── Section 2: Creation Mode (segmented control) ── */}
          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Creation Mode
            </Label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-muted rounded-lg">
              {[
                { value: "pattern", label: "Pattern", Icon: Type },
                { value: "list", label: "List", Icon: List },
                { value: "csv", label: "CSV", Icon: FileSpreadsheet },
                { value: "map", label: "Map", Icon: MapPin },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => {
                    setConfig((prev) => ({
                      ...prev,
                      creationMode: value as FileConfig["creationMode"],
                    }));
                    resetStatus();
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-md transition-all",
                    config.creationMode === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  disabled={isGenerating}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          {/* ── Section 3: Destination Mode (compact 2x2 grid) ── */}
          <Collapsible open={propagationOpen} onOpenChange={setPropagationOpen}>
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Destination Mode
                  </span>
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                  {destinationMode !== "manual" && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {propagationTargetCount > 1
                        ? `${propagationTargetCount} targets`
                        : "Active"}
                    </span>
                  )}
                  <CollapsibleTrigger>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform text-muted-foreground",
                        propagationOpen && "rotate-90",
                      )}
                    />
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent>
                <div className="p-4 border-t space-y-4">
                  <DestinationModeSelector
                    value={destinationMode}
                    onChange={(mode) => {
                      setDestinationMode(mode);
                      setExcludedPropagationKeys(new Set());
                    }}
                    disabled={isGenerating}
                  />

                  {/* Template Location for Pattern/List/CSV propagation */}
                  {config.creationMode !== "map" &&
                    destinationMode !== "manual" &&
                    config.rootPath && (
                      <section className="space-y-2">
                        <Label className="text-[10px] text-muted-foreground">
                          Template Location
                        </Label>
                        <FolderMappingSelector
                          rootPath={config.rootPath}
                          value={propagationDestination || config.rootPath}
                          onChange={setPropagationDestination}
                          disabled={isGenerating}
                          compact
                        />
                        {propagationTargetCount > 1 && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded font-medium">
                              {propagationTargetCount} folder(s)
                            </span>
                            <span className="text-muted-foreground">
                              × {previewFiles.length} file(s) ={" "}
                              {propagationTargetCount * previewFiles.length}{" "}
                              total
                            </span>
                          </div>
                        )}
                      </section>
                    )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <Separator />

          {/* ── Section 4: Mode-Specific Input ── */}

          {/* Map Mode: File mapping */}
          {config.creationMode === "map" && (
            <MappedFileEntryForm
              rootPath={config.rootPath}
              entries={mappedFileEntries}
              onEntriesChange={setMappedFileEntries}
              disabled={isGenerating}
            />
          )}

          {/* CSV Config */}
          {config.creationMode === "csv" && (
            <CsvConfigForm
              config={config}
              setConfig={setConfig}
              isCreating={isGenerating}
            />
          )}

          {/* List Mode Input */}
          {config.creationMode === "list" && (
            <section className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                File List
              </Label>
              <textarea
                value={config.fileList}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, fileList: e.target.value }))
                }
                placeholder="Enter file names, separated by newlines or commas..."
                className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isGenerating}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "ArrowUp") {
                    e.preventDefault();
                    e.currentTarget.scrollTop = 0;
                    e.currentTarget.setSelectionRange(0, 0);
                  }
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Separate names with newlines or commas. Extensions appended
                automatically.
              </p>
            </section>
          )}

          {/* ── Section 5: Naming & Extensions (hidden in Map mode) ── */}
          {config.creationMode !== "map" && (
            <>
              {/* Naming Pattern - Collapsible */}
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
                      {config.creationMode !== "list" &&
                        config.creationMode !== "csv" && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs">Base Name</Label>
                              <Input
                                value={config.baseName}
                                onChange={(e) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    baseName: e.target.value,
                                  }))
                                }
                                placeholder="e.g. project_file"
                                className="h-8 text-sm"
                                disabled={isGenerating}
                              />
                            </div>
                            <CountInput
                              label="Number of files"
                              hint="1–1000"
                              value={config.count}
                              onChange={(count) =>
                                setConfig((prev) => ({ ...prev, count }))
                              }
                              disabled={isGenerating}
                            />
                          </div>
                        )}

                      {/* Separator */}
                      <div className="space-y-2">
                        <Label className="text-xs">Separator</Label>
                        <Select
                          value={config.separator || "NONE"}
                          onValueChange={(v: string) =>
                            setConfig((prev) => ({
                              ...prev,
                              separator: v === "NONE" ? "" : v,
                            }))
                          }
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
                              setConfig((prev) => ({
                                ...prev,
                                customPrefix: e.target.value,
                              }))
                            }
                            placeholder="e.g. project_"
                            className="h-8 text-sm"
                            disabled={isGenerating}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Custom Suffix</Label>
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
                            disabled={isGenerating}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Extensions */}
              <section className="space-y-3">
                <ExtensionSelector
                  selectedExtensions={config.extensions}
                  onAdd={addExtension}
                  onRemove={removeExtension}
                />
              </section>

              <Separator />

              {/* Advanced Naming Options - Collapsible sections matching Folder Creation style */}
              <Collapsible>
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
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
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
                              setConfig((prev) => ({
                                ...prev,
                                useNumbering: c,
                              }))
                            }
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
                                  setConfig((prev) => ({
                                    ...prev,
                                    startNumber: parseInt(e.target.value) || 1,
                                  }))
                                }
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">
                                Padding (
                                {String(1).padStart(config.digitCount, "0")})
                              </Label>
                              <Slider
                                min={1}
                                max={6}
                                step={1}
                                value={[config.digitCount]}
                                onValueChange={([v]: number[]) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    digitCount: v,
                                  }))
                                }
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-[10px]">Position</Label>
                              <Select
                                value={config.numberPosition}
                                onValueChange={(v: any) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    numberPosition: v,
                                  }))
                                }
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
                              setConfig((prev) => ({ ...prev, useDate: c }))
                            }
                          />
                        </div>
                        {config.useDate && (
                          <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 ml-1">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Format</Label>
                              <Select
                                value={config.dateFormat}
                                onValueChange={(v: any) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    dateFormat: v,
                                  }))
                                }
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
                                    <SelectItem value="YYYYMMDD">
                                      YYYYMMDD
                                    </SelectItem>
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
                                    <SelectItem value="YY-MM-DD">
                                      YY-MM-DD
                                    </SelectItem>
                                    <SelectItem value="YYMMDD">
                                      YYMMDD
                                    </SelectItem>
                                    <SelectItem value="MM-DD-YY">
                                      MM-DD-YY
                                    </SelectItem>
                                    <SelectItem value="MMDDYY">
                                      MMDDYY
                                    </SelectItem>
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
                                    <SelectItem value="HH-MM-SS">
                                      HH-MM-SS
                                    </SelectItem>
                                    <SelectItem value="timestamp">
                                      Unix Timestamp
                                    </SelectItem>
                                    <SelectItem value="custom">
                                      Custom...
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
                                  setConfig((prev) => ({
                                    ...prev,
                                    datePosition: v,
                                  }))
                                }
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
                            {config.dateFormat === "custom" && (
                              <div className="col-span-2 space-y-1">
                                <Label className="text-[10px]">
                                  Custom Format String
                                </Label>
                                <Input
                                  value={config.customDateFormat || ""}
                                  onChange={(e) =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      customDateFormat: e.target.value,
                                    }))
                                  }
                                  placeholder="e.g. YYYY-MM-DD"
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                            )}
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
                              setConfig((prev) => ({
                                ...prev,
                                useRandomString: c,
                              }))
                            }
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
                                  setConfig((prev) => ({
                                    ...prev,
                                    randomStringLength:
                                      parseInt(e.target.value) || 8,
                                  }))
                                }
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Position</Label>
                              <Select
                                value={config.randomStringPosition}
                                onValueChange={(v: "prefix" | "suffix") =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    randomStringPosition: v,
                                  }))
                                }
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
                              setConfig((prev) => ({ ...prev, useUUID: c }))
                            }
                          />
                        </div>
                        {config.useUUID && (
                          <div className="pl-2 border-l-2 ml-1 space-y-1">
                            <Label className="text-[10px]">Position</Label>
                            <Select
                              value={config.uuidPosition}
                              onValueChange={(v: "prefix" | "suffix") =>
                                setConfig((prev) => ({
                                  ...prev,
                                  uuidPosition: v,
                                }))
                              }
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
            </>
          )}

          {/* ── Section 6: Presets & Templates ── */}
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

                  {/* Preset list */}
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
                            type="button"
                            onClick={() => deletePreset(index)}
                            className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
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

                  {/* Quick Start Templates */}
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
                        <FilePresetTemplates
                          onSelectPreset={(template) =>
                            setConfig((prev) => ({
                              ...prev,
                              ...template.config,
                            }))
                          }
                        />
                      </motion.div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div className="h-4" />
        </div>

        {/* ── Preview Panel (Right) ── */}
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium flex items-center gap-2">
                  {config.creationMode === "map"
                    ? `Creation Preview (${mappedFileEntries.length} files)`
                    : `Live Preview (${previewFiles.length} files)`}
                  {config.creationMode !== "map" &&
                    destinationMode !== "manual" &&
                    propagationTargetCount > 1 && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                        × {propagationTargetCount} folders ={" "}
                        {previewFiles.length * propagationTargetCount} total
                      </span>
                    )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {config.creationMode === "map"
                    ? "Review structure before creating"
                    : destinationMode !== "manual" && propagationTargetCount > 1
                      ? "Files will be created in all matching target folders"
                      : "Click names to edit"}
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
                  onClick={
                    config.creationMode === "map"
                      ? handleCreateMap
                      : handleCreate
                  }
                  disabled={
                    !config.rootPath ||
                    isGenerating ||
                    (config.creationMode === "map"
                      ? mappedFileEntries.length === 0
                      : previewFiles.length === 0)
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
            {config.creationMode !== "map" && stats.total > 0 && (
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

            {/* Status / Error Messages (matching Folder Creation) */}
            <AnimatePresence mode="wait">
              {creationStatus === "error" && creationError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-600 dark:text-red-400 text-xs"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1">{creationError}</div>
                </motion.div>
              )}
              {creationStatus === "success" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-600 dark:text-green-400 text-xs"
                >
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <div className="font-medium">Successfully created files!</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Preview Content */}
          <div className="flex-1 p-4 overflow-hidden">
            {config.creationMode === "map" ? (
              <PropagationPreview
                rootPath={config.rootPath}
                entries={mappedFileEntries}
                destinationMode={destinationMode}
                excludedKeys={excludedPropagationKeys}
                onExcludedKeysChange={setExcludedPropagationKeys}
                className="h-full"
              />
            ) : destinationMode !== "manual" && propagationTargetCount > 1 ? (
              <div className="flex flex-col gap-4 h-full">
                <div className="flex-1 min-h-0">
                  <PreviewList files={previewFiles} onRename={handleRename} />
                </div>
                <div className="shrink-0 max-h-[40%] overflow-hidden">
                  <BulkPropagationTargets
                    rootPath={config.rootPath}
                    destinationFolder={
                      propagationDestination || config.rootPath
                    }
                    destinationMode={destinationMode}
                    excludedKeys={excludedPropagationKeys}
                    onExcludedKeysChange={setExcludedPropagationKeys}
                    fileCount={previewFiles.length}
                  />
                </div>
              </div>
            ) : (
              <PreviewList files={previewFiles} onRename={handleRename} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Inline component: Shows bulk propagation target folders with exclude checkboxes.
 * Used in Pattern/List/CSV modes when propagation is active.
 * Allows users to include/exclude specific target folders before creation.
 */
interface BulkPropagationTargetsProps {
  rootPath: string;
  destinationFolder: string;
  destinationMode: DestinationMode;
  excludedKeys: Set<string>;
  onExcludedKeysChange: (keys: Set<string>) => void;
  fileCount: number;
}

function BulkPropagationTargets({
  rootPath,
  destinationFolder,
  destinationMode,
  excludedKeys,
  onExcludedKeysChange,
  fileCount,
}: BulkPropagationTargetsProps) {
  const [targets, setTargets] = useState<
    Array<{ folderPath: string; displayPath: string }>
  >([]);
  const [patternDescription, setPatternDescription] = useState<
    string | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);

  // Load propagation targets
  useEffect(() => {
    if (!rootPath || !destinationFolder || destinationMode === "manual") {
      setTargets([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    expandPropagationTargets(rootPath, destinationFolder, destinationMode)
      .then((result) => {
        if (!cancelled) {
          setTargets(
            result.targets.map((t) => ({
              folderPath: t.folderPath,
              displayPath: t.displayPath,
            })),
          );
          setPatternDescription(result.patternDescription);
        }
      })
      .catch(() => {
        if (!cancelled) setTargets([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rootPath, destinationFolder, destinationMode]);

  const toggleExcluded = (folderPath: string) => {
    const key = `bulk::${folderPath}`;
    const next = new Set(excludedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onExcludedKeysChange(next);
  };

  const includedCount = targets.filter(
    (t) => !excludedKeys.has(`bulk::${t.folderPath}`),
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Detecting matching folders...
      </div>
    );
  }

  if (targets.length === 0) return null;

  return (
    <div className="space-y-2 border rounded-lg p-3 bg-card/50">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Target Folders
        </Label>
        <span className="text-xs text-muted-foreground">
          {includedCount} of {targets.length} included •{" "}
          {includedCount * fileCount} files total
        </span>
      </div>
      {patternDescription && (
        <p className="text-[10px] text-muted-foreground">
          {patternDescription}
        </p>
      )}
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {targets.map((t) => {
          const key = `bulk::${t.folderPath}`;
          const isExcluded = excludedKeys.has(key);
          return (
            <div
              key={t.folderPath}
              className={cn(
                "flex items-center gap-2 py-1 px-2 rounded text-xs transition-colors hover:bg-muted/50",
                isExcluded && "opacity-50",
              )}
            >
              <input
                type="checkbox"
                title={`Include ${t.displayPath}`}
                checked={!isExcluded}
                onChange={() => toggleExcluded(t.folderPath)}
                className="w-3 h-3"
              />
              <FolderOpen className="h-3 w-3 text-amber-500 shrink-0" />
              <span
                className={cn(
                  "flex-1 truncate font-mono",
                  isExcluded && "line-through",
                )}
                title={t.folderPath}
              >
                {t.displayPath}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
