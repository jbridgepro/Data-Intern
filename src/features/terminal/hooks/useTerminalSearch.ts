// File path: ./src/features/terminal/hooks/useTerminalSearch.ts
// Front-end: Terminal search functionality hook

import { useState, useCallback, useMemo } from "react";

export interface TerminalLine {
  id: string;
  type: "command" | "output" | "error" | "info";
  content: string;
  timestamp: Date;
}

export interface SearchResult {
  lineId: string;
  lineIndex: number;
  matchIndex: number;
  matchLength: number;
}

export const useTerminalSearch = (lines: TerminalLine[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Find all matches in terminal lines
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const results: SearchResult[] = [];
    const query = searchQuery.toLowerCase();

    lines.forEach((line, lineIndex) => {
      const content = line.content.toLowerCase();
      let searchIndex = 0;
      
      while (true) {
        const index = content.indexOf(query, searchIndex);
        if (index === -1) break;
        
        results.push({
          lineId: line.id,
          lineIndex,
          matchIndex: index,
          matchLength: query.length,
        });
        
        searchIndex = index + 1;
      }
    });

    return results;
  }, [lines, searchQuery]);

  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    if (searchResults.length === 0) return;
    
    setCurrentMatchIndex(prev => {
      const next = (prev + 1) % searchResults.length;
      return next;
    });
  }, [searchResults]);

  // Navigate to previous match
  const goToPreviousMatch = useCallback(() => {
    if (searchResults.length === 0) return;
    
    setCurrentMatchIndex(prev => {
      const prevIndex = prev === 0 ? searchResults.length - 1 : prev - 1;
      return prevIndex;
    });
  }, [searchResults]);

  // Get current match
  const currentMatch = useMemo(() => {
    if (searchResults.length === 0 || currentMatchIndex >= searchResults.length) {
      return null;
    }
    return searchResults[currentMatchIndex];
  }, [searchResults, currentMatchIndex]);

  // Start search
  const startSearch = useCallback(() => {
    setIsSearchActive(true);
    setCurrentMatchIndex(0);
  }, []);

  // Stop search
  const stopSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery("");
    setCurrentMatchIndex(0);
  }, []);

  // Update search query
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentMatchIndex(0);
  }, []);

  return {
    searchQuery,
    searchResults,
    currentMatch,
    currentMatchIndex,
    totalMatches: searchResults.length,
    isSearchActive,
    startSearch,
    stopSearch,
    updateSearchQuery,
    goToNextMatch,
    goToPreviousMatch,
  };
};
