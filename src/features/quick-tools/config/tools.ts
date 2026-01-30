
import { type LucideIcon, Code2, Database, Calculator, FileJson, Key, Wand2, Camera, GitCompare, Files, Mic } from "lucide-react";

export interface ToolMetadata {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    route: string; // Internal route identifier or URL path
    category: "dev" | "utility" | "data";
}

export const toolsConfig: ToolMetadata[] = [
    {
        id: "json-parser",
        name: "JSON Parser",
        description: "Validate, format, and fix JSON data.",
        icon: FileJson,
        route: "json-parser",
        category: "dev",
    },
    {
        id: "sql-formatter",
        name: "SQL Formatter",
        description: "Beautify and standardize SQL queries.",
        icon: Database,
        route: "sql-formatter",
        category: "dev",
    },
    {
        id: "calculator",
        name: "Pro Calculator",
        description: "Professional scientific and financial calculator.",
        icon: Calculator,
        route: "calculator",
        category: "utility",
    },
    {
        id: "unit-converter",
        name: "Unit Converter",
        description: "Convert length, weight, temperature, and more.",
        icon: Calculator,
        route: "unit-converter",
        category: "utility",
    },
    {
        id: "jwt-decoder",
        name: "JWT Decoder",
        description: "Decode and inspect JSON Web Tokens.",
        icon: Key,
        route: "jwt-decoder",
        category: "dev",
    },
    {
        id: "prompt-optimizer",
        name: "Prompt Optimizer",
        description: "Enhance prompts for better AI responses.",
        icon: Wand2,
        route: "prompt-optimizer",
        category: "utility",
    },
    {
        id: "screenshot",
        name: "Screenshot",
        description: "Capture and save application screenshots.",
        icon: Camera,
        route: "screenshot",
        category: "utility",
    },
    {
        id: "text-diff",
        name: "Text Diff",
        description: "Compare two text snippets side-by-side.",
        icon: GitCompare,
        route: "text-diff",
        category: "dev",
    },
    {
        id: "duplicate-finder",
        name: "Duplicate Finder",
        description: "Find and manage duplicate files.",
        icon: Files,
        route: "duplicate-finder",
        category: "data",
    },
    {
        id: "audio-transcription",
        name: "Audio Transcription",
        description: "Transcribe audio files to text.",
        icon: Mic,
        route: "audio-transcription",
        category: "utility",
    },
];

