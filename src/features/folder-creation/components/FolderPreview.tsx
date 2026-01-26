/**
 * File: src/features/folder-creation/components/FolderPreview.tsx
 *
 * Front-end component for displaying the preview tree of folders to be created.
 * Shows folder status indicators and error messages.
 * Supports inline editing of folder names.
 */

import { useState, useRef, useEffect } from "react";
import { Folder, File, Edit2, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { PreviewNode } from "../utils/folderUtils";
import { Input } from "../../../components/ui/input";
import { ScrollArea } from "../../../components/ui/scroll-area";

interface FolderPreviewProps {
  nodes: PreviewNode[];
  onRename: (id: string, newName: string) => void;
  level?: number;
}

const EditableNode = ({
  node,
  onRename,
  level,
}: {
  node: PreviewNode;
  onRename: (id: string, newName: string) => void;
  level: number;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // If name changes externally (e.g. regen), update temp name if not editing
    if (!isEditing) {
      setTempName(node.name);
    }
  }, [node.name, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCreate = () => {
    if (tempName.trim()) {
      onRename(node.id, tempName);
    } else {
      setTempName(node.name); // Revert if empty
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreate();
    } else if (e.key === "Escape") {
      setTempName(node.name);
      setIsEditing(false);
    }
  };

  const isPlaceholder = node.id === "more-placeholder";
  const canEdit = (node.status === "pending" || !node.status) && !isPlaceholder;

  return (
    <motion.div
      key={`${level}-${node.id}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative group"
    >
      {/* Connector lines for tree structure */}
      {level > 0 && (
        <div
          className="absolute left-[-1.25rem] top-0 bottom-0 w-px bg-border"
          style={{ left: "-14px" }}
        />
      )}

      <div
        className={`flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-accent/50 transition-colors ${
          level === 0 ? "mb-1" : ""
        }`}
        style={{ marginLeft: level * 16 }}
      >
        {/* Horizontal connector */}
        {level > 0 && (
          <div className="absolute left-[-14px] top-1/2 w-3.5 h-px bg-border" />
        )}

        {node.type === "folder" ? (
          <Folder className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <File className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        {isEditing && !isPlaceholder && canEdit ? (
          <Input
            ref={inputRef}
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleCreate}
            onKeyDown={handleKeyDown}
            className="h-6 text-sm py-0 px-1.5 font-mono flex-1 min-w-0 max-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="flex-1 min-w-0 flex items-center gap-2 group/text"
            onClick={() => canEdit && setIsEditing(true)}
          >
            <span
              className={`text-sm truncate font-mono flex-1 ${
                isPlaceholder
                  ? "text-muted-foreground italic"
                  : "text-card-foreground"
              }`}
            >
              {node.name}
            </span>
            {canEdit && (
              <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover/text:opacity-100 transition-opacity shrink-0 cursor-pointer" />
            )}
          </div>
        )}

        {/* Status indicators */}
        {!isPlaceholder && (
          <>
            {node.status === "success" && (
              <Check className="h-4 w-4 text-green-500 shrink-0" />
            )}
            {node.status === "error" && (
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            )}
            {node.status === "exists" && (
              <span className="text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20 shrink-0">
                Exists
              </span>
            )}
          </>
        )}
      </div>

      {/* Error message */}
      {node.status === "error" && node.errorMessage && (
        <div
          className="ml-6 mt-1 text-xs text-red-600 dark:text-red-400 truncate"
          title={node.errorMessage}
        >
          {node.errorMessage}
        </div>
      )}

      {node.children && node.children.length > 0 && (
        <div className="relative border-l border-border/50 ml-2.5 pl-2">
          <FolderPreview
            nodes={node.children}
            onRename={onRename}
            level={level + 1}
          />
        </div>
      )}
    </motion.div>
  );
};

export const FolderPreview = ({
  nodes,
  onRename,
  level = 0,
}: FolderPreviewProps) => {
  if (nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
        <p>No folders generated</p>
        <p className="text-xs mt-2">Configure options to see preview</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full rounded-md border bg-card">
      <div className="p-4">
        {nodes.map((node) => (
          <EditableNode
            key={node.id}
            node={node}
            onRename={onRename}
            level={level}
          />
        ))}
      </div>
    </ScrollArea>
  );
};
