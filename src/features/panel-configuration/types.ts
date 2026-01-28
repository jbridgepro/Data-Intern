/**
 * File: src/features/panel-configuration/types.ts
 * 
 * Frontend: Type definitions for panel configuration feature
 * Defines types for UI panel visibility, layout settings, view modes, and panel sizing
 */

/**
 * View mode options for the application layout
 */
export type PresetViewMode = "agent" | "editor" | "zen" | "browser";
export type ViewMode = PresetViewMode | (string & {});

/**
 * Position options for sidebars and panels
 */
export type PanelPosition = "left" | "right" | "bottom" | "hidden";

/**
 * Panel IDs for consistent identification
 */
export type PanelId = "sidebar" | "chat" | "panel" | "agents";

/**
 * Panel visibility configuration
 * Controls which UI components are visible
 */
export interface PanelVisibility {
  /** Toggle Agents sidebar visibility */
  agents: boolean;
  /** Toggle Chat panel visibility */
  chat: boolean;

  /** Toggle bottom Panel visibility */
  panel: boolean;
  /** Toggle main Sidebar visibility */
  sidebar: boolean;
}

/**
 * Panel size configuration for individual panels
 * Stores width (for side panels) or height (for bottom panel)
 */
export interface PanelSizeConfig {
  /** Current size in pixels */
  size: number;
  /** Minimum allowed size in pixels */
  minSize: number;
  /** Maximum allowed size in pixels */
  maxSize: number;
  /** Whether the panel is currently minimized */
  isMinimized: boolean;
}

/**
 * Panel sizes configuration for all resizable panels
 */
export interface PanelSizes {
  /** Main sidebar width */
  sidebar: PanelSizeConfig;
  /** Chat panel width */
  chat: PanelSizeConfig;

  /** Bottom panel height */
  panel: PanelSizeConfig;
  /** Agent sidebar width */
  agents: PanelSizeConfig;
}

/**
 * Layout configuration settings
 */
export interface LayoutConfig {
  /** Position of the Agent Sidebar */
  agentSidebarPosition: PanelPosition;
  /** Show or hide Title Bar */
  showTitleBar: boolean;
  /** Show or hide Status Bar */
  showStatusBar: boolean;
}

/**
 * Custom view mode configuration
 */
export interface CustomViewMode {
  id: string;
  name: string;
  visibility: PanelVisibility;
}

/**
 * Complete panel configuration state
 */
export interface PanelConfiguration {
  /** Current view mode */
  viewMode: ViewMode;
  /** Custom view modes */
  customViewModes: CustomViewMode[];
  /** Panel visibility settings */
  visibility: PanelVisibility;
  /** Layout configuration */
  layout: LayoutConfig;
  /** Active tab in the bottom panel */
  bottomPanelActiveTab: "terminal" | "problems" | "output";
  /** Panel sizes and minimized states */
  panelSizes: PanelSizes;
}

/**
 * Keyboard shortcut configuration for panel toggles
 */
export interface PanelShortcuts {
  /** Toggle Agents sidebar (⌘⇧S / Ctrl+Shift+S) */
  toggleAgents: string;
  /** Toggle Chat panel (⌘⇧B / Ctrl+Shift+B) */
  toggleChat: string;

  /** Toggle bottom Panel (⌘J / Ctrl+J) */
  togglePanel: string;
  /** Toggle main Sidebar (⌘B / Ctrl+B) */
  toggleSidebar: string;
}
