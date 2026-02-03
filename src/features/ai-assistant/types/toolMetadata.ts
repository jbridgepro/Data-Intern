/**
 * File: src/features/ai-assistant/types/toolMetadata.ts
 *
 * Enhanced tool metadata types for better tool organization, discovery,
 * and intelligent recommendations.
 */

/**
 * Risk level for tool operations
 */
export type ToolRiskLevel = 'safe' | 'moderate' | 'destructive';

/**
 * Expected execution time category
 */
export type ExecutionTimeCategory = 'fast' | 'medium' | 'slow';

/**
 * Tool categories for organization
 */
export enum ToolCategory {
  FILE_OPERATIONS = 'file_operations',
  DIRECTORY_OPERATIONS = 'directory_operations',
  SEARCH_AND_ANALYSIS = 'search_and_analysis',
  ORGANIZATION = 'organization',
  AGENT_MANAGEMENT = 'agent_management',
  SYSTEM_COMMANDS = 'system_commands',
  TAB_TOOLS = 'tab_tools',
  SKILLS = 'skills',
}

/**
 * Validation rule for tool parameters
 */
export interface ValidationRule {
  field: string;
  rule: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message?: string;
  validator?: (value: any) => boolean;
}

/**
 * Success criteria for tool execution
 */
export interface SuccessCriteria {
  minFilesProcessed?: number;
  requiredFields?: string[];
  validationRules?: ValidationRule[];
  customValidator?: (result: any) => boolean;
}

/**
 * JSON Schema type for output schema definition
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: JSONSchema;
  [key: string]: any;
}

/**
 * Enhanced tool metadata
 */
export interface ToolMetadata {
  // Risk and permissions
  riskLevel: ToolRiskLevel;
  requiresConfirmation?: boolean;

  // Tool relationships
  prerequisites?: string[]; // Tools that should run first
  relatedTools?: string[]; // Similar or complementary tools
  canChainWith?: string[]; // Tools that accept this tool's output

  // Performance characteristics
  expectedExecutionTime?: ExecutionTimeCategory;
  resourceIntensive?: boolean; // Memory/CPU intensive

  // Input/Output schema for chaining
  outputSchema?: JSONSchema; // What this tool produces
  acceptsInputFrom?: string[]; // Tools whose output this tool accepts

  // Success criteria
  successCriteria?: SuccessCriteria;

  // Usage guidance
  bestPractices?: string[];
  commonPitfalls?: string[];
  whenToUse?: string;
  whenNotToUse?: string;

  // Tags for better discovery
  tags?: string[];
  aliases?: string[]; // Alternative names

  // Versioning
  version?: string;
  deprecated?: boolean;
  replacedBy?: string; // Tool name if deprecated

  // UI hints
  icon?: string; // Icon name for UI
  color?: string; // Color for UI categorization
}

/**
 * Enhanced tool definition with metadata
 */
export interface EnhancedToolDefinition {
  // Core fields (Anthropic format)
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  // Category (for organization)
  category?: ToolCategory;

  // Examples
  examples?: string[];

  // Enhanced metadata
  metadata: ToolMetadata;

  // Handler function (optional, for direct execution)
  handler?: (args: Record<string, any>, context: any) => Promise<any>;
}

/**
 * Tool execution metrics
 */
export interface ToolExecutionMetrics {
  toolName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  filesProcessed?: number;
  bytesProcessed?: number;
  memoryUsed?: number;
  parameters?: Record<string, any>;
}

/**
 * Tool relationship graph
 */
export interface ToolRelationship {
  sourceool: string;
  targetTool: string;
  relationshipType: 'prerequisite' | 'related' | 'chainable' | 'alternative';
  strength: number; // 0-1, how strongly related
  description?: string;
}

/**
 * Tool discovery result
 */
export interface ToolDiscoveryResult {
  tool: EnhancedToolDefinition;
  relevanceScore: number; // 0-1
  matchReasons: string[];
  suggestedParameters?: Record<string, any>;
}

/**
 * Tool validation context
 */
export interface ToolValidationContext {
  currentDirectory: string;
  availableTools: string[];
  recentExecutions: ToolExecutionMetrics[];
  userPreferences?: Record<string, any>;
}

/**
 * Default metadata for tools without explicit metadata
 */
export const DEFAULT_TOOL_METADATA: ToolMetadata = {
  riskLevel: 'moderate',
  requiresConfirmation: false,
  expectedExecutionTime: 'medium',
  resourceIntensive: false,
  tags: [],
  aliases: [],
  deprecated: false,
};

/**
 * Helper function to create enhanced tool definition
 */
export function createEnhancedTool(
  name: string,
  description: string,
  inputSchema: Record<string, any>,
  metadata: Partial<ToolMetadata> = {},
  options: {
    category?: ToolCategory;
    examples?: string[];
    handler?: (args: Record<string, any>, context: any) => Promise<any>;
  } = {}
): EnhancedToolDefinition {
  return {
    name,
    description,
    input_schema: {
      type: 'object',
      properties: inputSchema,
      required: Object.entries(inputSchema)
        .filter(([, schema]) => (schema as any).required === true)
        .map(([key]) => key),
    },
    category: options.category,
    examples: options.examples,
    metadata: {
      ...DEFAULT_TOOL_METADATA,
      ...metadata,
    },
    handler: options.handler,
  };
}

/**
 * Tool metadata registry for quick lookups
 */
export class ToolMetadataRegistry {
  private tools: Map<string, EnhancedToolDefinition> = new Map();
  private relationships: ToolRelationship[] = [];
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> tool names
  private categoryIndex: Map<ToolCategory, Set<string>> = new Map(); // category -> tool names

  /**
   * Register a tool with the registry
   */
  register(tool: EnhancedToolDefinition): void {
    this.tools.set(tool.name, tool);

    // Update tag index
    tool.metadata.tags?.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(tool.name);
    });

    // Update category index
    if (tool.category) {
      if (!this.categoryIndex.has(tool.category)) {
        this.categoryIndex.set(tool.category, new Set());
      }
      this.categoryIndex.get(tool.category)!.add(tool.name);
    }

    // Build relationships
    this.buildRelationships(tool);
  }

  /**
   * Get tool by name
   */
  get(toolName: string): EnhancedToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get all tools
   */
  getAll(): EnhancedToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): EnhancedToolDefinition[] {
    const toolNames = this.categoryIndex.get(category) || new Set();
    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter((tool): tool is EnhancedToolDefinition => tool !== undefined);
  }

  /**
   * Get tools by tag
   */
  getByTag(tag: string): EnhancedToolDefinition[] {
    const toolNames = this.tagIndex.get(tag) || new Set();
    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter((tool): tool is EnhancedToolDefinition => tool !== undefined);
  }

  /**
   * Search tools by query
   */
  search(query: string): ToolDiscoveryResult[] {
    const lowerQuery = query.toLowerCase();
    const results: ToolDiscoveryResult[] = [];

    this.tools.forEach(tool => {
      let score = 0;
      const reasons: string[] = [];

      // Name match (highest priority)
      if (tool.name.toLowerCase().includes(lowerQuery)) {
        score += 1.0;
        reasons.push('Name match');
      }

      // Alias match
      if (tool.metadata.aliases?.some(alias => alias.toLowerCase().includes(lowerQuery))) {
        score += 0.9;
        reasons.push('Alias match');
      }

      // Description match
      if (tool.description.toLowerCase().includes(lowerQuery)) {
        score += 0.7;
        reasons.push('Description match');
      }

      // Tag match
      if (tool.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        score += 0.6;
        reasons.push('Tag match');
      }

      // Usage guidance match
      if (tool.metadata.whenToUse?.toLowerCase().includes(lowerQuery)) {
        score += 0.5;
        reasons.push('Use case match');
      }

      if (score > 0) {
        results.push({
          tool,
          relevanceScore: Math.min(score, 1.0),
          matchReasons: reasons,
        });
      }
    });

    // Sort by relevance
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get tools related to a given tool
   */
  getRelated(toolName: string): EnhancedToolDefinition[] {
    const tool = this.tools.get(toolName);
    if (!tool) return [];

    const relatedNames = new Set<string>();

    // Add explicitly related tools
    tool.metadata.relatedTools?.forEach(name => relatedNames.add(name));

    // Add tools this can chain with
    tool.metadata.canChainWith?.forEach(name => relatedNames.add(name));

    // Add tools from relationships
    this.relationships
      .filter(rel => rel.sourceTool === toolName || rel.targetTool === toolName)
      .forEach(rel => {
        relatedNames.add(rel.sourceTool === toolName ? rel.targetTool : rel.sourceTool);
      });

    return Array.from(relatedNames)
      .map(name => this.tools.get(name))
      .filter((tool): tool is EnhancedToolDefinition => tool !== undefined);
  }

  /**
   * Get tools that can accept output from a given tool
   */
  getChainableTools(toolName: string): EnhancedToolDefinition[] {
    const tool = this.tools.get(toolName);
    if (!tool) return [];

    const chainable: EnhancedToolDefinition[] = [];

    // Find tools that accept this tool's output
    this.tools.forEach(otherTool => {
      if (otherTool.name === toolName) return;

      if (otherTool.metadata.acceptsInputFrom?.includes(toolName)) {
        chainable.push(otherTool);
      }
    });

    return chainable;
  }

  /**
   * Get prerequisites for a tool
   */
  getPrerequisites(toolName: string): EnhancedToolDefinition[] {
    const tool = this.tools.get(toolName);
    if (!tool || !tool.metadata.prerequisites) return [];

    return tool.metadata.prerequisites
      .map(name => this.tools.get(name))
      .filter((tool): tool is EnhancedToolDefinition => tool !== undefined);
  }

  /**
   * Build relationship graph from tool metadata
   */
  private buildRelationships(tool: EnhancedToolDefinition): void {
    // Prerequisites
    tool.metadata.prerequisites?.forEach(prereqName => {
      this.relationships.push({
        sourceTool: prereqName,
        targetTool: tool.name,
        relationshipType: 'prerequisite',
        strength: 0.9,
        description: `${prereqName} should run before ${tool.name}`,
      });
    });

    // Related tools
    tool.metadata.relatedTools?.forEach(relatedName => {
      this.relationships.push({
        sourceTool: tool.name,
        targetTool: relatedName,
        relationshipType: 'related',
        strength: 0.7,
        description: `${tool.name} and ${relatedName} are related`,
      });
    });

    // Chainable tools
    tool.metadata.canChainWith?.forEach(chainableName => {
      this.relationships.push({
        sourceTool: tool.name,
        targetTool: chainableName,
        relationshipType: 'chainable',
        strength: 0.8,
        description: `${tool.name} output can be used by ${chainableName}`,
      });
    });
  }

  /**
   * Get relationship graph for visualization
   */
  getRelationshipGraph(): ToolRelationship[] {
    return [...this.relationships];
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.relationships = [];
    this.tagIndex.clear();
    this.categoryIndex.clear();
  }
}

/**
 * Singleton instance of the tool metadata registry
 */
export const toolMetadataRegistry = new ToolMetadataRegistry();
