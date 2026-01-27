/**
 * File: src/features/ai-assistant/components/QuickActions.tsx
 *
 * Component for displaying quick action buttons.
 */

import {
  Sparkles,
  FolderTree,
  Search,
  FileText,
  Archive,
  FolderPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onAction: (action: string) => void;
  currentDirectory: string;
}

export const QuickActions = ({
  onAction,
  currentDirectory,
}: QuickActionsProps) => {
  const actions = [
    {
      id: "auto-organize",
      label: "Organize by file type",
      icon: FolderTree,
      description: "Automatically sort files into folders by type",
    },
    {
      id: "find-duplicates",
      label: "Find duplicates",
      icon: Search,
      description: "Detect and remove duplicate files",
    },
    {
      id: "smart-rename",
      label: "Smart rename",
      icon: FileText,
      description: "Rename files with intelligent patterns",
    },
    {
      id: "create-project",
      label: "Create project",
      icon: FolderPlus,
      description: "Generate a new project folder structure",
    },
    {
      id: "archive-old",
      label: "Archive old files",
      icon: Archive,
      description: "Move files older than 6 months to archive",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {actions.slice(0, 3).map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              onClick={() => onAction(action.id)}
              className="h-9 px-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
            >
              <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-slate-900 dark:text-slate-100">
                {action.label}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
