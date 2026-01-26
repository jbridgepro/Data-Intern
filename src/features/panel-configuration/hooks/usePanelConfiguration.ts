/**
 * File: src/features/panel-configuration/hooks/usePanelConfiguration.ts
 * 
 * Frontend: Custom hook for managing panel configuration state
 * Handles persistence, state management, and provides methods to update configuration
 */

import { useState, useEffect, useCallback } from "react";
import {
  PanelConfiguration,
  ViewMode,
  PanelVisibility,
  LayoutConfig,
  PanelPosition,
} from "../types";

/**
 * Default panel configuration values
 */
const DEFAULT_CONFIG: PanelConfiguration = {
  viewMode: "editor",
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
};

/**
 * Storage key for persisting panel configuration
 */
const STORAGE_KEY = "panel-configuration";

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

/**
 * Custom hook for managing panel configuration
 * 
 * @returns Panel configuration state and update methods
 */
export const usePanelConfiguration = () => {
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
   * Reset configuration to defaults
   */
  const resetConfiguration = useCallback(() => {
    setConfiguration(DEFAULT_CONFIG);
  }, []);

  /**
   * Apply view mode presets
   * Different view modes have different default panel visibility
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

    setConfiguration((prev) => ({
      ...prev,
      viewMode: mode,
      visibility: {
        ...prev.visibility,
        ...presets[mode],
      },
    }));
  }, []);

  return {
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
  };
};
