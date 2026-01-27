/**
 * File path: src/features/sql-export-wizard/components/PresetManager.tsx
 *
 * Frontend component for managing saved presets
 * Lists, loads, and deletes export/import presets
 */

import { useState } from "react";
import { X, FileText, Trash2, Clock, Loader2 } from "lucide-react";
import { ExportTemplate, ImportTemplate } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PresetManagerProps {
  type: "export" | "import";
  presets: (ExportTemplate | ImportTemplate)[];
  onLoad: (preset: ExportTemplate | ImportTemplate) => void;
  onDelete: (presetId: string) => void;
  onClose: () => void;
}

export function PresetManager({
  type,
  presets,
  onLoad,
  onDelete,
  onClose,
}: PresetManagerProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatLastUsed = (date?: Date) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
    return formatDate(date);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {type === "export" ? "Export" : "Import"} Presets
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Presets List */}
        <div className="flex-1 overflow-y-auto p-6">
          {presets.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                No {type === "export" ? "export" : "import"} presets saved yet
              </p>
              <p className="text-xs mt-2">
                Save your first preset from the{" "}
                {type === "export" ? "Export" : "Import"} panel
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        {preset.name}
                      </h3>
                      {preset.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          {preset.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Created: {formatDate(preset.createdAt)}</span>
                        </div>
                        {preset.lastUsed && (
                          <div className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3" />
                            <span>
                              Last used: {formatLastUsed(preset.lastUsed)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onLoad(preset);
                        onClose();
                      }}
                      className="flex-1"
                    >
                      Load Preset
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete "${preset.name}"?`)) {
                          onDelete(preset.id);
                        }
                      }}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
