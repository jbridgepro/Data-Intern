/**
 * File path: src/features/sql-export-wizard/components/ConnectionManager.tsx
 *
 * Frontend component for managing database connections
 * Handles connection selection, testing, and management
 */

import { useState, useEffect } from "react";
import { Database, TestTube, Plus, CheckCircle2, XCircle } from "lucide-react";
import { DatabaseConnection } from "../types";
import { testConnection } from "../utils/databaseConnection";
import { getConnections } from "../utils/storage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConnectionDialog } from "./ConnectionDialog";
import { SavedConnectionsDialog } from "./SavedConnectionsDialog";
import { cn } from "@/lib/utils";

interface ConnectionManagerProps {
  activeConnection: DatabaseConnection | null;
  onConnectionChange: (connection: DatabaseConnection | null) => void;
  onDatabaseChange?: (database: string) => void;
}

export function ConnectionManager({
  activeConnection,
  onConnectionChange,
  onDatabaseChange,
}: ConnectionManagerProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showSavedConnections, setShowSavedConnections] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = () => {
    const savedConnections = getConnections();
    setConnections(savedConnections);

    // Auto-connect to last active connection if available
    const lastActive = savedConnections.find((c) => c.isActive);
    if (lastActive && !activeConnection) {
      onConnectionChange(lastActive);
      setSelectedDatabase(
        lastActive.database || lastActive.defaultDatabase || "",
      );
    }
  };

  const handleTestConnection = async () => {
    if (!activeConnection) return;

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(activeConnection);
      setTestResult({
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message:
          error instanceof Error ? error.message : "Connection test failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnectionSaved = () => {
    loadConnections();
    setShowConnectionDialog(false);
  };

  const handleDatabaseChange = (database: string) => {
    setSelectedDatabase(database);
    onDatabaseChange?.(database);
  };

  const getConnectionStatus = () => {
    if (!activeConnection)
      return { text: "Not Connected", color: "text-slate-500" };
    return {
      text: "Connected",
      color: "text-emerald-700 dark:text-emerald-300",
    };
  };

  const status = getConnectionStatus();

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Connection Manager
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage and test secure database connections.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSavedConnections(true)}
            className="h-8"
          >
            Manage
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={!activeConnection || testing}
            className="h-8"
          >
            <TestTube className="h-3 w-3 mr-1" />
            {testing ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Active Connection Selector */}
        <div className="flex items-center gap-2">
          <Select
            value={activeConnection?.id || ""}
            onValueChange={(value) => {
              if (value === "__new__") {
                setShowConnectionDialog(true);
                return;
              }
              const conn = connections.find((c) => c.id === value);
              onConnectionChange(conn || null);
              setSelectedDatabase(
                conn?.database || conn?.defaultDatabase || "",
              );
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a connection" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((conn) => (
                <SelectItem key={conn.id} value={conn.id}>
                  {conn.name}
                </SelectItem>
              ))}
              <SelectItem
                value="__new__"
                className="text-blue-600 dark:text-blue-400"
              >
                <Plus className="h-3 w-3 inline mr-1" />
                New Connection
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConnectionDialog(true)}
            className="h-9"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Connection Status */}
        {activeConnection && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge
              variant="outline"
              className={cn(
                "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200",
                status.color,
              )}
            >
              {status.text}
            </Badge>
            <div className="text-slate-500 dark:text-slate-400">
              Server:
              <span className="ml-1 font-medium text-slate-700 dark:text-slate-300">
                {activeConnection.server}
                {activeConnection.instance && `\\${activeConnection.instance}`}
              </span>
            </div>
          </div>
        )}

        {/* Database Selector */}
        {activeConnection && (
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
              Database:
            </label>
            <Select
              value={selectedDatabase}
              onValueChange={handleDatabaseChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Database" />
              </SelectTrigger>
              <SelectContent>
                {/* In a real implementation, this would fetch databases from the server */}
                <SelectItem value="master">master</SelectItem>
                <SelectItem value="Production">Production</SelectItem>
                <SelectItem value="Analytics">Analytics</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div
            className={cn(
              "text-xs p-2 rounded-lg flex items-center gap-2 border",
              testResult.success
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/40 dark:text-emerald-200"
                : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-200",
            )}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Connection Dialog */}
      {showConnectionDialog && (
        <ConnectionDialog
          connection={null}
          onSave={handleConnectionSaved}
          onClose={() => setShowConnectionDialog(false)}
        />
      )}

      {/* Saved Connections Dialog */}
      {showSavedConnections && (
        <SavedConnectionsDialog
          onClose={() => setShowSavedConnections(false)}
          onConnectionSelect={(conn) => {
            onConnectionChange(conn);
            setSelectedDatabase(conn.database || conn.defaultDatabase || "");
            setShowSavedConnections(false);
          }}
          onConnectionsUpdated={loadConnections}
        />
      )}
    </div>
  );
}
