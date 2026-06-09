/**
 * File: src/components/layout/toolInfoContent.ts
 *
 * Front-end: Plain-language tool descriptions for the header Info sheet.
 * Each tool has overview, steps, optional AI section, and examples.
 */

import type { ToolInfoContent as ToolInfoContentType } from "./ToolInfoSheet";

/** Content for Folder Creation */
export const folderCreationInfo: ToolInfoContentType = {
  overview:
    "Create many folders at once using a naming pattern or a custom list. You can add numbering, dates, or random text to names, and build subfolders automatically.",
  steps: [
    "Choose a destination folder where the new folders will appear.",
    "Pick a creation mode: use a pattern (e.g. “Project” with numbers) or paste a list of names.",
    "Adjust options like numbering, date prefixes, or subfolder names as needed.",
    "Check the live preview and edit any name by clicking it.",
    "Click “Create Folders” to create everything in one go.",
  ],
  examples: [
    "Batch create “Project-01”, “Project-02”, … up to “Project-10”.",
    "Add today’s date to folder names for daily backups.",
    "Generate a full structure (e.g. “Client A” with “Drafts” and “Final” inside) in one step.",
  ],
};

/** Content for File Creation */
export const fileCreationInfo: ToolInfoContentType = {
  overview:
    "Create many empty files at once. Use patterns, lists, CSV, or Map mode with pattern-based propagation. Map mode lets you place files in specific folders and auto-propagate to all matching main folders or subfolders.",
  steps: [
    "Select the root folder where the new files will be created.",
    "Choose a mode: Pattern, List, CSV, or Map (folder mapping).",
    "For Map mode: Pick destination mode (Manual, Pattern Main Folders, or Pattern Subfolders).",
    "Add files and assign each to a folder. Use propagation to apply to matching folders.",
    "Review the propagation preview and uncheck any targets to exclude.",
    "Click the create button to generate all files atomically.",
  ],
  examples: [
    "Create “notes_001.txt” through “notes_050.txt” for a course.",
    "Use Map mode: place ClientOverview.doc in 001-Client-* and auto-propagate to 002-Client-*, 003-Client-*.",
    "Propagate to Documents subfolder in all matching main folders with one placement.",
  ],
};

/** Content for File Copy */
export const fileCopyInfo: ToolInfoContentType = {
  overview:
    "Copy or move files and folders from one place to another. You can select by extension, filter by name, and choose what to do when a file with the same name already exists.",
  steps: [
    "Select the source folder in the tree and pick the files or folders you want.",
    "Choose a destination folder (recent and favorite paths are available).",
    "Optionally turn on “Preserve structure” to keep subfolders as they are.",
    "Set how to handle conflicts: overwrite, skip, or rename.",
    "Click Copy or Move to run the operation; you can cancel while it runs.",
  ],
  examples: [
    "Copy all .pdf files from a project folder to a “PDFs” backup folder.",
    "Move completed drafts into an “Archive” folder while keeping the structure.",
    "Duplicate a set of images to a new drive and skip any that already exist.",
  ],
};

/** Content for File Mapper */
export const fileMapperInfo: ToolInfoContentType = {
  overview:
    "Visualize a folder’s structure as a tree, chart, or other view. You can see sizes, filter by type or name, and export the map as an image or document.",
  steps: [
    "Enter or browse to the folder you want to map.",
    "Click “Generate” to scan the folder and build the map.",
    "Switch between views (e.g. tree, list, chart) using the style options.",
    "Use filters to include or exclude certain file types or names.",
    "Export the result as an image or file if you need to share or print it.",
  ],
  examples: [
    "Get a quick tree view of a project to see where large files live.",
    "Compare folder sizes across several drives using the chart view.",
    "Export a clean list of folder structure for documentation.",
  ],
};

/** Content for Find & Replace */
export const findReplaceInfo: ToolInfoContentType = {
  overview:
    "Search for text across files in a folder, then replace it in one or many files. You can match whole words, case, or use patterns (regex), and limit by file type.",
  steps: [
    "Select the folder you want to search in.",
    "Type the text (or pattern) you want to find and, if needed, the replacement text.",
    "Turn on options like “Match case” or “Whole word” (or regex) if you need them.",
    "Click Search to see all matches; use the list to jump to each file.",
    "Choose “Replace” for selected matches or “Replace all” to update everything in one go.",
  ],
  examples: [
    "Replace an old API URL with a new one across all config files.",
    "Find every “TODO” comment in a codebase and replace with “FIXME”.",
    "Rename a variable or function in many files at once (with whole-word match).",
  ],
};

/** Content for SQL Export Wizard */
export const sqlExportWizardInfo: ToolInfoContentType = {
  overview:
    "Connect to a database, then export or import data and run queries. Export tables to files, import from CSV or similar, and run SQL in the Query mode. Use Quick Tools → SQL Formatter to build or format SQL with a visual builder and natural language.",
  steps: [
    "Create or select a saved database connection and choose a database.",
    "Pick a mode: Export (table or query to file), Import (file into table), or Query (run SQL and view results).",
    "For export: pick tables or provide a query, then choose format and destination.",
    "For import: pick a file, map columns, then run the import.",
    "For query: enter or paste SQL in the editor, click Execute, and view results. Use the link to open SQL Formatter to build or format queries.",
  ],
  examples: [
    "Export a large table to CSV for use in a spreadsheet.",
    "Import a CSV of contacts into a “Contacts” table with column mapping.",
    "Run a one-off report query and view or export the results.",
  ],
};

/** Content for AI Assistant */
export const aiAssistantInfo: ToolInfoContentType = {
  overview:
    "Chat with an AI assistant to organize files, run actions, and get help. You can use text or voice. The assistant can create folders, move files, search, and more, depending on your setup.",
  steps: [
    "Open the Assistant Hub to start a new chat or pick an existing one.",
    "Type or speak what you want (e.g. “Create a folder called Reports” or “Find all PDFs in Downloads”).",
    "Review the assistant’s reply and any suggested actions; approve or edit as needed.",
    "Use the chat history and panels (e.g. operations, audit) to see what was done.",
    "Start new chats for different tasks; each chat can have its own context.",
  ],
  ai: {
    what:
      "The assistant uses AI to understand your requests and suggest or perform file operations. It can create folders, move or copy files, search content, and answer questions about your files. You can use a cloud API (e.g. OpenAI, Anthropic) or run models locally on your machine.",
    setup:
      "In Settings, open the AI / API section. For cloud providers, add your API key and save. For local models, install Ollama or LM Studio, then in Settings choose the local provider and point to the running server. Voice can be turned on in the assistant’s settings.",
    setupLinks: [
      { label: "Open AI Settings", navigateToTab: "settings", section: "ai-assistant" },
      { label: "Ollama (run models locally)", url: "https://ollama.com" },
      { label: "LM Studio (local models)", url: "https://lmstudio.ai" },
    ],
    examplesWithAi: [
      "Say “Put all invoices from last month into a folder called Invoices March”.",
      "Ask “What’s the largest file in my Projects folder?” and get an answer.",
      "Request “Create a backup of my Documents folder on the desktop”.",
    ],
    examplesWithoutAi: [
      "You can still open the assistant, but you’ll need to enable an API key or a local model in Settings to get AI replies and actions.",
    ],
  },
  examples: [
    "Organize downloads by file type using a short instruction.",
    "Get a summary of what’s in a project folder before sharing it.",
  ],
};

/** Content for Quick Tools (hub view) */
export const quickToolsInfo: ToolInfoContentType = {
  overview:
    "A set of small utilities in one place: calculator, unit converter, SQL formatter, duplicate finder, file converter, and more. Open the Tools Hub to pick a tool, then use it in a tab.",
  steps: [
    "Open Quick Tools from the sidebar; the Tools Hub shows all available tools.",
    "Click a tool (e.g. Calculator, Unit Converter) to open it in a new tab.",
    "Use the tool as needed; you can open several tools in separate tabs.",
    "Switch between tabs or close them; the Tools Hub tab stays so you can open more tools.",
  ],
  examples: [
    "Convert lengths, weights, or temperatures without leaving the app.",
    "Format or validate SQL before pasting into a database tool.",
    "Find duplicate files in a folder by content or name.",
  ],
};

/** Content for Calculator quick tool */
export const calculatorToolInfo: ToolInfoContentType = {
  overview:
    "A calculator for everyday and scientific use. Do basic arithmetic, use memory, and work with percentages. Handy for quick sums without leaving the app.",
  steps: [
    "Type numbers and operators (+, −, ×, ÷) or use the on-screen buttons.",
    "Use memory (M+, M−, MR, MC) to store and recall a value.",
    "Use the percent key for discounts or tips when needed.",
    "Switch to a scientific or financial mode if your version offers one.",
  ],
  examples: [
    "Add up a list of numbers or do a quick conversion.",
    "Calculate a percentage (e.g. 15% of a total).",
    "Keep an intermediate result in memory while you do another calculation.",
  ],
};

/** Content for Unit Converter quick tool */
export const unitConverterToolInfo: ToolInfoContentType = {
  overview:
    "Convert between units of length, weight, temperature, volume, and more. Pick a category, choose the units, and enter a value to see the result.",
  steps: [
    "Select a category (e.g. Length, Weight, Temperature).",
    "Choose the unit you’re converting from and the unit you’re converting to.",
    "Enter the value to convert; the result updates as you type.",
    "Swap the units if you need the conversion in the other direction.",
  ],
  examples: [
    "Convert miles to kilometers or feet to meters.",
    "Convert Fahrenheit to Celsius or vice versa.",
    "Convert pounds to kilograms or ounces to grams.",
  ],
};

/** Content for SQL Formatter quick tool */
export const sqlFormatterToolInfo: ToolInfoContentType = {
  overview:
    "Format and tidy SQL so it’s easier to read and share. Paste a query, then apply formatting. Some versions also validate syntax or highlight keywords.",
  steps: [
    "Paste your SQL into the input area (or type it).",
    "Click Format (or use the shortcut) to apply consistent indentation and line breaks.",
    "Copy the formatted SQL to use in your database tool or docs.",
    "Use any options (e.g. keyword style, indent size) to match your style.",
  ],
  examples: [
    "Clean up a long query before pasting into a ticket or email.",
    "Make a one-line query readable for a code review.",
    "Standardize SQL from different sources into one style.",
  ],
};

/** Content for Prompt Optimizer quick tool */
export const promptOptimizerToolInfo: ToolInfoContentType = {
  overview:
    "Improve the wording of prompts so you get better results from AI tools. Enter your prompt, get suggestions or rewrites, and refine until it’s clear and effective.",
  steps: [
    "Enter your current prompt in the text area.",
    "Use the optimize or suggest action to get a clearer or more specific version.",
    "Review the suggested prompt and edit it if needed.",
    "Copy the final prompt into your AI app or save it for later.",
  ],
  examples: [
    "Turn a vague request into a clear, step-by-step prompt.",
    "Add context or constraints so the AI stays on topic.",
    "Shorten a long prompt without losing important details.",
  ],
};

/** Content for Duplicate Finder quick tool */
export const duplicateFinderToolInfo: ToolInfoContentType = {
  overview:
    "Find files that are duplicates (same content or same name) inside a folder. Review the list, then keep or delete copies to free space and avoid confusion.",
  steps: [
    "Select the folder you want to scan for duplicates.",
    "Choose whether to compare by content (byte-for-byte) or by name and size.",
    "Run the scan and wait for the list of duplicate groups.",
    "Select which copies to keep and which to remove (or move to a folder).",
  ],
  examples: [
    "Find duplicate downloads or photos after a backup.",
    "Clean up a project folder that has several copies of the same file.",
    "Locate files with the same name in different subfolders.",
  ],
};

/** Content for Audio Transcription quick tool */
export const audioTranscriptionToolInfo: ToolInfoContentType = {
  overview:
    "Turn speech in audio or video files into text. Upload or pick a file, start the transcription, then copy or export the text. Useful for meetings, notes, or captions.",
  steps: [
    "Add an audio or video file (drag and drop or use the file picker).",
    "Start the transcription; the tool may show progress or estimated time.",
    "When done, read and edit the text in the result area if needed.",
    "Copy the transcript or export it to a file.",
  ],
  examples: [
    "Transcribe a meeting recording to search or share as notes.",
    "Get a text version of a podcast or video for accessibility.",
    "Create a rough draft of captions from an audio track.",
  ],
};

/** Content for File Converter quick tool */
export const fileConverterToolInfo: ToolInfoContentType = {
  overview:
    "Convert video, audio, image, document, and spreadsheet files between formats. Add files via drag & drop or the file picker, configure per-file output format and quality settings, and optionally customize the output filename. You can also re-encode to the same format to reduce file size or adjust quality. The tool shows an estimated output size that updates as you change settings. Spreadsheet conversions use Python3 for CSV/TSV/JSON and LibreOffice for Excel/PDF.",
  steps: [
    "Add files by dragging them in, clicking 'Add Files', or using the type-specific buttons (Video, Audio, Image, Doc, Sheet).",
    "Select a file from the queue to see its preview (playback for media, thumbnail for images) and metadata (dimensions, duration, file size).",
    "Choose the target format — pick 'Same Format' to re-encode and adjust quality or size without changing the extension.",
    "Optionally edit the output filename in the 'Output Filename' field; leave empty to use the default (filename_converted).",
    "Configure type-specific settings: video (quality, resolution), audio (bitrate), image (aspect ratio, max size, compression), or spreadsheet (delimiter, headers).",
    "Review the estimated output size, which updates as you change settings (smaller, larger, or same as source).",
    "Click 'Convert This File' for a single file, or 'Convert All' to batch-process. Use 'Show in Folder' when done to open the output location.",
  ],
  examples: [
    "Re-encode an MP4 to reduce file size: select same format, lower quality, and a smaller resolution.",
    "Convert a video to MP4 with custom quality and resolution settings.",
    "Batch-convert multiple audio files to MP3 at 320 kbps.",
    "Convert PNG to WebP with aspect ratio crop (e.g. 1:1) and max dimension (e.g. 1920 px) to shrink file size.",
    "Transform a DOCX document to PDF for sharing.",
    "Convert an Excel spreadsheet (.xlsx) to CSV or JSON.",
    "Re-delimit a CSV from comma to tab (TSV) or change the delimiter for European-style CSVs.",
  ],
};

/** Map of Quick Tool id → { subtitle, info } for contextual header and Info sheet */
export const quickToolMeta: Record<
  string,
  { subtitle: string; info: ToolInfoContentType }
> = {
  "calculator": { subtitle: "Quick math and expressions", info: calculatorToolInfo },
  "unit-converter": { subtitle: "Convert length, weight, temperature, and more", info: unitConverterToolInfo },
  "sql-formatter": { subtitle: "Beautify and standardize SQL", info: sqlFormatterToolInfo },
  "prompt-optimizer": { subtitle: "Enhance prompts for better AI responses", info: promptOptimizerToolInfo },
  "duplicate-finder": { subtitle: "Find and manage duplicate files", info: duplicateFinderToolInfo },
  "audio-transcription": { subtitle: "Transcribe audio files to text", info: audioTranscriptionToolInfo },
  "file-converter": { subtitle: "Convert video, audio, image, document, and spreadsheet files", info: fileConverterToolInfo },
};

/**
 * Returns title, subtitle, and info content for the Quick Tools page based on the active tab.
 * Use this so the header and Info button show the right content when a specific tool is open.
 */
export function getQuickToolPageMeta(activeTab: {
  type: "hub" | "tool";
  toolId?: string;
  name: string;
}): { title: string; subtitle: string; info: ToolInfoContentType } {
  if (activeTab.type === "hub") {
    return {
      title: "Quick Tools",
      subtitle: "Calculator, formatters, converters, and more",
      info: quickToolsInfo,
    };
  }
  const meta = activeTab.toolId ? quickToolMeta[activeTab.toolId] : null;
  if (meta) {
    return {
      title: activeTab.name,
      subtitle: meta.subtitle,
      info: meta.info,
    };
  }
  return {
    title: activeTab.name,
    subtitle: "Quick Tools utility",
    info: quickToolsInfo,
  };
}

/** Content for AI Curator */
export const aiCuratorInfo: ToolInfoContentType = {
  overview:
    "The AI Curator analyzes media files and scores them on quality, composition, subject quality, service fit, and deliverable readiness. It groups similar files, detects duplicates, and organizes everything into suggested folders: Best Selects, Usable / Secondary, Needs Editing, and Reject Candidates.",
  steps: [
    "Select a directory containing media files you want to curate.",
    "Choose a curation mode: Deep AI Review for full AI analysis with detailed scoring, or Fast Sort for quick metadata-based sorting.",
    "Pick a service type (Portrait, Event, Real Estate, Product, etc.) to tailor the AI prompts.",
    "Click 'Start Curation' to begin. Progress is shown in real-time.",
    "Review the results organized by folder. Each file has scores, reason tags, and an explanation.",
    "Optionally click 'Copy to Organized Folders' to copy files into Best Selects, Usable, Needs Editing, and Rejects folders.",
  ],
  examples: [
    "Curate a wedding gallery — best selects for the album, secondaries for proofs, blurry shots rejected.",
    "Organize real estate photos — keep listing-ready images with bright exposure, flag duplicates.",
    "Review product photography batches — identify hero shots, detail images, and outtakes.",
  ],
};

/** Content for Terminal */
export const terminalInfo: ToolInfoContentType = {
  overview:
    "Run commands and scripts in a built-in terminal. You can open multiple tabs, run shell commands, and use your usual aliases and environment.",
  steps: [
    "Open Terminal from the sidebar; a new tab starts in your default directory.",
    "Type commands as you would in your system terminal (e.g. ls, cd, git).",
    "Open more tabs with the + button if you need several sessions.",
    "Use the terminal’s settings (if available) to change theme or export/import history.",
  ],
  examples: [
    "Run build or test commands for a project without leaving the app.",
    "Use git commands to commit, push, or pull from a repo.",
    "Start a local server or run a script in the background.",
  ],
};

/** Content for Settings */
export const settingsInfo: ToolInfoContentType = {
  overview:
    "Change how the app looks and behaves: theme, panels, file tools, terminal, and AI/API options. Use the sidebar or search to jump to a section.",
  steps: [
    "Open Settings from the menu or sidebar.",
    "Use the left sidebar to go to a section (e.g. General, File Mapper, AI).",
    "Change options as needed; many are saved automatically.",
    "Use the search box at the top to find a setting by name.",
  ],
  examples: [
    "Switch between light and dark theme.",
    "Turn the AI Assistant on by adding an API key in the AI section.",
    "Show or hide the sidebar, status bar, or bottom panel.",
  ],
};

/** Content for Panel Configuration */
export const panelConfigurationInfo: ToolInfoContentType = {
  overview:
    "Control which panels and sidebars are visible and where they sit. You can pick a preset (e.g. Editor, Zen) or customize layout and save your own view.",
  steps: [
    "Open Panel Configuration from the sidebar or settings.",
    "Choose a view mode (e.g. Editor, Agent, Zen) or leave custom.",
    "Toggle each panel (Agents, Chat, bottom Panel, main Sidebar) on or off.",
    "Optionally save your current layout as a custom view for quick switching.",
  ],
  examples: [
    "Hide the sidebar for a cleaner writing or coding view.",
    "Put the Agents panel on the left and Chat on the right.",
    "Create a “Presentation” view with only the main content visible.",
  ],
};
