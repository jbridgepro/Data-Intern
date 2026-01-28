/**
 * File: src/components/ui/resizable-panel.tsx
 * 
 * Frontend: Resizable Panel component
 * Provides a wrapper for panels that enables resizing via drag handles
 * and minimize/maximize functionality
 */

import { useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Direction of the resize handle */
type ResizeDirection = "left" | "right" | "top" | "bottom";

/** Props for the ResizablePanel component */
interface ResizablePanelProps {
  /** Child content to render inside the panel */
  children: ReactNode;
  /** Current size in pixels (width for left/right, height for top/bottom) */
  size: number;
  /** Minimum allowed size in pixels */
  minSize: number;
  /** Maximum allowed size in pixels */
  maxSize: number;
  /** Whether the panel is currently minimized */
  isMinimized: boolean;
  /** Callback when size changes during drag */
  onSizeChange: (newSize: number) => void;
  /** Callback when minimize state changes */
  onMinimizeChange: (minimized: boolean) => void;
  /** Direction of the resize handle */
  direction: ResizeDirection;
  /** Size when minimized (default: 40px for header only) */
  minimizedSize?: number;
  /** Additional class names for the container */
  className?: string;
  /** Whether to show the minimize button in header */
  showMinimizeButton?: boolean;
  /** Custom header content (optional) */
  header?: ReactNode;
  /** Whether to render children even when minimized (useful for sidebars with their own minimized state) */
  renderChildrenWhenMinimized?: boolean;
}

/**
 * ResizablePanel Component
 * A panel wrapper that supports drag-to-resize and minimize functionality
 */
export const ResizablePanel = ({
  children,
  size,
  minSize,
  maxSize,
  isMinimized,
  onSizeChange,
  onMinimizeChange,
  direction,
  className,
  minimizedSize = 64, // Updated default to 64 for sidebar consistency
  showMinimizeButton = true,
  header,
  renderChildrenWhenMinimized = false,
}: ResizablePanelProps) => {
  // Track dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ position: number; size: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Determine if this is a horizontal (width) or vertical (height) resize
  const isHorizontal = direction === "left" || direction === "right";

  /**
   * Handle mouse down on the resize handle
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const startPosition = isHorizontal ? e.clientX : e.clientY;
      dragStartRef.current = { position: startPosition, size };
      setIsDragging(true);
    },
    [isHorizontal, size]
  );

  /**
   * Handle mouse move during drag
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const currentPosition = isHorizontal ? e.clientX : e.clientY;
      const delta = currentPosition - dragStartRef.current.position;

      // Calculate new size based on direction
      // The direction indicates where the resize handle is positioned
      let newSize: number;
      if (direction === "right" || direction === "bottom") {
        // For right/bottom handles: dragging right/down (positive delta) increases size
        // Dragging left/up (negative delta) decreases size
        newSize = dragStartRef.current.size + delta;
      } else {
        // For left/top handles: dragging left/up (negative delta) increases size
        // Dragging right/down (positive delta) decreases size
        // So we subtract delta to invert the relationship
        newSize = dragStartRef.current.size - delta;
      }

      // Clamp to min/max bounds
      newSize = Math.max(minSize, Math.min(maxSize, newSize));
      onSizeChange(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    // Add event listeners to document for smooth dragging
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Add dragging cursor to body
    document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, isHorizontal, direction, minSize, maxSize, onSizeChange]);

  /**
   * Toggle minimize state
   */
  const handleToggleMinimize = useCallback(() => {
    onMinimizeChange(!isMinimized);
  }, [isMinimized, onMinimizeChange]);

  // Calculate actual size to use
  const actualSize = isMinimized ? minimizedSize : size;

  // Get the appropriate chevron icon based on direction and minimized state
  const getMinimizeIcon = () => {
    if (isMinimized) {
      // Show expand direction
      switch (direction) {
        case "left": return <ChevronRight className="h-4 w-4" />;
        case "right": return <ChevronLeft className="h-4 w-4" />;
        case "top": return <ChevronDown className="h-4 w-4" />;
        case "bottom": return <ChevronUp className="h-4 w-4" />;
      }
    } else {
      // Show collapse direction
      switch (direction) {
        case "left": return <ChevronLeft className="h-4 w-4" />;
        case "right": return <ChevronRight className="h-4 w-4" />;
        case "top": return <ChevronUp className="h-4 w-4" />;
        case "bottom": return <ChevronDown className="h-4 w-4" />;
      }
    }
  };

  // Determine resize handle position classes
  const getHandleClasses = () => {
    const baseClasses = cn(
      "absolute z-20 transition-colors",
      "hover:bg-blue-500/50 active:bg-blue-500/70",
      isDragging && "bg-blue-500/70"
    );

    switch (direction) {
      case "left":
        return cn(baseClasses, "left-0 top-0 bottom-0 w-1 cursor-col-resize");
      case "right":
        return cn(baseClasses, "right-0 top-0 bottom-0 w-1 cursor-col-resize");
      case "top":
        return cn(baseClasses, "top-0 left-0 right-0 h-1 cursor-row-resize");
      case "bottom":
        return cn(baseClasses, "bottom-0 left-0 right-0 h-1 cursor-row-resize");
    }
  };

  // Determine panel style based on direction
  const getPanelStyle = (): React.CSSProperties => {
    if (isHorizontal) {
      return {
        width: actualSize,
        minWidth: isMinimized ? minimizedSize : minSize,
        maxWidth: isMinimized ? minimizedSize : maxSize,
        transition: isDragging ? "none" : "width 0.2s ease-out",
      };
    } else {
      return {
        height: actualSize,
        minHeight: isMinimized ? minimizedSize : minSize,
        maxHeight: isMinimized ? minimizedSize : maxSize,
        transition: isDragging ? "none" : "height 0.2s ease-out",
      };
    }
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        "relative flex flex-col",
        isHorizontal ? "h-full" : "w-full",
        !renderChildrenWhenMinimized && "overflow-hidden",
        className
      )}
      style={getPanelStyle()}
    >
      {/* Resize Handle */}
      {!isMinimized && (
        <div
          className={getHandleClasses()}
          onMouseDown={handleMouseDown}
          title={`Drag to resize ${isHorizontal ? "width" : "height"}`}
        />
      )}

      {/* Optional Custom Header with Minimize Button */}
      {header && (
        <div className="shrink-0 flex items-center justify-between">
          {header}
          {showMinimizeButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleToggleMinimize}
              title={isMinimized ? "Expand panel" : "Minimize panel"}
            >
              {isMinimized ? getMinimizeIcon() : <Minus className="h-3 w-3" />}
            </Button>
          )}
        </div>
      )}

      {/* Minimized State - Show only expand button IF not rendering children */}
      {isMinimized && !header && !renderChildrenWhenMinimized && (
        <div className="h-full flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleToggleMinimize}
            title="Expand panel"
          >
            {getMinimizeIcon()}
          </Button>
        </div>
      )}

      {/* Panel Content - Only render when not minimized OR explicitly asked to render when minimized */}
      {(!isMinimized || renderChildrenWhenMinimized) && (
        <div className={cn("flex-1 min-h-0", !renderChildrenWhenMinimized && "overflow-hidden")}>
          {children}
        </div>
      )}
    </div>
  );
};

export default ResizablePanel;
