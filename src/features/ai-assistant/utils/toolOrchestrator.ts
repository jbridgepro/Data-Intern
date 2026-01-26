/**
 * File: src/features/ai-assistant/utils/toolOrchestrator.ts
 * 
 * Tool orchestrator that manages tool execution, workflows, and progress streaming.
 * Acts as the central controller for all tab-based tools.
 */

import type { ToolResult, ProgressCallback } from './tabTools';
import {
  executeFileCopyTool,
  executeFolderCreationTool,
  executeFileCreationTool,
  executeFindReplaceTool,
  type FileCopyToolParams,
  type FolderCreationToolParams,
  type FileCreationToolParams,
  type FindReplaceToolParams,
} from './tabTools';

/**
 * Tool execution step in a workflow.
 */
export interface WorkflowStep {
  tool: 'file_copy' | 'folder_creation' | 'file_creation' | 'find_replace';
  params: FileCopyToolParams | FolderCreationToolParams | FileCreationToolParams | FindReplaceToolParams;
  description: string;
}

/**
 * Workflow execution result.
 */
export interface WorkflowResult {
  success: boolean;
  steps: Array<{
    step: WorkflowStep;
    result: ToolResult;
  }>;
  totalSteps: number;
  completedSteps: number;
  errors?: string[];
}

/**
 * Tool orchestrator class.
 */
export class ToolOrchestrator {
  private onProgress?: (step: number, total: number, tool: string, progress: ToolResult['progress']) => void;
  private onStepComplete?: (step: number, tool: string, result: ToolResult) => void;

  /**
   * Sets progress callback for streaming updates.
   */
  setProgressCallback(
    callback: (step: number, total: number, tool: string, progress: ToolResult['progress']) => void
  ) {
    this.onProgress = callback;
  }

  /**
   * Sets step completion callback.
   */
  setStepCompleteCallback(callback: (step: number, tool: string, result: ToolResult) => void) {
    this.onStepComplete = callback;
  }

  /**
   * Executes a single tool.
   */
  async executeTool(
    tool: WorkflowStep['tool'],
    params: WorkflowStep['params'],
    description?: string
  ): Promise<ToolResult> {
    const progressCallback: ProgressCallback = (progress) => {
      this.onProgress?.(0, 1, tool, progress);
    };

    let result: ToolResult;

    switch (tool) {
      case 'file_copy':
        result = await executeFileCopyTool(params as FileCopyToolParams, progressCallback);
        break;
      case 'folder_creation':
        result = await executeFolderCreationTool(params as FolderCreationToolParams, progressCallback);
        break;
      case 'file_creation':
        result = await executeFileCreationTool(params as FileCreationToolParams, progressCallback);
        break;
      case 'find_replace':
        result = await executeFindReplaceTool(params as FindReplaceToolParams, progressCallback);
        break;
      default:
        result = {
          success: false,
          error: `Unknown tool: ${tool}`,
        };
    }

    this.onStepComplete?.(0, tool, result);
    return result;
  }

  /**
   * Executes a workflow of multiple tools in sequence.
   */
  async executeWorkflow(steps: WorkflowStep[]): Promise<WorkflowResult> {
    const results: WorkflowResult['steps'] = [];
    const errors: string[] = [];
    let completedSteps = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      const progressCallback: ProgressCallback = (progress) => {
        this.onProgress?.(i + 1, steps.length, step.tool, progress);
      };

      let result: ToolResult;

      try {
        switch (step.tool) {
          case 'file_copy':
            result = await executeFileCopyTool(step.params as FileCopyToolParams, progressCallback);
            break;
          case 'folder_creation':
            result = await executeFolderCreationTool(step.params as FolderCreationToolParams, progressCallback);
            break;
          case 'file_creation':
            result = await executeFileCreationTool(step.params as FileCreationToolParams, progressCallback);
            break;
          case 'find_replace':
            result = await executeFindReplaceTool(step.params as FindReplaceToolParams, progressCallback);
            break;
          default:
            result = {
              success: false,
              error: `Unknown tool: ${step.tool}`,
            };
        }

        if (!result.success && result.error) {
          errors.push(`Step ${i + 1} (${step.tool}): ${result.error}`);
        }

        results.push({ step, result });
        completedSteps++;

        this.onStepComplete?.(i + 1, step.tool, result);

        // Stop on critical error if needed
        // For now, continue with remaining steps
      } catch (error: any) {
        const errorResult: ToolResult = {
          success: false,
          error: error.message || 'Unknown error',
        };
        results.push({ step, result: errorResult });
        errors.push(`Step ${i + 1} (${step.tool}): ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      steps: results,
      totalSteps: steps.length,
      completedSteps,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Cancels ongoing workflow execution.
   */
  cancel(): void {
    // Implementation would track and cancel ongoing operations
    // For now, this is a placeholder
  }
}

/**
 * Singleton instance of the tool orchestrator.
 */
export const toolOrchestrator = new ToolOrchestrator();
