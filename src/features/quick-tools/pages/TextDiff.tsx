
import React, { useState, useEffect } from "react";
import { GitCompare, Copy, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const TextDiff: React.FC = () => {
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [diff, setDiff] = useState<{ type: "same" | "add" | "remove"; text: string }[]>([]);

  useEffect(() => {
    computeDiff();
  }, [textA, textB]);

  const computeDiff = () => {
    if (!textA && !textB) {
      setDiff([]);
      return;
    }

    const linesA = textA.split("\n");
    const linesB = textB.split("\n");
    const result: { type: "same" | "add" | "remove"; text: string }[] = [];

    const maxLen = Math.max(linesA.length, linesB.length);

    for (let i = 0; i < maxLen; i++) {
      const lineA = linesA[i];
      const lineB = linesB[i];

      if (lineA === lineB) {
        if (lineA !== undefined) {
          result.push({ type: "same", text: lineA });
        }
      } else {
        if (lineA !== undefined) {
          result.push({ type: "remove", text: lineA });
        }
        if (lineB !== undefined) {
          result.push({ type: "add", text: lineB });
        }
      }
    }

    setDiff(result);
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
          <GitCompare className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Text Diff
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Compare two text snippets and see the differences
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 flex-1 min-h-0">
        {/* Text A */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
          <label className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
            Original
          </label>
          <textarea
            value={textA}
            onChange={(e) => setTextA(e.target.value)}
            placeholder="Paste original text here..."
            className="flex-1 w-full resize-none rounded-lg bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:bg-slate-950 dark:text-slate-300"
            spellCheck={false}
          />
        </div>

        {/* Text B */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
          <label className="mb-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            Modified
          </label>
          <textarea
            value={textB}
            onChange={(e) => setTextB(e.target.value)}
            placeholder="Paste modified text here..."
            className="flex-1 w-full resize-none rounded-lg bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:bg-slate-950 dark:text-slate-300"
            spellCheck={false}
          />
        </div>

        {/* Diff Output */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
          <label className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Differences
          </label>
          <div className="flex-1 overflow-auto rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            {diff.length > 0 ? (
              <pre className="text-xs font-mono leading-relaxed">
                {diff.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "px-2 -mx-2",
                      line.type === "add" && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
                      line.type === "remove" && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
                      line.type === "same" && "text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <span className="select-none opacity-50 mr-2">
                      {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                    </span>
                    {line.text || " "}
                  </div>
                ))}
              </pre>
            ) : (
              <p className="text-xs text-slate-400">
                // Differences will appear here
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
