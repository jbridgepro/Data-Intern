import { useState, useEffect, useRef } from "react";
import { useUpdate } from "@/hooks/useUpdate";

export const UpdateChecker: React.FC = () => {
  const {
    status,
    update,
    progress,
    errorMsg,
    checkUpdates,
    downloadAndInstall,
    relaunchApp,
  } = useUpdate();
  
  const [dismissed, setDismissed] = useState(false);
  const hasChecked = useRef(false);

  // Check for updates 3 seconds after mount
  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const timer = setTimeout(async () => {
      try {
        await checkUpdates();
      } catch (err) {
        // Silent failure for auto-check
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkUpdates]);

  // Don't render anything if no update or dismissed, or if up-to-date (auto-check shouldn't show "you are up to date")
  if (dismissed || status === "idle" || status === "checking" || status === "up-to-date") return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
              <svg
                className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Update Available
              </h3>
              {update && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  v{update.version}
                </p>
              )}
            </div>
          </div>
          {status !== "downloading" && status !== "ready" && (
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              aria-label="Dismiss update notification"
              title="Remind me later"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Release notes (truncated) */}
        {status === "available" && update?.body && (
          <div className="px-4 pb-2">
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
              {update.body}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {status === "downloading" && (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Downloading update…
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {status === "error" && (
          <div className="px-4 pb-2">
            <p className="text-xs text-red-600 dark:text-red-400">
              Update failed: {errorMsg || "Unknown error"}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-4 pt-1 flex gap-2">
          {status === "available" && (
            <>
              <button
                onClick={() => setDismissed(true)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                Later
              </button>
              <button
                onClick={downloadAndInstall}
                className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors"
              >
                Update Now
              </button>
            </>
          )}

          {status === "downloading" && (
            <button
              disabled
              className="flex-1 rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed"
            >
              Installing…
            </button>
          )}

          {status === "ready" && (
            <button
              onClick={relaunchApp}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors"
            >
              Relaunch Now
            </button>
          )}

          {status === "error" && (
            <button
              onClick={() => setDismissed(true)}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateChecker;
