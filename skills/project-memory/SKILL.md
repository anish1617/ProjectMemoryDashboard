---
name: project-memory
description: Add a Git project to the local Project Memory dashboard, resume its context, or update its memory with evidence-aware checkpoints after development and testing. Use when asked to register a project, remember project progress, save a checkpoint, or maintain Project Memory during a chat.
---

# Project Memory

Use the installed local tool from any project workspace. Default binding for this machine:

- CLI: `D:/personal-project-2/ProjectsMemoryDashboard/packages/cli/dist/index.js`
- Shared database: `D:/personal-project-2/ProjectsMemoryDashboard/.project-memory/dashboard.sqlite`
- Dashboard: `http://127.0.0.1:4319/`

Honor an explicit alternative database. Keep all operations for a project on that same database. The dashboard must use it too. This skill uses the CLI without requiring MCP setup or external analysis. Node.js and the built local tool are required. If assets are missing, build from the tool root with `pnpm build`; never initialize a replacement database silently.

## Identify and add

Resolve the user's selected repository, or the current conversation's workspace if they say “this project.” Run `git -C "<workspace>" rev-parse --show-toplevel` to find its actual root. Use that absolute root in every command; do not accidentally register the tool's own directory. If several repositories are plausible, ask which one. Non-Git folders are currently unsupported; do not initialize Git merely by invoking this skill.

```powershell
node "D:/personal-project-2/ProjectsMemoryDashboard/packages/cli/dist/index.js" onboard "<absolute-repository-root>" --db "D:/personal-project-2/ProjectsMemoryDashboard/.project-memory/dashboard.sqlite"
```

Onboarding is idempotent, local and deterministic. When the user supplied meaningful context, follow it with a checkpoint. Registration alone does not import conversations or prove feature completion. Prefer `resume` for a returning project; it refreshes repository evidence and prints bounded context. Report freshness and omitted scan coverage.

## Save progress

Read relevant current changes and test results from this conversation. Distinguish completed/tested, partial, failed and environment-blocked work. Summarize the feature, actual checks/results, decisions, remaining limits and a concrete next action. Never describe an unrun check as passed. Do not persist hidden reasoning, raw transcripts, credentials or unrestricted tool output.

```powershell
node "D:/personal-project-2/ProjectsMemoryDashboard/packages/cli/dist/index.js" checkpoint "<absolute-repository-root>" --db "D:/personal-project-2/ProjectsMemoryDashboard/.project-memory/dashboard.sqlite" --title "Feature checkpoint" --summary "Concise change, test evidence and remaining limits" --next "One concrete next action"
```

CLI checkpoint refreshes the selected repository before saving. Use proper shell quoting; pass values as argument arrays when invoking subprocess tools programmatically. Do not interpolate arbitrary conversation text into executable shell syntax. Keep summaries below 4,000 characters and at most three next actions. A checkpoint is explicit testimony, not automatic verification. Preserve existing context; do not fabricate an implementation inventory from filenames.

Run `resume` after saving and confirm the recorded summary/next action. Report the project name, checkpoint result and any refresh/coverage limits. Dashboard changes appear after reload and **Use local projects**. CLI registration can succeed outside dashboard allowed roots; a dashboard refresh then needs its server restarted with that project's parent as `--allow-root`. Do not expand server scope or restart unrelated services implicitly.

## Maintain memory during a chat

If the user asks to maintain Project Memory for this chat, checkpoint after meaningful features pass relevant checks and before handoff of partial/failed work. Skip minor edits and repeated unchanged checkpoints. Keep this scoped to the selected repository and chat; the skill itself is not a watcher or hook.

The shared database is the default memory destination. If the repository already has a project-local memory file/instructions, follow its convention and update its compact resume alongside the checkpoint when requested. Preserve unresolved risks and link detailed evidence rather than copying full conversations. Do not overwrite an unrelated memory file or modify global agent instructions.

Commands `history`, `search --query "<terms>"`, and `decision --summary "<decision>"` use the same absolute repository and database. For richer structured state, use Project Memory MCP tools only when configured against this database; retain scoped evidence and expected revision. Do not automatically install hooks, import histories or select `--agent codex`. Permission failures remain failures; report them rather than claiming a successful save.
