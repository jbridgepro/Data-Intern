/**
 * File: src/features/file-mapper/components/visualizations/DirectoryChart.tsx
 *
 * Frontend component for Directory Chart visualization
 * Org-chart style diagram with zoom, pan, and context menu (Copy Path, Reveal in Explorer)
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { FileSystemNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import {
  formatFileSize,
  getTotalSize,
  getTotalFileCount,
  getTotalFolderCount,
} from "../../utils/fileSystemScanner";
import { getTheme, isDarkMode } from "../../utils/visualizationTheme";
import { ZoomIn, ZoomOut, RotateCcw, Copy, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import "./DirectoryChart.css";

interface DirectoryChartProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: { path: string; name: string };
}

/** Wrapper that positions the context menu via CSS variables (no inline style). */
function ContextMenuPortal({
  x,
  y,
  menuRef,
  onClick,
  children,
}: {
  x: number;
  y: number;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!menuRef.current) return;
    menuRef.current.style.setProperty("--directory-chart-menu-top", `${y}px`);
    menuRef.current.style.setProperty("--directory-chart-menu-left", `${x}px`);
  }, [x, y, menuRef]);
  return (
    <div
      ref={menuRef}
      className="directory-chart-context-menu fixed z-9999 min-w-[180px] bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 py-1.5"
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function DirectoryChart({ data, config }: DirectoryChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDark = isDarkMode();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (e.button !== 0 || !contextMenu) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [contextMenu]);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const theme = getTheme();

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Define filter for drop shadow
    const defs = svg.append("defs");
    const filter = defs
      .append("filter")
      .attr("id", "drop-shadow")
      .attr("height", "130%");

    filter
      .append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", 3)
      .attr("result", "blur");

    filter
      .append("feOffset")
      .attr("in", "blur")
      .attr("dx", 2)
      .attr("dy", 2)
      .attr("result", "offsetBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "offsetBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Convert to d3 hierarchy
    const root = d3.hierarchy(data);

    // Create tree layout
    const tree = d3
      .tree<FileSystemNode>()
      .nodeSize([140, 240]) // Increased spacing
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

    const rootNode = tree(root);

    // Center the tree
    let x0 = Infinity;
    let x1 = -Infinity;
    rootNode.each((d) => {
      if (d.x! < x0) x0 = d.x!;
      if (d.x! > x1) x1 = d.x!;
    });

    const dx = x1 - x0;
    const dy = rootNode.height * 140;

    // Store initial viewBox for reset
    const initialViewBox = `${-dy / 2 - 100} ${x0 - 60} ${dy + 300} ${dx + 120}`;
    svg.attr("viewBox", initialViewBox);

    // Create container group for zoom/pan transformations
    const container = svg
      .append("g")
      .attr("class", "zoom-container");

    const g = container
      .append("g")
      .attr("transform", `translate(${-dy / 2},${-x0})`);

    // Draw links
    g.selectAll("path")
      .data(rootNode.links())
      .enter()
      .append("path")
      .attr("fill", "none")
      .attr("stroke", theme.links.stroke)
      .attr("stroke-width", 2)
      .attr("opacity", theme.links.opacity)
      .attr(
        "d",
        d3
          .linkHorizontal<any, any>()
          .x((d) => d.y)
          .y((d) => d.x),
      );

    // Draw nodes
    const node = g
      .selectAll("g")
      .data(rootNode.descendants())
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    // Draw boxes with shadow
    node
      .append("rect")
      .attr("width", 200)
      .attr("height", 90)
      .attr("x", -100)
      .attr("y", -45)
      .attr("rx", 8)
      .attr("fill", (d) =>
        d.data.isDirectory ? theme.nodes.folder.fill : theme.nodes.file.fill,
      )
      .attr("stroke", (d) =>
        d.data.isDirectory ? theme.nodes.folder.stroke : theme.nodes.file.stroke,
      )
      .attr("stroke-width", 2)
      .style("filter", "url(#drop-shadow)")
      .style("cursor", "pointer")
      .style("transition", "all 0.3s ease")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .attr("stroke-width", 4)
          .attr("stroke", d.data.isDirectory ? theme.nodes.folder.hoverStroke : theme.nodes.file.hoverStroke);
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .attr("stroke-width", 2)
          .attr("stroke", d.data.isDirectory ? theme.nodes.folder.stroke : theme.nodes.file.stroke);
      })
      .on("contextmenu", function (event, d) {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          node: { path: d.data.path, name: d.data.name },
        });
      });

    // Add icons/indicators
    node
      .append("circle")
      .attr("cx", -80)
      .attr("cy", 0)
      .attr("r", 5)
      .attr("fill", (d) =>
        d.data.isDirectory ? theme.nodes.folder.stroke : theme.nodes.file.stroke,
      );

    // Add labels
    node
      .append("text")
      .attr("text-anchor", "start")
      .attr("x", -65)
      .attr("y", -5)
      .attr("font-weight", "600")
      .attr("font-size", "13px")
      .attr("fill", theme.text.primary)
      .text((d) => {
        const name =
          d.data.name.length > 22
            ? d.data.name.substring(0, 22) + "..."
            : d.data.name;
        return name;
      });

    // Add metadata
    if (config.showFileSizes || config.showFileCounts) {
      node
        .append("text")
        .attr("text-anchor", "start")
        .attr("x", -65)
        .attr("y", 15)
        .attr("font-size", "11px")
        .attr("fill", theme.text.secondary)
        .text((d) => {
          if (d.data.isDirectory) {
            const fileCount = getTotalFileCount(d.data);
            const folderCount = getTotalFolderCount(d.data);
            return `${fileCount} files, ${folderCount} folders`;
          } else {
            return formatFileSize(d.data.size);
          }
        });

      // Add size for directories
      if (config.showFileSizes) {
        node
          .filter((d) => d.data.isDirectory)
          .append("text")
          .attr("text-anchor", "start")
          .attr("x", -65)
          .attr("y", 30)
          .attr("font-size", "11px")
          .attr("font-weight", "500")
          .attr("fill", theme.text.muted)
          .text((d) => `Total: ${formatFileSize(getTotalSize(d.data))}`);
      }
    }

    // Set up zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform.toString());
      });

    // Apply zoom to SVG
    svg.call(zoomBehavior);

    // Store zoom behavior and initial viewBox for external controls
    (svg.node() as any).__zoomBehavior = zoomBehavior;
    (svg.node() as any).__initialViewBox = initialViewBox;
  }, [data, config, isDark]);

  // Zoom control handlers
  const handleZoomIn = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoomBehavior = (svg.node() as any).__zoomBehavior as d3.ZoomBehavior<SVGSVGElement, unknown>;
    if (zoomBehavior) {
      svg.transition().call(zoomBehavior.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoomBehavior = (svg.node() as any).__zoomBehavior as d3.ZoomBehavior<SVGSVGElement, unknown>;
    if (zoomBehavior) {
      svg.transition().call(zoomBehavior.scaleBy, 1 / 1.5);
    }
  };

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoomBehavior = (svg.node() as any).__zoomBehavior as d3.ZoomBehavior<SVGSVGElement, unknown>;
    const initialViewBox = (svg.node() as any).__initialViewBox as string;
    if (zoomBehavior) {
      svg.transition().call(zoomBehavior.transform, d3.zoomIdentity);
      if (initialViewBox) {
        svg.attr("viewBox", initialViewBox);
      }
    }
  };

  return (
    <div className="h-full overflow-hidden p-6 bg-white dark:bg-slate-900 rounded-lg transition-colors duration-300 relative">
      {/* Zoom Controls */}
      <div className="absolute top-8 right-8 z-10 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleResetZoom}
          className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg"
          title="Reset Zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-full h-full">
        <svg ref={svgRef} className="w-full h-full min-h-[600px] cursor-move" />
      </div>

      {/* Context Menu: Copy Path, Reveal in Explorer (ported to body so it's not clipped) */}
      {contextMenu &&
        createPortal(
          <ContextMenuPortal
            x={contextMenu.x}
            y={contextMenu.y}
            menuRef={menuRef}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-700/50 mb-1">
              {contextMenu.node.name}
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(contextMenu.node.path);
                } catch (err) {
                  console.error("Failed to copy path:", err);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-left transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Path
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await revealItemInDir(contextMenu.node.path);
                } catch (err) {
                  console.error("Failed to reveal item:", err);
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-left transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Reveal in Explorer
            </button>
          </ContextMenuPortal>,
          document.body
        )}
    </div>
  );
}
