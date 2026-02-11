// File Path: src/features/settings/Settings.tsx
// Front-end: Enhanced Settings page component with sidebar navigation, search, and comprehensive configuration options

import { useEffect, useMemo } from "react";
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
  Layout,
  ExternalLink,
  Globe,
  Server,
  Cpu,
  Zap,
  Brain,
  CheckCircle2,
  AlertCircle,
  Eye,
  Gauge,
  ShieldCheck,
  History,
  Keyboard,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  Check,
  X,
  ChevronRight,
  Save,
  Trash2,
  RefreshCw,
  Command,
  Key,
  MousePointer,
  MonitorSmartphone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/layout/PageHeader";
import { settingsInfo } from "@/components/layout/toolInfoContent";
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
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { AIProviderSetupWizard } from "@/features/ai-assistant/components/AIProviderSetupWizard";
import {
  checkProviderConfiguration,
  getProviderHelpUrl,
  markSetupCompleted,
} from "@/features/ai-assistant/utils/providerStatus";
import {
  ACCENT_PRESETS,
  SURFACE_PRESETS,
  FONT_FAMILY_PRESETS,
  FONT_SCALE_PRESETS,
  FontFamilyPreset,
  FontScalePreset,
} from "@/lib/themePreferences";
import { useSettingsState } from "./hooks/useSettingsState";
import { UpdateCheckRow } from "./components/UpdateCheckRow";

// ============================================================================
// Type Definitions
// ============================================================================

interface SettingsProps {
  themeMode: "light" | "dark";
  toggleTheme: () => void;
  onNavigateToPanelConfig?: () => void;
  /** When set (e.g. from "Open AI Settings" link), scroll to this section id on mount */
  initialSection?: string;
  /** Called after scrolling to initialSection so the app can clear pending section */
  onInitialSectionHandled?: () => void;
}

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

// Sidebar navigation sections definition
const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="h-4 w-4" />,
    description: "Theme, language, and display",
  },
  {
    id: "general",
    label: "General",
    icon: <FileText className="h-4 w-4" />,
    description: "Auto-save and view preferences",
  },
  {
    id: "file-mapper",
    label: "File Mapper",
    icon: <FolderTree className="h-4 w-4" />,
    description: "Visualization settings",
  },
  {
    id: "file-copy",
    label: "File Copy",
    icon: <Copy className="h-4 w-4" />,
    description: "Copy and move operations",
  },
  {
    id: "folder-creation",
    label: "Folder Creation",
    icon: <FolderPlus className="h-4 w-4" />,
    description: "Folder defaults",
  },
  {
    id: "empty-files",
    label: "Empty Files",
    icon: <FilePlus className="h-4 w-4" />,
    description: "File generation",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: <Terminal className="h-4 w-4" />,
    description: "Terminal appearance",
  },
  {
    id: "find-replace",
    label: "Find & Replace",
    icon: <Search className="h-4 w-4" />,
    description: "Search defaults",
  },
  {
    id: "sql-export",
    label: "SQL Export",
    icon: <Database className="h-4 w-4" />,
    description: "Database exports",
  },
  {
    id: "ai-assistant",
    label: "AI Assistant",
    icon: <Sparkles className="h-4 w-4" />,
    description: "AI configuration",
  },
  {
    id: "keyboard",
    label: "Keyboard Shortcuts",
    icon: <Keyboard className="h-4 w-4" />,
    description: "Shortcuts & hotkeys",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    description: "Alerts and notifications",
  },
  {
    id: "safety",
    label: "Safety",
    icon: <Shield className="h-4 w-4" />,
    description: "Confirmation prompts",
  },
  {
    id: "storage",
    label: "Storage & Data",
    icon: <HardDrive className="h-4 w-4" />,
    description: "Data management",
  },
  {
    id: "about",
    label: "About",
    icon: <Info className="h-4 w-4" />,
    description: "App information",
  },
];

// Keyboard shortcuts data
const KEYBOARD_SHORTCUTS = [
  {
    category: "Navigation",
    shortcuts: [
      {
        keys: ["⌘", "B"],
        windowsKeys: ["Ctrl", "B"],
        action: "Toggle Sidebar",
      },
      {
        keys: ["⌘", "J"],
        windowsKeys: ["Ctrl", "J"],
        action: "Toggle Bottom Panel",
      },
      {
        keys: ["⌘", "⇧", "B"],
        windowsKeys: ["Ctrl", "Shift", "B"],
        action: "Toggle Chat Panel",
      },
      {
        keys: ["⌘", "⇧", "S"],
        windowsKeys: ["Ctrl", "Shift", "S"],
        action: "Toggle Agent Sidebar",
      },
    ],
  },
  {
    category: "File Operations",
    shortcuts: [
      { keys: ["⌘", "S"], windowsKeys: ["Ctrl", "S"], action: "Save Current" },
      {
        keys: ["⌘", "⇧", "N"],
        windowsKeys: ["Ctrl", "Shift", "N"],
        action: "New File",
      },
      { keys: ["⌘", "O"], windowsKeys: ["Ctrl", "O"], action: "Open Folder" },
    ],
  },
  {
    category: "AI Assistant",
    shortcuts: [
      {
        keys: ["⌘", "Enter"],
        windowsKeys: ["Ctrl", "Enter"],
        action: "Send Message",
      },
      {
        keys: ["⌘", "K"],
        windowsKeys: ["Ctrl", "K"],
        action: "Focus AI Input",
      },
      { keys: ["Esc"], windowsKeys: ["Esc"], action: "Cancel Operation" },
    ],
  },
];

// ============================================================================
// Toast Notification Component
// ============================================================================

const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: string;
  onClose: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 50, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.9 }}
    className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-md ${
      type === "success"
        ? "bg-green-100/90 dark:bg-green-900/90 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
        : type === "error"
        ? "bg-red-100/90 dark:bg-red-900/90 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
        : "bg-blue-100/90 dark:bg-blue-900/90 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
    }`}
  >
    {type === "success" ? (
      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
    ) : type === "error" ? (
      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
    ) : (
      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
    )}
    <span className="text-sm font-medium">{message}</span>
    <button
      onClick={onClose}
      aria-label="Close notification"
      className="ml-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
    >
      <X className="h-4 w-4" />
    </button>
  </motion.div>
);

// ============================================================================
// Main Settings Component
// ============================================================================

export const Settings = ({
  themeMode,
  toggleTheme,
  onNavigateToPanelConfig,
  initialSection,
  onInitialSectionHandled,
}: SettingsProps) => {
  // ============================================================================
  // All settings state, localStorage sync, and handlers via extracted hook
  // ============================================================================
  const s = useSettingsState(themeMode);

  // Shorthand destructures for frequently-used values in JSX
  const {
    activeSection, setActiveSection,
    searchQuery, setSearchQuery,
    toasts, removeToast, showToast,
    sectionRefs, isMac,
    // General
    notificationsEnabled, setNotificationsEnabled,
    autoSaveEnabled, setAutoSaveEnabled,
    confirmBeforeDelete, setConfirmBeforeDelete,
    defaultViewMode, setDefaultViewMode,
    language, setLanguage,
    themePreferences, updateThemePreferences, handleCustomColorsToggle,
    // File Mapper
    mapperShowFileSizes, setMapperShowFileSizes,
    mapperShowFileCounts, setMapperShowFileCounts,
    mapperMaxDepth, setMapperMaxDepth,
    mapperVisualizationStyle, setMapperVisualizationStyle,
    // File Copy
    copyConflictResolution, setCopyConflictResolution,
    copyPreserveStructure, setCopyPreserveStructure,
    copyExcludeTemp, setCopyExcludeTemp,
    // Folder Creation
    folderDefaultSeparator, setFolderDefaultSeparator,
    folderAutoCreateStructure, setFolderAutoCreateStructure,
    // Empty Files
    emptyFilesDefaultExtensions, setEmptyFilesDefaultExtensions,
    emptyFilesUseNumbering, setEmptyFilesUseNumbering,
    emptyFilesDefaultCount, setEmptyFilesDefaultCount,
    // Terminal
    terminalTheme, setTerminalTheme,
    terminalFontSize, setTerminalFontSize,
    terminalScrollback, setTerminalScrollback,
    // Find & Replace
    findReplaceMatchCase, setFindReplaceMatchCase,
    findReplaceUseRegex, setFindReplaceUseRegex,
    findReplaceDefaultIncludePattern, setFindReplaceDefaultIncludePattern,
    // SQL Export
    sqlDefaultExportFolder, setSqlDefaultExportFolder,
    sqlDefaultBatchSize, setSqlDefaultBatchSize,
    sqlCsvDelimiter, setSqlCsvDelimiter,
    sqlCsvDelimiterIsCustom, setSqlCsvDelimiterIsCustom,
    sqlIncludeHeaders, setSqlIncludeHeaders,
    handleDelimiterSelect,
    // AI
    aiSettings, updateAiSettings,
    showAiSetupWizard, setShowAiSetupWizard,
    aiProvider, aiModel, aiCreativityLevel,
    aiEnableBackup, aiDryRunDefault, aiEnableHistory,
    aiAutoApproveThreshold, aiReasoningLive,
    setAiProvider, setAiModel, setAiCreativityLevel,
    setAiEnableBackup, setAiDryRunDefault, setAiEnableHistory,
    setAiAutoApproveThreshold, setAiReasoningLive,
    isAiProviderConfigured,
    // Handlers
    scrollToSection,
    handleExportSettings,
    handleImportSettings,
    handleResetDefaults,
    storageUsage,
    handleClearCache,
    appInfo,
  } = s;

  // When opened with initialSection (e.g. "Open AI Settings" from Tool Info), scroll to that section
  useEffect(() => {
    if (!initialSection || !onInitialSectionHandled) return;
    const id = setTimeout(() => {
      const element = sectionRefs.current[initialSection];
      if (element) {
        setActiveSection(initialSection);
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      onInitialSectionHandled();
    }, 100);
    return () => clearTimeout(id);
  }, [initialSection, onInitialSectionHandled, sectionRefs, setActiveSection]);

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SETTINGS_SECTIONS;
    const query = searchQuery.toLowerCase();
    return SETTINGS_SECTIONS.filter(
      (section) =>
        section.label.toLowerCase().includes(query) ||
        section.description.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  // Render Functions - Settings Sections
  // ============================================================================

  const renderAppearanceSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["appearance"] = el;
      }}
      id="appearance"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
              <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Theme</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Choose your preferred color scheme
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={themeMode === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => themeMode === "dark" && toggleTheme()}
                className="gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={themeMode === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => themeMode === "light" && toggleTheme()}
                className="gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
            </div>
          </div>

          <Separator />

          {/* Theme Presets */}
          <div className="space-y-4">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Theme Presets</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Pick an accent and surface base for the UI
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Accent
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={themePreferences.useCustomColors}
                      onClick={() =>
                        updateThemePreferences({ accentPreset: preset.id })
                      }
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                        themePreferences.accentPreset === preset.id
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50"
                      } ${themePreferences.useCustomColors ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full border border-black/10 accent-swatch accent-swatch-${preset.id}`}
                      />
                      <span className="truncate">{preset.name}</span>
                    </button>
                  ))}
                </div>
                {themePreferences.useCustomColors && (
                  <p className="text-xs text-slate-500">
                    Presets are disabled while custom colors are active.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Surface
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SURFACE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={themePreferences.useCustomColors}
                      onClick={() =>
                        updateThemePreferences({ surfacePreset: preset.id })
                      }
                      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition ${
                        themePreferences.surfacePreset === preset.id
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50"
                      } ${themePreferences.useCustomColors ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className="text-sm font-semibold">
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Typography */}
          <div className="space-y-4">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Typography</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Adjust font family and base scale
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Font Family
                </Label>
                <Select
                  value={themePreferences.fontFamily}
                  onValueChange={(value) =>
                    updateThemePreferences({
                      fontFamily: value as FontFamilyPreset,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILY_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  {FONT_FAMILY_PRESETS.find(
                    (preset) => preset.id === themePreferences.fontFamily,
                  )?.description || ""}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Size Scale
                </Label>
                <Select
                  value={themePreferences.fontScale}
                  onValueChange={(value) =>
                    updateThemePreferences({
                      fontScale: value as FontScalePreset,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select scale" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_SCALE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name} ({preset.description})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Custom Colors */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Custom Colors</Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Override theme colors with your own palette
                </p>
              </div>
              <Switch
                checked={themePreferences.useCustomColors}
                onCheckedChange={handleCustomColorsToggle}
              />
            </div>

            {themePreferences.useCustomColors && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Accent Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={themePreferences.customAccent}
                      onChange={(e) =>
                        updateThemePreferences({
                          customAccent: e.target.value,
                        })
                      }
                      className="h-10 w-14 p-1"
                    />
                    <Input
                      type="text"
                      value={themePreferences.customAccent}
                      onChange={(e) =>
                        updateThemePreferences({
                          customAccent: e.target.value,
                        })
                      }
                      className="h-10 w-28 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Background Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={themePreferences.customBackground}
                      onChange={(e) =>
                        updateThemePreferences({
                          customBackground: e.target.value,
                        })
                      }
                      className="h-10 w-14 p-1"
                    />
                    <Input
                      type="text"
                      value={themePreferences.customBackground}
                      onChange={(e) =>
                        updateThemePreferences({
                          customBackground: e.target.value,
                        })
                      }
                      className="h-10 w-28 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Language Selection */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Language</Label>
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
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Panel Configuration Link */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">
                Panel Configuration
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Customize workspace layout and panel visibility
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onNavigateToPanelConfig}
              className="gap-2"
            >
              <Layout className="h-4 w-4" />
              Open Panel Config
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderGeneralSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["general"] = el;
      }}
      id="general"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-green-500/20 to-emerald-500/20 rounded-xl">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle>General</CardTitle>
              <CardDescription>
                Configure general application settings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="auto-save" className="text-base font-medium">
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
              <Label className="text-base font-medium">Default View Mode</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Choose the default view for file listings
              </p>
            </div>
            <Select value={defaultViewMode} onValueChange={setDefaultViewMode}>
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
    </div>
  );

  const renderFileMapperSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["file-mapper"] = el;
      }}
      id="file-mapper"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-orange-500/20 to-amber-500/20 rounded-xl">
              <FolderTree className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle>File Mapper</CardTitle>
              <CardDescription>
                Configure file mapping and visualization preferences
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">Show File Sizes</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Display file sizes in the mapper view
              </p>
            </div>
            <Switch
              checked={mapperShowFileSizes}
              onCheckedChange={setMapperShowFileSizes}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">Show File Counts</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Display file counts in directories
              </p>
            </div>
            <Switch
              checked={mapperShowFileCounts}
              onCheckedChange={setMapperShowFileCounts}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Max Depth</Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Maximum directory depth to display
                </p>
              </div>
              <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                {mapperMaxDepth} levels
              </span>
            </div>
            <Slider
              value={[mapperMaxDepth]}
              onValueChange={([value]) => setMapperMaxDepth(value)}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFileCopySection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["file-copy"] = el;
      }}
      id="file-copy"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-cyan-500/20 to-teal-500/20 rounded-xl">
              <Copy className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <CardTitle>File Copy</CardTitle>
              <CardDescription>
                Configure file copy and move operations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
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
              <Label className="text-base font-medium">
                Preserve Directory Structure
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Maintain folder hierarchy when copying
              </p>
            </div>
            <Switch
              checked={copyPreserveStructure}
              onCheckedChange={setCopyPreserveStructure}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">
                Exclude Temp Files
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Automatically exclude temporary files
              </p>
            </div>
            <Switch
              checked={copyExcludeTemp}
              onCheckedChange={setCopyExcludeTemp}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFolderCreationSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["folder-creation"] = el;
      }}
      id="folder-creation"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-yellow-500/20 to-orange-500/20 rounded-xl">
              <FolderPlus className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <CardTitle>Folder Creation</CardTitle>
              <CardDescription>
                Configure folder creation defaults
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Default Separator</Label>
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
              <Label className="text-base font-medium">
                Auto-Create Structure
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Automatically create nested folder structure
              </p>
            </div>
            <Switch
              checked={folderAutoCreateStructure}
              onCheckedChange={setFolderAutoCreateStructure}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderEmptyFilesSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["empty-files"] = el;
      }}
      id="empty-files"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-pink-500/20 to-rose-500/20 rounded-xl">
              <FilePlus className="h-5 w-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <CardTitle>Empty Files</CardTitle>
              <CardDescription>
                Configure empty file generation defaults
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Default Extensions
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Comma-separated default file extensions
              </p>
            </div>
            <Input
              value={emptyFilesDefaultExtensions}
              onChange={(e) => setEmptyFilesDefaultExtensions(e.target.value)}
              placeholder="txt,md,json"
              className="w-[180px]"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">Use Numbering</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enable automatic file numbering by default
              </p>
            </div>
            <Switch
              checked={emptyFilesUseNumbering}
              onCheckedChange={setEmptyFilesUseNumbering}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Default Count</Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Default number of files to generate
                </p>
              </div>
              <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                {emptyFilesDefaultCount} files
              </span>
            </div>
            <Slider
              value={[emptyFilesDefaultCount]}
              onValueChange={([value]) => setEmptyFilesDefaultCount(value)}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTerminalSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["terminal"] = el;
      }}
      id="terminal"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-slate-500/20 to-gray-500/20 rounded-xl">
              <Terminal className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle>Terminal</CardTitle>
              <CardDescription>
                Configure terminal appearance and behavior
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Theme</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Terminal color theme
              </p>
            </div>
            <Select value={terminalTheme} onValueChange={setTerminalTheme}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="monokai">Monokai</SelectItem>
                <SelectItem value="solarized">Solarized</SelectItem>
                <SelectItem value="dracula">Dracula</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Font Size</Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Terminal font size in pixels
                </p>
              </div>
              <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                {terminalFontSize}px
              </span>
            </div>
            <Slider
              value={[terminalFontSize]}
              onValueChange={([value]) => setTerminalFontSize(value)}
              min={8}
              max={24}
              step={1}
              className="w-full"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">
                  Scrollback Lines
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Number of lines to keep in history
                </p>
              </div>
              <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                {terminalScrollback.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[terminalScrollback]}
              onValueChange={([value]) => setTerminalScrollback(value)}
              min={100}
              max={10000}
              step={100}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFindReplaceSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["find-replace"] = el;
      }}
      id="find-replace"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-indigo-500/20 to-violet-500/20 rounded-xl">
              <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle>Find & Replace</CardTitle>
              <CardDescription>
                Configure search and replace defaults
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">Match Case</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Case-sensitive search by default
              </p>
            </div>
            <Switch
              checked={findReplaceMatchCase}
              onCheckedChange={setFindReplaceMatchCase}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">Use Regex</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enable regular expressions by default
              </p>
            </div>
            <Switch
              checked={findReplaceUseRegex}
              onCheckedChange={setFindReplaceUseRegex}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Default Include Pattern
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Default file pattern to search
              </p>
            </div>
            <Input
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
    </div>
  );

  const renderSqlExportSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["sql-export"] = el;
      }}
      id="sql-export"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-emerald-500/20 to-green-500/20 rounded-xl">
              <Database className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle>SQL Export Wizard</CardTitle>
              <CardDescription>
                Configure SQL export and import defaults
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Default Export Folder
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Default destination for exports
              </p>
            </div>
            <Input
              value={sqlDefaultExportFolder}
              onChange={(e) => setSqlDefaultExportFolder(e.target.value)}
              placeholder="/path/to/exports"
              className="w-[250px]"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">
                  Default Batch Size
                </Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Number of rows per batch
                </p>
              </div>
              <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                {sqlDefaultBatchSize.toLocaleString()} rows
              </span>
            </div>
            <Slider
              value={[sqlDefaultBatchSize]}
              onValueChange={([value]) => setSqlDefaultBatchSize(value)}
              min={100}
              max={10000}
              step={100}
              className="w-full"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">CSV Delimiter</Label>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Default delimiter for CSV exports
                </p>
              </div>
              <Select
                value={sqlCsvDelimiterIsCustom ? "custom" : sqlCsvDelimiter}
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
            {sqlCsvDelimiterIsCustom && (
              <div className="flex justify-end">
                <div className="flex flex-col gap-1.5 w-[180px]">
                  <Input
                    value={sqlCsvDelimiter}
                    onChange={(e) => setSqlCsvDelimiter(e.target.value)}
                    placeholder="Enter custom delimiter"
                    maxLength={10}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter delimiter (e.g., \t for tab)
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">Include Headers</Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Include column headers in exports by default
              </p>
            </div>
            <Switch
              checked={sqlIncludeHeaders}
              onCheckedChange={setSqlIncludeHeaders}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAIAssistantSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["ai-assistant"] = el;
      }}
      id="ai-assistant"
      className="scroll-mt-6"
    >
      {/* Setup Wizard Modal */}
      {showAiSetupWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <AIProviderSetupWizard
              settings={aiSettings}
              onUpdate={updateAiSettings}
              onComplete={() => {
                setShowAiSetupWizard(false);
                markSetupCompleted();
                showToast("AI provider configured successfully!", "success");
              }}
              onSkip={() => setShowAiSetupWizard(false)}
            />
          </div>
        </div>
      )}

      <Card className="glass-card overflow-hidden">
        <CardHeader className="bg-linear-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 dark:from-violet-500/20 dark:via-purple-500/20 dark:to-fuchsia-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-xl">
                <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle>AI Assistant</CardTitle>
                <CardDescription>
                  Configure AI-powered file management
                </CardDescription>
              </div>
            </div>
            {/* Connection Status Badge */}
            <div className="flex items-center gap-2">
              {isAiProviderConfigured ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Setup Required
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Setup Required Banner */}
          {!isAiProviderConfigured && (
            <div className="p-4 rounded-xl bg-linear-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
                  <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-violet-900 dark:text-violet-100 mb-1">
                    Get Started with AI
                  </h4>
                  <p className="text-sm text-violet-700 dark:text-violet-300 mb-3">
                    {aiProvider === "ollama"
                      ? "Install Ollama and pull a model to start using AI features locally."
                      : aiProvider === "openrouter"
                      ? "Add your OpenRouter API key to access 100+ AI models."
                      : "Add your Anthropic API key to use Claude AI."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => setShowAiSetupWizard(true)}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      Setup Wizard
                    </Button>
                    {getProviderHelpUrl(aiProvider as any) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                        onClick={() =>
                          window.open(
                            getProviderHelpUrl(aiProvider as any),
                            "_blank",
                          )
                        }
                      >
                        <ExternalLink className="h-4 w-4 mr-1.5" />
                        Get Help
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Provider Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              AI Provider
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {/* Anthropic */}
              <button
                onClick={() => setAiProvider("anthropic")}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  aiProvider === "anthropic"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 shadow-lg shadow-violet-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 bg-white dark:bg-slate-800"
                }`}
              >
                {aiProvider === "anthropic" && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-violet-500" />
                )}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      aiProvider === "anthropic"
                        ? "bg-violet-100 dark:bg-violet-800"
                        : "bg-slate-100 dark:bg-slate-700"
                    }`}
                  >
                    <Brain
                      className={`h-5 w-5 ${
                        aiProvider === "anthropic"
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      aiProvider === "anthropic"
                        ? "text-violet-700 dark:text-violet-300"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Anthropic
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Claude Models
                  </span>
                </div>
              </button>

              {/* OpenRouter */}
              <button
                onClick={() => setAiProvider("openrouter")}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  aiProvider === "openrouter"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg shadow-blue-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-800"
                }`}
              >
                {aiProvider === "openrouter" && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-blue-500" />
                )}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      aiProvider === "openrouter"
                        ? "bg-blue-100 dark:bg-blue-800"
                        : "bg-slate-100 dark:bg-slate-700"
                    }`}
                  >
                    <Globe
                      className={`h-5 w-5 ${
                        aiProvider === "openrouter"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      aiProvider === "openrouter"
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    OpenRouter
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    100+ Models
                  </span>
                </div>
              </button>

              {/* Ollama */}
              <button
                onClick={() => setAiProvider("ollama")}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  aiProvider === "ollama"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/30 shadow-lg shadow-green-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700 bg-white dark:bg-slate-800"
                }`}
              >
                {aiProvider === "ollama" && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-green-500" />
                )}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      aiProvider === "ollama"
                        ? "bg-green-100 dark:bg-green-800"
                        : "bg-slate-100 dark:bg-slate-700"
                    }`}
                  >
                    <Server
                      className={`h-5 w-5 ${
                        aiProvider === "ollama"
                          ? "text-green-600 dark:text-green-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      aiProvider === "ollama"
                        ? "text-green-700 dark:text-green-300"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Ollama
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Local LLM
                  </span>
                </div>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              {aiProvider === "anthropic" && "Requires Anthropic API key"}
              {aiProvider === "openrouter" &&
                "Access 100+ models with one API key"}
              {aiProvider === "ollama" && "Run AI locally - no API key needed"}
            </p>
          </div>

          <Separator />

          {/* Model Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              AI Model
            </Label>

            {aiProvider === "anthropic" && (
              <div className="grid gap-2">
                {[
                  {
                    value: "claude-sonnet",
                    name: "Claude Sonnet 4.5",
                    desc: "Best balance of speed & quality",
                    badge: "Recommended",
                    badgeColor:
                      "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
                  },
                  {
                    value: "claude-opus",
                    name: "Claude Opus 4.5",
                    desc: "Most capable for complex tasks",
                    badge: "Powerful",
                    badgeColor:
                      "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
                  },
                  {
                    value: "claude-haiku",
                    name: "Claude Haiku 4.5",
                    desc: "Fastest responses",
                    badge: "Fast",
                    badgeColor:
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
                  },
                ].map((model) => (
                  <button
                    key={model.value}
                    onClick={() => setAiModel(model.value)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      aiModel === model.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          aiModel === model.value
                            ? "bg-violet-500"
                            : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      />
                      <div className="text-left">
                        <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {model.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {model.desc}
                        </div>
                      </div>
                    </div>
                    <Badge className={model.badgeColor}>{model.badge}</Badge>
                  </button>
                ))}
              </div>
            )}

            {aiProvider === "openrouter" && (
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    OpenRouter Multi-Model
                  </span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Access Claude, GPT-4, Gemini, Llama, Mistral, and more through
                  one API.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Claude 3.5",
                    "GPT-4o",
                    "Gemini Pro",
                    "Llama 3.1",
                    "Mixtral",
                  ].map((m) => (
                    <Badge
                      key={m}
                      variant="secondary"
                      className="bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300"
                    >
                      {m}
                    </Badge>
                  ))}
                  <Badge
                    variant="secondary"
                    className="bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-200"
                  >
                    +100 more
                  </Badge>
                </div>
              </div>
            )}

            {aiProvider === "ollama" && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-green-900 dark:text-green-100">
                    Local AI
                  </span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  Run AI models locally on your machine. No data leaves your
                  computer.
                </p>
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Private & Secure</span>
                  <span className="text-green-400 dark:text-green-600">•</span>
                  <span>No API costs</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Creativity Level */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Response Style
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  value: "conservative",
                  label: "Precise",
                  desc: "Focused & accurate",
                },
                { value: "balanced", label: "Balanced", desc: "Best of both" },
                {
                  value: "creative",
                  label: "Creative",
                  desc: "Innovative ideas",
                },
              ].map((level) => (
                <button
                  key={level.value}
                  onClick={() => setAiCreativityLevel(level.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    aiCreativityLevel === level.value
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div
                    className={`text-sm font-medium ${
                      aiCreativityLevel === level.value
                        ? "text-violet-700 dark:text-violet-300"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {level.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {level.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Safety & Behavior Settings */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Safety & Behavior
            </Label>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/50">
                    <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">
                      Preview Mode
                    </Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Show changes before executing
                    </p>
                  </div>
                </div>
                <Switch
                  checked={aiDryRunDefault}
                  onCheckedChange={setAiDryRunDefault}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/50">
                    <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">
                      Auto-Backup
                    </Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Create backups before changes
                    </p>
                  </div>
                </div>
                <Switch
                  checked={aiEnableBackup}
                  onCheckedChange={setAiEnableBackup}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/50">
                    <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">
                      Operation History
                    </Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Track changes for undo/redo
                    </p>
                  </div>
                </div>
                <Switch
                  checked={aiEnableHistory}
                  onCheckedChange={setAiEnableHistory}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50">
                    <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">
                      Reasoning Live
                    </Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Show live reasoning while processing
                    </p>
                  </div>
                </div>
                <Switch
                  checked={aiReasoningLive}
                  onCheckedChange={setAiReasoningLive}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Auto-Approve Threshold */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Auto-Approve Threshold
              </Label>
              <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                {aiAutoApproveThreshold} files
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatically approve operations affecting fewer files
            </p>
            <Slider
              value={[aiAutoApproveThreshold]}
              onValueChange={([value]) => setAiAutoApproveThreshold(value)}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>1 file</span>
              <span>50 files</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderKeyboardSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["keyboard"] = el;
      }}
      id="keyboard"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
              <Keyboard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle>Keyboard Shortcuts</CardTitle>
              <CardDescription>
                View and customize keyboard shortcuts
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <MonitorSmartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Showing shortcuts for {isMac ? "macOS" : "Windows/Linux"}
            </span>
          </div>

          {KEYBOARD_SHORTCUTS.map((category) => (
            <div key={category.category} className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                {category.category === "Navigation" && (
                  <MousePointer className="h-4 w-4" />
                )}
                {category.category === "File Operations" && (
                  <FileText className="h-4 w-4" />
                )}
                {category.category === "AI Assistant" && (
                  <Sparkles className="h-4 w-4" />
                )}
                {category.category}
              </h4>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {shortcut.action}
                    </span>
                    <div className="flex items-center gap-1">
                      {(isMac ? shortcut.keys : shortcut.windowsKeys).map(
                        (key, index) => (
                          <span key={index}>
                            <kbd className="px-2 py-1 text-xs font-mono bg-slate-200 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 shadow-sm">
                              {key}
                            </kbd>
                            {index <
                              (isMac ? shortcut.keys : shortcut.windowsKeys)
                                .length -
                                1 && (
                              <span className="mx-0.5 text-slate-400">+</span>
                            )}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderNotificationsSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["notifications"] = el;
      }}
      id="notifications"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-amber-500/20 to-yellow-500/20 rounded-xl">
              <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Manage notification preferences</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">
                Enable Notifications
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Receive notifications for important events
              </p>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSafetySection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["safety"] = el;
      }}
      id="safety"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-red-500/20 to-orange-500/20 rounded-xl">
              <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <CardTitle>Safety</CardTitle>
              <CardDescription>
                Configure safety and confirmation settings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label className="text-base font-medium">
                Confirm Before Delete
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Ask for confirmation before deleting files or folders
              </p>
            </div>
            <Switch
              checked={confirmBeforeDelete}
              onCheckedChange={setConfirmBeforeDelete}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStorageSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["storage"] = el;
      }}
      id="storage"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-teal-500/20 to-cyan-500/20 rounded-xl">
              <HardDrive className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <CardTitle>Storage & Data</CardTitle>
              <CardDescription>
                Manage application data and storage
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Storage Usage */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Storage Usage
            </Label>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Local Storage Used
                </span>
                <span className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100">
                  {storageUsage.usedFormatted}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Items Stored
                </span>
                <span className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100">
                  {storageUsage.itemCount} items
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Import/Export Settings */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Settings Backup
            </Label>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleExportSettings}
              >
                <Download className="h-4 w-4" />
                Export Settings
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleImportSettings}
              >
                <Upload className="h-4 w-4" />
                Import Settings
              </Button>
            </div>
          </div>

          <Separator />

          {/* Data Management */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Data Management
            </Label>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleClearCache}
              >
                <RefreshCw className="h-4 w-4" />
                Clear Cache
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={handleResetDefaults}
              >
                <RotateCcw className="h-4 w-4" />
                Reset All Settings to Defaults
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAboutSection = () => (
    <div
      ref={(el) => {
        sectionRefs.current["about"] = el;
      }}
      id="about"
      className="scroll-mt-6"
    >
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-slate-500/20 to-gray-500/20 rounded-xl">
              <Info className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle>About</CardTitle>
              <CardDescription>Application information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-linear-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 border border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/logo.png"
                alt="File Pro"
                className="h-12 w-12 rounded-xl shadow-lg"
              />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  File Pro
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Professional File Management
                </p>
              </div>
            </div>
          </div>


          <UpdateCheckRow />

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Version
              </span>
              <Badge variant="secondary">{appInfo.version}</Badge>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Build
              </span>
              <Badge variant="secondary">{appInfo.build}</Badge>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Platform
              </span>
              <Badge variant="secondary">Tauri + React</Badge>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                License
              </span>
              <Badge variant="secondary">{appInfo.license}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="flex flex-col h-full glass rounded-2xl shadow-xl overflow-hidden relative min-h-0">
      <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 pointer-events-none" />

      {/* Header - consistent with other pages */}
      <div className="relative z-10 shrink-0">
        <PageHeader
          icon={SettingsIcon}
          title="Settings"
          subtitle="Manage your application preferences"
          info={settingsInfo}
          right={
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Main Content with Sidebar */}
      <div className="relative z-10 flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-64 border-r border-slate-200/50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-800/20 overflow-y-auto shrink-0 hidden lg:block">
          <nav className="p-3 space-y-1">
            {filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  activeSection === section.id
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <span
                  className={
                    activeSection === section.id
                      ? "text-blue-600 dark:text-blue-400"
                      : ""
                  }
                >
                  {section.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium truncate ${
                      activeSection === section.id
                        ? "text-blue-700 dark:text-blue-300"
                        : ""
                    }`}
                  >
                    {section.label}
                  </div>
                </div>
                {activeSection === section.id && (
                  <ChevronRight className="h-4 w-4 text-blue-500" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
          <div className="max-w-3xl mx-auto space-y-6">
            <AnimatePresence mode="sync">
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "appearance")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  {renderAppearanceSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "general")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {renderGeneralSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "file-mapper")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {renderFileMapperSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "file-copy")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {renderFileCopySection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "folder-creation")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  {renderFolderCreationSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "empty-files")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {renderEmptyFilesSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "terminal")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  {renderTerminalSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "find-replace")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {renderFindReplaceSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "sql-export")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  {renderSqlExportSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "ai-assistant")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {renderAIAssistantSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "keyboard")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                >
                  {renderKeyboardSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "notifications")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  {renderNotificationsSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "safety")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                >
                  {renderSafetySection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "storage")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  {renderStorageSection()}
                </motion.div>
              )}
              {(searchQuery === "" ||
                filteredSections.some((s) => s.id === "about")) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 }}
                >
                  {renderAboutSection()}
                </motion.div>
              )}
            </AnimatePresence>

            {/* No Results Message */}
            {searchQuery && filteredSections.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Search className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400">
                  No settings found
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                  Try searching for something else
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
