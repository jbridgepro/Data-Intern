
import React, { useState, useEffect } from "react";
import { Key, AlertTriangle, CheckCircle, Copy } from "lucide-react";

export const JwtDecoder: React.FC = () => {
  const [token, setToken] = useState("");
  const [header, setHeader] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    decodeJwt();
  }, [token]);

  const decodeJwt = () => {
    if (!token.trim()) {
      setHeader(null);
      setPayload(null);
      setError(null);
      return;
    }

    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT token format (must have 3 parts)");
      }

      const decode = (str: string) => {
        try {
          // Replace URL-safe chars
          const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );
          return JSON.stringify(JSON.parse(jsonPayload), null, 2);
        } catch (e) {
          throw new Error("Failed to decode Base64 string");
        }
      };

      const decodedHeader = decode(parts[0]);
      const decodedPayload = decode(parts[1]);

      setHeader(decodedHeader);
      setPayload(decodedPayload);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setHeader(null);
      setPayload(null);
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
          <Key className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            JWT Decoder
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Decode and inspect JSON Web Tokens
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-0">
        {/* Input Column */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col">
            <label className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Encoded Token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your JWT here (e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
              className="flex-1 w-full resize-none rounded-lg bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-950 dark:text-slate-300 break-all"
              spellCheck={false}
            />
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {!error && header && (
               <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                 <CheckCircle className="h-4 w-4 shrink-0" />
                 <span>Token Decoded</span>
               </div>
            )}
          </div>
        </div>

        {/* Output Column */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Header */}
          <div className="flex-[0.4] rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col min-h-0">
            <label className="mb-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Header
            </label>
            <div className="flex-1 overflow-auto rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <pre className="text-xs font-mono text-slate-700 dark:text-slate-300">
                {header || "// Header will appear here"}
              </pre>
            </div>
          </div>

          {/* Payload */}
          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col min-h-0">
            <label className="mb-2 text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Payload
            </label>
            <div className="flex-1 overflow-auto rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <pre className="text-xs font-mono text-slate-700 dark:text-slate-300">
                {payload || "// Payload will appear here"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
