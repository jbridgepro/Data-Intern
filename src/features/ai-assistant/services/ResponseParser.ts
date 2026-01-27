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
     */
    static parseJsonCommand(text: string): { tool: string; arguments: any } | null {
        // Parse for JSON block
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*"tool"[\s\S]*}/);

        if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            try {
                const cmd = JSON.parse(jsonStr);
                if (cmd.tool && cmd.arguments) {
                    return {
                        tool: cmd.tool,
                        arguments: cmd.arguments
                    };
                }
            } catch (e) {
                console.warn('Failed to parse JSON command from text:', e);
            }
        }
        return null;
    }
}
