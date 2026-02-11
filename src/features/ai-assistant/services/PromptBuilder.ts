/**
 * File: src/features/ai-assistant/services/PromptBuilder.ts
 * 
 * Service for constructing prompts and determining tool needs.
 * Extracts logic from the monolithic ollamaService.ts.
 */

import type { DirectoryAnalysis } from '../types';
import type { ToolDefinition } from '../utils/toolsRegistry';
import { getConversationalSystemPrompt, generateJsonCommandModePrompt } from '../utils/aiGuidelines';

export class PromptBuilder {
    /**
     * Determines if a command likely needs tools based on keywords and intent.
     * Extracted from ollamaService.ts
     */
    static commandNeedsTools(command: string): boolean {
        const lowerCommand = command.toLowerCase().trim();

        // Simple greetings and conversational queries don't need tools
        const simpleQueries = [
            'hi', 'hello', 'hey', 'how are you', 'how r u', 'what\'s up', 'whats up', 'good morning',
            'good afternoon', 'good evening', 'thanks', 'thank you', 'bye', 'goodbye'
        ];

        if (simpleQueries.some(query => lowerCommand === query || lowerCommand.startsWith(query + ' ') || lowerCommand.startsWith(query + ','))) {
            return false;
        }

        // Explicitly check for simple math/general queries to avoid tool usage
        const nonToolPatterns = [
            /^\s*\d+\s*[\+\-\*\/x]\s*\d+/, // Basic math like "33 * 5" or "33 times 5"
            /calculate/i,
            /what is/i,
            /who is/i,
            /tell me (a joke|about|a story)/i,
            /weather/i, // Unless specifically asked to save weather to file
            /time/i,
            /date/i,
        ];

        if (nonToolPatterns.some(pattern => pattern.test(lowerCommand))) {
            // Exception: if it also contains explicit file keywords, we might need tools
            // e.g. "Calculate the size of these files"
            const explicitFileKeywords = ['file', 'folder', 'directory', 'app', 'project', 'save', 'write', 'output'];
            if (!explicitFileKeywords.some(kw => lowerCommand.includes(kw))) {
                return false;
            }
        }

        // Commands that likely need tools
        const toolKeywords = [
            'organize', 'organize files', 'sort', 'move', 'copy', 'delete', 'rename',
            'find', 'search', 'duplicate', 'analyze', 'create', 'generate', 'list',
            'show', 'display', 'count', 'size', 'folder', 'file', 'directory', 'project',
            'run', 'execute', 'install', 'fix', 'solve', 'issue', 'problem', 'task',
            'audit', 'check', 'scan', 'verify', 'test', 'debug', 'convert', 'transform'
        ];

        // Explicitly check for file extensions
        if (/\.(txt|docx|doc|pdf|md|rtf|xlsx|xls|csv|py|js|ts|sql|json|xml|html|css)/i.test(lowerCommand)) {
            return true;
        }

        // Check for "document" keyword which often implies file creation
        if (lowerCommand.includes('document')) {
            return true;
        }

        // Check for confirmation keywords that might be responding to a previous tool proposal
        const confirmationKeywords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'proceed', 'confirm', 'approve', 'do it', 'go ahead'];
        // Only trigger if it's a short command (likely a response)
        if (command.split(' ').length < 10 && confirmationKeywords.some(kw => lowerCommand === kw || lowerCommand.includes(kw))) {
            return true;
        }

        // Strong action verbs that should almost always trigger tool mode
        const strongActions = ['create', 'make', 'generate', 'build', 'write', 'delete', 'remove', 'move', 'copy', 'rename'];
        if (strongActions.some(action => lowerCommand.startsWith(action + ' '))) {
            return true;
        }

        return toolKeywords.some(keyword => lowerCommand.includes(keyword));
    }

    /**
     * Builds the system prompt based on settings and context.
     */
    static buildSystemPrompt(
        baseSystemPrompt: string,
        needsTools: boolean,
        settings: any,
        tools: ToolDefinition[] = [],
        skillContext?: string
    ): string {
        if (!needsTools) {
            return getConversationalSystemPrompt(settings.aiName, settings.userName);
        }

        // If running in JSON fallback mode (handled in orchestrator usually, but good to have helper)
        // We keep the main prompt logic simple here - returning the base one passed in
        // which usually comes from aiGuidelines.ts generateSystemPrompt
        return baseSystemPrompt;
    }

    /**
     * Builds the JSON command mode system prompt.
     */
    static buildJsonSystemPrompt(
        tools: ToolDefinition[],
        settings: any,
        skillContext?: string
    ): string {
        return generateJsonCommandModePrompt(tools, settings.aiName, settings.userName, skillContext);
    }

    /**
     * Builds the user prompt with context injection.
     */
    static buildUserPrompt(
        command: string,
        currentDirectory: string,
        directoryAnalysis: any,
        needsTools: boolean = true,
        conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
        includeFileDetails: boolean = true
    ): string {
        // For simple conversational queries, just use the command directly
        if (!needsTools) {
            return command;
        }

        // Detect if this is a confirmation response (yes, no, ok, sure, etc.)
        const isConfirmation = /^(yes|yeah|yep|yup|ok|okay|sure|alright|all right|go ahead|proceed|continue|do it|execute|confirm|approved?|agreed?)$/i.test(command.trim());
        const isRejection = /^(no|nope|nah|cancel|stop|abort|don't|dont)$/i.test(command.trim());

        // Detect if this is a question that requires immediate tool execution
        const isQuestion = /^(how many|how much|what|which|where|when|who|count|list|show|find|analyze)/i.test(command.trim());
        const needsAnalysis = /(pictures?|images?|files?|photos?|documents?|videos?|audio|size|space|count)/i.test(command);

        // For commands that need tools, include full context
        let prompt = `User command: "${command}"\n\n`;

        // Handle confirmation/rejection responses with context
        if (isConfirmation || isRejection) {
            if (conversationHistory && conversationHistory.length > 0) {
                // Find the last assistant message that asked for confirmation
                const lastAssistantMessage = [...conversationHistory].reverse().find(msg => msg.role === 'assistant');
                if (lastAssistantMessage) {
                    const lastMessage = lastAssistantMessage.content;
                    prompt += `CRITICAL CONTEXT: The user is responding "${command}" to your previous message where you asked for confirmation or approval.\n\n`;
                    prompt += `Your previous message was: "${lastMessage.substring(0, 800)}"\n\n`;

                    if (isConfirmation) {
                        prompt += this.generateConfirmationPrompt(lastMessage, command);
                    } else {
                        prompt += `The user has rejected/cancelled. Acknowledge this and ask if they'd like to try a different approach or cancel the operation.\n\n`;
                    }
                }
            }
        }

        // Handle action commands (create, confirm, etc.) - treat them as confirmations
        const actionCommands: Record<string, string> = {
            'create': 'yes', 'confirm': 'yes', 'approve': 'yes', 'proceed': 'yes',
            'go ahead': 'yes', 'do it': 'yes', 'execute': 'yes',
            'cancel': 'no', 'stop': 'no', 'abort': 'no',
        };

        const normalizedCommand = command.trim().toLowerCase();
        if (actionCommands[normalizedCommand] && !isConfirmation && !isRejection) {
            const action = actionCommands[normalizedCommand];
            if (conversationHistory && conversationHistory.length > 0) {
                const lastAssistantMessage = [...conversationHistory].reverse().find(msg => msg.role === 'assistant');
                if (lastAssistantMessage) {
                    prompt += `CONTEXT: The user clicked a confirmation button or said "${command}" to approve the operation.\n\n`;
                    prompt += `Your previous message was: "${lastAssistantMessage.content.substring(0, 800)}"\n\n`;

                    if (action === 'yes') {
                        prompt += `The user has confirmed/approved. Proceed with the operation you described. Execute the tools you mentioned and complete the task immediately.\n\n`;
                    } else {
                        prompt += `The user has rejected/cancelled. Acknowledge this and ask if they'd like to try a different approach.\n\n`;
                    }
                }
            }
        }

        // Add instruction for direct action if it's a question
        if (isQuestion && needsAnalysis && !isConfirmation && !isRejection && !actionCommands[normalizedCommand]) {
            prompt += `IMPORTANT: This is a question that requires data. Execute the appropriate tool (e.g., analyze_directory) IMMEDIATELY to get the answer. Do not ask for permission or show JSON blocks - just execute and provide the direct answer.\n\n`;
        }

        if (currentDirectory) {
            prompt += `Current working directory: ${currentDirectory}\n\n`;
        }

        // Detect composite folder+file requests (e.g., "make folder X and add document Y inside")
        const isCompositeRequest = this.isCompositeCreationRequest(command);

        // Detect if user wants to create documents/files (not folders)
        const wantsDocuments = /(?:create|make|generate)\s+(?:two|three|four|five|\d+)?\s*(?:document|documents|file|files|\.docx|\.txt|\.md)/i.test(command);
        const hasSpecificFileNames = /(?:called|named|titled|with name|with the name|one that says|that says|the first|the second)\s+["']?([^"']+)["']?/i.test(command);
        const mentionsDocuments = /(?:document|documents|\.docx|\.txt|\.md|text file)/i.test(command);

        // Handle composite folder+file requests specially
        if (isCompositeRequest && !isConfirmation && !isRejection) {
            prompt += this.generateCompositeCreationPrompt(command, currentDirectory);
        } else if ((wantsDocuments || mentionsDocuments || hasSpecificFileNames) && !isConfirmation && !isRejection) {
            prompt += this.generateFileCreationPrompt(command);
        }

        if (includeFileDetails && directoryAnalysis) {
            prompt += this.formatDirectoryAnalysis(directoryAnalysis);
        }

        prompt += `Please provide a helpful response and suggest file operations if appropriate. `;
        prompt += `Be specific about what will happen and always prioritize safety.`;

        return prompt;
    }

    private static generateConfirmationPrompt(lastMessage: string, command: string): string {
        let prompt = '';
        const operationKeywords = {
            'organize': ['organize', 'organization', 'organizing', 'group', 'grouping'],
            'create folders': ['create', 'creating', 'folders', 'subfolders', 'directory', 'directories'],
            'create files': ['create', 'creating', 'files', 'file', 'generate', 'generating', 'make', 'making', 'documents', 'document'],
            'move files': ['move', 'moving', 'relocate'],
            'rename': ['rename', 'renaming', 'rename files'],
            'delete': ['delete', 'deleting', 'remove', 'removing'],
        };

        let detectedOperation = '';
        for (const [op, keywords] of Object.entries(operationKeywords)) {
            if (keywords.some(kw => lastMessage.toLowerCase().includes(kw))) {
                detectedOperation = op;
                break;
            }
        }

        prompt += `ACTION REQUIRED: The user has confirmed/approved with "${command}".\n\n`;
        prompt += `You MUST immediately EXECUTE the tools (not describe them). Do NOT repeat information or ask again.\n`;
        prompt += `If you mentioned creating files, ACTUALLY CALL the 'write_file_content' tool NOW for each file.\n`;
        prompt += `Do NOT describe what you would do - ACTUALLY EXECUTE the tools.\n\n`;

        if (detectedOperation) {
            prompt += `Based on your previous message, you were discussing: ${detectedOperation}.\n\n`;
            prompt += `IMMEDIATELY execute the appropriate tools to ${detectedOperation}:\n`;
            if (detectedOperation.includes('organize')) {
                prompt += `- Use 'organize_files' or 'folder_creation_tab' to create the folder structure\n`;
                prompt += `- Use 'move_file' or 'copy_file' to organize files into the new structure\n`;
            } else if (detectedOperation.includes('create folders')) {
                prompt += `- Use 'folder_creation_tab' or 'create_directory' to create the folders\n`;
            } else if (detectedOperation.includes('create files') || detectedOperation.includes('create file')) {
                // Check if user mentioned specific file names (documents) vs patterns
                const hasSpecificNames = /(?:called|named|titled|with name|with the name)\s+["']?([^"']+)["']?/i.test(lastMessage);
                const mentionsDocuments = /(?:document|documents|docx|txt|file|files)/i.test(lastMessage);
                if (hasSpecificNames || mentionsDocuments) {
                    prompt += `\n=== ACTION REQUIRED: USER CONFIRMED FILE CREATION ===\n`;
                    prompt += `The user said "yes" to creating files. EXECUTE IMMEDIATELY - NO MORE QUESTIONS.\n\n`;
                    prompt += `YOU MUST:\n`;
                    prompt += `1. Extract ALL file names from: "${lastMessage}"\n`;
                    prompt += `2. For EACH file, IMMEDIATELY call 'write_file_content' tool:\n`;
                    prompt += `   - path: Use a RELATIVE path like "filename.docx" - the system will resolve it to the current directory automatically\n`;
                    prompt += `   - content: "" (empty string)\n`;
                    prompt += `   - createDirectories: true\n`;
                    prompt += `   - overwrite: false\n`;
                    prompt += `3. Call 'write_file_content' MULTIPLE TIMES (once per file)\n`;
                    prompt += `4. DO NOT write any text response until AFTER tools execute\n`;
                    prompt += `5. After execution, report: "Created [X] file(s): [list names]"\n\n`;
                    prompt += `EXECUTE THE TOOLS NOW.\n\n`;
                } else {
                    prompt += `- Use 'file_creation_tab' to create files with patterns\n`;
                }
            } else if (detectedOperation.includes('move')) {
                prompt += `- Use 'move_file' to move files to their new locations\n`;
            } else if (detectedOperation.includes('rename')) {
                prompt += `- Use 'rename_files' to rename the files\n`;
            }
            prompt += `\nDO NOT ask for permission again. DO NOT just describe what you would do. EXECUTE THE TOOLS NOW.\n\n`;
        } else {
            prompt += `IMMEDIATELY execute the tools you mentioned in your previous message. Do not repeat information - take action now.\n\n`;
        }
        return prompt;
    }

    private static formatDirectoryAnalysis(directoryAnalysis: any): string {
        let prompt = `Directory Analysis:\n`;
        prompt += `- Total files: ${directoryAnalysis.totalFiles}\n`;
        prompt += `- Total size: ${this.formatBytes(directoryAnalysis.totalSize)}\n`;
        prompt += `- Organization score: ${directoryAnalysis.organizationScore}/100\n\n`;

        if (directoryAnalysis.fileTypes && directoryAnalysis.fileTypes.length > 0) {
            prompt += `File types:\n`;
            directoryAnalysis.fileTypes.slice(0, 5).forEach((type: any) => {
                prompt += `- ${type.extension}: ${type.count} files (${this.formatBytes(type.totalSize)})\n`;
            });
            prompt += `\n`;
        }
        return prompt;
    }

    private static formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    /**
     * Detects if the command is a composite request (folder + file inside).
     * Examples:
     * - "make a folder that is called X and add a document inside called Y"
     * - "make a folder called X and add a document inside called Y"
     * - "create folder X with a file called Y inside"
     */
    private static isCompositeCreationRequest(command: string): boolean {
        const lower = command.toLowerCase();

        // Check for folder creation followed by file creation with "inside/in/within"
        const hasFolderKeyword = /(?:folder|directory)/.test(lower);
        const hasFileKeyword = /(?:document|file)/.test(lower);
        const hasHierarchy = /(?:inside|in\s+it|within|in\s+the\s+folder|into\s+it|put\s+.+\s+in)/.test(lower);

        // Also check for "and add/put" pattern which implies hierarchy
        const hasAndAdd = /folder.*(?:and\s+(?:add|put|create)).*(?:document|file)/i.test(lower);
        // Also match "1 folder and 3 files inside" pattern
        const hasCountedFiles = /folder.*(?:and)\s+(?:\d+|two|three|four|five|six|seven|eight|nine|ten|some|a few|several|multiple)\s+(?:new\s+)?files/i.test(lower);

        return hasFolderKeyword && hasFileKeyword && (hasHierarchy || hasAndAdd || hasCountedFiles);
    }

    /**
     * Detects if the file type is ambiguous and needs clarification.
     * Returns true if user said "document", "file", etc. without specifying extension.
     */
    private static needsFileTypeClarification(command: string): boolean {
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
     * Generates prompt for composite folder+file creation requests.
     */
    private static generateCompositeCreationPrompt(command: string, currentDirectory: string): string {
        const needsClarification = this.needsFileTypeClarification(command);

        let prompt = '';
        prompt += `\n\n=== COMPOSITE FOLDER + FILE REQUEST ===\n`;
        prompt += `The user wants to create a FOLDER and put a FILE INSIDE it.\n\n`;

        if (needsClarification) {
            // File type is ambiguous - ask for clarification
            prompt += `\n⚠️ **STOP - CLARIFICATION REQUIRED** ⚠️\n\n`;
            prompt += `The user said "document" or "file" but did NOT specify what type (txt, docx, md, etc.).\n\n`;
            prompt += `**YOU MUST NOT CALL ANY TOOLS YET.**\n\n`;

            // Check if filenames are missing (numbered request)
            const isNumberedRequest = /\d+\s+files|\s+files/i.test(command);

            prompt += `Instead, respond with ONLY this question (customize the folder/file names):\n\n`;
            prompt += `---\n`;
            prompt += `I'll create the folder "[folder name]" for you.\n\n`;

            if (isNumberedRequest) {
                prompt += `For the files inside, what should I name them and what type (extension) should they be?\n`;
                prompt += `- Example: "notes.txt", "report.docx"\n`;
            } else {
                prompt += `What type of file would you like for "[file name]"?\n`;
                prompt += `- **.txt** - Plain text\n`;
                prompt += `- **.docx** - Word document\n`;
                prompt += `- **.md** - Markdown\n`;
            }
            prompt += `- Or tell me another format\n`;
            prompt += `---\n\n`;
            prompt += `**CRITICAL**: Do NOT use tool_use. Do NOT create any files. Just ask the question above.\n`;
            prompt += `After the user responds with the file type, THEN create the folder and file.\n\n`;
        } else {
            // File type is clear - proceed with execution
            prompt += `STEP 1 - Create the folder FIRST:\n`;
            prompt += `- Use 'create_directory' tool with the folder name\n`;
            prompt += `- path: Use RELATIVE path like "FolderName"\n\n`;
            prompt += `STEP 2 - Create the file INSIDE the folder:\n`;
            prompt += `- Use 'write_file_content' tool with path INSIDE the folder\n`;
            prompt += `- path: "FolderName/filename.ext" (relative path including folder)\n\n`;
            prompt += `IMPORTANT RULES:\n`;
            prompt += `- A "folder" is NOT a file - do NOT create "folder.docx"\n`;
            prompt += `- "inside" means the file path must include the folder\n`;
            prompt += `- Use RELATIVE paths only - resolves to: ${currentDirectory || 'current directory'}\n`;
            prompt += `- Execute BOTH tools in sequence: folder first, then file inside\n\n`;
        }

        return prompt;
    }

    /**
     * Generates prompt for file creation that may need clarification.
     */
    private static generateFileCreationPrompt(command: string): string {
        const needsClarification = this.needsFileTypeClarification(command);

        let prompt = '';

        if (needsClarification) {
            // File type is ambiguous - ask for clarification
            prompt += `\n\n⚠️ **STOP - CLARIFICATION REQUIRED** ⚠️\n\n`;
            prompt += `The user said "document" or "file" but did NOT specify what type (txt, docx, md, etc.).\n\n`;
            prompt += `**YOU MUST NOT CALL ANY TOOLS YET.**\n\n`;

            // Check if filenames are missing (numbered request)
            const isNumberedRequest = /\d+\s+files|\s+files/i.test(command);

            prompt += `Instead, respond with ONLY this question:\n\n`;
            prompt += `---\n`;

            if (isNumberedRequest) {
                prompt += `What should I name these files, and what type (extension) should they be?\n`;
            } else {
                prompt += `What type of file would you like to create?\n`;
                prompt += `- **.txt** - Plain text\n`;
                prompt += `- **.docx** - Word document\n`;
                prompt += `- **.md** - Markdown\n`;
            }
            prompt += `- Or tell me another format\n`;
            prompt += `---\n\n`;
            prompt += `**CRITICAL**: Do NOT use tool_use. Do NOT create any files. Just ask the question above.\n`;
            prompt += `After the user responds with the file type, THEN create the file.\n\n`;
        } else {
            // File type is clear - proceed with execution
            prompt += `\n\n=== FILE CREATION REQUEST ===\n`;
            prompt += `The user wants to create FILE(S). This is NON-DESTRUCTIVE.\n\n`;
            prompt += `EXECUTION STEPS:\n`;
            prompt += `1. Extract file name(s) from the command\n`;
            prompt += `2. For EACH file, call 'write_file_content' tool:\n`;
            prompt += `   - path: Use RELATIVE path like "filename.ext"\n`;
            prompt += `   - content: "" (empty string, unless user specified content)\n`;
            prompt += `   - createDirectories: true\n`;
            prompt += `3. Report results: "Created [X] file(s): [list names]"\n\n`;
            prompt += `RULES:\n`;
            prompt += `- Use RELATIVE paths only\n`;
            prompt += `- NEVER use placeholder text like "[currentDirectory]"\n`;
            prompt += `- Execute immediately - no confirmation needed for file creation\n\n`;
        }

        return prompt;
    }
}
