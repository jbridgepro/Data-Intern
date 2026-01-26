// File path: ./src/features/terminal/Terminal.tsx
// Front-end: Premium Terminal component with tabs, autocomplete, search, themes, and aliases

import { TerminalTabs } from "./components/TerminalTabs";

// Main Terminal component - now uses premium TerminalTabs
export const Terminal = () => {
  return <TerminalTabs />;
};
