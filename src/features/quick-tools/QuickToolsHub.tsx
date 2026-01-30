import React from "react";
import { toolsConfig } from "./config/tools";

interface QuickToolsHubProps {
  onOpenTool?: (toolId: string, name: string) => void;
}

export const QuickToolsHub: React.FC<QuickToolsHubProps> = ({ onOpenTool }) => {
  return (
    <div className="h-full w-full overflow-y-auto p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400">
            Quick Tools
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            A collection of developer utilities and productivity tools.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {toolsConfig.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onOpenTool?.(tool.id, tool.name)}
                className="group relative flex flex-col items-start text-left rounded-xl border border-slate-200 bg-white/50 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 w-full"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 transition-colors group-hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-900/40">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {tool.name}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {tool.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 opacity-0 transition-opacity group-hover:opacity-100">
                  Open Tool &rarr;
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
