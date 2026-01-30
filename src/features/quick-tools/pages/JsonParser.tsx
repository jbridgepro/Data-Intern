
import React, { useState } from "react";
import { AlertCircle, CheckCircle, Copy, Trash2, Code2 } from "lucide-react";
import { clsx } from "clsx";

export const JsonParser: React.FC = () => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState(false);

  const formatJson = () => {
    if (!input.trim()) return;
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setError(null);
      setValid(true);
      setTimeout(() => setValid(false), 2000); // Reset success state
    } catch (err) {
      setError((err as Error).message);
      setValid(false);
    }
  };

  const clear = () => {
    setInput("");
    setError(null);
    setValid(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(input);
    setValid(true); // Re-use valid state for visual feedback
    setTimeout(() => setValid(false), 2000);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
            <Code2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              JSON Parser & Formatter
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Validate and beautify your JSON data
            </p>
          </div>
        </div>
        <div className="flex gap-2">
            <button
            onClick={clear}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
            <Trash2 className="h-4 w-4" />
            Clear
            </button>
            <button
            onClick={formatJson}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
            Format
            </button>
        </div>
      </div>

      <div className="relative flex-1 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute right-4 top-4 z-10 flex gap-2">
            <button
                onClick={copyToClipboard}
                className="rounded-md bg-slate-100 p-2 text-slate-500 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                title="Copy to clipboard"
            >
                <Copy className="h-4 w-4" />
            </button>
        </div>
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
            setValid(false);
          }}
          placeholder="Paste your JSON here..."
          className="h-full w-full resize-none rounded-xl bg-transparent p-6 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none dark:text-slate-200"
          spellCheck={false}
        />
        
        {/* Status Indicators */}
        <div className="absolute bottom-4 right-4 flex gap-2">
            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="max-w-md truncate">{error}</span>
                </div>
            )}
            {valid && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Valid JSON</span>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
