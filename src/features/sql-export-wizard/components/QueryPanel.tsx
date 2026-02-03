/**
 * File path: src/features/sql-export-wizard/components/QueryPanel.tsx
 *
 * Frontend component for SQL query execution
 * Provides SQL editor and query results display
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  FileText,
  Code2,
  Sparkles,
  Layers,
  Braces,
  AlertTriangle,
  CheckCircle2,
  GripVertical,
  RefreshCw,
  Database,
} from "lucide-react";
import { DatabaseConnection } from "../types";
import { Button } from "@/components/ui/button";
import { ResultsGrid } from "./ResultsGrid";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  fetchDatabaseSchema,
  generateSqlFromNaturalLanguage,
  type SqlAiBlocks,
  type SqlAiResponse,
} from "../utils/sqlAiService";

interface QueryPanelProps {
  connection: DatabaseConnection | null;
  selectedDatabase?: string;
}

type SqlDialect = "postgresql" | "mysql" | "sqlserver" | "sqlite";

type JoinBlock = {
  id: string;
  type: "INNER" | "LEFT" | "RIGHT" | "FULL";
  table: string;
  on: string;
};

type WhereBlock = {
  id: string;
  field: string;
  operator: "=" | "!=" | "<" | "<=" | ">" | ">=" | "LIKE" | "IN";
  value: string;
  logic: "AND" | "OR";
};

type OrderBlock = {
  id: string;
  field: string;
  direction: "ASC" | "DESC";
};

type QueryBlocks = {
  distinct: boolean;
  select: string[];
  from: string;
  joins: JoinBlock[];
  where: WhereBlock[];
  groupBy: string[];
  having: string;
  orderBy: OrderBlock[];
  limit: string;
};

type ValidationIssue = {
  id: string;
  level: "error" | "warning";
  message: string;
  field?: keyof QueryBlocks | "nl";
};

type BlockId =
  | "select"
  | "from"
  | "scope"
  | "join"
  | "where"
  | "group"
  | "order";

type RowListId = "joins" | "where" | "orderBy";

type RowDragTarget = {
  list: RowListId;
  id: string;
} | null;

const DIALECT_LABELS: Record<SqlDialect, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlserver: "SQL Server",
  sqlite: "SQLite",
};

const DEFAULT_BLOCKS: QueryBlocks = {
  distinct: false,
  select: ["u.UserID", "u.Username", "o.OrderID", "o.TotalAmount"],
  from: "Users u",
  joins: [
    {
      id: "join-1",
      type: "INNER",
      table: "Orders o",
      on: "u.UserID = o.UserID",
    },
  ],
  where: [
    {
      id: "where-1",
      field: "o.OrderDate",
      operator: ">=",
      value: "2024-01-01",
      logic: "AND",
    },
    {
      id: "where-2",
      field: "o.TotalAmount",
      operator: ">",
      value: "100",
      logic: "AND",
    },
  ],
  groupBy: [],
  having: "",
  orderBy: [
    { id: "order-1", field: "o.OrderDate", direction: "DESC" },
  ],
  limit: "250",
};

const uniqueList = (items: string[]) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const sanitizeIdentifierList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizeValueLiteral = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("'") || trimmed.startsWith('"')) return trimmed;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^\(.+\)$/.test(trimmed)) return trimmed;
  return `'${trimmed.replace(/'/g, "''")}'`;
};

const formatSql = (blocks: QueryBlocks, dialect: SqlDialect) => {
  const issues: ValidationIssue[] = [];

  if (!blocks.from.trim()) {
    issues.push({
      id: "from-required",
      level: "error",
      message: "FROM is required to generate a query.",
      field: "from",
    });
  }

  const selectFields = blocks.select.length
    ? uniqueList(blocks.select)
    : ["*"];
  if (blocks.select.length === 0) {
    issues.push({
      id: "select-empty",
      level: "warning",
      message: "Select at least one column. Using * as fallback.",
      field: "select",
    });
  }

  blocks.joins.forEach((join) => {
    if (!join.table.trim() || !join.on.trim()) {
      issues.push({
        id: `join-${join.id}`,
        level: "error",
        message: "Each JOIN needs a table and an ON condition.",
        field: "joins",
      });
    }
  });

  blocks.where.forEach((condition) => {
    if (!condition.field.trim() || !condition.value.trim()) {
      issues.push({
        id: `where-${condition.id}`,
        level: "warning",
        message: "Complete each WHERE condition to include it.",
        field: "where",
      });
    }
  });

  blocks.orderBy.forEach((order) => {
    if (!order.field.trim()) {
      issues.push({
        id: `order-${order.id}`,
        level: "warning",
        message: "Order by entries need a column.",
        field: "orderBy",
      });
    }
  });

  if (blocks.limit && !/^\d+$/.test(blocks.limit.trim())) {
    issues.push({
      id: "limit-invalid",
      level: "error",
      message: "Limit must be a whole number.",
      field: "limit",
    });
  }

  const selectKeyword = blocks.distinct ? "SELECT DISTINCT" : "SELECT";
  const topClause =
    dialect === "sqlserver" && blocks.limit
      ? ` TOP (${blocks.limit.trim()})`
      : "";
  const selectLine = `${selectKeyword}${topClause} ${selectFields.join(", ")}`;

  const lines: string[] = [selectLine];
  if (blocks.from.trim()) {
    lines.push(`FROM ${blocks.from.trim()}`);
  }

  const joinLines = blocks.joins
    .filter((join) => join.table.trim() && join.on.trim())
    .map(
      (join) =>
        `${join.type} JOIN ${join.table.trim()} ON ${join.on.trim()}`,
    );
  lines.push(...joinLines);

  const whereLines = blocks.where.filter(
    (condition) => condition.field.trim() && condition.value.trim(),
  );
  if (whereLines.length) {
    const clause = whereLines
      .map((condition, index) => {
        const valueLiteral = normalizeValueLiteral(condition.value);
        const statement = `${condition.field.trim()} ${
          condition.operator
        } ${valueLiteral}`;
        if (index === 0) return statement;
        return `${condition.logic} ${statement}`;
      })
      .join(" ");
    lines.push(`WHERE ${clause}`);
  }

  const groupFields = uniqueList(blocks.groupBy);
  if (groupFields.length) {
    lines.push(`GROUP BY ${groupFields.join(", ")}`);
  }

  if (blocks.having.trim()) {
    lines.push(`HAVING ${blocks.having.trim()}`);
  }

  const orderFields = blocks.orderBy
    .filter((order) => order.field.trim())
    .map((order) => `${order.field.trim()} ${order.direction}`);
  if (orderFields.length) {
    lines.push(`ORDER BY ${orderFields.join(", ")}`);
  }

  if (
    dialect !== "sqlserver" &&
    blocks.limit.trim() &&
    /^\d+$/.test(blocks.limit.trim())
  ) {
    lines.push(`LIMIT ${blocks.limit.trim()}`);
  }

  const sql = `${lines.join("\n")};`;
  return { sql, issues };
};

const blocksToNaturalLanguage = (blocks: QueryBlocks) => {
  const parts: string[] = [];
  if (blocks.distinct) parts.push("Select distinct");
  else parts.push("Select");

  parts.push(
    blocks.select.length ? blocks.select.join(", ") : "all columns",
  );

  if (blocks.from.trim()) {
    parts.push(`from ${blocks.from.trim()}`);
  }

  blocks.joins.forEach((join) => {
    if (join.table.trim() && join.on.trim()) {
      parts.push(
        `${join.type.toLowerCase()} join ${join.table.trim()} on ${join.on.trim()}`,
      );
    }
  });

  const whereClauses = blocks.where.filter(
    (condition) => condition.field.trim() && condition.value.trim(),
  );
  if (whereClauses.length) {
    const clause = whereClauses
      .map((condition, index) => {
        const statement = `${condition.field.trim()} ${
          condition.operator
        } ${condition.value.trim()}`;
        if (index === 0) return statement;
        return `${condition.logic.toLowerCase()} ${statement}`;
      })
      .join(" ");
    parts.push(`where ${clause}`);
  }

  if (blocks.groupBy.length) {
    parts.push(`grouped by ${blocks.groupBy.join(", ")}`);
  }

  if (blocks.having.trim()) {
    parts.push(`having ${blocks.having.trim()}`);
  }

  if (blocks.orderBy.length) {
    const orderText = blocks.orderBy
      .filter((order) => order.field.trim())
      .map(
        (order) =>
          `${order.field.trim()} ${order.direction.toLowerCase()}`,
      )
      .join(", ");
    if (orderText) parts.push(`ordered by ${orderText}`);
  }

  if (blocks.limit.trim()) {
    parts.push(`limit ${blocks.limit.trim()}`);
  }

  return `${parts.join(" ")}.`;
};

const parseNaturalLanguage = (input: string): {
  blocks: QueryBlocks;
  issues: ValidationIssue[];
} => {
  const issues: ValidationIssue[] = [];
  const text = input.trim();
  if (!text) {
    return { blocks: DEFAULT_BLOCKS, issues };
  }

  const lower = text.toLowerCase();
  const blocks: QueryBlocks = {
    distinct: lower.includes("distinct"),
    select: [],
    from: "",
    joins: [],
    where: [],
    groupBy: [],
    having: "",
    orderBy: [],
    limit: "",
  };

  const selectMatch = lower.match(
    /(?:select|show|list|find|get)\s+(.+?)(?:\s+from|\s+in\s+|\s+where|\s+group by|\s+order by|\s+limit|$)/,
  );
  if (selectMatch?.[1]) {
    const raw = selectMatch[1];
    if (raw.includes("count")) {
      blocks.select.push("COUNT(*) AS count");
    } else if (raw.includes("sum of")) {
      const sumMatch = raw.match(/sum of\s+([a-z0-9_.]+)/);
      if (sumMatch?.[1]) {
        blocks.select.push(`SUM(${sumMatch[1]}) AS sum_${sumMatch[1]}`);
      }
    } else if (raw.includes("average of") || raw.includes("avg of")) {
      const avgMatch = raw.match(/(?:average of|avg of)\s+([a-z0-9_.]+)/);
      if (avgMatch?.[1]) {
        blocks.select.push(`AVG(${avgMatch[1]}) AS avg_${avgMatch[1]}`);
      }
    } else {
      blocks.select = sanitizeIdentifierList(raw);
    }
  }

  const fromMatch = lower.match(
    /(?:from|in|using)\s+([a-z0-9_.]+)/,
  );
  if (fromMatch?.[1]) {
    blocks.from = fromMatch[1];
  } else {
    issues.push({
      id: "nl-missing-from",
      level: "error",
      message: "Couldn't find a table name. Try adding “from <table>”.",
      field: "nl",
    });
  }

  const joinRegex =
    /(inner join|left join|right join|full join|join)\s+([a-z0-9_.]+)\s+on\s+([^,;.]+?)(?=\s+(?:where|group by|order by|limit|join|$))/gi;
  let joinMatch;
  let joinIndex = 0;
  while ((joinMatch = joinRegex.exec(lower)) !== null) {
    const rawType = joinMatch[1];
    let type: JoinBlock["type"] = "INNER";
    if (rawType.includes("left")) type = "LEFT";
    if (rawType.includes("right")) type = "RIGHT";
    if (rawType.includes("full")) type = "FULL";
    blocks.joins.push({
      id: `nl-join-${joinIndex++}`,
      type,
      table: joinMatch[2],
      on: joinMatch[3],
    });
  }

  const whereMatch = lower.match(
    /where\s+(.+?)(?=\s+(group by|order by|limit|$))/,
  );
  if (whereMatch?.[1]) {
    const raw = whereMatch[1];
    const pieces = raw.split(/\s+(and|or)\s+/);
    let logic: "AND" | "OR" = "AND";
    let index = 0;
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i].trim();
      if (piece === "and" || piece === "or") {
        logic = piece.toUpperCase() as "AND" | "OR";
        continue;
      }
      const operatorMatch = piece.match(
        /([a-z0-9_.]+)\s*(=|!=|<=|>=|<|>|like|in|is)\s*(.+)/,
      );
      if (operatorMatch) {
        const operator =
          operatorMatch[2].toUpperCase() === "IS"
            ? "="
            : (operatorMatch[2].toUpperCase() as WhereBlock["operator"]);
        blocks.where.push({
          id: `nl-where-${index++}`,
          field: operatorMatch[1],
          operator,
          value: operatorMatch[3].replace(/['"]/g, ""),
          logic,
        });
      }
    }
  }

  const groupMatch = lower.match(/group by\s+(.+?)(?=\s+order by|\s+limit|$)/);
  if (groupMatch?.[1]) {
    blocks.groupBy = sanitizeIdentifierList(groupMatch[1]);
  }

  const havingMatch = lower.match(/having\s+(.+?)(?=\s+order by|\s+limit|$)/);
  if (havingMatch?.[1]) {
    blocks.having = havingMatch[1];
  }

  const orderMatch = lower.match(
    /order by\s+(.+?)(?=\s+limit|$)/,
  );
  if (orderMatch?.[1]) {
    const orderFields = sanitizeIdentifierList(orderMatch[1]);
    blocks.orderBy = orderFields.map((field, index) => {
      const lowered = field.toLowerCase();
      const direction = lowered.endsWith(" desc") ? "DESC" : "ASC";
      const cleanedField = field
        .replace(/\s+desc$/i, "")
        .replace(/\s+asc$/i, "")
        .trim();
      return {
        id: `nl-order-${index}`,
        field: cleanedField,
        direction,
      };
    });
  }

  const limitMatch = lower.match(/limit\s+(\d+)/);
  if (limitMatch?.[1]) {
    blocks.limit = limitMatch[1];
  }

  if (!blocks.select.length) {
    blocks.select = ["*"];
  }

  if (!blocks.from) {
    issues.push({
      id: "nl-fallback",
      level: "warning",
      message: "Using a generic table placeholder. Update FROM to continue.",
      field: "from",
    });
    blocks.from = "your_table";
  }

  return { blocks, issues };
};

export function QueryPanel({ connection, selectedDatabase }: QueryPanelProps) {
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [blocks, setBlocks] = useState<QueryBlocks>(DEFAULT_BLOCKS);
  const [naturalLanguage, setNaturalLanguage] = useState(
    "Show user IDs, usernames, order IDs, and totals from Users joined to Orders where order date is after 2024-01-01 and total amount is greater than 100, ordered by order date descending, limit 250.",
  );
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [useAiForNl, setUseAiForNl] = useState(true);
  const [nlIssues, setNlIssues] = useState<ValidationIssue[]>([]);
  const [aiResponse, setAiResponse] = useState<SqlAiResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [ollamaBaseUrl] = useState(() => {
    try {
      const saved = localStorage.getItem("ai-assistant-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.ollamaBaseUrl || "http://localhost:11434";
      }
    } catch {
      return "http://localhost:11434";
    }
    return "http://localhost:11434";
  });
  const [ollamaModel] = useState(() => {
    try {
      const saved = localStorage.getItem("ai-assistant-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.ollamaModel || parsed.model || "llama3.2:3b";
      }
    } catch {
      return "llama3.2:3b";
    }
    return "llama3.2:3b";
  });
  const [schemaTables, setSchemaTables] = useState<
    { name: string; schema: string; columns: { name: string }[] }[]
  >([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [tablesInScopeInput, setTablesInScopeInput] = useState("");
  const [blockOrder, setBlockOrder] = useState<BlockId[]>([
    "select",
    "from",
    "scope",
    "join",
    "where",
    "group",
    "order",
  ]);
  const [blockVisibility, setBlockVisibility] = useState<
    Record<BlockId, boolean>
  >({
    select: true,
    from: true,
    scope: true,
    join: true,
    where: true,
    group: true,
    order: true,
  });
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastSyncRef = useRef<"blocks" | "nl" | null>(null);
  const nlDebounceRef = useRef<number | null>(null);
  const aiRequestRef = useRef(0);
  const draggedBlockRef = useRef<BlockId | null>(null);
  const draggedRowRef = useRef<RowDragTarget>(null);

  const { sql, issues } = useMemo(
    () => formatSql(blocks, dialect),
    [blocks, dialect],
  );

  const hasBlockingErrors = issues.some((issue) => issue.level === "error");

  const tablesInScope = useMemo(
    () => sanitizeIdentifierList(tablesInScopeInput),
    [tablesInScopeInput],
  );

  const schemaTableOptions = useMemo(() => {
    return schemaTables.map((table) =>
      table.schema ? `${table.schema}.${table.name}` : table.name,
    );
  }, [schemaTables]);

  const schemaColumnOptions = useMemo(() => {
    const scoped = new Set(tablesInScope.map((t) => t.toLowerCase()));
    const options: string[] = [];
    schemaTables.forEach((table) => {
      const tableName = table.schema
        ? `${table.schema}.${table.name}`
        : table.name;
      const matchesScope =
        scoped.size === 0 ||
        scoped.has(table.name.toLowerCase()) ||
        scoped.has(tableName.toLowerCase());
      if (!matchesScope) return;
      table.columns.forEach((column) => {
        options.push(`${table.name}.${column.name}`);
        options.push(`${tableName}.${column.name}`);
        options.push(column.name);
      });
    });
    return uniqueList(options);
  }, [schemaTables, tablesInScope]);

  const applyAiBlocks = (aiBlocks: SqlAiBlocks) => {
    setBlocks({
      distinct: aiBlocks.distinct,
      select: aiBlocks.select || [],
      from: aiBlocks.from || "",
      joins: aiBlocks.joins || [],
      where: aiBlocks.where || [],
      groupBy: aiBlocks.groupBy || [],
      having: aiBlocks.having || "",
      orderBy: aiBlocks.orderBy || [],
      limit: aiBlocks.limit || "",
    });
  };

  const loadSchema = async () => {
    if (!connection) return;
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const response = await fetchDatabaseSchema(connection);
      setSchemaTables(response.tables || []);
    } catch (schemaErr) {
      setSchemaError(
        schemaErr instanceof Error
          ? schemaErr.message
          : "Failed to load schema.",
      );
      setSchemaTables([]);
    } finally {
      setSchemaLoading(false);
    }
  };

  const runAiGeneration = async (text: string, force: boolean = false) => {
    if (!text.trim()) return;
    if (!useAiForNl && !force) return;

    const requestId = ++aiRequestRef.current;
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await generateSqlFromNaturalLanguage({
        text,
        dialect,
        tablesInScope,
        availableTables: schemaTableOptions,
        availableColumns: schemaColumnOptions,
        baseUrl: ollamaBaseUrl,
        model: ollamaModel,
      });
      if (requestId !== aiRequestRef.current) return;
      setAiResponse(response);
      setNlIssues(
        (response.warnings || []).map((message, index) => ({
          id: `ai-warning-${index}`,
          level: "warning",
          message,
          field: "nl",
        })),
      );
      applyAiBlocks(response.blocks);
    } catch (aiErr) {
      if (requestId !== aiRequestRef.current) return;
      setAiError(
        aiErr instanceof Error ? aiErr.message : "AI generation failed.",
      );
      const parsed = parseNaturalLanguage(text);
      setBlocks(parsed.blocks);
      setNlIssues(parsed.issues);
    } finally {
      if (requestId === aiRequestRef.current) {
        setAiLoading(false);
      }
    }
  };

  const handleDragStart = (blockId: BlockId) => {
    draggedBlockRef.current = blockId;
  };

  const handleDrop = (targetId: BlockId) => {
    const sourceId = draggedBlockRef.current;
    if (!sourceId || sourceId === targetId) return;
    setBlockOrder((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(sourceId);
      const toIndex = next.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, sourceId);
      return next;
    });
    draggedBlockRef.current = null;
  };

  const handleRowDragStart = (list: RowListId, id: string) => {
    draggedRowRef.current = { list, id };
  };

  const handleRowDrop = (list: RowListId, targetId: string) => {
    const source = draggedRowRef.current;
    if (!source || source.list !== list || source.id === targetId) return;

    updateBlocks((prev) => {
      const items = [...prev[list]];
      const fromIndex = items.findIndex((item) => item.id === source.id);
      const toIndex = items.findIndex((item) => item.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return {
        ...prev,
        [list]: items,
      };
    });

    draggedRowRef.current = null;
  };

  const addTableToScope = (tableName: string) => {
    setTablesInScopeInput((prev) => {
      const next = uniqueList([...sanitizeIdentifierList(prev), tableName]);
      return next.join(", ");
    });
  };

  const updateBlocks = (updater: (prev: QueryBlocks) => QueryBlocks) => {
    setBlocks((prev) => {
      const next = updater(prev);
      if (syncEnabled) {
        lastSyncRef.current = "blocks";
        setNaturalLanguage(blocksToNaturalLanguage(next));
        setNlIssues([]);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!connection) return;
    loadSchema();
  }, [connection?.id, connection?.server, selectedDatabase]);

  useEffect(() => {
    if (!syncEnabled) return;
    if (lastSyncRef.current === "blocks") {
      lastSyncRef.current = null;
      return;
    }
    if (nlDebounceRef.current) {
      window.clearTimeout(nlDebounceRef.current);
    }
    nlDebounceRef.current = window.setTimeout(() => {
      if (!naturalLanguage.trim()) return;
      if (useAiForNl) {
        runAiGeneration(naturalLanguage);
        lastSyncRef.current = "nl";
      } else {
        const parsed = parseNaturalLanguage(naturalLanguage);
        setBlocks(parsed.blocks);
        setNlIssues(parsed.issues);
        lastSyncRef.current = "nl";
      }
    }, 450);
  }, [naturalLanguage, syncEnabled, useAiForNl]);

  const handleExecute = async () => {
    if (!sql.trim()) return;
    if (hasBlockingErrors) {
      setError(
        "Resolve the highlighted issues before executing the query.",
      );
      return;
    }

    setExecuting(true);
    setError(null);

    // In production, this would call a backend API to execute the query
    setTimeout(() => {
      // Mock results
      setResults([
        {
          UserID: 1001,
          Username: "jdoe",
          Email: "john@example.com",
          OrderID: 50241,
          Total: 150.0,
        },
        {
          UserID: 1001,
          Username: "jdoe",
          Email: "john@example.com",
          OrderID: 50389,
          Total: 275.5,
        },
        {
          UserID: 1023,
          Username: "asmith",
          Email: "alice@example.com",
          OrderID: 50192,
          Total: 99.99,
        },
      ]);
      setExecuting(false);
    }, 1000);
  };

  const blockLabels: Record<BlockId, string> = {
    select: "SELECT",
    from: "FROM",
    scope: "TABLES IN SCOPE",
    join: "JOIN",
    where: "WHERE",
    group: "GROUP BY",
    order: "ORDER BY & LIMIT",
  };

  const blockRenderers: Record<BlockId, JSX.Element> = {
    select: (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-slate-400" />
            <Code2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              SELECT
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Switch
              checked={blocks.distinct}
              onCheckedChange={(value) =>
                updateBlocks((prev) => ({ ...prev, distinct: value }))
              }
              id="distinct-toggle"
            />
            <Label htmlFor="distinct-toggle" className="text-xs">
              Distinct
            </Label>
          </div>
        </div>
        <Input
          value={blocks.select.join(", ")}
          onChange={(event) =>
            updateBlocks((prev) => ({
              ...prev,
              select: sanitizeIdentifierList(event.target.value),
            }))
          }
          list="sql-column-options"
          placeholder="columns, expressions, aggregates"
        />
        {issues
          .filter((issue) => issue.field === "select")
          .map((issue) => (
            <p
              key={issue.id}
              className="text-xs text-amber-600 dark:text-amber-400"
            >
              {issue.message}
            </p>
          ))}
      </div>
    ),
    from: (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-400" />
          <Braces className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            FROM
          </span>
        </div>
        <Input
          value={blocks.from}
          onChange={(event) =>
            updateBlocks((prev) => ({ ...prev, from: event.target.value }))
          }
          list="sql-table-options"
          placeholder="table or view (alias)"
        />
        {issues
          .filter((issue) => issue.field === "from")
          .map((issue) => (
            <p
              key={issue.id}
              className="text-xs text-red-600 dark:text-red-400"
            >
              {issue.message}
            </p>
          ))}
      </div>
    ),
    scope: (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-400" />
          <Database className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            TABLES IN SCOPE
          </span>
        </div>
        <Input
          value={tablesInScopeInput}
          onChange={(event) => setTablesInScopeInput(event.target.value)}
          list="sql-table-options"
          placeholder="orders, users, invoices (comma-separated)"
        />
        {schemaError && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {schemaError}
          </p>
        )}
        {!schemaError && schemaTableOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {schemaTableOptions.slice(0, 10).map((table) => (
              <Button
                key={table}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => addTableToScope(table)}
              >
                + {table}
              </Button>
            ))}
          </div>
        )}
      </div>
    ),
    join: (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              JOIN
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateBlocks((prev) => ({
                ...prev,
                joins: [
                  ...prev.joins,
                  {
                    id: `join-${prev.joins.length + 1}`,
                    type: "LEFT",
                    table: "",
                    on: "",
                  },
                ],
              }))
            }
          >
            + Add Join
          </Button>
        </div>
        <div className="space-y-3">
          {blocks.joins.map((join) => (
            <div
              key={join.id}
              draggable
              onDragStart={() => handleRowDragStart("joins", join.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleRowDrop("joins", join.id)}
              className="grid grid-cols-12 gap-2 items-center"
            >
              <div className="col-span-1 flex items-center justify-center text-slate-400">
                <GripVertical className="h-4 w-4" />
              </div>
              <select
                className="col-span-2 h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-2 text-xs"
                value={join.type}
                onChange={(event) =>
                  updateBlocks((prev) => ({
                    ...prev,
                    joins: prev.joins.map((item) =>
                      item.id === join.id
                        ? {
                            ...item,
                            type: event.target.value as JoinBlock["type"],
                          }
                        : item,
                    ),
                  }))
                }
              >
                {["INNER", "LEFT", "RIGHT", "FULL"].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <Input
                className="col-span-3"
                value={join.table}
                onChange={(event) =>
                  updateBlocks((prev) => ({
                    ...prev,
                    joins: prev.joins.map((item) =>
                      item.id === join.id
                        ? { ...item, table: event.target.value }
                        : item,
                    ),
                  }))
                }
                list="sql-table-options"
                placeholder="table alias"
              />
              <Input
                className="col-span-5"
                value={join.on}
                onChange={(event) =>
                  updateBlocks((prev) => ({
                    ...prev,
                    joins: prev.joins.map((item) =>
                      item.id === join.id
                        ? { ...item, on: event.target.value }
                        : item,
                    ),
                  }))
                }
                list="sql-column-options"
                placeholder="join condition"
              />
              <Button
                variant="ghost"
                size="sm"
                className="col-span-1"
                onClick={() =>
                  updateBlocks((prev) => ({
                    ...prev,
                    joins: prev.joins.filter((item) => item.id !== join.id),
                  }))
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        {issues
          .filter((issue) => issue.field === "joins")
          .map((issue) => (
            <p
              key={issue.id}
              className="text-xs text-red-600 dark:text-red-400"
            >
              {issue.message}
            </p>
          ))}
      </div>
    ),
    where: (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              WHERE
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateBlocks((prev) => ({
                ...prev,
                where: [
                  ...prev.where,
                  {
                    id: `where-${prev.where.length + 1}`,
                    field: "",
                    operator: "=",
                    value: "",
                    logic: prev.where.length ? "AND" : "AND",
                  },
                ],
              }))
            }
          >
            + Add Filter
          </Button>
        </div>
        <div className="space-y-2">
          {blocks.where.map((condition, index) => (
            <div
              key={condition.id}
              draggable
              onDragStart={() => handleRowDragStart("where", condition.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleRowDrop("where", condition.id)}
              className="grid grid-cols-12 gap-2 items-center"
            >
              <div className="col-span-1 flex items-center justify-center text-slate-400">
                <GripVertical className="h-4 w-4" />
              </div>
              {index > 0 ? (
                <select
                  className="col-span-2 h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-2 text-xs"
                  value={condition.logic}
                  onChange={(event) =>
                    updateBlocks((prev) => ({
                      ...prev,
                      where: prev.where.map((item) =>
                        item.id === condition.id
                          ? {
                              ...item,
                              logic: event.target.value as "AND" | "OR",
                            }
                          : item,
                      ),
                    }))
                  }
                >
                  {["AND", "OR"].map((logic) => (
                    <option key={logic} value={logic}>
                      {logic}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="col-span-2 text-xs text-slate-400">
                  WHERE
                </div>
              )}
              <Input
                className="col-span-3"
                value={condition.field}
                onChange={(event) =>
                  updateBlocks((prev) => ({
                    ...prev,
                    where: prev.where.map((item) =>
                      item.id === condition.id
                        ? { ...item, field: event.target.value }
                        : item,
                    ),
                  }))
                }
                list="sql-column-options"
                placeholder="column"
              />
              <select
                className="col-span-2 h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-2 text-xs"
                value={condition.operator}
                onChange={(event) =>
                  updateBlocks((prev) => ({
                    ...prev,
                    where: prev.where.map((item) =>
                      item.id === condition.id
                        ? {
                            ...item,
                            operator:
                              event.target.value as WhereBlock["operator"],
                          }
                        : item,
                    ),
                  }))
                }
              >
                {["=", "!=", "<", "<=", ">", ">=", "LIKE", "IN"].map(
                  (operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ),
                )}
              </select>
              <Input
                className="col-span-2"
                value={condition.value}
                onChange={(event) =>
                  updateBlocks((prev) => ({
                    ...prev,
                    where: prev.where.map((item) =>
                      item.id === condition.id
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  }))
                }
                placeholder="value"
              />
              <Button
                variant="ghost"
                size="sm"
                className="col-span-2"
                onClick={() =>
                  updateBlocks((prev) => ({
                    ...prev,
                    where: prev.where.filter(
                      (item) => item.id !== condition.id,
                    ),
                  }))
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        {issues
          .filter((issue) => issue.field === "where")
          .map((issue) => (
            <p
              key={issue.id}
              className="text-xs text-amber-600 dark:text-amber-400"
            >
              {issue.message}
            </p>
          ))}
      </div>
    ),
    group: (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            GROUP BY
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Columns
            </span>
            <Input
              value={blocks.groupBy.join(", ")}
              onChange={(event) =>
                updateBlocks((prev) => ({
                  ...prev,
                  groupBy: sanitizeIdentifierList(event.target.value),
                }))
              }
              list="sql-column-options"
              placeholder="columns"
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              HAVING
            </span>
            <Input
              value={blocks.having}
              onChange={(event) =>
                updateBlocks((prev) => ({
                  ...prev,
                  having: event.target.value,
                }))
              }
              placeholder="aggregate condition"
            />
          </div>
        </div>
      </div>
    ),
    order: (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              ORDER BY & LIMIT
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateBlocks((prev) => ({
                ...prev,
                orderBy: [
                  ...prev.orderBy,
                  {
                    id: `order-${prev.orderBy.length + 1}`,
                    field: "",
                    direction: "ASC",
                  },
                ],
              }))
            }
          >
            + Add Sort
          </Button>
        </div>
        <div className="space-y-2">
          {blocks.orderBy.map((order) => (
            <div
              key={order.id}
              draggable
              onDragStart={() => handleRowDragStart("orderBy", order.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleRowDrop("orderBy", order.id)}
              className="grid grid-cols-12 gap-2 items-center"
            >
              <div className="col-span-1 flex items-center justify-center text-slate-400">
                <GripVertical className="h-4 w-4" />
              </div>
              <Input
                className="col-span-6"
                value={order.field}
                onChange={(event) =>
                  updateBlocks((prev) => ({
                    ...prev,
                    orderBy: prev.orderBy.map((item) =>
                      item.id === order.id
                        ? { ...item, field: event.target.value }
                        : item,
                    ),
                  }))
                }
                list="sql-column-options"
                placeholder="column"
              />
              <select
                className="col-span-3 h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-2 text-xs"
                value={order.direction}
                onChange={(event) =>
                  updateBlocks((prev) => ({
                    ...prev,
                    orderBy: prev.orderBy.map((item) =>
                      item.id === order.id
                        ? {
                            ...item,
                            direction:
                              event.target.value as OrderBlock["direction"],
                          }
                        : item,
                    ),
                  }))
                }
              >
                {["ASC", "DESC"].map((direction) => (
                  <option key={direction} value={direction}>
                    {direction}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                className="col-span-2"
                onClick={() =>
                  updateBlocks((prev) => ({
                    ...prev,
                    orderBy: prev.orderBy.filter(
                      (item) => item.id !== order.id,
                    ),
                  }))
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 dark:text-slate-400">
              Limit
            </Label>
            <Input
              value={blocks.limit}
              onChange={(event) =>
                updateBlocks((prev) => ({
                  ...prev,
                  limit: event.target.value,
                }))
              }
              placeholder={dialect === "sqlserver" ? "TOP" : "LIMIT"}
            />
            {issues
              .filter((issue) => issue.field === "limit")
              .map((issue) => (
                <p
                  key={issue.id}
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {issue.message}
                </p>
              ))}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 dark:text-slate-400">
              Dialect Notes
            </Label>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {dialect === "sqlserver"
                ? "LIMIT becomes TOP() in SELECT."
                : "LIMIT appears at the end of the query."}
            </div>
          </div>
        </div>
      </div>
    ),
  };

  if (!connection) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          Please connect to a database to execute queries
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden">
      {/* Builder Header */}
      <div className="flex flex-col gap-3 p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Visual SQL Builder
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {syncEnabled ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              )}
              {syncEnabled ? "Synced in real time" : "Sync paused"}
            </div>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={executing || !sql.trim() || hasBlockingErrors}
            >
              <Play className="h-3 w-3 mr-1" />
              {executing ? "Executing..." : "Execute (F5)"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-500 dark:text-slate-400">
              Dialect
            </Label>
            <Select
              value={dialect}
              onValueChange={(value) => setDialect(value as SqlDialect)}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Select dialect" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DIALECT_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={syncEnabled}
              onCheckedChange={setSyncEnabled}
              id="sync-toggle"
            />
            <Label htmlFor="sync-toggle" className="text-xs">
              Two-way sync
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={useAiForNl}
              onCheckedChange={setUseAiForNl}
              id="ai-toggle"
            />
            <Label htmlFor="ai-toggle" className="text-xs">
              Use AI for NL
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSchema}
            disabled={schemaLoading || !connection}
            className="h-8"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", schemaLoading && "animate-spin")} />
            {schemaLoading ? "Loading schema" : "Refresh schema"}
          </Button>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Output updates instantly across blocks, natural language, and SQL.
          </div>
        </div>
      </div>

      {/* Builder Body */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden bg-slate-50/40 dark:bg-slate-950/40">
        {/* Block Editor */}
        <div className="col-span-7 flex flex-col gap-4 min-h-0 overflow-hidden">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Block Palette
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Drag to reorder
              </span>
            </div>
            <div className="space-y-2">
              {blockOrder.map((blockId) => (
                <div
                  key={blockId}
                  draggable
                  onDragStart={() => handleDragStart(blockId)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(blockId)}
                  className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50/60 dark:bg-slate-950/40 cursor-move"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {blockLabels[blockId]}
                    </span>
                  </div>
                  <Switch
                    checked={blockVisibility[blockId]}
                    onCheckedChange={(value) =>
                      setBlockVisibility((prev) => ({
                        ...prev,
                        [blockId]: value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 min-h-0 overflow-auto pr-1">
            {blockOrder
              .filter((blockId) => blockVisibility[blockId])
              .map((blockId) => (
                <div
                  key={blockId}
                  draggable
                  onDragStart={() => handleDragStart(blockId)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(blockId)}
                >
                  {blockRenderers[blockId]}
                </div>
              ))}
          </div>
        </div>

        {/* Natural Language + SQL Output */}
        <div className="col-span-5 flex flex-col gap-4 min-h-0">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Natural Language
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={aiLoading}
                onClick={() => runAiGeneration(naturalLanguage, true)}
              >
                {aiLoading ? "Generating..." : "Generate SQL"}
              </Button>
            </div>
            <Textarea
              value={naturalLanguage}
              onChange={(event) => setNaturalLanguage(event.target.value)}
              placeholder="Describe your query in plain English..."
              className="min-h-[140px] text-sm"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Confidence:{" "}
                {aiResponse ? `${Math.round(aiResponse.confidence * 100)}%` : "--"}
              </span>
              {aiLoading && <span>AI analysis in progress…</span>}
            </div>
            {aiError && (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-900/20 p-2 text-xs text-red-700 dark:text-red-300">
                {aiError}
              </div>
            )}
            {nlIssues.length > 0 && (
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 p-2 text-xs text-amber-700 dark:text-amber-300">
                {nlIssues.map((issue) => (
                  <div key={issue.id}>{issue.message}</div>
                ))}
              </div>
            )}
            {aiResponse?.trace && aiResponse.trace.length > 0 && (
              <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/30 p-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {aiResponse.trace.map((step, index) => (
                  <div key={`${step}-${index}`}>{step}</div>
                ))}
              </div>
            )}
            {aiResponse?.sourceMap && aiResponse.sourceMap.length > 0 && (
              <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/20 p-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {aiResponse.sourceMap.map((item, index) => (
                  <div key={`${item.source}-${index}`}>
                    <span className="font-semibold">{item.source}</span> →{" "}
                    {item.target}
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-slate-500 dark:text-slate-400">
              AI mode updates the block builder and SQL output automatically.
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm min-h-[260px] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Final SQL ({DIALECT_LABELS[dialect]})
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(sql)}
              >
                Copy SQL
              </Button>
            </div>
            <pre
              className={cn(
                "flex-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 overflow-auto font-mono",
                hasBlockingErrors && "border-red-500/70",
              )}
            >
              {sql}
            </pre>
            <div className="flex flex-col gap-2 text-xs">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className={cn(
                    "flex items-center gap-2",
                    issue.level === "error"
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {issue.level === "error" ? "Error:" : "Warning:"}{" "}
                  {issue.message}
                </div>
              ))}
              {issues.length === 0 && (
                <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Query looks valid and ready to run.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <datalist id="sql-table-options">
        {schemaTableOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <datalist id="sql-column-options">
        {schemaColumnOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!error && executing && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            ✓ Query executed successfully. (247 rows affected) Execution time:
            0.234 seconds
          </p>
        </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="flex-1 min-h-[300px]">
          <ResultsGrid data={results} />
        </div>
      )}

      {results.length === 0 && !executing && (
        <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
          <p>Execute a query to see results here</p>
        </div>
      )}
    </div>
  );
}
