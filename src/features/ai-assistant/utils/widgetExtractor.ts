/**
 * File: src/features/ai-assistant/utils/widgetExtractor.ts
 * 
 * Extracts tool widget data from AI conversation context.
 * Analyzes messages to detect tool discussions and extract parameters.
 */

import type { ToolWidgetData, ChatMessageType } from "../types";

interface ToolPattern {
  toolName: string;
  keywords: string[];
  paramExtractors: Record<string, (text: string) => any>;
}

const TOOL_PATTERNS: ToolPattern[] = [
  {
    toolName: "folder_creation_tab",
    keywords: [
      "create folder",
      "create folders",
      "make folder",
      "make folders",
      "folder structure",
      "organize into folders",
      "group into folders",
      "subfolders",
      "directory structure",
    ],
    paramExtractors: {
      folderNames: (text: string) => {
        // Extract folder names from text
        // Look for patterns like "folders: A, B, C" or "create folders named X, Y, Z"
        const patterns = [
          /(?:folders?|directories?)\s*(?:named|called|:)?\s*([A-Za-z0-9\s,]+)/i,
          /create\s+(?:a\s+)?folder(?:s)?\s+(?:named|called)?\s*([A-Za-z0-9\s,]+)/i,
          /folders?\s*:\s*([A-Za-z0-9\s,]+)/i,
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            return match[1]
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
          }
        }

        // Fallback: look for quoted names
        const quoted = text.match(/"([^"]+)"/g);
        if (quoted) {
          return quoted.map((q) => q.replace(/"/g, ""));
        }

        return [];
      },
      rootPath: (text: string) => {
        // Extract path from text
        const pathPattern = /(?:in|at|to|from)\s+([\/\w\s\-\.]+(?:\/[\/\w\s\-\.]+)*)/i;
        const match = text.match(pathPattern);
        return match ? match[1].trim() : "";
      },
      subfolders: (text: string) => {
        // Extract subfolders - multiple patterns
        // Pattern 1: "subfolders: 1, 2, 3" or "subfolders named 1, 2, 3"
        const subfolderPattern1 = /(?:subfolder|subdirectory|nested)\s*(?:named|:)?\s*([A-Za-z0-9\s,]+)/i;
        const match1 = text.match(subfolderPattern1);
        if (match1 && match1[1]) {
          return match1[1]
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }

        // Pattern 2: "with folders 1, 2, 3" or "with subfolders 1, 2, 3"
        const subfolderPattern2 = /(?:with|add|create)\s+(?:folders?|subfolders?|subdirectories?)\s+(?:named|:)?\s*([A-Za-z0-9\s,]+)/i;
        const match2 = text.match(subfolderPattern2);
        if (match2 && match2[1]) {
          return match2[1]
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }

        // Pattern 3: "folders being 1, 2, 3" (from user's request)
        const subfolderPattern3 = /(?:folders?|subfolders?)\s+(?:being|are|named)\s+([A-Za-z0-9\s,]+)/i;
        const match3 = text.match(subfolderPattern3);
        if (match3 && match3[1]) {
          return match3[1]
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }

        return [];
      },
    },
  },
  {
    toolName: "file_creation_tab",
    keywords: [
      "create file",
      "create files",
      "make file",
      "make files",
      "empty file",
      "empty files",
      "generate file",
      "generate files",
    ],
    paramExtractors: {
      count: (text: string) => {
        const countPattern = /(\d+)\s+(?:file|files)/i;
        const match = text.match(countPattern);
        return match ? parseInt(match[1], 10) : 1;
      },
      extensions: (text: string) => {
        // Extract file extensions - multiple patterns
        // Pattern 1: ".sql files" or "SQL files"
        const sqlPattern = /\b(sql)\s+files?/i;
        if (sqlPattern.test(text)) {
          return ["sql"];
        }

        // Pattern 2: ".ext files" or "ext files"
        const extPattern = /\.?([a-z0-9]+)\s+files?/i;
        const matches = Array.from(text.matchAll(new RegExp(extPattern, "gi")));
        if (matches.length > 0) {
          return matches.map((m) => m[1].toLowerCase());
        }

        // Pattern 3: "files with extension .ext"
        const extPattern2 = /extension\s+\.?([a-z0-9]+)/i;
        const match2 = text.match(extPattern2);
        if (match2) {
          return [match2[1].toLowerCase()];
        }

        return ["txt"]; // Default
      },
      baseName: (text: string) => {
        // Extract base name - look for "files starting with X" or "X files"
        // Pattern 1: "files starting with Justin"
        const startPattern = /(?:files?|all)\s+(?:starting\s+with|named|called)\s+([A-Za-z0-9_]+)/i;
        const match1 = text.match(startPattern);
        if (match1) {
          return match1[1];
        }

        // Pattern 2: "Justin files" or "Justin SQL files"
        const namePattern = /^([A-Za-z0-9_]+)\s+(?:sql\s+)?files?/i;
        const match2 = text.match(namePattern);
        if (match2) {
          return match2[1];
        }

        // Pattern 3: "Make all the Sql files start with Justin"
        const makePattern = /(?:make|all|the)\s+(?:.*?)\s+(?:start\s+with|named)\s+([A-Za-z0-9_]+)/i;
        const match3 = text.match(makePattern);
        if (match3) {
          return match3[1];
        }

        return "";
      },
    },
  },
  {
    toolName: "file_copy_tab",
    keywords: [
      "copy file",
      "copy files",
      "move file",
      "move files",
      "transfer file",
      "transfer files",
      "duplicate file",
    ],
    paramExtractors: {
      sourcePath: (text: string) => {
        const fromPattern = /(?:from|source)\s+([\/\w\s\-\.]+(?:\/[\/\w\s\-\.]+)*)/i;
        const match = text.match(fromPattern);
        return match ? match[1].trim() : "";
      },
      destinationPath: (text: string) => {
        const toPattern = /(?:to|destination|target)\s+([\/\w\s\-\.]+(?:\/[\/\w\s\-\.]+)*)/i;
        const match = text.match(toPattern);
        return match ? match[1].trim() : "";
      },
    },
  },
  {
    toolName: "find_replace_tab",
    keywords: [
      "find and replace",
      "search and replace",
      "replace text",
      "find text",
      "search in files",
      "replace in files",
    ],
    paramExtractors: {
      searchQuery: (text: string) => {
        const findPattern = /(?:find|search for|look for)\s+["']?([^"']+)["']?/i;
        const match = text.match(findPattern);
        return match ? match[1].trim() : "";
      },
      replaceQuery: (text: string) => {
        const replacePattern = /(?:replace|with|replace with)\s+["']?([^"']+)["']?/i;
        const match = text.match(replacePattern);
        return match ? match[1].trim() : "";
      },
    },
  },
  {
    toolName: "write_file_content",
    keywords: [
      "create document",
      "create documents",
      "create file",
      "create files",
      "write file",
      "write document",
      "make document",
      "make file",
    ],
    paramExtractors: {
      path: (text: string) => {
        // Extract file path - look for file names in quotes or after "called", "named", etc.
        // Pattern 1: "create a document called 'Justin's Big Plan.docx'"
        const calledPattern = /(?:called|named|titled|with name|with the name)\s+["']?([^"']+)["']?/i;
        const match1 = text.match(calledPattern);
        if (match1) {
          let name = match1[1].trim();
          if (!name.match(/\.\w+$/)) {
            name += ".docx"; // Default to .docx for documents
          }
          return name;
        }

        // Pattern 2: "one that says, Justins, New Idea" - extract the name (handles commas in name)
        const saysPattern = /(?:one|file|document|the first|the second)\s+(?:that\s+)?(?:says|named|called)\s*[,:]\s*["']?([^"']+)["']?/i;
        const match2 = text.match(saysPattern);
        if (match2) {
          // Clean up the name and add extension if missing
          let name = match2[1].trim();
          // Remove trailing commas
          name = name.replace(/,\s*$/, '');
          if (!name.match(/\.\w+$/)) {
            name += ".docx"; // Default to .docx for documents
          }
          return name;
        }

        // Pattern 3: "Justins, New Idea" - direct name extraction
        const directPattern = /^([A-Za-z][^,]+(?:,\s*[^,]+)*)/;
        const match3 = text.match(directPattern);
        if (match3) {
          let name = match3[1].trim();
          if (!name.match(/\.\w+$/)) {
            name += ".docx";
          }
          return name;
        }

        return "";
      },
      content: (text: string) => {
        // Extract content - usually the file name itself or empty
        // For documents, content is often empty or the title
        const saysPattern = /(?:says|with content|containing)\s*[,:]\s*["']?([^"']+)["']?/i;
        const match = text.match(saysPattern);
        if (match) {
          return match[1].trim();
        }
        return ""; // Default to empty content
      },
    },
  },
];

/**
 * Extracts widget data from a conversation message
 */
export function extractWidgetFromMessage(
  message: ChatMessageType,
  conversationHistory: ChatMessageType[] = []
): ToolWidgetData | null {
  const text = message.content.toLowerCase();
  const fullContext = [
    ...conversationHistory.map((m) => m.content),
    message.content,
  ].join(" ").toLowerCase();

  // Find matching tool pattern
  for (const pattern of TOOL_PATTERNS) {
    const hasKeywords = pattern.keywords.some((keyword) =>
      fullContext.includes(keyword)
    );

    if (hasKeywords) {
      // Extract parameters
      const params: Record<string, any> = {};
      let confidence = 0.5; // Base confidence

      for (const [paramName, extractor] of Object.entries(
        pattern.paramExtractors
      )) {
        const value = extractor(fullContext);
        if (value !== undefined && value !== null && value !== "") {
          params[paramName] = value;
          confidence += 0.1; // Increase confidence for each extracted param
        }
      }

      // Cap confidence at 1.0
      confidence = Math.min(1.0, confidence);

      // Only create widget if we have at least some parameters
      if (Object.keys(params).length > 0) {
        return {
          id: "", // Will be set by the hook
          toolName: pattern.toolName,
          params,
          description: generateDescription(pattern.toolName, params),
          confidence,
          sourceMessageId: message.id,
          lastUpdated: new Date(),
        };
      }
    }
  }

  return null;
}

/**
 * Generates a human-readable description for a widget
 */
function generateDescription(
  toolName: string,
  params: Record<string, any>
): string {
  switch (toolName) {
    case "folder_creation_tab":
      const folderNames = params.folderNames || [];
      const count = folderNames.length;
      return `Create ${count} folder${count !== 1 ? "s" : ""}${params.rootPath ? ` in ${params.rootPath.split("/").pop()}` : ""
        }`;

    case "file_creation_tab":
      const fileCount = params.count || 1;
      const extensions = params.extensions || [];
      const baseName = params.baseName || "";
      let desc = `Create ${fileCount} file${fileCount !== 1 ? "s" : ""}`;
      if (baseName) {
        desc += ` starting with "${baseName}"`;
      }
      if (extensions.length > 0) {
        desc += ` with extension${extensions.length !== 1 ? "s" : ""}: ${extensions.map((e: string) => `.${e}`).join(", ")}`;
      }
      return desc;

    case "write_file_content":
      const fileName = params.path ? params.path.split("/").pop() : "document";
      const hasContent = params.content && params.content.trim().length > 0;
      return `Create file "${fileName}"${hasContent ? ` with content` : ""}`;

    case "file_copy_tab":
      return `Copy files from ${params.sourcePath || "source"} to ${params.destinationPath || "destination"
        }`;

    case "find_replace_tab":
      return `Find "${params.searchQuery || ""}"${params.replaceQuery ? ` and replace with "${params.replaceQuery}"` : ""
        }`;

    default:
      return "Tool operation";
  }
}

/**
 * Updates widget parameters based on natural language input
 */
export function updateWidgetFromNaturalLanguage(
  widget: ToolWidgetData,
  naturalLanguageInput: string
): Partial<ToolWidgetData> {
  const text = naturalLanguageInput.toLowerCase();
  const updates: Partial<ToolWidgetData> = {};
  const updatedParams = { ...widget.params };

  // Find the pattern for this tool
  const pattern = TOOL_PATTERNS.find((p) => p.toolName === widget.toolName);
  if (!pattern) return updates;

  // Extract updated parameters
  for (const [paramName, extractor] of Object.entries(pattern.paramExtractors)) {
    const newValue = extractor(text);
    if (newValue !== undefined && newValue !== null && newValue !== "") {
      updatedParams[paramName] = newValue;
    }
  }

  // Check for explicit parameter mentions
  // e.g., "change folder names to A, B, C"
  if (text.includes("folder name") || text.includes("folders named")) {
    const folderNames = pattern.paramExtractors.folderNames?.(text);
    if (folderNames && folderNames.length > 0) {
      updatedParams.folderNames = folderNames;
    }
  }

  if (text.includes("path") || text.includes("directory") || text.includes("location")) {
    const rootPath = pattern.paramExtractors.rootPath?.(text);
    if (rootPath) {
      updatedParams.rootPath = rootPath;
    }
  }

  // For file creation: check for base name changes
  if (widget.toolName === "file_creation_tab") {
    if (text.includes("start with") || text.includes("starting with") || text.includes("named")) {
      const baseName = pattern.paramExtractors.baseName?.(text);
      if (baseName) {
        updatedParams.baseName = baseName;
      }
    }

    if (text.includes("extension") || text.match(/\b(sql|txt|log|json|py|js|ts)\s+files?/i)) {
      const extensions = pattern.paramExtractors.extensions?.(text);
      if (extensions && extensions.length > 0) {
        updatedParams.extensions = extensions;
      }
    }
  }

  updates.params = updatedParams;
  updates.description = generateDescription(widget.toolName, updatedParams);

  return updates;
}
