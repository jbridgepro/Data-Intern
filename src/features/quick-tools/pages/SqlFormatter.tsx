
import React, { useState } from "react";
import { Database, AlertCircle, Trash2, Copy, CheckCircle } from "lucide-react";

export const SqlFormatter: React.FC = () => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formatSql = () => {
    if (!input.trim()) return;
    try {
      // Basic formatting logic for demonstration
      // In a real app, use a library like 'sql-formatter'
      let formatted = input
        .replace(/\s+/g, " ")
        .replace(/\s*([,;])\s*/g, "$1\n")
        .replace(/\s*(\()\s*/g, "\n$1")
        .replace(/\s*(\))\s*/g, "\n$1")
        .replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|Create|Insert|Update|Delete|In|Is|Null)\b/gi, (match) => `\n${match.toUpperCase()}`)
        .trim();
        
      // Simple indentation attempt
      const lines = formatted.split('\n');
      formatted = lines.map(line => line.trim()).join('\n');
      
      setInput(formatted);
      setError(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError("Failed to format SQL");
    }
  };

  const clear = () => {
    setInput("");
    setError(null);
    setSuccess(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(input);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              SQL Formatter
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Beautify your SQL queries
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
            onClick={formatSql}
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
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. SELECT * FROM users WHERE id=1"
          className="h-full w-full resize-none rounded-xl bg-transparent p-6 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none dark:text-slate-200"
          spellCheck={false}
        />
        
        {/* Status Indicators */}
        <div className="absolute bottom-4 right-4 flex gap-2">
            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Done</span>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
