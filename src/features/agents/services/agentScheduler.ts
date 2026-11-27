/**
 * File: src/features/agents/services/agentScheduler.ts
 *
 * Runs agents on their own, so they can be "always on".
 *
 * - Time-based schedules (once, hourly, daily, weekly, monthly) are checked
 *   every 30 seconds. A run missed while the app was closed is made up once
 *   when the app opens again.
 * - 'on-change' schedules poll the agent's folders once a minute and start
 *   the agent when their contents change. Polling is used instead of a native
 *   file watcher so no Rust changes or extra plugin features are needed.
 *
 * Scheduled runs only draft changes. Anything they want to do still goes
 * through the Approval Inbox.
 */

import { readDir, stat } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { AgentConfig, AgentSchedule } from '../types';
import { agentService } from './agentService';
import { AGENT_TRASH_DIR } from '../utils/changeSets';

const STORAGE_KEY = 'filepro-agent-schedule-state';
const TICK_MS = 30_000;
const CHANGE_POLL_MS = 60_000;
/** Wait this long after a run before an on-change trigger may fire again. */
const CHANGE_COOLDOWN_MS = 2 * 60_000;
/** Upper bound on entries read when fingerprinting a folder. */
const MAX_SCAN_ENTRIES = 5_000;
const MAX_SCAN_DEPTH = 6;

interface ScheduleRecord {
  /** When the scheduler first saw this schedule (anchor for the first run). */
  anchorAt: number;
  lastRunAt?: number;
  /** Fingerprint of watched folders, for on-change schedules. */
  signature?: string;
  lastPolledAt?: number;
  /** Schedule settings the anchor belongs to; a change resets the anchor. */
  scheduleKey?: string;
}

/**
 * Parses "HH:MM" into hours and minutes. Defaults to 09:00.
 */
function parseTime(time?: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time || '');
  if (!match) return [9, 0];
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return [hours, minutes];
}

/**
 * Next time a schedule should run, strictly after `after`.
 * Returns null for 'on-change' (event driven) or a 'once' schedule already used.
 */
export function computeNextRun(schedule: AgentSchedule, after: Date, hasRun = false): Date | null {
  const [hours, minutes] = parseTime(schedule.time);
  const next = new Date(after.getTime());
  next.setSeconds(0, 0);

  switch (schedule.frequency) {
    case 'on-change':
      return null;

    case 'once': {
      if (hasRun) return null;
      next.setHours(hours, minutes, 0, 0);
      if (next <= after) next.setDate(next.getDate() + 1);
      return next;
    }

    case 'hourly': {
      next.setMinutes(minutes, 0, 0);
      if (next <= after) next.setHours(next.getHours() + 1);
      return next;
    }

    case 'daily': {
      next.setHours(hours, minutes, 0, 0);
      if (next <= after) next.setDate(next.getDate() + 1);
      return next;
    }

    case 'weekly': {
      const day = schedule.dayOfWeek ?? 1;
      next.setHours(hours, minutes, 0, 0);
      const diff = (day - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + diff);
      if (next <= after) next.setDate(next.getDate() + 7);
      return next;
    }

    case 'monthly': {
      const wanted = schedule.dayOfMonth ?? 1;
      const build = (year: number, month: number) => {
        const lastDay = new Date(year, month + 1, 0).getDate();
        return new Date(year, month, Math.min(wanted, lastDay), hours, minutes, 0, 0);
      };
      let candidate = build(after.getFullYear(), after.getMonth());
      if (candidate <= after) candidate = build(after.getFullYear(), after.getMonth() + 1);
      return candidate;
    }

    default:
      return null;
  }
}

/** Folders an agent works on, for on-change watching. */
export function getWatchedDirectories(agent: AgentConfig): string[] {
  const params = agent.params || {};
  const dirs = [
    params.targetDirectory,
    params.sourceDirectory,
    ...(Array.isArray(params.targetDirectories) ? params.targetDirectories : []),
    ...(Array.isArray(params.sourceDirectories) ? params.sourceDirectories : []),
  ].filter((d): d is string => typeof d === 'string' && d.trim().length > 0);
  return Array.from(new Set(dirs));
}

/**
 * Cheap fingerprint of a folder tree: entry count, total size, newest mtime.
 */
async function fingerprint(directories: string[]): Promise<string> {
  let count = 0;
  let totalSize = 0;
  let newest = 0;

  const walk = async (dir: string, depth: number) => {
    if (count >= MAX_SCAN_ENTRIES || depth > MAX_SCAN_DEPTH) return;
    let entries;
    try {
      entries = await readDir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count >= MAX_SCAN_ENTRIES) return;
      if (entry.name.startsWith('.') || entry.name === AGENT_TRASH_DIR) continue;
      count++;
      const path = await join(dir, entry.name);
      if (entry.isDirectory) {
        await walk(path, depth + 1);
      } else {
        try {
          const info = await stat(path);
          totalSize += info.size;
          const mtime = info.mtime ? new Date(info.mtime).getTime() : 0;
          if (mtime > newest) newest = mtime;
        } catch {
          // Unreadable files do not count
        }
      }
    }
  };

  for (const dir of directories) {
    await walk(dir, 0);
  }
  return `${count}:${totalSize}:${newest}`;
}

const scheduleKey = (schedule: AgentSchedule) =>
  [schedule.frequency, schedule.time, schedule.dayOfWeek, schedule.dayOfMonth].join('|');

class AgentScheduler {
  private records: Record<string, ScheduleRecord> = {};
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor() {
    try {
      this.records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      this.records = {};
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      // Non-fatal
    }
  }

  /** Starts the background loop. Safe to call more than once. */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private recordFor(agent: AgentConfig, schedule: AgentSchedule): ScheduleRecord {
    const key = scheduleKey(schedule);
    const existing = this.records[agent.id];
    if (!existing || existing.scheduleKey !== key) {
      // New or edited schedule: count from now, keep the last run time.
      this.records[agent.id] = {
        anchorAt: Date.now(),
        lastRunAt: existing?.lastRunAt,
        scheduleKey: key,
      };
      this.save();
    }
    return this.records[agent.id];
  }

  /** When an agent will next run, for display. Null if not scheduled. */
  getNextRun(agent: AgentConfig): Date | null {
    const schedule = agent.schedule;
    if (!agent.enabled || !schedule?.enabled) return null;
    const record = this.records[agent.id];
    const sameSchedule = record?.scheduleKey === scheduleKey(schedule);
    if (!sameSchedule) return computeNextRun(schedule, new Date());
    const ranSinceAnchor = (record.lastRunAt ?? 0) >= record.anchorAt;
    const base = Math.max(record.anchorAt, record.lastRunAt ?? 0);
    return computeNextRun(schedule, new Date(base), ranSinceAnchor);
  }

  getLastRun(agentId: string): Date | null {
    const at = this.records[agentId]?.lastRunAt;
    return at ? new Date(at) : null;
  }

  private async run(agent: AgentConfig, trigger: 'schedule' | 'on-change') {
    const record = this.records[agent.id];
    record.lastRunAt = Date.now();
    this.save();
    try {
      await agentService.startAgent(agent.id, trigger);
      await agentService.waitForAgent(agent.id);
    } catch (error) {
      console.warn(`[AgentScheduler] ${agent.name} failed to start:`, error);
    }
    if (agent.schedule?.frequency === 'once') {
      agentService.updateAgent(agent.id, { schedule: { ...agent.schedule, enabled: false } });
    }
    if (trigger === 'on-change' || agent.schedule?.frequency === 'on-change') {
      // Re-baseline so the agent's own scan does not count as a change.
      record.signature = await fingerprint(getWatchedDirectories(agent));
      this.save();
    }
  }

  private async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();

      for (const agent of agentService.getAgents()) {
        const schedule = agent.schedule;
        if (!agent.enabled || !schedule?.enabled) continue;
        if (agentService.isAgentBusy(agent.id)) continue;

        const record = this.recordFor(agent, schedule);

        if (schedule.frequency === 'on-change') {
          if (record.lastPolledAt && now - record.lastPolledAt < CHANGE_POLL_MS) continue;
          const dirs = getWatchedDirectories(agent);
          if (dirs.length === 0) continue;
          record.lastPolledAt = now;
          const signature = await fingerprint(dirs);
          const changed = record.signature !== undefined && record.signature !== signature;
          record.signature = signature;
          this.save();
          const cooledDown = !record.lastRunAt || now - record.lastRunAt >= CHANGE_COOLDOWN_MS;
          if (changed && cooledDown) {
            // Not awaited: a long run must not hold up other agents' checks.
            void this.run(agent, 'on-change');
          }
          continue;
        }

        const next = this.getNextRun(agent);
        if (next && next.getTime() <= now) {
          void this.run(agent, 'schedule');
        }
      }

      // Forget agents that were deleted.
      for (const id of Object.keys(this.records)) {
        if (!agentService.getAgent(id)) delete this.records[id];
      }
      this.save();
    } finally {
      this.ticking = false;
    }
  }
}

export const agentScheduler = new AgentScheduler();
