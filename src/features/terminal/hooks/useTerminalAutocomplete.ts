// File path: ./src/features/terminal/hooks/useTerminalAutocomplete.ts
// Front-end: Terminal autocomplete hook for command and path completion

import { useCallback, useState } from "react";
import { readDir, stat } from "@tauri-apps/plugin-fs";
import { join, isAbsolute } from "@tauri-apps/api/path";
import { homeDir } from "@tauri-apps/api/path";

export interface AutocompleteResult {
  suggestions: string[];
  commonPrefix: string;
  isComplete: boolean;
}

// Common shell commands for autocomplete
const COMMON_COMMANDS = [
  "cd", "ls", "pwd", "mkdir", "rm", "cp", "mv", "cat", "grep", "find",
  "git", "npm", "node", "python", "python3", "echo", "clear", "help",
  "history", "alias", "export", "import", "theme", "tab", "search",
];

export const useTerminalAutocomplete = (currentDirectory: string) => {
  const [isLoading, setIsLoading] = useState(false);

  // Get command suggestions based on input
  const getCommandSuggestions = useCallback((input: string): string[] => {
    if (!input) return COMMON_COMMANDS;
    
    const lowerInput = input.toLowerCase();
    return COMMON_COMMANDS.filter(cmd => 
      cmd.toLowerCase().startsWith(lowerInput)
    );
  }, []);

  // Get file/directory suggestions for path completion
  const getPathSuggestions = useCallback(async (
    input: string,
    command: string
  ): Promise<AutocompleteResult> => {
    setIsLoading(true);
    try {
      // Extract the path part from the input
      const parts = input.trim().split(/\s+/);
      const pathInput = parts.length > 1 ? parts[parts.length - 1] : "";
      
      if (!pathInput) {
        return { suggestions: [], commonPrefix: "", isComplete: false };
      }

      // Determine base directory and search pattern
      let baseDir: string;
      let searchPattern: string;

      if (pathInput.startsWith("~")) {
        const home = await homeDir();
        if (!home) {
          return { suggestions: [], commonPrefix: "", isComplete: false };
        }
        if (pathInput === "~" || pathInput === "~/") {
          baseDir = home;
          searchPattern = "";
        } else {
          const pathWithoutTilde = pathInput.substring(2);
          const lastSlash = pathWithoutTilde.lastIndexOf("/");
          if (lastSlash === -1) {
            baseDir = home;
            searchPattern = pathWithoutTilde;
          } else {
            baseDir = await join(home, pathWithoutTilde.substring(0, lastSlash));
            searchPattern = pathWithoutTilde.substring(lastSlash + 1);
          }
        }
      } else {
        const isAbs = await isAbsolute(pathInput);
        if (isAbs) {
          const lastSlash = pathInput.lastIndexOf("/");
          if (lastSlash === -1) {
            baseDir = "/";
            searchPattern = pathInput;
          } else {
            baseDir = pathInput.substring(0, lastSlash);
            searchPattern = pathInput.substring(lastSlash + 1);
          }
        } else {
          // Relative path
          const lastSlash = pathInput.lastIndexOf("/");
          if (lastSlash === -1) {
            baseDir = currentDirectory || (await homeDir()) || "/";
            searchPattern = pathInput;
          } else {
            const base = currentDirectory || (await homeDir()) || "/";
            baseDir = await join(base, pathInput.substring(0, lastSlash));
            searchPattern = pathInput.substring(lastSlash + 1);
          }
        }
      }

      // Read directory contents
      try {
        const entries = await readDir(baseDir);
        
        // Filter entries that match the search pattern
        const matchingEntries = entries.filter(entry => {
          if (!searchPattern) return true;
          return entry.name.toLowerCase().startsWith(searchPattern.toLowerCase());
        });

        // Sort: directories first, then files
        const sorted = matchingEntries.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        const suggestions = sorted.map(entry => {
          const fullPath = entry.isDirectory 
            ? `${pathInput.includes("/") ? pathInput.substring(0, pathInput.lastIndexOf("/") + 1) : ""}${entry.name}/`
            : `${pathInput.includes("/") ? pathInput.substring(0, pathInput.lastIndexOf("/") + 1) : ""}${entry.name}`;
          return fullPath;
        });

        // Find common prefix
        let commonPrefix = searchPattern;
        if (suggestions.length > 0 && searchPattern) {
          const firstSuggestion = suggestions[0].substring(
            suggestions[0].lastIndexOf("/") + 1
          );
          for (let i = 0; i < firstSuggestion.length; i++) {
            const char = firstSuggestion[i].toLowerCase();
            if (i >= searchPattern.length || 
                searchPattern[i].toLowerCase() !== char) {
              commonPrefix = firstSuggestion.substring(0, i);
              break;
            }
          }
        }

        return {
          suggestions: suggestions.slice(0, 10), // Limit to 10 suggestions
          commonPrefix,
          isComplete: suggestions.length === 1,
        };
      } catch (error) {
        // Directory doesn't exist or can't be read
        return { suggestions: [], commonPrefix: "", isComplete: false };
      }
    } catch (error) {
      console.error("Autocomplete error:", error);
      return { suggestions: [], commonPrefix: "", isComplete: false };
    } finally {
      setIsLoading(false);
    }
  }, [currentDirectory]);

  // Main autocomplete function
  const autocomplete = useCallback(async (
    input: string
  ): Promise<AutocompleteResult> => {
    if (!input.trim()) {
      return { suggestions: [], commonPrefix: "", isComplete: false };
    }

    const parts = input.trim().split(/\s+/);
    const firstPart = parts[0];

    // Check if it looks like a path (contains / or starts with ~)
    if (parts.length > 1 || input.includes("/") || input.startsWith("~")) {
      // Path completion
      return await getPathSuggestions(input, firstPart);
    } else {
      // Command completion
      const suggestions = getCommandSuggestions(firstPart);
      const commonPrefix = suggestions.length > 0 
        ? suggestions[0] 
        : firstPart;
      
      return {
        suggestions,
        commonPrefix,
        isComplete: suggestions.length === 1,
      };
    }
  }, [getCommandSuggestions, getPathSuggestions]);

  return {
    autocomplete,
    isLoading,
  };
};
