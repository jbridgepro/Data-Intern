/**
 * File: src/features/file-mapper/utils/visualizationTheme.ts
 *
 * Centralized theme configuration for File Mapper visualizations
 * Defines color palettes, node styles, and utility functions for consistent styling
 */

import * as d3 from "d3";

export interface ThemeColors {
    background: string;
    text: {
        primary: string;
        secondary: string;
        muted: string;
        inverse: string;
    };
    nodes: {
        folder: {
            fill: string;
            stroke: string;
            hoverStroke: string;
        };
        file: {
            fill: string;
            stroke: string;
            hoverStroke: string;
        };
    };
    links: {
        stroke: string;
        opacity: number;
    };
    shadows: {
        box: string;
    };
}

export const lightTheme: ThemeColors = {
    background: "#ffffff",
    text: {
        primary: "#1e293b", // slate-800
        secondary: "#475569", // slate-600
        muted: "#94a3b8", // slate-400
        inverse: "#ffffff",
    },
    nodes: {
        folder: {
            fill: "#eff6ff", // blue-50
            stroke: "#3b82f6", // blue-500
            hoverStroke: "#2563eb", // blue-600
        },
        file: {
            fill: "#f0fdf4", // green-50
            stroke: "#10b981", // green-500
            hoverStroke: "#059669", // green-600
        },
    },
    links: {
        stroke: "#cbd5e1", // slate-300
        opacity: 0.6,
    },
    shadows: {
        box: "rgba(0, 0, 0, 0.1)",
    },
};

export const darkTheme: ThemeColors = {
    background: "#0f172a", // slate-900
    text: {
        primary: "#f8fafc", // slate-50
        secondary: "#cbd5e1", // slate-300
        muted: "#64748b", // slate-500
        inverse: "#0f172a",
    },
    nodes: {
        folder: {
            fill: "#1e3a8a", // blue-900
            stroke: "#60a5fa", // blue-400
            hoverStroke: "#93c5fd", // blue-300
        },
        file: {
            fill: "#064e3b", // green-900
            stroke: "#34d399", // green-400
            hoverStroke: "#6ee7b7", // green-300
        },
    },
    links: {
        stroke: "#334155", // slate-700
        opacity: 0.6,
    },
    shadows: {
        box: "rgba(0, 0, 0, 0.3)",
    },
};

// Color palettes for data visualization (Sunburst, Treemap)
export const fileTypeColors = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#6366f1", // indigo
    "#d946ef", // fuchsia
];

/**
 * Get color scale for file extensions
 */
export const getFileTypeColorScale = () => {
    return d3.scaleOrdinal<string>().range(fileTypeColors);
};

/**
 * Get depth-based opacity
 */
export const getDepthOpacity = (depth: number, maxDepth: number = 5) => {
    return Math.max(0.2, 1 - depth * 0.15);
};

/**
 * Helper to determine current theme based on document class or media query
 * This is a simple check; in a real React app, you might use a hook/context
 */
export const isDarkMode = (): boolean => {
    if (typeof document !== "undefined") {
        return document.documentElement.classList.contains("dark");
    }
    return false;
};

/**
 * Get current active theme
 */
export const getTheme = (): ThemeColors => {
    return isDarkMode() ? darkTheme : lightTheme;
};
