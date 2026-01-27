/**
 * File: src/features/file-mapper/FileMapper.tsx
 *
 * Frontend main component for File Mapper feature
 * Provides visual directory structure mapping with multiple visualization styles
 */

import { useState, useEffect } from "react";
import {
  Folder,
  HardDrive,
  Download,
  Settings,
  BarChart3,
  FileText,
  Network,
  Layers,
  GitBranch,
  List,
  PieChart,
  X,
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
} from "./utils/fileSystemScanner";
import {
  VisualizationStyle,
  VisualizationConfig,
  ExportConfig,
  ExportFormat,
} from "./types";
import {
  generateMarkdownExport,
  generateJSONExport,
  generateInteractiveHTMLExport,
} from "./utils/exportUtils";
import { VisualizationRenderer } from "./components/VisualizationRenderer";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { QuickActions } from "./components/QuickActions";
import { PresetTemplates } from "./components/PresetTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export const FileMapper = () => {
  // State management
  const [sourcePath, setSourcePath] = useState<string>("");
  const [treeData, setTreeData] = useState<FileSystemNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [visualizationStyle, setVisualizationStyle] =
    useState<VisualizationStyle>("tree");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  // Configuration state
  const [config, setConfig] = useState<VisualizationConfig>({
    style: "tree",
    showFileSizes: true,
    showFileCounts: true,
    showPercentages: false,
    colorBy: "type",
    maxDepth: 5,
    lineStyle: "unicode",
    iconStyle: "emoji",
  });

  // Filter state
  const [filters, setFilters] = useState({
    includeFiles: true,
    includeFolders: true,
    includeHidden: false,
    fileExtensions: "",
    excludeExtensions: "",
    excludePatterns: "",
    minSize: 0,
    maxSize: 100 * 1024 * 1024, // 100 MB
  });

  // Statistics
  const [statistics, setStatistics] = useState({
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
  });

  // Initialize with home directory
  useEffect(() => {
    const init = async () => {
      try {
        const home = await homeDir();
        setSourcePath(home);
      } catch (e) {
        console.error("Failed to get home dir", e);
        setSourcePath("");
      }
    };
    init();
  }, []);

  // Handle folder selection
  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Folder to Map",
      });

      if (selected && typeof selected === "string") {
        setSourcePath(selected);
      }
    } catch (err) {
      console.error("Error selecting folder:", err);
    }
  };

  // Generate map
  const handleGenerateMap = async () => {
    if (!sourcePath) {
      setError("Please select a source folder");
      return;
    }

    setLoading(true);
    setError(null);

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
      };

      const data = await scanDirectory(sourcePath, scanConfig);

      if (data) {
        setTreeData(data);
        // Calculate statistics
        setStatistics({
          totalFiles: getTotalFileCount(data),
          totalFolders: getTotalFolderCount(data),
          totalSize: getTotalSize(data),
        });
      } else {
        setError("Failed to scan directory");
      }
    } catch (err: any) {
      console.error("Error generating map:", err);
      setError(err.message || "Failed to generate map");
    } finally {
      setLoading(false);
    }
  };

  // Export functionality
  const handleExport = async (format: ExportFormat) => {
    if (!treeData) {
      setError("No map data to export. Please generate a map first.");
      return;
    }

    try {
      // Determine file extension and default name
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

      // Use Tauri save dialog
      const isBrowser = !(window as any).__TAURI_INTERNALS__;
      let filePath: string | null = null;

      if (!isBrowser) {
        const saved = await save({
          defaultPath: `${defaultName}.${ext}`,
          filters: [
            {
              name:
                format === "text"
                  ? "Text"
                  : format === "markdown"
                    ? "Markdown"
                    : format.toUpperCase(),
              extensions: extensions[format],
            },
          ],
        });

        if (!saved) {
          // User cancelled
          return;
        }

        filePath = saved as string;
      }

      let content: string = "";

      // Generate content based on format
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
        // Image exports require capturing the visualization
        await handleImageExport(format);
        return;
      } else if (format === "pdf") {
        // PDF export
        await handlePDFExport();
        return;
      } else {
        setError(`Export format ${format} not yet implemented`);
        return;
      }

      // Write file
      if (!isBrowser && filePath) {
        // Use Tauri file system API
        await writeTextFile(filePath, content);
        setError(null);
        // Show success message
        const successMsg = `File exported successfully!`;
        setExportSuccess(successMsg);
        console.log(`✓ File exported successfully to: ${filePath}`);
        // Clear success message after 3 seconds
        setTimeout(() => setExportSuccess(null), 3000);
      } else {
        // Fallback for browser: use download
        const blob = new Blob([content], {
          type:
            format === "json"
              ? "application/json"
              : format === "csv"
                ? "text/csv"
                : format === "html"
                  ? "text/html"
                  : "text/plain",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${defaultName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setError(null);
        setExportSuccess("File downloaded successfully!");
        setTimeout(() => setExportSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      setError(`Export failed: ${err.message || "Unknown error"}`);
      setExportSuccess(null);
    }
  };

  // Generate text export
  const generateTextExport = (
    node: FileSystemNode,
    isMarkdown: boolean,
  ): string => {
    let output = "";

    if (isMarkdown) {
      output += `# Directory Structure Map\n\n`;
      output += `**Source:** ${sourcePath}\n`;
      output += `**Generated:** ${new Date().toLocaleString()}\n\n`;
      output += `## Statistics\n`;
      output += `- Total Files: ${statistics.totalFiles}\n`;
      output += `- Total Folders: ${statistics.totalFolders}\n`;
      output += `- Total Size: ${formatFileSize(statistics.totalSize)}\n\n`;
      output += `## Structure\n\n`;
    }

    const renderNode = (n: FileSystemNode, indent: number = 0) => {
      const indentStr = isMarkdown ? "  ".repeat(indent) : "  ".repeat(indent);
      const prefix = isMarkdown ? "- " : "";

      output += `${indentStr}${prefix}${n.name}`;
      if (config.showFileSizes && !n.isDirectory) {
        output += ` (${formatFileSize(n.size)})`;
      }
      if (config.showFileCounts && n.isDirectory) {
        output += ` [${n.fileCount || 0} files, ${n.folderCount || 0} folders]`;
      }
      output += "\n";

      if (n.children) {
        n.children.forEach((child) => renderNode(child, indent + 1));
      }
    };

    renderNode(node);
    return output;
  };

  // Generate CSV export
  const generateCSVExport = (node: FileSystemNode): string => {
    let output =
      "Path,Name,Type,Size (bytes),Size (formatted),Depth,Modified Date\n";

    const renderNode = (n: FileSystemNode) => {
      const row = [
        n.path,
        n.name,
        n.isDirectory ? "Folder" : "File",
        n.size.toString(),
        formatFileSize(n.size),
        n.depth.toString(),
        n.modifiedDate ? n.modifiedDate.toISOString() : "",
      ];

      // Escape commas and quotes in CSV
      output +=
        row
          .map((cell) => {
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",") + "\n";

      if (n.children) {
        n.children.forEach((child) => renderNode(child));
      }
    };

    renderNode(node);
    return output;
  };

  // Handle image export (PNG/SVG)
  const handleImageExport = async (format: "png" | "svg") => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const visualizationElement = document.querySelector(
        "[data-visualization-container]",
      );

      if (!visualizationElement) {
        setError("Visualization not found. Please generate a map first.");
        return;
      }

      const canvas = await html2canvas(visualizationElement as HTMLElement, {
        backgroundColor: "#ffffff",
        scale: 2, // Higher resolution
      });

      const isBrowser = !(window as any).__TAURI_INTERNALS__;
      const defaultName = `file-map-${new Date().toISOString().split("T")[0]}`;
      const ext = format;

      if (!isBrowser) {
        const saved = await save({
          defaultPath: `${defaultName}.${ext}`,
          filters: [
            {
              name: format.toUpperCase(),
              extensions: [ext],
            },
          ],
        });

        if (!saved) return;

        if (format === "png") {
          canvas.toBlob(async (blob) => {
            if (blob) {
              // Convert blob to base64 for Tauri writeTextFile
              const reader = new FileReader();
              reader.onloadend = async () => {
                const base64data = (reader.result as string).split(",")[1];
                const binaryString = atob(base64data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                // For Tauri, we'll use a different approach - save as data URL file
                // Actually, let's use the download approach which works better
                const url = canvas.toDataURL("image/png");
                const a = document.createElement("a");
                a.href = url;
                a.download = `${defaultName}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setExportSuccess("Image exported successfully!");
                setTimeout(() => setExportSuccess(null), 3000);
              };
              reader.readAsDataURL(blob);
            }
          }, "image/png");
        } else {
          // SVG export - would need to convert canvas to SVG
          setError("SVG export requires additional implementation");
        }
      } else {
        // Browser fallback
        const url = canvas.toDataURL(`image/${format}`);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${defaultName}.${ext}`;
        a.click();
        setExportSuccess("Image downloaded successfully!");
        setTimeout(() => setExportSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Image export error:", err);
      setError(`Image export failed: ${err.message || "Unknown error"}`);
    }
  };

  // Handle PDF export
  const handlePDFExport = async () => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;
      const visualizationElement = document.querySelector(
        "[data-visualization-container]",
      );

      if (!visualizationElement) {
        setError("Visualization not found. Please generate a map first.");
        return;
      }

      const canvas = await html2canvas(visualizationElement as HTMLElement, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 297; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= 210; // A4 height in mm

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= 210;
      }

      const isBrowser = !(window as any).__TAURI_INTERNALS__;
      const defaultName = `file-map-${new Date().toISOString().split("T")[0]}`;

      if (!isBrowser) {
        const saved = await save({
          defaultPath: `${defaultName}.pdf`,
          filters: [
            {
              name: "PDF",
              extensions: ["pdf"],
            },
          ],
        });

        if (!saved) return;

        // For PDF, use the save method directly which handles binary data
        pdf.save(saved as string);
        setExportSuccess("PDF exported successfully!");
        setTimeout(() => setExportSuccess(null), 3000);
      } else {
        pdf.save(`${defaultName}.pdf`);
        setExportSuccess("PDF downloaded successfully!");
        setTimeout(() => setExportSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("PDF export error:", err);
      setError(`PDF export failed: ${err.message || "Unknown error"}`);
    }
  };

  // Generate HTML export (legacy - now using interactive version)
  const generateHTMLExport = (node: FileSystemNode): string => {
    let structureHTML = "";

    const renderNode = (n: FileSystemNode, indent: number = 0) => {
      const indentStr = "&nbsp;".repeat(indent * 4);
      const icon = n.isDirectory ? "📁" : "📄";
      const sizeInfo =
        config.showFileSizes && !n.isDirectory
          ? ` <span style="color: #666; font-size: 0.9em">(${formatFileSize(n.size)})</span>`
          : "";

      structureHTML += `<div style="margin-left: ${indent * 20}px; padding: 2px 0;">${icon} ${n.name}${sizeInfo}</div>`;

      if (n.children) {
        n.children.forEach((child) => renderNode(child, indent + 1));
      }
    };

    renderNode(node);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Directory Structure Map</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #fff; }
    h1 { color: #333; }
    .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .structure { background: #fff; padding: 10px; }
  </style>
</head>
<body>
  <h1>📊 Directory Structure Map</h1>
  <div class="stats">
    <strong>Source:</strong> ${sourcePath}<br>
    <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
    <strong>Total Files:</strong> ${statistics.totalFiles}<br>
    <strong>Total Folders:</strong> ${statistics.totalFolders}<br>
    <strong>Total Size:</strong> ${formatFileSize(statistics.totalSize)}
  </div>
  <div class="structure">
    <h2>Structure</h2>
    ${structureHTML}
  </div>
</body>
</html>`;
  };

  // Visualization style options
  const visualizationStyles: Array<{
    value: VisualizationStyle;
    label: string;
    icon: any;
  }> = [
    { value: "tree", label: "Tree View", icon: GitBranch },
    { value: "sunburst", label: "Sunburst", icon: PieChart },
    { value: "treemap", label: "Treemap", icon: Layers },
    { value: "network", label: "Network Graph", icon: Network },
    { value: "indented", label: "Indented List", icon: List },
    { value: "mindmap", label: "Mind Map", icon: GitBranch },
    { value: "directory", label: "Directory Chart", icon: BarChart3 },
    { value: "size-analysis", label: "Size Analysis", icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col h-full glass rounded-2xl shadow-xl overflow-hidden relative">
      <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 p-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            📊 File Mapper
          </h1>
        </div>

        {/* Source Folder Selection */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
            Source Folder:
          </label>
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl">
            <HardDrive className="h-4 w-4 text-blue-500" />
            <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
              {sourcePath || "No folder selected"}
            </span>
          </div>
          <Button onClick={handleBrowseFolder} variant="outline" size="sm">
            Browse
          </Button>
        </div>
      </div>

      {/* Visualization Style Selection */}
      <div className="relative z-10 p-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-800/20">
        <div className="mb-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Visualization Style:
          </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {visualizationStyles.map((style) => {
            const Icon = style.icon;
            const isSelected = visualizationStyle === style.value;
            return (
              <button
                key={style.value}
                onClick={() => {
                  setVisualizationStyle(style.value);
                  setConfig({ ...config, style: style.value });
                }}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:border-blue-300"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs text-center">{style.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Configuration Panel */}
        <div className="w-80 border-r border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Configuration
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {/* Basic Filters */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              Filters
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Checkbox
                  checked={filters.includeFiles}
                  onCheckedChange={(checked) =>
                    setFilters({ ...filters, includeFiles: checked as boolean })
                  }
                />
                Show files
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Checkbox
                  checked={filters.includeFolders}
                  onCheckedChange={(checked) =>
                    setFilters({
                      ...filters,
                      includeFolders: checked as boolean,
                    })
                  }
                />
                Show folders
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Checkbox
                  checked={filters.includeHidden}
                  onCheckedChange={(checked) =>
                    setFilters({
                      ...filters,
                      includeHidden: checked as boolean,
                    })
                  }
                />
                Include hidden
              </label>
            </div>
          </div>

          {/* Depth Control */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Max Depth: {config.maxDepth}
            </label>
            <Slider
              value={[config.maxDepth]}
              onValueChange={([value]) =>
                setConfig({ ...config, maxDepth: value })
              }
              min={1}
              max={10}
              step={1}
            />
          </div>

          {/* File Extensions */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
              File Types (comma-separated, e.g., *.txt,*.py,*.js)
            </label>
            <Input
              value={filters.fileExtensions}
              onChange={(e) =>
                setFilters({ ...filters, fileExtensions: e.target.value })
              }
              placeholder="*.txt,*.py,*.js"
              className="text-sm"
            />
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Advanced
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Exclude Extensions
                </label>
                <Input
                  value={filters.excludeExtensions}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      excludeExtensions: e.target.value,
                    })
                  }
                  placeholder="*.pyc,*.log"
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Exclude Patterns
                </label>
                <Input
                  value={filters.excludePatterns}
                  onChange={(e) =>
                    setFilters({ ...filters, excludePatterns: e.target.value })
                  }
                  placeholder="node_modules,__pycache__"
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Color By
                </label>
                <Select
                  value={config.colorBy}
                  onValueChange={(value: "type" | "age" | "size") =>
                    setConfig({ ...config, colorBy: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="type">File Type</SelectItem>
                    <SelectItem value="age">Age</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Preset Templates */}
          {showPresets && (
            <div className="mb-4">
              <PresetTemplates
                onSelectPreset={(preset) => {
                  setVisualizationStyle(preset.style);
                  setConfig({
                    ...config,
                    ...preset.config,
                    style: preset.style,
                  });
                  setShowPresets(false);
                }}
              />
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-4">
            <QuickActions
              onScreenshot={() => handleExport("png")}
              onRefresh={handleGenerateMap}
              onSave={() => {
                // Save current config as preset
                const presetName = prompt("Enter preset name:");
                if (presetName) {
                  const presets = JSON.parse(
                    localStorage.getItem("file-mapper-presets") || "[]",
                  );
                  presets.push({
                    name: presetName,
                    config,
                    filters,
                    style: visualizationStyle,
                  });
                  localStorage.setItem(
                    "file-mapper-presets",
                    JSON.stringify(presets),
                  );
                  setExportSuccess("Preset saved!");
                  setTimeout(() => setExportSuccess(null), 2000);
                }
              }}
              onCopyTree={async () => {
                if (!treeData) return;
                const text = generateTextExport(treeData, false);
                await navigator.clipboard.writeText(text);
                setExportSuccess("Tree copied to clipboard!");
                setTimeout(() => setExportSuccess(null), 2000);
              }}
              onShare={() => {
                if (!treeData) return;
                handleExport("html");
              }}
              onSettings={() => setShowAdvanced(!showAdvanced)}
              disabled={!treeData}
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateMap}
                disabled={loading || !sourcePath}
                className="flex-1"
              >
                {loading ? "Generating..." : "Generate Map"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowPresets(!showPresets)}
                title="Presets"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowStatistics(!showStatistics)}
                title="Statistics"
                disabled={!treeData}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => handleExport("text")}
                variant="outline"
                className="w-full"
                disabled={!treeData}
              >
                <Download className="h-4 w-4 mr-2" />
                Export as Text
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleExport("markdown")}
                  variant="outline"
                  size="sm"
                  disabled={!treeData}
                >
                  Markdown
                </Button>
                <Button
                  onClick={() => handleExport("json")}
                  variant="outline"
                  size="sm"
                  disabled={!treeData}
                >
                  JSON
                </Button>
                <Button
                  onClick={() => handleExport("csv")}
                  variant="outline"
                  size="sm"
                  disabled={!treeData}
                >
                  CSV
                </Button>
                <Button
                  onClick={() => handleExport("html")}
                  variant="outline"
                  size="sm"
                  disabled={!treeData}
                >
                  HTML
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <Button
                  onClick={() => handleExport("png")}
                  variant="outline"
                  size="sm"
                  disabled={!treeData}
                >
                  PNG
                </Button>
                <Button
                  onClick={() => handleExport("pdf")}
                  variant="outline"
                  size="sm"
                  disabled={!treeData}
                >
                  PDF
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setTreeData(null);
                setError(null);
              }}
              className="w-full"
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          {error && (
            <div className="p-4 m-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {exportSuccess && (
            <div className="p-4 m-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400">
              ✓ {exportSuccess}
            </div>
          )}
          {showStatistics && treeData && (
            <div className="p-4">
              <StatisticsPanel data={treeData} statistics={statistics} />
            </div>
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="animate-pulse">Scanning directory structure...</p>
            </div>
          ) : treeData ? (
            <div data-visualization-container>
              <VisualizationRenderer
                data={treeData}
                style={visualizationStyle}
                config={config}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>
                  Select a folder and click "Generate Map" to visualize the
                  directory structure
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Footer */}
      {treeData && (
        <div className="relative z-10 p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 backdrop-blur-md">
          <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <span>
              <strong className="text-slate-700 dark:text-slate-200">
                Total Files:
              </strong>{" "}
              {statistics.totalFiles.toLocaleString()}
            </span>
            <span>•</span>
            <span>
              <strong className="text-slate-700 dark:text-slate-200">
                Total Folders:
              </strong>{" "}
              {statistics.totalFolders.toLocaleString()}
            </span>
            <span>•</span>
            <span>
              <strong className="text-slate-700 dark:text-slate-200">
                Total Size:
              </strong>{" "}
              {formatFileSize(statistics.totalSize)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
