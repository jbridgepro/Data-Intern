/**
 * File: src/features/ai-assistant/services/ResponseParser.ts
 * 
 * Service for parsing and cleaning LLM responses.
 * Handles the extraction of JSON commands and removal of technical details from user-facing text.
 */

export class ResponseParser {
    /**
     * Cleans the response content to remove JSON blocks and technical artifacts.
     */
    static cleanResponse(text: string): string {
        let cleanText = text || '';

        // Remove <think>...</think> blocks (DeepSeek R1 and other reasoning models)
        cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '');

        // Remove tool use blocks from reasoning models (often in different formats)
        cleanText = cleanText.replace(/<tool_code>[\s\S]*?<\/tool_code>/gi, '');

        // Filter out JSON command blocks and technical details from user-facing responses
        // Remove JSON code blocks that show tool definitions
        cleanText = cleanText.replace(/```json\s*\{[^}]*"tool"[^}]*\}[^`]*```/gi, '');
        cleanText = cleanText.replace(/```json\s*\{[\s\S]*?"tool"[\s\S]*?\}[\s\S]*?```/gi, '');

        // Remove standalone JSON blocks that look like tool commands
        cleanText = cleanText.replace(/\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g, '');

        // Remove phrases that introduce JSON blocks
        cleanText = cleanText.replace(/Here's a (sample )?command block in JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/Here's the JSON (command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/You can use this JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/Here's (an )?example (JSON )?(command|format|block):[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/I'll show you the JSON (command|format|block)[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/Here's how to (do|execute) it in JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/To use a tool, (you|we) (can|need to|must) (use|output|provide) (this|the following) JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/We'll need to (use|output|provide) (this|the following) JSON:[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/The (JSON|command) (format|block|structure) (is|would be|looks like):[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/In JSON format:[\s\S]*?```json[\s\S]*?```/gi, '');

        // Remove any remaining standalone JSON blocks (even without "tool" key)
        // Be careful not to remove valid user code if they asked for it, but here we assume safety for assistant artifacts
        cleanText = cleanText.replace(/```json\s*\{[\s\S]*?"(foldersCreated|filesProcessed|count|totalFiles|arguments)"[\s\S]*?\}[\s\S]*?```/gi, '');

        // Remove phrases that mention JSON without showing it
        cleanText = cleanText.replace(/I can (show|provide|give) you the JSON (command|format|block)[\s\S]*?\./gi, '');
        cleanText = cleanText.replace(/Here's (a|an) (sample|example) (JSON )?(command|format|block)[\s\S]*?\./gi, '');

        // Remove "Tool Execution Result" JSON blocks
        cleanText = cleanText.replace(/\*\*Tool Execution Result:\*\*[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/Tool Execution Result:[\s\S]*?```json[\s\S]*?```/gi, '');
        cleanText = cleanText.replace(/\*\*Tool Execution Result:\*\*[\s\S]*?\{[\s\S]*?\}/gi, '');
        cleanText = cleanText.replace(/Tool Execution Result:[\s\S]*?\{[\s\S]*?\}/gi, '');

        // Clean up multiple newlines
        cleanText = cleanText.replace(/\n{3,}/g, '\n\n');
        cleanText = cleanText.replace(/^\s*\n/gm, ''); // Remove lines with only whitespace
        cleanText = cleanText.trim();

        return cleanText;
    }

    /**
     * Attempts to parse a JSON command from a text response.
     * Dictionary-style parsing for fallback mode.
     * Supports multiple formats:
     * - JSON code blocks: ```json {...} ```
     * - Inline JSON objects: {...}
     * - Multiple JSON blocks (returns first valid one)
     */
    static parseJsonCommand(text: string): { tool: string; arguments: any } | null {
        if (!text) return null;

        // Strip <think> blocks before parsing to avoid confusion
        const textWithoutThoughts = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

        // Try to find JSON code blocks first (most common format)
        // Support ```json, ```JSON, or just ```
        const jsonBlockPattern = /```(?:json|JSON)?\s*([\s\S]*?)\s*```/gi;
        let jsonBlockMatch;
        while ((jsonBlockMatch = jsonBlockPattern.exec(textWithoutThoughts)) !== null) {
            const jsonStr = jsonBlockMatch[1].trim();
            // Ignore if it's not looking like an object
            if (!jsonStr.startsWith('{')) continue;

            const parsed = this.tryParseJsonCommand(jsonStr);
            if (parsed) return parsed;
        }

        // Try to find inline JSON objects with "tool" key
        const inlineJsonPattern = /\{[\s\S]*?"tool"[\s\S]*?\}/g;
        let inlineMatch;
        while ((inlineMatch = inlineJsonPattern.exec(textWithoutThoughts)) !== null) {
            const jsonStr = inlineMatch[0];
            const parsed = this.tryParseJsonCommand(jsonStr);
            if (parsed) return parsed;
        }

        // Try to find JSON at the very end of the message (common for some LLMs)
        const endJsonPattern = /\{[\s\S]*?\}$/;
        const endMatch = textWithoutThoughts.match(endJsonPattern);
        if (endMatch) {
            const parsed = this.tryParseJsonCommand(endMatch[0]);
            if (parsed && (parsed.tool || parsed.arguments)) return parsed;
        }

        return null;
    }

    /**
     * Helper method to try parsing a JSON string as a command.
     */
    private static tryParseJsonCommand(jsonStr: string): { tool: string; arguments: any } | null {
        try {
            // Attempt to clean trailing commas which often break JSON.parse
            const cleanJson = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

            const cmd = JSON.parse(cleanJson);

            // Support both "tool" and "name" for tool name
            const toolName = cmd.tool || cmd.name || cmd.function?.name;

            // Support "arguments", "args", "input", "parameters", or "function.arguments"
            const toolArgs = cmd.arguments || cmd.args || cmd.input || cmd.parameters ||
                cmd.function?.arguments || cmd.function?.args ||
                (cmd.function && typeof cmd.function === 'object' ? cmd.function : {});

            if (toolName && typeof toolName === 'string') {
                return {
                    tool: toolName,
                    arguments: toolArgs || {}
                };
            }
        } catch (e) {
            // Silently fail - we'll try other patterns
        }
        return null;
    }
}
