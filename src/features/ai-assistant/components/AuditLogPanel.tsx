/**
 * File: src/features/ai-assistant/components/AuditLogPanel.tsx
 *
 * Frontend: Audit Log Panel for viewing and managing audit logs.
 * Displays operation logs with filtering, search, and export capabilities.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Wrench,
  Send,
  MessageSquare,
  Shield,
  Settings,
  User,
  AlertCircle,
  Lock,
  X,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  Bug,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  auditLogger,
  formatDuration,
  formatLogTimestamp,
  getLogLevelColor,
} from "../utils/auditLogger";
import type {
  AuditLogEntry,
  AuditLogLevel,
  AuditLogCategory,
  AuditLogFilter,
  AuditLogStats,
  AuditLogExportFormat,
} from "../types";

/**
 * Props for the AuditLogPanel component.
 */
interface AuditLogPanelProps {
  onClose?: () => void;
  compact?: boolean;
}

/**
 * Audit Log Panel Component
 * Displays comprehensive audit logs with filtering and export.
 */
export const AuditLogPanel = ({
  onClose,
  compact = false,
}: AuditLogPanelProps) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState("");
  const [levelFilter, setLevelFilter] = useState<AuditLogLevel | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<
    AuditLogCategory | "all"
  >("all");
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load logs and subscribe to changes
  useEffect(() => {
    const loadLogs = async () => {
      await auditLogger.initialize();
      setLogs(auditLogger.getRecentLogs(100));
      setStats(auditLogger.getStats());
    };

    loadLogs();

    // Subscribe to new log entries
    const unsubscribe = auditLogger.addListener((entry, newStats) => {
      setLogs((prev) => [entry, ...prev].slice(0, 100));
      setStats(newStats);
    });

    return () => unsubscribe();
  }, []);

  // Filter logs based on current filters
  const filteredLogs = useMemo(() => {
    const filter: AuditLogFilter = {
      searchText: searchText || undefined,
      minLevel: levelFilter !== "all" ? levelFilter : undefined,
      categories: categoryFilter !== "all" ? [categoryFilter] : undefined,
      success: showOnlyErrors ? false : undefined,
    };
    return auditLogger.getFilteredLogs(filter).slice(0, 100);
  }, [logs, searchText, levelFilter, categoryFilter, showOnlyErrors]);

  // Toggle expanded state for a log entry
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Handle export
  const handleExport = useCallback(async (format: AuditLogExportFormat) => {
    setIsExporting(true);
    try {
      const exportData = auditLogger.exportLogs(format);

      // Create download
      const blob = new Blob([exportData.data], {
        type: format === "json" ? "application/json" : "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${
        new Date().toISOString().split("T")[0]
      }.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Handle clear logs
  const handleClearLogs = useCallback(() => {
    auditLogger.clearLogs();
    setLogs([]);
    setStats(auditLogger.getStats());
    setShowClearConfirm(false);
  }, []);

  // Get icon for log category
  const getCategoryIcon = (category: AuditLogCategory) => {
    switch (category) {
      case "tool_execution":
        return <Wrench className="h-4 w-4" />;
      case "file_operation":
        return <FileText className="h-4 w-4" />;
      case "ai_request":
        return <Send className="h-4 w-4" />;
      case "ai_response":
        return <MessageSquare className="h-4 w-4" />;
      case "permission":
        return <Shield className="h-4 w-4" />;
      case "settings":
        return <Settings className="h-4 w-4" />;
      case "session":
        return <User className="h-4 w-4" />;
      case "error":
        return <AlertCircle className="h-4 w-4" />;
      case "security":
        return <Lock className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  // Get icon for log level
  const getLevelIcon = (level: AuditLogLevel) => {
    switch (level) {
      case "debug":
        return <Bug className="h-3.5 w-3.5 text-gray-500" />;
      case "info":
        return <Info className="h-3.5 w-3.5 text-blue-500" />;
      case "warn":
        return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "critical":
        return <Zap className="h-3.5 w-3.5 text-red-700" />;
    }
  };

  // Get badge variant for level
  const getLevelBadge = (level: AuditLogLevel) => {
    const colors: Record<AuditLogLevel, string> = {
      debug: "bg-gray-100 text-gray-700 border-gray-300",
      info: "bg-blue-100 text-blue-700 border-blue-300",
      warn: "bg-yellow-100 text-yellow-700 border-yellow-300",
      error: "bg-red-100 text-red-700 border-red-300",
      critical: "bg-red-200 text-red-800 border-red-500",
    };
    return (
      <Badge variant="outline" className={cn("text-xs", colors[level])}>
        {getLevelIcon(level)}
        <span className="ml-1">{level}</span>
      </Badge>
    );
  };

  // Compact view for embedding
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Activity</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {stats?.totalEntries || 0} logs
          </Badge>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No activity recorded yet
          </p>
        ) : (
          <div className="space-y-1">
            {filteredLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md text-xs",
                  log.success
                    ? "bg-slate-50 dark:bg-slate-800/50"
                    : "bg-red-50 dark:bg-red-900/20",
                )}
              >
                {getCategoryIcon(log.category)}
                <span className="flex-1 truncate">{log.message}</span>
                <span className="text-muted-foreground">
                  {formatLogTimestamp(log.timestamp).split(" ")[1]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full panel view
  return (
    <div className="w-96 border-l border-slate-200/50 dark:border-slate-800/50 flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      <Card className="rounded-none border-0 border-b h-full flex flex-col">
        <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <CardDescription>
              {stats?.totalEntries || 0} entries •{" "}
              {stats?.successRate?.toFixed(0) || 100}% success
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col p-4">
          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">
                  {stats.byLevel.info}
                </div>
                <div className="text-xs text-muted-foreground">Info</div>
              </div>
              <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-lg font-semibold text-yellow-600">
                  {stats.byLevel.warn}
                </div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-lg font-semibold text-red-600">
                  {stats.errorCount}
                </div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
              <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-lg font-semibold text-green-600">
                  {stats.avgDuration ? formatDuration(stats.avgDuration) : "-"}
                </div>
                <div className="text-xs text-muted-foreground">Avg Time</div>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={levelFilter}
                onValueChange={(v) => setLevelFilter(v as any)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as any)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="tool_execution">Tool Execution</SelectItem>
                  <SelectItem value="file_operation">File Operation</SelectItem>
                  <SelectItem value="ai_request">AI Request</SelectItem>
                  <SelectItem value="ai_response">AI Response</SelectItem>
                  <SelectItem value="permission">Permission</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                  <SelectItem value="session">Session</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-errors"
                  checked={showOnlyErrors}
                  onCheckedChange={setShowOnlyErrors}
                />
                <Label htmlFor="show-errors" className="text-sm">
                  Errors only
                </Label>
              </div>
              <div className="text-sm text-muted-foreground">
                {filteredLogs.length} entries
              </div>
            </div>
          </div>

          <Separator className="mb-4" />

          {/* Log List */}
          <ScrollArea className="flex-1">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No logs match your filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      log.success
                        ? "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                        : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
                    )}
                  >
                    {/* Log Header */}
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => toggleExpanded(log.id)}
                    >
                      <button className="p-0.5">
                        {expandedItems.has(log.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <span className={cn("", getLogLevelColor(log.level))}>
                        {getCategoryIcon(log.category)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {log.message}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatLogTimestamp(log.timestamp)}
                          {log.duration && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(log.duration)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {getLevelBadge(log.level)}
                    </div>

                    {/* Expanded Details */}
                    {expandedItems.has(log.id) && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground">
                              Category:
                            </span>{" "}
                            <span className="font-medium">{log.category}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Action:
                            </span>{" "}
                            <span className="font-medium">{log.action}</span>
                          </div>
                        </div>

                        {log.toolName && (
                          <div>
                            <span className="text-muted-foreground">Tool:</span>{" "}
                            <span className="font-medium">{log.toolName}</span>
                          </div>
                        )}

                        {log.fileCount !== undefined && (
                          <div>
                            <span className="text-muted-foreground">
                              Files:
                            </span>{" "}
                            <span className="font-medium">{log.fileCount}</span>
                          </div>
                        )}

                        {log.error && (
                          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded text-red-700 dark:text-red-300">
                            <span className="font-medium">Error:</span>{" "}
                            {log.error}
                          </div>
                        )}

                        {log.affectedFiles && log.affectedFiles.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">
                              Files:
                            </span>
                            <div className="mt-1 space-y-1">
                              {log.affectedFiles
                                .slice(0, 3)
                                .map((file, idx) => (
                                  <div
                                    key={idx}
                                    className="text-muted-foreground truncate pl-2"
                                  >
                                    • {file.split("/").pop()}
                                  </div>
                                ))}
                              {log.affectedFiles.length > 3 && (
                                <div className="text-muted-foreground pl-2">
                                  ... and {log.affectedFiles.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="text-muted-foreground">
                          ID: {log.id}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Actions */}
          <Separator className="my-4" />

          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleExport("json")}
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    JSON
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export as JSON</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleExport("csv")}
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export as CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearConfirm(true)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear all logs</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 m-4 max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Clear Audit Logs?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete all {stats?.totalEntries || 0} log
              entries. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleClearLogs}>
                Clear Logs
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact audit log status bar for embedding.
 */
export const AuditLogStatus = () => {
  const [stats, setStats] = useState<AuditLogStats | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      await auditLogger.initialize();
      setStats(auditLogger.getStats());
    };
    loadStats();

    const unsubscribe = auditLogger.addListener((_, newStats) => {
      setStats(newStats);
    });

    return () => unsubscribe();
  }, []);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <FileText className="h-3 w-3" />
        {stats.totalEntries} logs
      </span>
      {stats.errorCount > 0 && (
        <span className="flex items-center gap-1 text-red-500">
          <AlertCircle className="h-3 w-3" />
          {stats.errorCount} errors
        </span>
      )}
      <span className="flex items-center gap-1 text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        {stats.successRate.toFixed(0)}%
      </span>
    </div>
  );
};
