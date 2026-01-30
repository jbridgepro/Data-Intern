/**
 * File: src/features/ai-assistant/components/QuickActions.tsx
 *
 * Component for displaying quick action cards with modern UI design.
 * Features visual cards with icons, descriptions, and hover effects.
 */

import {
  Sparkles,
  FolderTree,
  Search,
  FileText,
  Archive,
  FolderPlus,
  ArrowRight,
  Wand2,
  Copy,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onAction: (action: string) => void;
  currentDirectory: string;
}

export const QuickActions = ({
  onAction,
  currentDirectory,
}: QuickActionsProps) => {
  // Primary actions displayed as larger cards
  const primaryActions = [
    {
      id: "auto-organize",
      label: "Organize Files",
      icon: FolderTree,
      description: "Sort files into folders by type",
      gradient: "from-violet-500 to-purple-600",
      bgLight: "bg-violet-50 dark:bg-violet-950/30",
      iconBg: "bg-violet-100 dark:bg-violet-900/50",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      id: "find-duplicates",
      label: "Find Duplicates",
      icon: Search,
      description: "Detect duplicate files",
      gradient: "from-blue-500 to-cyan-600",
      bgLight: "bg-blue-50 dark:bg-blue-950/30",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "smart-rename",
      label: "Smart Rename",
      icon: Wand2,
      description: "Rename with AI patterns",
      gradient: "from-amber-500 to-orange-600",
      bgLight: "bg-amber-50 dark:bg-amber-950/30",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  // Secondary actions displayed as compact buttons
  const secondaryActions = [
    {
      id: "create-project",
      label: "Create Project",
      icon: FolderPlus,
      color: "text-emerald-600 dark:text-emerald-400",
      bgHover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
    },
    {
      id: "archive-old",
      label: "Archive Old",
      icon: Archive,
      color: "text-slate-600 dark:text-slate-400",
      bgHover: "hover:bg-slate-100 dark:hover:bg-slate-800/50",
    },
    {
      id: "clean-empty",
      label: "Clean Empty",
      icon: Trash2,
      color: "text-red-600 dark:text-red-400",
      bgHover: "hover:bg-red-50 dark:hover:bg-red-950/30",
    },
    {
      id: "copy-structure",
      label: "Copy Structure",
      icon: Copy,
      color: "text-blue-600 dark:text-blue-400",
      bgHover: "hover:bg-blue-50 dark:hover:bg-blue-950/30",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Quick Actions
        </h3>
        {currentDirectory && (
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            in {currentDirectory.split('/').pop()}
          </span>
        )}
      </div>

      {/* Primary Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {primaryActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className={cn(
                "group relative p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60",
                "bg-white dark:bg-slate-900/50 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-950/50",
                "transition-all duration-300 text-left overflow-hidden"
              )}
            >
              {/* Gradient Hover Background */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity duration-300",
                action.gradient
              )} />

              {/* Content */}
              <div className="relative">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 duration-300",
                  action.iconBg
                )}>
                  <Icon className={cn("h-5 w-5", action.iconColor)} />
                </div>
                
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                  {action.label}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-slate-400" />
                </h4>
                
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {action.description}
                </p>
              </div>

              {/* Bottom Gradient Line */}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                action.gradient
              )} />
            </button>
          );
        })}
      </div>

      {/* Secondary Actions - Compact Row */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
        <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">More:</span>
        {secondaryActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                "border border-slate-200/60 dark:border-slate-800/60",
                "bg-white dark:bg-slate-900/50 transition-all duration-200",
                action.bgHover
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", action.color)} />
              <span className="text-slate-700 dark:text-slate-300">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
