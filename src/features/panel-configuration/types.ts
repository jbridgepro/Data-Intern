/**
 * File: src/features/panel-configuration/types.ts
 * 
 * Frontend: Type definitions for panel configuration feature
 * Defines types for UI panel visibility, layout settings, and view modes
 */

/**
 * View mode options for the application layout
 */
export type ViewMode = "agent" | "editor" | "zen" | "browser";

/**
 * Position options for sidebars and panels
 */
export type PanelPosition = "left" | "right" | "bottom" | "hidden";

/**
 * Panel visibility configuration
 * Controls which UI components are visible
 */
export interface PanelVisibility {
  /** Toggle Agents sidebar visibility */
  agents: boolean;
  /** Toggle Chat panel visibility */
  chat: boolean;
  /** Toggle Editors panel visibility */
  editors: boolean;
  /** Toggle bottom Panel visibility */
  panel: boolean;
  /** Toggle main Sidebar visibility */
  sidebar: boolean;
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
 * Complete panel configuration state
 */
export interface PanelConfiguration {
  /** Current view mode */
  viewMode: ViewMode;
  /** Panel visibility settings */
  visibility: PanelVisibility;
  /** Layout configuration */
  /** Layout configuration */
  layout: LayoutConfig;
  /** Active tab in the bottom panel */
  bottomPanelActiveTab: "terminal" | "problems" | "output";
}

/**
 * Keyboard shortcut configuration for panel toggles
 */
export interface PanelShortcuts {
  /** Toggle Agents sidebar (⌘⇧S / Ctrl+Shift+S) */
  toggleAgents: string;
  /** Toggle Chat panel (⌘⇧B / Ctrl+Shift+B) */
  toggleChat: string;
  /** Toggle Editors panel (⌘⇧E / Ctrl+Shift+E) */
  toggleEditors: string;
  /** Toggle bottom Panel (⌘J / Ctrl+J) */
  togglePanel: string;
  /** Toggle main Sidebar (⌘B / Ctrl+B) */
  toggleSidebar: string;
}
