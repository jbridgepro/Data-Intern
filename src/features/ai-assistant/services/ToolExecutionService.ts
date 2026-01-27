/**
 * File: src/features/ai-assistant/services/ToolExecutionService.ts
 * 
 * Service for executing tools and managing the execution loop.
 */

import { executeTool } from '../utils/toolsRegistry';
import type { ToolResult, ToolContext } from '../utils/toolsRegistry';
import { executeMCPTool, isMCPTool, parseMCPToolName } from '../utils/mcpIntegration';
import type { ToolExecutionInfo } from '../../components/ToolExecutionCard';
import type { ReasoningStep } from '../../components/ReasoningChain';

export class ToolExecutionService {
    /**
     * Executes a single tool and returns the result and execution info.
     */
    static async executeToolCall(
        toolName: string,
        toolArgs: any,
        context: ToolContext
    ): Promise<{ result: ToolResult; executionInfo: ToolExecutionInfo }> {

        // Create execution info
        const executionInfo: ToolExecutionInfo = {
            tool: toolName,
            description: this.getToolDescription(toolName, toolArgs),
            params: toolArgs,
            status: 'running',
        };

        let toolResult: ToolResult;

        try {
            if (isMCPTool(toolName)) {
                // Execute MCP tool
                const parsed = parseMCPToolName(toolName);
                if (parsed) {
                    toolResult = await executeMCPTool(parsed.server, parsed.tool, toolArgs);
                } else {
                    toolResult = {
                        success: false,
                        error: `Invalid MCP tool name: ${toolName}`,
                    };
                }
            } else {
                // Execute custom tool
                toolResult = await executeTool(toolName, toolArgs, context);
            }
        } catch (error: any) {
            console.error(`Error executing tool ${toolName}:`, error);
            toolResult = {
                success: false,
                error: error.message || `Failed to execute tool ${toolName}`,
            };
        }

        // Update status
        executionInfo.status = toolResult.success ? 'success' : 'error';
        executionInfo.result = toolResult;

        return { result: toolResult, executionInfo };
    }

    /**
     * Generates a reasoning step for tool selection.
     */
    static createToolSelectionStep(stepCounter: number, toolName: string, toolArgs: any): ReasoningStep {
        return {
            id: `reasoning-${stepCounter}`,
            step: stepCounter,
            type: 'tool_selection',
            content: `I'll use the ${toolName} tool to ${this.getToolDescription(toolName, toolArgs)}.`,
            timestamp: Date.now(),
            toolUsed: toolName,
            result: 'pending',
        };
    }

    /**
     * Generates a reasoning step for analysis.
     */
    static createAnalysisStep(stepCounter: number, toolName: string): ReasoningStep {
        return {
            id: `reasoning-${stepCounter}`,
            step: stepCounter,
            type: 'analysis',
            content: `Analyzing the results from ${toolName} to determine next steps...`,
            timestamp: Date.now(),
        };
    }

    /**
     * Generates a reasoning step for conclusion.
     */
    static createConclusionStep(stepCounter: number): ReasoningStep {
        return {
            id: `reasoning-${stepCounter}`,
            step: stepCounter,
            type: 'conclusion',
            content: 'Completed processing. Preparing final response for the user.',
            timestamp: Date.now(),
        };
    }

    /**
     * Gets a human-readable description for a tool execution.
     */
    static getToolDescription(toolName: string, args: Record<string, any>): string {
        const descriptions: Record<string, (args: Record<string, any>) => string> = {
            'file_copy_tab': (args) =>
                `${args.operation || 'Copy'} files from ${args.sourcePath || 'source'} to ${args.destinationPath || 'destination'}`,
            'folder_creation_tab': (args) =>
                `Create ${args.folderNames?.length || 0} folders${args.subfolders?.length ? ` with ${args.subfolders.length} subfolders each` : ''}`,
            'file_creation_tab': (args) =>
                `Create ${args.count || 0} files with extensions: ${args.extensions?.join(', ') || ''}`,
            'find_replace_tab': (args) =>
                `${args.replaceQuery ? 'Find and replace' : 'Find'} "${args.searchQuery || ''}" in ${args.filePattern || 'all files'}`,
        };

        const descFn = descriptions[toolName];
        return descFn ? descFn(args) : `Execute ${toolName}`;
    }
}
