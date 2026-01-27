/**
 * File: src/features/ai-assistant/utils/clawdhubToolDiscovery.ts
 *
 * Discovers installed Clawdhub skills and generates context for the AI.
 * Scans ~/clawd/skills, reads package.json/SKILL.md, and provides
 * actionable instructions for the AI to use these skills via shell commands.
 * Also converts executable skills into ToolDefinitions for direct tool use.
 */

import { readDir, readTextFile, stat } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import type { ToolDefinition } from './toolsRegistry';

/**
 * Information about an installed Clawdbot skill.
 */
export interface ClawdhubSkillInfo {
    name: string;
    description: string;
    instructions: string; // Instructions for the AI on how to use it
    path: string;
    executablePath?: string; // Path to executable for tool-based skills
    nodePath?: string; // Node path to use for execution
    isExecutable?: boolean; // Whether this skill has an executable binary
    skillMd?: string; // Full SKILL.md content for instructional skills
}

/**
 * Scans for installed Clawdhub skills and returns detailed skill information.
 * This is the core discovery function used by both context generation and tool creation.
 */
export async function discoverClawdhubSkills(): Promise<ClawdhubSkillInfo[]> {
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
                            executablePath: fullBinPath,
                            nodePath: nodePath,
                            isExecutable: true,
                            skillMd: skillMd,
                            instructions: `
**Skill: ${entry.name}**
Description: ${packageJson.description}
Usage: This is a CLI tool. You can use it directly via the 'skill_${entry.name}' tool, or execute it using the 'execute_terminal_command' tool.
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
                        isExecutable: false,
                        skillMd: skillMd,
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
        return [];
    }

    return skills;
}

/**
 * Scans for installed Clawdhub skills and returns context for the AI.
 */
export async function getClawdhubSkillsContext(): Promise<string> {
    const skills = await discoverClawdhubSkills();

    if (skills.length === 0) {
        return "";
    }

    // Separate executable and instructional skills
    const executableSkills = skills.filter(s => s.isExecutable);
    const instructionalSkills = skills.filter(s => !s.isExecutable);

    let context = `
## Installed Clawdhub Skills

You have access to ${skills.length} installed skill(s) on the user's system.
`;

    // List executable skills as direct tools
    if (executableSkills.length > 0) {
        context += `
### Executable Skills (Available as Direct Tools)
These skills are available as direct tools you can call:
${executableSkills.map(s => `- **skill_${s.name}**: ${s.description}`).join('\n')}

You can use these skills directly by calling their tool names (e.g., \`skill_${executableSkills[0].name}\`).
Each skill tool accepts arguments as needed - refer to the skill's documentation or use common CLI argument patterns.
`;
    }

    // List instructional skills
    if (instructionalSkills.length > 0) {
        context += `
### Instructional Skills
These skills provide commands and instructions you can execute:
${instructionalSkills.map(s => `- **${s.name}**: ${s.description}`).join('\n')}

Use the \`execute_terminal_command\` tool to run commands from these instructional skills.
`;
    }

    // Add detailed instructions for each skill
    context += `\n### Detailed Skill Information\n\n${skills.map(s => s.instructions).join("\n---\n")}`;

    return context;
}

/**
 * Converts installed Clawdhub skills into ToolDefinitions for direct tool use.
 * Only executable skills (those with package.json bin entries) are converted to tools.
 */
export async function getClawdhubSkillTools(): Promise<ToolDefinition[]> {
    const skills = await discoverClawdhubSkills();
    const tools: ToolDefinition[] = [];

    // Only convert executable skills to tools
    for (const skill of skills) {
        if (skill.isExecutable && skill.executablePath) {
            tools.push({
                name: `skill_${skill.name}`,
                description: `${skill.description} (Clawdhub skill). Use this tool to execute the ${skill.name} skill. Arguments are passed as command-line arguments.`,
                input_schema: {
                    type: 'object',
                    properties: {
                        args: {
                            type: 'array',
                            items: { type: 'string' },
                            description: `Command-line arguments for ${skill.name}. Pass arguments as an array of strings (e.g., ["--option", "value"]).`,
                        },
                        cwd: {
                            type: 'string',
                            description: 'Current working directory for the command. Optional. If not provided, uses the current working directory.',
                        },
                    },
                    required: [],
                },
            });
        }
    }

    return tools;
}
