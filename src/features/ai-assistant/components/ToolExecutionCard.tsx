/**
 * File: src/features/ai-assistant/components/ToolExecutionCard.tsx
 *
 * Component for displaying tool execution status and parameters.
 */

import {
  ChevronDown,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ToolExecutionInfo {
  tool: string;
  description: string;
  params: Record<string, any>;
  status: "pending" | "running" | "success" | "error";
  progress?: {
    current: number;
    total: number;
    status: string;
    percentage: number;
  };
  result?: {
    success: boolean;
    data?: any;
    error?: string;
  };
}

interface ToolExecutionCardProps {
  execution: ToolExecutionInfo;
  stepNumber?: number;
  totalSteps?: number;
  onViewInTab?: (tool: string) => void;
}

export const ToolExecutionCard = ({
  execution,
  stepNumber,
  totalSteps,
  onViewInTab,
}: ToolExecutionCardProps) => {
  const [isOpen, setIsOpen] = useState(execution.status === "running" || execution.status === "error");

  const getToolDisplayName = (tool: string): string => {
    const names: Record<string, string> = {
      analyze_directory: "Analyze Directory",
      organize_files: "Organize Files",
      find_duplicates: "Find Duplicates",
      rename_files: "Rename Files",
      execute_operation: "Execute Operation",
      search_files: "Search Files",
      list_directory_contents: "List Contents",
      get_file_info: "Get File Info",
      read_file_content: "Read File",
      write_file_content: "Write File",
      delete_files: "Delete Files",
      calculate_directory_size: "Calculate Size",
      file_search_by_content: "Search Content",
      compare_directories: "Compare Directories",
      batch_delete: "Batch Delete",
      create_directory: "Create Directory",
      move_file: "Move File",
      copy_file: "Copy File",
      file_copy_tab: "File Copy & Move",
      folder_creation_tab: "Folder Creation",
      file_creation_tab: "File Creation",
      find_replace_tab: "Find & Replace",
      list_agents: "List Agents",
      start_agent: "Start Agent",
      stop_agent: "Stop Agent",
      get_agent_status: "Get Agent Status",
      configure_agent: "Configure Agent",
      clawdbot_execute: "ClawdBot Execute",
      clawdhub_list_skills: "List ClawdHub Skills",
      clawdhub_install_skill: "Install ClawdHub Skill",
    };
    return names[tool] || tool.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusIcon = () => {
    switch (execution.status) {
      case "running":
        return (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
        );
      case "success":
        return (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        );
      case "error":
        return (
          <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        );
      default:
        return <Wrench className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const getStatusColor = () => {
    // Cleaner, more subtle backgrounds
    switch (execution.status) {
      case "running":
        return "border-blue-200/50 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-900/5";
      case "success":
        return "border-green-200/50 dark:border-green-800/30 bg-green-50/30 dark:bg-green-900/5";
      case "error":
        return "border-red-200/50 dark:border-red-800/30 bg-red-50/30 dark:bg-red-900/5";
      default:
        return "border-slate-200/50 dark:border-slate-800/30 bg-slate-50/30 dark:bg-slate-900/5";
    }
  };

  return (
    <div className={cn("rounded-lg border transition-all duration-200", getStatusColor())}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 mt-0.5">
            {getStatusIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium leading-none">
                {getToolDisplayName(execution.tool)}
              </span>
              {stepNumber && totalSteps && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  Step {stepNumber}/{totalSteps}
                </span>
              )}
            </div>
            {!isOpen && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {execution.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {execution.result && execution.status === "success" && !isOpen && (
            <span className="text-xs text-green-600 dark:text-green-400 hidden sm:inline-block">
              Completed
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pb-3 pt-0 border-t border-black/5 dark:border-white/5 mt-0 animate-in slide-in-from-top-2 fade-in duration-200 cursor-default">
           
           <div className="mt-3 text-sm text-foreground/90">
             {execution.description}
           </div>

           {onViewInTab && execution.status !== "pending" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-7 text-xs w-full sm:w-auto"
              onClick={() => onViewInTab(execution.tool)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Full Details
            </Button>
          )}

          {/* Parameters */}
          <div className="mt-3 bg-slate-100/50 dark:bg-slate-900/50 rounded p-2.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
              Parameters
            </div>
            <div className="space-y-1.5 text-xs font-mono">
              {Object.entries(execution.params)
                .map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2 break-all">
                    <span className="text-blue-600 dark:text-blue-400 shrink-0">{key}:</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {Array.isArray(value) ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Progress */}
          {execution.status === "running" && execution.progress && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {execution.progress.status}
                </span>
                <span className="font-medium">
                  {execution.progress.current}/{execution.progress.total}
                </span>
              </div>
              <Progress value={execution.progress.percentage} className="h-1.5" />
            </div>
          )}

          {/* Result */}
          {execution.result && (
            <div className={`mt-3 p-2.5 rounded text-xs ${
              execution.result.success 
                ? "bg-green-100/50 dark:bg-green-900/20 text-green-800 dark:text-green-200" 
                : "bg-red-100/50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
            }`}>
              {execution.result.success ? (
                <>
                  <div className="font-medium mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Success
                  </div>
                  <div>
                    {execution.result.data?.message || "Operation completed successfully"}
                  </div>
                  {execution.result.data?.filesProcessed && (
                    <div className="mt-1 opacity-80">
                      • Processed {execution.result.data.filesProcessed} files
                    </div>
                  )}
                  {execution.result.data?.items && Array.isArray(execution.result.data.items) && (
                     <div className="mt-1 max-h-24 overflow-y-auto custom-scrollbar">
                        {execution.result.data.items.slice(0, 5).map((item: any, i: number) => (
                           <div key={i} className="truncate">• {item.name || item}</div>
                        ))}
                        {execution.result.data.items.length > 5 && (
                           <div className="italic text-[10px] mt-0.5">+{execution.result.data.items.length - 5} more items</div>
                        )}
                     </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-medium mb-1 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Error
                  </div>
                  <div>{execution.result.error || "Operation failed"}</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
