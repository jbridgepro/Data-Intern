# AI File Assistant - Tool Integration

## Overview

The AI File Assistant now supports **tool use** with both custom file operation tools and MCP (Model Context Protocol) tools. This allows the AI to:

1. **Analyze directories** to understand file structure
2. **Organize files** by type, date, project, or size
3. **Find duplicates** to save space
4. **Rename files** with intelligent patterns
5. **Execute operations** safely with preview
6. **Use MCP tools** for extended functionality (browser automation, git operations, etc.)

## Custom Tools

### Available Tools

1. **analyze_directory**
   - Analyzes a directory to get file statistics
   - Returns file types, sizes, organization score
   - Use before organizing to understand structure

2. **organize_files**
   - Organizes files by strategy (type, date, project, size)
   - Creates preview before execution
   - Strategies: `by-type`, `by-date`, `by-project`, `by-size`

3. **find_duplicates**
   - Finds duplicate files by size and hash
   - Helps identify files that can be safely removed
   - Returns duplicate groups and wasted space

4. **rename_files**
   - Renames files with various patterns
   - Patterns: `date-prefix`, `snake-case`, `standardize`, `clean`

5. **execute_operation**
   - Executes a previously generated file operation
   - Use after organizing/renaming to actually perform changes

## MCP Integration

The AI can also use MCP tools from configured servers:

- **cursor-ide-browser**: Browser automation and testing
- **cursor-browser-extension**: Browser extension tools
- **user-Playwright**: Playwright test execution
- **user-GitKraken**: Git operations

MCP tools are automatically discovered and made available to the AI.

## How It Works

1. User sends a natural language command
2. AI analyzes the command and decides which tools to use
3. AI calls tools in sequence to accomplish the task
4. Tool results are fed back to the AI
5. AI provides a final response with any generated operations

## Example Workflows

### Organizing Files

```
User: "Organize my Downloads folder by file type"

AI workflow:
1. analyze_directory(path: "Downloads")
2. organize_files(path: "Downloads", strategy: "by-type")
3. Returns operation preview
```

### Finding Duplicates

```
User: "Find all duplicate files in my Documents folder"

AI workflow:
1. analyze_directory(path: "Documents")
2. find_duplicates(path: "Documents")
3. Returns duplicate analysis
```

### Using MCP Tools

```
User: "Test my web app after organizing the project files"

AI workflow:
1. organize_files(...)
2. execute_operation(...)
3. cursor-ide-browser::browser_navigate(url: "http://localhost:3000")
4. cursor-ide-browser::browser_snapshot()
```

## Configuration

- **API Key**: Required for AI tool use (configure in Settings)
- **Model Selection**: Choose between Sonnet 4.5, Opus 4.5, or Haiku 4.5
- **Creativity Level**: Conservative, Balanced, or Creative
- **Safety Settings**: Auto-backup, dry-run mode, approval thresholds

## Safety Features

- All operations are previewed before execution
- Destructive operations require confirmation
- Excluded folders are protected
- Automatic backups can be enabled
- Dry-run mode for testing
