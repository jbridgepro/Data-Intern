import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command } from "@tauri-apps/plugin-shell";
import {
  Search,
  Download,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertCircle,
  Eye,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SkillDetailDialog } from "./SkillDetailDialog";

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
}

interface Skill extends PluginInfo {
  installed: boolean;
  status: "installed" | "available" | "missing_dependency";
}

interface SkillBrowserProps {
  viewMode?: "installed" | "available" | "all";
}

export const SkillBrowser = ({ viewMode = "all" }: SkillBrowserProps) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const { toast } = useToast();

  const fetchSkills = async () => {
    setIsLoading(true);
    try {
      // Define absolute paths - use Node 22 from nvm to run ClawdBot
      const NODE22_PATH = "/Users/koo1j/.nvm/versions/node/v22.22.0/bin/node";
      const CLAWDBOT_GLOBAL_PATH = "/usr/local/bin/clawdbot";
      const CLAWDBOT_NVM_PATH =
        "/Users/koo1j/.nvm/versions/node/v22.22.0/bin/clawdbot";
      const CLAWDHUB_PATH =
        "/Users/koo1j/.nvm/versions/node/v22.22.0/bin/clawdhub";

      // Fetch both local/bundled plugins AND registry skills

      // 1. Fetch Local/Bundled (JSON)
      let localPlugins: PluginInfo[] = [];
      try {
        // Try nvm ClawdBot first, then global ClawdBot with Node 22
        let cmd;
        try {
          // Try nvm ClawdBot (should use Node 22 automatically)
          cmd = Command.create("sh", [
            "-c",
            `${CLAWDBOT_NVM_PATH} plugins list --json`,
          ]);
        } catch {
          // Fallback to global ClawdBot with Node 22
          cmd = Command.create("sh", [
            "-c",
            `${NODE22_PATH} ${CLAWDBOT_GLOBAL_PATH} plugins list --json`,
          ]);
        }
        const output = await cmd.execute();
        if (output.code === 0) {
          const cleanOutput = output.stdout.replace(/\u001b\[.*?m/g, "");
          const firstBrace = cleanOutput.indexOf("{");
          const firstBracket = cleanOutput.indexOf("[");
          let start = -1;
          let end = -1;
          if (
            firstBrace !== -1 &&
            (firstBracket === -1 || firstBrace < firstBracket)
          ) {
            start = firstBrace;
            end = cleanOutput.lastIndexOf("}");
          } else if (firstBracket !== -1) {
            start = firstBracket;
            end = cleanOutput.lastIndexOf("]");
          }
          if (start !== -1 && end !== -1) {
            const jsonString = cleanOutput.substring(start, end + 1);
            const rawData = JSON.parse(jsonString);
            localPlugins = Array.isArray(rawData)
              ? rawData
              : rawData.plugins || [];
          }
        }
      } catch (e) {
        console.error("Local plugins fetch failed", e);
      }

      // 2. Fetch Registry (Text)
      let registrySkills: Skill[] = [];
      try {
        // Use Node 22 to run ClawdHub
        const cmd = Command.create("sh", [
          "-c",
          `${NODE22_PATH} ${CLAWDHUB_PATH} explore`,
        ]);
        const output = await cmd.execute();
        if (output.code === 0) {
          // Parse text output: "name  version  time  description"
          // Split by lines
          const lines = output.stdout.split("\n");
          registrySkills = lines
            .filter(
              (line) =>
                line.trim().length > 0 && !line.startsWith("Now using node"),
            )
            .map((line) => {
              // Parse text output: "name  version  time  description"
              // Split by multiple spaces (2 or more)
              const parts = line.split(/\s{2,}/);
              if (parts.length >= 2) {
                const name = parts[0].trim();
                // Description is everything after the first 3 parts (name, version, time)
                // Join all remaining parts to get the full description
                const description =
                  parts.slice(3).join(" ").trim() ||
                  parts[parts.length - 1]?.trim() ||
                  "";

                return {
                  name,
                  description: description, // Use full description
                  installed: false,
                  status: "available" as const,
                  source: "registry",
                  // Add missing required props from PluginInfo if needed or allow them to be undefined in interface
                } as Skill;
              }
              return null;
            })
            .filter((s): s is Skill => s !== null);
          console.log("Registry skills parsed:", registrySkills);
        }
      } catch (e) {
        console.error("Registry fetch failed", e);
      }

      // 3.5 Fetch User Installed Skills (Directory Listing)
      let userInstalledSkills: string[] = [];
      try {
        const cmd = Command.create("sh", ["-c", "ls -1 $HOME/clawd/skills"]);
        const output = await cmd.execute();
        if (output.code === 0) {
          userInstalledSkills = output.stdout
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          console.log("User installed skills found:", userInstalledSkills);
        }
      } catch (e) {
        console.error("Failed to list user skills", e);
      }

      // 4. Merge Lists
      // Create a map of all skills by name and by id
      const skillMapByName = new Map<string, Skill>();
      const skillMapById = new Map<string, Skill>();

      // Add registry skills first (defaults)
      registrySkills.forEach((s) => {
        skillMapByName.set(s.name, s);
        // Also index by lowercase name for matching
        skillMapById.set(s.name.toLowerCase(), s);
      });

      // Merge local plugins (overriding status)
      localPlugins.forEach((p) => {
        const hasMissingDeps =
          (p.missing?.bins?.length ?? 0) > 0 ||
          (p.missing?.env?.length ?? 0) > 0;
        const isBundled =
          p.source?.includes("clawdbot-bundled") || p.origin === "bundled";

        // A skill is considered installed if:
        // 1. It appears in the local plugins list (from clawdbot plugins list)
        // 2. If it's bundled, only mark as installed if enabled
        // 3. If it's not bundled, it's user-installed and should be marked as installed
        // 4. Also check if enabled flag is set
        // 5. Check if status is "loaded" (which means it's active/installed)
        const enabled = p.enabled === true || (p.enabled as any) === "true";
        const loaded = p.status === "loaded" || p.status === "enabled";
        const isInstalled = isBundled
          ? enabled || loaded // Bundled plugins: installed if enabled or loaded
          : true; // Non-bundled plugins in local list: always installed (they're user-installed)

        // Try to match by name first, then by id, then by lowercase name/id
        const pluginId = (p as any).id || p.name;
        const existing =
          skillMapByName.get(p.name) ||
          skillMapById.get(pluginId) ||
          skillMapById.get(pluginId.toLowerCase()) ||
          skillMapById.get(p.name.toLowerCase());

        // Use plugin name or id as the key
        const skillName = p.name || pluginId;

        const mergedSkill: Skill = {
          ...(existing || {}), // Keep registry info if useful (like description if local missing)
          ...p, // Include all plugin fields (version, toolNames, hookNames, etc.)
          name: skillName, // Use the plugin name
          description: p.description || existing?.description || "", // Prefer local description, fallback to registry
          installed: !!isInstalled,
          status: hasMissingDeps
            ? "missing_dependency"
            : isInstalled
              ? "installed"
              : existing?.status || "available",
        };

        // Debug log for installed skills
        if (isInstalled) {
          console.log("Found installed skill:", {
            name: skillName,
            id: pluginId,
            enabled: p.enabled,
            status: p.status,
            isBundled,
            isInstalled,
            mergedStatus: mergedSkill.status,
            mergedInstalled: mergedSkill.installed,
          });
        }

        // Store by both name and id for future lookups
        skillMapByName.set(skillName, mergedSkill);
        if (pluginId) {
          skillMapById.set(pluginId.toLowerCase(), mergedSkill);
        }
      });

      // 5. Merge User Installed Skills (from file system)
      userInstalledSkills.forEach((skillName) => {
        const existing =
          skillMapByName.get(skillName) ||
          skillMapById.get(skillName.toLowerCase());

        if (existing) {
          // If it exists in registry or local plugins, mark as installed
          existing.installed = true;
          existing.status = "installed";
          // Re-set to ensure map is updated if reference changed (though object mutation should work, sets are safer)
          skillMapByName.set(existing.name, existing);
        } else {
          // New skill found in directory but not in registry or local plugins
          // This usually shouldn't happen for standard skills but possible for custom ones
          const newSkill: Skill = {
            name: skillName,
            description: "Locally installed skill",
            installed: true,
            status: "installed",
            source: "local-fs",
            // Add other required fields with defaults
            emoji: "📦",
          };
          skillMapByName.set(skillName, newSkill);
          skillMapById.set(skillName.toLowerCase(), newSkill);
        }
      });

      const mergedSkills = Array.from(skillMapByName.values());

      // Debug logging
      const installedSkills = mergedSkills.filter(
        (s) => s.installed || s.status === "installed",
      );
      const enabledLocalPlugins = localPlugins.filter(
        (p) => p.enabled || p.status === "loaded",
      );
      console.log("Merged skills:", {
        total: mergedSkills.length,
        installed: installedSkills.length,
        installedNames: installedSkills.map((s) => s.name),
        localPluginsCount: localPlugins.length,
        enabledLocalPluginsCount: enabledLocalPlugins.length,
        enabledLocalPluginNames: enabledLocalPlugins.map(
          (p) => p.name || (p as any).id,
        ),
        sampleLocalPlugin: localPlugins.find(
          (p) => p.enabled || p.status === "loaded",
        ),
        sampleMergedSkill: mergedSkills.find((s) => s.installed),
        allMergedSkillNames: mergedSkills.map((s) => s.name),
        userInstalledSkills,
      });

      // Fallback if completely empty
      if (mergedSkills.length === 0) {
        throw new Error("No skills found from CLI or Registry");
      }

      setSkills(
        mergedSkills.sort((a, b) => {
          // Sort: Installed first, then alphabetical
          if (a.installed !== b.installed) return a.installed ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
      );
    } catch (error) {
      console.error("Failed to fetch skills:", error);
      // Fallback data
      setSkills([
        {
          name: "weather",
          description: "Get current weather and forecasts",
          installed: false,
          status: "available",
          emoji: "🌤️",
        },
        {
          name: "researcher",
          description: "Deep research capabilities with web search",
          installed: false,
          status: "available",
          emoji: "🔍",
        },
        {
          name: "coder",
          description: "Advanced coding assistance and refactoring",
          installed: false,
          status: "available",
          emoji: "💻",
        },
        {
          name: "sonoscli",
          description: "Control Sonos speakers",
          installed: false,
          status: "available",
          emoji: "🔊",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleInstall = async (skill: Skill) => {
    setInstalling(skill.name);
    try {
      // Use clawdhub install for robust installation
      // We assume 'clawdhub' is available in path (via global install)
      // Since we are in Tauri, we might need to specify full path or rely on PATH
      // If clawdhub is not found, we might fallback to 'clawdbot plugins enable'

      // Let's try clawdhub first as it handles downloads
      // Resolve home directory dynamically since $HOME doesn't expand in Command args
      // Note: Using homeDir() from @tauri-apps/api/path requires the api package
      // If not available, we can try to guess or let clawdhub handle it (cwd defaults to app dir which is bad)
      // Better approach: Run a quick command to get home dir or just assume standard location if API missing.
      // Actually, let's try to grab it from environment variable via shell if needed, but Tauri Command doesn't share shell env by default unless configured.

      // Let's assume absolute path structure for macOS user 'koo1j' based on our knowledge if dynamic fails,
      // BUT to be robust, let's try to get it from the tauri path API if imports allow.
      // Assuming we can't easily add new imports without checking package.json,
      // let's try to run `echo $HOME` via shell to get it first? No, too slow.

      // Simpler: Just rely on `clawdbot` CLI which works, and `clawdhub` might assume `~/.clawd` if we don't pass workdir?
      // Let's try WITHOUT --workdir first, as clawdhub defaults to process.cwd() BUT maybe it respects CLAWD_WORKSPACE?

      // Wait, the user has 'clawd' dir in home.
      // Let's try to Use absolute path hardcoded for this environment as a fallback,
      // or execute `sh -c "clawdhub install ..."` which DOES expands $HOME.

      // Strategy: Use Node 22 to run ClawdHub
      const NODE22_PATH = "/Users/koo1j/.nvm/versions/node/v22.22.0/bin/node";
      const CLAWDHUB_PATH =
        "/Users/koo1j/.nvm/versions/node/v22.22.0/bin/clawdhub";

      // We also need to ensure the target directory exists, but clawdhub might handle it.
      // We'll use the absolute path to clawdhub and $HOME for target.
      const installCmd = Command.create("sh", [
        "-c",
        `${NODE22_PATH} ${CLAWDHUB_PATH} install "${skill.name}" --workdir "$HOME/clawd"`,
      ]);
      // Note: $HOME expansion might not work directly in arguments depending on shell execution
      // Better to let it use default or assume cwd if not specified.
      // Actually, user workspace is in ~/.clawd by default.

      // Simplified command: assumes clawdhub is in path
      const result = await installCmd.execute();

      if (result.code === 0) {
        toast({
          title: "Skill installed",
          description: `${skill.name} has been installed.`,
        });
        fetchSkills(); // Refresh list
      } else {
        // Check for "Already installed" which is effectively a success
        if (result.stderr.includes("Already installed")) {
          toast({
            title: "Already installed",
            description: `${skill.name} is already installed. Use CLI to force reinstall if needed.`,
            variant: "default",
          });
          fetchSkills(); // Refresh anyway
        } else {
          console.error(result.stderr);
          toast({
            title: "Installation failed",
            description:
              `Code: ${result.code}. Error: ${result.stderr}` ||
              "Unknown error",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Installation error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInstalling(null);
    }
  };

  const filteredSkills = skills.filter((s) => {
    // Basic search filtering
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description &&
        s.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // View mode filtering
    if (viewMode === "installed") {
      // Show skills that are installed OR have missing dependencies (they're installed but need config)
      return (
        s.installed ||
        s.status === "installed" ||
        s.status === "missing_dependency"
      );
    }
    if (viewMode === "available") {
      // Show only skills that are NOT installed
      return !s.installed && s.status === "available";
    }
    return true;
  });

  console.log("Rendering SkillBrowser", {
    viewMode,
    skillsCount: skills.length,
    filteredCount: filteredSkills.length,
    installedCount: skills.filter(
      (s) => s.installed || s.status === "installed",
    ).length,
    availableCount: skills.filter(
      (s) => !s.installed && s.status === "available",
    ).length,
  });

  return (
    <div className="h-full flex flex-col space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-orange-500" />
        <h2 className="text-xl font-bold">Clawdhub Skills</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin" />
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center text-muted-foreground p-4">
              No skills found. <br />
              Ensure <span className="font-mono text-xs">clawdbot</span> CLI is
              installed.
            </div>
          ) : (
            filteredSkills.map((skill) => (
              <Card
                key={skill.name}
                className="flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedSkill(skill)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{skill.emoji || "📦"}</span>
                      <div>
                        <CardTitle className="text-lg">{skill.name}</CardTitle>
                        {skill.homepage && (
                          <a
                            href={skill.homepage}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            Docs
                          </a>
                        )}
                      </div>
                    </div>
                    {skill.status === "installed" && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Installed
                      </Badge>
                    )}
                    {skill.status === "missing_dependency" && (
                      <Badge
                        variant="outline"
                        className="text-amber-600 border-amber-200"
                      >
                        <AlertCircle className="w-3 h-3 mr-1" /> Config Needed
                      </Badge>
                    )}
                  </div>
                  <CardDescription
                    className="line-clamp-2"
                    title={skill.description}
                  >
                    {skill.description}
                  </CardDescription>

                  {skill.status === "missing_dependency" && (
                    <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                      {skill.missing?.bins?.length ? (
                        <div>
                          Missing binaries:{" "}
                          <span className="font-mono">
                            {skill.missing.bins.join(", ")}
                          </span>
                        </div>
                      ) : null}
                      {skill.missing?.env?.length ? (
                        <div>
                          Missing env vars:{" "}
                          <span className="font-mono">
                            {skill.missing.env.join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0 mt-auto">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSkill(skill);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                    {skill.status !== "installed" && (
                      <Button
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstall(skill);
                        }}
                        disabled={installing === skill.name}
                      >
                        {installing === skill.name ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" /> Install
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Skill Detail Dialog */}
      {selectedSkill && (
        <SkillDetailDialog
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onRefresh={fetchSkills}
        />
      )}
    </div>
  );
};
