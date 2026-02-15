/**
 * File: src/features/ai-assistant/utils/workflowManager.ts
 *
 * Workflow template management service.
 * Handles creating, storing, executing, and managing workflow templates.
 *
 * Key features:
 * - Workflow CRUD operations
 * - Template execution with step-by-step processing
 * - Parameter substitution and validation
 * - Execution history tracking
 * - Built-in workflow templates
 */

import type {
  Workflow,
  WorkflowStep,
  WorkflowParameter,
  WorkflowSettings,
  WorkflowCategory,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowStepResult,
  WorkflowTemplate,
  WorkflowValidation,
} from '../types';
import { DEFAULT_WORKFLOW_SETTINGS } from '../types';
import { auditLogger } from './auditLogger';

/**
 * Storage keys for persistence.
 */
const STORAGE_KEY = 'file-pro-workflows';
const EXECUTIONS_KEY = 'file-pro-workflow-executions';

/**
 * Listener callback types.
 */
type WorkflowChangeListener = (workflows: Workflow[]) => void;
type ExecutionListener = (execution: WorkflowExecution) => void;

/**
 * Built-in workflow templates for common operations.
 */
export const BUILTIN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'builtin-organize-by-type',
    name: 'Organize Files by Type',
    description: 'Automatically organize files into folders based on their file type (Documents, Images, Videos, etc.)',
    category: 'organization',
    icon: 'FolderTree',
    workflow: {
      name: 'Organize Files by Type',
      description: 'Automatically organize files into folders based on their file type',
      category: 'organization',
      visibility: 'builtin',
      tags: ['organize', 'sort', 'file-type'],
      steps: [
        {
          id: 'step-1',
          type: 'analyze_directory',
          name: 'Analyze Directory',
          toolName: 'analyze_directory',
          config: { path: '{{targetPath}}' },
          enabled: true,
          continueOnError: false,
          order: 0,
        },
        {
          id: 'step-2',
          type: 'organize_files',
          name: 'Organize by Type',
          toolName: 'organize_files',
          config: {
            path: '{{targetPath}}',
            strategy: 'by-type',
            createFolders: true,
          },
          enabled: true,
          continueOnError: false,
          order: 1,
        },
      ],
      parameters: [
        {
          name: 'targetPath',
          label: 'Target Directory',
          type: 'directory',
          defaultValue: '',
          description: 'The directory to organize',
          required: true,
          placeholder: '/path/to/folder',
        },
      ],
      version: '1.0.0',
      isFavorite: false,
      isEnabled: true,
    },
  },
  {
    id: 'builtin-organize-by-date',
    name: 'Organize Files by Date',
    description: 'Sort files into year/month folders based on their modification date',
    category: 'organization',
    icon: 'Calendar',
    workflow: {
      name: 'Organize Files by Date',
      description: 'Sort files into year/month folders based on their modification date',
      category: 'organization',
      visibility: 'builtin',
      tags: ['organize', 'sort', 'date', 'archive'],
      steps: [
        {
          id: 'step-1',
          type: 'organize_files',
          name: 'Organize by Date',
          toolName: 'organize_files',
          config: {
            path: '{{targetPath}}',
            strategy: 'by-date',
            dateFormat: '{{dateFormat}}',
          },
          enabled: true,
          continueOnError: false,
          order: 0,
        },
      ],
      parameters: [
        {
          name: 'targetPath',
          label: 'Target Directory',
          type: 'directory',
          defaultValue: '',
          description: 'The directory to organize',
          required: true,
        },
        {
          name: 'dateFormat',
          label: 'Date Format',
          type: 'select',
          defaultValue: 'year-month',
          description: 'How to organize by date',
          required: true,
          options: [
            { value: 'year', label: 'Year (2024/)' },
            { value: 'year-month', label: 'Year/Month (2024/01/)' },
            { value: 'quarter', label: 'Year/Quarter (2024/Q1/)' },
          ],
        },
      ],
      version: '1.0.0',
      isFavorite: false,
      isEnabled: true,
    },
  },
  {
    id: 'builtin-cleanup-empty',
    name: 'Clean Up Empty Folders',
    description: 'Find and remove empty folders to clean up your directory structure',
    category: 'cleanup',
    icon: 'Trash2',
    workflow: {
      name: 'Clean Up Empty Folders',
      description: 'Find and remove empty folders',
      category: 'cleanup',
      visibility: 'builtin',
      tags: ['cleanup', 'delete', 'empty'],
      steps: [
        {
          id: 'step-1',
          type: 'analyze_directory',
          name: 'Find Empty Folders',
          toolName: 'analyze_directory',
          config: {
            path: '{{targetPath}}',
            findEmpty: true,
          },
          enabled: true,
          continueOnError: false,
          order: 0,
        },
        {
          id: 'step-2',
          type: 'delete_files',
          name: 'Delete Empty Folders',
          toolName: 'delete_files',
          config: {
            paths: '{{emptyFolders}}',
            onlyEmpty: true,
          },
          enabled: true,
          continueOnError: true,
          order: 1,
        },
      ],
      parameters: [
        {
          name: 'targetPath',
          label: 'Target Directory',
          type: 'directory',
          defaultValue: '',
          description: 'The directory to clean up',
          required: true,
        },
      ],
      version: '1.0.0',
      isFavorite: false,
      isEnabled: true,
    },
  },
  {
    id: 'builtin-backup-folder',
    name: 'Backup Folder',
    description: 'Create a timestamped backup copy of a folder',
    category: 'backup',
    icon: 'Archive',
    workflow: {
      name: 'Backup Folder',
      description: 'Create a timestamped backup copy of a folder',
      category: 'backup',
      visibility: 'builtin',
      tags: ['backup', 'copy', 'archive'],
      steps: [
        {
          id: 'step-1',
          type: 'copy_files',
          name: 'Copy to Backup',
          toolName: 'file_copy_tab',
          config: {
            sourcePath: '{{sourcePath}}',
            destinationPath: '{{backupPath}}/backup-{{timestamp}}',
            preserveStructure: true,
          },
          enabled: true,
          continueOnError: false,
          order: 0,
        },
      ],
      parameters: [
        {
          name: 'sourcePath',
          label: 'Source Directory',
          type: 'directory',
          defaultValue: '',
          description: 'The directory to backup',
          required: true,
        },
        {
          name: 'backupPath',
          label: 'Backup Location',
          type: 'directory',
          defaultValue: '',
          description: 'Where to store the backup',
          required: true,
        },
      ],
      version: '1.0.0',
      isFavorite: false,
      isEnabled: true,
    },
  },
  {
    id: 'builtin-rename-pattern',
    name: 'Batch Rename Files',
    description: 'Rename multiple files using a pattern (add prefix, suffix, or sequential numbers)',
    category: 'organization',
    icon: 'FileEdit',
    workflow: {
      name: 'Batch Rename Files',
      description: 'Rename multiple files using a pattern',
      category: 'organization',
      visibility: 'builtin',
      tags: ['rename', 'batch', 'pattern'],
      steps: [
        {
          id: 'step-1',
          type: 'rename_files',
          name: 'Rename Files',
          toolName: 'rename_files',
          config: {
            path: '{{targetPath}}',
            pattern: '{{filePattern}}',
            newPattern: '{{newPattern}}',
            preview: '{{previewOnly}}',
          },
          enabled: true,
          continueOnError: false,
          order: 0,
        },
      ],
      parameters: [
        {
          name: 'targetPath',
          label: 'Target Directory',
          type: 'directory',
          defaultValue: '',
          description: 'Directory containing files to rename',
          required: true,
        },
        {
          name: 'filePattern',
          label: 'Match Pattern',
          type: 'pattern',
          defaultValue: '*.*',
          description: 'Pattern to match files (e.g., *.jpg, report_*)',
          required: true,
        },
        {
          name: 'newPattern',
          label: 'New Name Pattern',
          type: 'string',
          defaultValue: '',
          description: 'New naming pattern (use {n} for number, {name} for original)',
          required: true,
          placeholder: 'photo_{n}',
        },
        {
          name: 'previewOnly',
          label: 'Preview Only',
          type: 'boolean',
          defaultValue: true,
          description: 'Show preview without making changes',
          required: false,
        },
      ],
      version: '1.0.0',
      isFavorite: false,
      isEnabled: true,
    },
  },
  {
    id: 'builtin-project-setup',
    name: 'Project Folder Structure',
    description: 'Create a standard project folder structure with common directories',
    category: 'development',
    icon: 'FolderPlus',
    workflow: {
      name: 'Project Folder Structure',
      description: 'Create a standard project folder structure',
      category: 'development',
      visibility: 'builtin',
      tags: ['project', 'setup', 'folders', 'structure'],
      steps: [
        {
          id: 'step-1',
          type: 'create_folders',
          name: 'Create Project Structure',
          toolName: 'folder_creation_tab',
          config: {
            rootPath: '{{projectPath}}',
            folders: [
              'src',
              'src/components',
              'src/utils',
              'src/styles',
              'docs',
              'tests',
              'assets',
              'assets/images',
              'assets/fonts',
              'config',
            ],
          },
          enabled: true,
          continueOnError: false,
          order: 0,
        },
        {
          id: 'step-2',
          type: 'create_files',
          name: 'Create Readme',
          toolName: 'file_creation_tab',
          config: {
            rootPath: '{{projectPath}}',
            files: [
              { name: 'README.md', content: '# {{projectName}}\n\nProject description here.' },
              { name: '.gitignore', content: 'node_modules/\n.env\n*.log' },
            ],
          },
          enabled: true,
          continueOnError: true,
          order: 1,
        },
      ],
      parameters: [
        {
          name: 'projectPath',
          label: 'Project Location',
          type: 'directory',
          defaultValue: '',
          description: 'Where to create the project',
          required: true,
        },
        {
          name: 'projectName',
          label: 'Project Name',
          type: 'string',
          defaultValue: 'My Project',
          description: 'Name for the project',
          required: true,
        },
      ],
      version: '1.0.0',
      isFavorite: false,
      isEnabled: true,
    },
  },
];

/**
 * WorkflowManager class handles all workflow template operations.
 */
export class WorkflowManager {
  private settings: WorkflowSettings;
  private workflows: Workflow[] = [];
  private executions: WorkflowExecution[] = [];
  private workflowListeners: Set<WorkflowChangeListener> = new Set();
  private executionListeners: Set<ExecutionListener> = new Set();
  private currentExecution: WorkflowExecution | null = null;
  private isInitialized: boolean = false;

  constructor(settings?: Partial<WorkflowSettings>) {
    this.settings = { ...DEFAULT_WORKFLOW_SETTINGS, ...settings };
  }

  /**
   * Initializes the workflow manager and loads persisted data.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.settings.persistWorkflows) {
      this.loadFromStorage();
    }

    this.isInitialized = true;
    console.log(`[WorkflowManager] Initialized with ${this.workflows.length} workflows`);
  }

  /**
   * Updates the settings.
   */
  updateSettings(newSettings: Partial<WorkflowSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Gets the current settings.
   */
  getSettings(): WorkflowSettings {
    return { ...this.settings };
  }

  /**
   * Generates a unique workflow ID.
   */
  private generateId(): string {
    return `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates a unique execution ID.
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // WORKFLOW CRUD OPERATIONS
  // ============================================================================

  /**
   * Creates a new workflow.
   */
  createWorkflow(data: Partial<Workflow>): Workflow {
    const now = Date.now();
    const workflow: Workflow = {
      id: this.generateId(),
      name: data.name || 'New Workflow',
      description: data.description || '',
      category: data.category || 'custom',
      visibility: data.visibility || 'private',
      tags: data.tags || [],
      steps: data.steps || [],
      parameters: data.parameters || [],
      schedule: data.schedule,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      version: data.version || '1.0.0',
      isFavorite: data.isFavorite || false,
      isEnabled: data.isEnabled ?? true,
      icon: data.icon,
      color: data.color,
      author: data.author,
    };

    this.workflows.push(workflow);
    this.trimWorkflows();
    this.saveToStorage();
    this.notifyWorkflowListeners();

    auditLogger.info('settings', 'workflow_created', `Created workflow: ${workflow.name}`, {
      metadata: { workflowId: workflow.id },
    });

    return workflow;
  }

  /**
   * Creates a workflow from a built-in template.
   */
  createFromTemplate(templateId: string, customizations?: Partial<Workflow>): Workflow | null {
    const template = BUILTIN_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      console.error(`[WorkflowManager] Template not found: ${templateId}`);
      return null;
    }

    return this.createWorkflow({
      ...template.workflow,
      ...customizations,
      name: customizations?.name || template.workflow.name,
      visibility: 'private', // User's copy is private
    });
  }

  /**
   * Updates an existing workflow.
   */
  updateWorkflow(id: string, updates: Partial<Workflow>): Workflow | null {
    const index = this.workflows.findIndex(w => w.id === id);
    if (index === -1) return null;

    this.workflows[index] = {
      ...this.workflows[index],
      ...updates,
      updatedAt: Date.now(),
    };

    this.saveToStorage();
    this.notifyWorkflowListeners();

    return this.workflows[index];
  }

  /**
   * Deletes a workflow.
   */
  deleteWorkflow(id: string): boolean {
    const index = this.workflows.findIndex(w => w.id === id);
    if (index === -1) return false;

    const workflow = this.workflows[index];
    this.workflows.splice(index, 1);
    this.saveToStorage();
    this.notifyWorkflowListeners();

    auditLogger.info('settings', 'workflow_deleted', `Deleted workflow: ${workflow.name}`, {
      metadata: { workflowId: id },
    });

    return true;
  }

  /**
   * Gets a workflow by ID.
   */
  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.find(w => w.id === id);
  }

  /**
   * Gets all workflows.
   */
  getAllWorkflows(): Workflow[] {
    return [...this.workflows];
  }

  /**
   * Gets workflows by category.
   */
  getWorkflowsByCategory(category: WorkflowCategory): Workflow[] {
    return this.workflows.filter(w => w.category === category);
  }

  /**
   * Gets favorite workflows.
   */
  getFavoriteWorkflows(): Workflow[] {
    return this.workflows.filter(w => w.isFavorite);
  }

  /**
   * Searches workflows by name, description, or tags.
   */
  searchWorkflows(query: string): Workflow[] {
    const lowerQuery = query.toLowerCase();
    return this.workflows.filter(w =>
      w.name.toLowerCase().includes(lowerQuery) ||
      w.description.toLowerCase().includes(lowerQuery) ||
      w.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Gets built-in templates.
   */
  getBuiltinTemplates(): WorkflowTemplate[] {
    return [...BUILTIN_TEMPLATES];
  }

  /**
   * Toggles favorite status.
   */
  toggleFavorite(id: string): boolean {
    const workflow = this.getWorkflow(id);
    if (!workflow) return false;

    this.updateWorkflow(id, { isFavorite: !workflow.isFavorite });
    return true;
  }

  /**
   * Duplicates a workflow.
   */
  duplicateWorkflow(id: string): Workflow | null {
    const original = this.getWorkflow(id);
    if (!original) return null;

    return this.createWorkflow({
      ...original,
      name: `${original.name} (Copy)`,
      runCount: 0,
      lastRunAt: undefined,
      avgExecutionTime: undefined,
      successRate: undefined,
    });
  }

  // ============================================================================
  // WORKFLOW EXECUTION
  // ============================================================================

  /**
   * Executes a workflow with the given parameters.
   */
  async executeWorkflow(
    workflowId: string,
    parameters: Record<string, any>,
    toolExecutor: (toolName: string, args: Record<string, any>) => Promise<any>,
    options?: {
      triggeredBy?: 'user' | 'schedule' | 'api';
      onStepComplete?: (step: WorkflowStepResult) => void;
      onProgress?: (current: number, total: number) => void;
    }
  ): Promise<WorkflowExecution> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (!workflow.isEnabled) {
      throw new Error(`Workflow is disabled: ${workflow.name}`);
    }

    // Create execution record
    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      parameters,
      stepResults: workflow.steps.map(step => ({
        stepId: step.id,
        stepName: step.name,
        status: 'pending',
      })),
      currentStep: 0,
      totalSteps: workflow.steps.length,
      startedAt: Date.now(),
      totalFilesAffected: 0,
      triggeredBy: options?.triggeredBy || 'user',
    };

    this.currentExecution = execution;
    this.notifyExecutionListeners(execution);

    auditLogger.info('tool_execution', 'workflow_started', `Started workflow: ${workflow.name}`, {
      metadata: { workflowId, executionId: execution.id },
    });

    try {
      // Execute each step
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStep = i;

        // Update step status to running
        execution.stepResults[i].status = 'running';
        execution.stepResults[i].startedAt = Date.now();
        this.notifyExecutionListeners(execution);
        options?.onProgress?.(i + 1, workflow.steps.length);

        // Skip disabled steps
        if (!step.enabled) {
          execution.stepResults[i].status = 'skipped';
          execution.stepResults[i].completedAt = Date.now();
          continue;
        }

        // Evaluate condition if present
        if (step.condition) {
          const shouldRun = this.evaluateCondition(step.condition, parameters, execution);
          if (!shouldRun) {
            execution.stepResults[i].status = 'skipped';
            execution.stepResults[i].completedAt = Date.now();
            continue;
          }
        }

        // Substitute parameters in config
        const resolvedConfig = this.substituteParameters(step.config, parameters, execution);

        // Execute the step with retry logic
        let attempts = 0;
        const maxAttempts = step.retry?.maxAttempts || 1;
        let lastError: Error | null = null;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            const result = await toolExecutor(step.toolName, resolvedConfig);

            execution.stepResults[i].status = 'success';
            execution.stepResults[i].output = result;
            execution.stepResults[i].completedAt = Date.now();
            execution.stepResults[i].duration =
              (execution.stepResults[i].completedAt || Date.now()) - (execution.stepResults[i].startedAt || 0);

            if (result?.data?.count) {
              execution.totalFilesAffected += result.data.count;
              execution.stepResults[i].filesAffected = result.data.count;
            }

            lastError = null;
            break;
          } catch (error: any) {
            lastError = error;
            execution.stepResults[i].retryAttempts = attempts;

            if (attempts < maxAttempts && step.retry?.delayMs) {
              await this.delay(step.retry.delayMs);
            }
          }
        }

        if (lastError) {
          execution.stepResults[i].status = 'failed';
          execution.stepResults[i].error = lastError.message;
          execution.stepResults[i].completedAt = Date.now();
          execution.stepResults[i].duration =
            (execution.stepResults[i].completedAt || Date.now()) - (execution.stepResults[i].startedAt || 0);

          if (!step.continueOnError) {
            throw lastError;
          }
        }

        options?.onStepComplete?.(execution.stepResults[i]);
        this.notifyExecutionListeners(execution);
      }

      // Mark as completed
      execution.status = 'completed';
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;

      // Update workflow stats
      this.updateWorkflowStats(workflow.id, execution);

      auditLogger.info('tool_execution', 'workflow_completed',
        `Completed workflow: ${workflow.name} (${execution.totalFilesAffected} files affected)`, {
        duration: execution.duration,
        metadata: { workflowId, executionId: execution.id },
      }
      );

    } catch (error: any) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = Date.now();
      execution.duration = execution.completedAt - execution.startedAt;

      // Update workflow stats
      this.updateWorkflowStats(workflow.id, execution);

      auditLogger.error('tool_execution', 'workflow_failed',
        `Workflow failed: ${workflow.name}`, error.message, {
        duration: execution.duration,
        metadata: { workflowId, executionId: execution.id },
      }
      );
    }

    // Save execution to history
    this.executions.push(execution);
    this.trimExecutions();
    this.saveExecutionsToStorage();

    this.currentExecution = null;
    this.notifyExecutionListeners(execution);

    return execution;
  }

  /**
   * Cancels the current execution.
   */
  cancelExecution(): boolean {
    if (!this.currentExecution) return false;

    this.currentExecution.status = 'cancelled';
    this.currentExecution.completedAt = Date.now();
    this.currentExecution.duration =
      this.currentExecution.completedAt - this.currentExecution.startedAt;

    this.notifyExecutionListeners(this.currentExecution);
    this.currentExecution = null;

    return true;
  }

  /**
   * Gets the current execution.
   */
  getCurrentExecution(): WorkflowExecution | null {
    return this.currentExecution;
  }

  /**
   * Gets execution history.
   */
  getExecutionHistory(limit: number = 20): WorkflowExecution[] {
    return [...this.executions]
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  /**
   * Gets executions for a specific workflow.
   */
  getWorkflowExecutions(workflowId: string, limit: number = 10): WorkflowExecution[] {
    return this.executions
      .filter(e => e.workflowId === workflowId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validates a workflow configuration.
   */
  validateWorkflow(workflow: Partial<Workflow>): WorkflowValidation {
    const errors: WorkflowValidation['errors'] = [];
    const warnings: WorkflowValidation['warnings'] = [];

    // Check required fields
    if (!workflow.name?.trim()) {
      errors.push({ field: 'name', message: 'Workflow name is required' });
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push({ field: 'steps', message: 'Workflow must have at least one step' });
    }

    // Validate steps
    workflow.steps?.forEach((step, index) => {
      if (!step.toolName) {
        errors.push({
          stepId: step.id,
          field: 'toolName',
          message: `Step ${index + 1}: Tool name is required`
        });
      }

      if (!step.name?.trim()) {
        warnings.push({
          stepId: step.id,
          field: 'name',
          message: `Step ${index + 1}: Name is recommended`
        });
      }
    });

    // Validate parameters
    workflow.parameters?.forEach(param => {
      if (param.required && param.defaultValue === undefined && param.defaultValue === '') {
        warnings.push({
          field: `parameter.${param.name}`,
          message: `Required parameter "${param.label}" has no default value`
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Substitutes parameters in configuration object.
   */
  private substituteParameters(
    config: Record<string, any>,
    parameters: Record<string, any>,
    execution: WorkflowExecution
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        // Replace {{paramName}} with parameter values
        result[key] = value.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
          if (paramName === 'timestamp') {
            return new Date().toISOString().replace(/[:.]/g, '-');
          }
          return parameters[paramName] ?? match;
        });
      } else if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'object'
            ? this.substituteParameters(item, parameters, execution)
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.substituteParameters(value, parameters, execution);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Evaluates a condition expression.
   */
  private evaluateCondition(
    condition: string,
    parameters: Record<string, any>,
    execution: WorkflowExecution
  ): boolean {
    try {
      // Simple condition evaluation (can be extended)
      // Format: "paramName == value" or "paramName != value"
      const match = condition.match(/^(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
      if (!match) return true;

      const [, paramName, operator, rawValue] = match;
      const paramValue = parameters[paramName];
      const compareValue = rawValue.replace(/^["']|["']$/g, '');

      switch (operator) {
        case '==': return String(paramValue) === compareValue;
        case '!=': return String(paramValue) !== compareValue;
        case '>': return Number(paramValue) > Number(compareValue);
        case '<': return Number(paramValue) < Number(compareValue);
        case '>=': return Number(paramValue) >= Number(compareValue);
        case '<=': return Number(paramValue) <= Number(compareValue);
        default: return true;
      }
    } catch {
      return true;
    }
  }

  /**
   * Updates workflow statistics after execution.
   */
  private updateWorkflowStats(workflowId: string, execution: WorkflowExecution): void {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) return;

    const newRunCount = workflow.runCount + 1;
    const isSuccess = execution.status === 'completed';

    // Calculate new average execution time
    const prevAvg = workflow.avgExecutionTime || 0;
    const newAvg = execution.duration
      ? ((prevAvg * workflow.runCount) + execution.duration) / newRunCount
      : prevAvg;

    // Calculate new success rate
    const prevSuccessCount = ((workflow.successRate || 100) / 100) * workflow.runCount;
    const newSuccessRate = ((prevSuccessCount + (isSuccess ? 1 : 0)) / newRunCount) * 100;

    this.updateWorkflow(workflowId, {
      runCount: newRunCount,
      lastRunAt: execution.startedAt,
      avgExecutionTime: newAvg,
      successRate: newSuccessRate,
    });
  }

  /**
   * Delays execution for the specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Trims workflows to max size.
   */
  private trimWorkflows(): void {
    if (this.workflows.length > this.settings.maxWorkflows) {
      // Sort by lastRunAt (never run first) then createdAt (oldest first)
      this.workflows.sort((a, b) => {
        if (!a.lastRunAt && b.lastRunAt) return -1;
        if (a.lastRunAt && !b.lastRunAt) return 1;
        return (a.lastRunAt || a.createdAt) - (b.lastRunAt || b.createdAt);
      });
      this.workflows = this.workflows.slice(-this.settings.maxWorkflows);
    }
  }

  /**
   * Trims executions to reasonable size.
   */
  private trimExecutions(): void {
    const maxExecutions = 100;
    if (this.executions.length > maxExecutions) {
      this.executions = this.executions
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, maxExecutions);
    }
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  /**
   * Saves workflows to localStorage.
   */
  private saveToStorage(): void {
    if (!this.settings.persistWorkflows) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        workflows: this.workflows,
        savedAt: Date.now(),
      }));
    } catch (error) {
      console.warn('[WorkflowManager] Could not save to storage:', error);
    }
  }

  /**
   * Loads workflows from localStorage.
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.workflows = data.workflows || [];
        console.log(`[WorkflowManager] Loaded ${this.workflows.length} workflows from storage`);
      }

      const execStored = localStorage.getItem(EXECUTIONS_KEY);
      if (execStored) {
        const data = JSON.parse(execStored);
        this.executions = data.executions || [];
      }
    } catch (error) {
      console.warn('[WorkflowManager] Could not load from storage:', error);
      this.workflows = [];
      this.executions = [];
    }
  }

  /**
   * Saves executions to localStorage.
   */
  private saveExecutionsToStorage(): void {
    try {
      localStorage.setItem(EXECUTIONS_KEY, JSON.stringify({
        executions: this.executions.slice(-50), // Keep last 50
        savedAt: Date.now(),
      }));
    } catch (error) {
      console.warn('[WorkflowManager] Could not save executions:', error);
    }
  }

  // ============================================================================
  // LISTENERS
  // ============================================================================

  /**
   * Registers a listener for workflow changes.
   */
  addWorkflowListener(listener: WorkflowChangeListener): () => void {
    this.workflowListeners.add(listener);
    return () => this.workflowListeners.delete(listener);
  }

  /**
   * Registers a listener for execution updates.
   */
  addExecutionListener(listener: ExecutionListener): () => void {
    this.executionListeners.add(listener);
    return () => this.executionListeners.delete(listener);
  }

  /**
   * Notifies workflow listeners.
   */
  private notifyWorkflowListeners(): void {
    for (const listener of this.workflowListeners) {
      try {
        listener(this.workflows);
      } catch (error) {
        console.error('[WorkflowManager] Listener error:', error);
      }
    }
  }

  /**
   * Notifies execution listeners.
   */
  private notifyExecutionListeners(execution: WorkflowExecution): void {
    for (const listener of this.executionListeners) {
      try {
        listener(execution);
      } catch (error) {
        console.error('[WorkflowManager] Execution listener error:', error);
      }
    }
  }

  // ============================================================================
  // IMPORT/EXPORT
  // ============================================================================

  /**
   * Exports workflows to JSON.
   */
  exportWorkflows(workflowIds?: string[]): string {
    const toExport = workflowIds
      ? this.workflows.filter(w => workflowIds.includes(w.id))
      : this.workflows;

    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workflows: toExport,
    }, null, 2);
  }

  /**
   * Imports workflows from JSON.
   */
  importWorkflows(jsonData: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(jsonData);
      const workflows = data.workflows || [];

      for (const wf of workflows) {
        try {
          // Generate new ID to avoid conflicts
          this.createWorkflow({
            ...wf,
            id: undefined, // Will generate new ID
            createdAt: undefined,
            updatedAt: undefined,
          });
          imported++;
        } catch (error: any) {
          errors.push(`Failed to import "${wf.name}": ${error.message}`);
        }
      }
    } catch (error: any) {
      errors.push(`Invalid JSON: ${error.message}`);
    }

    return { imported, errors };
  }
}

/**
 * Singleton instance with default settings.
 */
export const workflowManager = new WorkflowManager();

/**
 * Factory function to create a manager with custom settings.
 */
export function createWorkflowManager(settings?: Partial<WorkflowSettings>): WorkflowManager {
  return new WorkflowManager(settings);
}
