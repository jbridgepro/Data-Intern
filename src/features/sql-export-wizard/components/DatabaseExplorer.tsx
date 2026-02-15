/**
 * File path: src/features/sql-export-wizard/components/DatabaseExplorer.tsx
 *
 * Frontend component for exploring database structure
 * Tree view of databases, tables, views, procedures, and functions
 */

import { useState } from "react";
import {
  Database,
  Table,
  Eye,
  Zap,
  Code2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  Search,
} from "lucide-react";
import { DatabaseConnection } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DatabaseExplorerProps {
  connection: DatabaseConnection | null;
  selectedDatabase?: string;
  selectedTable?: { schema: string; name: string } | null;
  onTableSelect?: (table: { schema: string; name: string; rowCount?: number; size?: number; lastUpdated?: string }) => void;
  onViewSelect?: (view: { schema: string; name: string }) => void;
}

interface TreeNode {
  id: string;
  label: string;
  type: "database" | "schema" | "table" | "view" | "procedure" | "function";
  icon: React.ReactNode;
  children?: TreeNode[];
  metadata?: {
    rowCount?: number;
    size?: number;
    lastUpdated?: string;
  };
  expanded?: boolean;
}

export function DatabaseExplorer({
  connection,
  selectedDatabase,
  selectedTable,
  onTableSelect,
  onViewSelect,
}: DatabaseExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Mock data - in production, this would come from the database
  const mockDatabases: TreeNode[] = [
    {
      id: "db-production",
      label: "Production",
      type: "database",
      icon: <Database className="h-4 w-4" />,
      expanded: expandedNodes.has("db-production"),
      children: [
        {
          id: "schema-dbo",
          label: "dbo",
          type: "schema",
          icon: <Database className="h-4 w-4" />,
          children: [
            {
              id: "table-users",
              label: "Users",
              type: "table",
              icon: <Table className="h-4 w-4" />,
              metadata: {
                rowCount: 5247,
                size: 2300000,
                lastUpdated: "2026-01-29T16:24:00Z",
              },
            },
            {
              id: "table-orders",
              label: "Orders",
              type: "table",
              icon: <Table className="h-4 w-4" />,
              metadata: {
                rowCount: 12891,
                size: 15700000,
                lastUpdated: "2026-02-02T11:08:00Z",
              },
            },
            {
              id: "table-products",
              label: "Products",
              type: "table",
              icon: <Table className="h-4 w-4" />,
              metadata: {
                rowCount: 1456,
                size: 890000,
                lastUpdated: "2026-01-25T08:55:00Z",
              },
            },
          ],
        },
        {
          id: "views",
          label: "Views (23)",
          type: "view",
          icon: <Eye className="h-4 w-4" />,
          children: [
            {
              id: "view-active-users",
              label: "vw_ActiveUsers",
              type: "view",
              icon: <Eye className="h-4 w-4" />,
            },
            {
              id: "view-monthly-sales",
              label: "vw_MonthlySales",
              type: "view",
              icon: <Eye className="h-4 w-4" />,
            },
          ],
        },
        {
          id: "procedures",
          label: "Stored Procedures (45)",
          type: "procedure",
          icon: <Zap className="h-4 w-4" />,
          children: [
            {
              id: "proc-get-orders",
              label: "sp_GetUserOrders",
              type: "procedure",
              icon: <Zap className="h-4 w-4" />,
            },
          ],
        },
        {
          id: "functions",
          label: "Functions (12)",
          type: "function",
          icon: <Code2 className="h-4 w-4" />,
        },
      ],
    },
    {
      id: "db-analytics",
      label: "Analytics",
      type: "database",
      icon: <Database className="h-4 w-4" />,
      expanded: expandedNodes.has("db-analytics"),
      children: [],
    },
  ];

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderTreeNode = (
    node: TreeNode,
    level: number = 0,
  ): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const indent = level * 16;

    // Filter based on search query
    if (
      searchQuery &&
      !node.label.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      // Check if any children match
      if (hasChildren) {
        const matchingChildren = node.children!.filter((child) =>
          child.label.toLowerCase().includes(searchQuery.toLowerCase()),
        );
        if (matchingChildren.length === 0) return null;
      } else {
        return null;
      }
    }

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 rounded-lg border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer group transition-colors",
            level === 0 && "font-medium",
            node.type === "table" &&
              selectedTable?.name === node.label &&
              "border-sky-200 bg-sky-50/80 dark:border-sky-900/40 dark:bg-sky-900/20",
            /* Dynamic left padding for tree indent; uses arbitrary value to satisfy no-inline-styles */
            `pl-[${8 + indent}px] pr-2`,
          )}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            } else if (node.type === "table" && onTableSelect) {
              onTableSelect({
                schema: "dbo",
                name: node.label,
                rowCount: node.metadata?.rowCount,
                size: node.metadata?.size,
                lastUpdated: node.metadata?.lastUpdated,
              });
            } else if (node.type === "view" && onViewSelect) {
              onViewSelect({ schema: "dbo", name: node.label });
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-slate-400" />
            ) : (
              <ChevronRight className="h-3 w-3 text-slate-400" />
            )
          ) : (
            <div className="w-3" />
          )}
          <span className="text-slate-500 dark:text-slate-400">
            {node.icon}
          </span>
          <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
            {node.label}
          </span>
          {node.metadata && (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              {node.metadata.rowCount !== undefined && (
                <span>{node.metadata.rowCount.toLocaleString()} rows</span>
              )}
              {node.metadata.size !== undefined && (
                <span>• {formatFileSize(node.metadata.size)}</span>
              )}
            </div>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!connection) {
    return (
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 p-4 shadow-sm">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
          Connect to a database to explore its structure
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Database Explorer
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedDatabase ? `Browsing ${selectedDatabase}` : "Choose a database to begin"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <Input
            placeholder="Search databases/tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {mockDatabases.map((db) => renderTreeNode(db))}
      </div>
    </div>
  );
}
