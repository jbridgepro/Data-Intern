/**
 * File: src/features/settings/hooks/useSettingsState.ts
 *
 * Extracted from Settings.tsx — consolidates all settings state,
 * localStorage persistence, and related handlers into one hook.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    applyThemePreferences,
    loadThemePreferences,
    saveThemePreferences,
    type ThemePreferences,
} from "@/lib/themePreferences";
import { getName, getVersion } from "@tauri-apps/api/app";
import packageJson from "../../../../package.json";

// ============================================================================
// Types
// ============================================================================

export interface ToastMessage {
    id: number;
    message: string;
    type: "success" | "error" | "info";
}

// ============================================================================
// Hook
// ============================================================================

export function useSettingsState(themeMode: "light" | "dark") {
    // --------------------------------------------------------------------------
    // UI State
    // --------------------------------------------------------------------------
    const [activeSection, setActiveSection] = useState("appearance");
    const [searchQuery, setSearchQuery] = useState("");
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const isMac = useMemo(
        () => navigator.platform.toUpperCase().indexOf("MAC") >= 0,
        [],
    );

    // --------------------------------------------------------------------------
    // App Info
    // --------------------------------------------------------------------------
    const [appInfo, setAppInfo] = useState({
        version: "Loading...",
        name: "Loading...",
        license: (packageJson as any).license || "Unknown",
        build: import.meta.env.MODE === "development" ? "Development" : "Production",
    });

    useEffect(() => {
        const fetchAppInfo = async () => {
            try {
                const [v, n] = await Promise.all([getVersion(), getName()]);
                setAppInfo((prev) => ({ ...prev, version: v, name: n }));
            } catch (error) {
                console.error("Failed to fetch app info:", error);
                setAppInfo((prev) => ({
                    ...prev,
                    version: packageJson.version,
                    name: packageJson.name,
                }));
            }
        };
        fetchAppInfo();
    }, []);

    // --------------------------------------------------------------------------
    // General Settings
    // --------------------------------------------------------------------------
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

    const [themePreferences, setThemePreferences] = useState(() =>
        loadThemePreferences(),
    );

    // --------------------------------------------------------------------------
    // File Mapper Settings
    // --------------------------------------------------------------------------
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

    // --------------------------------------------------------------------------
    // File Copy Settings
    // --------------------------------------------------------------------------
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

    // --------------------------------------------------------------------------
    // Folder Creation Settings
    // --------------------------------------------------------------------------
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

    // --------------------------------------------------------------------------
    // Empty Files Settings
    // --------------------------------------------------------------------------
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

    // --------------------------------------------------------------------------
    // Terminal Settings
    // --------------------------------------------------------------------------
    const [terminalTheme, setTerminalTheme] = useState(() => {
        const saved = localStorage.getItem("terminal-theme");
        return saved || "default";
    });

    const [terminalFontSize, setTerminalFontSize] = useState(() => {
        const saved = localStorage.getItem("terminal-font-size");
        return saved ? parseInt(saved) : 14;
    });

    const [terminalScrollback, setTerminalScrollback] = useState(() => {
        const saved = localStorage.getItem("terminal-scrollback");
        return saved ? parseInt(saved) : 1000;
    });

    // --------------------------------------------------------------------------
    // Find & Replace Settings
    // --------------------------------------------------------------------------
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

    // --------------------------------------------------------------------------
    // SQL Export Wizard Settings
    // --------------------------------------------------------------------------
    const [sqlDefaultExportFolder, setSqlDefaultExportFolder] = useState(() => {
        const saved = localStorage.getItem("sql-default-export-folder");
        return saved || "";
    });

    const [sqlDefaultBatchSize, setSqlDefaultBatchSize] = useState(() => {
        const saved = localStorage.getItem("sql-default-batch-size");
        return saved ? parseInt(saved) : 1000;
    });

    const [sqlCsvDelimiter, setSqlCsvDelimiter] = useState(() => {
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
        const saved = localStorage.getItem("sql-csv-delimiter");
        return saved || ",";
    });

    const [sqlCsvDelimiterIsCustom, setSqlCsvDelimiterIsCustom] = useState(() => {
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

    // --------------------------------------------------------------------------
    // AI Assistant Settings
    // --------------------------------------------------------------------------
    const [aiSettings, setAiSettings] = useState(() => {
        try {
            const saved = localStorage.getItem("ai-assistant-settings");
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error("Failed to load AI settings:", error);
        }
        return {
            provider: "anthropic",
            model: "claude-sonnet",
            creativityLevel: "balanced",
            autoApproveThreshold: 50,
            enableBackup: true,
            dryRunDefault: false,
            excludedFolders: [],
            ollamaBaseUrl: "http://localhost:11434",
            ollamaModel: "llama3.2:3b",
            maxTokens: 4096,
            clawdbotEnabled: false,
            reasoningLive: true,
        };
    });

    const [showAiSetupWizard, setShowAiSetupWizard] = useState(false);

    // Derived AI values
    const aiProvider = aiSettings.provider || "anthropic";
    const aiModel = aiSettings.model || "claude-sonnet";
    const aiCreativityLevel = aiSettings.creativityLevel || "balanced";
    const aiEnableBackup = aiSettings.enableBackup !== false;
    const aiDryRunDefault = aiSettings.dryRunDefault === true;
    const aiEnableHistory = aiSettings.operationHistory?.enabled !== false;
    const aiAutoApproveThreshold = aiSettings.autoApproveThreshold || 50;
    const aiReasoningLive = aiSettings.reasoningLive !== false;

    // AI settings updater
    const updateAiSettings = useCallback((updates: Record<string, any>) => {
        setAiSettings((prev: Record<string, any>) => {
            const updated = { ...prev, ...updates };
            localStorage.setItem("ai-assistant-settings", JSON.stringify(updated));
            return updated;
        });
        setHasChanges(true);
    }, []);

    // Individual AI setters
    const setAiProvider = useCallback(
        (value: string) => updateAiSettings({ provider: value }),
        [updateAiSettings],
    );
    const setAiModel = useCallback(
        (value: string) => updateAiSettings({ model: value }),
        [updateAiSettings],
    );
    const setAiCreativityLevel = useCallback(
        (value: string) => updateAiSettings({ creativityLevel: value }),
        [updateAiSettings],
    );
    const setAiEnableBackup = useCallback(
        (value: boolean) => updateAiSettings({ enableBackup: value }),
        [updateAiSettings],
    );
    const setAiDryRunDefault = useCallback(
        (value: boolean) => updateAiSettings({ dryRunDefault: value }),
        [updateAiSettings],
    );
    const setAiEnableHistory = useCallback(
        (value: boolean) => {
            updateAiSettings({
                operationHistory: {
                    ...aiSettings.operationHistory,
                    enabled: value,
                },
            });
        },
        [updateAiSettings, aiSettings.operationHistory],
    );
    const setAiAutoApproveThreshold = useCallback(
        (value: number) => updateAiSettings({ autoApproveThreshold: value }),
        [updateAiSettings],
    );
    const setAiReasoningLive = useCallback(
        (value: boolean) => updateAiSettings({ reasoningLive: value }),
        [updateAiSettings],
    );

    const isAiProviderConfigured = useMemo(() => {
        if (aiProvider === "ollama") {
            return !!aiSettings.ollamaModel;
        } else if (aiProvider === "openrouter") {
            return !!aiSettings.openRouter?.apiKey;
        } else if (aiProvider === "anthropic") {
            return !!aiSettings.apiKey;
        }
        return false;
    }, [aiProvider, aiSettings]);

    // --------------------------------------------------------------------------
    // Toast system
    // --------------------------------------------------------------------------
    const showToast = useCallback(
        (message: string, type: "success" | "error" | "info" = "success") => {
            const id = Date.now();
            setToasts((prev) => [...prev, { id, message, type }]);
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, 3000);
        },
        [],
    );

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // --------------------------------------------------------------------------
    // localStorage sync effects
    // --------------------------------------------------------------------------
    useEffect(() => {
        setHasChanges(true);
    }, [
        notificationsEnabled, autoSaveEnabled, confirmBeforeDelete,
        defaultViewMode, language, themePreferences,
        mapperShowFileSizes, mapperShowFileCounts, mapperMaxDepth, mapperVisualizationStyle,
        copyConflictResolution, copyPreserveStructure, copyExcludeTemp,
        folderDefaultSeparator, folderAutoCreateStructure,
        emptyFilesDefaultExtensions, emptyFilesUseNumbering, emptyFilesDefaultCount,
        terminalTheme, terminalFontSize, terminalScrollback,
        findReplaceMatchCase, findReplaceUseRegex, findReplaceDefaultIncludePattern,
        sqlDefaultExportFolder, sqlDefaultBatchSize, sqlCsvDelimiter, sqlIncludeHeaders,
        aiProvider, aiModel, aiCreativityLevel, aiEnableBackup,
        aiDryRunDefault, aiEnableHistory, aiAutoApproveThreshold, aiReasoningLive,
    ]);

    useEffect(() => { localStorage.setItem("notifications-enabled", notificationsEnabled.toString()); }, [notificationsEnabled]);
    useEffect(() => { localStorage.setItem("auto-save-enabled", autoSaveEnabled.toString()); }, [autoSaveEnabled]);
    useEffect(() => { localStorage.setItem("confirm-before-delete", confirmBeforeDelete.toString()); }, [confirmBeforeDelete]);
    useEffect(() => { localStorage.setItem("default-view-mode", defaultViewMode); }, [defaultViewMode]);
    useEffect(() => { localStorage.setItem("language", language); }, [language]);
    useEffect(() => { saveThemePreferences(themePreferences); applyThemePreferences(themePreferences); }, [themePreferences]);
    useEffect(() => { localStorage.setItem("mapper-show-file-sizes", mapperShowFileSizes.toString()); }, [mapperShowFileSizes]);
    useEffect(() => { localStorage.setItem("mapper-show-file-counts", mapperShowFileCounts.toString()); }, [mapperShowFileCounts]);
    useEffect(() => { localStorage.setItem("mapper-max-depth", mapperMaxDepth.toString()); }, [mapperMaxDepth]);
    useEffect(() => { localStorage.setItem("mapper-visualization-style", mapperVisualizationStyle); }, [mapperVisualizationStyle]);
    useEffect(() => { localStorage.setItem("copy-conflict-resolution", copyConflictResolution); }, [copyConflictResolution]);
    useEffect(() => { localStorage.setItem("copy-preserve-structure", copyPreserveStructure.toString()); }, [copyPreserveStructure]);
    useEffect(() => { localStorage.setItem("copy-exclude-temp", copyExcludeTemp.toString()); }, [copyExcludeTemp]);
    useEffect(() => { localStorage.setItem("folder-default-separator", folderDefaultSeparator); }, [folderDefaultSeparator]);
    useEffect(() => { localStorage.setItem("folder-auto-create-structure", folderAutoCreateStructure.toString()); }, [folderAutoCreateStructure]);
    useEffect(() => { localStorage.setItem("empty-files-default-extensions", emptyFilesDefaultExtensions); }, [emptyFilesDefaultExtensions]);
    useEffect(() => { localStorage.setItem("empty-files-use-numbering", emptyFilesUseNumbering.toString()); }, [emptyFilesUseNumbering]);
    useEffect(() => { localStorage.setItem("empty-files-default-count", emptyFilesDefaultCount.toString()); }, [emptyFilesDefaultCount]);
    useEffect(() => { localStorage.setItem("terminal-theme", terminalTheme); }, [terminalTheme]);
    useEffect(() => { localStorage.setItem("terminal-font-size", terminalFontSize.toString()); }, [terminalFontSize]);
    useEffect(() => { localStorage.setItem("terminal-scrollback", terminalScrollback.toString()); }, [terminalScrollback]);
    useEffect(() => { localStorage.setItem("find-replace-match-case", findReplaceMatchCase.toString()); }, [findReplaceMatchCase]);
    useEffect(() => { localStorage.setItem("find-replace-use-regex", findReplaceUseRegex.toString()); }, [findReplaceUseRegex]);
    useEffect(() => { localStorage.setItem("find-replace-default-include-pattern", findReplaceDefaultIncludePattern); }, [findReplaceDefaultIncludePattern]);
    useEffect(() => { localStorage.setItem("sql-default-export-folder", sqlDefaultExportFolder); }, [sqlDefaultExportFolder]);
    useEffect(() => { localStorage.setItem("sql-default-batch-size", sqlDefaultBatchSize.toString()); }, [sqlDefaultBatchSize]);

    useEffect(() => {
        localStorage.setItem("sql-csv-delimiter", sqlCsvDelimiter);
        const commonDelimiters = [",", ";", "\t", "|"];
        setSqlCsvDelimiterIsCustom(!commonDelimiters.includes(sqlCsvDelimiter));
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

    useEffect(() => { localStorage.setItem("sql-include-headers", sqlIncludeHeaders.toString()); }, [sqlIncludeHeaders]);

    // --------------------------------------------------------------------------
    // Handlers
    // --------------------------------------------------------------------------
    const handleDelimiterSelect = (value: string) => {
        if (value === "custom") {
            setSqlCsvDelimiterIsCustom(true);
            if (!sqlCsvDelimiter || [",", ";", "\t", "|"].includes(sqlCsvDelimiter)) {
                setSqlCsvDelimiter("");
            }
        } else {
            setSqlCsvDelimiterIsCustom(false);
            setSqlCsvDelimiter(value);
        }
    };

    const scrollToSection = useCallback((sectionId: string) => {
        setActiveSection(sectionId);
        const element = sectionRefs.current[sectionId];
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, []);

    const handleExportSettings = useCallback(() => {
        const settings: Record<string, string | null> = {};
        const settingsKeys = [
            "notifications-enabled", "auto-save-enabled", "confirm-before-delete",
            "default-view-mode", "language",
            "mapper-show-file-sizes", "mapper-show-file-counts", "mapper-max-depth", "mapper-visualization-style",
            "copy-conflict-resolution", "copy-preserve-structure", "copy-exclude-temp",
            "folder-default-separator", "folder-auto-create-structure",
            "empty-files-default-extensions", "empty-files-use-numbering", "empty-files-default-count",
            "terminal-theme", "terminal-font-size", "terminal-scrollback",
            "find-replace-match-case", "find-replace-use-regex", "find-replace-default-include-pattern",
            "sql-default-export-folder", "sql-default-batch-size", "sql-csv-delimiter", "sql-include-headers",
            "ai-assistant-settings", "theme-mode",
        ];
        settingsKeys.forEach((key) => { settings[key] = localStorage.getItem(key); });
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `file-pro-settings-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Settings exported successfully!", "success");
    }, [showToast]);

    const handleImportSettings = useCallback(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    const text = await file.text();
                    const settings = JSON.parse(text);
                    Object.entries(settings).forEach(([key, value]) => {
                        if (value !== null) {
                            localStorage.setItem(key, value as string);
                        }
                    });
                    showToast("Settings imported! Please refresh to apply all changes.", "success");
                    setTimeout(() => window.location.reload(), 1500);
                } catch (error) {
                    showToast("Failed to import settings. Invalid file format.", "error");
                }
            }
        };
        input.click();
    }, [showToast]);

    const handleResetDefaults = useCallback(() => {
        if (
            confirm(
                "Are you sure you want to reset all settings to defaults? This cannot be undone.",
            )
        ) {
            const settingsKeys = [
                "notifications-enabled", "auto-save-enabled", "confirm-before-delete",
                "default-view-mode", "language",
                "mapper-show-file-sizes", "mapper-show-file-counts", "mapper-max-depth", "mapper-visualization-style",
                "copy-conflict-resolution", "copy-preserve-structure", "copy-exclude-temp",
                "folder-default-separator", "folder-auto-create-structure",
                "empty-files-default-extensions", "empty-files-use-numbering", "empty-files-default-count",
                "terminal-theme", "terminal-font-size", "terminal-scrollback",
                "find-replace-match-case", "find-replace-use-regex", "find-replace-default-include-pattern",
                "sql-default-export-folder", "sql-default-batch-size", "sql-csv-delimiter", "sql-include-headers",
                "ai-assistant-settings", "ai-provider-setup-completed", "ai-provider-setup-skipped",
            ];
            settingsKeys.forEach((key) => localStorage.removeItem(key));
            showToast("Settings reset to defaults! Refreshing...", "success");
            setTimeout(() => window.location.reload(), 1500);
        }
    }, [showToast]);

    const storageUsage = useMemo(() => {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key) || "";
                total += (key.length + value.length) * 2;
            }
        }
        return {
            used: total,
            usedFormatted:
                total < 1024
                    ? `${total} B`
                    : total < 1024 * 1024
                        ? `${(total / 1024).toFixed(1)} KB`
                        : `${(total / 1024 / 1024).toFixed(2)} MB`,
            itemCount: localStorage.length,
        };
    }, []);

    const handleClearCache = useCallback(() => {
        const cacheKeys = Array.from({ length: localStorage.length }, (_, i) =>
            localStorage.key(i),
        ).filter(
            (key): key is string =>
                key !== null && (key.includes("cache") || key.includes("temp")),
        );
        cacheKeys.forEach((key) => localStorage.removeItem(key));
        showToast(`Cleared ${cacheKeys.length} cached items`, "success");
    }, [showToast]);

    const updateThemePreferences = useCallback(
        (updates: Partial<ThemePreferences>) => {
            setThemePreferences((prev) => ({
                ...prev,
                ...updates,
            }));
        },
        [],
    );

    const handleCustomColorsToggle = useCallback(
        (enabled: boolean) => {
            setThemePreferences((prev) => {
                if (!enabled) {
                    return { ...prev, useCustomColors: false };
                }
                const defaultBackground =
                    themeMode === "dark" ? "#0f172a" : "#f8fafc";
                return {
                    ...prev,
                    useCustomColors: true,
                    customBackground: prev.customBackground || defaultBackground,
                    customAccent: prev.customAccent || "#3b82f6",
                };
            });
        },
        [themeMode],
    );

    // --------------------------------------------------------------------------
    // Return all state and handlers
    // --------------------------------------------------------------------------
    return {
        // UI state
        activeSection, setActiveSection,
        searchQuery, setSearchQuery,
        toasts, removeToast, showToast,
        isSaving, setIsSaving,
        hasChanges, setHasChanges,
        sectionRefs,
        isMac,

        // General
        notificationsEnabled, setNotificationsEnabled,
        autoSaveEnabled, setAutoSaveEnabled,
        confirmBeforeDelete, setConfirmBeforeDelete,
        defaultViewMode, setDefaultViewMode,
        language, setLanguage,
        themePreferences, setThemePreferences, updateThemePreferences, handleCustomColorsToggle,

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

        // AI Assistant
        aiSettings, setAiSettings, updateAiSettings,
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
    };
}
