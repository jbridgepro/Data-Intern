/**
 * File: src/features/agents/components/ApprovalInbox.tsx
 *
 * Approval Inbox: agents draft changes, people decide.
 * Two lanes: "Needs you" (anything that removes or overwrites files) and
 * "Can wait" (moves, new copies, new folders). Nothing in either lane touches
 * the disk until it is approved. Applied sets can be undone from History.
 */

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useApprovals } from "../hooks/useApprovals";
import type { ChangeKind, ChangeRisk, ChangeSet, ProposedChange } from "../types";

const KIND_LABEL: Record<ChangeKind, string> = {
  move: "Move",
  copy: "Copy",
  "copy-tree": "Copy folder",
  trash: "Trash",
  "remove-empty-dir": "Remove folder",
  mkdir: "New folder",
};

const RISK_STYLE: Record<ChangeRisk, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

const STATUS_STYLE: Record<ChangeSet["status"], string> = {
  pending: "text-slate-600 border-slate-300",
  applying: "text-blue-600 border-blue-300",
  applied: "text-emerald-700 border-emerald-300 dark:text-emerald-400",
  "partially-applied": "text-amber-700 border-amber-300 dark:text-amber-400",
  rejected: "text-slate-500 border-slate-300",
  failed: "text-red-600 border-red-300",
  undone: "text-slate-500 border-slate-300",
};

/** Shows the last two path segments, which is usually enough to recognize a file. */
const shortPath = (path?: string) => {
  if (!path) return "";
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const ago = (ms: number) => formatDistanceToNow(new Date(ms), { addSuffix: true });

const PAGE = 100;

function ChangeRow({
  change,
  checked,
  onToggle,
}: {
  change: ProposedChange;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-start gap-2 py-1 text-[11px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 rounded px-1">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5 h-3.5 w-3.5" />
      <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", RISK_STYLE[change.risk])} title={`${change.risk} risk`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-medium shrink-0">{KIND_LABEL[change.kind]}</span>
          <span className="truncate text-muted-foreground" title={change.source}>
            {shortPath(change.source)}
          </span>
        </div>
        {change.target && change.kind !== "trash" && (
          <div className="truncate text-muted-foreground" title={change.target}>
            → {shortPath(change.target)}
            {change.overwrite && <span className="text-red-600 dark:text-red-400"> (replaces existing)</span>}
          </div>
        )}
        {change.reason && <div className="truncate text-muted-foreground/70">{change.reason}</div>}
      </div>
    </label>
  );
}

function PendingCard({ set }: { set: ChangeSet }) {
  const { approve, reject } = useApprovals();
  const [open, setOpen] = useState(set.lane === "needs-you");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(set.changes.map(c => c.id)));
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const byRisk = { low: 0, medium: 0, high: 0 } as Record<ChangeRisk, number>;
    let bytes = 0;
    for (const c of set.changes) {
      byRisk[c.risk]++;
      if (c.kind === "trash" && c.size) bytes += c.size;
    }
    return { byRisk, bytes };
  }, [set.changes]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = selected.size === set.changes.length;

  const handleApprove = async () => {
    setBusy(true);
    try {
      await approve(set.id, Array.from(selected));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border/60 bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="font-medium text-foreground/80">{set.agentName}</span>
            <span>·</span>
            <span>{set.trigger === "manual" ? "run by you" : set.trigger === "on-change" ? "files changed" : set.trigger}</span>
            <span>·</span>
            <span>{ago(set.createdAt)}</span>
          </div>
          <div className="text-sm font-medium leading-snug">{set.title}</div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{set.summary}</p>

      <div className="flex flex-wrap gap-1">
        {counts.byRisk.high > 0 && (
          <Badge variant="outline" className="text-[10px] text-red-700 dark:text-red-400 border-red-300/70">
            {counts.byRisk.high} remove or overwrite
          </Badge>
        )}
        {counts.byRisk.medium > 0 && (
          <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400 border-amber-300/70">
            {counts.byRisk.medium} moves
          </Badge>
        )}
        {counts.byRisk.low > 0 && (
          <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-300/70">
            {counts.byRisk.low} additive
          </Badge>
        )}
        {counts.bytes > 0 && (
          <Badge variant="outline" className="text-[10px]">frees {formatBytes(counts.bytes)}</Badge>
        )}
      </div>

      <button
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Review {set.changes.length} change{set.changes.length === 1 ? "" : "s"}
      </button>

      {open && (
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground px-1 cursor-pointer">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() =>
                setSelected(allSelected ? new Set() : new Set(set.changes.map(c => c.id)))
              }
              className="h-3.5 w-3.5"
            />
            Select all
          </label>
          <div className="max-h-64 overflow-y-auto border-l-2 border-border pl-1">
            {set.changes.slice(0, shown).map(change => (
              <ChangeRow
                key={change.id}
                change={change}
                checked={selected.has(change.id)}
                onToggle={() => toggle(change.id)}
              />
            ))}
            {set.changes.length > shown && (
              <button
                className="text-[11px] text-blue-600 dark:text-blue-400 px-1 py-1"
                onClick={() => setShown(s => s + PAGE)}
              >
                Show {Math.min(PAGE, set.changes.length - shown)} more
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={handleApprove}
          disabled={busy || selected.size === 0}
        >
          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
          {allSelected ? "Approve" : `Approve ${selected.size}`}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs flex-1"
          onClick={() => reject(set.id)}
          disabled={busy}
        >
          <X className="mr-1 h-3 w-3" /> Reject
        </Button>
      </div>
    </div>
  );
}

function HistoryRow({ set }: { set: ChangeSet }) {
  const { undo, canUndo } = useApprovals();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failures = (set.failures || []).filter(f => f.changeId !== "undo");

  const handleUndo = async () => {
    setBusy(true);
    setError(null);
    try {
      const problems = await undo(set.id);
      if (problems.length > 0) setError(`${problems.length} item(s) could not be restored`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-2 px-1 border-b border-border/40 last:border-0 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs truncate" title={set.title}>{set.title}</div>
          <div className="text-[10px] text-muted-foreground">
            {set.agentName} · {ago(set.decidedAt || set.createdAt)}
            {set.autoApplied && " · applied automatically"}
            {set.appliedChangeIds && ` · ${set.appliedChangeIds.length} applied`}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[set.status])}>
            {set.status.replace("-", " ")}
          </Badge>
          {canUndo(set) && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={handleUndo} disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
              Undo
            </Button>
          )}
        </div>
      </div>
      {failures.length > 0 && (
        <details className="text-[10px] text-red-600 dark:text-red-400">
          <summary className="cursor-pointer">{failures.length} failed</summary>
          {failures.slice(0, 20).map((f, i) => {
            const change = set.changes.find(c => c.id === f.changeId);
            return (
              <div key={i} className="truncate" title={change?.source}>
                {change ? shortPath(change.source) : "Set"}: {f.error}
              </div>
            );
          })}
        </details>
      )}
      {error && <div className="text-[10px] text-red-600 dark:text-red-400">{error}</div>}
    </div>
  );
}

function Lane({
  title,
  hint,
  icon,
  sets,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  sets: ChangeSet[];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{sets.length}</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {sets.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/70 italic px-1">Nothing here.</div>
      ) : (
        sets.map(set => <PendingCard key={set.id} set={set} />)
      )}
    </section>
  );
}

export const ApprovalInbox = () => {
  const { needsYou, canWait, history, clearHistory } = useApprovals();
  const [showHistory, setShowHistory] = useState(true);

  const empty = needsYou.length === 0 && canWait.length === 0;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-5 pb-6">
        {empty && (
          <div className="text-center py-6 space-y-2">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm font-medium">Inbox is clear</p>
            <p className="text-xs text-muted-foreground">
              Agents draft their changes here. Nothing changes on disk until you approve it.
            </p>
          </div>
        )}

        {!empty && (
          <>
            <Lane
              title="Needs you"
              hint="Removes or overwrites files. Removed files go to the agent trash and can be undone."
              icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              sets={needsYou}
            />
            <Lane
              title="Can wait"
              hint="Moves, new copies and new folders. Set an agent to 'Ask only for risky changes' to apply these automatically."
              icon={<Clock className="h-3.5 w-3.5 text-amber-500" />}
              sets={canWait}
            />
          </>
        )}

        {history.length > 0 && (
          <section className="space-y-1">
            <div className="flex items-center justify-between">
              <button
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
                onClick={() => setShowHistory(s => !s)}
              >
                {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                History
              </button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={clearHistory}>
                Clear
              </Button>
            </div>
            {showHistory && history.map(set => <HistoryRow key={set.id} set={set} />)}
          </section>
        )}
      </div>
    </ScrollArea>
  );
};
