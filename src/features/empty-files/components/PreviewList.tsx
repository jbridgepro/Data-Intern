/**
 * File: src/features/empty-files/components/PreviewList.tsx
 *
 * Component for displaying the preview list of files to be generated.
 * Shows file status indicators and error messages.
 * Supports inline editing of file names.
 */

import { useState, useRef, useEffect } from "react";
import { FileIcon, Check, AlertCircle, Edit2 } from "lucide-react";
import { GeneratedFile } from "../utils/fileGenerator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface PreviewListProps {
  files: GeneratedFile[];
  onRename?: (id: string, newName: string) => void;
}

/**
 * Editable file item component that allows inline editing of file names
 */
const EditableFileItem = ({
  file,
  onRename,
}: {
  file: GeneratedFile;
  onRename?: (id: string, newName: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(file.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update temp name when file name changes externally (e.g. config change)
  useEffect(() => {
    if (!isEditing) {
      setTempName(file.name);
    }
  }, [file.name, isEditing]);

  // Focus and select input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  /**
   * Handles saving the edited name
   */
  const handleSave = () => {
    if (tempName.trim() && tempName !== file.name && onRename) {
      onRename(file.id, tempName.trim());
    } else {
      setTempName(file.name); // Revert if empty or unchanged
    }
    setIsEditing(false);
  };

  /**
   * Handles keyboard events during editing
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setTempName(file.name);
      setIsEditing(false);
    }
  };

  // Don't allow editing if file is being generated or has been created
  const canEdit = file.status === "pending" && onRename !== undefined;

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors text-sm group">
      <FileIcon className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isEditing && canEdit ? (
            <Input
              ref={inputRef}
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="h-6 text-sm py-0 px-1.5 font-mono flex-1 min-w-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="flex-1 min-w-0 flex items-center gap-2 group/text cursor-pointer"
              onClick={() => canEdit && setIsEditing(true)}
            >
              <span className="truncate font-mono text-card-foreground flex-1">
                {file.name}
              </span>
              {canEdit && (
                <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover/text:opacity-100 transition-opacity shrink-0" />
              )}
            </div>
          )}
          {file.status === "success" && (
            <Check className="h-4 w-4 text-green-500 shrink-0" />
          )}
          {file.status === "error" && (
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          {file.status === "exists" && (
            <span className="text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20 shrink-0">
              Exists
            </span>
          )}
        </div>
        {file.status === "error" && file.errorMessage && (
          <p
            className="text-xs text-red-600 dark:text-red-400 mt-1 truncate"
            title={file.errorMessage}
          >
            {file.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export const PreviewList = ({ files, onRename }: PreviewListProps) => {
  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
        <p>No files generated</p>
        <p className="text-xs mt-2">Configure options to see preview</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full rounded-md border bg-card">
      <div className="p-4 space-y-2">
        {files.map((file) => (
          <EditableFileItem key={file.id} file={file} onRename={onRename} />
        ))}
      </div>
    </ScrollArea>
  );
};
