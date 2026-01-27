/**
 * File: src/features/ai-assistant/hooks/useToolWidget.ts
 * 
 * Hook for managing contextual tool widgets in the AI chat interface.
 * Handles widget creation, updates, and navigation to full tool pages.
 */

import { useState, useCallback, useRef } from "react";
import type { ToolWidgetData, WidgetUpdate } from "../types";

interface UseToolWidgetOptions {
  onNavigateToTool?: (toolName: string, params: Record<string, any>) => void;
}

export const useToolWidget = (options: UseToolWidgetOptions = {}) => {
  const [widgets, setWidgets] = useState<Map<string, ToolWidgetData>>(new Map());
  const widgetIdCounter = useRef(0);

  /**
   * Creates a new widget from AI conversation context
   */
  const createWidget = useCallback(
    (widgetData: Omit<ToolWidgetData, "id" | "lastUpdated">): ToolWidgetData => {
      const id = `widget-${Date.now()}-${widgetIdCounter.current++}`;
      const newWidget: ToolWidgetData = {
        ...widgetData,
        id,
        lastUpdated: new Date(),
      };

      setWidgets((prev) => {
        const updated = new Map(prev);
        updated.set(id, newWidget);
        return updated;
      });

      return newWidget;
    },
    []
  );

  /**
   * Updates an existing widget (from AI or user edits)
   */
  const updateWidget = useCallback(
    (widgetId: string, updates: Partial<ToolWidgetData>, source: "ai" | "user" = "user") => {
      setWidgets((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(widgetId);
        if (existing) {
          updated.set(widgetId, {
            ...existing,
            ...updates,
            lastUpdated: new Date(),
          });
        }
        return updated;
      });
    },
    []
  );

  /**
   * Removes a widget
   */
  const removeWidget = useCallback((widgetId: string) => {
    setWidgets((prev) => {
      const updated = new Map(prev);
      updated.delete(widgetId);
      return updated;
    });
  }, []);

  /**
   * Confirms a widget (marks it as approved by user)
   */
  const confirmWidget = useCallback((widgetId: string) => {
    updateWidget(widgetId, { confirmed: true }, "user");
  }, [updateWidget]);

  /**
   * Navigates to the full tool page with pre-populated data
   */
  const navigateToTool = useCallback(
    (widgetId: string) => {
      const widget = widgets.get(widgetId);
      if (!widget) return;

      // Map tool names to tab IDs
      const toolToTabMap: Record<string, string> = {
        folder_creation_tab: "folder",
        file_creation_tab: "empty",
        file_copy_tab: "copy",
        find_replace_tab: "find-replace",
      };

      const tabId = toolToTabMap[widget.toolName];
      if (tabId && options.onNavigateToTool) {
        // Store widget data in sessionStorage for the tool page to pick up
        sessionStorage.setItem(
          `tool-widget-data-${tabId}`,
          JSON.stringify({
            toolName: widget.toolName,
            params: widget.params,
            timestamp: Date.now(),
          })
        );

        // Navigate to the tool tab
        window.dispatchEvent(
          new CustomEvent("filepro:navigate", {
            detail: { tab: tabId },
          })
        );

        // Call the callback if provided
        options.onNavigateToTool(widget.toolName, widget.params);
      }
    },
    [widgets, options]
  );

  /**
   * Gets all widgets for a specific message
   */
  const getWidgetsForMessage = useCallback(
    (messageId: string): ToolWidgetData[] => {
      return Array.from(widgets.values()).filter(
        (w) => w.sourceMessageId === messageId
      );
    },
    [widgets]
  );

  /**
   * Gets all active (non-confirmed) widgets
   */
  const getActiveWidgets = useCallback((): ToolWidgetData[] => {
    return Array.from(widgets.values()).filter((w) => !w.confirmed);
  }, [widgets]);

  return {
    widgets: Array.from(widgets.values()),
    createWidget,
    updateWidget,
    removeWidget,
    confirmWidget,
    navigateToTool,
    getWidgetsForMessage,
    getActiveWidgets,
  };
};
