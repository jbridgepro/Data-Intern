/**
 * File: src/features/file-mapper/components/visualizations/MindMap.tsx
 *
 * Frontend component for Mind Map visualization
 * Radial tree with zoom, pan, and context menu (Copy Path, Reveal in Explorer)
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { FileSystemNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import { formatFileSize } from "../../utils/fileSystemScanner";
import { getTheme, isDarkMode } from "../../utils/visualizationTheme";
import { ZoomIn, ZoomOut, RotateCcw, Copy, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import "./MindMap.css";

/** Context menu positioned via CSS variables (no inline style). */
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
    menuRef.current.style.setProperty("--mindmap-menu-top", `${y}px`);
    menuRef.current.style.setProperty("--mindmap-menu-left", `${x}px`);
  }, [x, y, menuRef]);
  return (
    <div
      ref={menuRef}
      className="mindmap-context-menu fixed z-9999 min-w-[180px] bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 py-1.5"
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface MindMapProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: { path: string; name: string };
}

export function MindMap({ data, config }: MindMapProps) {
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
    const radius = Math.min(width, height) / 2 - 40;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create container group for zoom/pan transformations
    const container = svg
      .append("g")
      .attr("class", "zoom-container");

    // Create main content group
    const content = container
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Convert to d3 hierarchy
    const root = d3.hierarchy(data);

    // Create tree layout
    const tree = d3
      .tree<FileSystemNode>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    const rootNode = tree(root);

    // Draw links
    content
      .selectAll("path")
      .data(rootNode.links())
      .enter()
      .append("path")
      .attr(
        "d",
        d3
          .linkRadial<any, any>()
          .angle((d) => d.x)
          .radius((d) => d.y),
      )
      .attr("fill", "none")
      .attr("stroke", theme.links.stroke)
      .attr("stroke-width", 2)
      .attr("opacity", theme.links.opacity);

    // Draw nodes
    const nodes = content
      .selectAll("g")
      .data(rootNode.descendants())
      .enter()
      .append("g")
      .attr(
        "transform",
        (d) => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`,
      );

    nodes
      .append("circle")
      .attr("r", (d) => (d.data.isDirectory ? 8 : 5))
      .attr("fill", (d) =>
        d.data.isDirectory ? theme.nodes.folder.fill : theme.nodes.file.fill,
      )
      .attr("stroke", (d) =>
        d.data.isDirectory ? theme.nodes.folder.stroke : theme.nodes.file.stroke,
      )
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .style("transition", "all 0.2s ease")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .attr("r", (d: any) => (d.data.isDirectory ? 12 : 8))
          .attr("stroke-width", 3)
          .attr("stroke", d.data.isDirectory ? theme.nodes.folder.hoverStroke : theme.nodes.file.hoverStroke);

        const tooltip = d3
          .select("body")
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", isDark ? "rgba(30, 41, 59, 0.9)" : "rgba(255, 255, 255, 0.9)")
          .style("color", theme.text.primary)
          .style("padding", "8px 12px")
          .style("border-radius", "6px")
          .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)")
          .style("backdrop-filter", "blur(4px)")
          .style("border", `1px solid ${theme.links.stroke}`)
          .style("pointer-events", "none")
          .style("font-size", "12px")
          .style("z-index", "1000").html(`
            <div style="font-weight: 600; margin-bottom: 2px;">${d.data.name}</div>
            <div style="color: ${theme.text.secondary}">
              ${d.data.isDirectory ? "Folder" : `File • ${formatFileSize(d.data.size)}`}
            </div>
          `);

        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`);
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .attr("r", (d: any) => (d.data.isDirectory ? 8 : 5))
          .attr("stroke-width", 2)
          .attr("stroke", d.data.isDirectory ? theme.nodes.folder.stroke : theme.nodes.file.stroke);
        
        d3.select("body").selectAll("div.tooltip").remove();
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

    // Add labels
    nodes
      .append("text")
      .attr("dy", ".35em")
      .attr("x", (d) => (d.x < Math.PI ? 10 : -10))
      .attr("text-anchor", (d) => (d.x < Math.PI ? "start" : "end"))
      .attr("transform", (d) => (d.x >= Math.PI ? "rotate(180)" : ""))
      .text((d) => {
        const name =
          d.data.name.length > 15
            ? d.data.name.substring(0, 15) + "..."
            : d.data.name;
        return name;
      })
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", theme.text.primary);

    // Set up zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform.toString());
      });

    // Apply zoom to SVG
    svg.call(zoomBehavior);

    // Store zoom behavior for external controls
    (svg.node() as any).__zoomBehavior = zoomBehavior;
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
    if (zoomBehavior) {
      svg.transition().call(zoomBehavior.transform, d3.zoomIdentity);
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

      <div className="w-full h-full flex items-center justify-center">
        <svg ref={svgRef} className="w-full h-full max-h-[600px] cursor-move" />
      </div>

      {/* Context Menu: Copy Path, Reveal in Explorer (ported to body so it's not clipped) */}
      {contextMenu &&
        createPortal(
          <ContextMenuPortal
            x={contextMenu.x}
            y={contextMenu.y}
            menuRef={menuRef}
            onClick={(e) => e.stopPropagation()}
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
