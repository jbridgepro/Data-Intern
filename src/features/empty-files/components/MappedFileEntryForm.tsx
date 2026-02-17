/**
 * File: src/features/empty-files/components/MappedFileEntryForm.tsx
 *
 * Front-end: Form for adding and managing multiple file entries with
 * per-file folder mapping. Each entry has: file name, extension, destination folder.
 */

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FileText,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderMappingSelector } from "./FolderMappingSelector";
import {
  validateFileNameChars,
  validateExtension,
  normalizeExtension,
} from "@/utils/fileValidation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/** Single mapped file entry */
export interface MappedFileEntry {
  id: string;
  fileName: string;
  extension: string;
  destinationFolder: string;
}

interface MappedFileEntryFormProps {
  rootPath: string;
  entries: MappedFileEntry[];
  onEntriesChange: (entries: MappedFileEntry[]) => void;
  /** Common extensions for quick selection */
  commonExtensions?: string[];
  disabled?: boolean;
}

const DEFAULT_EXTENSIONS = [
  "txt",
  "md",
  "doc",
  "docx",
  "pdf",
  "xls",
  "xlsx",
  "csv",
  "json",
  "xml",
];

export function MappedFileEntryForm({
  rootPath,
  entries,
  onEntriesChange,
  commonExtensions = DEFAULT_EXTENSIONS,
  disabled = false,
}: MappedFileEntryFormProps) {
  const [newFileName, setNewFileName] = useState("");
  const [newExtension, setNewExtension] = useState("txt");
  const [newDestination, setNewDestination] = useState(rootPath || "");

  // Sync default destination when root path changes
  useEffect(() => {
    if (rootPath && !newDestination) setNewDestination(rootPath);
  }, [rootPath]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const addEntry = () => {
    const nameError = validateFileNameChars(newFileName);
    const extError = validateExtension(newExtension);

    if (nameError || extError) {
      setValidationErrors({
        fileName: nameError || "",
        extension: extError || "",
      });
      return;
    }

    const entry: MappedFileEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: newFileName.trim(),
      extension: normalizeExtension(newExtension),
      destinationFolder: newDestination || rootPath,
    };

    onEntriesChange([...entries, entry]);
    setNewFileName("");
    setNewExtension("txt");
    setNewDestination(rootPath || "");
    setValidationErrors({});
  };

  const removeEntry = (id: string) => {
    onEntriesChange(entries.filter((e) => e.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const updateEntry = (id: string, updates: Partial<MappedFileEntry>) => {
    onEntriesChange(
      entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    );
    if (updates.fileName !== undefined || updates.extension !== undefined) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const applyDestinationToAll = (folderPath: string) => {
    onEntriesChange(
      entries.map((e) => ({ ...e, destinationFolder: folderPath })),
    );
  };

  const getFullFileName = (entry: MappedFileEntry) =>
    `${entry.fileName}.${entry.extension}`;

  const duplicateNamesByFolder = (() => {
    const keyCount = new Map<string, number>();
    entries.forEach((e) => {
      const key = `${e.destinationFolder}::${getFullFileName(e)}`;
      keyCount.set(key, (keyCount.get(key) || 0) + 1);
    });
    const duplicates = new Set<string>();
    entries.forEach((e) => {
      const key = `${e.destinationFolder}::${getFullFileName(e)}`;
      if ((keyCount.get(key) || 0) > 1) duplicates.add(e.id);
    });
    return duplicates;
  })();

  return (
    <div className="space-y-4">
      {/* Entries list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            File Mapping
          </Label>
          <span className="text-xs text-muted-foreground">
            {entries.length} file(s)
          </span>
        </div>

        <AnimatePresence mode="popLayout">
          {entries.map((entry) => {
            const isEditing = editingId === entry.id;
            const isDuplicate = duplicateNamesByFolder.has(entry.id);

            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border transition-colors",
                  isDuplicate
                    ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-900/10"
                    : "border-border bg-muted/20",
                )}
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />

                {isEditing ? (
                  <EditForm
                    entry={entry}
                    rootPath={rootPath}
                    commonExtensions={commonExtensions}
                    onSave={(updates) => {
                      const nameErr =
                        updates.fileName !== undefined
                          ? validateFileNameChars(updates.fileName)
                          : null;
                      const extErr =
                        updates.extension !== undefined
                          ? validateExtension(updates.extension)
                          : null;
                      if (nameErr || extErr) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          [entry.id]: nameErr || extErr || "",
                        }));
                        return;
                      }
                      updateEntry(entry.id, updates);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono truncate">
                          {getFullFileName(entry)}
                        </span>
                        {isDuplicate && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
                            Duplicate
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {entry.destinationFolder === rootPath
                          ? "Root"
                          : entry.destinationFolder
                              .replace(rootPath + "/", "")
                              .replace(rootPath, "Root") || "Root"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingId(entry.id)}
                        disabled={disabled}
                        aria-label="Edit file"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeEntry(entry.id)}
                        disabled={disabled}
                        aria-label="Remove file"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {entries.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
            No files defined. Add files below and assign each to a folder.
          </div>
        )}
      </div>

      {/* Duplicate warning */}
      {duplicateNamesByFolder.size > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <span className="text-amber-700 dark:text-amber-300">
            Duplicate file names in the same folder will overwrite each other.
            Edit or remove duplicates.
          </span>
        </div>
      )}

      {/* Add new file */}
      <div className="border-t pt-4 space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add New File
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">File Name</Label>
            <Input
              value={newFileName}
              onChange={(e) => {
                setNewFileName(e.target.value);
                if (validationErrors.fileName)
                  setValidationErrors((p) => ({ ...p, fileName: "" }));
              }}
              placeholder="document"
              className={cn(
                "h-8 text-xs",
                validationErrors.fileName && "border-destructive",
              )}
              disabled={disabled}
            />
            {validationErrors.fileName && (
              <p className="text-[10px] text-destructive mt-0.5">
                {validationErrors.fileName}
              </p>
            )}
          </div>
          <div>
            <Label className="text-[10px]">Extension</Label>
            <select
              value={newExtension}
              onChange={(e) => {
                setNewExtension(e.target.value);
                if (validationErrors.extension)
                  setValidationErrors((p) => ({ ...p, extension: "" }));
              }}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              disabled={disabled}
              aria-label="File extension"
            >
              {commonExtensions.map((ext) => (
                <option key={ext} value={ext}>
                  .{ext}
                </option>
              ))}
            </select>
            {validationErrors.extension && (
              <p className="text-[10px] text-destructive mt-0.5">
                {validationErrors.extension}
              </p>
            )}
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Destination Folder</Label>
          <FolderMappingSelector
            rootPath={rootPath}
            value={newDestination}
            onChange={setNewDestination}
            disabled={disabled || !rootPath}
            compact
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={addEntry}
            disabled={disabled || !rootPath || !newFileName.trim()}
            className="flex-1"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add File
          </Button>
          {entries.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyDestinationToAll(newDestination || rootPath)}
              disabled={disabled || !rootPath}
              title="Apply this destination to all files"
            >
              Apply to All
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Edit form for inline editing ---

interface EditFormProps {
  entry: MappedFileEntry;
  rootPath: string;
  commonExtensions: string[];
  onSave: (updates: Partial<MappedFileEntry>) => void;
  onCancel: () => void;
}

function EditForm({
  entry,
  rootPath,
  commonExtensions,
  onSave,
  onCancel,
}: EditFormProps) {
  const [fileName, setFileName] = useState(entry.fileName);
  const [extension, setExtension] = useState(entry.extension);
  const [destination, setDestination] = useState(entry.destinationFolder);

  const handleSave = () => {
    onSave({
      fileName: fileName.trim(),
      extension: normalizeExtension(extension),
      destinationFolder: destination,
    });
  };

  return (
    <div className="flex-1 flex items-center gap-2 flex-wrap">
      <Input
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        className="h-7 text-xs flex-1 min-w-[80px]"
        placeholder="File name"
      />
      <select
        value={extension}
        onChange={(e) => setExtension(e.target.value)}
        className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs"
        aria-label="File extension"
      >
        {commonExtensions.map((ext) => (
          <option key={ext} value={ext}>
            .{ext}
          </option>
        ))}
      </select>
      <div className="flex-1 min-w-[120px]">
        <FolderMappingSelector
          rootPath={rootPath}
          value={destination}
          onChange={setDestination}
          compact
        />
      </div>
      <div className="flex gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleSave}
          aria-label="Save"
        >
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
