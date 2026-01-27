/**
 * File: src/features/ai-assistant/utils/fileCreationFallback.ts
 *
 * Direct tool execution fallback when the AI returns text only.
 * Parses file-creation requests and returns structured params for write_file_content.
 */

export interface FileCreationItem {
  fileName: string;
  content: string;
}

/**
 * Detects if the command is a request to create named documents/files.
 */
export function isFileCreationRequest(command: string): boolean {
  const lower = command.toLowerCase();
  const createMatch = /(?:create|make|generate)\s+(?:two|three|four|five|\d+)?\s*(?:new\s+)?(?:document|documents|file|files)/.test(lower);
  const hasNames =
    /(?:one that says|the other one is|the first|the second|called|named|titled)/i.test(command) ||
    /(?:document|documents|\.docx|\.txt)/i.test(lower);
  return !!(createMatch || hasNames) && /(?:document|file|\.docx|\.txt)/i.test(lower);
}

/**
 * Parses file names from natural language like:
 * "Create two documents, one that says, Justins, New Idea, and the other one is, Trees on a Vine."
 * Returns [{ fileName: "Justins, New Idea.docx", content: "" }, { fileName: "Trees on a Vine.docx", content: "" }]
 */
export function parseFileCreationRequest(command: string): FileCreationItem[] {
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

  // Single "called X" or "named X"
  const single = command.match(/(?:called|named|titled)\s+["']?([^"']+)["']?/i);
  if (single?.[1]) {
    return [{ fileName: addExt(single[1].trim()), content: "" }];
  }

  return items;
}
