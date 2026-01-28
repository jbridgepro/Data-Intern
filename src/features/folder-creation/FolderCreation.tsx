/**
 * File: src/features/folder-creation/FolderCreation.tsx
 *
 * Front-end component for the Folder Creation Tab.
 * Provides batch folder creation with advanced features including:
 * - Customizable naming patterns with numbering and date prefixes
 * - Subfolder generation with prefix/suffix options
 * - Configuration presets (save/load/delete)
 * - Export/Import configuration
 * - Real-time preview with inline editing
 * - Progress tracking and statistics dashboard
 * - Enhanced error handling with visual feedback
 */

import { useState, useEffect, useCallback } from "react";
import {
  FolderPlus,
  Play,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  FolderConfig,
  createFolders,
  generatePreview,
  PreviewNode,
  updateNodeName,
  calculateStats,
  FolderCreationStats,
} from "./utils/folderUtils";
import { FolderForm } from "./components/FolderForm";
import { FolderPreview } from "./components/FolderPreview";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";

import { motion, AnimatePresence } from "framer-motion";
import { open } from "@tauri-apps/plugin-dialog";

// Configuration preset type
interface ConfigPreset {
  name: string;
  config: FolderConfig;
}

export const FolderCreation = () => {
  const [config, setConfig] = useState<FolderConfig>({
    rootPath: "",
    creationMode: "pattern",
    folderList: "",
    baseName: "Project",
    count: 1,
    subfolders: "",
    useNumbering: true,
    startNumber: 1,
    digitCount: 2,
    numberPosition: "prefix",
    separator: "-",
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
    subfolderPrefix: "",
    subfolderSuffix: "",
    overwrite: false,
    csvDelimiter: "-",
    csvColumnOrder: [],
    csvColumnConfig: {},
    csvRows: [],
    csvHeaders: [],
  });

  // State to hold the current nodes. This allows edits to persist until config changes.
  const [nodes, setNodes] = useState<PreviewNode[]>([]);
  const [stats, setStats] = useState<FolderCreationStats>({
    total: 0,
    success: 0,
    error: 0,
    exists: 0,
    pending: 0,
  });
  const [presets, setPresets] = useState<ConfigPreset[]>([]);
  const [presetName, setPresetName] = useState("");

  // When config changes, regenerate nodes.
  // Note: This wipes out edits. In V2 we could try to diff/merge, but for V1 simple regen is safer.
  useEffect(() => {
    const newNodes = generatePreview(config);
    setNodes(newNodes);
    setStats(calculateStats(newNodes));
  }, [config]);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("folderCreationPresets");
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
      localStorage.setItem("folderCreationPresets", JSON.stringify(newPresets));
      setPresets(newPresets);
    } catch (e) {
      console.error("Failed to save presets:", e);
    }
  }, []);

  const handleRename = (id: string, newName: string) => {
    const updatedNodes = updateNodeName(nodes, id, newName);
    setNodes(updatedNodes);
    setStats(calculateStats(updatedNodes));
  };

  const [status, setStatus] = useState<
    "idle" | "creating" | "success" | "error"
  >("idle");
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    status: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Handles folder creation with progress tracking and real-time updates
   * Uses edited names if available
   */
  const handleCreate = async () => {
    if (!config.rootPath) {
      setErrorMessage("Please select a target location first.");
      setStatus("error");
      return;
    }

    setStatus("creating");
    setErrorMessage(null);
    const totalCount = config.count;
    setProgress({ current: 0, total: totalCount, status: "Starting..." });

    // Reset all nodes to pending status
    const resetNodes = nodes.map((node) => {
      const resetNode = (n: PreviewNode): PreviewNode => ({
        ...n,
        status: n.id === "more-placeholder" ? undefined : "pending",
        errorMessage: undefined,
      });
      return {
        ...resetNode(node),
        children: node.children?.map(resetNode),
      };
    });
    setNodes(resetNodes);
    setStats(calculateStats(resetNodes));

    try {
      const result = await createFolders(
        config,
        resetNodes,
        (current, total, statusText) => {
          setProgress({ current, total, status: statusText });
        },
        (updatedNodes) => {
          setNodes(updatedNodes);
          setStats(calculateStats(updatedNodes));
        },
      );

      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Failed to create some folders");
      }
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to create folders");
    }
  };

  /**
   * Saves current configuration as a preset
   */
  const savePreset = () => {
    if (!presetName.trim()) return;
    const newPreset: ConfigPreset = {
      name: presetName.trim(),
      config: { ...config, csvRows: [] },
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
    link.download = "folder-creation-config.json";
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

  const resetStatus = () => {
    if (status === "success" || status === "error") {
      setStatus("idle");
      setErrorMessage(null);
      setProgress({ current: 0, total: 0, status: "" });
    }
  };

  // Calculate progress percentage
  const progressPercent =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <FolderPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Folder Creation</h2>
            <p className="text-xs text-muted-foreground">
              Batch create organized folder structures
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Config Panel - Left */}
        <div className="w-[400px] border-r overflow-y-auto p-6 space-y-8 bg-card/30">
          <FolderForm
            config={config}
            setConfig={(newConfig) => {
              setConfig(newConfig);
              resetStatus();
            }}
            isCreating={status === "creating"}
            presets={presets}
            presetName={presetName}
            setPresetName={setPresetName}
            onSavePreset={savePreset}
            onLoadPreset={loadPreset}
            onDeletePreset={deletePreset}
            onExportConfig={exportConfig}
            onImportConfig={importConfig}
          />
          <div className="h-4" /> {/* Spacer */}
        </div>

        {/* Preview Panel - Right */}
        <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  Live Preview ({stats.total} folders)
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
                    checked={config.overwrite || false}
                    onCheckedChange={(c: boolean) =>
                      setConfig((prev) => ({ ...prev, overwrite: c }))
                    }
                  />
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={
                    !config.rootPath ||
                    status === "creating" ||
                    stats.total === 0
                  }
                >
                  {status === "creating" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Create Folders
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            {status === "creating" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
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

            {/* Status / Error Messages */}
            <AnimatePresence mode="wait">
              {status === "error" && errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-600 dark:text-red-400 text-xs"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1">{errorMessage}</div>
                </motion.div>
              )}
              {status === "success" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-600 dark:text-green-400 text-xs"
                >
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <div className="font-medium">
                    Successfully created folders!
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 p-4 overflow-hidden">
            <FolderPreview nodes={nodes} onRename={handleRename} />
          </div>
        </div>
      </div>
    </div>
  );
};
