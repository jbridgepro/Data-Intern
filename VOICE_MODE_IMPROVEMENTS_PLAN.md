# AI Voice Mode - Comprehensive Improvements Plan

## Executive Summary

This document outlines comprehensive improvements to the AI File Assistant's Voice Mode system. The enhancements focus on making voice interaction more intelligent, natural, and efficient by adding advanced command recognition, context awareness, analytics, and conversational memory.

---

## Current State Analysis

### Strengths
✅ **Multi-Provider Support**: Faster-Whisper, VibeVoice-ASR, Browser STT, Piper TTS
✅ **Advanced VAD**: Silero neural network-based voice activity detection
✅ **Real-time Monitoring**: Audio levels, waveform visualization
✅ **Multiple Activation Modes**: Push-to-talk, continuous, VAD
✅ **Service Health Monitoring**: Auto-recovery, dependency checking
✅ **Comprehensive Settings**: 20+ configuration options, 5 environment presets
✅ **Production Quality**: Error handling, fallback mechanisms, streaming transcription

### Current Limitations

#### 1. **Limited Command Recognition**
- ❌ **Basic Approval/Cancel Only**: Only detects "yes/no/approve/cancel" phrases
- ❌ **No Voice Shortcuts**: Cannot say "organize downloads" or "find duplicates"
- ❌ **No Intent Detection**: Doesn't understand user intent beyond basic commands
- ❌ **No Parameter Extraction**: Cannot extract values from voice ("move to folder ABC")
- ❌ **No Command Chaining**: Can't say "organize then backup"

#### 2. **No Context Awareness**
- ❌ **State-Blind**: Doesn't know current directory, recent operations, or app state
- ❌ **No Conversation Context**: Forgets what was just discussed
- ❌ **No Tool Awareness**: Doesn't suggest relevant tools based on context
- ❌ **No Smart Defaults**: Can't infer parameters from current state

#### 3. **Missing Analytics**
- ❌ **No Usage Tracking**: Don't know which commands are most used
- ❌ **No Accuracy Metrics**: Can't measure recognition accuracy
- ❌ **No Performance Data**: Latency, processing time not tracked
- ❌ **No Error Analysis**: Common misrecognitions not identified

#### 4. **Limited Conversational Ability**
- ❌ **No Multi-turn Dialogs**: Each voice command is isolated
- ❌ **No Clarification Flow**: Can't ask follow-up questions naturally
- ❌ **No Conversation Memory**: Doesn't remember previous turns
- ❌ **No Context Carryover**: Can't reference "that folder" or "those files"

#### 5. **Feedback Limitations**
- ❌ **Basic Audio Cues**: Limited feedback during processing
- ❌ **No Progress Updates**: Silent during long operations
- ❌ **No Error Guidance**: Generic error messages
- ❌ **No Learning Feedback**: System doesn't learn from corrections

---

## Improvement Plan

### Phase 1: Intelligent Voice Command System

#### 1.1 Voice Command Recognition Engine

**Natural Language Command Parser:**
```typescript
interface VoiceCommand {
  intent: CommandIntent;
  tool?: string;
  parameters?: Record<string, any>;
  confidence: number;
  rawText: string;
  entities?: ExtractedEntity[];
}

type CommandIntent =
  | 'execute_tool'      // "organize my downloads"
  | 'query'             // "how many files in downloads?"
  | 'navigate'          // "go to documents folder"
  | 'approval'          // "yes, do it"
  | 'cancel'            // "never mind"
  | 'help'              // "what can you do?"
  | 'clarification'     // "what did you mean?"
  | 'reference'         // "do that again"
  | 'modification';     // "but use strategy X instead"

interface ExtractedEntity {
  type: 'path' | 'tool' | 'strategy' | 'number' | 'date' | 'file_type';
  value: any;
  confidence: number;
  sourceText: string;
}
```

**Command Patterns Library:**
```typescript
const COMMAND_PATTERNS = {
  // Tool execution patterns
  execute_tool: [
    { pattern: /organize (my )?(\w+)/i, tool: 'organize_files', extractPath: true },
    { pattern: /find duplicates? in (\w+)/i, tool: 'find_duplicates', extractPath: true },
    { pattern: /search for (.+) in (\w+)/i, tool: 'search_files', extractQuery: true },
    { pattern: /delete (all )?(.+) files/i, tool: 'delete_files', extractPattern: true },
    { pattern: /backup (\w+) to (\w+)/i, tool: 'file_copy_tab', extractPaths: true },
    { pattern: /rename (.+) to (.+)/i, tool: 'rename_files', extractNames: true },
    { pattern: /create folder(s)? (.+)/i, tool: 'folder_creation_tab', extractNames: true },
    { pattern: /analyze (\w+)/i, tool: 'analyze_directory', extractPath: true },
  ],

  // Query patterns
  query: [
    { pattern: /how many files (in|are in) (\w+)/i, tool: 'analyze_directory' },
    { pattern: /what('s| is) in (\w+)/i, tool: 'list_directory_contents' },
    { pattern: /show me (.+) files/i, tool: 'search_files' },
    { pattern: /how (big|large) is (\w+)/i, tool: 'calculate_directory_size' },
  ],

  // Navigation patterns
  navigate: [
    { pattern: /go to (\w+)/i, action: 'change_directory' },
    { pattern: /open (\w+)/i, action: 'open_directory' },
    { pattern: /show (\w+) (folder|directory)/i, action: 'show_directory' },
  ],

  // Approval patterns (enhanced)
  approval: [
    { pattern: /^yes$/i, confidence: 1.0 },
    { pattern: /^yeah$/i, confidence: 0.9 },
    { pattern: /^approve$/i, confidence: 1.0 },
    { pattern: /^do it$/i, confidence: 1.0 },
    { pattern: /^proceed$/i, confidence: 1.0 },
    { pattern: /^continue$/i, confidence: 0.9 },
    { pattern: /^go ahead$/i, confidence: 0.9 },
    { pattern: /^confirmed?$/i, confidence: 1.0 },
    { pattern: /looks? good$/i, confidence: 0.8 },
    { pattern: /that('s| is) (fine|good|perfect|correct)$/i, confidence: 0.8 },
  ],

  // Cancellation patterns (enhanced)
  cancel: [
    { pattern: /^no$/i, confidence: 1.0 },
    { pattern: /^nope$/i, confidence: 0.9 },
    { pattern: /^cancel$/i, confidence: 1.0 },
    { pattern: /^abort$/i, confidence: 1.0 },
    { pattern: /^stop$/i, confidence: 0.9 },
    { pattern: /^never mind$/i, confidence: 1.0 },
    { pattern: /^don'?t$/i, confidence: 0.8 },
    { pattern: /^wait$/i, confidence: 0.7 },
  ],

  // Help patterns
  help: [
    { pattern: /what can (you|I) do/i },
    { pattern: /(help|assist|guide) me/i },
    { pattern: /how do(es)? (.+) work/i },
    { pattern: /show (me )?commands/i },
  ],
};
```

**Entity Extraction:**
```typescript
class EntityExtractor {
  // Extract file paths from natural language
  extractPaths(text: string, context: VoiceContext): string[] {
    const paths: string[] = [];

    // Common folder names
    const folderPatterns = [
      /downloads?/i, /documents?/i, /desktop/i,
      /pictures?/i, /photos?/i, /videos?/i,
      /music/i, /projects?/i,
    ];

    // Path references
    const pathRegex = /\/[\w\/\-_.]+/g;
    const pathMatches = text.match(pathRegex);
    if (pathMatches) paths.push(...pathMatches);

    // Relative references
    if (/\b(current|this|here)\s+(folder|directory)\b/i.test(text)) {
      paths.push(context.currentDirectory);
    }

    // Named folders
    for (const pattern of folderPatterns) {
      if (pattern.test(text)) {
        const folderName = text.match(pattern)?.[0];
        if (folderName) {
          // Try to resolve to actual path
          const resolvedPath = this.resolveFolderName(folderName, context);
          if (resolvedPath) paths.push(resolvedPath);
        }
      }
    }

    return paths;
  }

  // Extract file patterns/types
  extractFileTypes(text: string): string[] {
    const types: string[] = [];

    const typePatterns = {
      images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      documents: ['pdf', 'doc', 'docx', 'txt', 'md'],
      videos: ['mp4', 'avi', 'mkv', 'mov', 'webm'],
      audio: ['mp3', 'wav', 'flac', 'aac', 'm4a'],
      code: ['js', 'ts', 'py', 'java', 'cpp', 'rs'],
    };

    for (const [category, extensions] of Object.entries(typePatterns)) {
      if (new RegExp(category, 'i').test(text)) {
        types.push(...extensions.map(ext => `*.${ext}`));
      }
    }

    // Explicit extensions
    const extRegex = /\*?\.(\w+)/g;
    const matches = text.matchAll(extRegex);
    for (const match of matches) {
      types.push(`*.${match[1]}`);
    }

    return types;
  }

  // Extract numbers and quantities
  extractNumbers(text: string): number[] {
    const numbers: number[] = [];

    // Digit numbers
    const digitRegex = /\b(\d+)\b/g;
    const digitMatches = text.matchAll(digitRegex);
    for (const match of digitMatches) {
      numbers.push(parseInt(match[1]));
    }

    // Word numbers
    const wordNumbers: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };

    for (const [word, value] of Object.entries(wordNumbers)) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
        numbers.push(value);
      }
    }

    return numbers;
  }

  // Extract dates
  extractDates(text: string): Date[] {
    const dates: Date[] = [];

    // Relative dates
    if (/\b(today|now)\b/i.test(text)) {
      dates.push(new Date());
    }
    if (/\byesterday\b/i.test(text)) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      dates.push(yesterday);
    }
    if (/\blast (week|month|year)\b/i.test(text)) {
      const lastPeriod = new Date();
      if (/week/i.test(text)) lastPeriod.setDate(lastPeriod.getDate() - 7);
      if (/month/i.test(text)) lastPeriod.setMonth(lastPeriod.getMonth() - 1);
      if (/year/i.test(text)) lastPeriod.setFullYear(lastPeriod.getFullYear() - 1);
      dates.push(lastPeriod);
    }

    // Absolute dates (YYYY-MM-DD, MM/DD/YYYY)
    const dateRegex = /\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
    const dateMatches = text.matchAll(dateRegex);
    for (const match of dateMatches) {
      if (match[1]) {
        // YYYY-MM-DD
        dates.push(new Date(match[1], parseInt(match[2]) - 1, match[3]));
      } else if (match[4]) {
        // MM/DD/YYYY
        dates.push(new Date(match[6], parseInt(match[4]) - 1, match[5]));
      }
    }

    return dates;
  }
}
```

#### 1.2 Voice Shortcuts System

**Predefined Voice Shortcuts:**
```typescript
interface VoiceShortcut {
  id: string;
  phrases: string[]; // Trigger phrases
  description: string;
  action: VoiceShortcutAction;
  category: 'organization' | 'search' | 'navigation' | 'system' | 'custom';
  requiresConfirmation?: boolean;
}

type VoiceShortcutAction =
  | { type: 'execute_tool'; tool: string; parameters: Record<string, any> }
  | { type: 'execute_workflow'; workflowId: string }
  | { type: 'execute_pipeline'; pipelineId: string }
  | { type: 'navigate'; path: string }
  | { type: 'custom_function'; handler: () => Promise<void> };

const BUILTIN_SHORTCUTS: VoiceShortcut[] = [
  {
    id: 'organize-downloads',
    phrases: ['organize downloads', 'clean up downloads', 'sort downloads'],
    description: 'Organize files in Downloads folder by type',
    action: {
      type: 'execute_tool',
      tool: 'organize_files',
      parameters: {
        path: '~/Downloads',
        strategy: 'by-type',
      },
    },
    category: 'organization',
    requiresConfirmation: true,
  },
  {
    id: 'find-large-files',
    phrases: ['find large files', 'show big files', 'what\'s taking space'],
    description: 'Find files larger than 100MB',
    action: {
      type: 'execute_tool',
      tool: 'search_files',
      parameters: {
        path: '~/',
        minSize: '100MB',
      },
    },
    category: 'search',
  },
  {
    id: 'cleanup-duplicates',
    phrases: ['find duplicates', 'remove duplicates', 'clean duplicates'],
    description: 'Find and remove duplicate files',
    action: {
      type: 'execute_workflow',
      workflowId: 'builtin-cleanup-duplicates',
    },
    category: 'organization',
    requiresConfirmation: true,
  },
  {
    id: 'backup-documents',
    phrases: ['backup documents', 'backup my docs', 'save documents'],
    description: 'Backup Documents folder',
    action: {
      type: 'execute_workflow',
      workflowId: 'builtin-backup-folder',
    },
    category: 'organization',
    requiresConfirmation: true,
  },
  {
    id: 'show-recent-files',
    phrases: ['show recent files', 'what\'s new', 'recent changes'],
    description: 'List files modified in last 24 hours',
    action: {
      type: 'execute_tool',
      tool: 'search_files',
      parameters: {
        modifiedAfter: '24h',
      },
    },
    category: 'search',
  },
];
```

**Custom Shortcut Creation:**
```typescript
class VoiceShortcutManager {
  private shortcuts: Map<string, VoiceShortcut> = new Map();

  // Create custom shortcut
  createShortcut(shortcut: VoiceShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
    this.saveToStorage();
  }

  // Match voice input to shortcuts
  matchShortcut(text: string): VoiceShortcut | null {
    const normalizedText = text.toLowerCase().trim();

    for (const shortcut of this.shortcuts.values()) {
      for (const phrase of shortcut.phrases) {
        const normalizedPhrase = phrase.toLowerCase().trim();

        // Exact match
        if (normalizedText === normalizedPhrase) {
          return shortcut;
        }

        // Fuzzy match (allows minor variations)
        const similarity = this.calculateSimilarity(normalizedText, normalizedPhrase);
        if (similarity > 0.85) {
          return shortcut;
        }
      }
    }

    return null;
  }

  // Calculate string similarity (Levenshtein distance)
  private calculateSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
}
```

---

### Phase 2: Context-Aware Voice Assistant

#### 2.1 Voice Context System

**Context Structure:**
```typescript
interface VoiceContext {
  // Current state
  currentDirectory: string;
  currentFile?: string;
  recentFiles: string[];
  recentDirectories: string[];

  // Recent operations
  recentOperations: Array<{
    tool: string;
    parameters: Record<string, any>;
    result: any;
    timestamp: number;
  }>;

  // Conversation history
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
    command?: VoiceCommand;
  }>;

  // Pending operations
  pendingOperation?: {
    tool: string;
    parameters: Record<string, any>;
    needsConfirmation: boolean;
  };

  // Application state
  selectedFiles: string[];
  activeTab: string;
  openPanels: string[];

  // User preferences (learned)
  preferredStrategy?: string;
  commonPaths: Map<string, string>; // alias -> path
  voiceHistory: Map<string, number>; // command -> usage count
}
```

**Context Manager:**
```typescript
class VoiceContextManager {
  private context: VoiceContext;

  // Update context from app state
  updateFromAppState(appState: {
    currentDirectory: string;
    selectedFiles: string[];
    activeTab: string;
    // ...
  }): void {
    this.context.currentDirectory = appState.currentDirectory;
    this.context.selectedFiles = appState.selectedFiles;
    this.context.activeTab = appState.activeTab;
  }

  // Add to conversation history
  addConversationTurn(role: 'user' | 'assistant', text: string, command?: VoiceCommand): void {
    this.context.conversationHistory.push({
      role,
      text,
      timestamp: Date.now(),
      command,
    });

    // Keep last 50 turns
    if (this.context.conversationHistory.length > 50) {
      this.context.conversationHistory.shift();
    }
  }

  // Resolve references (e.g., "that folder", "those files")
  resolveReference(text: string): any {
    // "that folder" → last mentioned folder
    if (/that (folder|directory)/i.test(text)) {
      return this.context.recentDirectories[0];
    }

    // "those files" → recently mentioned files
    if (/those files?/i.test(text)) {
      return this.context.selectedFiles.length > 0
        ? this.context.selectedFiles
        : this.context.recentFiles;
    }

    // "the result" → last operation result
    if (/the result/i.test(text)) {
      return this.context.recentOperations[0]?.result;
    }

    // "again" → last operation
    if (/\bagain\b/i.test(text)) {
      return this.context.recentOperations[0];
    }

    return null;
  }

  // Get context hints for command recognition
  getContextHints(): {
    likelyTools: string[];
    likelyPaths: string[];
    recentCommands: string[];
  } {
    return {
      likelyTools: this.getMostUsedTools(),
      likelyPaths: [
        this.context.currentDirectory,
        ...this.context.recentDirectories.slice(0, 5),
      ],
      recentCommands: this.context.conversationHistory
        .filter(t => t.role === 'user' && t.command)
        .slice(-5)
        .map(t => t.text),
    };
  }

  private getMostUsedTools(): string[] {
    const toolCounts = new Map<string, number>();

    this.context.recentOperations.forEach(op => {
      toolCounts.set(op.tool, (toolCounts.get(op.tool) || 0) + 1);
    });

    return Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool]) => tool);
  }
}
```

#### 2.2 Smart Parameter Inference

**Automatic Parameter Filling:**
```typescript
class ParameterInference {
  inferParameters(
    tool: string,
    extractedEntities: ExtractedEntity[],
    context: VoiceContext
  ): Record<string, any> {
    const parameters: Record<string, any> = {};

    // Get tool definition
    const toolDef = this.getToolDefinition(tool);
    if (!toolDef) return parameters;

    // Fill from extracted entities
    extractedEntities.forEach(entity => {
      const paramName = this.mapEntityToParameter(entity.type, toolDef);
      if (paramName) {
        parameters[paramName] = entity.value;
      }
    });

    // Infer missing parameters from context
    for (const [paramName, paramSchema] of Object.entries(toolDef.input_schema.properties)) {
      if (parameters[paramName]) continue; // Already filled

      // Path parameters
      if (paramSchema.type === 'path' || paramName.includes('path')) {
        if (!parameters[paramName]) {
          parameters[paramName] = context.currentDirectory;
        }
      }

      // Strategy parameters
      if (paramName === 'strategy' && context.preferredStrategy) {
        parameters[paramName] = context.preferredStrategy;
      }

      // File types from recent operations
      if (paramName === 'fileTypes') {
        const recentFileOp = context.recentOperations
          .find(op => op.parameters.fileTypes);
        if (recentFileOp) {
          parameters[paramName] = recentFileOp.parameters.fileTypes;
        }
      }
    }

    return parameters;
  }
}
```

---

### Phase 3: Voice Analytics System

#### 3.1 Voice Usage Analytics

**Metrics to Track:**
```typescript
interface VoiceAnalytics {
  // Usage metrics
  totalVoiceCommands: number;
  successfulCommands: number;
  failedCommands: number;
  successRate: number;

  // Recognition accuracy
  avgConfidence: number;
  lowConfidenceCount: number; // < 0.7
  misrecognitions: Array<{
    intended: string;
    recognized: string;
    count: number;
  }>;

  // Performance metrics
  avgTranscriptionTime: number;
  avgResponseTime: number;
  avgTotalInteractionTime: number;

  // Command analytics
  commandUsage: Map<string, number>; // command → count
  shortcutUsage: Map<string, number>; // shortcut id → count
  toolUsage: Map<string, number>; // tool → count

  // Error analysis
  commonErrors: Array<{
    error: string;
    count: number;
    lastOccurrence: number;
  }>;

  // Session analytics
  avgCommandsPerSession: number;
  avgSessionDuration: number;
  peakUsageHours: number[]; // Hours with most usage

  // User satisfaction (implicit)
  canceledCommands: number; // User said "cancel" or "no"
  correctionCount: number; // User corrected recognition
  repeatCount: number; // User repeated command
}
```

**Analytics Tracking:**
```typescript
class VoiceAnalyticsManager {
  private analytics: VoiceAnalytics;
  private sessionStart: number = 0;

  recordCommand(command: VoiceCommand, success: boolean, error?: string): void {
    this.analytics.totalVoiceCommands++;

    if (success) {
      this.analytics.successfulCommands++;
    } else {
      this.analytics.failedCommands++;
      if (error) {
        this.recordError(error);
      }
    }

    this.analytics.successRate =
      (this.analytics.successfulCommands / this.analytics.totalVoiceCommands) * 100;

    // Track command usage
    const commandKey = `${command.intent}:${command.tool || 'none'}`;
    this.analytics.commandUsage.set(
      commandKey,
      (this.analytics.commandUsage.get(commandKey) || 0) + 1
    );

    // Track confidence
    this.updateConfidenceMetrics(command.confidence);

    this.saveToStorage();
  }

  recordMisrecognition(intended: string, recognized: string): void {
    const existing = this.analytics.misrecognitions.find(
      m => m.intended === intended && m.recognized === recognized
    );

    if (existing) {
      existing.count++;
    } else {
      this.analytics.misrecognitions.push({ intended, recognized, count: 1 });
    }

    this.saveToStorage();
  }

  recordPerformance(transcriptionTime: number, responseTime: number): void {
    // Update moving average
    const total = this.analytics.totalVoiceCommands;
    this.analytics.avgTranscriptionTime =
      (this.analytics.avgTranscriptionTime * (total - 1) + transcriptionTime) / total;
    this.analytics.avgResponseTime =
      (this.analytics.avgResponseTime * (total - 1) + responseTime) / total;

    this.saveToStorage();
  }

  // Get insights
  getInsights(): VoiceInsight[] {
    const insights: VoiceInsight[] = [];

    // Low success rate
    if (this.analytics.successRate < 70) {
      insights.push({
        type: 'warning',
        category: 'accuracy',
        message: `Voice command success rate is low (${this.analytics.successRate.toFixed(1)}%)`,
        suggestion: 'Consider adjusting microphone sensitivity or reducing background noise',
      });
    }

    // High misrecognition rate
    const topMisrecognitions = this.analytics.misrecognitions
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    if (topMisrecognitions.length > 0 && topMisrecognitions[0].count > 5) {
      insights.push({
        type: 'info',
        category: 'recognition',
        message: `Frequently misrecognizes "${topMisrecognitions[0].intended}" as "${topMisrecognitions[0].recognized}"`,
        suggestion: 'Try using alternative phrasing or adding a custom voice shortcut',
      });
    }

    // Slow performance
    if (this.analytics.avgTranscriptionTime > 3000) {
      insights.push({
        type: 'warning',
        category: 'performance',
        message: `Transcription is slow (${(this.analytics.avgTranscriptionTime / 1000).toFixed(1)}s avg)`,
        suggestion: 'Consider using a smaller Whisper model or enabling GPU acceleration',
      });
    }

    // Most used commands
    const mostUsedCommand = Array.from(this.analytics.commandUsage.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (mostUsedCommand && mostUsedCommand[1] > 10) {
      insights.push({
        type: 'tip',
        category: 'usage',
        message: `Your most used command is "${mostUsedCommand[0]}" (${mostUsedCommand[1]} times)`,
        suggestion: 'Consider creating a custom shortcut for faster access',
      });
    }

    return insights;
  }
}
```

---

### Phase 4: Conversation Memory & Multi-turn Dialogs

#### 4.1 Conversation Memory

**Memory Structure:**
```typescript
interface ConversationMemory {
  id: string;
  sessionId: string;
  startTime: number;
  endTime?: number;

  // Conversation turns
  turns: Array<{
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
    command?: VoiceCommand;
    toolExecution?: {
      tool: string;
      parameters: Record<string, any>;
      result: any;
      success: boolean;
    };
  }>;

  // Extracted facts
  facts: Array<{
    key: string;
    value: any;
    source: 'user_stated' | 'inferred' | 'system';
    confidence: number;
    timestamp: number;
  }>;

  // Pending questions
  pendingQuestions: ClarificationQuestion[];

  // Session summary
  summary?: string;
  topics?: string[];
  keyActions?: string[];
}
```

**Memory Manager:**
```typescript
class ConversationMemoryManager {
  private currentSession: ConversationMemory | null = null;
  private sessions: Map<string, ConversationMemory> = new Map();

  // Start new session
  startSession(): string {
    const sessionId = `session-${Date.now()}`;
    this.currentSession = {
      id: sessionId,
      sessionId,
      startTime: Date.now(),
      turns: [],
      facts: [],
      pendingQuestions: [],
    };

    this.sessions.set(sessionId, this.currentSession);
    return sessionId;
  }

  // Add conversation turn
  addTurn(role: 'user' | 'assistant', text: string, metadata?: any): void {
    if (!this.currentSession) return;

    const turn = {
      id: `turn-${Date.now()}`,
      role,
      text,
      timestamp: Date.now(),
      ...metadata,
    };

    this.currentSession.turns.push(turn);

    // Extract facts from user input
    if (role === 'user') {
      this.extractFacts(text);
    }

    this.saveToStorage();
  }

  // Extract facts from conversation
  private extractFacts(text: string): void {
    if (!this.currentSession) return;

    // Preference extraction
    if (/I (prefer|like|want|usually use)(.+)strategy/i.test(text)) {
      const strategyMatch = text.match(/I (prefer|like|want|usually use) (.+) strategy/i);
      if (strategyMatch) {
        this.currentSession.facts.push({
          key: 'preferred_strategy',
          value: strategyMatch[2].trim(),
          source: 'user_stated',
          confidence: 0.9,
          timestamp: Date.now(),
        });
      }
    }

    // Path aliases
    if (/call (.+) "(.+)"|(.+) is called "(.+)"/i.test(text)) {
      const aliasMatch = text.match(/call (.+) "(.+)"|(.+) is called "(.+)"/i);
      if (aliasMatch) {
        this.currentSession.facts.push({
          key: 'path_alias',
          value: { path: aliasMatch[1] || aliasMatch[3], alias: aliasMatch[2] || aliasMatch[4] },
          source: 'user_stated',
          confidence: 1.0,
          timestamp: Date.now(),
        });
      }
    }

    // Default settings
    if (/always (.+) when (organizing|searching|backing up)/i.test(text)) {
      const defaultMatch = text.match(/always (.+) when (organizing|searching|backing up)/i);
      if (defaultMatch) {
        this.currentSession.facts.push({
          key: `default_${defaultMatch[2].toLowerCase()}`,
          value: defaultMatch[1].trim(),
          source: 'user_stated',
          confidence: 0.8,
          timestamp: Date.now(),
        });
      }
    }
  }

  // Get fact by key
  getFact(key: string): any {
    if (!this.currentSession) return null;

    const fact = this.currentSession.facts
      .filter(f => f.key === key)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    return fact?.value;
  }

  // Get conversation context for AI
  getContextForAI(maxTurns: number = 10): string {
    if (!this.currentSession) return '';

    const recentTurns = this.currentSession.turns.slice(-maxTurns);

    return recentTurns
      .map(turn => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`)
      .join('\n');
  }

  // Generate session summary (using AI)
  async generateSummary(): Promise<string> {
    if (!this.currentSession) return '';

    const context = this.getContextForAI();

    // Use AI to summarize
    const summary = await this.summarizeWithAI(context);

    this.currentSession.summary = summary;
    this.saveToStorage();

    return summary;
  }
}
```

#### 4.2 Multi-turn Dialog System

**Dialog State Machine:**
```typescript
type DialogState =
  | 'idle'
  | 'collecting_parameters'
  | 'asking_clarification'
  | 'confirming_action'
  | 'executing'
  | 'showing_results';

interface DialogContext {
  state: DialogState;
  intent: CommandIntent;
  tool?: string;
  parameters: Record<string, any>;
  missingParameters: string[];
  clarificationQuestions: ClarificationQuestion[];
  currentQuestionIndex: number;
}

class MultiTurnDialogManager {
  private dialogContext: DialogContext | null = null;

  // Start multi-turn dialog
  startDialog(command: VoiceCommand): void {
    const toolDef = this.getToolDefinition(command.tool!);
    const requiredParams = toolDef.input_schema.required || [];
    const providedParams = Object.keys(command.parameters || {});
    const missing = requiredParams.filter(p => !providedParams.includes(p));

    this.dialogContext = {
      state: missing.length > 0 ? 'collecting_parameters' : 'confirming_action',
      intent: command.intent,
      tool: command.tool,
      parameters: command.parameters || {},
      missingParameters: missing,
      clarificationQuestions: this.generateQuestions(missing, toolDef),
      currentQuestionIndex: 0,
    };
  }

  // Handle user response in dialog
  handleResponse(text: string): DialogAction {
    if (!this.dialogContext) {
      return { type: 'none' };
    }

    switch (this.dialogContext.state) {
      case 'collecting_parameters':
        return this.handleParameterCollection(text);

      case 'asking_clarification':
        return this.handleClarification(text);

      case 'confirming_action':
        return this.handleConfirmation(text);

      default:
        return { type: 'none' };
    }
  }

  // Handle parameter collection
  private handleParameterCollection(text: string): DialogAction {
    if (!this.dialogContext) return { type: 'none' };

    const currentQuestion = this.dialogContext.clarificationQuestions[
      this.dialogContext.currentQuestionIndex
    ];

    // Extract answer
    const answer = this.extractAnswer(text, currentQuestion);

    if (answer !== null) {
      // Store parameter
      const paramName = this.dialogContext.missingParameters[
        this.dialogContext.currentQuestionIndex
      ];
      this.dialogContext.parameters[paramName] = answer;

      // Move to next question
      this.dialogContext.currentQuestionIndex++;

      if (this.dialogContext.currentQuestionIndex >= this.dialogContext.clarificationQuestions.length) {
        // All parameters collected
        this.dialogContext.state = 'confirming_action';
        return {
          type: 'ask_confirmation',
          message: this.generateConfirmationMessage(),
        };
      } else {
        // Ask next question
        return {
          type: 'ask_question',
          question: this.dialogContext.clarificationQuestions[this.dialogContext.currentQuestionIndex],
        };
      }
    } else {
      // Couldn't understand answer
      return {
        type: 'clarify',
        message: "I didn't understand that. " + currentQuestion.question,
      };
    }
  }

  // Generate confirmation message
  private generateConfirmationMessage(): string {
    if (!this.dialogContext) return '';

    const tool = this.dialogContext.tool;
    const params = this.dialogContext.parameters;

    // Build human-readable confirmation
    let message = `I'm going to ${tool?.replace(/_/g, ' ')}`;

    // Add key parameters
    if (params.path) {
      message += ` in ${params.path}`;
    }
    if (params.strategy) {
      message += ` using ${params.strategy} strategy`;
    }
    if (params.fileTypes) {
      message += ` for ${params.fileTypes.join(', ')} files`;
    }

    message += '. Should I proceed?';

    return message;
  }
}
```

---

### Phase 5: Enhanced Feedback System

#### 5.1 Audio Feedback

**Audio Cues:**
```typescript
interface AudioCue {
  id: string;
  file: string;
  description: string;
  category: 'success' | 'error' | 'info' | 'warning';
}

const AUDIO_CUES: AudioCue[] = [
  { id: 'listening_start', file: 'beep_short.mp3', description: 'Started listening', category: 'info' },
  { id: 'listening_stop', file: 'beep_end.mp3', description: 'Stopped listening', category: 'info' },
  { id: 'command_recognized', file: 'ding.mp3', description: 'Command recognized', category: 'success' },
  { id: 'processing', file: 'processing.mp3', description: 'Processing command', category: 'info' },
  { id: 'success', file: 'success.mp3', description: 'Operation successful', category: 'success' },
  { id: 'error', file: 'error.mp3', description: 'Error occurred', category: 'error' },
  { id: 'question', file: 'question.mp3', description: 'Asking clarification', category: 'info' },
];

class AudioFeedbackManager {
  private audioContext: AudioContext;
  private soundCache: Map<string, AudioBuffer> = new Map();

  async playAudioCue(cueId: string, volume: number = 0.5): Promise<void> {
    const cue = AUDIO_CUES.find(c => c.id === cueId);
    if (!cue) return;

    // Load and play sound
    const buffer = await this.loadSound(cue.file);
    if (buffer) {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = buffer;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    }
  }
}
```

#### 5.2 Progress Updates

**Voice Progress Announcements:**
```typescript
class VoiceProgressAnnouncer {
  private settings: VoiceSettings;
  private ttsService: TextToSpeechService;

  // Announce progress during long operations
  async announceProgress(operation: string, progress: number, total: number): Promise<void> {
    // Only announce if voice output enabled
    if (!this.settings.voiceOutputEnabled) return;

    // Check update frequency
    const shouldAnnounce = this.shouldAnnounceProgress(progress, total);
    if (!shouldAnnounce) return;

    const percentComplete = Math.round((progress / total) * 100);
    let message = '';

    switch (this.settings.updateFrequency) {
      case 'verbose':
        message = `${operation}: ${progress} of ${total} complete (${percentComplete}%)`;
        break;

      case 'milestones':
        // Announce at 25%, 50%, 75%
        if ([25, 50, 75].includes(percentComplete)) {
          message = `${percentComplete}% complete`;
        }
        break;

      case 'completion-only':
        if (progress === total) {
          message = `${operation} complete`;
        }
        break;

      case 'silent':
        return;
    }

    if (message) {
      await this.ttsService.speak(message);
    }
  }
}
```

---

### Phase 6: Learning & Adaptation

#### 6.1 Command Learning

**Learn from Corrections:**
```typescript
class CommandLearningSystem {
  // Track when user corrects recognition
  recordCorrection(recognized: string, corrected: string): void {
    // Store correction pattern
    this.storePattern({
      type: 'correction',
      from: recognized,
      to: corrected,
      timestamp: Date.now(),
    });

    // Update recognition model (if applicable)
    this.updateRecognitionWeights(recognized, corrected);
  }

  // Learn from usage patterns
  learnFromUsage(command: VoiceCommand, success: boolean): void {
    if (success) {
      // Increase confidence in this pattern
      this.boostPattern(command.rawText, command);
    } else {
      // Decrease confidence
      this.penalizePattern(command.rawText);
    }
  }

  // Suggest improvements
  suggestImprovements(): string[] {
    const suggestions: string[] = [];

    // Suggest shortcuts for frequently repeated commands
    const frequentCommands = this.getFrequentCommands();
    frequentCommands.forEach(cmd => {
      if (!this.hasShortcut(cmd.pattern)) {
        suggestions.push(
          `Create a shortcut for "${cmd.pattern}" (used ${cmd.count} times)`
        );
      }
    });

    // Suggest alternative phrasing for low-confidence commands
    const lowConfidenceCommands = this.getLowConfidenceCommands();
    lowConfidenceCommands.forEach(cmd => {
      suggestions.push(
        `Try rephrasing "${cmd.pattern}" for better recognition`
      );
    });

    return suggestions;
  }
}
```

---

## Implementation Roadmap

### **Sprint 1** (Week 1-2): Command Recognition
- ✅ Voice command parser
- ✅ Entity extraction
- ✅ Pattern matching
- ✅ Intent classification

### **Sprint 2** (Week 3-4): Voice Shortcuts
- ✅ Built-in shortcuts
- ✅ Custom shortcut creation
- ✅ Shortcut matching algorithm
- ✅ Shortcut management UI

### **Sprint 3** (Week 5-6): Context Awareness
- ✅ Context manager
- ✅ Parameter inference
- ✅ Reference resolution
- ✅ App state integration

### **Sprint 4** (Week 7-8): Analytics
- ✅ Usage tracking
- ✅ Performance metrics
- ✅ Accuracy measurements
- ✅ Insights generation

### **Sprint 5** (Week 9-10): Conversation Memory
- ✅ Memory manager
- ✅ Fact extraction
- ✅ Session summaries
- ✅ Multi-turn dialogs

### **Sprint 6** (Week 11-12): Enhanced Feedback
- ✅ Audio cues
- ✅ Progress announcements
- ✅ Error guidance
- ✅ Visual feedback improvements

### **Sprint 7** (Week 13-14): Learning & Polish
- ✅ Command learning
- ✅ Pattern adaptation
- ✅ Suggestion system
- ✅ Comprehensive documentation

---

## Success Metrics

### User Experience
- 📈 **Command Success Rate**: Increase from ~70% to 90%+
- ⏱️ **Recognition Speed**: Reduce latency from 3s to <1s
- 🎯 **Natural Language Understanding**: 85%+ intent accuracy
- 💬 **Multi-turn Success**: 80%+ successful multi-turn dialogs

### System Performance
- ⚡ **Response Time**: <500ms for command parsing
- 🎤 **Recognition Accuracy**: 90%+ confidence on average
- 💾 **Memory Efficiency**: <50MB additional memory
- 🔋 **Battery Impact**: <5% additional drain

### Feature Adoption
- 🚀 **Shortcut Usage**: 40%+ of commands use shortcuts
- 🔗 **Context Usage**: 60%+ commands use context
- 📊 **Analytics Engagement**: 30%+ users view insights
- 💡 **Learning Rate**: 50%+ accuracy improvement after 100 commands

---

## Technical Architecture

### New Components

```
src/features/ai-assistant/voice/
├── command/
│   ├── commandParser.ts          # Natural language parsing
│   ├── entityExtractor.ts        # Entity extraction
│   ├── intentClassifier.ts       # Intent classification
│   └── parameterInference.ts     # Smart parameter filling
│
├── shortcuts/
│   ├── shortcutManager.ts        # Shortcut management
│   ├── builtinShortcuts.ts       # Predefined shortcuts
│   └── shortcutMatcher.ts        # Matching algorithm
│
├── context/
│   ├── voiceContext.ts           # Context management
│   ├── referenceResolver.ts     # "that folder" resolution
│   └── appStateIntegration.ts    # App state sync
│
├── analytics/
│   ├── voiceAnalytics.ts         # Usage tracking
│   ├── accuracyMetrics.ts        # Recognition metrics
│   └── insightsGenerator.ts      # Analytics insights
│
├── memory/
│   ├── conversationMemory.ts     # Memory management
│   ├── factExtractor.ts          # Fact extraction
│   └── dialogManager.ts          # Multi-turn dialogs
│
├── feedback/
│   ├── audioFeedback.ts          # Audio cues
│   ├── progressAnnouncer.ts      # Progress updates
│   └── errorGuidance.ts          # Error messages
│
└── learning/
    ├── commandLearning.ts        # Pattern learning
    ├── correctionTracking.ts     # User corrections
    └── suggestionEngine.ts       # Improvement suggestions
```

---

## Migration Strategy

### Backward Compatibility
- ✅ Existing voice commands continue to work
- ✅ Settings preserved during upgrade
- ✅ Gradual feature rollout
- ✅ Opt-in for advanced features

### Gradual Rollout
1. **Phase 1**: Backend improvements (command parsing, context)
2. **Phase 2**: Opt-in features (shortcuts, analytics)
3. **Phase 3**: Full feature rollout
4. **Phase 4**: Learning and adaptation

---

## Conclusion

These comprehensive improvements transform the Voice Mode from a basic speech-to-text system into an intelligent, context-aware voice assistant that understands natural language, remembers conversations, learns from usage, and provides sophisticated multi-turn dialogs. The enhancements make voice interaction significantly more powerful and user-friendly.

---

**Document Version**: 1.0
**Last Updated**: 2026-01-31
**Author**: AI File Assistant Development Team
