/**
 * File: src/features/file-copy/components/SelectionPreview.tsx
 *
 * Front-end component for displaying a preview list of selected files
 * in the Copy/Move operation. Shows only the files that have been selected
 * from the source file tree, providing a clear visual of what will be
 * copied or moved to the destination directory.
 */

import {
  Folder,
  File,
  FileText,
  Component,
  Database,
  Image as ImageIcon,
  Music,
  Video,
  PackageOpen,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileEntry } from "../hooks/useFileSystem";
import { motion } from "framer-motion";

interface SelectionPreviewProps {
  /** Map of selected file paths to their FileEntry objects */
  selectedFiles: Map<string, FileEntry>;
  /** The source directory path for computing relative paths */
  sourcePath: string;
}

/**
 * Formats a file size in bytes to a human-readable string
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Returns the appropriate icon component for a file based on its type/extension.
 * Directories get a folder icon; files are matched against known extension groups.
 */
const GetFileIcon = ({ entry }: { entry: FileEntry }) => {
  if (entry.isDirectory)
    return <Folder className="h-4 w-4 text-blue-500 shrink-0" />;

  const ext = entry.extension?.toLowerCase();

  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"].includes(ext || ""))
    return <ImageIcon className="h-4 w-4 text-purple-500 shrink-0" />;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext || ""))
    return <Video className="h-4 w-4 text-red-500 shrink-0" />;
  if (["mp3", "wav", "flac", "aac", "ogg"].includes(ext || ""))
    return <Music className="h-4 w-4 text-pink-500 shrink-0" />;
  if (["json", "xml", "yaml", "yml", "sql", "csv"].includes(ext || ""))
    return <Database className="h-4 w-4 text-yellow-500 shrink-0" />;
  if (["js", "ts", "jsx", "tsx", "vue", "svelte"].includes(ext || ""))
    return <Component className="h-4 w-4 text-blue-400 shrink-0" />;
  if (["txt", "md", "rst", "log"].includes(ext || ""))
    return <FileText className="h-4 w-4 text-slate-500 shrink-0" />;

  return <File className="h-4 w-4 text-gray-400 shrink-0" />;
};

/**
 * SelectionPreview displays a clean, scrollable list of files selected
 * for the copy/move operation. Each entry shows the file icon, name,
 * relative path from the source directory, and file size.
 * When no files are selected, an empty state prompt is shown.
 */
export const SelectionPreview = ({
  selectedFiles,
  sourcePath,
}: SelectionPreviewProps) => {
  const files = Array.from(selectedFiles.values());

  /* Empty state when no files are selected */
  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <PackageOpen className="h-12 w-12 opacity-30 mb-3" />
        <p className="text-sm font-medium">No files selected</p>
        <p className="text-xs mt-1 opacity-70 max-w-[240px] text-center">
          Select files from the source panel to preview what will be copied or
          moved
        </p>
      </div>
    );
  }

  /* Sort: directories first, then files, alphabetically within each group */
  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <ScrollArea className="h-full w-full rounded-md border bg-card">
      <div className="p-3 space-y-0.5">
        {sortedFiles.map((entry, index) => {
          /* Compute relative path from the source directory */
          const relativePath = entry.path.startsWith(sourcePath)
            ? entry.path.substring(sourcePath.length + 1)
            : entry.name;

          /* Extract parent directory path for display below the file name */
          const pathParts = relativePath.split(/[/\\]/);
          const parentDirectoryPath =
            pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : null;

          return (
            <motion.div
              key={entry.path}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.015, 0.4) }}
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors"
            >
              {/* File type icon */}
              <GetFileIcon entry={entry} />

              {/* File name and relative parent path */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-mono truncate block text-foreground">
                  {entry.name}
                </span>
                {parentDirectoryPath && (
                  <span className="text-[10px] text-muted-foreground truncate block mt-0.5">
                    {parentDirectoryPath}
                  </span>
                )}
              </div>

              {/* File size badge for files */}
              {entry.size !== undefined && !entry.isDirectory && (
                <span className="text-[11px] text-muted-foreground font-mono shrink-0 bg-muted/50 px-1.5 py-0.5 rounded">
                  {formatFileSize(entry.size)}
                </span>
              )}

              {/* Folder indicator for directories */}
              {entry.isDirectory && (
                <span className="text-[10px] text-blue-500/70 font-medium shrink-0">
                  Folder
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
