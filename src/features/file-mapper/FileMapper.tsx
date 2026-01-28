/**
 * File: src/features/file-mapper/FileMapper.tsx
 *
 * Frontend main component for File Mapper feature
 * Provides visual directory structure mapping with multiple visualization styles
 * Updated with Premium Glassmorphism UI
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
  Share2,
  Copy,
  ChevronRight,
  LayoutGrid,
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
import { cn } from "@/lib/utils";

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

  // Export functionality (kept same logic, compressed for brevity in thought but full in code)
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

        if (!saved) return;
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
        setExportSuccess(`File exported successfully!`);
        setTimeout(() => setExportSuccess(null), 3000);
      } else {
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
        scale: 2,
      });

      const isBrowser = !(window as any).__TAURI_INTERNALS__;
      const defaultName = `file-map-${new Date().toISOString().split("T")[0]}`;
      const ext = format;

      if (!isBrowser) {
        const saved = await save({
          defaultPath: `${defaultName}.${ext}`,
          filters: [{ name: format.toUpperCase(), extensions: [ext] }],
        });

        if (!saved) return;

        if (format === "png") {
          canvas.toBlob(async (blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = async () => {
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
        }
      } else {
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

      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= 210;

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
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (!saved) return;
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

  const visualizationStyles: Array<{
    value: VisualizationStyle;
    label: string;
    icon: any;
    description: string;
  }> = [
    { value: "tree", label: "Tree View", icon: GitBranch, description: "Standard hierarchical tree" },
    { value: "sunburst", label: "Sunburst", icon: PieChart, description: "Radial space-filling visualization" },
    { value: "treemap", label: "Treemap", icon: Layers, description: "Nested rectangles for size comparison" },
    { value: "network", label: "Network", icon: Network, description: "Graph layout of connections" },
    { value: "indented", label: "List", icon: List, description: "Simple indented textual list" },
    { value: "size-analysis", label: "Analysis", icon: BarChart3, description: "Statistical size distribution" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden shadow-sm">
      
      {/* Top Navigation Bar */}
      <div className="h-16 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <LayoutGrid className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            File Mapper
          </h1>
        </div>

        <div className="flex items-center gap-4 flex-1 justify-center max-w-2xl">
          <div className="flex flex-1 items-center gap-2 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50 focus-within:ring-2 ring-blue-500/20 transition-all">
             <div className="pl-3 text-slate-400">
               <HardDrive className="h-4 w-4" />
             </div>
             <input 
               type="text" 
               readOnly
               value={sourcePath || "Select a folder to begin..."}
               className="flex-1 bg-transparent border-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none py-1.5"
               onClick={handleBrowseFolder}
             />
             <Button size="sm" onClick={handleBrowseFolder} className="h-7 px-4 shadow-sm">
                Browse
             </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {/* Actions in header */}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Configuration */}
        <div className="w-80 border-r border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex flex-col">
          <div className="p-4 flex-1 overflow-y-auto space-y-6">
            
            {/* Main Action */}
            <Button 
               onClick={handleGenerateMap}
               disabled={loading || !sourcePath}
               className="w-full h-11 shadow-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
               {loading ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                   Scanning...
                 </>
               ) : (
                 <>
                   <Share2 className="w-4 h-4 mr-2" />
                   Generate Map
                 </>
               )}
            </Button>

            {/* Visualization Style */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">Visualization</label>
              <div className="grid grid-cols-2 gap-2">
                {visualizationStyles.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => {
                        setVisualizationStyle(style.value);
                        setConfig({ ...config, style: style.value });
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200",
                      visualizationStyle === style.value
                        ? "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm"
                        : "bg-white/40 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800/80 hover:border-slate-300"
                    )}
                  >
                    <style.icon className={cn("h-5 w-5 mb-1.5", visualizationStyle === style.value ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
                    <span className="text-xs font-medium">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">Filters & Option</label>
                 <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAdvanced(!showAdvanced)}>
                   <Settings className="h-3.5 w-3.5" />
                 </Button>
               </div>
               
               <div className="space-y-3 bg-white/40 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <Checkbox id="show-files" checked={filters.includeFiles} onCheckedChange={(c) => setFilters({...filters, includeFiles: !!c})} />
                    <label htmlFor="show-files" className="text-sm text-slate-700 dark:text-slate-300 select-none cursor-pointer">Show Files</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="show-folders" checked={filters.includeFolders} onCheckedChange={(c) => setFilters({...filters, includeFolders: !!c})} />
                    <label htmlFor="show-folders" className="text-sm text-slate-700 dark:text-slate-300 select-none cursor-pointer">Show Folders</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="show-hidden" checked={filters.includeHidden} onCheckedChange={(c) => setFilters({...filters, includeHidden: !!c})} />
                    <label htmlFor="show-hidden" className="text-sm text-slate-700 dark:text-slate-300 select-none cursor-pointer">Show Hidden</label>
                  </div>
               </div>

               <div className="space-y-3">
                 <div className="flex justify-between text-sm">
                   <span className="text-slate-600 dark:text-slate-400">Max Depth</span>
                   <span className="font-mono text-slate-900 dark:text-slate-200">{config.maxDepth}</span>
                 </div>
                 <Slider 
                   value={[config.maxDepth]}
                   onValueChange={([v]) => setConfig({...config, maxDepth: v})}
                   min={1} max={10} step={1}
                   className="py-2"
                 />
               </div>

               <div className="space-y-2">
                 <label className="text-xs text-slate-500 font-medium">Included Extensions</label>
                 <Input 
                   placeholder="e.g. .ts, .tsx, .json" 
                   value={filters.fileExtensions}
                   onChange={(e) => setFilters({...filters, fileExtensions: e.target.value})}
                   className="h-9 bg-white/50 dark:bg-slate-800/50"
                 />
               </div>
               
               {showAdvanced && (
                 <div className="space-y-3 pt-2 animation-slide-down">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500 font-medium">Excluded Patterns</label>
                      <Input 
                        placeholder="node_modules, .git" 
                        value={filters.excludePatterns}
                        onChange={(e) => setFilters({...filters, excludePatterns: e.target.value})}
                        className="h-9 bg-white/50 dark:bg-slate-800/50"
                      />
                    </div>
                 </div>
               )}
            </div>
          </div>

          {/* Export Actions Footer */}
          <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur">
             <div className="grid grid-cols-2 gap-2 mb-2">
                <Button variant="outline" size="sm" onClick={() => handleExport("text")} disabled={!treeData}>Text</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!treeData}>JSON</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("png")} disabled={!treeData}>Image</Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("html")} disabled={!treeData}>HTML</Button>
             </div>
             <Button variant="ghost" size="sm" className="w-full text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setTreeData(null); setError(null); }}>
               Clear All
             </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-white/30 dark:bg-slate-900/30 overflow-hidden relative">
          
          {loading && (
             <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                <p className="text-blue-600 font-medium animate-pulse">Scanning file system...</p>
             </div>
          )}

          {error && (
            <div className="m-4 p-4 bg-red-50/90 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl flex items-start gap-3 shadow-lg backdrop-blur-md z-40 max-w-lg mx-auto mt-10">
               <X className="h-5 w-5 shrink-0 mt-0.5" />
               <div>
                  <h3 className="font-semibold">Error</h3>
                  <p className="text-sm opacity-90">{error}</p>
               </div>
               <Button size="icon" variant="ghost" className="ml-auto -mr-2 -mt-2 h-8 w-8 text-red-500 hover:bg-red-100" onClick={() => setError(null)}>
                  <X className="h-4 w-4" />
               </Button>
            </div>
          )}

          {treeData ? (
             <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto p-6" data-visualization-container>
                   <div className="max-w-5xl mx-auto h-full shadow-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <VisualizationRenderer
                        data={treeData}
                        style={visualizationStyle}
                        config={config}
                        onRefresh={handleGenerateMap}
                      />
                   </div>
                </div>
                
                {/* Stats Bar */}
                <div className="h-10 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700 flex items-center px-4 justify-between text-xs text-slate-500 dark:text-slate-400 backdrop-blur-md">
                   <div className="flex gap-4">
                      <span>Files: <span className="font-medium text-slate-900 dark:text-slate-200">{statistics.totalFiles.toLocaleString()}</span></span>
                      <span>Folders: <span className="font-medium text-slate-900 dark:text-slate-200">{statistics.totalFolders.toLocaleString()}</span></span>
                   </div>
                   <div>
                      Total Size: <span className="font-medium text-slate-900 dark:text-slate-200">{formatFileSize(statistics.totalSize)}</span>
                   </div>
                </div>
             </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
               <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                  <BarChart3 className="h-10 w-10 opacity-40" />
               </div>
               <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">Ready to Visualize</h2>
               <p className="text-center max-w-sm text-slate-500 mb-8">
                 Select a directory to map its structure. You can filter files, analyze sizes, and export the results.
               </p>
               <Button onClick={handleBrowseFolder} variant="outline" className="gap-2">
                 <HardDrive className="h-4 w-4" />
                 Select Folder
               </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
