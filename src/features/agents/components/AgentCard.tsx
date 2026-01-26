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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
// import { getAgentMetadata } from "../agentRegistry";
import type { AgentConfig, AgentState } from "../types";

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
            <span className={cn("font-medium text-sm truncate", state?.status === 'completed' && "text-muted-foreground/80 decoration-slate-400/50")}>
              {agent.name}
            </span>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {getTimeDisplay(state)}
            </span>
          </div>

          <div className="flex items-center gap-x-2 text-xs text-muted-foreground">
             <span className="text-green-600 dark:text-green-500">+{state?.results?.linesAdded || 0}</span>
             <span className="text-red-500 dark:text-red-400">-{state?.results?.linesRemoved || 0}</span>
             <span className="text-slate-300 dark:text-slate-700 mx-0.5">·</span>
             <span className="">{state?.results?.filesTouchedCount || 0} Files</span>
          </div>
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
                        <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={onStart} disabled={!agent.enabled}>
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
