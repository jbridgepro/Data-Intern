/**
 * File: src/features/file-mapper/utils/exportUtils.ts
 * 
 * Backend utility functions for exporting file maps in various formats
 */

import { FileSystemNode } from "./fileSystemScanner";
import { formatFileSize, getTotalSize, getTotalFileCount, getTotalFolderCount } from "./fileSystemScanner";
import { VisualizationConfig } from "../types";

/**
 * Generate enhanced Markdown export with statistics
 */
export function generateMarkdownExport(
  node: FileSystemNode,
  sourcePath: string,
  config: VisualizationConfig,
  statistics: { totalFiles: number; totalFolders: number; totalSize: number }
): string {
  let output = `# Directory Structure: ${node.name}\n\n`;
  output += `**Generated:** ${new Date().toLocaleString()}\n`;
  output += `**Source Path:** \`${sourcePath}\`\n\n`;
  
  output += `## Overview\n`;
  output += `- **Total Files:** ${statistics.totalFiles.toLocaleString()}\n`;
  output += `- **Total Folders:** ${statistics.totalFolders.toLocaleString()}\n`;
  output += `- **Total Size:** ${formatFileSize(statistics.totalSize)}\n`;
  output += `- **Max Depth:** ${getMaxDepth(node)} levels\n`;
  output += `- **Average File Size:** ${formatFileSize(statistics.totalSize / Math.max(statistics.totalFiles, 1))}\n\n`;
  
  output += `## Structure\n\n`;
  
  const renderNode = (n: FileSystemNode, indent: number = 0) => {
    const indentStr = "  ".repeat(indent);
    const icon = n.isDirectory ? "📁" : "📄";
    
    output += `${indentStr}- ${icon} **${n.name}**`;
    
    if (n.isDirectory) {
      const fileCount = getTotalFileCount(n);
      const folderCount = getTotalFolderCount(n);
      const size = getTotalSize(n);
      output += `\n${indentStr}  - *Files:* ${fileCount} | *Folders:* ${folderCount} | *Size:* ${formatFileSize(size)}`;
    } else if (config.showFileSizes) {
      output += ` (${formatFileSize(n.size)})`;
    }
    
    output += "\n";

    if (n.children && n.children.length > 0) {
      n.children.forEach((child) => renderNode(child, indent + 1));
    }
  };

  renderNode(node);
  return output;
}

/**
 * Generate enhanced JSON export with metadata
 */
export function generateJSONExport(
  node: FileSystemNode,
  sourcePath: string,
  statistics: { totalFiles: number; totalFolders: number; totalSize: number }
): string {
  const exportData = {
    scan_date: new Date().toISOString(),
    root_path: sourcePath,
    total_files: statistics.totalFiles,
    total_folders: statistics.totalFolders,
    total_size: statistics.totalSize,
    max_depth: getMaxDepth(node),
    structure: convertNodeToJSON(node),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Convert FileSystemNode to JSON-serializable format
 */
function convertNodeToJSON(node: FileSystemNode): any {
  const result: any = {
    name: node.name,
    type: node.isDirectory ? "folder" : "file",
    path: node.path,
    depth: node.depth,
  };

  if (!node.isDirectory) {
    result.size = node.size;
    result.extension = node.extension;
    if (node.modifiedDate) {
      result.modified_date = node.modifiedDate.toISOString();
    }
  } else {
    result.size = getTotalSize(node);
    result.file_count = getTotalFileCount(node);
    result.folder_count = getTotalFolderCount(node);
    if (node.children && node.children.length > 0) {
      result.children = node.children.map((child) => convertNodeToJSON(child));
    }
  }

  return result;
}

/**
 * Generate interactive HTML export with D3.js visualization
 */
export function generateInteractiveHTMLExport(
  node: FileSystemNode,
  sourcePath: string,
  config: VisualizationConfig,
  statistics: { totalFiles: number; totalFolders: number; totalSize: number },
  visualizationStyle: string
): string {
  const d3CDN = "https://d3js.org/d3.v7.min.js";
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Map: ${node.name}</title>
    <script src="${d3CDN}"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        header .meta {
            opacity: 0.9;
            font-size: 0.9em;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
            border-bottom: 2px solid #e9ecef;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .stat-card .label {
            color: #6c757d;
            font-size: 0.9em;
        }
        #visualization {
            padding: 40px;
            min-height: 600px;
            background: white;
        }
        .tree-view {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.8;
        }
        .tree-view .folder { color: #667eea; font-weight: bold; }
        .tree-view .file { color: #6c757d; }
        .tree-view .size { color: #28a745; font-size: 0.9em; }
        footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            border-top: 2px solid #e9ecef;
        }
        svg { display: block; margin: 0 auto; }
        .tooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 4px;
            pointer-events: none;
            font-size: 12px;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 Directory Structure Map</h1>
            <div class="meta">
                <div><strong>Source:</strong> ${sourcePath}</div>
                <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            </div>
        </header>
        
        <div class="stats">
            <div class="stat-card">
                <div class="value">${statistics.totalFiles.toLocaleString()}</div>
                <div class="label">Total Files</div>
            </div>
            <div class="stat-card">
                <div class="value">${statistics.totalFolders.toLocaleString()}</div>
                <div class="label">Total Folders</div>
            </div>
            <div class="stat-card">
                <div class="value">${formatFileSize(statistics.totalSize)}</div>
                <div class="label">Total Size</div>
            </div>
            <div class="stat-card">
                <div class="value">${getMaxDepth(node)}</div>
                <div class="label">Max Depth</div>
            </div>
        </div>
        
        <div id="visualization">
            ${generateVisualizationHTML(node, visualizationStyle, config)}
        </div>
        
        <footer>
            Generated by File Mapper • ${new Date().getFullYear()}
        </footer>
    </div>
    
    <script>
        ${generateVisualizationScript(node, visualizationStyle, config)}
    </script>
</body>
</html>`;
}

/**
 * Generate visualization HTML based on style
 */
function generateVisualizationHTML(
  node: FileSystemNode,
  style: string,
  config: VisualizationConfig
): string {
  if (style === "tree" || style === "indented") {
    return `<div class="tree-view">${generateTreeHTML(node, config, 0)}</div>`;
  }
  return `<svg id="viz-svg" width="800" height="600"></svg>`;
}

/**
 * Generate tree HTML
 */
function generateTreeHTML(
  node: FileSystemNode,
  config: VisualizationConfig,
  indent: number
): string {
  const indentStr = "&nbsp;".repeat(indent * 4);
  const icon = node.isDirectory ? "📁" : "📄";
  const className = node.isDirectory ? "folder" : "file";
  const sizeInfo = config.showFileSizes && !node.isDirectory
    ? ` <span class="size">(${formatFileSize(node.size)})</span>`
    : "";
  
  let html = `<div>${indentStr}${icon} <span class="${className}">${node.name}</span>${sizeInfo}</div>`;
  
  if (node.children) {
    node.children.forEach((child) => {
      html += generateTreeHTML(child, config, indent + 1);
    });
  }
  
  return html;
}

/**
 * Generate D3.js visualization script
 */
function generateVisualizationScript(
  node: FileSystemNode,
  style: string,
  config: VisualizationConfig
): string {
  if (style === "tree" || style === "indented") {
    return ""; // Tree view doesn't need D3
  }
  
  // For other visualizations, we'd need to embed the D3 code
  // This is a simplified version - full implementation would require
  // serializing the node data and embedding the full D3 visualization code
  return `
    const data = ${JSON.stringify(convertNodeToJSON(node))};
    console.log('Visualization data loaded:', data);
    // Full D3 visualization code would go here
  `;
}

/**
 * Get maximum depth of tree
 */
function getMaxDepth(node: FileSystemNode): number {
  if (!node.children || node.children.length === 0) {
    return node.depth;
  }
  return Math.max(...node.children.map((child) => getMaxDepth(child)));
}
