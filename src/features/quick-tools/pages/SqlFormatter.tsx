/**
 * File path: src/features/quick-tools/pages/SqlFormatter.tsx
 * Frontend: SQL Formatter — build, generate, and format SQL with split view and collapsible sections.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  AlertCircle,
  Trash2,
  Copy,
  CheckCircle,
  Layers,
  Sparkles,
  GripVertical,
  RefreshCw,
  Search,
  Table2,
  Columns3,
  Eye,
  EyeOff,
  Blocks,
  Code2,
  Filter,
  GitMerge,
  ListOrdered,
  Hash,
  Braces,
  Wand2,
  Zap,
  Plus,
  X,
  ArrowUpDown,
  Loader2,
  Terminal,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  fetchDatabaseSchema,
  generateSqlFromNaturalLanguage,
  type SqlAiBlocks,
  type SqlAiResponse,
} from "@/features/sql-export-wizard/utils/sqlAiService";
import { getConnections } from "@/features/sql-export-wizard/utils/storage";
import type { DatabaseConnection } from "@/features/sql-export-wizard/types";

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
  select: ["*"],
  from: "",
  joins: [],
  where: [],
  groupBy: [],
  having: "",
  orderBy: [],
  limit: "",
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

  const fromMatch = lower.match(/(?:from|in|using)\s+([a-z0-9_.]+)/);
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

  const orderMatch = lower.match(/order by\s+(.+?)(?=\s+limit|$)/);
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

export const SqlFormatter: React.FC = () => {
  const [mode, setMode] = useState<"builder" | "formatter">("builder");
  const [input, setInput] = useState("");
  const [formattedOutput, setFormattedOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [nlSectionOpen, setNlSectionOpen] = useState(true);
  const [builderToolbarExpanded, setBuilderToolbarExpanded] = useState(true);

  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string>("");
  const [databaseOverride, setDatabaseOverride] = useState("");
  const [schemaTables, setSchemaTables] = useState<
    { name: string; schema: string; columns: { name: string }[] }[]
  >([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [blocks, setBlocks] = useState<QueryBlocks>(DEFAULT_BLOCKS);
  const [naturalLanguage, setNaturalLanguage] = useState(
    "Show orders and totals from Orders where total is greater than 100, ordered by order date desc, limit 50.",
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
  const [blockSearch, setBlockSearch] = useState("");
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

  const lastSyncRef = useRef<"blocks" | "nl" | null>(null);
  const nlDebounceRef = useRef<number | null>(null);
  const aiRequestRef = useRef(0);
  const draggedBlockRef = useRef<BlockId | null>(null);
  const draggedRowRef = useRef<RowDragTarget>(null);

  useEffect(() => {
    const saved = getConnections();
    setConnections(saved);
    setActiveConnectionId((prev) => prev || saved[0]?.id || "");
  }, []);

  const activeConnection = useMemo(
    () => connections.find((conn) => conn.id === activeConnectionId) || null,
    [connections, activeConnectionId],
  );

  useEffect(() => {
    if (!activeConnection) return;
    const map: Record<string, SqlDialect> = {
      mssql: "sqlserver",
      "azure-sql": "sqlserver",
      postgresql: "postgresql",
      mysql: "mysql",
      sqlite: "sqlite",
    };
    setDialect(map[activeConnection.serverType] || "postgresql");
  }, [activeConnection?.serverType]);

  const { sql, issues } = useMemo(
    () => formatSql(blocks, dialect),
    [blocks, dialect],
  );

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

  const refreshConnections = () => {
    const saved = getConnections();
    setConnections(saved);
    setActiveConnectionId((prev) => {
      if (prev && saved.some((conn) => conn.id === prev)) return prev;
      return saved[0]?.id || "";
    });
  };

  const loadSchema = async () => {
    if (!activeConnection) {
      setSchemaError("Select a connection to load schema.");
      return;
    }
    const connection = {
      ...activeConnection,
      database:
        databaseOverride ||
        activeConnection.database ||
        activeConnection.defaultDatabase,
    };
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

  const formatRawSql = () => {
    if (!input.trim()) return;
    try {
      let formatted = input
        .replace(/\s+/g, " ")
        .replace(/\s*([,;])\s*/g, "$1\n")
        .replace(/\s*(\()\s*/g, "\n$1")
        .replace(/\s*(\))\s*/g, "\n$1")
        .replace(
          /\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|Create|Insert|Update|Delete|In|Is|Null)\b/gi,
          (match) => `\n${match.toUpperCase()}`,
        )
        .trim();
      const lines = formatted.split("\n");
      formatted = lines.map((line) => line.trim()).join("\n");
      setFormattedOutput(formatted);
      setError(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError("Failed to format SQL");
    }
  };

  const clear = () => {
    setInput("");
    setFormattedOutput("");
    setError(null);
    setSuccess(false);
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
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

  const blockConfig: Record<BlockId, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
    select: {
      icon: <Columns3 className="h-4 w-4" />,
      color: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50 dark:bg-violet-900/20",
      borderColor: "border-violet-200 dark:border-violet-800/50",
    },
    from: {
      icon: <Table2 className="h-4 w-4" />,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      borderColor: "border-blue-200 dark:border-blue-800/50",
    },
    scope: {
      icon: <Braces className="h-4 w-4" />,
      color: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
      borderColor: "border-cyan-200 dark:border-cyan-800/50",
    },
    join: {
      icon: <GitMerge className="h-4 w-4" />,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
      borderColor: "border-emerald-200 dark:border-emerald-800/50",
    },
    where: {
      icon: <Filter className="h-4 w-4" />,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      borderColor: "border-amber-200 dark:border-amber-800/50",
    },
    group: {
      icon: <Hash className="h-4 w-4" />,
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-900/20",
      borderColor: "border-rose-200 dark:border-rose-800/50",
    },
    order: {
      icon: <ArrowUpDown className="h-4 w-4" />,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      borderColor: "border-orange-200 dark:border-orange-800/50",
    },
  };

  const filteredBlockOrder = useMemo(() => {
    const query = blockSearch.trim().toLowerCase();
    if (!query) return blockOrder;
    return blockOrder.filter((blockId) =>
      blockLabels[blockId].toLowerCase().includes(query),
    );
  }, [blockOrder, blockLabels, blockSearch]);

  const blockRenderers: Record<BlockId, React.ReactElement> = {
    select: (
      <div className={cn(
        "rounded-xl border-2 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm transition-all duration-200 hover:shadow-md",
        blockConfig.select.borderColor
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GripVertical className="h-4 w-4 text-slate-400 cursor-grab active:cursor-grabbing" />
            <div className={cn("flex items-center justify-center h-7 w-7 rounded-lg", blockConfig.select.bgColor)}>
              <span className={blockConfig.select.color}>{blockConfig.select.icon}</span>
            </div>
            <span className={cn("text-sm font-semibold", blockConfig.select.color)}>
              SELECT
            </span>
            {blocks.select.length > 0 && blocks.select[0] !== "*" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                {blocks.select.length} {blocks.select.length === 1 ? "column" : "columns"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Switch
              checked={blocks.distinct}
              onCheckedChange={(value) =>
                updateBlocks((prev) => ({ ...prev, distinct: value }))
              }
              id="distinct-toggle-formatter"
            />
            <Label htmlFor="distinct-toggle-formatter" className="text-xs cursor-pointer">
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
          className="transition-all duration-200 focus:ring-2 focus:ring-violet-500/20"
        />
        {issues
          .filter((issue) => issue.field === "select")
          .map((issue) => (
            <div
              key={issue.id}
              className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-lg"
            >
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {issue.message}
            </div>
          ))}
      </div>
    ),
    from: (
      <div className={cn(
        "rounded-xl border-2 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm transition-all duration-200 hover:shadow-md",
        blockConfig.from.borderColor
      )}>
        <div className="flex items-center gap-2.5">
          <GripVertical className="h-4 w-4 text-slate-400 cursor-grab active:cursor-grabbing" />
          <div className={cn("flex items-center justify-center h-7 w-7 rounded-lg", blockConfig.from.bgColor)}>
            <span className={blockConfig.from.color}>{blockConfig.from.icon}</span>
          </div>
          <span className={cn("text-sm font-semibold", blockConfig.from.color)}>
            FROM
          </span>
          {blocks.from && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
              {blocks.from}
            </span>
          )}
        </div>
        <Input
          value={blocks.from}
          onChange={(event) =>
            updateBlocks((prev) => ({ ...prev, from: event.target.value }))
          }
          list="sql-table-options"
          placeholder="table or view (alias)"
          className="transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
        />
        {issues
          .filter((issue) => issue.field === "from")
          .map((issue) => (
            <div
              key={issue.id}
              className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 rounded-lg"
            >
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {issue.message}
            </div>
          ))}
      </div>
    ),
    scope: (
      <div className={cn(
        "rounded-xl border-2 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm transition-all duration-200 hover:shadow-md",
        blockConfig.scope.borderColor
      )}>
        <div className="flex items-center gap-2.5">
          <GripVertical className="h-4 w-4 text-slate-400 cursor-grab active:cursor-grabbing" />
          <div className={cn("flex items-center justify-center h-7 w-7 rounded-lg", blockConfig.scope.bgColor)}>
            <span className={blockConfig.scope.color}>{blockConfig.scope.icon}</span>
          </div>
          <span className={cn("text-sm font-semibold", blockConfig.scope.color)}>
            TABLES IN SCOPE
          </span>
          {tablesInScope.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
              {tablesInScope.length} {tablesInScope.length === 1 ? "table" : "tables"}
            </span>
          )}
        </div>
        <Input
          value={tablesInScopeInput}
          onChange={(event) => setTablesInScopeInput(event.target.value)}
          list="sql-table-options"
          placeholder="orders, users, invoices (comma-separated)"
          className="transition-all duration-200 focus:ring-2 focus:ring-cyan-500/20"
        />
        {schemaError && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {schemaError}
          </div>
        )}
        {!schemaError && schemaTableOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {schemaTableOptions.slice(0, 10).map((table) => (
              <button
                key={table}
                type="button"
                className="inline-flex items-center gap-1 h-7 px-2 text-xs rounded-lg border border-cyan-200 dark:border-cyan-800/50 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors"
                onClick={() => addTableToScope(table)}
              >
                <Plus className="h-3 w-3" />
                {table}
              </button>
            ))}
          </div>
        )}
        {schemaTableOptions.length === 0 && !schemaError && (
          <div className="text-xs text-slate-400 dark:text-slate-500 italic">
            Load schema to see available tables
          </div>
        )}
      </div>
    ),
    join: (
      <div className={cn(
        "rounded-xl border-2 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm transition-all duration-200 hover:shadow-md",
        blockConfig.join.borderColor
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GripVertical className="h-4 w-4 text-slate-400 cursor-grab active:cursor-grabbing" />
            <div className={cn("flex items-center justify-center h-7 w-7 rounded-lg", blockConfig.join.bgColor)}>
              <span className={blockConfig.join.color}>{blockConfig.join.icon}</span>
            </div>
            <span className={cn("text-sm font-semibold", blockConfig.join.color)}>
              JOIN
            </span>
            {blocks.joins.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                {blocks.joins.length} {blocks.joins.length === 1 ? "join" : "joins"}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            onClick={() =>
              updateBlocks((prev) => ({
                ...prev,
                joins: [
                  ...prev.joins,
                  {
                    id: `join-${Date.now()}`,
                    type: "LEFT",
                    table: "",
                    on: "",
                  },
                ],
              }))
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add Join
          </Button>
        </div>
        {blocks.joins.length === 0 ? (
          <div className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
            No joins added. Click "Add Join" to join another table.
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.joins.map((join) => (
              <div
                key={join.id}
                draggable
                onDragStart={() => handleRowDragStart("joins", join.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleRowDrop("joins", join.id)}
                className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors"
              >
                <div className="col-span-1 flex items-center justify-center text-slate-400 cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-4 w-4" />
                </div>
                <select
                  className="col-span-2 h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-medium"
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
                  className="col-span-3 h-8"
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
                  className="col-span-5 h-8"
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
                <button
                  type="button"
                  className="col-span-1 flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  onClick={() =>
                    updateBlocks((prev) => ({
                      ...prev,
                      joins: prev.joins.filter((item) => item.id !== join.id),
                    }))
                  }
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
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

  return (
    <div className="flex h-full min-h-0 flex-col p-6 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100/70 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              SQL Formatter
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Build, generate, and format SQL queries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => setMode("builder")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
              mode === "builder"
                ? "bg-white text-blue-600 shadow-md dark:bg-slate-900 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50",
            )}
          >
            <Blocks className="h-4 w-4" />
            <span>Builder</span>
          </button>
          <button
            onClick={() => setMode("formatter")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
              mode === "formatter"
                ? "bg-white text-blue-600 shadow-md dark:bg-slate-900 dark:text-blue-400"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50",
            )}
          >
            <Code2 className="h-4 w-4" />
            <span>Formatter</span>
          </button>
        </div>
      </div>

      {mode === "formatter" ? (
        /* Formatter mode: split view — input left, formatted output right; responsive stack */
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {/* Toolbar: primary actions surfaced for efficiency */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="flex items-center gap-2">
              <Button
                onClick={formatRawSql}
                disabled={!input.trim()}
                className="h-8 gap-1.5 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Format
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={clear}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => copyToClipboard(input)}
                disabled={!input}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy input
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {error && (
                <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </span>
              )}
              {success && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Formatted
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="flex flex-col min-h-0 rounded-xl border border-slate-200/70 bg-white/80 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 overflow-hidden">
              <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-200">
                SQL input
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste or type SQL here, e.g. SELECT * FROM users WHERE id=1"
                className="flex-1 min-h-[120px] w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-slate-800 focus:outline-none dark:text-slate-200"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-col min-h-0 rounded-xl border border-slate-200/70 bg-white/80 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-800/50">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Formatted output
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => copyToClipboard(formattedOutput)}
                  disabled={!formattedOutput}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="flex-1 min-h-[120px] overflow-auto p-4 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {formattedOutput || (
                  <span className="text-slate-400 dark:text-slate-500 italic">
                    Click Format to see result here.
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
          {/* Builder toolbar: compact, collapsible for more editor space */}
          <Collapsible open={builderToolbarExpanded} onOpenChange={setBuilderToolbarExpanded}>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  aria-expanded={builderToolbarExpanded ? "true" : "false"}
                >
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Connection & options
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {schemaTables.length > 0
                      ? `${schemaTables.length} tables · `
                      : ""}
                    {DIALECT_LABELS[dialect]}
                    {useAiForNl ? ` · ${ollamaModel}` : " · AI off"}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-slate-200/70 dark:border-slate-800/70 px-3 py-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        Connection
                      </Label>
                      <Select
                        value={activeConnectionId}
                        onValueChange={setActiveConnectionId}
                        disabled={!connections.length}
                      >
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue
                            placeholder={
                              connections.length ? "Select connection" : "No connections"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {connections.map((conn) => (
                            <SelectItem key={conn.id} value={conn.id}>
                              {conn.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        Database
                      </Label>
                      <Input
                        className="h-8 text-xs w-[140px]"
                        value={databaseOverride}
                        onChange={(event) => setDatabaseOverride(event.target.value)}
                        placeholder={
                          activeConnection?.database ||
                          activeConnection?.defaultDatabase ||
                          "default"
                        }
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadSchema}
                      disabled={schemaLoading || !activeConnection}
                      className="h-8"
                    >
                      <RefreshCw
                        className={cn(
                          "h-3.5 w-3.5 mr-1",
                          schemaLoading && "animate-spin",
                        )}
                      />
                      {schemaLoading ? "Loading…" : "Schema"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8" onClick={refreshConnections}>
                      Reload
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("filepro:navigate", {
                            detail: { tab: "sql-export" },
                          }),
                        )
                      }
                    >
                      Manage
                    </Button>
                    <div className="flex items-center gap-2 ml-auto">
                      <Label className="text-xs text-slate-500 dark:text-slate-400">
                        Dialect
                      </Label>
                      <Select
                        value={dialect}
                        onValueChange={(value) => setDialect(value as SqlDialect)}
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue placeholder="Dialect" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(DIALECT_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Switch
                        checked={syncEnabled}
                        onCheckedChange={setSyncEnabled}
                        id="sync-toggle-formatter"
                      />
                      <Label htmlFor="sync-toggle-formatter" className="text-xs">
                        Sync
                      </Label>
                      <Switch
                        checked={useAiForNl}
                        onCheckedChange={setUseAiForNl}
                        id="ai-toggle-formatter"
                      />
                      <Label htmlFor="ai-toggle-formatter" className="text-xs">
                        AI
                      </Label>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="rounded-full border border-slate-200/70 px-2 py-0.5 dark:border-slate-700/70">
                      {schemaTables.length > 0
                        ? `Schema: ${schemaTables.length} tables`
                        : "Schema: not loaded"}
                    </span>
                    <span className="rounded-full border border-slate-200/70 px-2 py-0.5 dark:border-slate-700/70">
                      {DIALECT_LABELS[dialect]}
                    </span>
                    <span className="rounded-full border border-slate-200/70 px-2 py-0.5 dark:border-slate-700/70">
                      {useAiForNl ? ollamaModel : "AI off"}
                    </span>
                    {schemaError && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {schemaError}
                      </span>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/50">
            <div className="grid grid-cols-12 gap-4 min-h-0 h-full">
              {/* Left Column - Independent Scroll Container */}
              <div className="col-span-7 flex h-full flex-col min-h-0 overflow-hidden">
                {/* Sticky Block Palette Header */}
                <div className="flex-shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm mb-3">
                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Block Palette
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Drag to reorder
                      </span>
                    </div>
                  </div>

                  {/* Search + Schema Counts Row */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={blockSearch}
                        onChange={(event) => setBlockSearch(event.target.value)}
                        placeholder="Search blocks..."
                        className="h-7 text-xs pl-8 pr-2"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1 rounded-md border border-slate-200/70 dark:border-slate-700/70 px-1.5 py-0.5 bg-slate-50/50 dark:bg-slate-800/50">
                        <Table2 className="h-3 w-3" />
                        <span>{schemaTables.length}</span>
                      </div>
                      <div className="flex items-center gap-1 rounded-md border border-slate-200/70 dark:border-slate-700/70 px-1.5 py-0.5 bg-slate-50/50 dark:bg-slate-800/50">
                        <Columns3 className="h-3 w-3" />
                        <span>{schemaColumnOptions.length}</span>
                      </div>
                      <div className="flex items-center gap-1 rounded-md border border-slate-200/70 dark:border-slate-700/70 px-1.5 py-0.5 bg-slate-50/50 dark:bg-slate-800/50">
                        <Eye className="h-3 w-3" />
                        <span>{blockOrder.filter((id) => blockVisibility[id]).length}/{blockOrder.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Compact Mini Map */}
                  <div className="flex items-center gap-1 p-1.5 rounded-md bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    {blockOrder.map((blockId) => {
                      const isVisible = blockVisibility[blockId];
                      const matchesSearch = !blockSearch.trim() || blockLabels[blockId].toLowerCase().includes(blockSearch.toLowerCase());
                      return (
                        <button
                          key={`minimap-${blockId}`}
                          type="button"
                          onClick={() =>
                            setBlockVisibility((prev) => ({
                              ...prev,
                              [blockId]: !prev[blockId],
                            }))
                          }
                          title={`${blockLabels[blockId]} - Click to ${isVisible ? 'hide' : 'show'}`}
                          className={cn(
                            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider transition-all duration-150",
                            !matchesSearch && "opacity-30",
                            isVisible
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shadow-sm"
                              : "bg-slate-200/60 text-slate-400 dark:bg-slate-700/40 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700",
                          )}
                        >
                          {isVisible ? (
                            <Eye className="h-2.5 w-2.5" />
                          ) : (
                            <EyeOff className="h-2.5 w-2.5" />
                          )}
                          <span>{blockLabels[blockId].replace(/ & | /g, '').slice(0, 3)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scrollable Blocks Container */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
                  <div className="flex flex-col gap-3">
                    {filteredBlockOrder.map((blockId) => (
                      <div
                        key={`palette-${blockId}`}
                        draggable
                        onDragStart={() => handleDragStart(blockId)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleDrop(blockId)}
                        className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50/60 dark:bg-slate-950/40 cursor-move hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors"
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

                  {/* Visible Block Editors */}
                  <div className="flex flex-col gap-3 mt-3">
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
              </div>

              {/* Right Column: Final SQL first (primary output), then Natural Language (collapsible) */}
              <div className="col-span-5 flex h-full flex-col min-h-0 overflow-hidden pl-1">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent flex flex-col gap-3">
                  {/* Final SQL — primary output, always visible and prominent */}
                  <div className="rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm flex flex-col min-h-[220px]">
                    <div className="flex items-center justify-between flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Final SQL ({DIALECT_LABELS[dialect]})
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => copyToClipboard(sql)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copy SQL
                      </Button>
                    </div>
                    <pre
                      className={cn(
                        "flex-1 min-h-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 overflow-auto font-mono",
                        issues.some((issue) => issue.level === "error") &&
                          "border-red-500/70",
                      )}
                    >
                      {sql}
                    </pre>
                    <div className="flex flex-col gap-1.5 text-xs flex-shrink-0">
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
                          <CheckCircle className="h-3.5 w-3.5" />
                          Query looks valid.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Natural Language — collapsible for progressive disclosure */}
                  <Collapsible open={nlSectionOpen} onOpenChange={setNlSectionOpen}>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                          aria-expanded={nlSectionOpen ? "true" : "false"}
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              Natural Language
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {aiResponse
                              ? `${Math.round(aiResponse.confidence * 100)}% confidence`
                              : "Describe query in plain English"}
                          </span>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
                          <Textarea
                            value={naturalLanguage}
                            onChange={(event) => setNaturalLanguage(event.target.value)}
                            placeholder="Describe your query in plain English..."
                            className="min-h-[100px] text-sm resize-none w-full"
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={aiLoading}
                              onClick={() => runAiGeneration(naturalLanguage, true)}
                            >
                              {aiLoading ? "Generating…" : "Generate SQL"}
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            {aiResponse && (
                              <span>
                                Confidence: {Math.round(aiResponse.confidence * 100)}%
                              </span>
                            )}
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
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
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
        </div>
      )}
    </div>
  );
};
