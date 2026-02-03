/**
 * File: src/features/ai-assistant/utils/toolValidator.ts
 *
 * Tool validation framework for pre-execution parameter validation,
 * file system checks, and impact estimation.
 */

import { exists, stat, readDir } from '@tauri-apps/plugin-fs';
import { join, dirname, basename, extname } from '@tauri-apps/api/path';
import type {
  EnhancedToolDefinition,
  ToolValidationContext,
  ValidationRule,
} from '../types/toolMetadata';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'critical';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Prerequisite check result
 */
export interface PrerequisiteCheck {
  satisfied: boolean;
  missingPrerequisites: string[];
  suggestions: string[];
}

/**
 * File system check result
 */
export interface FileSystemCheck {
  valid: boolean;
  issues: FileSystemIssue[];
}

/**
 * File system issue
 */
export interface FileSystemIssue {
  path: string;
  type: 'not_found' | 'permission_denied' | 'not_directory' | 'not_file' | 'already_exists';
  message: string;
  critical: boolean;
}

/**
 * Impact estimate
 */
export interface ImpactEstimate {
  estimatedFilesAffected: number;
  estimatedSizeAffected: number; // bytes
  estimatedDuration: number; // milliseconds
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
  requiresBackup: boolean;
}

/**
 * Tool validator class
 */
export class ToolValidator {
  private validationContext: ToolValidationContext;

  constructor(context: ToolValidationContext) {
    this.validationContext = context;
  }

  /**
   * Update validation context
   */
  updateContext(context: Partial<ToolValidationContext>): void {
    this.validationContext = {
      ...this.validationContext,
      ...context,
    };
  }

  /**
   * Validate tool parameters before execution
   */
  async validateParameters(
    tool: EnhancedToolDefinition,
    args: Record<string, any>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required parameters
    const required = tool.input_schema.required || [];
    for (const field of required) {
      if (args[field] === undefined || args[field] === null || args[field] === '') {
        errors.push({
          field,
          message: `Required parameter '${field}' is missing`,
          severity: 'error',
        });
      }
    }

    // Validate parameter types and constraints
    const properties = tool.input_schema.properties || {};
    for (const [field, schema] of Object.entries(properties)) {
      const value = args[field];
      if (value === undefined || value === null) continue;

      // Type validation
      const typeErrors = this.validateType(field, value, schema);
      errors.push(...typeErrors);

      // Path validation
      if (schema.format === 'path' || schema.type === 'path') {
        const pathIssues = await this.validatePath(field, value, schema);
        if (pathIssues.length > 0) {
          pathIssues.forEach(issue => {
            if (issue.critical) {
              errors.push({
                field,
                message: issue.message,
                severity: 'error',
              });
            } else {
              warnings.push({
                field,
                message: issue.message,
              });
            }
          });
        }
      }

      // Pattern validation
      if (schema.pattern && typeof value === 'string') {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          warnings.push({
            field,
            message: `Value does not match expected pattern: ${schema.pattern}`,
          });
        }
      }

      // Range validation
      if (typeof value === 'number') {
        if (schema.minimum !== undefined && value < schema.minimum) {
          errors.push({
            field,
            message: `Value ${value} is below minimum ${schema.minimum}`,
            severity: 'error',
          });
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          errors.push({
            field,
            message: `Value ${value} exceeds maximum ${schema.maximum}`,
            severity: 'error',
          });
        }
      }

      // Array validation
      if (schema.type === 'array' && Array.isArray(value)) {
        if (schema.minItems && value.length < schema.minItems) {
          errors.push({
            field,
            message: `Array must have at least ${schema.minItems} items`,
            severity: 'error',
          });
        }
        if (schema.maxItems && value.length > schema.maxItems) {
          warnings.push({
            field,
            message: `Array has ${value.length} items, maximum recommended is ${schema.maxItems}`,
            suggestion: 'Consider reducing the number of items for better performance',
          });
        }
      }
    }

    // Custom validation rules from metadata
    if (tool.metadata.successCriteria?.validationRules) {
      const ruleErrors = await this.validateCustomRules(
        tool.metadata.successCriteria.validationRules,
        args
      );
      errors.push(...ruleErrors);
    }

    // Destructive operation warnings
    if (tool.metadata.riskLevel === 'destructive') {
      warnings.push({
        field: '_general',
        message: 'This is a destructive operation that cannot be easily undone',
        suggestion: 'Consider creating a backup before proceeding',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if prerequisites are satisfied
   */
  checkPrerequisites(tool: EnhancedToolDefinition): PrerequisiteCheck {
    const missingPrerequisites: string[] = [];
    const suggestions: string[] = [];

    if (!tool.metadata.prerequisites || tool.metadata.prerequisites.length === 0) {
      return {
        satisfied: true,
        missingPrerequisites,
        suggestions,
      };
    }

    // Check if prerequisite tools have been executed recently
    const recentTools = this.validationContext.recentExecutions.map(e => e.toolName);

    for (const prereq of tool.metadata.prerequisites) {
      if (!recentTools.includes(prereq)) {
        missingPrerequisites.push(prereq);
        suggestions.push(`Consider running '${prereq}' before '${tool.name}'`);
      }
    }

    return {
      satisfied: missingPrerequisites.length === 0,
      missingPrerequisites,
      suggestions,
    };
  }

  /**
   * Validate file system state
   */
  async validateFileSystem(
    tool: EnhancedToolDefinition,
    args: Record<string, any>
  ): Promise<FileSystemCheck> {
    const issues: FileSystemIssue[] = [];

    // Extract path parameters
    const pathParams = this.extractPathParameters(tool.input_schema.properties || {}, args);

    for (const { field, path, expectedType } of pathParams) {
      try {
        const pathExists = await exists(path);

        if (expectedType === 'must-exist' && !pathExists) {
          issues.push({
            path,
            type: 'not_found',
            message: `Path does not exist: ${path}`,
            critical: true,
          });
          continue;
        }

        if (expectedType === 'must-not-exist' && pathExists) {
          issues.push({
            path,
            type: 'already_exists',
            message: `Path already exists: ${path}`,
            critical: false, // Warning, not error (might overwrite)
          });
          continue;
        }

        if (pathExists) {
          const stats = await stat(path);

          // Check if it's a directory when file expected
          if (expectedType === 'file' && stats.isDirectory) {
            issues.push({
              path,
              type: 'not_file',
              message: `Expected file but found directory: ${path}`,
              critical: true,
            });
          }

          // Check if it's a file when directory expected
          if (expectedType === 'directory' && stats.isFile) {
            issues.push({
              path,
              type: 'not_directory',
              message: `Expected directory but found file: ${path}`,
              critical: true,
            });
          }
        }
      } catch (error: any) {
        // Permission or access error
        issues.push({
          path,
          type: 'permission_denied',
          message: `Cannot access path: ${error.message}`,
          critical: true,
        });
      }
    }

    return {
      valid: !issues.some(i => i.critical),
      issues,
    };
  }

  /**
   * Estimate impact of tool execution
   */
  async estimateImpact(
    tool: EnhancedToolDefinition,
    args: Record<string, any>
  ): Promise<ImpactEstimate> {
    let estimatedFilesAffected = 0;
    let estimatedSizeAffected = 0;
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let requiresBackup = false;

    // Extract directory/file paths
    const pathParams = this.extractPathParameters(tool.input_schema.properties || {}, args);

    for (const { path, expectedType } of pathParams) {
      try {
        if (await exists(path)) {
          const stats = await stat(path);

          if (stats.isDirectory) {
            // Estimate directory size and file count
            const dirStats = await this.analyzeDirectory(path);
            estimatedFilesAffected += dirStats.fileCount;
            estimatedSizeAffected += dirStats.size;

            if (dirStats.fileCount > 1000) {
              warnings.push(`Directory contains ${dirStats.fileCount} files - this may take a while`);
              riskLevel = 'medium';
            }

            if (dirStats.size > 1024 * 1024 * 1024) { // > 1GB
              warnings.push(`Directory size is ${this.formatBytes(dirStats.size)} - large operation`);
              riskLevel = 'high';
            }
          } else if (stats.isFile) {
            estimatedFilesAffected += 1;
            estimatedSizeAffected += stats.size;
          }
        }
      } catch (error) {
        // Ignore errors in estimation
      }
    }

    // Adjust based on tool risk level
    if (tool.metadata.riskLevel === 'destructive') {
      riskLevel = 'high';
      requiresBackup = true;
      warnings.push('Destructive operation - backup recommended');
    } else if (tool.metadata.riskLevel === 'moderate') {
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Estimate duration based on file count and tool performance
    let estimatedDuration = estimatedFilesAffected * 10; // 10ms per file baseline

    if (tool.metadata.expectedExecutionTime === 'slow') {
      estimatedDuration *= 5;
    } else if (tool.metadata.expectedExecutionTime === 'medium') {
      estimatedDuration *= 2;
    }

    if (tool.metadata.resourceIntensive) {
      estimatedDuration *= 1.5;
    }

    return {
      estimatedFilesAffected,
      estimatedSizeAffected,
      estimatedDuration,
      riskLevel,
      warnings,
      requiresBackup,
    };
  }

  /**
   * Validate type of parameter value
   */
  private validateType(
    field: string,
    value: any,
    schema: Record<string, any>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const expectedType = schema.type;

    if (!expectedType) return errors;

    const actualType = Array.isArray(value) ? 'array' : typeof value;

    // Type mapping
    const typeMatches = (expected: string, actual: string): boolean => {
      if (expected === actual) return true;
      if (expected === 'integer' && actual === 'number') return Number.isInteger(value);
      if (expected === 'number' && actual === 'number') return true;
      return false;
    };

    if (!typeMatches(expectedType, actualType)) {
      errors.push({
        field,
        message: `Expected type '${expectedType}' but got '${actualType}'`,
        severity: 'error',
      });
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Validate path parameter
   */
  private async validatePath(
    field: string,
    path: string,
    schema: Record<string, any>
  ): Promise<FileSystemIssue[]> {
    const issues: FileSystemIssue[] = [];

    if (!path || typeof path !== 'string') {
      return issues;
    }

    // Basic path validation
    if (path.includes('\0')) {
      issues.push({
        path,
        type: 'permission_denied',
        message: 'Invalid path: contains null character',
        critical: true,
      });
      return issues;
    }

    return issues;
  }

  /**
   * Validate custom rules
   */
  private async validateCustomRules(
    rules: ValidationRule[],
    args: Record<string, any>
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      const value = args[rule.field];

      switch (rule.rule) {
        case 'required':
          if (value === undefined || value === null || value === '') {
            errors.push({
              field: rule.field,
              message: rule.message || `Field '${rule.field}' is required`,
              severity: 'error',
            });
          }
          break;

        case 'min':
          if (typeof value === 'number' && value < rule.value) {
            errors.push({
              field: rule.field,
              message: rule.message || `Value must be at least ${rule.value}`,
              severity: 'error',
            });
          }
          break;

        case 'max':
          if (typeof value === 'number' && value > rule.value) {
            errors.push({
              field: rule.field,
              message: rule.message || `Value must not exceed ${rule.value}`,
              severity: 'error',
            });
          }
          break;

        case 'pattern':
          if (typeof value === 'string' && rule.value) {
            const regex = new RegExp(rule.value);
            if (!regex.test(value)) {
              errors.push({
                field: rule.field,
                message: rule.message || `Value does not match required pattern`,
                severity: 'error',
              });
            }
          }
          break;

        case 'custom':
          if (rule.validator && !rule.validator(value)) {
            errors.push({
              field: rule.field,
              message: rule.message || `Custom validation failed for '${rule.field}'`,
              severity: 'error',
            });
          }
          break;
      }
    }

    return errors;
  }

  /**
   * Extract path parameters from schema
   */
  private extractPathParameters(
    properties: Record<string, any>,
    args: Record<string, any>
  ): Array<{ field: string; path: string; expectedType: string }> {
    const pathParams: Array<{ field: string; path: string; expectedType: string }> = [];

    for (const [field, schema] of Object.entries(properties)) {
      const value = args[field];
      if (!value) continue;

      // Check if it's a path parameter
      const isPath =
        schema.type === 'path' ||
        schema.format === 'path' ||
        field.toLowerCase().includes('path') ||
        field.toLowerCase().includes('directory') ||
        field.toLowerCase().includes('file');

      if (isPath && typeof value === 'string') {
        let expectedType = 'any';

        if (field.toLowerCase().includes('directory') || field.toLowerCase().endsWith('dir')) {
          expectedType = 'directory';
        } else if (field.toLowerCase().includes('file')) {
          expectedType = 'file';
        }

        // Check schema hints
        if (schema.mustExist) expectedType = 'must-exist';
        if (schema.mustNotExist) expectedType = 'must-not-exist';

        pathParams.push({ field, path: value, expectedType });
      }

      // Handle arrays of paths
      if (schema.type === 'array' && Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'string') {
            pathParams.push({
              field: `${field}[${index}]`,
              path: item,
              expectedType: 'any',
            });
          }
        });
      }
    }

    return pathParams;
  }

  /**
   * Analyze directory to get file count and size
   */
  private async analyzeDirectory(path: string): Promise<{ fileCount: number; size: number }> {
    let fileCount = 0;
    let size = 0;

    try {
      const entries = await readDir(path);

      for (const entry of entries) {
        try {
          const fullPath = await join(path, entry.name);
          const stats = await stat(fullPath);

          if (stats.isFile) {
            fileCount++;
            size += stats.size;
          } else if (stats.isDirectory) {
            const subStats = await this.analyzeDirectory(fullPath);
            fileCount += subStats.fileCount;
            size += subStats.size;
          }
        } catch (error) {
          // Skip inaccessible entries
        }
      }
    } catch (error) {
      // Directory not accessible
    }

    return { fileCount, size };
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

/**
 * Create validator instance
 */
export function createToolValidator(context: ToolValidationContext): ToolValidator {
  return new ToolValidator(context);
}

/**
 * Validate tool before execution (convenience function)
 */
export async function validateTool(
  tool: EnhancedToolDefinition,
  args: Record<string, any>,
  context: ToolValidationContext
): Promise<{
  parameters: ValidationResult;
  prerequisites: PrerequisiteCheck;
  fileSystem: FileSystemCheck;
  impact: ImpactEstimate;
}> {
  const validator = new ToolValidator(context);

  const [parameters, prerequisites, fileSystem, impact] = await Promise.all([
    validator.validateParameters(tool, args),
    Promise.resolve(validator.checkPrerequisites(tool)),
    validator.validateFileSystem(tool, args),
    validator.estimateImpact(tool, args),
  ]);

  return {
    parameters,
    prerequisites,
    fileSystem,
    impact,
  };
}
