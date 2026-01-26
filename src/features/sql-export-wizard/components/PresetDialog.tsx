/**
 * File path: src/features/sql-export-wizard/components/PresetDialog.tsx
 *
 * Frontend component for saving and managing export/import presets
 * Dialog for creating, editing, and deleting presets
 */

import { useState, useEffect } from "react";
import { X, Save, Trash2, Star, StarOff } from "lucide-react";
import { ExportTemplate, ImportTemplate } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PresetDialogProps {
  type: "export" | "import";
  preset: ExportTemplate | ImportTemplate | null;
  onSave: (preset: ExportTemplate | ImportTemplate) => void;
  onDelete?: (presetId: string) => void;
  onClose: () => void;
}

export function PresetDialog({
  type,
  preset,
  onSave,
  onDelete,
  onClose,
}: PresetDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setDescription(preset.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [preset]);

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a preset name");
      return;
    }

    const presetToSave = preset
      ? {
          ...preset,
          name: name.trim(),
          description: description.trim() || undefined,
          lastUsed: new Date(),
        }
      : {
          id: `preset-${Date.now()}`,
          name: name.trim(),
          description: description.trim() || undefined,
          createdAt: new Date(),
          lastUsed: new Date(),
          // Configuration will be set by parent component
          configuration: {} as any,
        };

    onSave(presetToSave as ExportTemplate | ImportTemplate);
    onClose();
  };

  const handleDelete = () => {
    if (
      preset &&
      onDelete &&
      confirm(`Are you sure you want to delete "${preset.name}"?`)
    ) {
      onDelete(preset.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Save className="h-5 w-5" />
            {preset ? "Edit" : "Save"} {type === "export" ? "Export" : "Import"}{" "}
            Preset
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          {/* Preset Name */}
          <div>
            <Label htmlFor="preset-name">Preset Name *</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`My ${type === "export" ? "Export" : "Import"} Preset`}
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="preset-description">Description (Optional)</Label>
            <textarea
              id="preset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this preset..."
              className="w-full mt-1 p-2 border rounded-md text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none min-h-[80px]"
            />
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              This preset will save your current{" "}
              {type === "export" ? "export" : "import"} configuration including
              format settings, column selections, and destination options.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-800">
          <div>
            {preset && onDelete && (
              <Button
                variant="outline"
                onClick={handleDelete}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Preset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
