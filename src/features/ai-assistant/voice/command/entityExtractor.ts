/**
 * File: src/features/ai-assistant/voice/command/entityExtractor.ts
 *
 * Entity extraction from natural language voice commands.
 * Extracts paths, file types, numbers, dates, and other structured data.
 */

import type { ExtractedEntity } from './voiceCommand';

/**
 * Voice context for entity resolution
 */
export interface VoiceContext {
  currentDirectory: string;
  recentPaths: string[];
  userHomeDirectory: string;
  commonFolders: Map<string, string>; // name -> path
}

/**
 * Entity extractor class
 */
export class EntityExtractor {
  private context: VoiceContext;

  constructor(context: VoiceContext) {
    this.context = context;
  }

  /**
   * Update context
   */
  updateContext(context: Partial<VoiceContext>): void {
    this.context = {... this.context, ...context};
  }

  /**
   * Extract all entities from text
   */
  extractAll(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Extract in order of specificity
    entities.push(...this.extractPaths(text));
    entities.push(...this.extractFileTypes(text));
    entities.push(...this.extractNumbers(text));
    entities.push(...this.extractDates(text));
    entities.push(...this.extractStrategies(text));

    return entities;
  }

  /**
   * Extract file paths from text
   */
  extractPaths(text: string): ExtractedEntity[] {
    const paths: ExtractedEntity[] = [];

    // Explicit paths (absolute or relative)
    const pathRegex = /(?:\/[\w\/\-_.]+|~\/[\w\/\-_.]*|\.\/[\w\/\-_.]+)/g;
    let pathMatch;

    while ((pathMatch = pathRegex.exec(text)) !== null) {
      paths.push({
        type: 'path',
        value: this.normalizePath(pathMatch[0]),
        confidence: 1.0,
        sourceText: pathMatch[0],
        position: {
          start: pathMatch.index,
          end: pathMatch.index + pathMatch[0].length,
        },
      });
    }

    // Common folder names
    const folderPatterns: Array<[RegExp, string]> = [
      [/\bdownloads?\b/i, 'Downloads'],
      [/\bdocuments?\b/i, 'Documents'],
      [/\bdesktop\b/i, 'Desktop'],
      [/\bpictures?\b|\bphotos?\b/i, 'Pictures'],
      [/\bvideos?\b/i, 'Videos'],
      [/\bmusic\b/i, 'Music'],
      [/\bprojects?\b/i, 'Projects'],
    ];

    for (const [pattern, folderName] of folderPatterns) {
      const match = text.match(pattern);
      if (match) {
        const resolvedPath = this.resolveFolderName(folderName);
        if (resolvedPath) {
          paths.push({
            type: 'path',
            value: resolvedPath,
            confidence: 0.9,
            sourceText: match[0],
          });
        }
      }
    }

    // Relative references
    const relativePatterns: Array<[RegExp, () => string]> = [
      [/\b(?:current|this|here)\s+(?:folder|directory)\b/i, () => this.context.currentDirectory],
      [/\bparent\s+(?:folder|directory)\b/i, () => this.getParentDirectory(this.context.currentDirectory)],
      [/\bhome\s+(?:folder|directory)?\b/i, () => this.context.userHomeDirectory],
    ];

    for (const [pattern, resolver] of relativePatterns) {
      const match = text.match(pattern);
      if (match) {
        paths.push({
          type: 'path',
          value: resolver(),
          confidence: 0.85,
          sourceText: match[0],
        });
      }
    }

    return paths;
  }

  /**
   * Extract file types/extensions
   */
  extractFileTypes(text: string): ExtractedEntity[] {
    const types: ExtractedEntity[] = [];

    // Category-based file types
    const typeCategories: Record<string, string[]> = {
      images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'],
      documents: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'],
      videos: ['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv'],
      audio: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'],
      code: ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'rs', 'go', 'php', 'rb', 'swift'],
      archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
    };

    for (const [category, extensions] of Object.entries(typeCategories)) {
      const pattern = new RegExp(`\\b${category}\\b`, 'i');
      const match = text.match(pattern);

      if (match) {
        types.push({
          type: 'file_type',
          value: extensions.map(ext => `*.${ext}`),
          confidence: 0.9,
          sourceText: match[0],
        });
      }
    }

    // Explicit extensions
    const extRegex = /\*?\.(\w+)\b/g;
    let extMatch;

    while ((extMatch = extRegex.exec(text)) !== null) {
      types.push({
        type: 'file_type',
        value: [`*.${extMatch[1]}`],
        confidence: 1.0,
        sourceText: extMatch[0],
        position: {
          start: extMatch.index,
          end: extMatch.index + extMatch[0].length,
        },
      });
    }

    // File type keywords
    const fileTypeKeywords: Array<[RegExp, string[]]> = [
      [/\btext\s+files?\b/i, ['*.txt', '*.md']],
      [/\bspreadsheets?\b/i, ['*.xlsx', '*.xls', '*.csv']],
      [/\bpresentations?\b/i, ['*.pptx', '*.ppt']],
      [/\bpdf\s+files?\b/i, ['*.pdf']],
    ];

    for (const [pattern, extensions] of fileTypeKeywords) {
      const match = text.match(pattern);
      if (match) {
        types.push({
          type: 'file_type',
          value: extensions,
          confidence: 0.95,
          sourceText: match[0],
        });
      }
    }

    return types;
  }

  /**
   * Extract numbers from text
   */
  extractNumbers(text: string): ExtractedEntity[] {
    const numbers: ExtractedEntity[] = [];

    // Digit numbers
    const digitRegex = /\b(\d+)\b/g;
    let digitMatch;

    while ((digitMatch = digitRegex.exec(text)) !== null) {
      numbers.push({
        type: 'number',
        value: parseInt(digitMatch[1]),
        confidence: 1.0,
        sourceText: digitMatch[0],
        position: {
          start: digitMatch.index,
          end: digitMatch.index + digitMatch[0].length,
        },
      });
    }

    // Word numbers
    const wordNumbers: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
      sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
      thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
      eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
    };

    for (const [word, value] of Object.entries(wordNumbers)) {
      const pattern = new RegExp(`\\b${word}\\b`, 'i');
      const match = text.match(pattern);
      if (match) {
        numbers.push({
          type: 'number',
          value,
          confidence: 0.95,
          sourceText: match[0],
        });
      }
    }

    return numbers;
  }

  /**
   * Extract dates from text
   */
  extractDates(text: string): ExtractedEntity[] {
    const dates: ExtractedEntity[] = [];

    // Relative dates
    const relativeDatePatterns: Array<[RegExp, () => Date, string]> = [
      [/\b(?:today|now)\b/i, () => new Date(), 'today'],
      [/\byesterday\b/i, () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
      }, 'yesterday'],
      [/\btomorrow\b/i, () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
      }, 'tomorrow'],
      [/\blast\s+week\b/i, () => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
      }, 'last week'],
      [/\blast\s+month\b/i, () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d;
      }, 'last month'],
      [/\blast\s+year\b/i, () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d;
      }, 'last year'],
    ];

    for (const [pattern, resolver, description] of relativeDatePatterns) {
      const match = text.match(pattern);
      if (match) {
        dates.push({
          type: 'date',
          value: resolver(),
          confidence: 0.95,
          sourceText: match[0],
        });
      }
    }

    // Absolute dates (YYYY-MM-DD)
    const isoDateRegex = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
    let isoMatch;

    while ((isoMatch = isoDateRegex.exec(text)) !== null) {
      dates.push({
        type: 'date',
        value: new Date(isoMatch[1], parseInt(isoMatch[2]) - 1, isoMatch[3]),
        confidence: 1.0,
        sourceText: isoMatch[0],
        position: {
          start: isoMatch.index,
          end: isoMatch.index + isoMatch[0].length,
        },
      });
    }

    // US dates (MM/DD/YYYY)
    const usDateRegex = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
    let usMatch;

    while ((usMatch = usDateRegex.exec(text)) !== null) {
      dates.push({
        type: 'date',
        value: new Date(usMatch[3], parseInt(usMatch[1]) - 1, usMatch[2]),
        confidence: 0.9,
        sourceText: usMatch[0],
        position: {
          start: usMatch.index,
          end: usMatch.index + usMatch[0].length,
        },
      });
    }

    return dates;
  }

  /**
   * Extract organization strategies
   */
  extractStrategies(text: string): ExtractedEntity[] {
    const strategies: ExtractedEntity[] = [];

    const strategyPatterns: Array<[RegExp, string, number]> = [
      [/\bby\s+type\b/i, 'by-type', 1.0],
      [/\bby\s+date\b/i, 'by-date', 1.0],
      [/\bby\s+size\b/i, 'by-size', 1.0],
      [/\bby\s+extension\b/i, 'by-extension', 1.0],
      [/\balphabetically\b/i, 'alphabetically', 0.95],
      [/\bby\s+name\b/i, 'by-name', 0.9],
    ];

    for (const [pattern, strategy, confidence] of strategyPatterns) {
      const match = text.match(pattern);
      if (match) {
        strategies.push({
          type: 'strategy' as any,
          value: strategy,
          confidence,
          sourceText: match[0],
        });
      }
    }

    return strategies;
  }

  /**
   * Normalize path (expand ~ and ./)
   */
  private normalizePath(path: string): string {
    if (path.startsWith('~/')) {
      return path.replace('~', this.context.userHomeDirectory);
    }

    if (path.startsWith('./')) {
      return path.replace('.', this.context.currentDirectory);
    }

    return path;
  }

  /**
   * Resolve folder name to actual path
   */
  private resolveFolderName(folderName: string): string | null {
    // Check common folders mapping
    if (this.context.commonFolders.has(folderName)) {
      return this.context.commonFolders.get(folderName)!;
    }

    // Try to construct path from home directory
    const homePath = `${this.context.userHomeDirectory}/${folderName}`;
    return homePath;
  }

  /**
   * Get parent directory
   */
  private getParentDirectory(path: string): string {
    const parts = path.split('/').filter(p => p.length > 0);
    parts.pop();
    return '/' + parts.join('/');
  }
}

/**
 * Create entity extractor with default context
 */
export function createEntityExtractor(context?: Partial<VoiceContext>): EntityExtractor {
  const defaultContext: VoiceContext = {
    currentDirectory: process.cwd?.() || '/',
    recentPaths: [],
    userHomeDirectory: process.env.HOME || process.env.USERPROFILE || '~',
    commonFolders: new Map([
      ['Downloads', `${process.env.HOME || '~'}/Downloads`],
      ['Documents', `${process.env.HOME || '~'}/Documents`],
      ['Desktop', `${process.env.HOME || '~'}/Desktop`],
      ['Pictures', `${process.env.HOME || '~'}/Pictures`],
      ['Videos', `${process.env.HOME || '~'}/Videos`],
      ['Music', `${process.env.HOME || '~'}/Music`],
    ]),
    ...context,
  };

  return new EntityExtractor(defaultContext);
}
