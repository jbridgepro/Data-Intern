/**
 * File path: src/features/sql-export-wizard/components/SavedConnectionsDialog.tsx
 *
 * Frontend component for managing saved database connections
 * Lists, edits, deletes, and duplicates connections
 */

import { useState } from "react";
import {
  X,
  Edit,
  Trash2,
  Copy,
  Plus,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { DatabaseConnection } from "../types";
import {
  getConnections,
  deleteConnection,
  saveConnection,
} from "../utils/storage";
import { Button } from "@/components/ui/button";
import { ConnectionDialog } from "./ConnectionDialog";
import { cn } from "@/lib/utils";

interface SavedConnectionsDialogProps {
  onClose: () => void;
  onConnectionSelect: (connection: DatabaseConnection) => void;
  onConnectionsUpdated?: () => void;
}

export function SavedConnectionsDialog({
  onClose,
  onConnectionSelect,
  onConnectionsUpdated,
}: SavedConnectionsDialogProps) {
  const [connections, setConnections] =
    useState<DatabaseConnection[]>(getConnections());
  const [editingConnection, setEditingConnection] =
    useState<DatabaseConnection | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);

  const handleDelete = (connectionId: string) => {
    if (confirm("Are you sure you want to delete this connection?")) {
      deleteConnection(connectionId);
      setConnections(getConnections());
      onConnectionsUpdated?.();
    }
  };

  const handleDuplicate = (connection: DatabaseConnection) => {
    const duplicated: DatabaseConnection = {
      ...connection,
      id: `conn-${Date.now()}`,
      name: `${connection.name} (Copy)`,
      isActive: false,
    };
    saveConnection(duplicated);
    setConnections(getConnections());
    onConnectionsUpdated?.();
  };

  const handleEdit = (connection: DatabaseConnection) => {
    setEditingConnection(connection);
    setShowConnectionDialog(true);
  };

  const handleConnectionSaved = () => {
    setConnections(getConnections());
    setShowConnectionDialog(false);
    setEditingConnection(null);
    onConnectionsUpdated?.();
  };

  const getStatusIcon = (connection: DatabaseConnection) => {
    return connection.isActive ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
    ) : (
      <Circle className="h-4 w-4 text-slate-400" />
    );
  };

  const formatLastConnected = (date?: Date) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              📚 SAVED CONNECTIONS
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Connections List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {connections.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <p className="mb-4">No saved connections</p>
                <Button onClick={() => setShowConnectionDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Connection
                </Button>
              </div>
            ) : (
              connections.map((conn) => (
                <div
                  key={conn.id}
                  className={cn(
                    "border rounded-lg p-4 space-y-2",
                    conn.isActive
                      ? "border-green-500 dark:border-green-400 bg-green-50/50 dark:bg-green-900/10"
                      : "border-slate-200 dark:border-slate-800",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(conn)}
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {conn.name}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {conn.server}
                          {conn.instance && `\\${conn.instance}`}
                          {conn.port && `:${conn.port}`}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          {conn.serverType === "mssql" && "SQL Server 2022"}
                          {conn.serverType === "azure-sql" &&
                            "Azure SQL Database"}
                          {conn.serverType === "mysql" && "MySQL / MariaDB"}
                          {conn.serverType === "postgresql" && "PostgreSQL"}
                          {conn.serverType === "sqlite" && "SQLite"}
                          {conn.lastConnected &&
                            ` • Last connected: ${formatLastConnected(conn.lastConnected)}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onConnectionSelect(conn)}
                      className="flex-1"
                    >
                      Connect
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(conn)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(conn)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(conn.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-800">
            <Button onClick={() => setShowConnectionDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Connection
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Connection Dialog for Editing */}
      {showConnectionDialog && (
        <ConnectionDialog
          connection={editingConnection}
          onSave={handleConnectionSaved}
          onClose={() => {
            setShowConnectionDialog(false);
            setEditingConnection(null);
          }}
        />
      )}
    </>
  );
}
