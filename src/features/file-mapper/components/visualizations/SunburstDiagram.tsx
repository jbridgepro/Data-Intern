/**
 * File: src/features/file-mapper/components/visualizations/SunburstDiagram.tsx
 *
 * Frontend component for Sunburst Diagram visualization
 * Interactive circular hierarchy showing folder/file structure with zoom and pan capabilities
 */

import { useEffect, useRef, useState } from "react";
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

interface SunburstDiagramProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

interface SunburstNode extends d3.HierarchyNode<FileSystemNode> {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

export function SunburstDiagram({ data, config }: SunburstDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomStateRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const isDark = isDarkMode();

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const theme = getTheme();
    const fileTypeColorScale = getFileTypeColorScale();

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

    // Convert FileSystemNode to d3 hierarchy
    const root = d3.hierarchy(data);
    root.sum((d) => (d.isDirectory ? 0 : d.size));

    // Create partition layout
    const partition = d3
      .partition<FileSystemNode>()
      .size([2 * Math.PI, radius]);

    const rootNode = partition(root) as SunburstNode;

    // Create arc generator
    const arc = d3
      .arc<SunburstNode>()
      .startAngle((d) => d.x0!)
      .endAngle((d) => d.x1!)
      .innerRadius((d) => d.y0!)
      .outerRadius((d) => d.y1!);

    // Draw arcs
    const arcs = content
      .selectAll("path")
      .data(rootNode.descendants().filter((d) => d.depth > 0))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => {
        if (config.colorBy === "type") {
          return fileTypeColorScale(d.data.extension || "folder");
        } else if (config.colorBy === "age" && d.data.modifiedDate) {
          const age = Date.now() - d.data.modifiedDate.getTime();
          const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
          const intensity = Math.min(age / maxAge, 1);
          return d3.interpolateBlues(intensity);
        } else {
          // Color by size/depth - smoother gradient
          const totalSize = getTotalSize(data);
          const sizeRatio = Math.log(d.value || 1) / Math.log(totalSize || 1);
          // Use Viridis but slightly tweaked for better aesthetics
          return d3.interpolateSpectral(1 - sizeRatio);
        }
      })
      .attr("stroke", isDark ? "#1e293b" : "#fff") // Theme-aware borders
      .attr("stroke-width", 1)
      .attr("fill-opacity", 0.9)
      .style("cursor", "pointer")
      .style("transition", "fill-opacity 0.2s ease")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .attr("stroke-width", 2)
          .attr("fill-opacity", 1)
          .attr("stroke", isDark ? "#fff" : "#000"); // Highlight border

        // Show tooltip
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
              Path: <span style="font-family: monospace;">${d.data.path}</span><br/>
              ${d.data.isDirectory ? "Folder" : `Size: ${formatFileSize(d.data.size)}`}
            </div>
          `);

        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`);
      })
      .on("mouseout", function () {
        d3.select(this)
          .attr("stroke-width", 1)
          .attr("fill-opacity", 0.9)
          .attr("stroke", isDark ? "#1e293b" : "#fff");
        
        d3.select("body").selectAll("div.tooltip").remove();
      });

    // Add labels for large segments
    if (config.showFileSizes) {
      content
        .selectAll("text")
        .data(
          rootNode.descendants().filter((d) => {
            const angle = (d.x1! - d.x0!) * (180 / Math.PI);
            const radius = d.y1! - d.y0!;
            return (
              angle > 10 && radius > 20 && d.depth <= (config.maxDepth || 3)
            );
          }),
        )
        .enter()
        .append("text")
        .attr("transform", (d) => {
          const x = ((d.x0! + d.x1!) / 2) * (180 / Math.PI);
          const y = (d.y0! + d.y1!) / 2;
          return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        })
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("font-weight", "500")
        .attr("fill", (d) => {
           // Contrast check (simple approximation)
           return isDark ? "#fff" : "#333";
        })
        .style("pointer-events", "none")
        .text((d) => {
          const name =
            d.data.name.length > 15
              ? d.data.name.substring(0, 15) + "..."
              : d.data.name;
          return name;
        });
    }

    // Set up zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        zoomStateRef.current = event.transform;
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
      zoomStateRef.current = d3.zoomIdentity;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-hidden p-6 bg-white dark:bg-slate-900 rounded-lg transition-colors duration-300 relative"
    >
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
    </div>
  );
}
