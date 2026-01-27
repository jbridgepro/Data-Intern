/**
 * File: src/features/panel-configuration/contexts/PanelConfigurationContext.tsx
 * 
 * Context provider for sharing panel configuration state across the application.
 * Ensures consistent state between configuration UI and actual layout.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  PanelConfiguration,
  ViewMode,
  PanelVisibility,
  PanelPosition,
  PresetViewMode,
  CustomViewMode,
  PanelSizes,
  PanelId,
} from "../types";

/**
 * Default panel sizes configuration
 */
const DEFAULT_PANEL_SIZES: PanelSizes = {
  sidebar: { size: 256, minSize: 180, maxSize: 400, isMinimized: false },
  chat: { size: 320, minSize: 240, maxSize: 600, isMinimized: false },
  editors: { size: 256, minSize: 180, maxSize: 400, isMinimized: false },
  panel: { size: 256, minSize: 100, maxSize: 500, isMinimized: false },
  agents: { size: 320, minSize: 240, maxSize: 600, isMinimized: false },
};

/**
 * Default panel configuration values
 */
const DEFAULT_CONFIG: PanelConfiguration = {
  viewMode: "editor",
  customViewModes: [],
  visibility: {
    agents: true,
    chat: true,
    editors: true,
    panel: true,
    sidebar: true,
  },
  layout: {
    agentSidebarPosition: "right",
    showTitleBar: true,
    showStatusBar: true,
  },
  bottomPanelActiveTab: "terminal",
  panelSizes: DEFAULT_PANEL_SIZES,
};

/**
 * Storage key for persisting panel configuration
 */
const STORAGE_KEY = "panel-configuration";

/**
 * Interface for the context value
 */
interface PanelConfigurationContextType {
  configuration: PanelConfiguration;
  setViewMode: (mode: ViewMode) => void;
  togglePanelVisibility: (panel: keyof PanelVisibility) => void;
  setPanelVisibility: (panel: keyof PanelVisibility, visible: boolean) => void;
  setAgentSidebarPosition: (position: PanelPosition) => void;
  toggleTitleBar: () => void;
  toggleStatusBar: () => void;
  setBottomPanelTab: (tab: "terminal" | "problems" | "output") => void;
  saveCustomViewMode: (name: string) => void;
  deleteCustomViewMode: (id: string) => void;
  resetConfiguration: () => void;
  applyViewModePreset: (mode: ViewMode) => void;
  /** Set the size of a specific panel */
  setPanelSize: (panel: PanelId, size: number) => void;
  /** Toggle the minimized state of a specific panel */
  togglePanelMinimized: (panel: PanelId) => void;
  /** Set the minimized state of a specific panel */
  setPanelMinimized: (panel: PanelId, minimized: boolean) => void;
  /** Get the current size config for a panel */
  getPanelSizeConfig: (panel: PanelId) => { size: number; minSize: number; maxSize: number; isMinimized: boolean };
}

const PanelConfigurationContext = createContext<PanelConfigurationContextType | undefined>(undefined);

/**
 * Load panel configuration from localStorage
 */
const loadConfiguration = (): PanelConfiguration => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all properties exist
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        visibility: {
          ...DEFAULT_CONFIG.visibility,
          ...(parsed.visibility || {}),
        },
        layout: {
          ...DEFAULT_CONFIG.layout,
          ...(parsed.layout || {}),
        },
        customViewModes: parsed.customViewModes || [],
        panelSizes: {
          sidebar: { ...DEFAULT_PANEL_SIZES.sidebar, ...(parsed.panelSizes?.sidebar || {}) },
          chat: { ...DEFAULT_PANEL_SIZES.chat, ...(parsed.panelSizes?.chat || {}) },
          editors: { ...DEFAULT_PANEL_SIZES.editors, ...(parsed.panelSizes?.editors || {}) },
          panel: { ...DEFAULT_PANEL_SIZES.panel, ...(parsed.panelSizes?.panel || {}) },
          agents: { ...DEFAULT_PANEL_SIZES.agents, ...(parsed.panelSizes?.agents || {}) },
        },
      };
    }
  } catch (error) {
    console.error("Failed to load panel configuration:", error);
  }
  return DEFAULT_CONFIG;
};

/**
 * Save panel configuration to localStorage
 */
const saveConfiguration = (config: PanelConfiguration): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save panel configuration:", error);
  }
};

export const PanelConfigurationProvider = ({ children }: { children: ReactNode }) => {
  const [configuration, setConfiguration] = useState<PanelConfiguration>(
    loadConfiguration,
  );

  // Persist configuration changes to localStorage
  useEffect(() => {
    saveConfiguration(configuration);
  }, [configuration]);

  /**
   * Update the view mode
   */
  const setViewMode = useCallback((mode: ViewMode) => {
    setConfiguration((prev) => ({
      ...prev,
      viewMode: mode,
    }));
  }, []);

  /**
   * Toggle visibility of a specific panel
   */
  const togglePanelVisibility = useCallback(
    (panel: keyof PanelVisibility) => {
      setConfiguration((prev) => ({
        ...prev,
        visibility: {
          ...prev.visibility,
          [panel]: !prev.visibility[panel],
        },
      }));
    },
    [],
  );

  /**
   * Set visibility of a specific panel
   */
  const setPanelVisibility = useCallback(
    (panel: keyof PanelVisibility, visible: boolean) => {
      setConfiguration((prev) => ({
        ...prev,
        visibility: {
          ...prev.visibility,
          [panel]: visible,
        },
      }));
    },
    [],
  );

  /**
   * Update agent sidebar position
   */
  const setAgentSidebarPosition = useCallback((position: PanelPosition) => {
    setConfiguration((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        agentSidebarPosition: position,
      },
    }));
  }, []);

  /**
   * Toggle title bar visibility
   */
  const toggleTitleBar = useCallback(() => {
    setConfiguration((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        showTitleBar: !prev.layout.showTitleBar,
      },
    }));
  }, []);

  /**
   * Toggle status bar visibility
   */
  const toggleStatusBar = useCallback(() => {
    setConfiguration((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        showStatusBar: !prev.layout.showStatusBar,
      },
    }));
  }, []);

  /**
   * Set active tab for bottom panel
   */
  const setBottomPanelTab = useCallback((tab: "terminal" | "problems" | "output") => {
    setConfiguration((prev) => ({
      ...prev,
      bottomPanelActiveTab: tab,
    }));
  }, []);

  /**
   * Save current configuration as a custom view mode
   */
  const saveCustomViewMode = useCallback((name: string) => {
    const newMode: CustomViewMode = {
      id: crypto.randomUUID(),
      name,
      visibility: { ...configuration.visibility },
    };

    setConfiguration((prev) => ({
      ...prev,
      customViewModes: [...prev.customViewModes, newMode],
      viewMode: newMode.id,
    }));
  }, [configuration.visibility]);

  /**
   * Delete a custom view mode
   */
  const deleteCustomViewMode = useCallback((id: string) => {
    setConfiguration((prev) => {
      const newModes = prev.customViewModes.filter((mode) => mode.id !== id);
      // If currently using the deleted mode, switch to default
      const newViewMode = prev.viewMode === id ? "editor" : prev.viewMode;

      return {
        ...prev,
        customViewModes: newModes,
        viewMode: newViewMode,
      };
    });
  }, []);

  /**
   * Reset configuration to defaults
   */
  const resetConfiguration = useCallback(() => {
    setConfiguration(DEFAULT_CONFIG);
  }, []);

  /**
   * Apply view mode presets
   */
  const applyViewModePreset = useCallback((mode: ViewMode) => {
    const presets: Record<ViewMode, Partial<PanelVisibility>> = {
      agent: {
        agents: true,
        chat: true,
        editors: false,
        panel: true,
        sidebar: true,
      },
      editor: {
        agents: false,
        chat: false,
        editors: true,
        panel: true,
        sidebar: true,
      },
      zen: {
        agents: false,
        chat: false,
        editors: true,
        panel: false,
        sidebar: false,
      },
      browser: {
        agents: false,
        chat: false,
        editors: false,
        panel: true,
        sidebar: false,
      },
    };

    // Check if it's a custom mode
    const customMode = configuration.customViewModes.find((m) => m.id === mode);

    if (customMode) {
      setConfiguration((prev) => ({
        ...prev,
        viewMode: mode,
        visibility: { ...customMode.visibility },
      }));
      return;
    }

    // Default presets
    setConfiguration((prev) => ({
      ...prev,
      viewMode: mode,
      visibility: {
        ...prev.visibility,
        ...(presets[mode as PresetViewMode] || {}),
      },
    }));
  }, [configuration.customViewModes]);

  /**
   * Set the size of a specific panel (clamped to min/max)
   */
  const setPanelSize = useCallback((panel: PanelId, size: number) => {
    setConfiguration((prev) => {
      const panelConfig = prev.panelSizes[panel];
      const clampedSize = Math.max(panelConfig.minSize, Math.min(panelConfig.maxSize, size));
      return {
        ...prev,
        panelSizes: {
          ...prev.panelSizes,
          [panel]: {
            ...panelConfig,
            size: clampedSize,
          },
        },
      };
    });
  }, []);

  /**
   * Toggle the minimized state of a specific panel
   */
  const togglePanelMinimized = useCallback((panel: PanelId) => {
    setConfiguration((prev) => ({
      ...prev,
      panelSizes: {
        ...prev.panelSizes,
        [panel]: {
          ...prev.panelSizes[panel],
          isMinimized: !prev.panelSizes[panel].isMinimized,
        },
      },
    }));
  }, []);

  /**
   * Set the minimized state of a specific panel
   */
  const setPanelMinimized = useCallback((panel: PanelId, minimized: boolean) => {
    setConfiguration((prev) => ({
      ...prev,
      panelSizes: {
        ...prev.panelSizes,
        [panel]: {
          ...prev.panelSizes[panel],
          isMinimized: minimized,
        },
      },
    }));
  }, []);

  /**
   * Get the current size config for a panel
   */
  const getPanelSizeConfig = useCallback((panel: PanelId) => {
    return configuration.panelSizes[panel];
  }, [configuration.panelSizes]);

  const value = {
    configuration,
    setViewMode,
    togglePanelVisibility,
    setPanelVisibility,
    setAgentSidebarPosition,
    toggleTitleBar,
    toggleStatusBar,
    resetConfiguration,
    applyViewModePreset,
    setBottomPanelTab,
    saveCustomViewMode,
    deleteCustomViewMode,
    setPanelSize,
    togglePanelMinimized,
    setPanelMinimized,
    getPanelSizeConfig,
  };

  return (
    <PanelConfigurationContext.Provider value={value}>
      {children}
    </PanelConfigurationContext.Provider>
  );
};

export const usePanelConfigurationContext = () => {
  const context = useContext(PanelConfigurationContext);
  if (context === undefined) {
    throw new Error("usePanelConfigurationContext must be used within a PanelConfigurationProvider");
  }
  return context;
};
