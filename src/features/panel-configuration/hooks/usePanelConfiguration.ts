/**
 * File: src/features/panel-configuration/hooks/usePanelConfiguration.ts
 * 
 * Frontend: Custom hook for consuming panel configuration
 * Now re-exports from context for backward compatibility
 */

import { usePanelConfigurationContext } from "../contexts/PanelConfigurationContext";

/**
 * Custom hook for managing panel configuration
 * Now a wrapper around the context hook
 * 
 * @returns Panel configuration state and update methods
 */
export const usePanelConfiguration = () => {
  return usePanelConfigurationContext();
};
