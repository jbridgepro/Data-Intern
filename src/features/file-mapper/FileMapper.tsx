/**
 * File: src/features/file-mapper/FileMapper.tsx
 *
 * Frontend: Main File Mapper component - upgraded layout and functionality.
 * Provides directory scanning, multiple visualization styles, export,
 * statistics, presets, favorites, quick actions, and advanced filtering.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Folder,
  HardDrive,
  Download,
  BarChart3,
  FileText,
  Network,
  Layers,
  GitBranch,
  List,
  X,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Filter,
  Search,
  FolderSearch,
  Bookmark,
  BookmarkCheck,
  History,
  RotateCcw,
  Ban,
  Image,
  FileJson,
  FileCode,
  FileSpreadsheet,
  RefreshCw,
  Clipboard,
  ClipboardCheck,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Zap,
  Check,
  Globe,
  Brain,
  ListFilter,
} from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  scanDirectory,
  FileSystemNode,
  formatFileSize,
  getTotalSize,
  getTotalFileCount,
  getTotalFolderCount,
  filterTree,
  filterTreeByExtensions,
  getExtensionsFromTree,
} from "./utils/fileSystemScanner";
import { VisualizationStyle, VisualizationConfig, ExportFormat } from "./types";
import {
  generateMarkdownExport,
  generateJSONExport,
  generateInteractiveHTMLExport,
} from "./utils/exportUtils";
import { VisualizationRenderer } from "./components/VisualizationRenderer";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePersistentState } from "../../hooks/usePersistentState";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { fileMapperInfo } from "@/components/layout/toolInfoContent";
import { CancellationTokenSource } from "./utils/cancellationToken";
import { Progress } from "@/components/ui/progress";
/* JobContext available if needed: import { useJobs } from "@/contexts/JobContext"; */

/* ──────────────────────────── Visualization Definitions ──────────────────────────── */

/** All available visualization styles with metadata */
const VISUALIZATION_STYLES: Array<{
  value: VisualizationStyle;
  label: string;
  icon: any;
  description: string;
  color: string;
}> = [
  {
    value: "tree",
    label: "Tree View",
    icon: GitBranch,
    description: "Hierarchical tree with expand / collapse",
    color: "text-emerald-500",
  },
  {
    value: "network",
    label: "Network Graph",
    icon: Network,
    description: "Force-directed graph layout",
    color: "text-violet-500",
  },
  {
    value: "indented",
    label: "List View",
    icon: List,
    description: "Sortable table with columns",
    color: "text-blue-500",
  },
  {
    value: "mindmap",
    label: "Mind Map",
    icon: Brain,
    description: "Radial tree mind map",
    color: "text-pink-500",
  },
  {
    value: "directory",
    label: "Directory Chart",
    icon: Layers,
    description: "Org-chart style diagram",
    color: "text-amber-500",
  },
  {
    value: "size-analysis",
    label: "Size Analysis",
    icon: BarChart3,
    description: "Storage & size statistics",
    color: "text-cyan-500",
  },
];

/** Export format groups for the export panel */
const EXPORT_GROUPS = [
  {
    label: "Images",
    formats: [
      { format: "png" as ExportFormat, label: "PNG Image", icon: Image },
      { format: "svg" as ExportFormat, label: "SVG Vector", icon: FileCode },
      { format: "pdf" as ExportFormat, label: "PDF File", icon: FileText },
    ],
  },
  {
    label: "Data",
    formats: [
      { format: "json" as ExportFormat, label: "JSON", icon: FileJson },
      { format: "csv" as ExportFormat, label: "CSV", icon: FileSpreadsheet },
      { format: "text" as ExportFormat, label: "Plain Text", icon: FileText },
      { format: "markdown" as ExportFormat, label: "Markdown", icon: FileText },
      { format: "html" as ExportFormat, label: "HTML", icon: Globe },
    ],
  },
];

/* ──────────────────────────── Collapsible Section ──────────────────────────── */

/** Reusable collapsible sidebar section */
const SidebarSection = ({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string;
  icon: any;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
}) => {
  const [IsOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200/50 dark:border-slate-800/40 last:border-b-0">
      <button
        onClick={() => setIsOpen(!IsOpen)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" />
          {title}
          {badge !== undefined && (
            <Badge
              variant="secondary"
              className="h-4 px-1.5 text-[10px] font-medium"
            >
              {badge}
            </Badge>
          )}
        </span>
        {IsOpen ? (
          <ChevronDown className="h-3 w-3 opacity-50" />
        ) : (
          <ChevronRight className="h-3 w-3 opacity-50" />
        )}
      </button>
      {IsOpen && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
};

/* ──────────────────────────── Main Component ──────────────────────────── */

export const FileMapper = () => {
  /* ───── State management ───── */
  const [sourcePath, setSourcePath, resetSourcePath] =
    usePersistentState<string>("file-mapper-source-path", "");
  const [treeData, setTreeData] = useState<FileSystemNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{
    processed: number;
    total?: number;
  }>({ processed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [visualizationStyle, setVisualizationStyle, resetVisualizationStyle] =
    usePersistentState<VisualizationStyle>("file-mapper-vis-style", "tree");
  const [showStatistics, setShowStatistics] = useState(false);

  /* ───── Sidebar & panel toggles ───── */
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(
    "file-mapper-sidebar-collapsed",
    false,
  );
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  /* ───── Configuration state ───── */
  const [config, setConfig, resetConfig] =
    usePersistentState<VisualizationConfig>("file-mapper-config", {
      style: "tree",
      showFileSizes: true,
      showFileCounts: true,
      showPercentages: false,
      colorBy: "type",
      maxDepth: 5,
      lineStyle: "unicode",
      iconStyle: "emoji",
    });

  /* ───── Scan settings ───── */
  const [scanSettings, setScanSettings, resetScanSettings] = usePersistentState(
    "file-mapper-scan-settings",
    {
      concurrencyLimit: 50,
      maxFiles: 100000,
    },
  );

  /* ───── Filter state ───── */
  const [filters, setFilters, resetFilters] = usePersistentState(
    "file-mapper-filters",
    {
      includeFiles: true,
      includeFolders: true,
      includeHidden: false,
      fileExtensions: "",
      excludeExtensions: "",
      excludePatterns: "",
      minSize: 0,
      maxSize: 100 * 1024 * 1024,
    },
  );

  /* ───── Search, favorites, recent paths ───── */
  const [searchTerm, setSearchTerm] = useState("");
  const [favoritePaths, setFavoritePaths] = useState<string[]>([]);
  const [recentPaths, setRecentPaths] = useState<string[]>([]);

  /* ───── File filter (Include/Exclude + extension badges, like Copy page) ───── */
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterMode, setFilterMode, resetFilterMode] = usePersistentState<
    "include" | "exclude"
  >("file-mapper-filter-mode", "exclude");

  /* ───── Extensions derived from scanned tree (for filter badges) ───── */
  const availableExtensions = useMemo(() => {
    if (!treeData) return [];
    return getExtensionsFromTree(treeData);
  }, [treeData]);

  /* ───── Refs ───── */
  const cancellationTokenRef = useRef<CancellationTokenSource | null>(null);

  /* ───── Statistics ───── */
  const [statistics, setStatistics] = useState({
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
  });

  /* ───── Filter tree: extensions (Include/Exclude) then search term ───── */
  const filteredData = useMemo(() => {
    if (!treeData) return null;
    let data: FileSystemNode | null = treeData;
    if (activeFilters.length > 0) {
      const extFiltered = filterTreeByExtensions(
        treeData,
        activeFilters,
        filterMode,
      );
      /* When everything filtered out, show empty root rather than full tree */
      data = extFiltered ?? { ...treeData, children: [] };
    }
    if (searchTerm && data) {
      const searchFiltered = filterTree(data, searchTerm);
      data = searchFiltered ?? { ...data, children: [] };
    }
    return data;
  }, [treeData, activeFilters, filterMode, searchTerm]);

  /* ───── Breadcrumb segments from sourcePath ───── */
  const breadcrumbSegments = useMemo(() => {
    if (!sourcePath) return [];
    const parts = sourcePath.split(/[/\\]/).filter(Boolean);
    return parts.map((part, index) => ({
      label: part,
      path:
        (sourcePath.startsWith("/") ? "/" : "") +
        parts.slice(0, index + 1).join("/"),
    }));
  }, [sourcePath]);

  /* ──────────────────── Initialisation ──────────────────── */

  useEffect(() => {
    const Init = async () => {
      try {
        const stored = localStorage.getItem("file-mapper-source-path");
        if (stored === null) {
          const home = await homeDir();
          setSourcePath(home);
        }
      } catch (e) {
        console.error("Failed to get home dir", e);
      }
    };
    Init();

    /* Load favorites and recent paths */
    const savedFav = localStorage.getItem("file-mapper-favorites");
    if (savedFav) setFavoritePaths(JSON.parse(savedFav));

    const savedRecent = localStorage.getItem("file-mapper-recent");
    if (savedRecent) setRecentPaths(JSON.parse(savedRecent));

    return () => {
      if (cancellationTokenRef.current) {
        cancellationTokenRef.current.cancel();
      }
    };
  }, []);

  /* ──────────────────── Handlers ──────────────────── */

  /** Open a native folder picker dialog */
  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Folder to Map",
      });
      if (selected && typeof selected === "string") {
        setSourcePath(selected);
        addToRecent(selected);
      }
    } catch (err) {
      console.error("Error selecting folder:", err);
    }
  };

  /** Add a path to the recent paths list (max 10) */
  const addToRecent = (path: string) => {
    const newRecent = [path, ...recentPaths.filter((p) => p !== path)].slice(
      0,
      10,
    );
    setRecentPaths(newRecent);
    localStorage.setItem("file-mapper-recent", JSON.stringify(newRecent));
  };

  /** Toggle a path as a favourite */
  const toggleFavorite = (path: string) => {
    let newFavs: string[];
    if (favoritePaths.includes(path)) {
      newFavs = favoritePaths.filter((p) => p !== path);
    } else {
      newFavs = [...favoritePaths, path];
    }
    setFavoritePaths(newFavs);
    localStorage.setItem("file-mapper-favorites", JSON.stringify(newFavs));
  };

  /** Trigger directory scan and populate treeData */
  const handleGenerateMap = async () => {
    if (!sourcePath) {
      setError("Please select a source folder");
      return;
    }

    setLoading(true);
    setScanning(true);
    setError(null);
    setProgress({ processed: 0 });

    /* Cancel any previous scan */
    if (cancellationTokenRef.current) {
      cancellationTokenRef.current.cancel();
    }

    const cts = new CancellationTokenSource();
    cancellationTokenRef.current = cts;

    try {
      const scanConfig = {
        maxDepth: config.maxDepth,
        includeHidden: filters.includeHidden,
        includeFiles: filters.includeFiles,
        includeFolders: filters.includeFolders,
        fileExtensions: filters.fileExtensions
          ? filters.fileExtensions.split(",").map((e) => e.trim())
          : undefined,
        excludeExtensions: filters.excludeExtensions
          ? filters.excludeExtensions.split(",").map((e) => e.trim())
          : undefined,
        excludePatterns: filters.excludePatterns
          ? filters.excludePatterns.split(",").map((e) => e.trim())
          : undefined,
        minSize: filters.minSize > 0 ? filters.minSize : undefined,
        maxSize:
          filters.maxSize < 100 * 1024 * 1024 * 1024
            ? filters.maxSize
            : undefined,
        concurrencyLimit: scanSettings.concurrencyLimit,
        maxFiles: scanSettings.maxFiles,
        cancellationToken: cts.token,
        onProgress: (processed: number, total: number) => {
          setProgress({ processed, total: total > 0 ? total : undefined });
        },
      };

      const data = await scanDirectory(sourcePath, scanConfig);

      if (data) {
        setTreeData(data);
        addToRecent(sourcePath);
        setStatistics({
          totalFiles: getTotalFileCount(data),
          totalFolders: getTotalFolderCount(data),
          totalSize: getTotalSize(data),
        });
      } else {
        if (!cts.isCancelled()) {
          setError(
            "Failed to scan directory or no files found matching criteria",
          );
        }
      }
    } catch (err: any) {
      if (err.name === "CancellationError") {
        console.log("Scan cancelled by user");
      } else {
        console.error("Error generating map:", err);
        setError(err.message || "Failed to generate map");
      }
    } finally {
      setLoading(false);
      setScanning(false);
      cancellationTokenRef.current = null;
    }
  };

  /** Cancel a running scan */
  const handleCancelScan = () => {
    if (cancellationTokenRef.current) {
      cancellationTokenRef.current.cancel();
    }
  };

  /* ──────────────────── Export ──────────────────── */

  const handleExport = async (format: ExportFormat) => {
    if (!treeData) {
      setError("No map data to export. Please generate a map first.");
      return;
    }

    try {
      const extensions: Record<ExportFormat, string[]> = {
        text: ["txt"],
        markdown: ["md"],
        json: ["json"],
        csv: ["csv"],
        png: ["png"],
        svg: ["svg"],
        pdf: ["pdf"],
        html: ["html"],
      };

      const defaultName = `file-map-${new Date().toISOString().split("T")[0]}`;
      const ext = extensions[format][0];
      const isBrowser = !(window as any).__TAURI_INTERNALS__;
      let filePath: string | null = null;

      if (!isBrowser) {
        const saved = await save({
          defaultPath: `${defaultName}.${ext}`,
          filters: [
            { name: format.toUpperCase(), extensions: extensions[format] },
          ],
        });
        if (!saved) return;
        filePath = saved as string;
      }

      let content: string = "";

      if (format === "text") {
        content = generateTextExport(treeData, false);
      } else if (format === "markdown") {
        content = generateMarkdownExport(
          treeData,
          sourcePath,
          config,
          statistics,
        );
      } else if (format === "json") {
        content = generateJSONExport(treeData, sourcePath, statistics);
      } else if (format === "csv") {
        content = generateCSVExport(treeData);
      } else if (format === "html") {
        content = generateInteractiveHTMLExport(
          treeData,
          sourcePath,
          config,
          statistics,
          visualizationStyle,
        );
      } else if (format === "png" || format === "svg") {
        await handleImageExport(format);
        return;
      } else if (format === "pdf") {
        await handlePDFExport();
        return;
      } else {
        setError(`Export format ${format} not yet implemented`);
        return;
      }

      if (!isBrowser && filePath) {
        await writeTextFile(filePath, content);
        setError(null);
        setExportSuccess(`Exported as ${format.toUpperCase()} successfully!`);
        setTimeout(() => setExportSuccess(null), 3000);
      } else {
        /* Browser download fallback */
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const anchorElement = document.createElement("a");
        anchorElement.href = url;
        anchorElement.download = `${defaultName}.${ext}`;
        anchorElement.click();
        URL.revokeObjectURL(url);
        setError(null);
        setExportSuccess("File downloaded successfully!");
        setTimeout(() => setExportSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      setError(`Export failed: ${err.message}`);
    }
  };

  /* ───── Export helper functions ───── */

  const generateTextExport = (
    node: FileSystemNode,
    isMarkdown: boolean,
  ): string => {
    let output = "";
    if (isMarkdown) {
      output += `# Directory Structure Map\n\n**Source:** ${sourcePath}\n**Generated:** ${new Date().toLocaleString()}\n\n`;
    }
    const renderNode = (n: FileSystemNode, indent: number = 0) => {
      output += `${"  ".repeat(indent)}${isMarkdown ? "- " : ""}${n.name}\n`;
      if (n.children) n.children.forEach((c) => renderNode(c, indent + 1));
    };
    renderNode(node);
    return output;
  };

  const generateCSVExport = (node: FileSystemNode): string => {
    let csvRows = "Path,Name,Type,Size\n";
    const walk = (n: FileSystemNode) => {
      csvRows += `"${n.path}","${n.name}","${n.isDirectory ? "folder" : "file"}",${n.size}\n`;
      if (n.children) n.children.forEach(walk);
    };
    walk(node);
    return csvRows;
  };

  const handleImageExport = async (_format: "png" | "svg") => {
    /* Placeholder – image export logic */
  };

  const handlePDFExport = async () => {
    /* Placeholder – PDF export logic */
  };

  /* ──────────────────── Copy Tree to Clipboard ──────────────────── */

  const handleCopyTreeToClipboard = useCallback(async () => {
    if (!treeData) return;
    const treeText = generateTextExport(treeData, false);
    try {
      await navigator.clipboard.writeText(treeText);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch {
      /* Fallback for unsupported environments */
      const textArea = document.createElement("textarea");
      textArea.value = treeText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  }, [treeData, sourcePath]);

  /* ──────────────────── Full reset ──────────────────── */

  const toggleFilter = (ext: string) => {
    setActiveFilters((prev) =>
      prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext],
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  const handleFullReset = () => {
    resetSourcePath();
    resetVisualizationStyle();
    resetConfig();
    resetFilters();
    resetScanSettings();
    resetFilterMode();
    setTreeData(null);
    setError(null);
    setSearchTerm("");
    setActiveFilters([]);
    setShowStatistics(false);
    setStatistics({ totalFiles: 0, totalFolders: 0, totalSize: 0 });
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* ──────────── Page Header ──────────── */}
      <PageHeader
        icon={LayoutGrid}
        title="File Mapper"
        subtitle="Visualize directory structure and export maps"
        info={fileMapperInfo}
        toolId="mapper"
        right={
          <div className="flex items-center gap-1">
            {/* Toggle sidebar */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
            {/* Reset */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleFullReset}
              title="Reset all settings"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* ──────────── Toolbar: Path & Actions ──────────── */}
      <div className="flex flex-col border-b border-slate-200/60 dark:border-slate-800/60 bg-card/30 backdrop-blur-lg z-20">
        {/* Row 1: Path input + Generate */}
        <div className="flex items-center justify-between px-4 py-2.5 gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Path Input */}
            <div className="relative flex-1 max-w-2xl">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <FolderSearch className="h-4 w-4" />
              </div>
              <Input
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="Source directory path..."
                className="pl-9 pr-20 h-9 bg-white/50 dark:bg-slate-800/50"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && sourcePath) handleGenerateMap();
                }}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {sourcePath && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleFavorite(sourcePath)}
                    title={
                      favoritePaths.includes(sourcePath)
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                  >
                    {favoritePaths.includes(sourcePath) ? (
                      <BookmarkCheck className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <Bookmark className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                )}
                <Separator orientation="vertical" className="h-4" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleBrowseFolder}
                  disabled={loading}
                  title="Browse for folder"
                >
                  <Folder className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Recent Paths Dropdown */}
            {recentPaths.length > 0 && (
              <Select
                value=""
                onValueChange={(val) => {
                  setSourcePath(val);
                  addToRecent(val);
                }}
                disabled={loading}
              >
                <SelectTrigger className="w-[130px] h-9 bg-white/50 dark:bg-slate-800/50 text-xs">
                  <History className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Recent" />
                </SelectTrigger>
                <SelectContent>
                  {recentPaths.map((path, idx) => (
                    <SelectItem
                      key={idx}
                      value={path}
                      className="truncate max-w-[300px] text-xs"
                    >
                      <span className="truncate block" title={path}>
                        {path.split(/[/\\]/).pop() || path}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Generate / Cancel Button */}
            {loading && cancellationTokenRef.current ? (
              <Button
                onClick={handleCancelScan}
                variant="destructive"
                className="h-9 shadow-sm shrink-0"
              >
                <Ban className="mr-2 h-4 w-4" /> Cancel
              </Button>
            ) : (
              <Button
                onClick={handleGenerateMap}
                disabled={loading || !sourcePath}
                className="h-9 shadow-sm bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shrink-0"
              >
                <Zap className="mr-2 h-4 w-4" />
                {loading ? "Scanning..." : "Generate Map"}
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Breadcrumbs + Search + View toggle (only when map exists) */}
        {treeData && (
          <>
            <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />
            <div className="flex items-center justify-between px-4 py-2 gap-3">
              {/* Left: Breadcrumbs */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto no-scrollbar flex-1 min-w-0">
                {breadcrumbSegments.length > 4 ? (
                  <>
                    <span
                      className="hover:text-foreground cursor-pointer transition-colors shrink-0"
                      onClick={() => setSourcePath(breadcrumbSegments[0].path)}
                      title={breadcrumbSegments[0].path}
                    >
                      {breadcrumbSegments[0].label}
                    </span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
                    <span className="text-muted-foreground/60 shrink-0">
                      ...
                    </span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
                    {breadcrumbSegments.slice(-3).map((seg, i) => (
                      <span
                        key={seg.path}
                        className="flex items-center gap-1 shrink-0"
                      >
                        {i > 0 && (
                          <ChevronRight className="h-3 w-3 opacity-40" />
                        )}
                        <span
                          className="hover:text-foreground cursor-pointer transition-colors"
                          onClick={() => setSourcePath(seg.path)}
                          title={seg.path}
                        >
                          {seg.label}
                        </span>
                      </span>
                    ))}
                  </>
                ) : (
                  breadcrumbSegments.map((seg, i) => (
                    <span
                      key={seg.path}
                      className="flex items-center gap-1 shrink-0"
                    >
                      {i > 0 && <ChevronRight className="h-3 w-3 opacity-40" />}
                      <span
                        className="hover:text-foreground cursor-pointer transition-colors"
                        onClick={() => setSourcePath(seg.path)}
                        title={seg.path}
                      >
                        {seg.label}
                      </span>
                    </span>
                  ))
                )}
              </div>

              {/* Right: Search + actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Search Filter */}
                <div className="relative w-52">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter files..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 pr-8 text-xs bg-white/50 dark:bg-slate-800/50"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <Separator orientation="vertical" className="h-5" />

                {/* Copy Tree */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleCopyTreeToClipboard}
                  disabled={!treeData}
                  title="Copy tree structure to clipboard"
                >
                  {copiedToClipboard ? (
                    <>
                      <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Copied
                      </span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                {/* Toggle Statistics View */}
                <Button
                  variant={showStatistics ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setShowStatistics(!showStatistics)}
                  title={
                    showStatistics ? "Show visualization" : "Show statistics"
                  }
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>{showStatistics ? "Visualization" : "Statistics"}</span>
                </Button>

                {/* Refresh */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleGenerateMap}
                  disabled={loading}
                  title="Refresh scan"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* File Filter Bar (extension badges, like Copy page) */}
            <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        filterMode === "include" ? "default" : "secondary"
                      }
                      size="sm"
                      className={cn(
                        "h-7 text-[10px] px-3 gap-1.5 transition-all border shrink-0",
                        filterMode === "include"
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                          : "bg-background hover:bg-muted text-muted-foreground border-border hover:text-foreground",
                      )}
                      onClick={() =>
                        setFilterMode(
                          filterMode === "include" ? "exclude" : "include",
                        )
                      }
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                      <span>
                        {filterMode === "include" ? "Include" : "Exclude"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    <p className="font-semibold mb-1">
                      {filterMode === "include"
                        ? "Include Mode"
                        : "Exclude Mode"}
                    </p>
                    <p>
                      {filterMode === "include"
                        ? "Only files with selected extensions will be shown."
                        : "Files with selected extensions will be hidden."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Separator orientation="vertical" className="h-4" />

              <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
                {availableExtensions.length > 0 ? (
                  availableExtensions.map((ext) => (
                    <TooltipProvider key={ext} delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={
                              activeFilters.includes(ext)
                                ? filterMode === "exclude"
                                  ? "destructive"
                                  : "default"
                                : "outline"
                            }
                            className={cn(
                              "cursor-pointer text-[10px] h-5 px-2 transition-colors shrink-0",
                              activeFilters.includes(ext)
                                ? filterMode === "exclude"
                                  ? "hover:bg-destructive/80"
                                  : "hover:bg-primary/80"
                                : "hover:bg-secondary",
                            )}
                            onClick={() => toggleFilter(ext)}
                          >
                            {ext === "{no-ext}" ? "No Ext" : `.${ext}`}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {activeFilters.includes(ext)
                            ? filterMode === "exclude"
                              ? `Click to stop hiding .${ext} files`
                              : `Click to stop showing only .${ext} files`
                            : filterMode === "exclude"
                              ? `Click to hide .${ext} files`
                              : `Click to show only .${ext} files`}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground italic px-1">
                    No extensions found
                  </span>
                )}
              </div>

              {activeFilters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground shrink-0"
                  onClick={clearAllFilters}
                  title="Clear all filters"
                >
                  <X className="h-3 w-3 mr-1" />
                  {activeFilters.length} active
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ──────────── Body: Sidebar + Content ──────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ───── Sidebar ───── */}
        <div
          className={cn(
            "border-r border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex flex-col transition-all duration-300 shrink-0 overflow-hidden",
            sidebarCollapsed ? "w-0 border-r-0" : "w-[260px]",
          )}
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {/* Visualization Styles Section */}
            <SidebarSection
              title="Visualization"
              icon={Sparkles}
              badge={VISUALIZATION_STYLES.length}
            >
              <div className="grid grid-cols-1 gap-1.5">
                {VISUALIZATION_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => {
                      setVisualizationStyle(style.value);
                      setConfig({ ...config, style: style.value });
                      setShowStatistics(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg border transition-all duration-200 text-left group",
                      visualizationStyle === style.value && !showStatistics
                        ? "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm"
                        : "bg-transparent border-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/40",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                        visualizationStyle === style.value && !showStatistics
                          ? "bg-blue-100 dark:bg-blue-900/40"
                          : "bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200/80 dark:group-hover:bg-slate-700/60",
                      )}
                    >
                      <style.icon
                        className={cn(
                          "h-3.5 w-3.5",
                          visualizationStyle === style.value && !showStatistics
                            ? style.color
                            : "text-slate-400",
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "text-sm font-medium leading-tight",
                          visualizationStyle === style.value && !showStatistics
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-slate-600 dark:text-slate-400",
                        )}
                      >
                        {style.label}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight truncate">
                        {style.description}
                      </div>
                    </div>
                    {visualizationStyle === style.value && !showStatistics && (
                      <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </SidebarSection>

            {/* Favorites Section */}
            {favoritePaths.length > 0 && (
              <SidebarSection
                title="Favorites"
                icon={BookmarkCheck}
                badge={favoritePaths.length}
                defaultOpen={false}
              >
                <div className="space-y-1">
                  {favoritePaths.map((path) => (
                    <div key={path} className="flex items-center gap-2 group">
                      <button
                        onClick={() => {
                          setSourcePath(path);
                          addToRecent(path);
                        }}
                        className="flex-1 text-left text-xs text-slate-600 dark:text-slate-400 hover:text-foreground transition-colors truncate py-1 px-2 rounded hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                        title={path}
                      >
                        <span className="flex items-center gap-1.5">
                          <Folder className="h-3 w-3 text-yellow-500 shrink-0" />
                          <span className="truncate">
                            {path.split(/[/\\]/).pop() || path}
                          </span>
                        </span>
                      </button>
                      <button
                        onClick={() => toggleFavorite(path)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400 p-0.5"
                        title="Remove from favorites"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </SidebarSection>
            )}

            {/* Configuration Section */}
            <SidebarSection
              title="Configuration"
              icon={SlidersHorizontal}
              defaultOpen={false}
            >
              <div className="space-y-3">
                {/* Display options */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Display
                  </Label>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sb-show-sizes" className="text-xs">
                      Show File Sizes
                    </Label>
                    <Switch
                      id="sb-show-sizes"
                      checked={config.showFileSizes}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, showFileSizes: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sb-show-counts" className="text-xs">
                      Show Counts
                    </Label>
                    <Switch
                      id="sb-show-counts"
                      checked={config.showFileCounts}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, showFileCounts: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sb-show-pct" className="text-xs">
                      Show Percentages
                    </Label>
                    <Switch
                      id="sb-show-pct"
                      checked={config.showPercentages}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, showPercentages: checked })
                      }
                    />
                  </div>
                </div>

                <Separator className="bg-slate-200/40 dark:bg-slate-700/40" />

                {/* Scan depth */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Scan Depth
                  </Label>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-muted-foreground">
                      Max Depth:{" "}
                      <span className="font-semibold text-foreground">
                        {config.maxDepth}
                      </span>
                    </Label>
                    <Slider
                      value={[config.maxDepth]}
                      max={15}
                      min={1}
                      step={1}
                      onValueChange={([v]) =>
                        setConfig({ ...config, maxDepth: v })
                      }
                      className="w-24"
                    />
                  </div>
                </div>

                <Separator className="bg-slate-200/40 dark:bg-slate-700/40" />

                {/* Scan limits */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Scan Limits
                  </Label>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Max Files</Label>
                    <Input
                      type="number"
                      className="h-7 w-20 text-xs"
                      value={scanSettings.maxFiles}
                      onChange={(e) =>
                        setScanSettings({
                          ...scanSettings,
                          maxFiles: parseInt(e.target.value) || 1000,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Concurrency</Label>
                    <Input
                      type="number"
                      className="h-7 w-20 text-xs"
                      value={scanSettings.concurrencyLimit}
                      onChange={(e) =>
                        setScanSettings({
                          ...scanSettings,
                          concurrencyLimit: parseInt(e.target.value) || 10,
                        })
                      }
                    />
                  </div>
                </div>

                <Separator className="bg-slate-200/40 dark:bg-slate-700/40" />

                {/* Filter options */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Filters
                  </Label>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sb-hidden" className="text-xs">
                      Include Hidden
                    </Label>
                    <Switch
                      id="sb-hidden"
                      checked={filters.includeHidden}
                      onCheckedChange={(checked) =>
                        setFilters({ ...filters, includeHidden: checked })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Include Extensions
                    </Label>
                    <Input
                      placeholder="e.g. ts, tsx, js"
                      className="h-7 text-xs"
                      value={filters.fileExtensions}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          fileExtensions: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Exclude Extensions
                    </Label>
                    <Input
                      placeholder="e.g. map, min.js"
                      className="h-7 text-xs"
                      value={filters.excludeExtensions}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          excludeExtensions: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Exclude Patterns
                    </Label>
                    <Input
                      placeholder="e.g. node_modules, .git"
                      className="h-7 text-xs"
                      value={filters.excludePatterns}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          excludePatterns: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </SidebarSection>

            {/* Export Section */}
            <SidebarSection
              title="Export"
              icon={Download}
              defaultOpen={treeData !== null}
            >
              {!treeData ? (
                <p className="text-xs text-muted-foreground italic px-1">
                  Generate a map to enable exports
                </p>
              ) : (
                <div className="space-y-3">
                  {EXPORT_GROUPS.map((group) => (
                    <div key={group.label} className="space-y-1.5">
                      <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {group.label}
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.formats.map(
                          ({ format, label, icon: FormatIcon }) => (
                            <Button
                              key={format}
                              variant="outline"
                              size="sm"
                              onClick={() => handleExport(format)}
                              className="text-xs h-7 gap-1.5 justify-start"
                            >
                              <FormatIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{label}</span>
                            </Button>
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SidebarSection>
          </div>
        </div>

        {/* ───── Main Content Area ───── */}
        <div className="flex-1 flex flex-col bg-white/30 dark:bg-slate-900/30 overflow-hidden relative">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
              <div className="w-80 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                <h3 className="font-semibold text-lg mb-1">
                  Scanning Directory
                </h3>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  {progress.total
                    ? `Processed ${progress.processed.toLocaleString()} of ~${progress.total.toLocaleString()} items`
                    : `Processed ${progress.processed.toLocaleString()} items`}
                </p>
                <div className="w-full mb-4">
                  <Progress
                    value={
                      progress.total
                        ? (progress.processed / progress.total) * 100
                        : undefined
                    }
                    className="h-2"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelScan}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
                >
                  Cancel Scan
                </Button>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="m-4 p-4 bg-red-50/90 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl flex items-start gap-3 shadow-lg z-40 max-w-lg mx-auto mt-6">
              <X className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Error</h3>
                <p className="text-xs opacity-90 wrap-break-word">{error}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto -mr-2 -mt-2 h-6 w-6 text-red-500 hover:bg-red-100 shrink-0"
                onClick={() => setError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Success Toast */}
          {exportSuccess && (
            <div className="absolute top-4 right-4 z-50 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 fade-in">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">{exportSuccess}</span>
            </div>
          )}

          {/* Main Visualization or Empty State */}
          {treeData ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              {showStatistics ? (
                /* Statistics View */
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <StatisticsPanel data={treeData} statistics={statistics} />
                  </div>
                </div>
              ) : (
                /* Visualization View */
                <div
                  className="flex-1 overflow-auto p-4"
                  data-visualization-container
                >
                  <div className="h-full shadow-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <VisualizationRenderer
                      data={filteredData}
                      style={visualizationStyle}
                      config={config}
                      onRefresh={handleGenerateMap}
                    />
                  </div>
                </div>
              )}

              {/* Status Bar */}
              <div className="h-9 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700 flex items-center px-4 justify-between text-xs text-slate-500 dark:text-slate-400 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    Files:{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-200">
                      {statistics.totalFiles.toLocaleString()}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Folder className="h-3 w-3" />
                    Folders:{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-200">
                      {statistics.totalFolders.toLocaleString()}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="h-3 w-3" />
                    Size:{" "}
                    <span className="font-medium text-slate-900 dark:text-slate-200">
                      {formatFileSize(statistics.totalSize)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {(searchTerm || activeFilters.length > 0) && (
                    <Badge
                      variant="secondary"
                      className="h-5 text-[10px] gap-1"
                    >
                      <Filter className="h-2.5 w-2.5" />
                      {searchTerm && activeFilters.length > 0
                        ? `Search + ${filterMode} ${activeFilters.length} ext`
                        : searchTerm
                          ? `Search: "${searchTerm}"`
                          : `${filterMode} ${activeFilters.length} ext`}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="h-5 text-[10px] gap-1 capitalize"
                  >
                    {showStatistics ? (
                      <>
                        <BarChart3 className="h-2.5 w-2.5" />
                        Statistics
                      </>
                    ) : (
                      <>
                        {(() => {
                          const currentStyle = VISUALIZATION_STYLES.find(
                            (s) => s.value === visualizationStyle,
                          );
                          const StyleIcon = currentStyle?.icon || GitBranch;
                          return <StyleIcon className="h-2.5 w-2.5" />;
                        })()}
                        {VISUALIZATION_STYLES.find(
                          (s) => s.value === visualizationStyle,
                        )?.label || "Tree View"}
                      </>
                    )}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Depth: {config.maxDepth}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <EmptyState
              icon={<BarChart3 className="h-8 w-8 text-slate-400" />}
              title="Ready to Visualize"
              description="Select a directory and generate an interactive file structure map with multiple visualization styles"
              action={{
                label: "Select Folder & Generate",
                onClick: handleBrowseFolder,
                icon: <FolderSearch className="h-4 w-4" />,
              }}
              tips={[
                {
                  label: "Tip",
                  text: "Press Enter in the path field to quickly generate a map",
                },
                {
                  label: "Shortcut",
                  text: "Bookmark frequently mapped directories using the star icon",
                },
                {
                  label: "Styles",
                  text: "Choose from 6 visualization styles: Tree, Network, List, Mind Map, Directory Chart, Size Analysis",
                },
                {
                  label: "Export",
                  text: "Export to PNG, SVG, PDF, JSON, CSV, Text, Markdown, or interactive HTML",
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
};
