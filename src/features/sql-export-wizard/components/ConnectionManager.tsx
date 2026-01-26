/**
 * File path: src/features/sql-export-wizard/components/ConnectionManager.tsx
 *
 * Frontend component for managing database connections
 * Handles connection selection, testing, and management
 */

import { useState, useEffect } from "react";
import {
  Database,
  Settings,
  TestTube,
  Plus,
  Edit,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DatabaseConnection } from "../types";
import { testConnection } from "../utils/databaseConnection";
import { getConnections } from "../utils/storage";
import { Button } from "@/components/ui/button";
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
      text: "🟢 Connected",
      color: "text-green-600 dark:text-green-400",
    };
  };

  const status = getConnectionStatus();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Database className="h-4 w-4" />
          CONNECTION MANAGER
        </h3>
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
            Test
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Active Connection Selector */}
        <div className="flex items-center gap-2">
          <Select
            value={activeConnection?.id || ""}
            onValueChange={(value) => {
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
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                Status:
              </span>
              <span className={cn("font-medium", status.color)}>
                {status.text}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                Server:
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
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
              "text-xs p-2 rounded flex items-center gap-2",
              testResult.success
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
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
