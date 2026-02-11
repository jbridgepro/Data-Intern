/**
 * File: src/features/ai-assistant/utils/toolsRegistry.ts
 * 
 * Barrel file for the AI assistant tool system.
 * Re-exports tool definitions and execution logic from split modules.
 * 
 * All existing consumers can continue importing from this file unchanged.
 * 
 * Module structure:
 * - toolDefinitions.ts: Tool interfaces, types, and TOOLS array
 * - toolExecutors.ts: executeTool() and all handler implementations
 * - toolsRegistry.ts (this file): Barrel re-exports + public API functions
 */

import type { AISettings } from '../types';
import { TOOLS } from './toolDefinitions';
import { toolPermissionManager } from './toolPermissions';

// Re-export types (must use `export type` with isolatedModules)
export type { ToolDefinition, ToolContext, ToolResult, ValidationResult } from './toolDefinitions';
// Re-export values
export { ToolCategory, TOOLS } from './toolDefinitions';
export { executeTool, findClawdBotPath } from './toolExecutors';

/**
 * Gets available MCP tools and converts them to Anthropic tool format.
 */
export async function getMCPTools(): Promise<import('./toolDefinitions').ToolDefinition[]> {
  try {
    const { getMCPTools: getMCPToolsFromIntegration } = await import('./mcpIntegration');
    return await getMCPToolsFromIntegration();
  } catch (error) {
    console.warn('Failed to get MCP tools:', error);
    return [];
  }
}

/**
 * Gets all available tools (custom + MCP + Skills).
 * Optionally filters tools based on settings (e.g., ClawdBot tools).
 */
export async function getAllTools(settings?: Partial<AISettings>): Promise<import('./toolDefinitions').ToolDefinition[]> {
  let customTools = TOOLS;

  // Filter ClawdBot tools if not enabled
  if (settings && !settings.clawdbotEnabled) {
    customTools = customTools.filter(tool =>
      !tool.name.startsWith('clawdbot_') && !tool.name.startsWith('clawdhub_')
    );
  }

  // Filter out disabled tools based on permissions
  if (settings?.toolPermissions) {
    toolPermissionManager.updateSettings(settings.toolPermissions);
    const allowedToolNames = toolPermissionManager.filterAllowedTools(
      customTools.map(t => t.name)
    );
    customTools = customTools.filter(tool => allowedToolNames.includes(tool.name));
    console.log(`[getAllTools] Filtered to ${customTools.length} allowed tools`);
  }

  const mcpTools = await getMCPTools();

  // Get skill tools if ClawdBot is enabled
  let skillTools: import('./toolDefinitions').ToolDefinition[] = [];
  if (settings?.clawdbotEnabled) {
    try {
      const { getClawdhubSkillTools } = await import('./clawdhubToolDiscovery');
      skillTools = await getClawdhubSkillTools();
    } catch (error) {
      console.warn('Failed to get Clawdhub skill tools:', error);
    }
  }

  return [...customTools, ...mcpTools, ...skillTools];
}

/**
 * Gets a tool definition by name.
 */
export function getToolDefinition(toolName: string): import('./toolDefinitions').ToolDefinition | undefined {
  return TOOLS.find(tool => tool.name === toolName);
}

/**
 * Lists all available tools with their categories and descriptions.
 * Useful for AI to understand what tools are available.
 */
export async function listAvailableTools(settings?: { clawdbotEnabled?: boolean }): Promise<{
  tools: Array<{
    name: string;
    description: string;
    category?: string;
    examples?: string[];
  }>;
  total: number;
  byCategory: Record<string, number>;
}> {
  const allTools = await getAllTools(settings);

  const tools = allTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    category: tool.category,
    examples: tool.examples,
  }));

  const byCategory: Record<string, number> = {};
  tools.forEach(tool => {
    const category = tool.category || 'uncategorized';
    byCategory[category] = (byCategory[category] || 0) + 1;
  });

  return {
    tools,
    total: tools.length,
    byCategory,
  };
}
