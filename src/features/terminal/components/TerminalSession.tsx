// File path: ./src/features/terminal/components/TerminalSession.tsx
// Front-end: Individual terminal session component

import { useState, useRef, useEffect, useCallback } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { homeDir, join, isAbsolute } from "@tauri-apps/api/path";
import { cn } from "../../../lib/utils";
import { TerminalTheme } from "../utils/terminalThemes";
import { useTerminalAutocomplete } from "../hooks/useTerminalAutocomplete";
import { useTerminalAliases } from "../hooks/useTerminalAliases";
import { useTerminalSearch, TerminalLine } from "../hooks/useTerminalSearch";
import { saveHistory, loadHistory } from "../utils/terminalStorage";

interface TerminalSessionProps {
  sessionId: string;
  theme: TerminalTheme;
  onClose?: () => void;
  initialDirectory?: string;
}

// Built-in commands type
type BuiltInCommand = (
  args: string[],
  currentDir: string,
  setCurrentDir: (dir: string) => void,
) => Promise<
  string | { type: "CLEAR" } | { type: "HISTORY"; history: string[] }
>;

const createBuiltInCommands = (
  currentDir: string,
  setCurrentDir: (dir: string) => void,
  commandHistory: string[],
  aliases: {
    getAllAliases: () => Record<string, string>;
    setAlias: (name: string, command: string) => void;
  },
): Record<string, BuiltInCommand> => ({
  help: async () => {
    return `FilePro Terminal v2.0 Premium - Available Commands:

Built-in Commands:
  help              - Show this help message
  clear             - Clear the terminal screen
  pwd               - Print current working directory
  cd <path>         - Change working directory
  echo <text>       - Print text to terminal
  history           - Show command history
  alias <name> <cmd> - Create command alias
  aliases           - List all aliases
  theme <name>      - Change terminal theme (premium)
  search            - Search terminal output (Ctrl+F)
  export            - Export command history
  import            - Import command history

Shell Commands:
  Any other command will be executed in your system shell.
  Examples: ls, git status, npm install, etc.

Premium Features:
  - Tab completion (press Tab)
  - Multiple terminal tabs
  - Search functionality (Ctrl+F)
  - Custom themes
  - Command aliases
  - History export/import

Use arrow keys (↑/↓) to navigate command history.`;
  },
  clear: async () => {
    return { type: "CLEAR" } as { type: "CLEAR" };
  },
  pwd: async () => {
    return currentDir || "~";
  },
  cd: async (
    args: string[],
    currentDir: string,
    setCurrentDir: (dir: string) => void,
  ) => {
    if (args.length === 0) {
      try {
        const home = await homeDir();
        const newDir = home || "~";
        setCurrentDir(newDir);
        return newDir;
      } catch (error) {
        return `Error: Failed to get home directory`;
      }
    }

    const targetPath = args[0];
    let newPath: string;

    if (targetPath === "~" || targetPath.startsWith("~/")) {
      try {
        const home = await homeDir();
        if (!home) {
          return `Error: Home directory not available`;
        }
        if (targetPath === "~") {
          newPath = home;
        } else {
          const relativePath = targetPath.substring(2);
          newPath = await join(home, relativePath);
        }
      } catch (error) {
        return `Error: Failed to resolve home directory`;
      }
    } else {
      try {
        const isAbs = await isAbsolute(targetPath);
        if (isAbs) {
          newPath = targetPath;
        } else {
          if (currentDir && currentDir !== "~") {
            newPath = await join(currentDir, targetPath);
          } else {
            const home = await homeDir();
            newPath = await join(home || "/", targetPath);
          }
        }
      } catch (error) {
        return `Error: Failed to resolve path: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    setCurrentDir(newPath);
    return newPath;
  },
  echo: async (args: string[]) => {
    return args.join(" ");
  },
  history: async () => {
    return { type: "HISTORY", history: commandHistory } as {
      type: "HISTORY";
      history: string[];
    };
  },
  alias: async (args: string[]) => {
    if (args.length === 0) {
      const allAliases = aliases.getAllAliases();
      if (Object.keys(allAliases).length === 0) {
        return "No aliases defined. Use 'alias <name> <command>' to create one.";
      }
      return Object.entries(allAliases)
        .map(([name, cmd]) => `${name}='${cmd}'`)
        .join("\n");
    }
    if (args.length === 1) {
      // Show specific alias
      const aliasName = args[0];
      const allAliases = aliases.getAllAliases();
      if (allAliases[aliasName]) {
        return `${aliasName}='${allAliases[aliasName]}'`;
      }
      return `Alias '${aliasName}' not found.`;
    }
    // Create alias
    const aliasName = args[0];
    const aliasCommand = args.slice(1).join(" ");
    aliases.setAlias(aliasName, aliasCommand);
    return `Alias '${aliasName}' created: ${aliasCommand}`;
  },
  aliases: async () => {
    const allAliases = aliases.getAllAliases();
    if (Object.keys(allAliases).length === 0) {
      return "No aliases defined.";
    }
    return Object.entries(allAliases)
      .map(([name, cmd]) => `${name}='${cmd}'`)
      .join("\n");
  },
});

export const TerminalSession = ({
  sessionId,
  theme,
  onClose,
  initialDirectory,
}: TerminalSessionProps) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: "welcome",
      type: "info",
      content: `Welcome to FilePro Terminal v2.0 Premium - Session ${sessionId}`,
      timestamp: new Date(),
    },
    {
      id: "help-hint",
      type: "info",
      content:
        "Type 'help' for available commands. Press Tab for autocomplete, Ctrl+F to search.",
      timestamp: new Date(),
    },
  ]);

  const [currentCommand, setCurrentCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>(loadHistory());
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentDirectory, setCurrentDirectory] = useState<string>(
    initialDirectory || "",
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<
    string[]
  >([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const { autocomplete, isLoading: isAutocompleteLoading } =
    useTerminalAutocomplete(currentDirectory);
  const aliases = useTerminalAliases();
  const search = useTerminalSearch(lines);

  // Initialize directory
  useEffect(() => {
    const initDirectory = async () => {
      if (initialDirectory) {
        setCurrentDirectory(initialDirectory);
        return;
      }
      try {
        const home = await homeDir();
        setCurrentDirectory(home || "~");
      } catch (error) {
        console.error("Failed to get home directory:", error);
        setCurrentDirectory("~");
      }
    };
    initDirectory();
  }, [initialDirectory]);

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current && !search.isSearchActive) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, search.isSearchActive]);

  // Scroll to search match
  useEffect(() => {
    if (search.currentMatch && terminalRef.current) {
      const lineElement = document.getElementById(
        `line-${search.currentMatch.lineId}`,
      );
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
        lineElement.classList.add("bg-yellow-500", "bg-opacity-20");
        setTimeout(() => {
          lineElement.classList.remove("bg-yellow-500", "bg-opacity-20");
        }, 1000);
      }
    }
  }, [search.currentMatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F for search
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        search.startSearch();
      }
      // Escape to close search
      if (e.key === "Escape" && search.isSearchActive) {
        search.stopSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [search]);

  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  // Execute command
  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      // Expand aliases
      const expandedCommand = aliases.expandAliases(command);

      setCommandHistory((prev) => {
        const newHistory = [...prev, command];
        const limitedHistory = newHistory.slice(-100);
        // Save to localStorage
        saveHistory(limitedHistory);
        return limitedHistory;
      });
      setHistoryIndex(-1);

      const commandLine: TerminalLine = {
        id: `cmd-${Date.now()}`,
        type: "command",
        content: expandedCommand,
        timestamp: new Date(),
      };
      setLines((prev) => [...prev, commandLine]);

      const parts = expandedCommand.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      setIsExecuting(true);

      try {
        const builtInCommands = createBuiltInCommands(
          currentDirectory,
          setCurrentDirectory,
          commandHistory,
          aliases,
        );

        if (builtInCommands[cmd]) {
          const result = await builtInCommands[cmd](
            args,
            currentDirectory,
            setCurrentDirectory,
          );

          if (typeof result === "object" && result !== null) {
            if ("type" in result && result.type === "CLEAR") {
              setLines([]);
              setIsExecuting(false);
              return;
            }

            if ("type" in result && result.type === "HISTORY") {
              const historyOutput: TerminalLine = {
                id: `history-${Date.now()}`,
                type: "output",
                content:
                  result.history.length > 0
                    ? result.history
                        .map((cmd, idx) => `${idx + 1}. ${cmd}`)
                        .join("\n")
                    : "No command history yet.",
                timestamp: new Date(),
              };
              setLines((prev) => [...prev, historyOutput]);
              setIsExecuting(false);
              return;
            }
          }

          const outputLine: TerminalLine = {
            id: `output-${Date.now()}`,
            type: "output",
            content: typeof result === "string" ? result : String(result),
            timestamp: new Date(),
          };
          setLines((prev) => [...prev, outputLine]);
        } else {
          // Execute shell command
          try {
            const platform = navigator.platform.toLowerCase();
            let shellCommand: string;
            let shellArgs: string[];

            if (platform.includes("win")) {
              shellCommand = "cmd.exe";
              shellArgs = ["/c", expandedCommand];
            } else {
              shellCommand = "sh";
              shellArgs = ["-c", expandedCommand];
            }

            const process = new Command(shellCommand, shellArgs, {
              cwd: currentDirectory || undefined,
            });

            const output = await process.execute();

            if (output.stdout) {
              const stdoutLines = output.stdout
                .split("\n")
                .filter((line) => line.trim() !== "");
              stdoutLines.forEach((line) => {
                const outputLine: TerminalLine = {
                  id: `output-${Date.now()}-${Math.random()}`,
                  type: "output",
                  content: line,
                  timestamp: new Date(),
                };
                setLines((prev) => [...prev, outputLine]);
              });
            }

            if (output.stderr) {
              const stderrLines = output.stderr
                .split("\n")
                .filter((line) => line.trim() !== "");
              stderrLines.forEach((line) => {
                const errorLine: TerminalLine = {
                  id: `error-${Date.now()}-${Math.random()}`,
                  type: "error",
                  content: line,
                  timestamp: new Date(),
                };
                setLines((prev) => [...prev, errorLine]);
              });
            }

            if (
              !output.stdout &&
              !output.stderr &&
              output.code !== undefined &&
              output.code !== 0
            ) {
              const errorLine: TerminalLine = {
                id: `error-${Date.now()}`,
                type: "error",
                content: `Command exited with code ${output.code}`,
                timestamp: new Date(),
              };
              setLines((prev) => [...prev, errorLine]);
            }
          } catch (error) {
            const errorLine: TerminalLine = {
              id: `error-${Date.now()}`,
              type: "error",
              content: `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date(),
            };
            setLines((prev) => [...prev, errorLine]);
          }
        }
      } catch (error) {
        const errorLine: TerminalLine = {
          id: `error-${Date.now()}`,
          type: "error",
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        };
        setLines((prev) => [...prev, errorLine]);
      } finally {
        setIsExecuting(false);
      }
    },
    [commandHistory, currentDirectory, aliases],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExecuting || !currentCommand.trim()) return;
    executeCommand(currentCommand);
    setCurrentCommand("");
    setShowAutocomplete(false);
  };

  // Handle autocomplete
  const handleAutocomplete = useCallback(async () => {
    if (!currentCommand.trim()) return;

    const result = await autocomplete(currentCommand);

    if (result.suggestions.length > 0) {
      if (result.isComplete && result.suggestions.length === 1) {
        // Complete the command
        setCurrentCommand(result.suggestions[0]);
        setShowAutocomplete(false);
      } else {
        // Show suggestions
        setAutocompleteSuggestions(result.suggestions);
        setShowAutocomplete(true);
        setAutocompleteIndex(0);
      }
    } else {
      setShowAutocomplete(false);
    }
  }, [currentCommand, autocomplete]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showAutocomplete && autocompleteSuggestions.length > 0) {
        setAutocompleteIndex((prev) =>
          prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1,
        );
        return;
      }
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (showAutocomplete && autocompleteSuggestions.length > 0) {
        setAutocompleteIndex((prev) =>
          prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand("");
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleAutocomplete();
    } else if (
      e.key === "Enter" &&
      showAutocomplete &&
      autocompleteSuggestions.length > 0
    ) {
      e.preventDefault();
      setCurrentCommand(autocompleteSuggestions[autocompleteIndex]);
      setShowAutocomplete(false);
    } else {
      setShowAutocomplete(false);
    }
  };

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "command":
        return theme.colors.brightBlue;
      case "output":
        return theme.colors.brightGreen;
      case "error":
        return theme.colors.brightRed;
      case "info":
        return theme.colors.brightYellow;
      default:
        return theme.colors.brightGreen;
    }
  };

  const getPrompt = () => {
    const dir = currentDirectory || "~";
    const shortDir = dir.split("/").pop() || dir;
    return `[${shortDir}] $`;
  };

  // Highlight search matches
  const highlightSearchMatches = (
    content: string,
    lineId: string,
  ): React.ReactNode => {
    if (!search.searchQuery || !search.isSearchActive) {
      return content;
    }

    const query = search.searchQuery;
    const parts = content.split(new RegExp(`(${query})`, "gi"));

    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === query.toLowerCase();
      const isCurrentMatch =
        search.currentMatch?.lineId === lineId &&
        content.indexOf(part) === search.currentMatch.matchIndex;

      if (isMatch) {
        return (
          <span
            key={index}
            className={cn(
              "bg-yellow-500",
              isCurrentMatch ? "bg-opacity-50 font-bold" : "bg-opacity-30",
            )}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden font-mono text-sm shadow-lg border"
      style={{
        backgroundColor: theme.colors.background,
        borderColor: theme.colors.selection,
      }}
      onClick={handleTerminalClick}
    >
      {/* Terminal Header */}
      <div
        className="p-2 flex items-center px-4"
        style={{ backgroundColor: theme.colors.selection }}
      >
        <div className="flex gap-2 mr-4">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span style={{ color: theme.colors.foreground }} className="text-xs">
          Terminal {sessionId}
        </span>
        {isExecuting && (
          <span
            className="ml-auto text-xs animate-pulse"
            style={{ color: theme.colors.brightBlue }}
          >
            Executing...
          </span>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto text-xs hover:opacity-70"
            style={{ color: theme.colors.foreground }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search Bar */}
      {search.isSearchActive && (
        <div
          className="p-2 flex items-center gap-2 border-b"
          style={{
            backgroundColor: theme.colors.selection,
            borderColor: theme.colors.background,
          }}
        >
          <input
            type="text"
            value={search.searchQuery}
            onChange={(e) => search.updateSearchQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-2 py-1 rounded text-sm"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.foreground,
            }}
            autoFocus
          />
          <span style={{ color: theme.colors.foreground }} className="text-xs">
            {search.totalMatches > 0
              ? `${search.currentMatchIndex + 1}/${search.totalMatches}`
              : "No matches"}
          </span>
          <button
            onClick={search.goToPreviousMatch}
            disabled={search.totalMatches === 0}
            className="px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.foreground,
            }}
          >
            ↑
          </button>
          <button
            onClick={search.goToNextMatch}
            disabled={search.totalMatches === 0}
            className="px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.foreground,
            }}
          >
            ↓
          </button>
          <button
            onClick={search.stopSearch}
            className="px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.foreground,
            }}
          >
            Esc
          </button>
        </div>
      )}

      {/* Terminal Output Area */}
      <div
        ref={terminalRef}
        className="flex-1 p-4 overflow-auto"
        style={{
          maxHeight: "calc(100% - 80px)",
          color: theme.colors.foreground,
        }}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            id={`line-${line.id}`}
            className="mb-1 whitespace-pre-wrap break-words"
            style={{ color: getLineColor(line.type) }}
          >
            {line.type === "command" && (
              <span style={{ color: theme.colors.brightBlue }}>
                {getPrompt()}
              </span>
            )}
            {highlightSearchMatches(line.content, line.id)}
          </div>
        ))}

        {/* Autocomplete Suggestions */}
        {showAutocomplete && autocompleteSuggestions.length > 0 && (
          <div
            ref={autocompleteRef}
            className="absolute mt-1 p-2 rounded border shadow-lg z-10 max-h-48 overflow-auto"
            style={{
              backgroundColor: theme.colors.selection,
              borderColor: theme.colors.background,
              color: theme.colors.foreground,
            }}
          >
            {autocompleteSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className={cn(
                  "px-2 py-1 cursor-pointer rounded",
                  index === autocompleteIndex && "bg-opacity-50",
                )}
                style={{
                  backgroundColor:
                    index === autocompleteIndex
                      ? theme.colors.background
                      : "transparent",
                }}
                onClick={() => {
                  setCurrentCommand(suggestion);
                  setShowAutocomplete(false);
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}

        {/* Current Input Line */}
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 items-center mt-2 relative"
        >
          <span style={{ color: theme.colors.brightBlue }}>{getPrompt()}</span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            className="flex-1 bg-transparent outline-none border-none focus:outline-none"
            style={{ color: theme.colors.brightGreen }}
            placeholder={isExecuting ? "Executing command..." : ""}
            autoFocus
          />
          {isExecuting && (
            <span
              style={{ color: theme.colors.brightBlue }}
              className="animate-pulse"
            >
              ⏳
            </span>
          )}
        </form>
      </div>
    </div>
  );
};
