// File path: ./src/features/terminal/hooks/useTerminalAliases.ts
// Front-end: Terminal alias management hook

import { useState, useEffect, useCallback } from "react";
import { loadAliases, saveAliases, TerminalAliases } from "../utils/terminalStorage";

export const useTerminalAliases = () => {
  const [aliases, setAliases] = useState<TerminalAliases>({});

  // Load aliases on mount
  useEffect(() => {
    const loaded = loadAliases();
    setAliases(loaded);
  }, []);

  // Save aliases whenever they change
  useEffect(() => {
    saveAliases(aliases);
  }, [aliases]);

  // Add or update an alias
  const setAlias = useCallback((name: string, command: string) => {
    setAliases(prev => ({
      ...prev,
      [name]: command,
    }));
  }, []);

  // Remove an alias
  const removeAlias = useCallback((name: string) => {
    setAliases(prev => {
      const newAliases = { ...prev };
      delete newAliases[name];
      return newAliases;
    });
  }, []);

  // Expand aliases in a command
  const expandAliases = useCallback((command: string): string => {
    const parts = command.trim().split(/\s+/);
    const firstPart = parts[0];
    
    if (aliases[firstPart]) {
      const aliasCommand = aliases[firstPart];
      const remainingArgs = parts.slice(1).join(" ");
      return remainingArgs 
        ? `${aliasCommand} ${remainingArgs}`
        : aliasCommand;
    }
    
    return command;
  }, [aliases]);

  // Get all aliases
  const getAllAliases = useCallback(() => {
    return aliases;
  }, [aliases]);

  return {
    aliases,
    setAlias,
    removeAlias,
    expandAliases,
    getAllAliases,
  };
};
