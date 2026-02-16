import React from "react";
import { useJobs, Job } from "@/contexts/JobContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  X,
  Trash2,
  Ban,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export const JobStatusPanel = () => {
  const {
    activeJobs,
    completedJobs,
    cancelJob,
    pauseJob,
    resumeJob,
    cancelAll,
    pauseAll,
    resumeAll,
    removeJob,
    clearCompletedJobs,
  } = useJobs();

  const hasRunning = activeJobs.some((j) => j.status === "running");
  const hasPaused = activeJobs.some((j) => j.status === "paused");

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
           <h3 className="font-semibold text-sm">Active Jobs ({activeJobs.length})</h3>
           {activeJobs.length > 0 && (
              <div className="flex items-center gap-1 ml-4 border-l pl-4 border-slate-200 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 text-xs gap-1"
                    onClick={hasRunning ? pauseAll : resumeAll}
                    disabled={activeJobs.length === 0}
                  >
                     {hasRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                     {hasRunning ? "Pause All" : "Resume All"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={cancelAll}
                    disabled={activeJobs.length === 0}
                  >
                     <Ban className="h-3 w-3" />
                     Cancel All
                  </Button>
              </div>
           )}
        </div>
        <div>
           {completedJobs.length > 0 && (
               <Button
                variant="ghost"
                size="xs"
                className="h-6 text-xs gap-1 text-muted-foreground"
                onClick={clearCompletedJobs}
               >
                 <Trash2 className="h-3 w-3" />
                 Clear Completed
               </Button>
           )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {activeJobs.length === 0 && completedJobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
               <Layers className="h-12 w-12 mb-3 opacity-20" />
               <p>No active or recent jobs</p>
            </div>
          )}

          {activeJobs.length > 0 && (
            <div className="space-y-3">
               {activeJobs.map((job) => (
                 <JobItem
                    key={job.id}
                    job={job}
                    onCancel={() => cancelJob(job.id)}
                    onPause={() => pauseJob(job.id)}
                    onResume={() => resumeJob(job.id)}
                    onRemove={() => removeJob(job.id)}
                 />
               ))}
            </div>
          )}

          {completedJobs.length > 0 && (
            <>
               {activeJobs.length > 0 && <Separator />}
               <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent History</h4>
                  <div className="space-y-2 opacity-80">
                    {completedJobs.map((job) => (
                        <JobItem
                            key={job.id}
                            job={job}
                            onRemove={() => removeJob(job.id)}
                            isHistory
                        />
                    ))}
                  </div>
               </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const JobItem = ({ 
    job, 
    onCancel, 
    onPause, 
    onResume, 
    onRemove,
    isHistory = false 
}: { 
    job: Job; 
    onCancel?: () => void; 
    onPause?: () => void; 
    onResume?: () => void; 
    onRemove: () => void;
    isHistory?: boolean;
}) => {
    return (
        <div className={cn(
            "group flex flex-col gap-2 p-3 rounded-lg border",
            isHistory 
                ? "bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800" 
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
        )}>
           <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={job.status} />
                  <div className="min-w-0">
                      <div className="font-medium text-sm truncate" title={job.name}>{job.name}</div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                          <span className="capitalize">{job.type}</span>
                          <span>•</span>
                          <span>{formatDate(job.startTime, "HH:mm:ss")}</span>
                          {job.message && (
                            <>
                                <span>•</span>
                                <span className="truncate max-w-[200px]" title={job.message}>{job.message}</span>
                            </>
                          )}
                      </div>
                  </div>
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                  {!isHistory && (
                      <>
                          {job.status === 'running' && job.onPause && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPause} title="Pause">
                                  <Pause className="h-3 w-3" />
                              </Button>
                          )}
                          {job.status === 'paused' && job.onResume && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onResume} title="Resume">
                                  <Play className="h-3 w-3" />
                              </Button>
                          )}
                          {['running', 'paused', 'pending'].includes(job.status) && job.onCancel && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onCancel} title="Cancel">
                                  <X className="h-3 w-3" />
                              </Button>
                          )}
                      </>
                  )}
                  {isHistory && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onRemove} title="Remove">
                          <X className="h-3 w-3" />
                      </Button>
                  )}
              </div>
           </div>
           
           {!isHistory && (
               <div className="space-y-1">
                   {typeof job.progress === 'number' && (
                       <Progress value={job.progress} className={cn("h-1.5", job.status === 'paused' && "opacity-50")} />
                   )}
                   {job.total && job.processed !== undefined && (
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{Math.round(job.progress)}%</span>
                            <span>{job.processed} / {job.total}</span>
                        </div>
                   )}
               </div>
           )}
        </div>
    );
};

const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
        case 'running':
            return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
        case 'paused':
            return <Pause className="h-4 w-4 text-amber-500" />;
        case 'completed':
            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'failed':
            return <AlertCircle className="h-4 w-4 text-red-500" />;
        case 'cancelled':
            return <Ban className="h-4 w-4 text-slate-400" />;
        default:
            return <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />;
    }
};
