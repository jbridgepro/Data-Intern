/**
 * File path: src/features/sql-export-wizard/types.ts
 * 
 * Type definitions for SQL Export Wizard feature
 * Defines interfaces for connections, operations, and data structures
 */

// Connection Types
export type ServerType = 
  | "mssql" 
  | "azure-sql" 
  | "mysql" 
  | "postgresql" 
  | "sqlite";

export type AuthenticationMethod = 
  | "windows" 
  | "sql-server" 
  | "azure-ad" 
  | "connection-string";

export interface DatabaseConnection {
  id: string;
  name: string;
  serverType: ServerType;
  server: string;
  port?: number;
  instance?: string;
  database?: string;
  authentication: AuthenticationMethod;
  username?: string;
  password?: string; // Encrypted in storage
  connectionString?: string;
  defaultDatabase?: string;
  connectionTimeout?: number;
  commandTimeout?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  enableConnectionPooling?: boolean;
  lastConnected?: Date;
  isActive?: boolean;
}

// Database Schema Types
export interface DatabaseSchema {
  name: string;
  tables: DatabaseTable[];
  views: DatabaseView[];
  storedProcedures: StoredProcedure[];
  functions: DatabaseFunction[];
}

export interface DatabaseTable {
  name: string;
  schema: string;
  rowCount?: number;
  size?: number;
  lastUpdated?: string;
  columns: TableColumn[];
}

export interface DatabaseView {
  name: string;
  schema: string;
  definition?: string;
}

export interface StoredProcedure {
  name: string;
  schema: string;
  definition?: string;
}

export interface DatabaseFunction {
  name: string;
  schema: string;
  definition?: string;
}

export interface TableColumn {
  name: string;
  dataType: string;
  maxLength?: number;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: any;
}

// Activity Timeline Types
export type ActivityType = "export" | "import";
export type ActivityStatus = "success" | "warning" | "error";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  timestamp: string;
  status: ActivityStatus;
}

// Export Types
export type ExportFormat = 
  | "csv" 
  | "excel" 
  | "json" 
  | "xml" 
  | "sql" 
  | "parquet";

export interface ExportConfiguration {
  source: {
    database: string;
    schema: string;
    object: string;
    objectType: "table" | "view" | "query";
    useCustomQuery: boolean;
    customQuery?: string;
  };
  format: ExportFormat;
  formatOptions: {
    // CSV options
    delimiter?: string;
    encoding?: string;
    includeHeaders?: boolean;
    quoteStrings?: boolean;
    dateFormat?: string;
    // Excel options
    formatAsTable?: boolean;
    autoFitColumns?: boolean;
    sheetName?: string;
    // JSON options
    jsonFormat?: "array" | "lines";
    prettyPrint?: boolean;
    // XML options
    rootElement?: string;
    rowElement?: string;
    // SQL options
    includeCreateTable?: boolean;
    batchSize?: number;
    // Parquet options
    compression?: string;
  };
  destination: {
    folder: string;
    fileName: string;
    ifExists: "ask" | "overwrite" | "append" | "create-new";
  };
  options: {
    removeDuplicates?: boolean;
    trimWhitespace?: boolean;
    convertNullToEmpty?: boolean;
    exportInBatches?: boolean;
    batchSize?: number;
    limitRows?: boolean;
    rowLimit?: number;
    whereClause?: string;
    selectedColumns?: string[];
  };
}

// Import Types
export interface ImportConfiguration {
  source: {
    file: string;
    fileType: string;
    delimiter?: string;
    textQualifier?: string;
    encoding?: string;
    firstRowHeaders?: boolean;
    skipEmptyRows?: boolean;
    trimWhitespace?: boolean;
    skipRows?: number;
  };
  destination: {
    server: string;
    database: string;
    schema: string;
    table: string;
    createNew: boolean;
    appendToExisting?: string;
    replaceExisting?: string;
  };
  columnMapping: ColumnMapping[];
  options: {
    onRowExists: "insert-only" | "update" | "upsert";
    batchSize?: number;
    useTransactions?: boolean;
    validateData?: boolean;
    createIndexes?: boolean;
    errorHandling: "stop" | "skip" | "log";
    maxErrors?: number;
  };
}

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
  dataType: string;
  maxLength?: number;
  transformations?: ColumnTransformation[];
  constraints?: ColumnConstraints;
}

export interface ColumnTransformation {
  type: "lowercase" | "uppercase" | "trim" | "mask" | "hash" | "format" | "replace";
  value?: string;
}

export interface ColumnConstraints {
  allowNull?: boolean;
  unique?: boolean;
  defaultValue?: any;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
}

// Query Types
export interface QueryBuilderConfig {
  tables: string[];
  columns: string[];
  joins: JoinConfig[];
  whereConditions: WhereCondition[];
  orderBy: OrderByConfig[];
  groupBy?: string[];
  having?: WhereCondition[];
}

export interface JoinConfig {
  type: "inner" | "left" | "right" | "full";
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
}

export interface WhereCondition {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "BETWEEN" | "IS NULL" | "IS NOT NULL";
  value?: any;
  logicalOperator?: "AND" | "OR";
}

export interface OrderByConfig {
  column: string;
  direction: "ASC" | "DESC";
}

// Operation Status
export type OperationStatus = "idle" | "connecting" | "executing" | "success" | "error";

export interface OperationProgress {
  status: OperationStatus;
  progress?: number;
  currentBatch?: number;
  totalBatches?: number;
  rowsProcessed?: number;
  totalRows?: number;
  speed?: number; // rows per second
  elapsedTime?: number;
  remainingTime?: number;
  messages: string[];
  error?: string;
}

// Template Types
export interface ExportTemplate {
  id: string;
  name: string;
  description?: string;
  configuration: ExportConfiguration;
  createdAt: Date;
  lastUsed?: Date;
}

export interface ImportTemplate {
  id: string;
  name: string;
  description?: string;
  configuration: ImportConfiguration;
  createdAt: Date;
  lastUsed?: Date;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  database?: string;
  isFavorite?: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

// Scheduled Export Types
export interface ScheduledExport {
  id: string;
  name: string;
  query?: string;
  table?: string;
  configuration: ExportConfiguration;
  schedule: {
    type: "daily" | "weekly" | "monthly" | "custom";
    time: string;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    cronExpression?: string;
  };
  destination: string;
  format: ExportFormat;
  isEnabled: boolean;
  lastRun?: Date;
  lastResult?: {
    success: boolean;
    rowsExported: number;
    error?: string;
  };
}
