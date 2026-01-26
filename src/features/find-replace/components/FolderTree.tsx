/**
 * File path: ./src/features/find-replace/components/FolderTree.tsx
 *
 * Front-end: Enhanced folder tree explorer component for Find and Replace feature.
 * Provides advanced folder navigation with search, breadcrumbs, and quick access.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Folder,
  ChevronRight,
  HardDrive,
  ArrowLeft,
  Home,
  Search,
  X,
  Loader2,
  AlertCircle,
  Star,
  StarOff,
  FolderOpen,
  RefreshCw,
  FileText,
  FolderPlus,
} from "lucide-react";
import { readDir } from "@tauri-apps/plugin-fs";
import { homeDir, join, dirname } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FolderTreeProps {
  onSelectFolder: (path: string) => void;
  selectedPath: string;
}

interface FolderEntry {
  name: string;
  path: string;
  fileCount?: number;
  folderCount?: number;
}

export const FolderTree = ({
  onSelectFolder,
  selectedPath,
}: FolderTreeProps) => {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [filteredFolders, setFilteredFolders] = useState<FolderEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [showPathInput, setShowPathInput] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  // Load favorites and recent paths from localStorage
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem("find-replace-favorites");
      const savedRecent = localStorage.getItem("find-replace-recent");
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
      if (savedRecent) setRecentPaths(JSON.parse(savedRecent));
    } catch (e) {
      console.error("Failed to load favorites/recent", e);
    }
  }, []);

  // Save favorites and recent paths
  useEffect(() => {
    try {
      localStorage.setItem("find-replace-favorites", JSON.stringify(favorites));
    } catch (e) {
      console.error("Failed to save favorites", e);
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem("find-replace-recent", JSON.stringify(recentPaths));
    } catch (e) {
      console.error("Failed to save recent", e);
    }
  }, [recentPaths]);

  // Initialize with home directory
  useEffect(() => {
    const init = async () => {
      try {
        const home = await homeDir();
        setCurrentPath(home);
        if (!selectedPath) onSelectFolder(home);
        updateBreadcrumbs(home);
      } catch (e) {
        console.error("Failed to get home dir", e);
        setCurrentPath("/");
        updateBreadcrumbs("/");
      }
    };
    init();
  }, []);

  // Update breadcrumbs when path changes
  const updateBreadcrumbs = useCallback(async (path: string) => {
    try {
      const parts = path.split("/").filter(Boolean);
      if (path.startsWith("/")) {
        setBreadcrumbs(["/", ...parts]);
      } else {
        setBreadcrumbs(parts);
      }
    } catch (e) {
      setBreadcrumbs([path]);
    }
  }, []);

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const isBrowser = !(window as any).__TAURI_INTERNALS__;
      if (isBrowser) {
        // Mock data for browser
        setFolders([
          { name: "Documents", path: `${path}/Documents` },
          { name: "Downloads", path: `${path}/Downloads` },
          { name: "Projects", path: `${path}/Projects` },
        ]);
        setIsLoading(false);
        return;
      }

      const pathExists = await exists(path);
      if (!pathExists) {
        setError("Path does not exist");
        setFolders([]);
        setIsLoading(false);
        return;
      }

      const entries = await readDir(path);
      const folderEntries: FolderEntry[] = entries
        .filter((e) => e.isDirectory && !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          path: join(path, e.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setFolders(folderEntries);
      setFilteredFolders(folderEntries);
    } catch (err: any) {
      console.error("Failed to read dir", err);
      setError(err.message || "Failed to load directory");
      setFolders([]);
      setFilteredFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load directory when path changes
  useEffect(() => {
    if (currentPath) {
      loadDirectory(currentPath);
      updateBreadcrumbs(currentPath);
    }
  }, [currentPath, loadDirectory, updateBreadcrumbs]);

  // Filter folders based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFolders(folders);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = folders.filter((folder) =>
      folder.name.toLowerCase().includes(query),
    );
    setFilteredFolders(filtered);
  }, [searchQuery, folders]);

  // Navigate to folder
  const handleNavigate = useCallback(
    (path: string) => {
      setHistory((prev) => [...prev, currentPath]);
      setCurrentPath(path);
      onSelectFolder(path);

      // Add to recent paths
      setRecentPaths((prev) => {
        const filtered = prev.filter((p) => p !== path);
        return [path, ...filtered].slice(0, 10);
      });
    },
    [currentPath, onSelectFolder],
  );

  // Navigate to breadcrumb
  const handleBreadcrumbClick = useCallback(
    async (index: number) => {
      try {
        const isBrowser = !(window as any).__TAURI_INTERNALS__;
        if (isBrowser) {
          const path = breadcrumbs.slice(0, index + 1).join("/");
          setCurrentPath(path);
          return;
        }

        if (index === 0 && breadcrumbs[0] === "/") {
          setCurrentPath("/");
          return;
        }

        const path = breadcrumbs.slice(0, index + 1).join("/");
        const pathExists = await exists(path);
        if (pathExists) {
          setCurrentPath(path);
        }
      } catch (e) {
        console.error("Failed to navigate to breadcrumb", e);
      }
    },
    [breadcrumbs],
  );

  // Go up one level
  const traverseUp = useCallback(async () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setCurrentPath(prev);
      onSelectFolder(prev);
      return;
    }

    try {
      const isBrowser = !(window as any).__TAURI_INTERNALS__;
      if (isBrowser) {
        const parts = currentPath.split("/").filter(Boolean);
        parts.pop();
        const parent = parts.length > 0 ? "/" + parts.join("/") : "/";
        if (parent !== currentPath) {
          setCurrentPath(parent);
          onSelectFolder(parent);
        }
        return;
      }

      const parent = await dirname(currentPath);
      if (parent && parent !== currentPath) {
        setCurrentPath(parent);
        onSelectFolder(parent);
      }
    } catch (e) {
      console.error("Failed to traverse up", e);
    }
  }, [history, currentPath, onSelectFolder]);

  // Toggle favorite
  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      if (prev.includes(path)) {
        return prev.filter((p) => p !== path);
      }
      return [...prev, path].slice(0, 20); // Limit to 20 favorites
    });
  }, []);

  // Handle path input
  const handlePathInput = useCallback(async () => {
    if (!pathInput.trim()) return;

    try {
      const isBrowser = !(window as any).__TAURI_INTERNALS__;
      if (isBrowser) {
        setCurrentPath(pathInput);
        setShowPathInput(false);
        setPathInput("");
        return;
      }

      const pathExists = await exists(pathInput);
      if (pathExists) {
        setCurrentPath(pathInput);
        setShowPathInput(false);
        setPathInput("");
        onSelectFolder(pathInput);
      } else {
        setError("Path does not exist");
      }
    } catch (e: any) {
      setError(e.message || "Invalid path");
    }
  }, [pathInput, onSelectFolder]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape to clear search or close path input
      if (e.key === "Escape") {
        if (showPathInput) {
          setShowPathInput(false);
          setPathInput("");
        } else if (searchQuery) {
          setSearchQuery("");
        }
        return;
      }

      // Ctrl+L or Cmd+L to open path input
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        setShowPathInput(true);
        setTimeout(() => pathInputRef.current?.focus(), 100);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery, showPathInput]);

  // Go to home
  const goToHome = useCallback(async () => {
    try {
      const home = await homeDir();
      setCurrentPath(home);
      onSelectFolder(home);
    } catch (e) {
      console.error("Failed to go to home", e);
    }
  }, [onSelectFolder]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-blue-500" />
            Explorer
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToHome}
              className="h-7 w-7 p-0"
              title="Go to Home (Ctrl+H)"
            >
              <Home className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadDirectory(currentPath)}
              className="h-7 w-7 p-0"
              title="Refresh"
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search folders... (Ctrl+F)"
            className="h-8 pl-8 pr-8 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="h-3 w-3 text-slate-400" />
            </button>
          )}
        </div>

        {/* Path Input or Breadcrumbs */}
        {showPathInput ? (
          <div className="flex items-center gap-1.5">
            <Input
              ref={pathInputRef}
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePathInput();
                if (e.key === "Escape") {
                  setShowPathInput(false);
                  setPathInput("");
                }
              }}
              placeholder="Enter path... (Ctrl+L)"
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              onClick={handlePathInput}
              className="h-8 px-2 text-xs"
            >
              Go
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPathInput(false);
                setPathInput("");
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={traverseUp}
                className="h-7 px-1.5"
                title="Go Up"
                disabled={!currentPath || currentPath === "/"}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 truncate max-w-[120px] px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title={crumb}
                    >
                      {index === 0 && breadcrumbs[0] === "/"
                        ? "Root"
                        : crumb.split("/").filter(Boolean).pop() || crumb}
                    </button>
                    {index < breadcrumbs.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPathInput(true)}
                className="h-7 px-1.5 text-xs"
                title="Enter path manually (Ctrl+L)"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Selection Status */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="uppercase tracking-wider text-slate-400 font-semibold">
                Scope:{" "}
                {selectedPath === currentPath
                  ? "Current Folder"
                  : selectedPath.startsWith(currentPath)
                    ? "Sub-folder"
                    : "Different Path"}
              </span>
              {selectedPath && selectedPath !== currentPath && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {selectedPath.split("/").filter(Boolean).pop() || "Selected"}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40 rounded"
              title="Dismiss error"
              aria-label="Dismiss error"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Access */}
      {(favorites.length > 0 || recentPaths.length > 0) && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 space-y-2">
          {favorites.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                Favorites
              </div>
              <div className="space-y-1">
                {favorites.slice(0, 3).map((path) => (
                  <button
                    key={path}
                    onClick={() => handleNavigate(path)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors group"
                  >
                    <Star className="h-3 w-3 text-yellow-500 shrink-0" />
                    <span className="truncate flex-1 text-left">
                      {path.split("/").filter(Boolean).pop() || path}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(path);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from favorites"
                      aria-label="Remove from favorites"
                    >
                      <StarOff className="h-3 w-3 text-slate-400" />
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Folder List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading...</span>
              </div>
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
              <Folder className="h-8 w-8 opacity-20" />
              <span className="text-xs">
                {searchQuery ? "No folders match your search" : "No subfolders"}
              </span>
            </div>
          ) : (
            filteredFolders.map((folder) => {
              const isSelected = selectedPath === folder.path;
              const isFavorite = favorites.includes(folder.path);
              return (
                <div
                  key={folder.path}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors group ${
                    isSelected
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                  onClick={() => handleNavigate(folder.path)}
                >
                  <Folder
                    className={`h-4 w-4 transition-colors shrink-0 ${
                      isSelected
                        ? "text-blue-500"
                        : "text-slate-400 group-hover:text-blue-500"
                    }`}
                  />
                  <span className="text-sm truncate flex-1">{folder.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(folder.path);
                      }}
                      className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                      title={
                        isFavorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      aria-label={
                        isFavorite
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                    >
                      {isFavorite ? (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <Star className="h-3 w-3 text-slate-400" />
                      )}
                    </button>
                    <ChevronRight className="h-3 w-3 text-slate-300" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
