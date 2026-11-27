/**
 * File: src/features/agents/utils/changeSets.ts
 *
 * Risk rules, apply and undo for changes proposed by agents.
 *
 * Agents never touch files directly any more. They describe what they want
 * to do as a list of ProposedChange items; this module decides how risky each
 * change is and performs approved changes in a way that can be undone.
 * Deletes are never permanent: files are moved into an agent trash folder.
 */

import { exists, mkdir, readDir, remove, rename, copyFile } from '@tauri-apps/plugin-fs';
import { dirname, join, basename } from '@tauri-apps/api/path';
import { executeFileCopyTool } from '../../ai-assistant/utils/tabTools';
import type {
  AgentProposal,
  ApprovalLane,
  ChangeRisk,
  ChangeSet,
  ProposedChange,
  UndoStep,
} from '../types';

/** Folder name agents move "deleted" files into. Skipped by agent scans. */
export const AGENT_TRASH_DIR = '.filepro-agent-trash';

/**
 * Builds a trash path for a file that lives under `root`.
 * The relative layout is kept so a restore is obvious to the user.
 */
export function buildTrashPath(root: string, filePath: string, stamp: string): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  const cleanRoot = root.replace(/[\\/]+$/, '');
  const normalized = filePath.replace(/\\/g, '/');
  const normalizedRoot = cleanRoot.replace(/\\/g, '/');
  const relative = normalized.startsWith(normalizedRoot + '/')
    ? normalized.slice(normalizedRoot.length + 1)
    : normalized.split('/').pop() || 'file';
  return [cleanRoot, AGENT_TRASH_DIR, stamp, ...relative.split('/')].join(sep);
}

/** Timestamp usable in a folder name. */
export function trashStamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Risk of one change. High risk always needs a person to approve it.
 */
export function classifyRisk(change: Omit<ProposedChange, 'id' | 'risk'>): ChangeRisk {
  switch (change.kind) {
    case 'trash':
    case 'remove-empty-dir':
      return 'high';
    case 'copy':
      return change.overwrite ? 'high' : 'low';
    case 'move':
      return 'medium';
    case 'copy-tree':
    case 'mkdir':
    default:
      return 'low';
  }
}

/** Lane in the inbox: anything high risk needs you. */
export function laneFor(changes: ProposedChange[]): ApprovalLane {
  return changes.some(c => c.risk === 'high') ? 'needs-you' : 'can-wait';
}

let changeCounter = 0;
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(changeCounter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Turns an executor proposal into a reviewable list of changes. */
export function materializeChanges(proposal: AgentProposal): ProposedChange[] {
  return proposal.changes.map(change => ({
    ...change,
    id: newId('chg'),
    risk: classifyRisk(change),
  }));
}

export const newChangeSetId = () => newId('cs');

async function ensureParent(path: string) {
  const parent = await dirname(path);
  if (!(await exists(parent))) {
    await mkdir(parent, { recursive: true });
  }
}

/**
 * Applies one change. Returns the steps needed to undo it.
 * Throws if the change can no longer be applied safely (source gone,
 * target already exists, folder no longer empty).
 */
async function applyChange(change: ProposedChange): Promise<UndoStep[]> {
  const steps: UndoStep[] = [];

  switch (change.kind) {
    case 'move':
    case 'trash': {
      if (!change.target) throw new Error('No target path');
      if (!(await exists(change.source))) throw new Error('Source no longer exists');
      if (await exists(change.target)) throw new Error('Target already exists');
      await ensureParent(change.target);
      await rename(change.source, change.target);
      steps.push({ action: 'rename', from: change.target, to: change.source });
      return steps;
    }

    case 'copy': {
      if (!change.target) throw new Error('No target path');
      if (!(await exists(change.source))) throw new Error('Source no longer exists');
      await ensureParent(change.target);
      if (await exists(change.target)) {
        if (!change.overwrite) throw new Error('Target already exists');
        // Keep the old version so the overwrite can be undone.
        const parent = await dirname(change.target);
        const name = await basename(change.target);
        const keep = await join(parent, AGENT_TRASH_DIR, trashStamp(), name);
        await ensureParent(keep);
        await rename(change.target, keep);
        steps.push({ action: 'rename', from: keep, to: change.target });
      }
      await copyFile(change.source, change.target);
      // Undo runs steps in reverse: remove the copy first, then restore.
      steps.push({ action: 'remove', path: change.target });
      return steps;
    }

    case 'copy-tree': {
      if (!change.target) throw new Error('No target path');
      const result = await executeFileCopyTool({
        sourcePath: change.source,
        destinationPath: change.target,
        operation: 'copy',
        includeSubdirectories: true,
        overwrite: false,
      });
      if (!result.success) throw new Error(result.error || 'Copy failed');
      // Additive and never overwrites, so there is nothing to undo safely.
      return steps;
    }

    case 'remove-empty-dir': {
      if (!(await exists(change.source))) throw new Error('Folder no longer exists');
      const entries = await readDir(change.source);
      if (entries.length > 0) throw new Error('Folder is no longer empty');
      await remove(change.source);
      steps.push({ action: 'mkdir', path: change.source });
      return steps;
    }

    case 'mkdir': {
      if (await exists(change.source)) return steps;
      await mkdir(change.source, { recursive: true });
      steps.push({ action: 'remove-dir', path: change.source });
      return steps;
    }
  }
}

export interface ApplyOutcome {
  appliedChangeIds: string[];
  failures: Array<{ changeId: string; error: string }>;
  undoSteps: UndoStep[];
}

/**
 * Applies the selected changes of a change set, in order.
 * A failing change does not stop the rest.
 */
export async function applyChanges(
  changeSet: ChangeSet,
  selectedIds: Set<string>,
  onProgress?: (done: number, total: number) => void
): Promise<ApplyOutcome> {
  const selected = changeSet.changes.filter(c => selectedIds.has(c.id));
  const outcome: ApplyOutcome = { appliedChangeIds: [], failures: [], undoSteps: [] };

  for (let i = 0; i < selected.length; i++) {
    const change = selected[i];
    try {
      const steps = await applyChange(change);
      outcome.undoSteps.push(...steps);
      outcome.appliedChangeIds.push(change.id);
    } catch (error: any) {
      outcome.failures.push({ changeId: change.id, error: error?.message || String(error) });
    }
    onProgress?.(i + 1, selected.length);
  }

  return outcome;
}

/**
 * Reverts an applied change set using its recorded undo steps (newest first).
 */
export async function undoChanges(steps: UndoStep[]): Promise<{ failures: string[] }> {
  const failures: string[] = [];

  for (const step of [...steps].reverse()) {
    try {
      switch (step.action) {
        case 'rename':
          if (!step.from || !step.to) break;
          if (!(await exists(step.from))) throw new Error(`Missing ${step.from}`);
          if (await exists(step.to)) throw new Error(`Something already exists at ${step.to}`);
          await ensureParent(step.to);
          await rename(step.from, step.to);
          break;
        case 'remove':
          if (step.path && (await exists(step.path))) await remove(step.path);
          break;
        case 'mkdir':
          if (step.path && !(await exists(step.path))) await mkdir(step.path, { recursive: true });
          break;
        case 'remove-dir':
          if (step.path && (await exists(step.path))) {
            const entries = await readDir(step.path);
            if (entries.length === 0) await remove(step.path);
          }
          break;
      }
    } catch (error: any) {
      failures.push(error?.message || String(error));
    }
  }

  return { failures };
}
