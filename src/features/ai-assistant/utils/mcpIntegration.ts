/**
 * File: src/features/ai-assistant/utils/mcpIntegration.ts
 * 
 * Integration with Model Context Protocol (MCP) tools.
 * Allows the AI to use MCP tools alongside custom file operations.
 */

import type { ToolDefinition, ToolResult } from './toolsRegistry';

// MCP tool cache to avoid repeated lookups
let mcpToolsCache: ToolDefinition[] | null = null;
let mcpToolsCacheTime = 0;
const MCP_CACHE_TTL = 60000; // 1 minute

/**
 * Checks if MCP tools are available through the Cursor MCP system.
 */
export function isMCPAvailable(): boolean {
  // Check if we're in an environment with MCP support
  // Try to access call_mcp_tool through the global scope or window
  try {
    // In Cursor, MCP tools might be available through a global or window object
    return typeof (window as any).call_mcp_tool !== 'undefined' ||
           typeof (globalThis as any).call_mcp_tool !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Gets the call_mcp_tool function if available.
 */
function getMCPToolCaller(): ((server: string, tool: string, args: any) => Promise<any>) | null {
  try {
    if (typeof (window as any).call_mcp_tool === 'function') {
      return (window as any).call_mcp_tool;
    }
    if (typeof (globalThis as any).call_mcp_tool === 'function') {
      return (globalThis as any).call_mcp_tool;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gets available MCP tools and converts them to Anthropic tool format.
 * Uses the MCP file system to discover available tools.
 */
export async function getMCPTools(): Promise<ToolDefinition[]> {
  // Return cached tools if available and fresh
  if (mcpToolsCache && Date.now() - mcpToolsCacheTime < MCP_CACHE_TTL) {
    return mcpToolsCache;
  }

  try {
    // Use tool discovery to find available MCP tools
    const { discoverMCPTools } = await import('./mcpToolDiscovery');
    const tools = await discoverMCPTools();
    
    mcpToolsCache = tools;
    mcpToolsCacheTime = Date.now();
    
    return tools;
  } catch (error) {
    console.warn('Failed to get MCP tools:', error);
    return [];
  }
}

/**
 * Executes an MCP tool using the call_mcp_tool function.
 */
export async function executeMCPTool(
  server: string,
  toolName: string,
  args: Record<string, any>
): Promise<ToolResult> {
  const mcpCaller = getMCPToolCaller();
  
  if (!mcpCaller) {
    return {
      success: false,
      error: 'MCP is not available. MCP tools require the Cursor MCP system to be configured.',
    };
  }

  try {
    const result = await mcpCaller(server, toolName, args);
    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    console.error(`Error executing MCP tool ${server}::${toolName}:`, error);
    return {
      success: false,
      error: error.message || `Failed to execute MCP tool ${toolName}`,
    };
  }
}

/**
 * Checks if a tool name is an MCP tool.
 */
export function isMCPTool(toolName: string): boolean {
  // MCP tools might have a specific prefix or pattern
  // This is a placeholder - adjust based on your MCP setup
  return toolName.startsWith('mcp_') || toolName.includes('::');
}

/**
 * Extracts server and tool name from an MCP tool identifier.
 */
export function parseMCPToolName(toolName: string): { server: string; tool: string } | null {
  // Parse MCP tool name format (e.g., "server::tool" or "mcp_server:tool")
  const parts = toolName.split('::');
  if (parts.length === 2) {
    return { server: parts[0], tool: parts[1] };
  }
  
  const colonParts = toolName.split(':');
  if (colonParts.length === 2 && toolName.startsWith('mcp_')) {
    return { server: colonParts[0].replace('mcp_', ''), tool: colonParts[1] };
  }
  
  return null;
}
