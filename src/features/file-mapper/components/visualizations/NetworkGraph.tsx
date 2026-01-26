/**
 * File: src/features/file-mapper/components/visualizations/NetworkGraph.tsx
 *
 * Frontend component for Network Graph visualization
 * Node-based relationship diagram showing folder/file connections with zoom and pan capabilities
 */

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { FileSystemNode } from "../../utils/fileSystemScanner";
import { VisualizationConfig } from "../../types";
import { formatFileSize } from "../../utils/fileSystemScanner";
import { getTheme, isDarkMode } from "../../utils/visualizationTheme";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NetworkGraphProps {
  data: FileSystemNode;
  config: VisualizationConfig;
}

export function NetworkGraph({ data, config }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDark = isDarkMode();

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

    // Create container group for zoom/pan transformations
    const container = svg
      .append("g")
      .attr("class", "zoom-container");

    // Build nodes and links
    const nodes: Array<{
      id: string;
      name: string;
      isDirectory: boolean;
      size: number;
      depth: number;
    }> = [];
    const links: Array<{ source: string; target: string }> = [];

    const buildGraph = (node: FileSystemNode, parentId?: string) => {
      const nodeId = node.path;
      nodes.push({
        id: nodeId,
        name: node.name,
        isDirectory: node.isDirectory,
        size: node.size,
        depth: node.depth,
      });

      if (parentId) {
        links.push({ source: parentId, target: nodeId });
      }

      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => buildGraph(child, nodeId));
      }
    };

    buildGraph(data);

    // Limit nodes for performance
    const maxNodes = 200;
    if (nodes.length > maxNodes) {
      nodes.splice(maxNodes);
      links.splice(links.length);
    }

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(60), // Increased distance
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(25)); // Increased collision radius

    // Draw links
    const link = container
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", theme.links.stroke)
      .attr("stroke-opacity", theme.links.opacity)
      .attr("stroke-width", 1.5);

    // Draw nodes
    const node = container
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => (d.isDirectory ? 10 : 6)) // Slightly larger
      .attr("fill", (d) =>
        d.isDirectory ? theme.nodes.folder.fill : theme.nodes.file.fill,
      )
      .attr("stroke", (d) =>
        d.isDirectory ? theme.nodes.folder.stroke : theme.nodes.file.stroke,
      )
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .style("transition", "all 0.2s ease")
      .call(
        d3
          .drag<any, any>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended),
      )
      .on("mouseover", function (event, d) {
        // Highlight node
        d3.select(this)
          .attr("r", (d: any) => (d.isDirectory ? 14 : 9))
          .attr("stroke-width", 3)
          .attr("stroke", d.isDirectory ? theme.nodes.folder.hoverStroke : theme.nodes.file.hoverStroke);

        // Highlight connected links
        link
          .attr("stroke", (l: any) => (l.source.id === d.id || l.target.id === d.id ? theme.nodes.folder.stroke : theme.links.stroke))
          .attr("stroke-opacity", (l: any) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.2))
          .attr("stroke-width", (l: any) => (l.source.id === d.id || l.target.id === d.id ? 2.5 : 1));

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
            <div style="font-weight: 600; margin-bottom: 2px;">${d.name}</div>
            <div style="color: ${theme.text.secondary}">
              ${d.isDirectory ? "Folder" : `File • ${formatFileSize(d.size)}`}
            </div>
          `);

        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY + 10}px`);
      })
      .on("mouseout", function (event, d) {
        // Reset node
        d3.select(this)
          .attr("r", (d: any) => (d.isDirectory ? 10 : 6))
          .attr("stroke-width", 2)
          .attr("stroke", d.isDirectory ? theme.nodes.folder.stroke : theme.nodes.file.stroke);

        // Reset links
        link
          .attr("stroke", theme.links.stroke)
          .attr("stroke-opacity", theme.links.opacity)
          .attr("stroke-width", 1.5);
        
        d3.select("body").selectAll("div.tooltip").remove();
      });

    // Add labels
    const label = container
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .text((d) =>
        d.name.length > 12 ? d.name.substring(0, 12) + "..." : d.name,
      )
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", theme.text.primary)
      .attr("dx", 14)
      .attr("dy", 4)
      .style("pointer-events", "none")
      .style("text-shadow", isDark ? "0px 0px 3px #000" : "0px 0px 3px #fff"); // Halo for readability

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Set up zoom behavior (works alongside node dragging)
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform.toString());
      });

    // Apply zoom to SVG, but allow node dragging to work
    svg.call(zoomBehavior);

    // Prevent zoom when dragging nodes
    node.on("mousedown.drag", function(event) {
      event.stopPropagation();
    });

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
