/**
 * File: src/features/empty-files/components/CreationStructurePreview.tsx
 *
 * Front-end: Tree-style preview panel showing how files will appear
 * in the folder structure before creation. Helps prevent user errors.
 */

import { useMemo } from "react";
import { Folder, FileText } from "lucide-react";
import { MappedFileEntry } from "./MappedFileEntryForm";
import { cn } from "@/lib/utils";

interface CreationStructurePreviewProps {
  /** Root path (base folder name for display) */
  rootDisplayName: string;
  /** Mapped file entries */
  entries: MappedFileEntry[];
  /** Root path for computing relative display paths */
  rootPath: string;
  /** Optional class name */
  className?: string;
}

export function CreationStructurePreview({
  rootDisplayName,
  entries,
  rootPath,
  className,
}: CreationStructurePreviewProps) {
  const tree = useMemo(() => {
    const folderMap = new Map<
      string,
      { path: string; relativePath: string; files: string[] }
    >();

    entries.forEach((e) => {
      const destPath = e.destinationFolder;
      const fullFileName = `${e.fileName}.${e.extension}`;

      if (destPath === rootPath) {
        const key = "root";
        if (!folderMap.has(key)) {
          folderMap.set(key, { path: rootPath, relativePath: "", files: [] });
        }
        folderMap.get(key)!.files.push(fullFileName);
      } else {
        const relativePath = destPath
          .replace(rootPath + "/", "")
          .replace(rootPath, "");
        if (!folderMap.has(destPath)) {
          folderMap.set(destPath, { path: destPath, relativePath, files: [] });
        }
        folderMap.get(destPath)!.files.push(fullFileName);
      }
    });

    const rootFiles = folderMap.get("root")?.files ?? [];
    const subfolders = Array.from(folderMap.entries())
      .filter(([k]) => k !== "root")
      .sort((a, b) => a[1].relativePath.localeCompare(b[1].relativePath));

    return { rootFiles, subfolders, folderMap };
  }, [entries, rootPath]);

  if (entries.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-muted-foreground text-sm",
          className,
        )}
      >
        <FileText className="h-10 w-10 opacity-30 mb-2" />
        <p>Add files to see creation preview</p>
      </div>
    );
  }

  return (
    <div className={cn("font-mono text-xs", className)}>
      <div className="font-semibold text-foreground mb-2">Creation Preview</div>
      <div className="rounded-lg border bg-card/50 p-3 overflow-x-auto">
        <div className="min-w-[200px]">
          {/* Root folder */}
          <div className="flex items-center gap-1 text-foreground">
            <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>{rootDisplayName || "Root"}</span>
          </div>

          {/* Root-level files */}
          {tree.rootFiles.length > 0 && (
            <div className="ml-4 mt-0.5 space-y-0.5">
              {tree.rootFiles.map((fileName, idx) => (
                <div
                  key={`root-${fileName}-${idx}`}
                  className="flex items-center gap-1 text-muted-foreground"
                >
                  <span className="text-muted-foreground/60">├──</span>
                  <FileText className="h-3 w-3 text-blue-500 shrink-0" />
                  <span>{fileName}</span>
                </div>
              ))}
            </div>
          )}

          {/* Subfolders with their files */}
          {tree.subfolders.map(
            ([folderPath, { relativePath, files }], folderIdx) => {
              const isLastFolder = folderIdx === tree.subfolders.length - 1;
              const prefix =
                tree.rootFiles.length === 0 && folderIdx === 0
                  ? "├──"
                  : isLastFolder
                    ? "└──"
                    : "├──";
              const folderName = relativePath || "Folder";

              return (
                <div key={folderPath} className="mt-0.5">
                  <div className="flex items-center gap-1 text-foreground">
                    <span className="text-muted-foreground/60">{prefix}</span>
                    <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>{folderName}</span>
                  </div>
                  {files.length > 0 && (
                    <div className="ml-4 space-y-0.5">
                      {files.map((fileName, fileIdx) => (
                        <div
                          key={`${folderPath}-${fileName}-${fileIdx}`}
                          className="flex items-center gap-1 text-muted-foreground"
                        >
                          <span className="text-muted-foreground/60">
                            {fileIdx === files.length - 1 ? "└──" : "├──"}
                          </span>
                          <FileText className="h-3 w-3 text-blue-500 shrink-0" />
                          <span>{fileName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}
