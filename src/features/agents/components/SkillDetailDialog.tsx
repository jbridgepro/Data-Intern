/**
 * File: src/features/agents/components/SkillDetailDialog.tsx
 *
 * Detailed view dialog for ClawdBot skills.
 * Shows skill information, management options, and allows deletion.
 *
 * Front-end component
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Command } from "@tauri-apps/plugin-shell";
import { remove } from "@tauri-apps/plugin-fs";
import { join, homeDir } from "@tauri-apps/api/path";
import {
  X,
  Trash2,
  Power,
  PowerOff,
  Settings,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  Code,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface PluginInfo {
  name: string;
  description?: string;
  emoji?: string;
  eligible?: boolean;
  disabled?: boolean;
  source?: string;
  homepage?: string;
  missing?: {
    bins?: string[];
    env?: string[];
  };
  origin?: string;
  enabled?: boolean;
  status?: string;
  id?: string;
  version?: string;
  toolNames?: string[];
  hookNames?: string[];
  channelIds?: string[];
  providerIds?: string[];
  gatewayMethods?: string[];
  cliCommands?: string[];
  services?: string[];
  commands?: string[];
  httpHandlers?: number;
  hookCount?: number;
  configSchema?: boolean;
  configJsonSchema?: any;
  error?: string;
}

interface Skill extends PluginInfo {
  installed: boolean;
  status: "installed" | "available" | "missing_dependency";
}

interface SkillDetailDialogProps {
  skill: Skill | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const SkillDetailDialog = ({
  skill,
  onClose,
  onRefresh,
}: SkillDetailDialogProps) => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  if (!skill) return null;

  // Define paths for ClawdBot commands
  const NODE22_PATH = "/Users/koo1j/.nvm/versions/node/v22.22.0/bin/node";
  const CLAWDBOT_GLOBAL_PATH = "/usr/local/bin/clawdbot";
  const CLAWDBOT_NVM_PATH =
    "/Users/koo1j/.nvm/versions/node/v22.22.0/bin/clawdbot";

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${skill.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      // Check if it's a bundled plugin (can't be deleted)
      const isBundledCheck =
        skill.origin === "bundled" ||
        skill.source?.includes("clawdbot-bundled");
      if (isBundledCheck) {
        toast({
          title: "Cannot delete bundled skill",
          description:
            "This is a bundled skill and cannot be removed. You can disable it instead.",
          variant: "destructive",
        });
        setIsDeleting(false);
        return;
      }

      // Disable the plugin first
      let disableCmd;
      try {
        disableCmd = Command.create("sh", [
          "-c",
          `${CLAWDBOT_NVM_PATH} plugins disable "${skill.id || skill.name}"`,
        ]);
      } catch {
        disableCmd = Command.create("sh", [
          "-c",
          `${NODE22_PATH} ${CLAWDBOT_GLOBAL_PATH} plugins disable "${
            skill.id || skill.name
          }"`,
        ]);
      }

      await disableCmd.execute();

      // Remove the skill directory from ~/clawd/skills/
      // Use the skill id or name as the directory name
      const skillSlug = skill.id || skill.name;
      const home = await homeDir();
      if (!home) {
        throw new Error("Could not determine home directory");
      }
      const skillsDir = await join(home, "clawd", "skills", skillSlug);

      try {
        // Remove the skill directory
        await remove(skillsDir, { recursive: true });

        toast({
          title: "Skill deleted",
          description: `${skill.name} has been removed.`,
        });
        onRefresh();
        onClose();
      } catch (fsError: any) {
        // If file system removal fails, try using shell command as fallback
        const removeCmd = Command.create("sh", [
          "-c",
          `rm -rf "$HOME/clawd/skills/${skillSlug}"`,
        ]);
        const removeResult = await removeCmd.execute();

        if (removeResult.code === 0) {
          toast({
            title: "Skill deleted",
            description: `${skill.name} has been removed.`,
          });
          onRefresh();
          onClose();
        } else {
          throw new Error(
            removeResult.stderr || "Failed to remove skill directory",
          );
        }
      }
    } catch (error: any) {
      toast({
        title: "Deletion error",
        description: error.message || "Failed to delete skill",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleEnabled = async () => {
    setIsToggling(true);
    try {
      const action = skill.enabled ? "disable" : "enable";
      let cmd;
      try {
        cmd = Command.create("sh", [
          "-c",
          `${CLAWDBOT_NVM_PATH} plugins ${action} "${skill.id || skill.name}"`,
        ]);
      } catch {
        cmd = Command.create("sh", [
          "-c",
          `${NODE22_PATH} ${CLAWDBOT_GLOBAL_PATH} plugins ${action} "${
            skill.id || skill.name
          }"`,
        ]);
      }

      const result = await cmd.execute();

      if (result.code === 0) {
        toast({
          title: `Skill ${action}d`,
          description: `${skill.name} has been ${action}d.`,
        });
        onRefresh();
      } else {
        toast({
          title: "Operation failed",
          description: result.stderr || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Operation error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const isInstalled = skill.installed || skill.status === "installed";
  const isBundled =
    skill.origin === "bundled" || skill.source?.includes("clawdbot-bundled");
  const hasMissingDeps = skill.status === "missing_dependency";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col m-4">
        <CardHeader className="shrink-0 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <span className="text-4xl">{skill.emoji || "📦"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-2xl">{skill.name}</CardTitle>
                  {isInstalled && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Installed
                    </Badge>
                  )}
                  {hasMissingDeps && (
                    <Badge
                      variant="outline"
                      className="text-amber-600 border-amber-200"
                    >
                      <AlertCircle className="w-3 h-3 mr-1" /> Config Needed
                    </Badge>
                  )}
                  {isBundled && (
                    <Badge variant="outline" className="text-blue-600">
                      Bundled
                    </Badge>
                  )}
                </div>
                {skill.version && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Version: {skill.version}
                  </div>
                )}
                {skill.id && skill.id !== skill.name && (
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    ID: {skill.id}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {skill.description && (
            <div className="mt-3">
              <CardDescription className="text-base whitespace-pre-wrap">
                {skill.description}
              </CardDescription>
            </div>
          )}
        </CardHeader>

        <Separator />

        <ScrollArea className="flex-1 min-h-0 px-6">
          <CardContent className="pt-6 space-y-6">
            {/* Status Information */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Status
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Enabled:</span>
                  <span
                    className={cn(
                      skill.enabled ? "text-green-600" : "text-gray-500",
                    )}
                  >
                    {skill.enabled ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span>{skill.status || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origin:</span>
                  <span>{skill.origin || "Unknown"}</span>
                </div>
                {skill.source && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source:</span>
                    <span
                      className="font-mono text-xs truncate max-w-xs"
                      title={skill.source}
                    >
                      {skill.source}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Capabilities */}
            {(skill.toolNames?.length ||
              skill.hookNames?.length ||
              skill.cliCommands?.length ||
              skill.commands?.length) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Capabilities
                  </h3>
                  <div className="space-y-3 text-sm">
                    {skill.toolNames && skill.toolNames.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Tools:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.toolNames.map((tool) => (
                            <Badge
                              key={tool}
                              variant="outline"
                              className="text-xs"
                            >
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {skill.hookNames && skill.hookNames.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Hooks:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.hookNames.map((hook) => (
                            <Badge
                              key={hook}
                              variant="outline"
                              className="text-xs"
                            >
                              {hook}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {skill.cliCommands && skill.cliCommands.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">
                          CLI Commands:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.cliCommands.map((cmd) => (
                            <Badge
                              key={cmd}
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {cmd}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {skill.commands && skill.commands.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Commands:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.commands.map((cmd) => (
                            <Badge
                              key={cmd}
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {cmd}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {skill.httpHandlers !== undefined &&
                      skill.httpHandlers > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            HTTP Handlers:
                          </span>
                          <span>{skill.httpHandlers}</span>
                        </div>
                      )}
                  </div>
                </div>
              </>
            )}

            {/* Missing Dependencies */}
            {hasMissingDeps && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    Missing Dependencies
                  </h3>
                  <div className="space-y-2 text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded">
                    {skill.missing?.bins && skill.missing.bins.length > 0 && (
                      <div>
                        <span className="font-semibold">Missing Binaries:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.missing.bins.map((bin) => (
                            <Badge
                              key={bin}
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              {bin}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {skill.missing?.env && skill.missing.env.length > 0 && (
                      <div>
                        <span className="font-semibold">
                          Missing Environment Variables:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skill.missing.env.map((env) => (
                            <Badge
                              key={env}
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              {env}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Configuration */}
            {skill.configSchema && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configuration
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {skill.configJsonSchema ? (
                      <div className="bg-slate-100 dark:bg-slate-900 rounded p-3">
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(skill.configJsonSchema, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      "This skill supports configuration."
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Error Message */}
            {skill.error && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Error
                  </h3>
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded">
                    {skill.error}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </ScrollArea>

        <Separator />

        {/* Actions */}
        <CardContent className="shrink-0 pt-4 pb-6">
          <div className="flex flex-wrap gap-2 justify-between">
            <div className="flex gap-2">
              {skill.homepage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(skill.homepage, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Documentation
                </Button>
              )}
              {isInstalled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleEnabled}
                  disabled={isToggling}
                >
                  {isToggling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : skill.enabled ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Enable
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {isInstalled && !isBundled && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
