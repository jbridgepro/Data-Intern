/**
 * File: src/features/folder-creation/components/FilePreCreationConfig.tsx
 *
 * Component for managing pre-creation file configurations.
 * Supports pattern-based file propagation: files can be replicated across
 * all main folders or all matching subfolders via propagation mode controls.
 */

import { useState } from "react";
import {
  FolderConfig,
  PreCreationFileConfig,
  PreviewNode,
  expandDestinations,
} from "../utils/folderUtils";
import {
  validateFileNameChars,
  validateExtension,
  normalizeExtension,
} from "../../../utils/fileValidation";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "../../../components/ui/collapsible";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  FileText,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../../lib/utils";

interface FilePreCreationConfigProps {
  config: FolderConfig;
  setConfig: (config: FolderConfig) => void;
  folderNodes: PreviewNode[];
}

export const FilePreCreationConfig = ({
  config,
  setConfig,
  folderNodes,
}: FilePreCreationConfigProps) => {
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<{
    fileName: string;
    extension: string;
    destination: string;
  }>({
    fileName: "",
    extension: "txt",
    destination: "root",
  });

  // Tracks which file items have their affected folders preview expanded
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(
    new Set(),
  );

  // Get destination options from folder nodes
  const getDestinationOptions = (): Array<{ value: string; label: string }> => {
    const options = [{ value: "root", label: "Root Folder" }];

    const extractFolders = (nodes: PreviewNode[], parentPath: string = "") => {
      nodes.forEach((node) => {
        if (node.type === "folder" && node.id !== "more-placeholder") {
          const path = parentPath ? `${parentPath} / ${node.name}` : node.name;
          options.push({ value: node.id, label: path });

          if (node.children) {
            extractFolders(node.children, path);
          }
        }
      });
    };

    extractFolders(folderNodes);
    return options;
  };

  /**
   * Computes the list of affected folders for a given file config.
   * Uses expandDestinations to resolve pattern-based propagation.
   */
  const getAffectedFolders = (
    file: PreCreationFileConfig,
  ): Array<{ id: string; label: string }> => {
    const templateDest = file.templateDestination || file.destination || "root";
    const propagationMode = file.propagationMode || "manual";
    const excludedDests = file.excludedDestinations || [];

    const destinations = expandDestinations(
      templateDest,
      propagationMode,
      excludedDests,
      folderNodes,
      config,
    );

    return destinations.map((dest) => ({
      id: dest,
      label: getDestinationLabel(dest),
    }));
  };

  /**
   * Checks for duplicate files across ALL expanded destinations.
   * Two files with the same name going to the same destination = duplicate.
   */
  const checkDuplicates = (): Map<string, string[]> => {
    const duplicates = new Map<string, string[]>();
    const filesByDestination = new Map<string, Set<string>>();

    (config.preCreationFiles || [])
      .filter((f) => f.enabled)
      .forEach((file) => {
        const fullName = `${file.fileName}.${file.extension}`;

        // Expand destinations based on propagation mode for accurate duplicate detection
        const templateDest =
          file.templateDestination || file.destination || "root";
        const propagationMode = file.propagationMode || "manual";
        const excludedDests = file.excludedDestinations || [];

        const destinations = expandDestinations(
          templateDest,
          propagationMode,
          excludedDests,
          folderNodes,
          config,
        );

        destinations.forEach((dest) => {
          if (!filesByDestination.has(dest)) {
            filesByDestination.set(dest, new Set());
          }

          const filesInDest = filesByDestination.get(dest)!;
          if (filesInDest.has(fullName)) {
            if (!duplicates.has(dest)) {
              duplicates.set(dest, []);
            }
            if (!duplicates.get(dest)!.includes(fullName)) {
              duplicates.get(dest)!.push(fullName);
            }
          }
          filesInDest.add(fullName);
        });
      });

    return duplicates;
  };

  const duplicates = checkDuplicates();

  // Add new file with default pattern-based propagation
  const addFile = () => {
    const fileNameError = validateFileNameChars(newFile.fileName);
    const extensionError = validateExtension(newFile.extension);

    if (fileNameError || extensionError) {
      alert(fileNameError || extensionError);
      return;
    }

    const file: PreCreationFileConfig = {
      id: `file-${Date.now()}-${Math.random()}`,
      fileName: newFile.fileName.trim(),
      extension: normalizeExtension(newFile.extension),

      // Default to all-main-folders pattern-based propagation
      propagationMode: "all-main-folders",
      templateDestination: newFile.destination,
      excludedDestinations: [],

      // Legacy field kept for backward compatibility
      destination: newFile.destination,

      enabled: true,
    };

    setConfig({
      ...config,
      preCreationFiles: [...(config.preCreationFiles || []), file],
    });

    // Reset form
    setNewFile({
      fileName: "",
      extension: "txt",
      destination: "root",
    });
  };

  // Update file
  const updateFile = (id: string, updates: Partial<PreCreationFileConfig>) => {
    setConfig({
      ...config,
      preCreationFiles: (config.preCreationFiles || []).map((f) =>
        f.id === id ? { ...f, ...updates } : f,
      ),
    });
  };

  // Remove file
  const removeFile = (id: string) => {
    setConfig({
      ...config,
      preCreationFiles: (config.preCreationFiles || []).filter(
        (f) => f.id !== id,
      ),
    });
  };

  // Get destination label
  const getDestinationLabel = (destination: string): string => {
    const options = getDestinationOptions();
    const option = options.find((opt) => opt.value === destination);
    return option?.label || "Unknown";
  };

  /**
   * Checks if a file config produces any duplicates across its expanded destinations
   */
  const isDuplicate = (file: PreCreationFileConfig): boolean => {
    const fullName = `${file.fileName}.${file.extension}`;
    const templateDest = file.templateDestination || file.destination || "root";
    const propagationMode = file.propagationMode || "manual";
    const excludedDests = file.excludedDestinations || [];

    const destinations = expandDestinations(
      templateDest,
      propagationMode,
      excludedDests,
      folderNodes,
      config,
    );

    return destinations.some(
      (dest) => duplicates.get(dest)?.includes(fullName) || false,
    );
  };

  const destinationOptions = getDestinationOptions();

  return (
    <div className="p-4 space-y-4">
      {/* File List */}
      <div className="space-y-2">
        <AnimatePresence>
          {(config.preCreationFiles || []).map((file) => {
            const isEditing = editingFileId === file.id;
            const duplicate = isDuplicate(file);
            const affectedFolders = getAffectedFolders(file);
            const currentPropagationMode = file.propagationMode || "manual";

            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  "p-3 rounded-lg border",
                  duplicate
                    ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10"
                    : "border-border bg-muted/30",
                  !file.enabled && "opacity-50",
                )}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500 shrink-0" />
                    <EditFileForm
                      file={file}
                      destinationOptions={destinationOptions}
                      onSave={(updates) => {
                        updateFile(file.id, updates);
                        setEditingFileId(null);
                      }}
                      onCancel={() => setEditingFileId(null)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* File Header: Name, badges, and action buttons */}
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500 shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono flex items-center gap-2">
                          <span className="truncate">
                            {file.fileName}.{file.extension}
                          </span>
                          {/* Affected folders count badge */}
                          {affectedFolders.length > 1 && (
                            <span className="text-[10px] bg-blue-500/20 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded shrink-0">
                              {affectedFolders.length} folders
                            </span>
                          )}
                          {duplicate && (
                            <span className="text-[10px] bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded shrink-0">
                              Duplicate
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={file.enabled}
                          onCheckedChange={(enabled) =>
                            updateFile(file.id, { enabled })
                          }
                          className="scale-75"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditingFileId(file.id)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeFile(file.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Propagation Mode Selector - 3 segmented buttons */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded">
                      <button
                        onClick={() =>
                          updateFile(file.id, { propagationMode: "manual" })
                        }
                        className={cn(
                          "text-xs py-1 px-2 rounded transition-all",
                          currentPropagationMode === "manual"
                            ? "bg-background shadow-sm font-medium"
                            : "hover:bg-background/50",
                        )}
                      >
                        Manual
                      </button>
                      <button
                        onClick={() =>
                          updateFile(file.id, {
                            propagationMode: "all-main-folders",
                          })
                        }
                        className={cn(
                          "text-xs py-1 px-2 rounded transition-all",
                          currentPropagationMode === "all-main-folders"
                            ? "bg-background shadow-sm font-medium"
                            : "hover:bg-background/50",
                        )}
                      >
                        All Folders
                      </button>
                      <button
                        onClick={() =>
                          updateFile(file.id, {
                            propagationMode: "matching-subfolders",
                          })
                        }
                        className={cn(
                          "text-xs py-1 px-2 rounded transition-all",
                          currentPropagationMode === "matching-subfolders"
                            ? "bg-background shadow-sm font-medium"
                            : "hover:bg-background/50",
                        )}
                      >
                        Matching Subs
                      </button>
                    </div>

                    {/* Template Destination Selector */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        {currentPropagationMode === "manual"
                          ? "Destination"
                          : "Template Location"}
                      </Label>
                      <Select
                        value={
                          file.templateDestination || file.destination || "root"
                        }
                        onValueChange={(value) =>
                          updateFile(file.id, {
                            templateDestination: value,
                            destination: value,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {destinationOptions.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className="text-xs"
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Affected Folders Preview - Collapsible with checkboxes */}
                    {affectedFolders.length > 1 && (
                      <Collapsible
                        open={expandedPreviews.has(file.id)}
                        onOpenChange={(open) => {
                          const newSet = new Set(expandedPreviews);
                          if (open) newSet.add(file.id);
                          else newSet.delete(file.id);
                          setExpandedPreviews(newSet);
                        }}
                      >
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 transition-transform",
                              expandedPreviews.has(file.id) && "rotate-90",
                            )}
                          />
                          Show affected folders ({affectedFolders.length})
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto border rounded p-2">
                            {affectedFolders.map((folder) => {
                              const isExcluded =
                                file.excludedDestinations?.includes(folder.id);
                              return (
                                <div
                                  key={folder.id}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    title={`Include ${folder.label}`}
                                    checked={!isExcluded}
                                    onChange={(e) => {
                                      const excluded =
                                        file.excludedDestinations || [];
                                      const newExcluded = e.target.checked
                                        ? excluded.filter(
                                            (id) => id !== folder.id,
                                          )
                                        : [...excluded, folder.id];
                                      updateFile(file.id, {
                                        excludedDestinations: newExcluded,
                                      });
                                    }}
                                    className="w-3 h-3"
                                  />
                                  <span
                                    className={cn(
                                      "flex-1 truncate font-mono",
                                      isExcluded && "line-through opacity-50",
                                    )}
                                  >
                                    {folder.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {(!config.preCreationFiles || config.preCreationFiles.length === 0) && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No files defined. Click &quot;Add File&quot; to create one.
          </div>
        )}
      </div>

      {/* Duplicate Warning */}
      {duplicates.size > 0 && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-yellow-700 dark:text-yellow-300">
            Warning: Duplicate file names detected. Files with the same name in
            the same destination will overwrite each other.
          </div>
        </div>
      )}

      {/* Add File Section */}
      <div className="border-t pt-4 space-y-3">
        <div className="text-sm font-medium">Add New File</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">File Name</Label>
            <Input
              value={newFile.fileName}
              onChange={(e) =>
                setNewFile({ ...newFile, fileName: e.target.value })
              }
              placeholder="document"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Extension</Label>
            <Input
              value={newFile.extension}
              onChange={(e) =>
                setNewFile({ ...newFile, extension: e.target.value })
              }
              placeholder="txt"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Destination</Label>
          <Select
            value={newFile.destination}
            onValueChange={(value) =>
              setNewFile({ ...newFile, destination: value })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {destinationOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-xs"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={addFile} size="sm" className="w-full">
          <Plus className="h-3 w-3 mr-1" />
          Add File
        </Button>
      </div>
    </div>
  );
};

// Inline edit form component
interface EditFileFormProps {
  file: PreCreationFileConfig;
  destinationOptions: Array<{ value: string; label: string }>;
  onSave: (updates: Partial<PreCreationFileConfig>) => void;
  onCancel: () => void;
}

const EditFileForm = ({
  file,
  destinationOptions,
  onSave,
  onCancel,
}: EditFileFormProps) => {
  const [fileName, setFileName] = useState(file.fileName);
  const [extension, setExtension] = useState(file.extension);
  const [destination, setDestination] = useState(
    file.templateDestination || file.destination || "root",
  );

  const handleSave = () => {
    const fileNameError = validateFileNameChars(fileName);
    const extensionError = validateExtension(extension);

    if (fileNameError || extensionError) {
      alert(fileNameError || extensionError);
      return;
    }

    // Save both templateDestination and legacy destination for compatibility
    onSave({
      fileName: fileName.trim(),
      extension: normalizeExtension(extension),
      templateDestination: destination,
      destination,
    });
  };

  return (
    <div className="flex-1 flex items-center gap-2">
      <Input
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        className="h-7 text-xs flex-1"
        placeholder="File name"
      />
      <Input
        value={extension}
        onChange={(e) => setExtension(e.target.value)}
        className="h-7 text-xs w-20"
        placeholder="ext"
      />
      <Select value={destination} onValueChange={setDestination}>
        <SelectTrigger className="h-7 text-xs w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {destinationOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={handleSave}
      >
        <Check className="h-3 w-3 text-green-600" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={onCancel}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};
