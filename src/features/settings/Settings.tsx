// File Path: src/features/settings/Settings.tsx
// Front-end: Settings page component for application configuration

import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Palette,
  Bell,
  FileText,
  Shield,
  Info,
  Moon,
  Sun,
  FolderTree,
  Copy,
  FolderPlus,
  FilePlus,
  Terminal,
  Search,
  Database,
  Sparkles,
  Slider,
  Layout,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

interface SettingsProps {
  themeMode: "light" | "dark";
  toggleTheme: () => void;
  onNavigateToPanelConfig?: () => void;
}

export const Settings = ({
  themeMode,
  toggleTheme,
  onNavigateToPanelConfig,
}: SettingsProps) => {
  // General Settings State
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem("notifications-enabled");
    return saved ? saved === "true" : true;
  });

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    const saved = localStorage.getItem("auto-save-enabled");
    return saved ? saved === "true" : true;
  });

  const [confirmBeforeDelete, setConfirmBeforeDelete] = useState(() => {
    const saved = localStorage.getItem("confirm-before-delete");
    return saved ? saved === "true" : true;
  });

  const [defaultViewMode, setDefaultViewMode] = useState(() => {
    const saved = localStorage.getItem("default-view-mode");
    return saved || "grid";
  });

  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("language");
    return saved || "en";
  });

  // File Mapper Settings
  const [mapperShowFileSizes, setMapperShowFileSizes] = useState(() => {
    const saved = localStorage.getItem("mapper-show-file-sizes");
    return saved ? saved === "true" : true;
  });

  const [mapperShowFileCounts, setMapperShowFileCounts] = useState(() => {
    const saved = localStorage.getItem("mapper-show-file-counts");
    return saved ? saved === "true" : true;
  });

  const [mapperMaxDepth, setMapperMaxDepth] = useState(() => {
    const saved = localStorage.getItem("mapper-max-depth");
    return saved ? parseInt(saved) : 5;
  });

  const [mapperVisualizationStyle, setMapperVisualizationStyle] = useState(
    () => {
      const saved = localStorage.getItem("mapper-visualization-style");
      return saved || "tree";
    },
  );

  // File Copy Settings
  const [copyConflictResolution, setCopyConflictResolution] = useState(() => {
    const saved = localStorage.getItem("copy-conflict-resolution");
    return saved || "ask";
  });

  const [copyPreserveStructure, setCopyPreserveStructure] = useState(() => {
    const saved = localStorage.getItem("copy-preserve-structure");
    return saved ? saved === "true" : false;
  });

  const [copyExcludeTemp, setCopyExcludeTemp] = useState(() => {
    const saved = localStorage.getItem("copy-exclude-temp");
    return saved ? saved === "true" : true;
  });

  // Folder Creation Settings
  const [folderDefaultSeparator, setFolderDefaultSeparator] = useState(() => {
    const saved = localStorage.getItem("folder-default-separator");
    return saved || "_";
  });

  const [folderAutoCreateStructure, setFolderAutoCreateStructure] = useState(
    () => {
      const saved = localStorage.getItem("folder-auto-create-structure");
      return saved ? saved === "true" : true;
    },
  );

  // Empty Files Settings
  const [emptyFilesDefaultExtensions, setEmptyFilesDefaultExtensions] =
    useState(() => {
      const saved = localStorage.getItem("empty-files-default-extensions");
      return saved || "txt";
    });

  const [emptyFilesUseNumbering, setEmptyFilesUseNumbering] = useState(() => {
    const saved = localStorage.getItem("empty-files-use-numbering");
    return saved ? saved === "true" : true;
  });

  const [emptyFilesDefaultCount, setEmptyFilesDefaultCount] = useState(() => {
    const saved = localStorage.getItem("empty-files-default-count");
    return saved ? parseInt(saved) : 1;
  });

  // Terminal Settings
  const [terminalTheme, setTerminalTheme] = useState(() => {
    const saved = localStorage.getItem("terminal-theme");
    return saved || "default";
  });

  const [terminalFontSize, setTerminalFontSize] = useState(() => {
    const saved = localStorage.getItem("terminal-font-size");
    return saved ? parseInt(saved) : 14;
  });

  // Find & Replace Settings
  const [findReplaceMatchCase, setFindReplaceMatchCase] = useState(() => {
    const saved = localStorage.getItem("find-replace-match-case");
    return saved ? saved === "true" : false;
  });

  const [findReplaceUseRegex, setFindReplaceUseRegex] = useState(() => {
    const saved = localStorage.getItem("find-replace-use-regex");
    return saved ? saved === "true" : false;
  });

  const [
    findReplaceDefaultIncludePattern,
    setFindReplaceDefaultIncludePattern,
  ] = useState(() => {
    const saved = localStorage.getItem("find-replace-default-include-pattern");
    return saved || "*";
  });

  // SQL Export Wizard Settings
  const [sqlDefaultExportFolder, setSqlDefaultExportFolder] = useState(() => {
    const saved = localStorage.getItem("sql-default-export-folder");
    return saved || "";
  });

  const [sqlDefaultBatchSize, setSqlDefaultBatchSize] = useState(() => {
    const saved = localStorage.getItem("sql-default-batch-size");
    return saved ? parseInt(saved) : 1000;
  });

  const [sqlCsvDelimiter, setSqlCsvDelimiter] = useState(() => {
    // First check SQL Export Wizard's storage format
    try {
      const wizardSettings = localStorage.getItem("sql-export-wizard-settings");
      if (wizardSettings) {
        const parsed = JSON.parse(wizardSettings);
        if (parsed.csvDelimiter) {
          return parsed.csvDelimiter;
        }
      }
    } catch (error) {
      console.error("Failed to read from SQL Export Wizard settings:", error);
    }
    // Fallback to direct storage key
    const saved = localStorage.getItem("sql-csv-delimiter");
    return saved || ",";
  });

  const [sqlCsvDelimiterIsCustom, setSqlCsvDelimiterIsCustom] = useState(() => {
    // Calculate based on initial delimiter value
    try {
      const wizardSettings = localStorage.getItem("sql-export-wizard-settings");
      let delimiter = ",";
      if (wizardSettings) {
        const parsed = JSON.parse(wizardSettings);
        if (parsed.csvDelimiter) {
          delimiter = parsed.csvDelimiter;
        }
      } else {
        const saved = localStorage.getItem("sql-csv-delimiter");
        if (saved) delimiter = saved;
      }
      const commonDelimiters = [",", ";", "\t", "|"];
      return !commonDelimiters.includes(delimiter);
    } catch {
      return false;
    }
  });

  const [sqlIncludeHeaders, setSqlIncludeHeaders] = useState(() => {
    const saved = localStorage.getItem("sql-include-headers");
    return saved ? saved === "true" : true;
  });

  // AI Assistant Settings
  const [aiModel, setAiModel] = useState(() => {
    const saved = localStorage.getItem("ai-model");
    return saved || "claude-sonnet";
  });

  const [aiCreativityLevel, setAiCreativityLevel] = useState(() => {
    const saved = localStorage.getItem("ai-creativity-level");
    return saved || "balanced";
  });

  const [aiEnableBackup, setAiEnableBackup] = useState(() => {
    const saved = localStorage.getItem("ai-enable-backup");
    return saved ? saved === "true" : true;
  });

  const [aiDryRunDefault, setAiDryRunDefault] = useState(() => {
    const saved = localStorage.getItem("ai-dry-run-default");
    return saved ? saved === "true" : false;
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem(
      "notifications-enabled",
      notificationsEnabled.toString(),
    );
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem("auto-save-enabled", autoSaveEnabled.toString());
  }, [autoSaveEnabled]);

  useEffect(() => {
    localStorage.setItem(
      "confirm-before-delete",
      confirmBeforeDelete.toString(),
    );
  }, [confirmBeforeDelete]);

  useEffect(() => {
    localStorage.setItem("default-view-mode", defaultViewMode);
  }, [defaultViewMode]);

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  // File Mapper settings
  useEffect(() => {
    localStorage.setItem(
      "mapper-show-file-sizes",
      mapperShowFileSizes.toString(),
    );
  }, [mapperShowFileSizes]);

  useEffect(() => {
    localStorage.setItem(
      "mapper-show-file-counts",
      mapperShowFileCounts.toString(),
    );
  }, [mapperShowFileCounts]);

  useEffect(() => {
    localStorage.setItem("mapper-max-depth", mapperMaxDepth.toString());
  }, [mapperMaxDepth]);

  useEffect(() => {
    localStorage.setItem(
      "mapper-visualization-style",
      mapperVisualizationStyle,
    );
  }, [mapperVisualizationStyle]);

  // File Copy settings
  useEffect(() => {
    localStorage.setItem("copy-conflict-resolution", copyConflictResolution);
  }, [copyConflictResolution]);

  useEffect(() => {
    localStorage.setItem(
      "copy-preserve-structure",
      copyPreserveStructure.toString(),
    );
  }, [copyPreserveStructure]);

  useEffect(() => {
    localStorage.setItem("copy-exclude-temp", copyExcludeTemp.toString());
  }, [copyExcludeTemp]);

  // Folder Creation settings
  useEffect(() => {
    localStorage.setItem("folder-default-separator", folderDefaultSeparator);
  }, [folderDefaultSeparator]);

  useEffect(() => {
    localStorage.setItem(
      "folder-auto-create-structure",
      folderAutoCreateStructure.toString(),
    );
  }, [folderAutoCreateStructure]);

  // Empty Files settings
  useEffect(() => {
    localStorage.setItem(
      "empty-files-default-extensions",
      emptyFilesDefaultExtensions,
    );
  }, [emptyFilesDefaultExtensions]);

  useEffect(() => {
    localStorage.setItem(
      "empty-files-use-numbering",
      emptyFilesUseNumbering.toString(),
    );
  }, [emptyFilesUseNumbering]);

  useEffect(() => {
    localStorage.setItem(
      "empty-files-default-count",
      emptyFilesDefaultCount.toString(),
    );
  }, [emptyFilesDefaultCount]);

  // Terminal settings
  useEffect(() => {
    localStorage.setItem("terminal-theme", terminalTheme);
  }, [terminalTheme]);

  useEffect(() => {
    localStorage.setItem("terminal-font-size", terminalFontSize.toString());
  }, [terminalFontSize]);

  // Find & Replace settings
  useEffect(() => {
    localStorage.setItem(
      "find-replace-match-case",
      findReplaceMatchCase.toString(),
    );
  }, [findReplaceMatchCase]);

  useEffect(() => {
    localStorage.setItem(
      "find-replace-use-regex",
      findReplaceUseRegex.toString(),
    );
  }, [findReplaceUseRegex]);

  useEffect(() => {
    localStorage.setItem(
      "find-replace-default-include-pattern",
      findReplaceDefaultIncludePattern,
    );
  }, [findReplaceDefaultIncludePattern]);

  // SQL Export Wizard settings
  useEffect(() => {
    localStorage.setItem("sql-default-export-folder", sqlDefaultExportFolder);
  }, [sqlDefaultExportFolder]);

  useEffect(() => {
    localStorage.setItem(
      "sql-default-batch-size",
      sqlDefaultBatchSize.toString(),
    );
  }, [sqlDefaultBatchSize]);

  useEffect(() => {
    localStorage.setItem("sql-csv-delimiter", sqlCsvDelimiter);
    // Update custom flag when delimiter changes
    const commonDelimiters = [",", ";", "\t", "|"];
    setSqlCsvDelimiterIsCustom(!commonDelimiters.includes(sqlCsvDelimiter));

    // Also sync with SQL Export Wizard's storage format
    try {
      const wizardSettingsKey = "sql-export-wizard-settings";
      const existingSettings = localStorage.getItem(wizardSettingsKey);
      const settings = existingSettings ? JSON.parse(existingSettings) : {};
      settings.csvDelimiter = sqlCsvDelimiter;
      localStorage.setItem(wizardSettingsKey, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to sync delimiter with SQL Export Wizard:", error);
    }
  }, [sqlCsvDelimiter]);

  // Handler for delimiter selection from dropdown
  const handleDelimiterSelect = (value: string) => {
    if (value === "custom") {
      setSqlCsvDelimiterIsCustom(true);
      // Keep current value if it exists, otherwise set to empty
      if (!sqlCsvDelimiter || [",", ";", "\t", "|"].includes(sqlCsvDelimiter)) {
        setSqlCsvDelimiter("");
      }
    } else {
      setSqlCsvDelimiterIsCustom(false);
      setSqlCsvDelimiter(value);
    }
  };

  useEffect(() => {
    localStorage.setItem("sql-include-headers", sqlIncludeHeaders.toString());
  }, [sqlIncludeHeaders]);

  // AI Assistant settings
  useEffect(() => {
    localStorage.setItem("ai-model", aiModel);
  }, [aiModel]);

  useEffect(() => {
    localStorage.setItem("ai-creativity-level", aiCreativityLevel);
  }, [aiCreativityLevel]);

  useEffect(() => {
    localStorage.setItem("ai-enable-backup", aiEnableBackup.toString());
  }, [aiEnableBackup]);

  useEffect(() => {
    localStorage.setItem("ai-dry-run-default", aiDryRunDefault.toString());
  }, [aiDryRunDefault]);

  return (
    <div className="flex flex-col h-full glass rounded-2xl shadow-xl overflow-hidden relative min-h-0">
      <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 p-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <SettingsIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Settings
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage your application preferences
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 min-h-0">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Appearance Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Appearance</CardTitle>
                </div>
                <CardDescription>
                  Customize the look and feel of the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="theme" className="text-base font-medium">
                      Theme
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Choose your preferred color scheme
                    </p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {themeMode === "dark" ? (
                      <>
                        <Sun className="h-4 w-4" />
                        <span>Light Mode</span>
                      </>
                    ) : (
                      <>
                        <Moon className="h-4 w-4" />
                        <span>Dark Mode</span>
                      </>
                    )}
                  </button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="language" className="text-base font-medium">
                      Language
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Select your preferred language
                    </p>
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label className="text-base font-medium">
                      Panel Configuration
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Customize workspace layout and panel visibility
                    </p>
                  </div>
                  <button
                    onClick={onNavigateToPanelConfig}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Layout className="h-4 w-4" />
                    <span>Open Panel Config</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* General Settings Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>General</CardTitle>
                </div>
                <CardDescription>
                  Configure general application settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="auto-save"
                      className="text-base font-medium"
                    >
                      Auto Save
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Automatically save your work periodically
                    </p>
                  </div>
                  <Switch
                    id="auto-save"
                    checked={autoSaveEnabled}
                    onCheckedChange={setAutoSaveEnabled}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="view-mode"
                      className="text-base font-medium"
                    >
                      Default View Mode
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Choose the default view for file listings
                    </p>
                  </div>
                  <Select
                    value={defaultViewMode}
                    onValueChange={setDefaultViewMode}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select view mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid View</SelectItem>
                      <SelectItem value="list">List View</SelectItem>
                      <SelectItem value="compact">Compact View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* File Mapper Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FolderTree className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>File Mapper</CardTitle>
                </div>
                <CardDescription>
                  Configure file mapping and visualization preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="mapper-show-sizes"
                      className="text-base font-medium"
                    >
                      Show File Sizes
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Display file sizes in the mapper view
                    </p>
                  </div>
                  <Switch
                    id="mapper-show-sizes"
                    checked={mapperShowFileSizes}
                    onCheckedChange={setMapperShowFileSizes}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="mapper-show-counts"
                      className="text-base font-medium"
                    >
                      Show File Counts
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Display file counts in directories
                    </p>
                  </div>
                  <Switch
                    id="mapper-show-counts"
                    checked={mapperShowFileCounts}
                    onCheckedChange={setMapperShowFileCounts}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="mapper-visualization"
                      className="text-base font-medium"
                    >
                      Visualization Style
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Default visualization format
                    </p>
                  </div>
                  <Select
                    value={mapperVisualizationStyle}
                    onValueChange={setMapperVisualizationStyle}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tree">Tree View</SelectItem>
                      <SelectItem value="list">List View</SelectItem>
                      <SelectItem value="graph">Graph View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="mapper-max-depth"
                      className="text-base font-medium"
                    >
                      Max Depth
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Maximum directory depth to display
                    </p>
                  </div>
                  <Input
                    id="mapper-max-depth"
                    type="number"
                    min="1"
                    max="20"
                    value={mapperMaxDepth}
                    onChange={(e) =>
                      setMapperMaxDepth(parseInt(e.target.value) || 5)
                    }
                    className="w-[100px]"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* File Copy Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Copy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>File Copy</CardTitle>
                </div>
                <CardDescription>
                  Configure file copy and move operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="copy-conflict"
                      className="text-base font-medium"
                    >
                      Conflict Resolution
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Default action when files already exist
                    </p>
                  </div>
                  <Select
                    value={copyConflictResolution}
                    onValueChange={setCopyConflictResolution}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ask">Ask Each Time</SelectItem>
                      <SelectItem value="overwrite">Overwrite</SelectItem>
                      <SelectItem value="skip">Skip</SelectItem>
                      <SelectItem value="rename">Rename</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="copy-preserve"
                      className="text-base font-medium"
                    >
                      Preserve Directory Structure
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Maintain folder hierarchy when copying
                    </p>
                  </div>
                  <Switch
                    id="copy-preserve"
                    checked={copyPreserveStructure}
                    onCheckedChange={setCopyPreserveStructure}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="copy-exclude-temp"
                      className="text-base font-medium"
                    >
                      Exclude Temp Files
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Automatically exclude temporary files
                    </p>
                  </div>
                  <Switch
                    id="copy-exclude-temp"
                    checked={copyExcludeTemp}
                    onCheckedChange={setCopyExcludeTemp}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Folder Creation Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FolderPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Folder Creation</CardTitle>
                </div>
                <CardDescription>
                  Configure folder creation defaults
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="folder-separator"
                      className="text-base font-medium"
                    >
                      Default Separator
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Character used to separate folder names
                    </p>
                  </div>
                  <Select
                    value={folderDefaultSeparator}
                    onValueChange={setFolderDefaultSeparator}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Underscore (_)</SelectItem>
                      <SelectItem value="-">Hyphen (-)</SelectItem>
                      <SelectItem value=".">Dot (.)</SelectItem>
                      <SelectItem value=" ">Space ( )</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="folder-auto-structure"
                      className="text-base font-medium"
                    >
                      Auto-Create Structure
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Automatically create nested folder structure
                    </p>
                  </div>
                  <Switch
                    id="folder-auto-structure"
                    checked={folderAutoCreateStructure}
                    onCheckedChange={setFolderAutoCreateStructure}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Empty Files Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FilePlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Empty Files</CardTitle>
                </div>
                <CardDescription>
                  Configure empty file generation defaults
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="empty-extensions"
                      className="text-base font-medium"
                    >
                      Default Extensions
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Comma-separated default file extensions
                    </p>
                  </div>
                  <Input
                    id="empty-extensions"
                    value={emptyFilesDefaultExtensions}
                    onChange={(e) =>
                      setEmptyFilesDefaultExtensions(e.target.value)
                    }
                    placeholder="txt,md,json"
                    className="w-[180px]"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="empty-numbering"
                      className="text-base font-medium"
                    >
                      Use Numbering
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Enable automatic file numbering by default
                    </p>
                  </div>
                  <Switch
                    id="empty-numbering"
                    checked={emptyFilesUseNumbering}
                    onCheckedChange={setEmptyFilesUseNumbering}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="empty-count"
                      className="text-base font-medium"
                    >
                      Default Count
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Default number of files to generate
                    </p>
                  </div>
                  <Input
                    id="empty-count"
                    type="number"
                    min="1"
                    max="1000"
                    value={emptyFilesDefaultCount}
                    onChange={(e) =>
                      setEmptyFilesDefaultCount(parseInt(e.target.value) || 1)
                    }
                    className="w-[100px]"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Terminal Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Terminal className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Terminal</CardTitle>
                </div>
                <CardDescription>
                  Configure terminal appearance and behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="terminal-theme"
                      className="text-base font-medium"
                    >
                      Theme
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Terminal color theme
                    </p>
                  </div>
                  <Select
                    value={terminalTheme}
                    onValueChange={setTerminalTheme}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="monokai">Monokai</SelectItem>
                      <SelectItem value="solarized">Solarized</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="terminal-font-size"
                      className="text-base font-medium"
                    >
                      Font Size
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Terminal font size in pixels
                    </p>
                  </div>
                  <Input
                    id="terminal-font-size"
                    type="number"
                    min="8"
                    max="24"
                    value={terminalFontSize}
                    onChange={(e) =>
                      setTerminalFontSize(parseInt(e.target.value) || 14)
                    }
                    className="w-[100px]"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Find & Replace Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Find & Replace</CardTitle>
                </div>
                <CardDescription>
                  Configure search and replace defaults
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="find-match-case"
                      className="text-base font-medium"
                    >
                      Match Case
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Case-sensitive search by default
                    </p>
                  </div>
                  <Switch
                    id="find-match-case"
                    checked={findReplaceMatchCase}
                    onCheckedChange={setFindReplaceMatchCase}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="find-use-regex"
                      className="text-base font-medium"
                    >
                      Use Regex
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Enable regular expressions by default
                    </p>
                  </div>
                  <Switch
                    id="find-use-regex"
                    checked={findReplaceUseRegex}
                    onCheckedChange={setFindReplaceUseRegex}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="find-include-pattern"
                      className="text-base font-medium"
                    >
                      Default Include Pattern
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Default file pattern to search
                    </p>
                  </div>
                  <Input
                    id="find-include-pattern"
                    value={findReplaceDefaultIncludePattern}
                    onChange={(e) =>
                      setFindReplaceDefaultIncludePattern(e.target.value)
                    }
                    placeholder="*"
                    className="w-[180px]"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* SQL Export Wizard Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>SQL Export Wizard</CardTitle>
                </div>
                <CardDescription>
                  Configure SQL export and import defaults
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="sql-export-folder"
                      className="text-base font-medium"
                    >
                      Default Export Folder
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Default destination for exports
                    </p>
                  </div>
                  <Input
                    id="sql-export-folder"
                    value={sqlDefaultExportFolder}
                    onChange={(e) => setSqlDefaultExportFolder(e.target.value)}
                    placeholder="/path/to/exports"
                    className="w-[250px]"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="sql-batch-size"
                      className="text-base font-medium"
                    >
                      Default Batch Size
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Number of rows per batch
                    </p>
                  </div>
                  <Input
                    id="sql-batch-size"
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={sqlDefaultBatchSize}
                    onChange={(e) =>
                      setSqlDefaultBatchSize(parseInt(e.target.value) || 1000)
                    }
                    className="w-[120px]"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="sql-delimiter"
                        className="text-base font-medium"
                      >
                        CSV Delimiter
                      </Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Default delimiter for CSV exports
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={
                          sqlCsvDelimiterIsCustom ? "custom" : sqlCsvDelimiter
                        }
                        onValueChange={handleDelimiterSelect}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=",">Comma (,)</SelectItem>
                          <SelectItem value=";">Semicolon (;)</SelectItem>
                          <SelectItem value="\t">Tab</SelectItem>
                          <SelectItem value="|">Pipe (|)</SelectItem>
                          <SelectItem value="custom">Custom...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {sqlCsvDelimiterIsCustom && (
                    <div className="flex items-center justify-end">
                      <div className="flex flex-col gap-1.5 w-[180px]">
                        <Label
                          htmlFor="sql-custom-delimiter"
                          className="text-sm text-slate-600 dark:text-slate-400"
                        >
                          Custom Delimiter
                        </Label>
                        <Input
                          id="sql-custom-delimiter"
                          value={sqlCsvDelimiter}
                          onChange={(e) => setSqlCsvDelimiter(e.target.value)}
                          placeholder="Enter custom delimiter"
                          maxLength={10}
                          className="w-full"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Enter a single character or escape sequence (e.g., \t
                          for tab)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="sql-headers"
                      className="text-base font-medium"
                    >
                      Include Headers
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Include column headers in exports by default
                    </p>
                  </div>
                  <Switch
                    id="sql-headers"
                    checked={sqlIncludeHeaders}
                    onCheckedChange={setSqlIncludeHeaders}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Assistant Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>AI Assistant</CardTitle>
                </div>
                <CardDescription>
                  Configure AI assistant behavior and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="ai-model" className="text-base font-medium">
                      AI Model
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Default AI model to use
                    </p>
                  </div>
                  <Select value={aiModel} onValueChange={setAiModel}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-sonnet">
                        Claude Sonnet 4.5
                      </SelectItem>
                      <SelectItem value="claude-opus">
                        Claude Opus 4.5
                      </SelectItem>
                      <SelectItem value="claude-haiku">
                        Claude Haiku 4.5
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="ai-creativity"
                      className="text-base font-medium"
                    >
                      Creativity Level
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      AI response creativity and innovation
                    </p>
                  </div>
                  <Select
                    value={aiCreativityLevel}
                    onValueChange={setAiCreativityLevel}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="ai-backup"
                      className="text-base font-medium"
                    >
                      Enable Auto-Backup
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Create backups before major operations
                    </p>
                  </div>
                  <Switch
                    id="ai-backup"
                    checked={aiEnableBackup}
                    onCheckedChange={setAiEnableBackup}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="ai-dry-run"
                      className="text-base font-medium"
                    >
                      Dry Run by Default
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Preview changes without executing
                    </p>
                  </div>
                  <Switch
                    id="ai-dry-run"
                    checked={aiDryRunDefault}
                    onCheckedChange={setAiDryRunDefault}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Notifications</CardTitle>
                </div>
                <CardDescription>
                  Manage notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="notifications"
                      className="text-base font-medium"
                    >
                      Enable Notifications
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Receive notifications for important events
                    </p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={notificationsEnabled}
                    onCheckedChange={setNotificationsEnabled}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Safety Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>Safety</CardTitle>
                </div>
                <CardDescription>
                  Configure safety and confirmation settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label
                      htmlFor="confirm-delete"
                      className="text-base font-medium"
                    >
                      Confirm Before Delete
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Ask for confirmation before deleting files or folders
                    </p>
                  </div>
                  <Switch
                    id="confirm-delete"
                    checked={confirmBeforeDelete}
                    onCheckedChange={setConfirmBeforeDelete}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* About Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
          >
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle>About</CardTitle>
                </div>
                <CardDescription>Application information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Version
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      0.1.0
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Build
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Development
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Platform
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Tauri
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
