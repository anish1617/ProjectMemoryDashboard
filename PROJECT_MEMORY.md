# Project Memory — development resume

Updated: 2026-10-02, Asia/Katmandu. Read this first, then AGENTS.md and skills/project-development-memory/SKILL.md. Development memory is separate from product evidence. Detailed history: docs/checkpoints/2026-10-02-initial-cli.md, 2026-10-02-dashboard-local-tool.md, 2026-10-02-database-recovery.md and 2026-10-02-remaining-phases.md.

## Authority and direction

Local-first, agent-neutral Git project continuity. Evidence and interpretation stay distinct; no required API key, cloud or vector service. PRD.md governs V1, CODEX_BUILD_BRIEF.md the first slice, IMPLEMENTATION_PLAN.md current gates. Specifications are not implementation proof.

User superseded original ordering: mock dashboard first, tool integration next. Resume projects is primary, portfolio/timeline alongside. Continue feasible phases and test each. User authorized self-registration, global conversation-invoked skill and ongoing project-local memory updates. Latest instruction: finish the tool before onboarding other user projects. Git main is unborn: no root commit, SHA or remote.

## Current checkpoint

All numbered phases advanced; local continuity workflows implemented and verified. Full V1 host/platform acceptance remains partial. Latest continuation closes exclusive daemon write ownership.

- Strict TypeScript/pnpm workspace: core, git, scanner, db, runners, service, api, mcp-server, integrations, cli and React/Vite dashboard. SQLite/Drizzle/Zod, dependency checks and CI definition.
- Resume-first dashboard: six illustrative projects, search/stage/attention filters, resume/evidence/history, copy, activity, settings, light/dark/mobile. Samples never persist. PRODUCT.md, DESIGN.md and .impeccable/design.json record design.
- Loopback API: allowed canonical roots, Host/Origin/fetch context/bearer protections, custom session header, restrictive CSP and bounded bodies. Production assets share API origin.
- SQLite v3: immutable evidence/snapshots, scoped activity/dedup, FTS5 literal search, revisions, pagination, durable import jobs, owner leases and root identity bindings. Immediate initialization transaction protects concurrent first-open; v1/v2 migrations preserve records.
- Imports: bounded atomic batches commit redacted public evidence/activity/cursor together. Resume survives another connection/process; unchanged imports deduplicate, changed content refuses continuation. Explicit selected-folder matching previews exact canonical cwd metadata; missing/ambiguous records skip. Hidden reasoning/tool messages excluded.
- Identity: separate/link bindings preserve old immutable histories. Repeated separation is idempotent; detached identities cannot refresh as the rebound project. Independently separated moves need deliberate rebinding.
- Daemon owns listener, polling and product mutations. Active CLI/MCP writes use authenticated owner-bound loopback RPC; direct Store writes fenced. Failed live handshake refuses fallback. Offline transactional mode requires no live daemon. This is cooperating application ownership, not protection against raw SQLite edits by a local user.
- Foreground watcher renews an expiring single-owner lease before bounded scans publish. Missing/out-of-scope roots fail safely. Checkpoints survive refresh; no semantic analysis/conversation capture through polling.
- Official MCP v2 stdio exposes fourteen tools, including begin/resume/list import jobs. CLI includes matching, identity, watcher/daemon, hooks/config bundles and recovery. Default onboarding deterministic; --agent codex explicitly selects authenticated synthesis.
- Reversible MCP/hook installers: preview, explicit apply, backup/receipt, conflict detection, repeat installation/removal, exact restore or owned-entry removal preserving later edits. Three-provider install-all manifest preflights six targets and rolls back completed targets. Multi-file updates are not OS-atomic; failed-target recovery may need inspection.
- Hooks: minimal default, standard public-text option; Codex/Claude/Cursor adapters. Cursor excludes thoughts/tool output/identity/transcript paths and ambiguous multiroot payloads. Commands generated for current OS. No user/global hook/provider configuration changed.
- Runner: redacted read-only scratch, schema/evidence validation, documented shell/multi-agent/apps/hooks/web disabling, bounded transient stderr classification and process-tree/group timeout termination. Raw stderr/reasoning never persisted. No complete confidentiality/future-tool-denial guarantee.
- Recovery: online backup includes committed WAL; read-only inspection validates schema, integrity and foreign keys. Restore requires a new path; destinations/sidecars refused. Hard-link publication tested on local NTFS. No live replacement or automatic schedule. docs/BACKUP_RESTORE.md.

## Evidence and limits

2026-10-02 Windows Node24/pnpm11.15: pnpm check passed strict builds/dependency boundaries; pnpm test **60 passed, 2 skipped, 62 total**, four files; pnpm format:check passed. Tests cover imports/restarts/rollback/concurrency, identity/privacy, recovery/migrations, actual HTTP, official MCP stdio, real CLI processes, ownership/proxy and installers. Four simultaneous first-open processes passed. A 1,000-file fixture scan took 612 ms, disclosing the 500-file cap; not a broad benchmark.

Actual provider proof: Codex CLI0.144.5 authenticated analysis persisted validated state on Continuity Fixture. scripts/verify-codex-host.mjs proved real MCP retrieval/checkpoint; scripts/verify-claude-host.mjs proved Claude Code2.1.285 retrieved Codex context and saved its checkpoint. scripts/verify-claude-hooks.mjs proved real minimal start/stop/end events. Isolated databases/temporary settings; no global configuration changed. Managed Codex home lookup failed; outside-runner proof used process-only safe.directory for the exact sandbox-owned fixture. No global Git exception.

Managed tests skipped symlink creation EPERM and taskkill Access denied. The exact process-tree test passed separately outside managed execution; symlink-capable runtime remains open. CI configured, not remotely run. Earlier browser proof covered registration/checkpoint/history/resume/reload/copy, desktop/dark/mobile/keyboard. No UI changes this continuation; no new browser check claimed.

Remaining gates: trusted live Codex hooks, actual Cursor sessions, standard public capture in real hosts, user-wide Claude skill invocation and broader export/platform/performance validation. Pattern redaction cannot guarantee arbitrary-secret protection. Identical hook events without IDs may collapse. Same-ancestry forks group; unborn moves cannot reliably match. Scans bounded to500files,64KB/file,256KB/bundle, omissions disclosed. Integrity does not prove historical claim truth.

Graph generation2026-10-02T05:20:53Z has two nodes; relied-on source not_tracked. Coverage checked; exact source fallback, no exhaustive graph claims.

## Storage and resume

Live dashboard http://127.0.0.1:4319/, foreground daemon, allowed root this workspace. Persistent data: D:/personal-project-2/ProjectsMemoryDashboard/.project-memory/dashboard.sqlite, WAL/SHM while active. Local disk, no cloud sync. Default unbound CLI/API/MCP uses ~/.project-memory/memory.sqlite; always pass shared --db. Markdown memory is this separate file.

Pre-upgrade backup .project-memory/backups/2026-10-02-before-continuity.sqlite: schema2, two projects, seven snapshots, integrity ok. Live schema3 migration preserved counts before subsequent checkpoints. Older phase9 backup and recovery-check.sqlite remain isolated copies. Never implicitly replace active database.

Self ID c21fcb6b-b331-427f-8ef6-93886b2b0512; Continuity Fixture disposable. No other user projects registered. Global skill identical copies: C:/Users/ACER/.agents/skills/project-memory and C:/Users/ACER/.claude/skills/project-memory, absolute CLI/shared DB bindings. Codex catalog discovery proved; Claude invocation pending. Codex $project-memory, Claude Code /project-memory. No background skill sync. Helper scripts/install-global-project-memory.ps1; docs/ADDING_PROJECTS.md.

Run pnpm install --frozen-lockfile; pnpm check; pnpm test; pnpm format:check. Build then pnpm run pm daemon --db .project-memory/dashboard.sqlite --allow-root <folder> --port4319. pnpm dev supplies samples; live needs production service/proxy. Sources packages/*, apps/dashboard/src, tests/. Operations docs/OPERATIONS.md.

## Next actions

1. Validate trusted Codex hooks and actual Cursor lifecycle without silently changing user trust/settings.
2. Verify real standard capture, Claude skill invocation and broader platform/export/performance gates.
3. After acceptance, onboard only user-selected projects and verify actual resumes alongside the dashboard.
