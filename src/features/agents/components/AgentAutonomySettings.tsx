/**
 * File: src/features/agents/components/AgentAutonomySettings.tsx
 *
 * Per-agent controls for running on its own (schedule) and for how much it
 * may do without asking (approval policy).
 */

import { format } from "date-fns";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import type { AgentConfig, AgentSchedule, ApprovalPolicy, ScheduleFrequency } from "../types";
import { agentScheduler, getWatchedDirectories } from "../services/agentScheduler";

type FrequencyOption = ScheduleFrequency | "off";

const FREQUENCIES: Array<{ value: FrequencyOption; label: string }> = [
  { value: "off", label: "Only when started" },
  { value: "on-change", label: "When files change" },
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "once", label: "Once" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const selectClass =
  "h-7 w-full rounded-md border border-input bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring";

interface Props {
  agent: AgentConfig;
  onUpdate: (updates: Partial<AgentConfig>) => void;
}

export const AgentAutonomySettings = ({ agent, onUpdate }: Props) => {
  const schedule: AgentSchedule = agent.schedule ?? { enabled: false, frequency: "daily", time: "09:00" };
  const frequency: FrequencyOption = schedule.enabled ? schedule.frequency : "off";
  const policy: ApprovalPolicy = agent.approvalPolicy ?? "ask-all";
  const next = agentScheduler.getNextRun(agent);
  const last = agentScheduler.getLastRun(agent.id);
  const watched = getWatchedDirectories(agent);

  // Single-folder agents can pick their folder here. Backup and Sync need two
  // folders and are configured through the AI Assistant ("configure_agent").
  const folderParam =
    agent.type === "cleanup-agent"
      ? "targetDirectories"
      : ["file-organizer", "duplicate-finder", "file-analyzer", "clawdbot"].includes(agent.type)
        ? "targetDirectory"
        : null;
  const currentFolder = folderParam === "targetDirectories"
    ? (Array.isArray(agent.params?.targetDirectories) ? agent.params!.targetDirectories.join(", ") : "")
    : folderParam ? agent.params?.targetDirectory || "" : "";

  const pickFolder = async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false, title: `Folder for ${agent.name}` });
      if (typeof picked !== "string" || !folderParam) return;
      onUpdate({
        params: {
          ...agent.params,
          [folderParam]: folderParam === "targetDirectories" ? [picked] : picked,
        },
      });
    } catch (error) {
      console.warn("Folder picker unavailable:", error);
    }
  };

  const setSchedule = (updates: Partial<AgentSchedule>) =>
    onUpdate({ schedule: { ...schedule, ...updates } });

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="space-y-2 rounded-md border border-border/50 p-2" onClick={stop}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Autonomy</div>

      {folderParam && (
        <div className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Folder</span>
          <button
            type="button"
            className={`${selectClass} flex items-center gap-1 text-left`}
            onClick={pickFolder}
            title={currentFolder || "Choose a folder"}
          >
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{currentFolder || "Choose a folder..."}</span>
          </button>
        </div>
      )}

      <label className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">Runs</span>
        <select
          className={selectClass}
          value={frequency}
          onChange={(e) => {
            const value = e.target.value as FrequencyOption;
            if (value === "off") setSchedule({ enabled: false });
            // Choosing a schedule also switches the agent on, otherwise it would never run.
            else onUpdate({ schedule: { ...schedule, enabled: true, frequency: value }, enabled: true });
          }}
        >
          {FREQUENCIES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>

      {schedule.enabled && ["once", "daily", "weekly", "monthly"].includes(schedule.frequency) && (
        <label className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">At</span>
          <input
            type="time"
            className={selectClass}
            value={schedule.time || "09:00"}
            onChange={(e) => setSchedule({ time: e.target.value })}
          />
        </label>
      )}

      {schedule.enabled && schedule.frequency === "hourly" && (
        <label className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Minute</span>
          <input
            type="number"
            min={0}
            max={59}
            className={selectClass}
            value={Number((schedule.time || "00:00").split(":")[1])}
            onChange={(e) => {
              const minute = Math.min(59, Math.max(0, Number(e.target.value) || 0));
              setSchedule({ time: `00:${String(minute).padStart(2, "0")}` });
            }}
          />
        </label>
      )}

      {schedule.enabled && schedule.frequency === "weekly" && (
        <label className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">On</span>
          <select
            className={selectClass}
            value={schedule.dayOfWeek ?? 1}
            onChange={(e) => setSchedule({ dayOfWeek: Number(e.target.value) })}
          >
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
      )}

      {schedule.enabled && schedule.frequency === "monthly" && (
        <label className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Day</span>
          <input
            type="number"
            min={1}
            max={31}
            className={selectClass}
            value={schedule.dayOfMonth ?? 1}
            onChange={(e) => setSchedule({ dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </label>
      )}

      <label className="grid grid-cols-[72px_1fr] items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">Approval</span>
        <select
          className={selectClass}
          value={policy}
          onChange={(e) => onUpdate({ approvalPolicy: e.target.value as ApprovalPolicy })}
        >
          <option value="ask-all">Ask before every change</option>
          <option value="ask-risky">Ask only for risky changes</option>
        </select>
      </label>

      <div className="text-[10px] text-muted-foreground space-y-0.5">
        {schedule.enabled && schedule.frequency === "on-change" && (
          watched.length > 0
            ? <div>Checks {watched.length} folder(s) for changes about once a minute while the app is open.</div>
            : <div className="text-amber-600 dark:text-amber-400">Set a folder for this agent so it has something to watch.</div>
        )}
        {next && <div>Next run: {format(next, "EEE d MMM, HH:mm")}</div>}
        {last && <div>Last run: {format(last, "EEE d MMM, HH:mm")}</div>}
        {!agent.enabled && schedule.enabled && (
          <div className="text-amber-600 dark:text-amber-400">Agent is disabled, so the schedule is paused.</div>
        )}
        <div>Removing or overwriting files always needs your approval.</div>
      </div>
    </div>
  );
};
