/**
 * File path: src/features/sql-export-wizard/components/ConnectionDialog.tsx
 *
 * Frontend component for creating/editing database connections
 * Comprehensive connection configuration dialog
 */

import { useState, useEffect } from "react";
import {
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Database,
  Server,
  Key,
  Settings,
} from "lucide-react";
import { DatabaseConnection, ServerType, AuthenticationMethod } from "../types";
import {
  validateConnection,
  testConnection,
  buildConnectionString,
} from "../utils/databaseConnection";
import { saveConnection } from "../utils/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ConnectionDialogProps {
  connection: DatabaseConnection | null;
  onSave: (connection: DatabaseConnection) => void;
  onClose: () => void;
}

export function ConnectionDialog({
  connection,
  onSave,
  onClose,
}: ConnectionDialogProps) {
  const [formData, setFormData] = useState<Partial<DatabaseConnection>>({
    name: "",
    serverType: "mssql",
    server: "",
    port: 1433,
    instance: "",
    authentication: "windows",
    username: "",
    password: "",
    defaultDatabase: "master",
    connectionTimeout: 15,
    commandTimeout: 30,
    encrypt: true,
    trustServerCertificate: true,
    enableConnectionPooling: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    serverVersion?: string;
    databaseCount?: number;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (connection) {
      setFormData(connection);
    } else {
      // Generate new ID for new connection
      setFormData((prev) => ({
        ...prev,
        id: `conn-${Date.now()}`,
      }));
    }
  }, [connection]);

  const handleChange = (field: keyof DatabaseConnection, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleTest = async () => {
    const connectionToTest: DatabaseConnection = {
      id: formData.id || `conn-${Date.now()}`,
      name: formData.name || "",
      serverType: formData.serverType || "mssql",
      server: formData.server || "",
      port: formData.port,
      instance: formData.instance,
      authentication: formData.authentication || "windows",
      username: formData.username,
      password: formData.password,
      defaultDatabase: formData.defaultDatabase || "master",
      connectionTimeout: formData.connectionTimeout,
      commandTimeout: formData.commandTimeout,
      encrypt: formData.encrypt,
      trustServerCertificate: formData.trustServerCertificate,
      enableConnectionPooling: formData.enableConnectionPooling,
    };

    const validation = validateConnection(connectionToTest);
    if (!validation.valid) {
      setTestResult({
        success: false,
        message: validation.error || "Validation failed",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(connectionToTest);
      setTestResult(result);
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

  const handleSave = () => {
    const connectionToSave: DatabaseConnection = {
      id: formData.id || `conn-${Date.now()}`,
      name: formData.name || "",
      serverType: formData.serverType || "mssql",
      server: formData.server || "",
      port: formData.port,
      instance: formData.instance,
      authentication: formData.authentication || "windows",
      username: formData.username,
      password: formData.password,
      defaultDatabase: formData.defaultDatabase || "master",
      connectionTimeout: formData.connectionTimeout,
      commandTimeout: formData.commandTimeout,
      encrypt: formData.encrypt,
      trustServerCertificate: formData.trustServerCertificate,
      enableConnectionPooling: formData.enableConnectionPooling,
    };

    const validation = validateConnection(connectionToSave);
    if (!validation.valid) {
      setErrors({ name: validation.error || "Validation failed" });
      return;
    }

    saveConnection(connectionToSave);
    onSave(connectionToSave);
  };

  const connectionString = buildConnectionString(
    formData as DatabaseConnection,
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="h-5 w-5" />
            SQL SERVER CONNECTION
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Connection Name */}
          <div>
            <Label htmlFor="name">Connection Name</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Production Server"
              className="mt-1"
            />
            {errors.name && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {errors.name}
              </p>
            )}
          </div>

          {/* Server Type */}
          <div>
            <Label htmlFor="serverType">Server Type</Label>
            <Select
              value={formData.serverType || "mssql"}
              onValueChange={(value) =>
                handleChange("serverType", value as ServerType)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mssql">Microsoft SQL Server</SelectItem>
                <SelectItem value="azure-sql">Azure SQL Database</SelectItem>
                <SelectItem value="mysql">MySQL / MariaDB</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Server Details */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Server Details
            </h3>

            <div>
              <Label htmlFor="server">Server</Label>
              <Input
                id="server"
                value={formData.server || ""}
                onChange={(e) => handleChange("server", e.target.value)}
                placeholder="C2SST131"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port || 1433}
                  onChange={(e) =>
                    handleChange("port", parseInt(e.target.value) || 1433)
                  }
                  placeholder="1433"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Default: 1433
                </p>
              </div>

              <div>
                <Label htmlFor="instance">Instance (Optional)</Label>
                <Input
                  id="instance"
                  value={formData.instance || ""}
                  onChange={(e) => handleChange("instance", e.target.value)}
                  placeholder="SQLEXPRESS"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Key className="h-4 w-4" />
              Authentication
            </h3>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="auth-windows"
                  name="authentication"
                  checked={formData.authentication === "windows"}
                  onChange={() => handleChange("authentication", "windows")}
                  className="w-4 h-4"
                />
                <Label
                  htmlFor="auth-windows"
                  className="font-normal cursor-pointer"
                >
                  Windows Authentication (Integrated Security)
                </Label>
              </div>

              {formData.authentication === "windows" && (
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-6">
                  Current User:{" "}
                  {typeof window !== "undefined" ? "DOMAIN\\user" : "N/A"}
                </p>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="auth-sql"
                  name="authentication"
                  checked={formData.authentication === "sql-server"}
                  onChange={() => handleChange("authentication", "sql-server")}
                  className="w-4 h-4"
                />
                <Label
                  htmlFor="auth-sql"
                  className="font-normal cursor-pointer"
                >
                  SQL Server Authentication
                </Label>
              </div>

              {formData.authentication === "sql-server" && (
                <div className="ml-6 space-y-3">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username || ""}
                      onChange={(e) => handleChange("username", e.target.value)}
                      placeholder="sa"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password || ""}
                        onChange={(e) =>
                          handleChange("password", e.target.value)
                        }
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember-password" defaultChecked />
                    <Label
                      htmlFor="remember-password"
                      className="font-normal cursor-pointer text-xs"
                    >
                      Remember password
                    </Label>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="auth-azure"
                  name="authentication"
                  checked={formData.authentication === "azure-ad"}
                  onChange={() => handleChange("authentication", "azure-ad")}
                  className="w-4 h-4"
                />
                <Label
                  htmlFor="auth-azure"
                  className="font-normal cursor-pointer"
                >
                  Azure Active Directory
                </Label>
              </div>

              {formData.authentication === "azure-ad" && (
                <div className="ml-6">
                  <Button variant="outline" size="sm">
                    Sign in with Microsoft
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="auth-string"
                  name="authentication"
                  checked={formData.authentication === "connection-string"}
                  onChange={() =>
                    handleChange("authentication", "connection-string")
                  }
                  className="w-4 h-4"
                />
                <Label
                  htmlFor="auth-string"
                  className="font-normal cursor-pointer"
                >
                  Connection String (Advanced)
                </Label>
              </div>

              {formData.authentication === "connection-string" && (
                <div className="ml-6">
                  <Label htmlFor="connectionString">Connection String</Label>
                  <Input
                    id="connectionString"
                    value={formData.connectionString || ""}
                    onChange={(e) =>
                      handleChange("connectionString", e.target.value)
                    }
                    placeholder="Server=C2SST131;Database=master;..."
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Advanced Options */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Advanced Options
            </h3>

            <div>
              <Label htmlFor="defaultDatabase">Default Database</Label>
              <Select
                value={formData.defaultDatabase || "master"}
                onValueChange={(value) =>
                  handleChange("defaultDatabase", value)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">master</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="connectionTimeout">
                  Connection Timeout (seconds)
                </Label>
                <Input
                  id="connectionTimeout"
                  type="number"
                  value={formData.connectionTimeout || 15}
                  onChange={(e) =>
                    handleChange(
                      "connectionTimeout",
                      parseInt(e.target.value) || 15,
                    )
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="commandTimeout">
                  Command Timeout (seconds)
                </Label>
                <Input
                  id="commandTimeout"
                  type="number"
                  value={formData.commandTimeout || 30}
                  onChange={(e) =>
                    handleChange(
                      "commandTimeout",
                      parseInt(e.target.value) || 30,
                    )
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="encrypt"
                  checked={formData.encrypt}
                  onCheckedChange={(checked) =>
                    handleChange("encrypt", checked)
                  }
                />
                <Label htmlFor="encrypt" className="font-normal cursor-pointer">
                  Encrypt connection
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trustServerCertificate"
                  checked={formData.trustServerCertificate}
                  onCheckedChange={(checked) =>
                    handleChange("trustServerCertificate", checked)
                  }
                />
                <Label
                  htmlFor="trustServerCertificate"
                  className="font-normal cursor-pointer"
                >
                  Trust server certificate
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enableConnectionPooling"
                  checked={formData.enableConnectionPooling}
                  onCheckedChange={(checked) =>
                    handleChange("enableConnectionPooling", checked)
                  }
                />
                <Label
                  htmlFor="enableConnectionPooling"
                  className="font-normal cursor-pointer"
                >
                  Enable connection pooling
                </Label>
              </div>
            </div>
          </div>

          {/* Connection String Preview */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
            <Label className="text-xs text-slate-500 dark:text-slate-400 mb-2 block">
              Connection String Preview:
            </Label>
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-2 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
              {connectionString}
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={cn(
                "p-3 rounded-lg flex items-start gap-2",
                testResult.success
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-red-50 dark:bg-red-900/20",
              )}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={cn(
                    "font-medium",
                    testResult.success
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300",
                  )}
                >
                  {testResult.message}
                </p>
                {testResult.success && testResult.serverVersion && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Server Version: {testResult.serverVersion}
                  </p>
                )}
                {testResult.success &&
                  testResult.databaseCount !== undefined && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Databases: {testResult.databaseCount} accessible
                    </p>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <Button onClick={handleSave}>Save</Button>
          <Button
            onClick={() => {
              handleSave();
              onClose();
            }}
          >
            Save & Connect
          </Button>
        </div>
      </div>
    </div>
  );
}
