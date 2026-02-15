import React from "react";
import { RefreshCw, Download, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpdate } from "@/hooks/useUpdate";
import { cn } from "@/lib/utils";

export const UpdateCheckRow = () => {
  const {
    status,
    update,
    progress,
    errorMsg,
    checkUpdates,
    downloadAndInstall,
    relaunchApp,
  } = useUpdate();

  const handleCheck = async () => {
    await checkUpdates();
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          App Updates
        </span>
        
        <div className="flex items-center gap-2">
          {status === "idle" && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCheck}
              className="h-7 text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check for Updates
            </Button>
          )}

          {status === "checking" && (
            <Badge variant="secondary" className="gap-1.5 h-7">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking...
            </Badge>
          )}

          {status === "up-to-date" && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 h-7 text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Up to date
              </Badge>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCheck}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
                title="Check again"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {status === "available" && (
            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1.5 h-7 bg-blue-600 hover:bg-blue-700">
                v{update?.version} available
              </Badge>
              <Button 
                size="sm" 
                onClick={downloadAndInstall}
                className="h-7 text-xs gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Update
              </Button>
            </div>
          )}

          {status === "downloading" && (
            <Badge variant="secondary" className="gap-1.5 h-7">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Downloading {progress}%
            </Badge>
          )}

          {status === "ready" && (
            <Button 
              size="sm" 
              onClick={relaunchApp}
              className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Relaunch
            </Button>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="gap-1.5 h-7">
                <AlertCircle className="h-3.5 w-3.5" />
                Error
              </Badge>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCheck}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
                title="Try again"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {status === "downloading" && (
        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error Message */}
      {status === "error" && errorMsg && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-100 dark:border-red-900/20">
          {errorMsg}
        </p>
      )}
      
      {/* Release Notes Preview */}
      {status === "available" && update?.body && (
        <div className="mt-1 p-2 rounded border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/30">
          <p className="text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">Release Notes:</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-wrap">
            {update.body}
          </p>
        </div>
      )}
    </div>
  );
};
