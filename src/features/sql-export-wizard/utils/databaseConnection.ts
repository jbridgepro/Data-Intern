/**
 * File path: src/features/sql-export-wizard/utils/databaseConnection.ts
 * 
 * Backend utility for managing database connections
 * Handles connection string building and connection management
 */

import { DatabaseConnection } from "../types";

/**
 * Builds a connection string based on the connection configuration
 */
export function buildConnectionString(connection: DatabaseConnection): string {
  if (connection.connectionString) {
    return connection.connectionString;
  }

  const parts: string[] = [];

  // Driver selection based on server type
  switch (connection.serverType) {
    case "mssql":
    case "azure-sql":
      parts.push("DRIVER={ODBC Driver 17 for SQL Server}");
      break;
    case "mysql":
      parts.push("DRIVER={MySQL ODBC 8.0 Driver}");
      break;
    case "postgresql":
      parts.push("DRIVER={PostgreSQL Unicode}");
      break;
  }

  // Server
  let server = connection.server;
  if (connection.instance) {
    server = `${server}\\${connection.instance}`;
  }
  if (connection.port && connection.serverType !== "mssql") {
    server = `${server}:${connection.port}`;
  }
  parts.push(`SERVER=${server}`);

  // Database
  const database = connection.database || connection.defaultDatabase || "master";
  parts.push(`DATABASE=${database}`);

  // Authentication
  if (connection.authentication === "windows") {
    parts.push("Trusted_Connection=yes");
  } else if (connection.authentication === "sql-server") {
    if (connection.username) {
      parts.push(`UID=${connection.username}`);
    }
    if (connection.password) {
      parts.push(`PWD=${connection.password}`);
    }
  }

  // Advanced options
  if (connection.encrypt !== undefined) {
    parts.push(`Encrypt=${connection.encrypt ? "yes" : "no"}`);
  }
  if (connection.trustServerCertificate !== undefined) {
    parts.push(`TrustServerCertificate=${connection.trustServerCertificate ? "yes" : "no"}`);
  }
  if (connection.connectionTimeout) {
    parts.push(`Connection Timeout=${connection.connectionTimeout}`);
  }

  return parts.join(";");
}

/**
 * Validates a connection configuration
 */
export function validateConnection(connection: DatabaseConnection): { valid: boolean; error?: string } {
  if (!connection.name || connection.name.trim() === "") {
    return { valid: false, error: "Connection name is required" };
  }

  if (!connection.server || connection.server.trim() === "") {
    return { valid: false, error: "Server address is required" };
  }

  if (connection.authentication === "sql-server") {
    if (!connection.username || connection.username.trim() === "") {
      return { valid: false, error: "Username is required for SQL Server authentication" };
    }
    if (!connection.password || connection.password.trim() === "") {
      return { valid: false, error: "Password is required for SQL Server authentication" };
    }
  }

  if (connection.connectionString && connection.connectionString.trim() === "") {
    return { valid: false, error: "Connection string cannot be empty" };
  }

  return { valid: true };
}

import { invoke } from "@tauri-apps/api/core";

/**
 * Tests a database connection
 */
export async function testConnection(connection: DatabaseConnection): Promise<{
  success: boolean;
  message: string;
  serverVersion?: string;
  databaseCount?: number;
}> {
  // Validate first
  const validation = validateConnection(connection);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.error || "Connection validation failed",
    };
  }

  // Only MSSQL is implemented in the backend for now
  if (connection.serverType === "mssql" || connection.serverType === "azure-sql") {
    try {
      interface MssqlTestResponse {
        success: boolean;
        message: string;
        serverVersion?: string;
      }

      const response = await invoke<MssqlTestResponse>("test_mssql_connection", {
        params: {
          server: connection.server,
          port: connection.port,
          database: connection.database || connection.defaultDatabase,
          username: connection.username,
          password: connection.password,
          authentication: connection.authentication,
          trustServerCertificate: connection.trustServerCertificate,
        }
      });

      return {
        success: response.success,
        message: response.message,
        serverVersion: response.serverVersion,
        databaseCount: response.success ? 1 : 0, // We verify connection, so at least 1 DB exists
      };
    } catch (error) {
      return {
        success: false,
        message: typeof error === 'string' ? error : JSON.stringify(error),
      };
    }
  }

  // Fallback for other types or mock implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: "Connection successful! (Mock - Backend not implemented for this type yet)",
        serverVersion: "Mock Server 1.0",
        databaseCount: 5,
      });
    }, 1000);
  });
}

/**
 * Encrypts password for storage
 * Note: In production, use proper encryption
 */
export function encryptPassword(password: string): string {
  // Placeholder - in production, use proper encryption (e.g., AES-256)
  return btoa(password); // Base64 encoding (not secure, just for demo)
}

/**
 * Decrypts password from storage
 */
export function decryptPassword(encryptedPassword: string): string {
  // Placeholder - in production, use proper decryption
  try {
    return atob(encryptedPassword);
  } catch {
    return "";
  }
}
