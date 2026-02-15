/**
 * File: src/features/ai-assistant/utils/toolPermissions.ts
 * 
 * Tool permission management for the AI Assistant.
 * Controls which tools the AI can use and enforces confirmation requirements.
 * 
 * Key features:
 * - Permission checking before tool execution
 * - Risk level-based categorization
 * - Configurable tool overrides
 * - Confirmation requirement enforcement
 * - Tool filtering for AI context
 */

import type { 
  ToolPermissionsSettings, 
  ToolPermissionStatus, 
  ToolRiskLevel,
  ToolPermission,
} from '../types';
import { 
  DEFAULT_TOOL_PERMISSIONS, 
  TOOL_METADATA 
} from '../types';

/**
 * Result of a permission check.
 */
export interface PermissionCheckResult {
  /** Whether the tool is allowed to execute */
  allowed: boolean;
  /** Whether confirmation is required before execution */
  requiresConfirmation: boolean;
  /** Reason for the decision (for logging/UI) */
  reason: string;
  /** The tool's risk level */
  riskLevel: ToolRiskLevel;
  /** The effective permission status */
  status: ToolPermissionStatus;
}

/**
 * Pending confirmation request for a tool execution.
 */
export interface PendingConfirmation {
  /** Unique ID for this confirmation request */
  id: string;
  /** Tool name requesting confirmation */
  toolName: string;
  /** Tool arguments */
  args: Record<string, any>;
  /** Human-readable description of the operation */
  description: string;
  /** Risk level of the tool */
  riskLevel: ToolRiskLevel;
  /** Timestamp when confirmation was requested */
  timestamp: number;
  /** Callback to execute when confirmed */
  onConfirm?: () => Promise<void>;
  /** Callback to execute when rejected */
  onReject?: () => void;
}

/**
 * ToolPermissionManager handles permission checking and management.
 */
export class ToolPermissionManager {
  private settings: ToolPermissionsSettings;
  private pendingConfirmations: Map<string, PendingConfirmation> = new Map();
  private confirmationCallbacks: Set<(pending: PendingConfirmation) => void> = new Set();

  constructor(settings?: Partial<ToolPermissionsSettings>) {
    this.settings = { ...DEFAULT_TOOL_PERMISSIONS, ...settings };
  }

  /**
   * Updates the permission settings.
   * @param newSettings - Partial settings to update
   */
  updateSettings(newSettings: Partial<ToolPermissionsSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Gets the current settings.
   * @returns Current permission settings
   */
  getSettings(): ToolPermissionsSettings {
    return { ...this.settings };
  }

  /**
   * Gets the risk level for a tool.
   * @param toolName - Name of the tool
   * @returns Tool risk level (defaults to 'moderate' if unknown)
   */
  getToolRiskLevel(toolName: string): ToolRiskLevel {
    const metadata = TOOL_METADATA[toolName];
    return metadata?.riskLevel || 'moderate';
  }

  /**
   * Gets the display name for a tool.
   * @param toolName - Name of the tool
   * @returns Human-readable display name
   */
  getToolDisplayName(toolName: string): string {
    const metadata = TOOL_METADATA[toolName];
    return metadata?.displayName || toolName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Gets the description for a tool.
   * @param toolName - Name of the tool
   * @returns Tool description
   */
  getToolDescription(toolName: string): string {
    const metadata = TOOL_METADATA[toolName];
    return metadata?.description || `Executes the ${toolName} tool`;
  }

  /**
   * Checks whether a tool can be disabled.
   * @param toolName - Name of the tool
   * @returns True if tool can be disabled
   */
  canDisableTool(toolName: string): boolean {
    const metadata = TOOL_METADATA[toolName];
    return metadata?.canDisable ?? true;
  }

  /**
   * Checks if a tool is allowed to execute.
   * @param toolName - Name of the tool to check
   * @returns Permission check result
   */
  checkPermission(toolName: string): PermissionCheckResult {
    const riskLevel = this.getToolRiskLevel(toolName);
    
    // If permissions are disabled, allow everything
    if (!this.settings.enabled) {
      return {
        allowed: true,
        requiresConfirmation: false,
        reason: 'Permission checking disabled',
        riskLevel,
        status: 'allowed',
      };
    }

    // Check if tool is completely disabled
    if (this.settings.disabledTools.includes(toolName)) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: `Tool "${this.getToolDisplayName(toolName)}" is disabled`,
        riskLevel,
        status: 'disabled',
      };
    }

    // Check for explicit override
    const override = this.settings.toolOverrides[toolName];
    if (override) {
      if (override === 'disabled') {
        return {
          allowed: false,
          requiresConfirmation: false,
          reason: `Tool "${this.getToolDisplayName(toolName)}" is disabled by override`,
          riskLevel,
          status: 'disabled',
        };
      }
      if (override === 'confirm') {
        return {
          allowed: true,
          requiresConfirmation: true,
          reason: `Tool "${this.getToolDisplayName(toolName)}" requires confirmation by override`,
          riskLevel,
          status: 'confirm',
        };
      }
      // override === 'allowed'
      return {
        allowed: true,
        requiresConfirmation: false,
        reason: `Tool "${this.getToolDisplayName(toolName)}" is allowed by override`,
        riskLevel,
        status: 'allowed',
      };
    }

    // Check if risk level requires confirmation
    if (this.settings.requireConfirmationFor.includes(riskLevel)) {
      // Check if destructive operations can bypass confirmation
      if (riskLevel === 'destructive' && this.settings.allowDestructiveWithoutConfirmation) {
        return {
          allowed: true,
          requiresConfirmation: false,
          reason: `Destructive operations allowed without confirmation`,
          riskLevel,
          status: 'allowed',
        };
      }
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: `Tool risk level "${riskLevel}" requires confirmation`,
        riskLevel,
        status: 'confirm',
      };
    }

    // Fall back to default permission
    const defaultStatus = this.settings.defaultPermission;
    return {
      allowed: defaultStatus !== 'disabled',
      requiresConfirmation: defaultStatus === 'confirm',
      reason: `Using default permission: ${defaultStatus}`,
      riskLevel,
      status: defaultStatus,
    };
  }

  /**
   * Filters a list of tools based on permissions.
   * Removes disabled tools from the list.
   * @param toolNames - Array of tool names
   * @returns Filtered array of allowed tool names
   */
  filterAllowedTools(toolNames: string[]): string[] {
    if (!this.settings.enabled) {
      return toolNames;
    }

    return toolNames.filter(toolName => {
      const permission = this.checkPermission(toolName);
      return permission.allowed;
    });
  }

  /**
   * Gets all tools organized by permission status.
   * @returns Object with tools grouped by status
   */
  getToolsByPermission(): Record<ToolPermissionStatus, ToolPermission[]> {
    const result: Record<ToolPermissionStatus, ToolPermission[]> = {
      allowed: [],
      confirm: [],
      disabled: [],
    };

    for (const [toolName, metadata] of Object.entries(TOOL_METADATA)) {
      const permission = this.checkPermission(toolName);
      result[permission.status].push({
        toolName,
        displayName: metadata.displayName,
        description: metadata.description,
        riskLevel: metadata.riskLevel,
        status: permission.status,
        canDisable: metadata.canDisable,
      });
    }

    return result;
  }

  /**
   * Gets all tools with their current permission status.
   * @returns Array of tool permissions
   */
  getAllToolPermissions(): ToolPermission[] {
    return Object.entries(TOOL_METADATA).map(([toolName, metadata]) => {
      const permission = this.checkPermission(toolName);
      return {
        toolName,
        displayName: metadata.displayName,
        description: metadata.description,
        riskLevel: metadata.riskLevel,
        status: permission.status,
        canDisable: metadata.canDisable,
      };
    });
  }

  /**
   * Sets the permission status for a specific tool.
   * @param toolName - Name of the tool
   * @param status - New permission status
   */
  setToolPermission(toolName: string, status: ToolPermissionStatus): void {
    if (status === 'disabled') {
      // Check if tool can be disabled
      if (!this.canDisableTool(toolName)) {
        console.warn(`[ToolPermissions] Cannot disable core tool: ${toolName}`);
        return;
      }
      // Add to disabled list
      if (!this.settings.disabledTools.includes(toolName)) {
        this.settings.disabledTools = [...this.settings.disabledTools, toolName];
      }
      // Remove from overrides
      const { [toolName]: _, ...rest } = this.settings.toolOverrides;
      this.settings.toolOverrides = rest;
    } else {
      // Remove from disabled list
      this.settings.disabledTools = this.settings.disabledTools.filter(t => t !== toolName);
      // Set override
      this.settings.toolOverrides = {
        ...this.settings.toolOverrides,
        [toolName]: status,
      };
    }
  }

  /**
   * Resets a tool's permission to default (removes override).
   * @param toolName - Name of the tool
   */
  resetToolPermission(toolName: string): void {
    this.settings.disabledTools = this.settings.disabledTools.filter(t => t !== toolName);
    const { [toolName]: _, ...rest } = this.settings.toolOverrides;
    this.settings.toolOverrides = rest;
  }

  /**
   * Resets all permissions to defaults.
   */
  resetAllPermissions(): void {
    this.settings = { ...DEFAULT_TOOL_PERMISSIONS };
  }

  /**
   * Registers a callback for confirmation requests.
   * @param callback - Function to call when confirmation is needed
   * @returns Unsubscribe function
   */
  onConfirmationRequired(callback: (pending: PendingConfirmation) => void): () => void {
    this.confirmationCallbacks.add(callback);
    return () => this.confirmationCallbacks.delete(callback);
  }

  /**
   * Requests confirmation for a tool execution.
   * @param toolName - Name of the tool
   * @param args - Tool arguments
   * @param description - Human-readable description
   * @returns Promise that resolves when confirmed, rejects when denied
   */
  requestConfirmation(
    toolName: string,
    args: Record<string, any>,
    description?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = `confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const riskLevel = this.getToolRiskLevel(toolName);
      
      const pending: PendingConfirmation = {
        id,
        toolName,
        args,
        description: description || `Execute ${this.getToolDisplayName(toolName)}`,
        riskLevel,
        timestamp: Date.now(),
        onConfirm: async () => {
          this.pendingConfirmations.delete(id);
          resolve();
        },
        onReject: () => {
          this.pendingConfirmations.delete(id);
          reject(new Error('User rejected the operation'));
        },
      };

      this.pendingConfirmations.set(id, pending);

      // Notify callbacks
      for (const callback of this.confirmationCallbacks) {
        try {
          callback(pending);
        } catch (err) {
          console.error('[ToolPermissions] Error in confirmation callback:', err);
        }
      }
    });
  }

  /**
   * Confirms a pending operation.
   * @param id - Confirmation request ID
   */
  async confirmOperation(id: string): Promise<void> {
    const pending = this.pendingConfirmations.get(id);
    if (pending?.onConfirm) {
      await pending.onConfirm();
    }
  }

  /**
   * Rejects a pending operation.
   * @param id - Confirmation request ID
   */
  rejectOperation(id: string): void {
    const pending = this.pendingConfirmations.get(id);
    if (pending?.onReject) {
      pending.onReject();
    }
  }

  /**
   * Gets all pending confirmations.
   * @returns Array of pending confirmation requests
   */
  getPendingConfirmations(): PendingConfirmation[] {
    return Array.from(this.pendingConfirmations.values());
  }

  /**
   * Clears all pending confirmations (rejects them).
   */
  clearPendingConfirmations(): void {
    for (const pending of this.pendingConfirmations.values()) {
      if (pending.onReject) {
        pending.onReject();
      }
    }
    this.pendingConfirmations.clear();
  }

  /**
   * Gets statistics about tool permissions.
   * @returns Permission statistics
   */
  getStats(): { total: number; allowed: number; confirm: number; disabled: number } {
    const tools = this.getAllToolPermissions();
    return {
      total: tools.length,
      allowed: tools.filter(t => t.status === 'allowed').length,
      confirm: tools.filter(t => t.status === 'confirm').length,
      disabled: tools.filter(t => t.status === 'disabled').length,
    };
  }

  /**
   * Generates a summary of permission settings for the AI context.
   * @returns Summary string for system prompt
   */
  generatePermissionSummary(): string {
    if (!this.settings.enabled) {
      return 'All tools are enabled without restrictions.';
    }

    const stats = this.getStats();
    const parts: string[] = [];

    if (stats.disabled > 0) {
      const disabledTools = this.getAllToolPermissions()
        .filter(t => t.status === 'disabled')
        .map(t => t.displayName);
      parts.push(`Disabled tools (DO NOT USE): ${disabledTools.join(', ')}`);
    }

    if (stats.confirm > 0) {
      const confirmTools = this.getAllToolPermissions()
        .filter(t => t.status === 'confirm')
        .map(t => t.displayName);
      parts.push(`Tools requiring confirmation: ${confirmTools.join(', ')}`);
    }

    if (this.settings.requireConfirmationFor.includes('destructive') && 
        !this.settings.allowDestructiveWithoutConfirmation) {
      parts.push('Destructive operations (delete, move) require user confirmation.');
    }

    return parts.length > 0 
      ? parts.join('\n') 
      : 'All tools are available.';
  }
}

/**
 * Singleton instance with default settings.
 */
export const toolPermissionManager = new ToolPermissionManager();

/**
 * Factory function to create a permission manager with custom settings.
 * @param settings - Custom settings
 * @returns New ToolPermissionManager instance
 */
export function createToolPermissionManager(settings?: Partial<ToolPermissionsSettings>): ToolPermissionManager {
  return new ToolPermissionManager(settings);
}
