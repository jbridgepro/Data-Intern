/**
 * File: src/features/file-mapper/components/visualizations/TreemapView.tsx
 *
 * Frontend component for Treemap visualization
 * Space-filling rectangles sized by file/folder size with zoom and pan capabilities
 */

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { FileSystemNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import { formatFileSize, getTotalSize } from "../../utils/fileSystemScanner";
import {
  getFileTypeColorScale,
  getTheme,
  isDarkMode,
} from "../../utils/visualizationTheme";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TreemapViewProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

export function TreemapView({ data, config }: TreemapViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDark = isDarkMode();

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const theme = getTheme();
    const fileTypeColorScale = getFileTypeColorScale();

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create container group for zoom/pan transformations
    const container = svg
      .append("g")
      .attr("class", "zoom-container");

    // Convert to d3 hierarchy
    const root = d3.hierarchy(data);
    root.sum((d) => (d.isDirectory ? getTotalSize(d) : d.size));
    root.sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    const treemap = d3
      .treemap<FileSystemNode>()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(1)
      .round(true);

    const rootNode = treemap(root);

    // Draw rectangles
    const cells = container
      .selectAll("g")
      .data(
        rootNode.descendants().filter((d) => d.depth <= (config.maxDepth || 4)),
      )
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    cells
      .append("rect")
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", (d) => {
        if (config.colorBy === "type") {
          return fileTypeColorScale(d.data.extension || "folder");
        } else if (config.colorBy === "age" && d.data.modifiedDate) {
          const age = Date.now() - d.data.modifiedDate.getTime();
          const maxAge = 365 * 24 * 60 * 60 * 1000;
          const intensity = Math.min(age / maxAge, 1);
          return d3.interpolateBlues(intensity);
        } else {
          // Color by size/value
          const totalSize = getTotalSize(data);
          const sizeRatio = Math.log(d.value || 1) / Math.log(totalSize || 1);
          
          if (d.data.isDirectory) {
             return isDark ? "#334155" : "#f1f5f9"; // Semantic background for folders
          }
           return d3.interpolateSpectral(1 - sizeRatio);
        }
      })
      .attr("stroke", isDark ? "#1e293b" : "#fff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .style("transition", "fill-opacity 0.2s ease")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .attr("stroke-width", 2)
          .attr("stroke", isDark ? "#fff" : "#000")
          .style("filter", "brightness(1.1)");

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
            <div style="font-weight: 600; margin-bottom: 2px; max-width: 200px; word-wrap: break-word;">${d.data.name}</div>
            <div style="color: ${theme.text.secondary}">
              ${d.data.isDirectory ? "Folder" : "File"}<br/>
              Size: ${formatFileSize(d.value || 0)}
            </div>
          `);

        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`);
      })
      .on("mouseout", function () {
        d3.select(this)
          .attr("stroke-width", 1)
          .attr("stroke", isDark ? "#1e293b" : "#fff")
          .style("filter", "none");
          
        d3.select("body").selectAll("div.tooltip").remove();
      });

    // Add labels for large enough rectangles
    cells
      .filter((d) => d.x1 - d.x0 > 50 && d.y1 - d.y0 > 25)
      .append("text")
      .attr("x", 4)
      .attr("y", 16)
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", (d) => {
          // Simple contrast check
          if (d.data.isDirectory) return theme.text.primary;
          return "#333"; // Most spectral colors work with dark text, but can be improved
      })
      .style("pointer-events", "none")
      .style("overflow", "hidden")
      .text((d) => {
        const name =
          d.data.name.length > 18
            ? d.data.name.substring(0, 18) + "..."
            : d.data.name;
        return name;
      });

    // Add size labels
    if (config.showFileSizes) {
      cells
        .filter((d) => d.x1 - d.x0 > 70 && d.y1 - d.y0 > 40)
        .append("text")
        .attr("x", 4)
        .attr("y", 30)
        .attr("font-size", "10px")
        .attr("fill", (d) => {
             if (d.data.isDirectory) return theme.text.secondary;
             return "#444";
        })
        .style("pointer-events", "none")
        .text((d) => formatFileSize(d.value || 0));
    }

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

      <div className="w-full h-full">
        <svg ref={svgRef} className="w-full h-full min-h-[600px] cursor-move" />
      </div>
    </div>
  );
}
