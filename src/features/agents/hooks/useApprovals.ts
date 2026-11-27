/**
 * File: src/features/agents/hooks/useApprovals.ts
 *
 * React access to the Approval Inbox.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ChangeSet } from '../types';
import { approvalStore } from '../services/approvalStore';

export const useApprovals = () => {
  const [changeSets, setChangeSets] = useState<ChangeSet[]>(() => approvalStore.getAll());

  useEffect(() => approvalStore.subscribe(setChangeSets), []);

  const approve = useCallback(
    (id: string, changeIds?: string[]) => approvalStore.approve(id, changeIds),
    []
  );
  const reject = useCallback((id: string) => approvalStore.reject(id), []);
  const undo = useCallback((id: string) => approvalStore.undo(id), []);
  const clearHistory = useCallback(() => approvalStore.clearHistory(), []);

  const pending = changeSets.filter(s => s.status === 'pending');

  return {
    changeSets,
    pending,
    needsYou: pending.filter(s => s.lane === 'needs-you'),
    canWait: pending.filter(s => s.lane === 'can-wait'),
    history: changeSets.filter(s => s.status !== 'pending'),
    pendingCount: pending.length,
    approve,
    reject,
    undo,
    clearHistory,
    canUndo: (set: ChangeSet) => approvalStore.canUndo(set),
  };
};
