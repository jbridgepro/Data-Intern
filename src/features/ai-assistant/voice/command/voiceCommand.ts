/**
 * File: src/features/ai-assistant/voice/command/voiceCommand.ts
 *
 * Voice command recognition engine for natural language processing of voice inputs.
 * Supports intent classification, entity extraction, and intelligent parameter inference.
 */

/**
 * Command intent types
 */
export type CommandIntent =
  | 'execute_tool'      // Execute a specific tool
  | 'query'             // Ask a question
  | 'navigate'          // Navigate to directory/file
  | 'approval'          // Approve an action
  | 'cancel'            // Cancel an action
  | 'help'              // Request help
  | 'clarification'     // Ask for clarification
  | 'reference'         // Reference previous action
  | 'modification'      // Modify previous command
  | 'unknown';          // Could not determine intent

/**
 * Extracted entity from voice input
 */
export interface ExtractedEntity {
  type: 'path' | 'tool' | 'strategy' | 'number' | 'date' | 'file_type' | 'text';
  value: any;
  confidence: number;
  sourceText: string; // Original text that was matched
  position?: {
    start: number;
    end: number;
  };
}

/**
 * Parsed voice command
 */
export interface VoiceCommand {
  // Core properties
  intent: CommandIntent;
  rawText: string;
  confidence: number;

  // Tool execution
  tool?: string;
  parameters?: Record<string, any>;

  // Extracted entities
  entities: ExtractedEntity[];

  // Metadata
  timestamp: number;
  processingTime?: number;

  // Context
  requiresConfirmation?: boolean;
  missingParameters?: string[];
}

/**
 * Command pattern definition
 */
interface CommandPattern {
  pattern: RegExp;
  intent: CommandIntent;
  tool?: string;
  extractors?: PatternExtractor[];
  confidence?: number;
  requiresConfirmation?: boolean;
}

/**
 * Pattern extractor function
 */
interface PatternExtractor {
  parameter: string;
  extract: (match: RegExpMatchArray, fullText: string) => any;
  type?: 'path' | 'text' | 'number' | 'array';
}

/**
 * Command patterns library
 */
export class CommandPatterns {
  /**
   * Tool execution patterns
   */
  static readonly TOOL_PATTERNS: CommandPattern[] = [
    // Organize files
    {
      pattern: /organize\s+(my\s+)?(.+?)(?:\s+folder|\s+directory|$)/i,
      intent: 'execute_tool',
      tool: 'organize_files',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[2].trim(),
          type: 'path',
        },
      ],
      requiresConfirmation: true,
    },

    // Find duplicates
    {
      pattern: /find\s+duplicates?\s+(?:in\s+)?(.+)/i,
      intent: 'execute_tool',
      tool: 'find_duplicates',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
      ],
    },

    // Search files
    {
      pattern: /(?:search\s+for|find)\s+(.+?)\s+(?:in|inside)\s+(.+)/i,
      intent: 'execute_tool',
      tool: 'search_files',
      extractors: [
        {
          parameter: 'query',
          extract: (match) => match[1].trim(),
          type: 'text',
        },
        {
          parameter: 'path',
          extract: (match) => match[2].trim(),
          type: 'path',
        },
      ],
    },

    // Delete files
    {
      pattern: /delete\s+(all\s+)?(.+?)\s+files?/i,
      intent: 'execute_tool',
      tool: 'delete_files',
      extractors: [
        {
          parameter: 'pattern',
          extract: (match) => match[2].trim(),
          type: 'text',
        },
      ],
      requiresConfirmation: true,
    },

    // Backup/Copy
    {
      pattern: /(?:backup|copy)\s+(.+?)\s+(?:to|into)\s+(.+)/i,
      intent: 'execute_tool',
      tool: 'file_copy_tab',
      extractors: [
        {
          parameter: 'sourcePath',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
        {
          parameter: 'destinationPath',
          extract: (match) => match[2].trim(),
          type: 'path',
        },
        {
          parameter: 'operation',
          extract: (match, fullText) => /backup/i.test(fullText) ? 'copy' : 'copy',
          type: 'text',
        },
      ],
      requiresConfirmation: true,
    },

    // Rename files
    {
      pattern: /rename\s+(.+?)\s+(?:to|as)\s+(.+)/i,
      intent: 'execute_tool',
      tool: 'rename_files',
      extractors: [
        {
          parameter: 'pattern',
          extract: (match) => match[1].trim(),
          type: 'text',
        },
        {
          parameter: 'newPattern',
          extract: (match) => match[2].trim(),
          type: 'text',
        },
      ],
      requiresConfirmation: true,
    },

    // Create folders
    {
      pattern: /create\s+folders?\s+(.+)/i,
      intent: 'execute_tool',
      tool: 'folder_creation_tab',
      extractors: [
        {
          parameter: 'folderNames',
          extract: (match) => match[1].split(/,|and/).map(n => n.trim()),
          type: 'array',
        },
      ],
    },

    // Analyze directory
    {
      pattern: /analyze\s+(.+)/i,
      intent: 'execute_tool',
      tool: 'analyze_directory',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
      ],
    },

    // List directory
    {
      pattern: /(?:list|show)\s+(?:contents?\s+(?:of\s+)?)?(.+)/i,
      intent: 'execute_tool',
      tool: 'list_directory_contents',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
      ],
    },
  ];

  /**
   * Query patterns
   */
  static readonly QUERY_PATTERNS: CommandPattern[] = [
    {
      pattern: /how\s+many\s+files?\s+(?:are\s+)?(?:in|inside)\s+(.+)/i,
      intent: 'query',
      tool: 'analyze_directory',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
      ],
    },
    {
      pattern: /what(?:'s| is)\s+(?:in|inside)\s+(.+)/i,
      intent: 'query',
      tool: 'list_directory_contents',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
      ],
    },
    {
      pattern: /how\s+(?:big|large)\s+is\s+(.+)/i,
      intent: 'query',
      tool: 'calculate_directory_size',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
      ],
    },
    {
      pattern: /show\s+(?:me\s+)?(.+?)\s+files?/i,
      intent: 'query',
      tool: 'search_files',
      extractors: [
        {
          parameter: 'query',
          extract: (match) => match[1].trim(),
          type: 'text',
        },
      ],
    },
  ];

  /**
   * Navigation patterns
   */
  static readonly NAVIGATION_PATTERNS: CommandPattern[] = [
    {
      pattern: /go\s+to\s+(.+)/i,
      intent: 'navigate',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
      ],
    },
    {
      pattern: /open\s+(.+)/i,
      intent: 'navigate',
      extractors: [
        {
          parameter: 'path',
          extract: (match) => match[1].trim(),
          type: 'path',
        },
      ],
    },
  ];

  /**
   * Approval patterns
   */
  static readonly APPROVAL_PATTERNS: CommandPattern[] = [
    { pattern: /^yes$/i, intent: 'approval', confidence: 1.0 },
    { pattern: /^yeah$/i, intent: 'approval', confidence: 0.9 },
    { pattern: /^yep$/i, intent: 'approval', confidence: 0.9 },
    { pattern: /^approve$/i, intent: 'approval', confidence: 1.0 },
    { pattern: /^do\s+it$/i, intent: 'approval', confidence: 1.0 },
    { pattern: /^proceed$/i, intent: 'approval', confidence: 1.0 },
    { pattern: /^continue$/i, intent: 'approval', confidence: 0.9 },
    { pattern: /^go\s+ahead$/i, intent: 'approval', confidence: 0.9 },
    { pattern: /^confirm(?:ed)?$/i, intent: 'approval', confidence: 1.0 },
    { pattern: /^(?:looks?|sounds?)\s+good$/i, intent: 'approval', confidence: 0.8 },
    { pattern: /^that(?:'s| is)\s+(?:fine|good|perfect|correct)$/i, intent: 'approval', confidence: 0.8 },
    { pattern: /^okay$/i, intent: 'approval', confidence: 0.7 },
    { pattern: /^ok$/i, intent: 'approval', confidence: 0.7 },
  ];

  /**
   * Cancellation patterns
   */
  static readonly CANCEL_PATTERNS: CommandPattern[] = [
    { pattern: /^no$/i, intent: 'cancel', confidence: 1.0 },
    { pattern: /^nope$/i, intent: 'cancel', confidence: 0.9 },
    { pattern: /^nah$/i, intent: 'cancel', confidence: 0.8 },
    { pattern: /^cancel$/i, intent: 'cancel', confidence: 1.0 },
    { pattern: /^abort$/i, intent: 'cancel', confidence: 1.0 },
    { pattern: /^stop$/i, intent: 'cancel', confidence: 0.9 },
    { pattern: /^never\s+mind$/i, intent: 'cancel', confidence: 1.0 },
    { pattern: /^don'?t$/i, intent: 'cancel', confidence: 0.8 },
    { pattern: /^wait$/i, intent: 'cancel', confidence: 0.7 },
    { pattern: /^not\s+(?:now|yet)$/i, intent: 'cancel', confidence: 0.8 },
  ];

  /**
   * Help patterns
   */
  static readonly HELP_PATTERNS: CommandPattern[] = [
    { pattern: /what\s+can\s+(?:you|I)\s+do/i, intent: 'help' },
    { pattern: /(?:help|assist|guide)\s+me/i, intent: 'help' },
    { pattern: /how\s+do(?:es)?\s+(.+)\s+work/i, intent: 'help' },
    { pattern: /show\s+(?:me\s+)?commands?/i, intent: 'help' },
    { pattern: /what\s+(?:are\s+)?(?:your\s+)?(?:commands?|capabilities)/i, intent: 'help' },
  ];

  /**
   * Reference patterns (repeat, undo, etc.)
   */
  static readonly REFERENCE_PATTERNS: CommandPattern[] = [
    { pattern: /^(?:do\s+)?(?:that\s+)?again$/i, intent: 'reference' },
    { pattern: /^repeat\s+(?:that|it)$/i, intent: 'reference' },
    { pattern: /^same\s+(?:thing|command)$/i, intent: 'reference' },
    { pattern: /^undo$/i, intent: 'reference' },
    { pattern: /^go\s+back$/i, intent: 'reference' },
  ];

  /**
   * Get all patterns
   */
  static getAllPatterns(): CommandPattern[] {
    return [
      ...this.APPROVAL_PATTERNS,
      ...this.CANCEL_PATTERNS,
      ...this.HELP_PATTERNS,
      ...this.REFERENCE_PATTERNS,
      ...this.NAVIGATION_PATTERNS,
      ...this.TOOL_PATTERNS,
      ...this.QUERY_PATTERNS,
    ];
  }
}

/**
 * Voice command recognizer
 */
export class VoiceCommandRecognizer {
  /**
   * Parse voice input into structured command
   */
  parseCommand(text: string): VoiceCommand {
    const startTime = Date.now();
    const normalizedText = this.normalizeText(text);

    // Try to match against patterns
    const match = this.matchPatterns(normalizedText);

    if (match) {
      const command: VoiceCommand = {
        intent: match.intent,
        rawText: text,
        confidence: match.confidence,
        tool: match.tool,
        parameters: match.parameters,
        entities: match.entities,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
        requiresConfirmation: match.requiresConfirmation,
        missingParameters: match.missingParameters,
      };

      return command;
    }

    // No match found
    return {
      intent: 'unknown',
      rawText: text,
      confidence: 0,
      entities: [],
      timestamp: Date.now(),
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Normalize text for better matching
   */
  private normalizeText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[.!?,;]+$/, ''); // Remove trailing punctuation
  }

  /**
   * Match text against command patterns
   */
  private matchPatterns(text: string): {
    intent: CommandIntent;
    tool?: string;
    parameters?: Record<string, any>;
    entities: ExtractedEntity[];
    confidence: number;
    requiresConfirmation?: boolean;
    missingParameters?: string[];
  } | null {
    const allPatterns = CommandPatterns.getAllPatterns();

    for (const pattern of allPatterns) {
      const match = text.match(pattern.pattern);

      if (match) {
        // Extract parameters using extractors
        const parameters: Record<string, any> = {};
        const entities: ExtractedEntity[] = [];

        if (pattern.extractors) {
          for (const extractor of pattern.extractors) {
            try {
              const value = extractor.extract(match, text);

              if (value !== undefined && value !== null) {
                parameters[extractor.parameter] = value;

                // Create entity
                entities.push({
                  type: extractor.type || 'text',
                  value,
                  confidence: 0.9,
                  sourceText: match[0],
                });
              }
            } catch (error) {
              console.warn(`Failed to extract parameter ${extractor.parameter}:`, error);
            }
          }
        }

        return {
          intent: pattern.intent,
          tool: pattern.tool,
          parameters,
          entities,
          confidence: pattern.confidence || 0.9,
          requiresConfirmation: pattern.requiresConfirmation,
        };
      }
    }

    return null;
  }

  /**
   * Check if command is approval
   */
  isApproval(text: string): boolean {
    const normalizedText = this.normalizeText(text);
    return CommandPatterns.APPROVAL_PATTERNS.some(p =>
      p.pattern.test(normalizedText)
    );
  }

  /**
   * Check if command is cancellation
   */
  isCancellation(text: string): boolean {
    const normalizedText = this.normalizeText(text);
    return CommandPatterns.CANCEL_PATTERNS.some(p =>
      p.pattern.test(normalizedText)
    );
  }
}

/**
 * Singleton instance
 */
export const voiceCommandRecognizer = new VoiceCommandRecognizer();
