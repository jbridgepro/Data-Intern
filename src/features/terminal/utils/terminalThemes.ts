// File path: ./src/features/terminal/utils/terminalThemes.ts
// Front-end: Terminal theme definitions for premium terminal

export interface TerminalTheme {
  id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    cursor: string;
    selection: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
}

export const terminalThemes: Record<string, TerminalTheme> = {
  default: {
    id: "default",
    name: "Default Dark",
    colors: {
      background: "#0f172a", // slate-900
      foreground: "#e2e8f0", // slate-200
      cursor: "#3b82f6", // blue-500
      selection: "#1e293b", // slate-800
      black: "#1e293b",
      red: "#ef4444",
      green: "#22c55e",
      yellow: "#eab308",
      blue: "#3b82f6",
      magenta: "#a855f7",
      cyan: "#06b6d4",
      white: "#e2e8f0",
      brightBlack: "#475569",
      brightRed: "#f87171",
      brightGreen: "#4ade80",
      brightYellow: "#fbbf24",
      brightBlue: "#60a5fa",
      brightMagenta: "#c084fc",
      brightCyan: "#22d3ee",
      brightWhite: "#f1f5f9",
    },
  },
  dracula: {
    id: "dracula",
    name: "Dracula",
    colors: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#bd93f9",
      selection: "#44475a",
      black: "#21222c",
      red: "#ff5555",
      green: "#50fa7b",
      yellow: "#f1fa8c",
      blue: "#bd93f9",
      magenta: "#ff79c6",
      cyan: "#8be9fd",
      white: "#f8f8f2",
      brightBlack: "#6272a4",
      brightRed: "#ff6e6e",
      brightGreen: "#69ff94",
      brightYellow: "#ffffa5",
      brightBlue: "#d6acff",
      brightMagenta: "#ff92d0",
      brightCyan: "#a4ffff",
      brightWhite: "#ffffff",
    },
  },
  nord: {
    id: "nord",
    name: "Nord",
    colors: {
      background: "#2e3440",
      foreground: "#d8dee9",
      cursor: "#81a1c1",
      selection: "#3b4252",
      black: "#3b4252",
      red: "#bf616a",
      green: "#a3be8c",
      yellow: "#ebcb8b",
      blue: "#81a1c1",
      magenta: "#b48ead",
      cyan: "#88c0d0",
      white: "#e5e9f0",
      brightBlack: "#4c566a",
      brightRed: "#bf616a",
      brightGreen: "#a3be8c",
      brightYellow: "#ebcb8b",
      brightBlue: "#5e81ac",
      brightMagenta: "#b48ead",
      brightCyan: "#8fbcbb",
      brightWhite: "#eceff4",
    },
  },
  solarized: {
    id: "solarized",
    name: "Solarized Dark",
    colors: {
      background: "#002b36",
      foreground: "#839496",
      cursor: "#93a1a1",
      selection: "#073642",
      black: "#073642",
      red: "#dc322f",
      green: "#859900",
      yellow: "#b58900",
      blue: "#268bd2",
      magenta: "#d33682",
      cyan: "#2aa198",
      white: "#eee8d5",
      brightBlack: "#002b36",
      brightRed: "#cb4b16",
      brightGreen: "#586e75",
      brightYellow: "#657b83",
      brightBlue: "#839496",
      brightMagenta: "#6c71c4",
      brightCyan: "#93a1a1",
      brightWhite: "#fdf6e3",
    },
  },
  monokai: {
    id: "monokai",
    name: "Monokai",
    colors: {
      background: "#272822",
      foreground: "#f8f8f2",
      cursor: "#f92672",
      selection: "#49483e",
      black: "#272822",
      red: "#f92672",
      green: "#a6e22e",
      yellow: "#f4bf75",
      blue: "#66d9ef",
      magenta: "#ae81ff",
      cyan: "#a1efe4",
      white: "#f8f8f8",
      brightBlack: "#75715e",
      brightRed: "#f92672",
      brightGreen: "#a6e22e",
      brightYellow: "#e6db74",
      brightBlue: "#66d9ef",
      brightMagenta: "#ae81ff",
      brightCyan: "#a1efe4",
      brightWhite: "#f9f8f5",
    },
  },
  oneDark: {
    id: "oneDark",
    name: "One Dark",
    colors: {
      background: "#282c34",
      foreground: "#abb2bf",
      cursor: "#528bff",
      selection: "#3e4451",
      black: "#282c34",
      red: "#e06c75",
      green: "#98c379",
      yellow: "#e5c07b",
      blue: "#528bff",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: "#abb2bf",
      brightBlack: "#5c6370",
      brightRed: "#e06c75",
      brightGreen: "#98c379",
      brightYellow: "#d19a66",
      brightBlue: "#528bff",
      brightMagenta: "#c678dd",
      brightCyan: "#56b6c2",
      brightWhite: "#ffffff",
    },
  },
};

export const getTheme = (themeId: string): TerminalTheme => {
  return terminalThemes[themeId] || terminalThemes.default;
};
