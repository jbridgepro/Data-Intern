/**
 * File: src/features/agents/services/approvalStore.ts
 *
 * The Approval Inbox. Agents draft changes, people decide.
 *
 * Every agent run that wants to change files submits a ChangeSet here.
 * Depending on the agent's approval policy and the risk of the changes, the
 * set either waits for a person ("Needs you" / "Can wait") or is applied right
 * away. High risk changes (anything that removes or overwrites) always wait.
 */

import type {
  AgentConfig,
  AgentProposal,
  AgentTrigger,
  ChangeSet,
} from '../types';
import {
  applyChanges,
  laneFor,
  materializeChanges,
  newChangeSetId,
  undoChanges,
} from '../utils/changeSets';

const STORAGE_KEY = 'filepro-agent-approvals';
/** Decided change sets kept for history and undo. */
const MAX_DECIDED = 50;

type Listener = (sets: ChangeSet[]) => void;

class ApprovalStore {
  private sets: ChangeSet[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChangeSet[];
      // A set caught mid-apply (app closed) is shown as failed so a person checks it.
      this.sets = parsed.map(s =>
        s.status === 'applying'
          ? { ...s, status: 'failed', failures: [...(s.failures || []), { changeId: '*', error: 'Interrupted while applying' }] }
          : s
      );
    } catch {
      this.sets = [];
    }
  }

  private save() {
    const pending = this.sets.filter(s => s.status === 'pending');
    const decided = this.sets
      .filter(s => s.status !== 'pending')
      .sort((a, b) => (b.decidedAt || b.createdAt) - (a.decidedAt || a.createdAt))
      .slice(0, MAX_DECIDED);
    this.sets = [...pending, ...decided];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sets));
    } catch (error) {
      console.warn('[ApprovalStore] Could not persist approvals:', error);
    }
    const snapshot = this.getAll();
    this.listeners.forEach(l => l(snapshot));
  }

  private update(id: string, updates: Partial<ChangeSet>) {
    this.sets = this.sets.map(s => (s.id === id ? { ...s, ...updates } : s));
    this.save();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getAll(): ChangeSet[] {
    return [...this.sets].sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): ChangeSet | undefined {
    return this.sets.find(s => s.id === id);
  }

  getPending(): ChangeSet[] {
    return this.getAll().filter(s => s.status === 'pending');
  }

  pendingCount(): number {
    return this.sets.filter(s => s.status === 'pending').length;
  }

  /**
   * Records a proposal from an agent run.
   * Applies it immediately only if the policy allows and nothing is high risk.
   */
  async submit(
    agent: AgentConfig,
    proposal: AgentProposal,
    trigger: AgentTrigger
  ): Promise<ChangeSet | null> {
    if (proposal.changes.length === 0) return null;

    const changes = materializeChanges(proposal);
    const lane = laneFor(changes);
    const set: ChangeSet = {
      id: newChangeSetId(),
      agentId: agent.id,
      agentName: agent.name,
      trigger,
      createdAt: Date.now(),
      title: proposal.title,
      summary: proposal.summary,
      changes,
      lane,
      status: 'pending',
    };

    // An agent that re-runs on a schedule should not pile up duplicates:
    // its newer draft replaces an older one that nobody has looked at yet.
    this.sets = this.sets.filter(s => !(s.agentId === agent.id && s.status === 'pending'));
    this.sets.push(set);
    this.save();

    const policy = agent.approvalPolicy || 'ask-all';
    if (policy === 'ask-risky' && lane === 'can-wait') {
      await this.approve(set.id, undefined, true);
    }

    return this.get(set.id) || set;
  }

  /**
   * Applies a pending change set. With `changeIds`, only those changes are applied
   * and the rest are recorded as skipped.
   */
  async approve(id: string, changeIds?: string[], autoApplied = false): Promise<ChangeSet | undefined> {
    const set = this.get(id);
    if (!set || set.status !== 'pending') return set;

    const selected = new Set(changeIds ?? set.changes.map(c => c.id));
    this.update(id, { status: 'applying', autoApplied });

    try {
      const outcome = await applyChanges(set, selected);
      const skipped = set.changes.filter(c => !selected.has(c.id)).map(c => c.id);
      const status =
        outcome.failures.length === 0
          ? 'applied'
          : outcome.appliedChangeIds.length === 0
            ? 'failed'
            : 'partially-applied';
      this.update(id, {
        status,
        decidedAt: Date.now(),
        appliedChangeIds: outcome.appliedChangeIds,
        skippedChangeIds: skipped,
        failures: outcome.failures,
        undoSteps: outcome.undoSteps,
      });
    } catch (error: any) {
      this.update(id, {
        status: 'failed',
        decidedAt: Date.now(),
        failures: [{ changeId: '*', error: error?.message || String(error) }],
      });
    }

    return this.get(id);
  }

  reject(id: string) {
    const set = this.get(id);
    if (!set || set.status !== 'pending') return;
    this.update(id, { status: 'rejected', decidedAt: Date.now() });
  }

  canUndo(set: ChangeSet): boolean {
    return (
      (set.status === 'applied' || set.status === 'partially-applied') &&
      (set.undoSteps?.length || 0) > 0
    );
  }

  async undo(id: string): Promise<string[]> {
    const set = this.get(id);
    if (!set || !this.canUndo(set)) return ['Nothing to undo'];
    const { failures } = await undoChanges(set.undoSteps || []);
    this.update(id, {
      status: 'undone',
      decidedAt: Date.now(),
      failures: [...(set.failures || []), ...failures.map(error => ({ changeId: 'undo', error }))],
    });
    return failures;
  }

  /** Removes decided sets from the history list. Pending sets stay. */
  clearHistory() {
    this.sets = this.sets.filter(s => s.status === 'pending');
    this.save();
  }
}

export const approvalStore = new ApprovalStore();
