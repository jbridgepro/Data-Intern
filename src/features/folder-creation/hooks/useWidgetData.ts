/**
 * File: src/features/folder-creation/hooks/useWidgetData.ts
 * 
 * Hook to load widget data from sessionStorage when navigating from AI chat.
 */

import { useEffect, useState } from "react";

interface WidgetData {
  toolName: string;
  params: Record<string, any>;
  timestamp: number;
}

export const useWidgetData = (tabId: string) => {
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);

  useEffect(() => {
    // Check for widget data in sessionStorage
    const storageKey = `tool-widget-data-${tabId}`;
    const stored = sessionStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Only use data if it's recent (within last 5 minutes)
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          setWidgetData(data);
          // Clear the data after loading
          sessionStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error('Failed to parse widget data:', error);
      }
    }
  }, [tabId]);

  return widgetData;
};

/**
 * Converts widget params to FolderConfig format
 */
export function convertWidgetParamsToFolderConfig(params: Record<string, any>): any {
  return {
    rootPath: params.rootPath || '',
    folderNames: params.folderNames || [],
    subfolders: params.subfolders || [],
    datePrefix: params.datePrefix || false,
    dateFormat: params.dateFormat || 'YYYY-MM-DD',
    numbering: params.numbering || false,
    numberFormat: params.numberFormat || '01',
  };
}
