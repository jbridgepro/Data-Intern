/**
 * File: src/features/ai-assistant/utils/fileCreationFallback.ts
 *
 * Direct tool execution fallback when the AI returns text only.
 * Parses file-creation requests and returns structured params for write_file_content.
 * Also handles composite folder+file requests.
 */

export interface FileCreationItem {
  fileName: string;
  content: string;
}

/**
 * Represents a folder to create, optionally with files inside.
 */
export interface FolderCreationItem {
  folderName: string;
  filesInside: FileCreationItem[];
}

/**
 * Parsed result of a creation request - can be folders, files, or both.
 */
export interface CreationParseResult {
  folders: FolderCreationItem[];
  files: FileCreationItem[];
  isCompositeRequest: boolean; // true if the request involves folders with files inside
}

/**
 * Detects if the command is a request to create named documents/files.
 * NOTE: Returns FALSE if this is a composite folder+file request - those are handled separately.
 */
export function isFileCreationRequest(command: string): boolean {
  // First check: if this is a composite request (folder + file inside), return false
  // Let the composite handler deal with it
  if (isCompositeCreationRequest(command)) {
    return false;
  }

  const lower = command.toLowerCase();
  const createMatch = /(?:create|make|generate)\s+(?:two|three|four|five|\d+)?\s*(?:new\s+)?(?:document|documents|file|files)/.test(lower);
  const hasNames =
    /(?:one that says|the other one is|the first|the second|called|named|titled)/i.test(command) ||
    /(?:document|documents|\.docx|\.txt)/i.test(lower);
  return !!(createMatch || hasNames) && /(?:document|file|\.docx|\.txt)/i.test(lower);
}

/**
 * Detects if the file type is ambiguous and needs clarification before creation.
 * Returns true if user said "document", "file", etc. without specifying extension.
 */
export function needsFileTypeClarification(command: string): boolean {
  const lower = command.toLowerCase();

  // Check if extension is explicitly specified
  const hasExplicitExtension = /\.(txt|docx|doc|pdf|md|rtf|xlsx|xls|csv|py|js|ts|sql|json|xml|html|css)(?:\s|$|,)/i.test(command);
  if (hasExplicitExtension) return false;

  // Check for clear file type indicators (no clarification needed)
  const clearTypes = [
    /text\s*file/i,           // "text file" → .txt
    /word\s*(?:document|doc)/i, // "Word document" → .docx
    /markdown\s*(?:file)?/i,  // "markdown file" → .md
    /sql\s*file/i,            // "SQL file" → .sql
    /python\s*(?:file|script)/i, // "Python file" → .py
    /javascript\s*(?:file|script)/i, // "JavaScript file" → .js
    /typescript\s*(?:file|script)/i, // "TypeScript file" → .ts
    /excel\s*(?:file|spreadsheet)/i, // "Excel file" → .xlsx
    /csv\s*file/i,            // "CSV file" → .csv
    /json\s*file/i,           // "JSON file" → .json
    /html\s*(?:file|page)/i,  // "HTML file" → .html
    /readme/i,                // "README" → .md
  ];

  if (clearTypes.some(pattern => pattern.test(command))) return false;

  // These terms are ambiguous and need clarification
  const ambiguousTerms = [
    /(?:create|make|add|put)\s+(?:a\s+)?document/i,  // "create a document"
    /(?:create|make|add|put)\s+(?:a\s+)?file\s+(?:called|named)/i, // "create a file called"
    /(?:create|make|add|put)\s+(?:a\s+)?note/i,     // "create a note"
    /document\s+(?:called|named|inside)/i,          // "document called X"
    /file\s+(?:called|named)\s+[^.]+(?:\s|$)/i,     // "file called X" (no extension)
    // Catch numbered file requests (e.g. "3 files")
    /(?:create|make|add|put)\s+(?:\d+|two|three|four|five|six|seven|eight|nine|ten|some|a few|several|multiple)\s+(?:new\s+)?files/i,
    // Catch "files inside" matches
    /files?\s+(?:inside|in|within|into)/i,
    // Catch bare "create/make files" (no count, no type)
    /(?:create|make)\s+(?:new\s+)?files?\s*$/i,
  ];

  return ambiguousTerms.some(pattern => pattern.test(command));
}

/**
 * Detects if the command is a request to create a folder.
 */
export function isFolderCreationRequest(command: string): boolean {
  const lower = command.toLowerCase();
  return /(?:create|make|new)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory)/.test(lower);
}

/**
 * Detects if the command is a composite request (folder + file inside).
 * Examples:
 * - "make a folder that is called X and add a document inside called Y"
 * - "make a folder called X and add a document inside called Y"
 * - "create folder X with a file called Y inside"
 * - "create a new folder named X and put a document in it called Y"
 */
export function isCompositeCreationRequest(command: string): boolean {
  const lower = command.toLowerCase();

  // Check for folder creation followed by file creation with "inside/in/within"
  const hasFolderKeyword = /(?:folder|directory)/.test(lower);
  const hasFileKeyword = /(?:document|file)/.test(lower);
  const hasHierarchy = /(?:inside|in\s+it|within|in\s+the\s+folder|into\s+it|put\s+.+\s+in)/.test(lower);

  // Also check for "and add/put" pattern which implies hierarchy
  const hasAndAdd = /folder.*(?:and\s+(?:add|put|create)).*(?:document|file)/i.test(lower);
  // Also match "1 folder and 3 files inside" pattern
  const hasCountedFiles = /folder.*(?:and)\s+(?:\d+|two|three|four|five|six|seven|eight|nine|ten|some|a few|several|multiple)\s+(?:new\s+)?files/i.test(lower);

  // Debug logging
  console.log(`[isCompositeCreationRequest] folder=${hasFolderKeyword}, file=${hasFileKeyword}, hierarchy=${hasHierarchy}, andAdd=${hasAndAdd}`);

  return hasFolderKeyword && hasFileKeyword && (hasHierarchy || hasAndAdd || hasCountedFiles);
}

/**
 * Parses a composite creation request (folder + files inside).
 * Examples:
 * - "make a folder that is called Justin's new project and add a document inside called new idea"
 * - "make a folder called Justin's new project and add a document inside called new idea"
 *   → { folders: [{ folderName: "Justin's new project", filesInside: [{ fileName: "new idea.txt" }] }] }
 */
export function parseCompositeCreationRequest(command: string): CreationParseResult {
  const result: CreationParseResult = {
    folders: [],
    files: [],
    isCompositeRequest: true,
  };

  const addExt = (name: string, defaultExt: string = '.txt') => {
    const n = name.trim().replace(/\.+$/, '');
    return n.match(/\.\w+$/) ? n : `${n}${defaultExt}`;
  };

  // Extract folder name - patterns for various phrasings
  const folderPatterns = [
    // "make a folder that is called X and..."
    /(?:make|create)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory)\s+(?:that\s+is\s+)?(?:called|named|titled)\s+["']?(.+?)["']?\s+and\s+/i,
    // "make a folder called X and..."
    /(?:make|create)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory)\s+(?:called|named|titled)\s+["']?(.+?)["']?\s+(?:and|,)/i,
    // "folder called X and..."
    /(?:folder|directory)\s+(?:that\s+is\s+)?(?:called|named|titled)\s+["']?(.+?)["']?\s+(?:and|with|,)/i,
  ];

  let folderName: string | null = null;
  for (const pattern of folderPatterns) {
    const match = command.match(pattern);
    if (match?.[1]) {
      folderName = match[1].trim();
      console.log(`[parseCompositeCreationRequest] Matched folder name: "${folderName}"`);
      break;
    }
  }

  // Extract file name - look for file/document AFTER "and add/put"
  const filePatterns = [
    // "and add a document inside called Y" - most specific
    /and\s+(?:add|put|create)\s+(?:a\s+)?(?:new\s+)?(?:document|file)\s+(?:inside\s+)?(?:called|named|titled)\s+["']?([^"'.]+?)["']?\.?$/i,
    // "document inside called Y"
    /(?:document|file)\s+(?:inside\s+)?(?:called|named|titled)\s+["']?([^"'.]+?)["']?\.?$/i,
    // "inside called Y"
    /(?:inside|in\s+it|within)\s+(?:called|named|titled)\s+["']?([^"'.]+?)["']?\.?$/i,
    // "add a document called Y inside"
    /(?:add|put|create)\s+(?:a\s+)?(?:new\s+)?(?:document|file)\s+(?:called|named|titled)\s+["']?([^"'.]+?)["']?\s*(?:inside|in\s+it)/i,
  ];

  let fileName: string | null = null;
  for (const pattern of filePatterns) {
    const match = command.match(pattern);
    if (match?.[1]) {
      fileName = match[1].trim();
      console.log(`[parseCompositeCreationRequest] Matched file name: "${fileName}"`);
      break;
    }
  }

  console.log(`[parseCompositeCreationRequest] Final: folder="${folderName}", file="${fileName}"`);

  // If we found both folder and file, create the composite structure
  if (folderName && fileName) {
    // Determine file extension based on context - but we should ask for clarification!
    // For now, use a placeholder that signals clarification is needed
    const defaultExt = /docx|word\s+document/i.test(command) ? '.docx' :
      /text\s+file|\.txt/i.test(command) ? '.txt' :
        '.txt'; // Default, but AI should ask
    result.folders.push({
      folderName: folderName,
      filesInside: [{ fileName: addExt(fileName, defaultExt), content: '' }],
    });
  } else if (folderName) {
    // Only folder, no file
    result.folders.push({
      folderName: folderName,
      filesInside: [],
    });
    result.isCompositeRequest = false;
  } else if (fileName) {
    // Only file, no folder (shouldn't happen if isCompositeCreationRequest was true)
    const defaultExt = /docx|document/i.test(command) ? '.docx' : '.txt';
    result.files.push({ fileName: addExt(fileName, defaultExt), content: '' });
    result.isCompositeRequest = false;
  }

  return result;
}

/**
 * Parses a folder-only creation request.
 * Example: "create a folder called Projects"
 */
export function parseFolderCreationRequest(command: string): FolderCreationItem | null {
  const folderPatterns = [
    /(?:make|create)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory)\s+(?:called|named|titled)\s+["']?([^"']+?)["']?$/i,
    /(?:make|create)\s+(?:a\s+)?(?:new\s+)?(?:folder|directory)\s+["']?([^"']+?)["']?$/i,
    /(?:folder|directory)\s+(?:called|named|titled)\s+["']?([^"']+?)["']?$/i,
  ];

  for (const pattern of folderPatterns) {
    const match = command.match(pattern);
    if (match?.[1]) {
      return {
        folderName: match[1].trim(),
        filesInside: [],
      };
    }
  }
  return null;
}

/**
 * Parses file names from natural language like:
 * "Create two documents, one that says, Justins, New Idea, and the other one is, Trees on a Vine."
 * Returns [{ fileName: "Justins, New Idea.docx", content: "" }, { fileName: "Trees on a Vine.docx", content: "" }]
 * 
 * NOTE: This should NOT be called for composite folder+file requests.
 */
export function parseFileCreationRequest(command: string): FileCreationItem[] {
  // Safety check: don't parse composite requests here
  if (isCompositeCreationRequest(command)) {
    console.log('[parseFileCreationRequest] Skipping - this is a composite request');
    return [];
  }

  const items: FileCreationItem[] = [];
  const addExt = (name: string) => {
    const n = name.trim().replace(/\.+$/, "");
    return n.match(/\.\w+$/) ? n : `${n}.docx`;
  };

  // Pattern: "one that says, X, and the other one is, Y" or "the first ... the second ..."
  const otherSplit = /,\s*and\s+the\s+other\s+(?:one\s+)?(?:is|document\s+is|should\s+be)\s*,?\s*/i;
  const parts = command
    .split(otherSplit)
    .map((s) => s.trim().replace(/\.+$/, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    // First part: "one that says, Justins, New Idea" -> extract after "says, "
    const saysMatch = parts[0].match(/(?:one|file|document|the first)\s+(?:that\s+)?(?:says|named|called)\s*[,:]\s*["']?([\s\S]+?)["']?$/i);
    const first = saysMatch ? saysMatch[1].trim().replace(/,+\s*$/, "") : parts[0].replace(/^(?:one|file|document|the first)\s+(?:that\s+)?(?:says|named|called)\s*[,:]\s*["']?/i, "").trim();
    if (first) items.push({ fileName: addExt(first), content: "" });

    // Second part: "Trees on a Vine" (or "the second is X")
    const secondMatch = parts[1].match(/(?:the\s+second\s+(?:is|should\s+be|document\s+)?\s*[,:]\s*)?["']?([\s\S]+?)["']?\.?$/i);
    const second = secondMatch ? secondMatch[1].trim() : parts[1].replace(/^(?:the\s+second\s+(?:is|should\s+be)\s*[,:]\s*)/i, "").trim();
    if (second) items.push({ fileName: addExt(second), content: "" });
  }

  if (items.length >= 2) return items;

  // Pattern: "the first document should be called A. The second document should be called B."
  const firstCalled = command.match(/(?:the\s+first\s+(?:document|file)\s+(?:should\s+be\s+)?(?:called|named)\s+["']?([^."']+)["']?)/i);
  const secondCalled = command.match(/(?:the\s+second\s+(?:document|file)\s+(?:should\s+be\s+)?(?:called|named)\s+["']?([^."']+)["']?)/i);
  if (firstCalled?.[1] && secondCalled?.[1]) {
    return [
      { fileName: addExt(firstCalled[1].trim()), content: "" },
      { fileName: addExt(secondCalled[1].trim()), content: "" },
    ];
  }

  // Single file: "document called X" or "file named X" - but NOT if it's followed by more content like "and"
  // Be more conservative - only match the immediate filename, not everything after "called"
  const singleDocument = command.match(/(?:document|file)\s+(?:called|named|titled)\s+["']?([^"'.,]+?)["']?(?:\s*$|\s*\.)/i);
  if (singleDocument?.[1]) {
    const name = singleDocument[1].trim();
    // Make sure we're not capturing folder+file phrases
    if (!name.toLowerCase().includes(' and ') && !name.toLowerCase().includes('inside')) {
      return [{ fileName: addExt(name), content: "" }];
    }
  }

  return items;
}
