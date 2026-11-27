# Open Source Agent Patterns

## Context

In November 2026 the big AI labs launched "always-on" agents, and open source rebuilt them within weeks:

| Open source agent | Rebuilds | Pattern we take from it |
|---|---|---|
| OpenDuet (CopilotKit) | Claude Duet | Sorts work into "needs me" and "can wait", drafts actions, does nothing until approved |
| OpenBot (CopilotKit) | Grok Bot | Each bot gets its own sandbox, model and tool allowlist |
| OpenMuse / nanoMuse | Muse | You can watch the agent and take over at any time |
| Open Dots | OpenAI dots | A team of specialist bots with a lead that hands off work |

These projects are Bun web templates with mixed licenses (nanoMuse is GPL). This app is Tauri + React + Rust under MIT, so we copy the **patterns**, not the code.

## Phases

0. **Make agents real and always-on** (done): scheduler, real AI calls for Clawdbot and the task agent.
1. **Approve before acting** (done): Approval Inbox, inspired by OpenDuet.
2. Specialist team (Open Dots): a lead agent breaks a goal into steps and routes them to the built-in agents.
3. Own sandbox per agent (OpenBot): per-agent folder allowlist, model and tool permissions.
4. Watch and take over (OpenMuse, optional): live activity view with pause, step and take over.

## What Phases 0 and 1 changed

### Agents draft, people decide

Executors no longer touch the disk. They return an `AgentProposal` (a list of changes), and
`agentService` hands it to `approvalStore`.

- Change kinds: `move`, `copy`, `copy-tree`, `trash`, `remove-empty-dir`, `mkdir` (`src/features/agents/types.ts`).
- Risk (`utils/changeSets.ts`): `trash`, `remove-empty-dir` and overwriting `copy` are **high**; `move` is medium; the rest are low.
- Lanes: any high-risk change puts the set in **Needs you**, otherwise **Can wait**.
- Per-agent `approvalPolicy`:
  - `ask-all` (default): every set waits.
  - `ask-risky`: sets with no high-risk change apply automatically.
  - High-risk changes always wait, whatever the policy.
- Deletes are never permanent. Files go to `<folder>/.filepro-agent-trash/<timestamp>/...`. Overwritten files are kept there too.
- Applied sets record undo steps, and the Inbox History has an **Undo** button.
- Apply re-checks each change: a missing source, an existing target or a folder that is no longer empty fails that change and leaves the disk alone.
- A newer draft from the same agent replaces an older pending one, so scheduled agents do not pile up duplicates.

### Always-on

`services/agentScheduler.ts`, started from `App.tsx`:

- `once`, `hourly`, `daily`, `weekly`, `monthly`: checked every 30 s. A run missed while the app was closed is made up once on next launch.
- `on-change`: fingerprints the agent's folders (entry count, total size, newest mtime) about once a minute and runs the agent when they change. It has a 2 minute cooldown and re-baselines after each run. It uses polling rather than a native watcher so no Rust or plugin changes are needed. Switching to `tauri-plugin-fs`'s `watch` feature is a possible later improvement.
- Scheduled runs still only draft. Approval rules apply unchanged.

### Real AI agents

- `completeWithAI()` in `ai-assistant/utils/aiService.ts`: a one-shot completion with the configured provider (Anthropic, Ollama or OpenRouter), with an optional per-agent model override.
- Clawdbot reads its folder and writes a short brief ("what needs attention now, what can wait"). It never changes files.
- Task agent: a subagent whose `tools` names a built-in agent (e.g. `duplicate-finder`) runs it. Other subagents ask the model about their goal, and later subagents see earlier notes. Drafted changes are merged into one set for review.

### UI

- Agents panel: new **Inbox** tab with a red or amber count badge, which also shows on the floating agents button.
- Inbox cards show risk chips and space freed, and let you review and deselect individual changes before approving.
- Built-in agents now appear in the Agents tab. Each card has an **Autonomy** section with a folder, schedule, time and approval policy.

## Behavior changes to note

- Duplicate Finder now drafts the removal of duplicates by default (`proposeRemoval`, replacing `autoRemove`). Nothing is removed without approval.
- Cleanup, Sync and Backup metrics now report what was found or drafted, not what was done.
- `copy-tree` (Backup) is additive and never overwrites, so it has no undo.

## Verification

- `npm run build` (type check + Vite build) passes.
- The apply, undo, auto-apply, partial-approve, stale-change, no-clobber and schedule-maths logic was exercised against real temp files with the Tauri fs API mocked by Node `fs`.
- The Inbox and Autonomy UI were checked in a browser with seeded data. Approving from the UI needs the Tauri app, which was not run.
