/**
 * File: src/features/ai-assistant/utils/clawdhubToolDiscovery.ts
 *
 * Discovers installed Clawdhub skills and generates context for the AI.
 * Scans ~/clawd/skills, reads package.json/SKILL.md, and provides
 * actionable instructions for the AI to use these skills via shell commands.
 */

import { readDir, readTextFile, stat } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

/**
 * Information about an installed Clawdbot skill.
 */
export interface ClawdhubSkillInfo {
    name: string;
    description: string;
    instructions: string; // Instructions for the AI on how to use it
    path: string;
}

/**
 * Scans for installed Clawdhub skills and returns context for the AI.
 */
export async function getClawdhubSkillsContext(): Promise<string> {
    const skills: ClawdhubSkillInfo[] = [];
    const homeDir = "/Users/koo1j"; // Ideally dynamically determined, but hardcoded for now based on env
    const skillsDir = `${homeDir}/clawd/skills`;
    const nodePath = `${homeDir}/.nvm/versions/node/v22.22.0/bin/node`;

    try {
        const entries = await readDir(skillsDir);

        for (const entry of entries) {
            if (!entry.isDirectory) continue;

            const skillPath = await join(skillsDir, entry.name);

            try {
                // Check for SKILL.md (Instructional skills)
                let skillMd = "";
                try {
                    skillMd = await readTextFile(await join(skillPath, "SKILL.md"));
                } catch (e) {
                    // No SKILL.md
                }

                // Check for package.json (Executable skills)
                let packageJson: any = null;
                try {
                    const pkgContent = await readTextFile(await join(skillPath, "package.json"));
                    packageJson = JSON.parse(pkgContent);
                } catch (e) {
                    // No package.json
                }

                if (packageJson && packageJson.bin) {
                    // It's an executable Node skill
                    const binKeys = Object.keys(packageJson.bin);
                    if (binKeys.length > 0) {
                        const primaryBin = binKeys[0]; // Assume first bin is main
                        const binScript = packageJson.bin[primaryBin];
                        const fullBinPath = await join(skillPath, binScript);

                        skills.push({
                            name: entry.name,
                            description: packageJson.description || `Clawdhub skill: ${entry.name}`,
                            path: skillPath,
                            instructions: `
**Skill: ${entry.name}**
Description: ${packageJson.description}
Usage: This is a CLI tool. Execute it using the 'execute_terminal_command' tool.
Command: \`${nodePath} ${fullBinPath} [args]\`
${skillMd ? `\nAdditional Instructions:\n${skillMd.substring(0, 500)}...` : ""}
`
                        });
                    }
                } else if (skillMd) {
                    // It's a markdown-only skill (e.g. cheat sheet or curl commands)
                    skills.push({
                        name: entry.name,
                        description: `Instructional skill: ${entry.name}`,
                        path: skillPath,
                        instructions: `
**Skill: ${entry.name}**
Description: Instructional skill / Cheat sheet.
Usage: Follow the commands below using 'execute_terminal_command'.
${skillMd.substring(0, 1000)}
`
                    });
                }

            } catch (e) {
                console.warn(`Failed to process skill ${entry.name}`, e);
            }
        }
    } catch (error) {
        console.warn("Failed to scan Clawdhub skills directory", error);
        return "";
    }

    if (skills.length === 0) {
        return "";
    }

    return `
## Installed Clawdhub Skills
You have access to the following extra skills installed on the user's system. 
You can use them by executing the shell commands described below using the \`execute_terminal_command\` tool.

${skills.map(s => s.instructions).join("\n---\n")}
`;
}
