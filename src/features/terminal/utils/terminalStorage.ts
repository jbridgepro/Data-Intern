// File path: ./src/features/terminal/utils/terminalStorage.ts
// Front-end: Terminal storage utilities for history and aliases

export interface TerminalHistory {
  commands: string[];
  exportedAt: string;
  version: string;
}

export interface TerminalAliases {
  [alias: string]: string;
}

const STORAGE_KEYS = {
  HISTORY: "terminal-history",
  ALIASES: "terminal-aliases",
  THEME: "terminal-theme",
  TABS: "terminal-tabs",
} as const;

// History Management
export const saveHistory = (commands: string[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(commands));
  } catch (error) {
    console.error("Failed to save terminal history:", error);
  }
};

export const loadHistory = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load terminal history:", error);
  }
  return [];
};

export const exportHistory = (commands: string[]): string => {
  const history: TerminalHistory = {
    commands,
    exportedAt: new Date().toISOString(),
    version: "1.0",
  };
  return JSON.stringify(history, null, 2);
};

export const importHistory = (jsonString: string): string[] => {
  try {
    const history: TerminalHistory = JSON.parse(jsonString);
    if (history.commands && Array.isArray(history.commands)) {
      return history.commands;
    }
    throw new Error("Invalid history format");
  } catch (error) {
    throw new Error(`Failed to import history: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Alias Management
export const saveAliases = (aliases: TerminalAliases): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ALIASES, JSON.stringify(aliases));
  } catch (error) {
    console.error("Failed to save terminal aliases:", error);
  }
};

export const loadAliases = (): TerminalAliases => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ALIASES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load terminal aliases:", error);
  }
  return {};
};

// Theme Management
export const saveTheme = (themeId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, themeId);
  } catch (error) {
    console.error("Failed to save terminal theme:", error);
  }
};

export const loadTheme = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEYS.THEME) || "default";
  } catch (error) {
    console.error("Failed to load terminal theme:", error);
    return "default";
  }
};
