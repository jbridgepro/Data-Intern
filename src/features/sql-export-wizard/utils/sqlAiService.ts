/**
 * File path: src/features/sql-export-wizard/utils/sqlAiService.ts
 *
 * Internal SQL AI and schema service wrappers (Tauri commands).
 */

import { invoke } from "@tauri-apps/api/core";
import { DatabaseConnection, DatabaseTable } from "../types";
import { decryptPassword } from "./databaseConnection";

export type SqlAiJoin = {
  id: string;
  type: "INNER" | "LEFT" | "RIGHT" | "FULL";
  table: string;
  on: string;
};

export type SqlAiWhere = {
  id: string;
  field: string;
  operator: "=" | "!=" | "<" | "<=" | ">" | ">=" | "LIKE" | "IN";
  value: string;
  logic: "AND" | "OR";
};

export type SqlAiOrder = {
  id: string;
  field: string;
  direction: "ASC" | "DESC";
};

export type SqlAiBlocks = {
  distinct: boolean;
  select: string[];
  from: string;
  joins: SqlAiJoin[];
  where: SqlAiWhere[];
  groupBy: string[];
  having: string;
  orderBy: SqlAiOrder[];
  limit: string;
};

export type SqlAiSourceMapItem = {
  source: string;
  target: string;
};

export type SqlAiResponse = {
  confidence: number;
  trace: string[];
  warnings?: string[];
  sourceMap?: SqlAiSourceMapItem[];
  blocks: SqlAiBlocks;
};

export type SchemaResponse = {
  tables: DatabaseTable[];
};

export async function fetchDatabaseSchema(
  connection: DatabaseConnection,
): Promise<SchemaResponse> {
  const params = {
    serverType: connection.serverType,
    server: connection.server,
    port: connection.port,
    database: connection.database || connection.defaultDatabase,
    username: connection.username,
    password: connection.password ? decryptPassword(connection.password) : undefined,
    authentication: connection.authentication,
    trustServerCertificate: connection.trustServerCertificate,
  };

  return invoke<SchemaResponse>("get_database_schema", { params });
}

export async function generateSqlFromNaturalLanguage(params: {
  text: string;
  dialect: string;
  tablesInScope: string[];
  availableTables: string[];
  availableColumns: string[];
  baseUrl?: string;
  model?: string;
}): Promise<SqlAiResponse> {
  return invoke<SqlAiResponse>("nl_to_sql", {
    params: {
      text: params.text,
      dialect: params.dialect,
      tablesInScope: params.tablesInScope,
      availableTables: params.availableTables,
      availableColumns: params.availableColumns,
      baseUrl: params.baseUrl,
      model: params.model,
    },
  });
}
