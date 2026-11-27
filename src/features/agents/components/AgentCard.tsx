import {
  Pause,
  Play,
  CheckCircle2,
  Circle,
  AlertCircle,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
// import { getAgentMetadata } from "../agentRegistry";
import type { AgentConfig, AgentResults, AgentState } from "../types";

type ContextLine = { label: string; value: string };
type Metric = { label: string; value: string };

const formatFileSize = (bytes?: number) => {
  if (bytes === undefined || bytes === null) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatCount = (value: number) => value.toLocaleString();

const isMissingString = (value: unknown) =>
  typeof value !== "string" || value.trim().length === 0;

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

const formatPathList = (paths: string[], max = 2) => {
  if (paths.length === 0) return "Not set";
  if (paths.length <= max) return paths.join(", ");
  return `${paths.slice(0, max).join(", ")} +${paths.length - max} more`;
};

const getMissingConfigReason = (agent: AgentConfig): string | null => {
  const params = agent.params ?? {};
  switch (agent.type) {
    case "file-organizer":
    case "duplicate-finder":
    case "file-analyzer": {
      return isMissingString(params.targetDirectory)
        ? "Target directory not set"
        : null;
    }
    case "backup-agent": {
      const sources = toStringArray(params.sourceDirectories);
      if (sources.length === 0) return "Source directories not set";
      if (isMissingString(params.backupLocation)) return "Backup location not set";
      return null;
    }
    case "cleanup-agent": {
      const targets = toStringArray(params.targetDirectories);
      return targets.length === 0 ? "Target directories not set" : null;
    }
    case "sync-agent": {
      if (isMissingString(params.sourceDirectory)) return "Source directory not set";
      if (isMissingString(params.targetDirectory)) return "Target directory not set";
      return null;
    }
    case "task-agent": {
      const subagents = agent.subagents ?? [];
      return subagents.length === 0 ? "No subagents configured" : null;
    }
    default:
      return null;
  }
};

const getContextSummary = (agent: AgentConfig): ContextLine | null => {
  const params = agent.params ?? {};
  switch (agent.type) {
    case "file-organizer":
      return { label: "Target", value: params.targetDirectory || "Not set" };
    case "duplicate-finder":
      return { label: "Scan", value: params.targetDirectory || "Not set" };
    case "file-analyzer":
      return { label: "Analyze", value: params.targetDirectory || "Not set" };
    case "cleanup-agent": {
      const targets = toStringArray(params.targetDirectories);
      return { label: "Targets", value: formatPathList(targets) };
    }
    case "backup-agent": {
      const sources = formatPathList(toStringArray(params.sourceDirectories));
      const destination = params.backupLocation || "Not set";
      return { label: "Backup", value: `${sources} -> ${destination}` };
    }
    case "sync-agent": {
      const source = params.sourceDirectory || "Not set";
      const target = params.targetDirectory || "Not set";
      const direction = params.syncDirection || "bidirectional";
      return { label: "Sync", value: `${source} -> ${target} (${direction})` };
    }
    case "task-agent": {
      const subagents = agent.subagents ?? [];
      return { label: "Subagents", value: `${subagents.length} configured` };
    }
    case "clawdbot":
      return { label: "Mode", value: params.mode || "assistant" };
    default:
      return null;
  }
};

const getContextDetails = (agent: AgentConfig): ContextLine[] => {
  const params = agent.params ?? {};
  switch (agent.type) {
    case "file-organizer":
      return [
        { label: "Target", value: params.targetDirectory || "Not set" },
        { label: "Strategy", value: params.strategy || "by-type" },
        {
          label: "Subdirs",
          value: params.includeSubdirectories === false ? "Excluded" : "Included",
        },
      ];
    case "duplicate-finder":
      return [
        { label: "Target", value: params.targetDirectory || "Not set" },
        { label: "Min size", value: formatFileSize(params.minFileSize || 0) },
        {
          label: "Auto remove",
          value: params.autoRemove ? "Enabled" : "Disabled",
        },
      ];
    case "file-analyzer":
      return [
        { label: "Target", value: params.targetDirectory || "Not set" },
        { label: "Unused scan", value: params.analyzeUnused === false ? "Off" : "On" },
        { label: "Suggest archival", value: params.suggestArchival ? "On" : "Off" },
      ];
    case "cleanup-agent": {
      const targets = toStringArray(params.targetDirectories);
      return [
        { label: "Targets", value: formatPathList(targets, 3) },
        { label: "Temp files", value: params.removeTempFiles === false ? "Keep" : "Remove" },
        { label: "Empty folders", value: params.removeEmptyFolders === false ? "Keep" : "Remove" },
        { label: "Older than", value: `${params.olderThanDays || 30} days` },
      ];
    }
    case "backup-agent": {
      const sources = toStringArray(params.sourceDirectories);
      return [
        { label: "Sources", value: formatPathList(sources, 3) },
        { label: "Destination", value: params.backupLocation || "Not set" },
        {
          label: "Subdirs",
          value: params.includeSubdirectories === false ? "Excluded" : "Included",
        },
        { label: "Frequency", value: params.frequency || "daily" },
      ];
    }
    case "sync-agent":
      return [
        { label: "Source", value: params.sourceDirectory || "Not set" },
        { label: "Target", value: params.targetDirectory || "Not set" },
        { label: "Direction", value: params.syncDirection || "bidirectional" },
        {
          label: "Subdirs",
          value: params.includeSubdirectories === false ? "Excluded" : "Included",
        },
      ];
    case "task-agent": {
      const subagents = agent.subagents ?? [];
      return [
        { label: "Subagents", value: `${subagents.length} configured` },
      ];
    }
    case "clawdbot":
      return [{ label: "Mode", value: params.mode || "assistant" }];
    default:
      return [];
  }
};

const getResultMetrics = (
  agent: AgentConfig,
  results?: AgentResults
): Metric[] => {
  if (!results) return [];
  const metrics: Metric[] = [];

  switch (agent.type) {
    case "file-organizer":
      if (results.filesProcessed !== undefined) {
        metrics.push({ label: "Files", value: formatCount(results.filesProcessed) });
      }
      if (results.foldersCreated !== undefined) {
        metrics.push({ label: "Folders", value: formatCount(results.foldersCreated) });
      }
      break;
    case "duplicate-finder":
      if (results.duplicatesFound !== undefined) {
        metrics.push({ label: "Duplicates", value: formatCount(results.duplicatesFound) });
      }
      if (results.duplicateGroups !== undefined) {
        metrics.push({ label: "Groups", value: formatCount(results.duplicateGroups) });
      }
      if (results.filesRemoved !== undefined) {
        metrics.push({ label: "Removed", value: formatCount(results.filesRemoved) });
      }
      if (results.spaceSaved !== undefined) {
        metrics.push({ label: "Saved", value: formatFileSize(results.spaceSaved) });
      }
      break;
    case "file-analyzer":
      if (results.filesAnalyzed !== undefined) {
        metrics.push({ label: "Files", value: formatCount(results.filesAnalyzed) });
      }
      if (results.unusedFiles !== undefined) {
        metrics.push({ label: "Unused", value: formatCount(results.unusedFiles) });
      }
      if (results.archivalCandidates !== undefined) {
        metrics.push({ label: "Archive", value: formatCount(results.archivalCandidates) });
      }
      if (results.totalSize !== undefined) {
        metrics.push({ label: "Size", value: formatFileSize(results.totalSize) });
      }
      if (results.organizationScore !== undefined) {
        metrics.push({ label: "Score", value: Number(results.organizationScore).toFixed(2) });
      }
      break;
    case "cleanup-agent":
      if (results.filesRemoved !== undefined) {
        metrics.push({ label: "Files", value: formatCount(results.filesRemoved) });
      }
      if (results.foldersRemoved !== undefined) {
        metrics.push({ label: "Folders", value: formatCount(results.foldersRemoved) });
      }
      if (results.spaceSaved !== undefined) {
        metrics.push({ label: "Saved", value: formatFileSize(results.spaceSaved) });
      }
      break;
    case "backup-agent":
      if (results.filesBackedUp !== undefined) {
        metrics.push({ label: "Files", value: formatCount(results.filesBackedUp) });
      }
      if (results.totalSizeBackedUp) {
        metrics.push({ label: "Size", value: formatFileSize(results.totalSizeBackedUp) });
      }
      break;
    case "sync-agent":
      if (results.filesSynced !== undefined) {
        metrics.push({ label: "Synced", value: formatCount(results.filesSynced) });
      }
      if (results.filesCreated !== undefined) {
        metrics.push({ label: "Created", value: formatCount(results.filesCreated) });
      }
      if (results.filesUpdated !== undefined) {
        metrics.push({ label: "Updated", value: formatCount(results.filesUpdated) });
      }
      break;
    case "task-agent":
      if (results.subagentsExecuted !== undefined) {
        metrics.push({ label: "Subagents", value: formatCount(results.subagentsExecuted) });
      }
      break;
    default:
      break;
  }

  return metrics;
};

interface AgentCardProps {
  agent: AgentConfig;
  state?: AgentState;
  isExpanded: boolean;
  onToggleExpand: (e?: React.MouseEvent) => void;
  onToggleEnabled: () => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;
  onDelete: () => void;
  isSelected?: boolean;
}

export const AgentCard = ({
  agent,
  state,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  onStart,
  onStop,
  onPause,
  onResume,
  onClear,
  onDelete,
  isSelected,
}: AgentCardProps) => {
  // const metadata = getAgentMetadata(agent.type);
  // Unused Icon removed
  // const Icon = metadata.icon;

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "running":
        return <Circle className="h-4 w-4 text-blue-500 fill-blue-500/20 animate-pulse" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />;
    }
  };

  const getTimeDisplay = (state?: AgentState) => {
    if (!state?.startedAt) return "";
    const now = new Date();
    const diff = now.getTime() - new Date(state.startedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return "just now";
  };

  const missingConfigReason = getMissingConfigReason(agent);
  const needsConfig = Boolean(missingConfigReason);
  const contextSummary = getContextSummary(agent);
  const contextDetails = getContextDetails(agent);
  const resultMetrics = getResultMetrics(agent, state?.results);

  return (
    <div className="group flex flex-col border-b border-border/40 last:border-0">
      <div 
        className={cn(
          "flex items-start gap-3 p-3 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors relative",
          isExpanded && "bg-slate-100/50 dark:bg-slate-800/50",
          isSelected && "bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-l-blue-500"
        )}
        onClick={onToggleExpand}
      >
        <div className="pt-0.5 shrink-0">
          {getStatusIcon(state?.status)}
        </div>
        
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "font-medium text-sm truncate",
                  state?.status === "completed" &&
                    "text-muted-foreground/80 decoration-slate-400/50",
                )}
              >
                {agent.name}
              </span>
              {needsConfig && (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300 border-amber-300/70 dark:border-amber-500/40"
                >
                  Needs config
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {getTimeDisplay(state)}
            </span>
          </div>

          {contextSummary && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
              <span className="text-muted-foreground/70">{contextSummary.label}:</span>
              <span className="truncate" title={contextSummary.value}>
                {contextSummary.value}
              </span>
            </div>
          )}

          {needsConfig ? (
            <div className="text-[10px] text-amber-600 dark:text-amber-400">
              Needs configuration
            </div>
          ) : resultMetrics.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {resultMetrics.map((metric) => (
                <span key={metric.label} className="whitespace-nowrap">
                  <span className="text-muted-foreground/70">{metric.label}:</span>{" "}
                  <span className="text-foreground/80">{metric.value}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">No results yet</div>
          )}
        </div>

        {/* Hover Indicator that more options available on click */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-8 md:top-auto md:bottom-2">
           <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 bg-slate-100/50 dark:bg-slate-800/50">
           <div className="pl-7 space-y-2">
               <div className="text-xs text-muted-foreground flex justify-between items-start">
                   <span>{agent.description}</span>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 px-2 text-[10px]" 
                        onClick={(e) => { e.stopPropagation(); onToggleEnabled(); }}
                    >
                        {agent.enabled ? "Enabled" : "Disabled"}
                    </Button>
               </div>

               {contextDetails.length > 0 && (
                 <div className="grid gap-1 text-[11px] text-muted-foreground">
                   {contextDetails.map((line) => (
                     <div
                       key={line.label}
                       className="grid grid-cols-[auto_1fr] gap-2 items-start"
                     >
                       <span className="text-muted-foreground/70">{line.label}</span>
                       <span className="min-w-0 truncate" title={line.value}>
                         {line.value}
                       </span>
                     </div>
                   ))}
                 </div>
               )}

               {needsConfig && (
                 <div className="text-[11px] text-amber-600 dark:text-amber-400">
                   Needs configuration: {missingConfigReason}
                 </div>
               )}
               
               {state?.status === 'running' && (
                   <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                           <span>{state.progress.stage}</span>
                           <span>{state.progress.percentage}%</span>
                      </div>
                      <Progress value={state.progress.percentage} className="h-1" />
                   </div>
               )}

               {/* Control Buttons Row */}
               <div className="flex gap-2 pt-2">
                   {state?.status === 'running' ? (
                       <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={onPause}>
                            <Pause className="mr-1 h-3 w-3" /> Pause
                       </Button>
                   ) : state?.status === 'paused' ? (
                        <Button size="sm" variant="secondary" className="h-7 text-xs flex-1" onClick={onResume}>
                            <Play className="mr-1 h-3 w-3" /> Resume
                       </Button>
                   ) : (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs flex-1"
                          onClick={onStart}
                          disabled={!agent.enabled || needsConfig}
                          title={needsConfig ? missingConfigReason ?? "Needs configuration" : undefined}
                        >
                            <Play className="mr-1 h-3 w-3" /> Start
                       </Button>
                   )}
                   
                   {(state?.status === 'running' || state?.status === 'paused') && (
                       <Button size="sm" variant="destructive" className="h-7 text-xs flex-1" onClick={onStop}>
                           Stop
                       </Button>
                   )}
                   
                   {(state?.status === 'completed' || state?.status === 'stopped' || state?.status === 'error') && (
                       <Button size="sm" variant="ghost" className="h-7 text-xs flex-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onClear}>
                           Clear
                       </Button>
                   )}
                   
                   {/* Delete Action - Always available */}
                   <Button size="sm" variant="ghost" className="h-7 text-xs flex-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                       <Trash2 className="mr-1 h-3 w-3" /> Delete
                   </Button>
               </div>
               
               {/* Logs simplified */}
               {state?.logs && state.logs.length > 0 && (
                 <div className="mt-2 text-[10px] font-mono text-muted-foreground border-l-2 border-border pl-2 max-h-20 overflow-y-auto">
                    {state.logs.slice(-5).map((l, i) => (
                        <div key={i} className="truncate">{l.message}</div>
                    ))}
                 </div>
               )}
           </div>
        </div>
      )}
    </div>
  );
};
