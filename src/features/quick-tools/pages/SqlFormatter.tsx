/**
 * File path: src/features/quick-tools/pages/SqlFormatter.tsx
 * Frontend: SQL Formatter — visual query builder, natural-language-to-SQL,
 * and raw SQL beautifier. Compact two-column layout with inline block editors.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  AlertCircle,
  Trash2,
  Copy,
  CheckCircle,
  Sparkles,
  GripVertical,
  RefreshCw,
  Table2,
  Columns3,
  Blocks,
  Code2,
  Filter,
  GitMerge,
  Hash,
  Braces,
  Wand2,
  Plus,
  X,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Mic,
} from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
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
import { cn } from "@/lib/utils";
import {
  fetchDatabaseSchema,
  generateSqlFromNaturalLanguage,
  type SqlAiBlocks,
  type SqlAiResponse,
} from "@/features/sql-export-wizard/utils/sqlAiService";
import { getConnections } from "@/features/sql-export-wizard/utils/storage";
import type { DatabaseConnection } from "@/features/sql-export-wizard/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

type BlockId = "select" | "from" | "join" | "where" | "group" | "order";

type RowListId = "joins" | "where" | "orderBy";

type RowDragTarget = {
  list: RowListId;
  id: string;
} | null;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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

/** Block label and styling config */
const BLOCK_CONFIG: Record<
  BlockId,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    border: string;
    bg: string;
  }
> = {
  select: {
    label: "SELECT",
    icon: <Columns3 className="h-3.5 w-3.5" />,
    color: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-800/60",
    bg: "bg-violet-50/60 dark:bg-violet-900/10",
  },
  from: {
    label: "FROM",
    icon: <Table2 className="h-3.5 w-3.5" />,
    color: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/60",
    bg: "bg-blue-50/60 dark:bg-blue-900/10",
  },
  join: {
    label: "JOIN",
    icon: <GitMerge className="h-3.5 w-3.5" />,
    color: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800/60",
    bg: "bg-emerald-50/60 dark:bg-emerald-900/10",
  },
  where: {
    label: "WHERE",
    icon: <Filter className="h-3.5 w-3.5" />,
    color: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/60",
    bg: "bg-amber-50/60 dark:bg-amber-900/10",
  },
  group: {
    label: "GROUP BY",
    icon: <Hash className="h-3.5 w-3.5" />,
    color: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800/60",
    bg: "bg-rose-50/60 dark:bg-rose-900/10",
  },
  order: {
    label: "ORDER / LIMIT",
    icon: <ArrowUpDown className="h-3.5 w-3.5" />,
    color: "text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800/60",
    bg: "bg-orange-50/60 dark:bg-orange-900/10",
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const uniqueList = (items: string[]) =>
  Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const sanitizeIdentifierList = (value: string) =>
  value
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

const normalizeValueLiteral = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("'") || trimmed.startsWith('"')) return trimmed;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^\(.+\)$/.test(trimmed)) return trimmed;
  return `'${trimmed.replace(/'/g, "''")}'`;
};

/** Build SQL string from structured blocks with validation */
const formatSql = (blocks: QueryBlocks, dialect: SqlDialect) => {
  const issues: ValidationIssue[] = [];

  if (!blocks.from.trim()) {
    issues.push({
      id: "from-required",
      level: "error",
      message: "FROM is required.",
      field: "from",
    });
  }

  const selectFields = blocks.select.length ? uniqueList(blocks.select) : ["*"];
  if (blocks.select.length === 0) {
    issues.push({
      id: "select-empty",
      level: "warning",
      message: "No columns selected — using *.",
      field: "select",
    });
  }

  blocks.joins.forEach((join) => {
    if (!join.table.trim() || !join.on.trim()) {
      issues.push({
        id: `join-${join.id}`,
        level: "error",
        message: "Each JOIN needs a table and ON condition.",
        field: "joins",
      });
    }
  });

  blocks.where.forEach((condition) => {
    if (!condition.field.trim() || !condition.value.trim()) {
      issues.push({
        id: `where-${condition.id}`,
        level: "warning",
        message: "Complete each WHERE condition.",
        field: "where",
      });
    }
  });

  blocks.orderBy.forEach((order) => {
    if (!order.field.trim()) {
      issues.push({
        id: `order-${order.id}`,
        level: "warning",
        message: "ORDER BY needs a column.",
        field: "orderBy",
      });
    }
  });

  if (blocks.limit && !/^\d+$/.test(blocks.limit.trim())) {
    issues.push({
      id: "limit-invalid",
      level: "error",
      message: "LIMIT must be a whole number.",
      field: "limit",
    });
  }

  const selectKeyword = blocks.distinct ? "SELECT DISTINCT" : "SELECT";
  const topClause =
    dialect === "sqlserver" && blocks.limit
      ? ` TOP (${blocks.limit.trim()})`
      : "";
  const lines: string[] = [
    `${selectKeyword}${topClause} ${selectFields.join(", ")}`,
  ];

  if (blocks.from.trim()) lines.push(`FROM ${blocks.from.trim()}`);

  blocks.joins
    .filter((j) => j.table.trim() && j.on.trim())
    .forEach((j) =>
      lines.push(`${j.type} JOIN ${j.table.trim()} ON ${j.on.trim()}`),
    );

  const validWhere = blocks.where.filter(
    (c) => c.field.trim() && c.value.trim(),
  );
  if (validWhere.length) {
    const clause = validWhere
      .map((c, i) => {
        const statement = `${c.field.trim()} ${c.operator} ${normalizeValueLiteral(c.value)}`;
        return i === 0 ? statement : `${c.logic} ${statement}`;
      })
      .join(" ");
    lines.push(`WHERE ${clause}`);
  }

  const groupFields = uniqueList(blocks.groupBy);
  if (groupFields.length) lines.push(`GROUP BY ${groupFields.join(", ")}`);
  if (blocks.having.trim()) lines.push(`HAVING ${blocks.having.trim()}`);

  const orderFields = blocks.orderBy
    .filter((o) => o.field.trim())
    .map((o) => `${o.field.trim()} ${o.direction}`);
  if (orderFields.length) lines.push(`ORDER BY ${orderFields.join(", ")}`);

  if (
    dialect !== "sqlserver" &&
    blocks.limit.trim() &&
    /^\d+$/.test(blocks.limit.trim())
  ) {
    lines.push(`LIMIT ${blocks.limit.trim()}`);
  }

  return { sql: `${lines.join("\n")};`, issues };
};

/** Convert blocks to plain-English description */
const blocksToNaturalLanguage = (blocks: QueryBlocks) => {
  const parts: string[] = [];
  parts.push(blocks.distinct ? "Select distinct" : "Select");
  parts.push(blocks.select.length ? blocks.select.join(", ") : "all columns");
  if (blocks.from.trim()) parts.push(`from ${blocks.from.trim()}`);

  blocks.joins.forEach((j) => {
    if (j.table.trim() && j.on.trim())
      parts.push(
        `${j.type.toLowerCase()} join ${j.table.trim()} on ${j.on.trim()}`,
      );
  });

  const whereClauses = blocks.where.filter(
    (c) => c.field.trim() && c.value.trim(),
  );
  if (whereClauses.length) {
    const clause = whereClauses
      .map((c, i) => {
        const s = `${c.field.trim()} ${c.operator} ${c.value.trim()}`;
        return i === 0 ? s : `${c.logic.toLowerCase()} ${s}`;
      })
      .join(" ");
    parts.push(`where ${clause}`);
  }

  if (blocks.groupBy.length)
    parts.push(`grouped by ${blocks.groupBy.join(", ")}`);
  if (blocks.having.trim()) parts.push(`having ${blocks.having.trim()}`);

  const orderText = blocks.orderBy
    .filter((o) => o.field.trim())
    .map((o) => `${o.field.trim()} ${o.direction.toLowerCase()}`)
    .join(", ");
  if (orderText) parts.push(`ordered by ${orderText}`);
  if (blocks.limit.trim()) parts.push(`limit ${blocks.limit.trim()}`);

  return `${parts.join(" ")}.`;
};

/**
 * Normalize natural-language where conditions to operator form so the main parser can handle them.
 * E.g. "total greater than 100" -> "total > 100", "name contains john" -> "name like '%john%'".
 */
const normalizeWherePhrases = (whereClause: string): string => {
  let w = whereClause;
  const fieldOp = "([a-z0-9_.]+)";
  w = w.replace(
    new RegExp(
      `\\b${fieldOp}\\s+(greater than|more than|above)\\s+([^\\s]+)`,
      "gi",
    ),
    "$1 > $3",
  );
  w = w.replace(
    new RegExp(`\\b${fieldOp}\\s+(less than|below)\\s+([^\\s]+)`, "gi"),
    "$1 < $3",
  );
  w = w.replace(
    new RegExp(`\\b${fieldOp}\\s+(?:is equal to|equals?)\\s+([^\\s]+)`, "gi"),
    "$1 = $2",
  );
  w = w.replace(
    new RegExp(`\\b${fieldOp}\\s+is\\s+([^\\s]+)(?=\\s|$|and|or)`, "gi"),
    "$1 = $2",
  );
  w = w.replace(
    new RegExp(
      `\\b${fieldOp}\\s+(?:is not|doesn't equal|not equal to|unequal)\\s+([^\\s]+)`,
      "gi",
    ),
    "$1 != $2",
  );
  w = w.replace(
    new RegExp(`\\b${fieldOp}\\s+contains\\s+([^\\s]+)`, "gi"),
    (_, f, v) => `${f} like '%${v}%'`,
  );
  w = w.replace(
    new RegExp(`\\b${fieldOp}\\s+starts with\\s+([^\\s]+)`, "gi"),
    (_, f, v) => `${f} like '${v}%'`,
  );
  w = w.replace(
    new RegExp(`\\b${fieldOp}\\s+ends with\\s+([^\\s]+)`, "gi"),
    (_, f, v) => `${f} like '%${v}'`,
  );
  return w;
};

/** Parse a plain-English description into structured blocks */
const parseNaturalLanguage = (
  input: string,
): { blocks: QueryBlocks; issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];
  const text = input.trim();
  if (!text) return { blocks: DEFAULT_BLOCKS, issues };

  let lower = text.toLowerCase();

  // Normalize "top N" / "first N" / "last N" into "limit N" so the limit regex finds it
  lower = lower.replace(
    /\b(?:top|first)\s+(\d+)(?:\s+rows?)?(?=\s|\.|$)/gi,
    " limit $1 ",
  );
  lower = lower.replace(
    /\blast\s+(\d+)(?:\s+rows?)?(?=\s|\.|$)/gi,
    " limit $1 ",
  );

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
    if (raw.includes("count")) blocks.select.push("COUNT(*) AS count");
    else if (raw.includes("sum of")) {
      const m = raw.match(/sum of\s+([a-z0-9_.]+)/);
      if (m?.[1]) blocks.select.push(`SUM(${m[1]}) AS sum_${m[1]}`);
    } else if (raw.includes("average of") || raw.includes("avg of")) {
      const m = raw.match(/(?:average of|avg of)\s+([a-z0-9_.]+)/);
      if (m?.[1]) blocks.select.push(`AVG(${m[1]}) AS avg_${m[1]}`);
    } else {
      blocks.select = sanitizeIdentifierList(raw);
    }
  }

  const fromMatch = lower.match(/(?:from|in|using)\s+([a-z0-9_.]+)/);
  if (fromMatch?.[1]) blocks.from = fromMatch[1];
  else
    issues.push({
      id: "nl-missing-from",
      level: "error",
      message: 'Couldn\'t find a table. Try "from <table>".',
      field: "nl",
    });

  const joinRegex =
    /(inner join|left join|right join|full join|join)\s+([a-z0-9_.]+)\s+on\s+([^,;.]+?)(?=\s+(?:where|group by|order by|limit|join|$))/gi;
  let joinMatch;
  let joinIdx = 0;
  while ((joinMatch = joinRegex.exec(lower)) !== null) {
    let type: JoinBlock["type"] = "INNER";
    if (joinMatch[1].includes("left")) type = "LEFT";
    if (joinMatch[1].includes("right")) type = "RIGHT";
    if (joinMatch[1].includes("full")) type = "FULL";
    blocks.joins.push({
      id: `nl-join-${joinIdx++}`,
      type,
      table: joinMatch[2],
      on: joinMatch[3],
    });
  }

  const whereMatch = lower.match(
    /where\s+(.+?)(?=\s+(group by|order by|limit|$))/,
  );
  if (whereMatch?.[1]) {
    const normalizedWhere = normalizeWherePhrases(whereMatch[1]);
    const pieces = normalizedWhere.split(/\s+(and|or)\s+/);
    let logic: "AND" | "OR" = "AND";
    let idx = 0;
    for (const piece of pieces) {
      const p = piece.trim();
      if (p === "and" || p === "or") {
        logic = p.toUpperCase() as "AND" | "OR";
        continue;
      }
      const opMatch = p.match(
        /([a-z0-9_.]+)\s*(=|!=|<=|>=|<|>|like|in|is)\s*(.+)/,
      );
      if (opMatch) {
        const op =
          opMatch[2].toUpperCase() === "IS"
            ? "="
            : (opMatch[2].toUpperCase() as WhereBlock["operator"]);
        blocks.where.push({
          id: `nl-where-${idx++}`,
          field: opMatch[1],
          operator: op,
          value: opMatch[3].replace(/['"]/g, ""),
          logic,
        });
      }
    }
  }

  const groupMatch = lower.match(/group by\s+(.+?)(?=\s+order by|\s+limit|$)/);
  if (groupMatch?.[1]) blocks.groupBy = sanitizeIdentifierList(groupMatch[1]);

  const havingMatch = lower.match(/having\s+(.+?)(?=\s+order by|\s+limit|$)/);
  if (havingMatch?.[1]) blocks.having = havingMatch[1];

  const orderMatch = lower.match(/order by\s+(.+?)(?=\s+limit|$)/);
  if (orderMatch?.[1]) {
    blocks.orderBy = sanitizeIdentifierList(orderMatch[1]).map((field, i) => {
      const dir = field.toLowerCase().endsWith(" desc")
        ? ("DESC" as const)
        : ("ASC" as const);
      return {
        id: `nl-order-${i}`,
        field: field.replace(/\s+(desc|asc)$/i, "").trim(),
        direction: dir,
      };
    });
  }

  const limitMatch = lower.match(/limit\s+(\d+)/);
  if (limitMatch?.[1]) blocks.limit = limitMatch[1];

  if (!blocks.select.length) blocks.select = ["*"];
  if (!blocks.from) {
    issues.push({
      id: "nl-fallback",
      level: "warning",
      message: "Using placeholder table. Update FROM.",
      field: "from",
    });
    blocks.from = "your_table";
  }

  return { blocks, issues };
};

/** Improved SQL beautifier — proper keyword newlines and indentation */
const beautifySql = (raw: string): string => {
  if (!raw.trim()) return "";
  const keywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "AND",
    "OR",
    "ORDER BY",
    "GROUP BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "INSERT INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE FROM",
    "CREATE TABLE",
    "ALTER TABLE",
    "DROP TABLE",
    "INNER JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "FULL JOIN",
    "CROSS JOIN",
    "JOIN",
    "ON",
    "UNION ALL",
    "UNION",
    "EXCEPT",
    "INTERSECT",
    "TOP",
    "DISTINCT",
    "AS",
    "IN",
    "IS",
    "NOT",
    "NULL",
    "BETWEEN",
    "EXISTS",
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
  ];

  let text = raw.replace(/\s+/g, " ").trim();

  // Uppercase known keywords
  const upperRegex = new RegExp(
    `\\b(${keywords.map((k) => k.replace(/\s+/g, "\\s+")).join("|")})\\b`,
    "gi",
  );
  text = text.replace(upperRegex, (m) => m.toUpperCase());

  // Line-break before major clauses
  const majorClauses = [
    "SELECT",
    "FROM",
    "WHERE",
    "ORDER BY",
    "GROUP BY",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "INSERT INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE FROM",
    "INNER JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "FULL JOIN",
    "CROSS JOIN",
    "JOIN",
    "UNION ALL",
    "UNION",
    "EXCEPT",
    "INTERSECT",
  ];
  const clauseRegex = new RegExp(
    `\\b(${majorClauses.map((c) => c.replace(/\s+/g, "\\s+")).join("|")})\\b`,
    "g",
  );
  text = text.replace(clauseRegex, "\n$1");

  // Indent AND / OR under WHERE
  text = text.replace(/\n(AND|OR)\b/g, "\n  $1");

  // Clean up leading newline, multiple blanks
  const lines = text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i) => (i === 0 ? l.trim() !== "" : true));
  return lines.join("\n").trim();
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const SqlFormatter: React.FC = () => {
  const [mode, setMode] = useState<"builder" | "formatter">("builder");

  // Formatter state
  const [rawInput, setRawInput] = useState("");
  const [formattedOutput, setFormattedOutput] = useState("");
  const [formatterError, setFormatterError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Builder - connection & schema
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string>("");
  const [databaseOverride, setDatabaseOverride] = useState("");
  const [schemaTables, setSchemaTables] = useState<
    { name: string; schema: string; columns: { name: string }[] }[]
  >([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [showConnectionBar, setShowConnectionBar] = useState(false);

  // Builder - blocks & generation
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [blocks, setBlocks] = useState<QueryBlocks>(DEFAULT_BLOCKS);
  const [naturalLanguage, setNaturalLanguage] = useState(
    "Show orders and totals from Orders where total > 100, ordered by order_date desc, limit 50.",
  );
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [useAiForNl, setUseAiForNl] = useState(true);
  const [nlIssues, setNlIssues] = useState<ValidationIssue[]>([]);
  const [aiResponse, setAiResponse] = useState<SqlAiResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [blockVisibility, setBlockVisibility] = useState<
    Record<BlockId, boolean>
  >({
    select: true,
    from: true,
    join: true,
    where: true,
    group: false,
    order: true,
  });

  // Ollama settings (read once)
  const [ollamaBaseUrl] = useState(() => {
    try {
      const s = localStorage.getItem("ai-assistant-settings");
      if (s) {
        const p = JSON.parse(s);
        return p.ollamaBaseUrl || "http://localhost:11434";
      }
    } catch {
      /* */
    }
    return "http://localhost:11434";
  });
  const [ollamaModel] = useState(() => {
    try {
      const s = localStorage.getItem("ai-assistant-settings");
      if (s) {
        const p = JSON.parse(s);
        return p.ollamaModel || p.model || "llama3.2:3b";
      }
    } catch {
      /* */
    }
    return "llama3.2:3b";
  });

  const lastSyncRef = useRef<"blocks" | "nl" | null>(null);
  const nlDebounceRef = useRef<number | null>(null);
  const aiRequestRef = useRef(0);
  const draggedRowRef = useRef<RowDragTarget>(null);

  // Voice input: append transcribed text to Natural Language field when recognition ends
  const {
    isListening: isVoiceListening,
    interimTranscript: voiceInterim,
    toggleListening: toggleVoiceListening,
    isSupported: isVoiceSupported,
    error: voiceError,
  } = useSpeechRecognition({
    onResult: (text) =>
      setNaturalLanguage((prev) =>
        prev.trim() ? `${prev.trim()} ${text}` : text,
      ),
    lang: "en-US",
    continuous: false,
  });

  /* ---- Derived ---------------------------------------------------- */

  useEffect(() => {
    const saved = getConnections();
    setConnections(saved);
    setActiveConnectionId((prev) => prev || saved[0]?.id || "");
  }, []);

  const activeConnection = useMemo(
    () => connections.find((c) => c.id === activeConnectionId) || null,
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

  const schemaTableOptions = useMemo(
    () =>
      schemaTables.map((t) => (t.schema ? `${t.schema}.${t.name}` : t.name)),
    [schemaTables],
  );

  const schemaColumnOptions = useMemo(() => {
    const options: string[] = [];
    schemaTables.forEach((table) => {
      const fullName = table.schema
        ? `${table.schema}.${table.name}`
        : table.name;
      table.columns.forEach((col) => {
        options.push(`${table.name}.${col.name}`);
        options.push(`${fullName}.${col.name}`);
        options.push(col.name);
      });
    });
    return uniqueList(options);
  }, [schemaTables]);

  /* ---- Actions ---------------------------------------------------- */

  const applyAiBlocks = (b: SqlAiBlocks) => {
    setBlocks({
      distinct: b.distinct,
      select: b.select || [],
      from: b.from || "",
      joins: b.joins || [],
      where: b.where || [],
      groupBy: b.groupBy || [],
      having: b.having || "",
      orderBy: b.orderBy || [],
      limit: b.limit || "",
    });
  };

  const loadSchema = async () => {
    if (!activeConnection) {
      setSchemaError("Select a connection first.");
      return;
    }
    const conn = {
      ...activeConnection,
      database:
        databaseOverride ||
        activeConnection.database ||
        activeConnection.defaultDatabase,
    };
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const res = await fetchDatabaseSchema(conn);
      setSchemaTables(res.tables || []);
    } catch (err) {
      setSchemaError(
        err instanceof Error ? err.message : "Failed to load schema.",
      );
      setSchemaTables([]);
    } finally {
      setSchemaLoading(false);
    }
  };

  const runAiGeneration = async (text: string, force = false) => {
    if (!text.trim()) return;
    if (!useAiForNl && !force) return;
    const reqId = ++aiRequestRef.current;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await generateSqlFromNaturalLanguage({
        text,
        dialect,
        tablesInScope: [],
        availableTables: schemaTableOptions,
        availableColumns: schemaColumnOptions,
        baseUrl: ollamaBaseUrl,
        model: ollamaModel,
      });
      if (reqId !== aiRequestRef.current) return;
      setAiResponse(res);
      setNlIssues(
        (res.warnings || []).map((msg, i) => ({
          id: `ai-warn-${i}`,
          level: "warning",
          message: msg,
          field: "nl",
        })),
      );
      applyAiBlocks(res.blocks);
    } catch (err) {
      if (reqId !== aiRequestRef.current) return;
      setAiError(err instanceof Error ? err.message : "AI generation failed.");
      const parsed = parseNaturalLanguage(text);
      setBlocks(parsed.blocks);
      setNlIssues(parsed.issues);
    } finally {
      if (reqId === aiRequestRef.current) setAiLoading(false);
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

  // Two-way sync: NL -> blocks (debounced)
  useEffect(() => {
    if (!syncEnabled) return;
    if (lastSyncRef.current === "blocks") {
      lastSyncRef.current = null;
      return;
    }
    if (nlDebounceRef.current) window.clearTimeout(nlDebounceRef.current);
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
    }, 500);
  }, [naturalLanguage, syncEnabled, useAiForNl]);

  const handleRowDragStart = (list: RowListId, id: string) => {
    draggedRowRef.current = { list, id };
  };
  const handleRowDrop = (list: RowListId, targetId: string) => {
    const src = draggedRowRef.current;
    if (!src || src.list !== list || src.id === targetId) return;
    updateBlocks((prev) => {
      const items = [...prev[list]];
      const fi = items.findIndex((x) => x.id === src.id);
      const ti = items.findIndex((x) => x.id === targetId);
      if (fi === -1 || ti === -1) return prev;
      const [moved] = items.splice(fi, 1);
      items.splice(ti, 0, moved);
      return { ...prev, [list]: items };
    });
    draggedRowRef.current = null;
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleFormatRawSql = () => {
    if (!rawInput.trim()) return;
    try {
      setFormattedOutput(beautifySql(rawInput));
      setFormatterError(null);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setFormatterError("Failed to format SQL.");
    }
  };

  const toggleBlock = (id: BlockId) =>
    setBlockVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  const visibleBlocks = (Object.keys(BLOCK_CONFIG) as BlockId[]).filter(
    (id) => blockVisibility[id],
  );

  /* ---- Reusable block header -------------------------------------- */
  const BlockHeader: React.FC<{ id: BlockId; right?: React.ReactNode }> = ({
    id,
    right,
  }) => {
    const cfg = BLOCK_CONFIG[id];
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cfg.color}>{cfg.icon}</span>
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wide",
              cfg.color,
            )}
          >
            {cfg.label}
          </span>
        </div>
        {right}
      </div>
    );
  };

  /* ---- Inline validation for a field ------------------------------ */
  const FieldIssues: React.FC<{ field: string }> = ({ field }) => {
    const matching = issues.filter((i) => i.field === field);
    if (!matching.length) return null;
    return (
      <>
        {matching.map((i) => (
          <div
            key={i.id}
            className={cn(
              "flex items-center gap-1.5 text-[11px] mt-1",
              i.level === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-amber-600 dark:text-amber-400",
            )}
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {i.message}
          </div>
        ))}
      </>
    );
  };

  /* ================================================================= */
  /*  RENDER                                                            */
  /* ================================================================= */

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* ─── Compact Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/70 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Database className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            SQL Formatter
          </span>
        </div>
        {/* Mode tabs */}
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 p-0.5 shrink-0">
          <button
            onClick={() => setMode("builder")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mode === "builder"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            <Blocks className="h-3.5 w-3.5" />
            Builder
          </button>
          <button
            onClick={() => setMode("formatter")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              mode === "formatter"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
            Formatter
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  FORMATTER MODE                                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {mode === "formatter" ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleFormatRawSql}
                disabled={!rawInput.trim()}
              >
                <Wand2 className="h-3 w-3" />
                Format
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setRawInput("");
                  setFormattedOutput("");
                  setFormatterError(null);
                }}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {formatterError && (
                <span className="text-[11px] text-red-600 dark:text-red-400">
                  {formatterError}
                </span>
              )}
              {copySuccess && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Done
                </span>
              )}
            </div>
          </div>
          {/* Split view */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-200/70 dark:divide-slate-800/70">
            <div className="flex flex-col min-h-0">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
                Input
              </div>
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Paste or type SQL here..."
                className="flex-1 min-h-0 w-full resize-none bg-transparent p-3 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 focus:outline-none"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Output
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => copyToClipboard(formattedOutput)}
                  disabled={!formattedOutput}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="flex-1 min-h-0 overflow-auto p-3 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {formattedOutput || (
                  <span className="text-slate-400 dark:text-slate-500 italic text-xs">
                    Formatted SQL will appear here.
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════ */
        /*  BUILDER MODE                                                  */
        /* ═══════════════════════════════════════════════════════════════ */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* ── Builder toolbar ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-800/30 shrink-0">
            {/* Dialect */}
            <Select
              value={dialect}
              onValueChange={(v) => setDialect(v as SqlDialect)}
            >
              <SelectTrigger className="w-[120px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DIALECT_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Sync toggle */}
            <div className="flex items-center gap-1.5">
              <Switch
                checked={syncEnabled}
                onCheckedChange={setSyncEnabled}
                id="sf-sync"
                className="scale-75"
              />
              <Label
                htmlFor="sf-sync"
                className="text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                Sync
              </Label>
            </div>
            {/* AI toggle */}
            <div className="flex items-center gap-1.5">
              <Switch
                checked={useAiForNl}
                onCheckedChange={setUseAiForNl}
                id="sf-ai"
                className="scale-75"
              />
              <Label
                htmlFor="sf-ai"
                className="text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                AI
              </Label>
            </div>
            {/* Connection bar toggle */}
            <button
              type="button"
              onClick={() => setShowConnectionBar(!showConnectionBar)}
              className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {showConnectionBar ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Connection
              {schemaTables.length > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  ({schemaTables.length} tables)
                </span>
              )}
            </button>
            {/* Block toggles — right-aligned */}
            <div className="flex items-center gap-1 ml-auto">
              {(Object.keys(BLOCK_CONFIG) as BlockId[]).map((id) => {
                const cfg = BLOCK_CONFIG[id];
                const visible = blockVisibility[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleBlock(id)}
                    title={`${visible ? "Hide" : "Show"} ${cfg.label}`}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                      visible
                        ? cn(cfg.bg, cfg.color, "border", cfg.border)
                        : "text-slate-400 dark:text-slate-600 bg-slate-100/50 dark:bg-slate-800/30 border border-transparent hover:border-slate-200 dark:hover:border-slate-700",
                    )}
                  >
                    {cfg.icon}
                    <span className="hidden sm:inline">
                      {cfg.label.slice(0, 3)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Connection bar (optional) ──────────────────────────── */}
          {showConnectionBar && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 shrink-0">
              <Select
                value={activeConnectionId}
                onValueChange={setActiveConnectionId}
                disabled={!connections.length}
              >
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue
                    placeholder={
                      connections.length ? "Connection" : "No connections"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-7 text-xs w-[120px]"
                value={databaseOverride}
                onChange={(e) => setDatabaseOverride(e.target.value)}
                placeholder={activeConnection?.database || "database"}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={loadSchema}
                disabled={schemaLoading || !activeConnection}
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3 mr-1",
                    schemaLoading && "animate-spin",
                  )}
                />
                {schemaLoading ? "Loading" : "Schema"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const s = getConnections();
                  setConnections(s);
                }}
              >
                Reload
              </Button>
              {schemaError && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">
                  {schemaError}
                </span>
              )}
            </div>
          )}

          {/* ── Main two-column area ──────────────────────────────── */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 divide-x divide-slate-200/70 dark:divide-slate-800/70 overflow-hidden">
            {/* LEFT: Block editors (3/5) */}
            <div className="lg:col-span-3 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
              <div className="flex flex-col gap-2.5 p-3">
                {visibleBlocks.map((blockId) => {
                  const cfg = BLOCK_CONFIG[blockId];
                  return (
                    <div
                      key={blockId}
                      className={cn(
                        "rounded-lg border p-3 space-y-2.5",
                        cfg.border,
                        cfg.bg,
                      )}
                    >
                      {/* ── SELECT ── */}
                      {blockId === "select" && (
                        <>
                          <BlockHeader
                            id="select"
                            right={
                              <div className="flex items-center gap-1.5 text-xs">
                                <Switch
                                  checked={blocks.distinct}
                                  onCheckedChange={(v) =>
                                    updateBlocks((p) => ({ ...p, distinct: v }))
                                  }
                                  id="sf-distinct"
                                  className="scale-75"
                                />
                                <Label
                                  htmlFor="sf-distinct"
                                  className="text-[11px] cursor-pointer text-slate-500 dark:text-slate-400"
                                >
                                  Distinct
                                </Label>
                              </div>
                            }
                          />
                          <Input
                            value={blocks.select.join(", ")}
                            onChange={(e) =>
                              updateBlocks((p) => ({
                                ...p,
                                select: sanitizeIdentifierList(e.target.value),
                              }))
                            }
                            list="sql-column-options"
                            placeholder="columns, expressions, aggregates..."
                            className="h-8 text-xs"
                          />
                          <FieldIssues field="select" />
                        </>
                      )}

                      {/* ── FROM ── */}
                      {blockId === "from" && (
                        <>
                          <BlockHeader id="from" />
                          <Input
                            value={blocks.from}
                            onChange={(e) =>
                              updateBlocks((p) => ({
                                ...p,
                                from: e.target.value,
                              }))
                            }
                            list="sql-table-options"
                            placeholder="table_name alias"
                            className="h-8 text-xs"
                          />
                          <FieldIssues field="from" />
                        </>
                      )}

                      {/* ── JOIN ── */}
                      {blockId === "join" && (
                        <>
                          <BlockHeader
                            id="join"
                            right={
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[11px] gap-1"
                                onClick={() =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    joins: [
                                      ...p.joins,
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
                                <Plus className="h-3 w-3" />
                                Join
                              </Button>
                            }
                          />
                          {blocks.joins.length === 0 && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                              No joins.
                            </p>
                          )}
                          {blocks.joins.map((join) => (
                            <div
                              key={join.id}
                              draggable
                              onDragStart={() =>
                                handleRowDragStart("joins", join.id)
                              }
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleRowDrop("joins", join.id)}
                              className="flex items-center gap-1.5 p-1.5 rounded-md bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40"
                            >
                              <GripVertical className="h-3.5 w-3.5 text-slate-400 cursor-grab shrink-0" />
                              <select
                                aria-label="Join type"
                                className="h-7 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-[11px] font-medium shrink-0"
                                value={join.type}
                                onChange={(e) =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    joins: p.joins.map((j) =>
                                      j.id === join.id
                                        ? {
                                            ...j,
                                            type: e.target
                                              .value as JoinBlock["type"],
                                          }
                                        : j,
                                    ),
                                  }))
                                }
                              >
                                {["INNER", "LEFT", "RIGHT", "FULL"].map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <Input
                                className="h-7 text-[11px] flex-1 min-w-0"
                                value={join.table}
                                onChange={(e) =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    joins: p.joins.map((j) =>
                                      j.id === join.id
                                        ? { ...j, table: e.target.value }
                                        : j,
                                    ),
                                  }))
                                }
                                list="sql-table-options"
                                placeholder="table"
                              />
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ON
                              </span>
                              <Input
                                className="h-7 text-[11px] flex-2 min-w-0"
                                value={join.on}
                                onChange={(e) =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    joins: p.joins.map((j) =>
                                      j.id === join.id
                                        ? { ...j, on: e.target.value }
                                        : j,
                                    ),
                                  }))
                                }
                                list="sql-column-options"
                                placeholder="condition"
                              />
                              <button
                                type="button"
                                aria-label="Remove"
                                className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                                onClick={() =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    joins: p.joins.filter(
                                      (j) => j.id !== join.id,
                                    ),
                                  }))
                                }
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <FieldIssues field="joins" />
                        </>
                      )}

                      {/* ── WHERE ── */}
                      {blockId === "where" && (
                        <>
                          <BlockHeader
                            id="where"
                            right={
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[11px] gap-1"
                                onClick={() =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    where: [
                                      ...p.where,
                                      {
                                        id: `where-${Date.now()}`,
                                        field: "",
                                        operator: "=",
                                        value: "",
                                        logic: p.where.length ? "AND" : "AND",
                                      },
                                    ],
                                  }))
                                }
                              >
                                <Plus className="h-3 w-3" />
                                Filter
                              </Button>
                            }
                          />
                          {blocks.where.length === 0 && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                              No filters.
                            </p>
                          )}
                          {blocks.where.map((cond, idx) => (
                            <div
                              key={cond.id}
                              draggable
                              onDragStart={() =>
                                handleRowDragStart("where", cond.id)
                              }
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleRowDrop("where", cond.id)}
                              className="flex items-center gap-1.5 p-1.5 rounded-md bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40"
                            >
                              <GripVertical className="h-3.5 w-3.5 text-slate-400 cursor-grab shrink-0" />
                              {idx > 0 ? (
                                <select
                                  aria-label="Logic"
                                  className="h-7 w-14 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 text-[11px] font-medium shrink-0"
                                  value={cond.logic}
                                  onChange={(e) =>
                                    updateBlocks((p) => ({
                                      ...p,
                                      where: p.where.map((c) =>
                                        c.id === cond.id
                                          ? {
                                              ...c,
                                              logic: e.target.value as
                                                | "AND"
                                                | "OR",
                                            }
                                          : c,
                                      ),
                                    }))
                                  }
                                >
                                  <option value="AND">AND</option>
                                  <option value="OR">OR</option>
                                </select>
                              ) : (
                                <span className="w-14 text-[10px] text-slate-400 shrink-0 text-center">
                                  WHERE
                                </span>
                              )}
                              <Input
                                className="h-7 text-[11px] flex-1 min-w-0"
                                value={cond.field}
                                onChange={(e) =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    where: p.where.map((c) =>
                                      c.id === cond.id
                                        ? { ...c, field: e.target.value }
                                        : c,
                                    ),
                                  }))
                                }
                                list="sql-column-options"
                                placeholder="column"
                              />
                              <select
                                aria-label="Operator"
                                className="h-7 w-14 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 text-[11px] shrink-0"
                                value={cond.operator}
                                onChange={(e) =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    where: p.where.map((c) =>
                                      c.id === cond.id
                                        ? {
                                            ...c,
                                            operator: e.target
                                              .value as WhereBlock["operator"],
                                          }
                                        : c,
                                    ),
                                  }))
                                }
                              >
                                {[
                                  "=",
                                  "!=",
                                  "<",
                                  "<=",
                                  ">",
                                  ">=",
                                  "LIKE",
                                  "IN",
                                ].map((op) => (
                                  <option key={op} value={op}>
                                    {op}
                                  </option>
                                ))}
                              </select>
                              <Input
                                className="h-7 text-[11px] flex-1 min-w-0"
                                value={cond.value}
                                onChange={(e) =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    where: p.where.map((c) =>
                                      c.id === cond.id
                                        ? { ...c, value: e.target.value }
                                        : c,
                                    ),
                                  }))
                                }
                                placeholder="value"
                              />
                              <button
                                type="button"
                                aria-label="Remove"
                                className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                                onClick={() =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    where: p.where.filter(
                                      (c) => c.id !== cond.id,
                                    ),
                                  }))
                                }
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <FieldIssues field="where" />
                        </>
                      )}

                      {/* ── GROUP BY ── */}
                      {blockId === "group" && (
                        <>
                          <BlockHeader id="group" />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={blocks.groupBy.join(", ")}
                              onChange={(e) =>
                                updateBlocks((p) => ({
                                  ...p,
                                  groupBy: sanitizeIdentifierList(
                                    e.target.value,
                                  ),
                                }))
                              }
                              list="sql-column-options"
                              placeholder="columns"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={blocks.having}
                              onChange={(e) =>
                                updateBlocks((p) => ({
                                  ...p,
                                  having: e.target.value,
                                }))
                              }
                              placeholder="HAVING condition"
                              className="h-8 text-xs"
                            />
                          </div>
                        </>
                      )}

                      {/* ── ORDER / LIMIT ── */}
                      {blockId === "order" && (
                        <>
                          <BlockHeader
                            id="order"
                            right={
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[11px] gap-1"
                                onClick={() =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    orderBy: [
                                      ...p.orderBy,
                                      {
                                        id: `order-${Date.now()}`,
                                        field: "",
                                        direction: "ASC",
                                      },
                                    ],
                                  }))
                                }
                              >
                                <Plus className="h-3 w-3" />
                                Sort
                              </Button>
                            }
                          />
                          {blocks.orderBy.map((order) => (
                            <div
                              key={order.id}
                              draggable
                              onDragStart={() =>
                                handleRowDragStart("orderBy", order.id)
                              }
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleRowDrop("orderBy", order.id)}
                              className="flex items-center gap-1.5 p-1.5 rounded-md bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40"
                            >
                              <GripVertical className="h-3.5 w-3.5 text-slate-400 cursor-grab shrink-0" />
                              <Input
                                className="h-7 text-[11px] flex-1 min-w-0"
                                value={order.field}
                                onChange={(e) =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    orderBy: p.orderBy.map((o) =>
                                      o.id === order.id
                                        ? { ...o, field: e.target.value }
                                        : o,
                                    ),
                                  }))
                                }
                                list="sql-column-options"
                                placeholder="column"
                              />
                              <select
                                aria-label="Direction"
                                className="h-7 w-16 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 text-[11px] shrink-0"
                                value={order.direction}
                                onChange={(e) =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    orderBy: p.orderBy.map((o) =>
                                      o.id === order.id
                                        ? {
                                            ...o,
                                            direction: e.target
                                              .value as OrderBlock["direction"],
                                          }
                                        : o,
                                    ),
                                  }))
                                }
                              >
                                <option value="ASC">ASC</option>
                                <option value="DESC">DESC</option>
                              </select>
                              <button
                                type="button"
                                aria-label="Remove"
                                className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                                onClick={() =>
                                  updateBlocks((p) => ({
                                    ...p,
                                    orderBy: p.orderBy.filter(
                                      (o) => o.id !== order.id,
                                    ),
                                  }))
                                }
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <FieldIssues field="orderBy" />
                          <div className="flex items-center gap-2 pt-1">
                            <Label className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                              {dialect === "sqlserver" ? "TOP" : "LIMIT"}
                            </Label>
                            <Input
                              value={blocks.limit}
                              onChange={(e) =>
                                updateBlocks((p) => ({
                                  ...p,
                                  limit: e.target.value,
                                }))
                              }
                              placeholder="e.g. 100"
                              className="h-7 text-xs w-24"
                            />
                            <FieldIssues field="limit" />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {visibleBlocks.length === 0 && (
                  <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                    All blocks are hidden. Use the toggle pills above to show
                    clauses.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: NL + SQL Output (2/5) */}
            <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
              {/* Natural Language — text or voice */}
              <div className="border-b border-slate-200/70 dark:border-slate-800/70 p-3 space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Natural Language
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isVoiceSupported && (
                      <Button
                        size="sm"
                        variant={isVoiceListening ? "destructive" : "outline"}
                        className={cn(
                          "h-6 gap-1 text-[11px]",
                          isVoiceListening && "animate-pulse",
                        )}
                        onClick={toggleVoiceListening}
                        title={
                          isVoiceListening ? "Stop listening" : "Voice input"
                        }
                        aria-label={
                          isVoiceListening
                            ? "Stop voice input"
                            : "Start voice input"
                        }
                      >
                        <Mic className="h-3 w-3" />
                        {isVoiceListening ? "Stop" : "Voice"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px]"
                      disabled={aiLoading}
                      onClick={() => runAiGeneration(naturalLanguage, true)}
                    >
                      {aiLoading ? "Generating…" : "Generate"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={naturalLanguage}
                  onChange={(e) => setNaturalLanguage(e.target.value)}
                  placeholder="e.g. Show id and name from users where status is active, order by name, limit 20"
                  className="min-h-[60px] max-h-[100px] text-xs resize-none"
                />
                {/* Live voice transcript while speaking */}
                {isVoiceListening && voiceInterim && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    Listening: {voiceInterim}
                  </p>
                )}
                {voiceError && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">
                    {voiceError}
                  </p>
                )}
                {/* Example phrases — click to insert */}
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-1 self-center">
                    Try:
                  </span>
                  {[
                    "Show all from users limit 10",
                    "Select name, email from users where status equals active",
                    "Orders where total greater than 100 order by date desc",
                  ].map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      onClick={() =>
                        setNaturalLanguage((prev) =>
                          prev.trim() ? `${prev}; ${phrase}` : phrase,
                        )
                      }
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
                {aiError && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">
                    {aiError}
                  </p>
                )}
                {nlIssues.length > 0 &&
                  nlIssues.map((i) => (
                    <p
                      key={i.id}
                      className="text-[11px] text-amber-600 dark:text-amber-400"
                    >
                      {i.message}
                    </p>
                  ))}
                {aiResponse && (
                  <p className="text-[10px] text-slate-400">
                    Confidence: {Math.round(aiResponse.confidence * 100)}%
                  </p>
                )}
              </div>

              {/* SQL Output — takes remaining space */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/60 dark:bg-slate-800/30 shrink-0">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    SQL{" "}
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      ({DIALECT_LABELS[dialect]})
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] gap-1"
                    onClick={() => copyToClipboard(sql)}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <pre
                  className={cn(
                    "flex-1 min-h-0 overflow-auto p-3 font-mono text-sm leading-relaxed bg-slate-950 text-slate-100",
                    issues.some((i) => i.level === "error") &&
                      "ring-1 ring-inset ring-red-500/40",
                  )}
                >
                  {sql}
                </pre>
                {/* Validation summary */}
                <div className="px-3 py-1.5 border-t border-slate-200/70 dark:border-slate-800/70 shrink-0">
                  {issues.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {issues.map((i) => (
                        <span
                          key={i.id}
                          className={cn(
                            "text-[11px]",
                            i.level === "error"
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {i.level === "error" ? "Error" : "Warning"}:{" "}
                          {i.message}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Valid query
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Datalists for autocomplete */}
          <datalist id="sql-table-options">
            {schemaTableOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <datalist id="sql-column-options">
            {schemaColumnOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
};
