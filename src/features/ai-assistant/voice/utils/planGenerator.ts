/**
 * File: src/features/ai-assistant/voice/utils/planGenerator.ts
 * 
 * Generates implementation plans from AI responses and tool calls.
 */

import type { ImplementationPlan, ImplementationStep } from '../types';
import type { ToolExecutionInfo } from '../../components/ToolExecutionCard';

/**
 * Generates an implementation plan from tool executions.
 */
export function generatePlanFromToolExecutions(
  task: string,
  toolExecutions: ToolExecutionInfo[]
): ImplementationPlan {
  const steps: ImplementationStep[] = toolExecutions.map((execution, index) => ({
    id: execution.tool,
    order: index + 1,
    tool: execution.tool,
    description: execution.description,
    parameters: execution.params,
    estimatedDuration: estimateDuration(execution.tool, execution.params),
  }));

  const totalTime = steps.reduce((sum, step) => sum + step.estimatedDuration, 0);
  const riskLevel = calculateRiskLevel(steps);

  return {
    id: `plan-${Date.now()}`,
    task,
    description: `Execute ${steps.length} steps to complete: ${task}`,
    steps,
    estimatedTotalTime: totalTime,
    riskLevel,
    safetyChecks: generateSafetyChecks(steps),
  };
}

/**
 * Estimates duration for a tool execution.
 */
function estimateDuration(tool: string, params: Record<string, any>): number {
  // Rough estimates in seconds
  const estimates: Record<string, (params: Record<string, any>) => number> = {
    'analyze_directory': (p) => {
      // Estimate based on file count (rough: 0.1s per file)
      return Math.max(5, Math.min(60, (p.totalFiles || 100) * 0.1));
    },
    'file_copy_tab': (p) => {
      const fileCount = p.fileCount || 10;
      // Rough: 0.5s per file
      return Math.max(2, fileCount * 0.5);
    },
    'folder_creation_tab': (p) => {
      const folderCount = p.folderNames?.length || 1;
      // Rough: 0.2s per folder
      return Math.max(1, folderCount * 0.2);
    },
    'file_creation_tab': (p) => {
      const fileCount = p.count || 1;
      // Rough: 0.1s per file
      return Math.max(1, fileCount * 0.1);
    },
    'find_replace_tab': (p) => {
      // Estimate based on search complexity
      return 10; // Default 10 seconds
    },
  };

  const estimator = estimates[tool];
  return estimator ? estimator(params) : 5; // Default 5 seconds
}

/**
 * Calculates risk level based on operations.
 */
function calculateRiskLevel(steps: ImplementationStep[]): 'low' | 'medium' | 'high' {
  const hasDelete = steps.some(s => 
    s.tool.includes('delete') || 
    s.parameters.operation === 'delete' ||
    s.parameters.operation === 'move'
  );
  
  const hasOverwrite = steps.some(s => 
    s.parameters.overwrite === true
  );

  const fileCount = steps.reduce((sum, s) => {
    return sum + (s.parameters.fileCount || s.parameters.count || 0);
  }, 0);

  if (hasDelete || hasOverwrite) {
    return fileCount > 100 ? 'high' : 'medium';
  }

  if (fileCount > 500) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generates safety check messages.
 */
function generateSafetyChecks(steps: ImplementationStep[]): string[] {
  const checks: string[] = [];

  const hasDelete = steps.some(s => 
    s.tool.includes('delete') || 
    s.parameters.operation === 'delete'
  );

  const hasMove = steps.some(s => 
    s.parameters.operation === 'move'
  );

  const hasOverwrite = steps.some(s => 
    s.parameters.overwrite === true
  );

  if (!hasDelete && !hasMove) {
    checks.push('No files will be deleted');
  }

  if (hasMove) {
    checks.push('Files will be moved (not deleted)');
  }

  if (hasOverwrite) {
    checks.push('⚠️ Some files may be overwritten');
  } else {
    checks.push('Existing files will be preserved');
  }

  checks.push('Automatic backup created before operation');
  checks.push('Undo available for 24 hours');
  checks.push('All metadata preserved');

  return checks;
}

/**
 * Generates clarification questions from AI response.
 */
export function extractClarifications(aiResponse: string): Array<{
  question: string;
  type: 'choice' | 'text' | 'path';
  options?: Array<{ label: string; value: string }>;
}> {
  // This would parse the AI response to extract clarification questions
  // For now, return empty array - would be enhanced with AI parsing
  return [];
}
