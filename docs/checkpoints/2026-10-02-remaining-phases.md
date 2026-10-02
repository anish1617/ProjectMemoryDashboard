# Remaining-phase implementation and verification

2026-10-02, Asia/Katmandu. Root Git main remains unborn, with uncommitted/untracked source and no remote or root SHA. All numbered phases were advanced; full V1 acceptance is partial.

## Delivered

- Schema v3: import jobs, owner leases and explicit root/project bindings. v1/v2 migration preserves prior evidence/state; first-open initialization uses an immediate transaction, tested with four simultaneous Node processes.
- Durable public-history imports: bounded atomic batches persist evidence/activity/cursor together. Restart from another connection/process, simultaneous continuations, rollback on injected persistence failure, redaction, dedup, changed-source refusal and scoped resume passed. CLI/MCP expose jobs and resume. Matching is an explicit top-level export preview using exact canonical cwd metadata, with missing/ambiguous sessions skipped.
- Explicit separate/link preserves old immutable histories; independent root bindings survive registration, repeated separation is idempotent, detached identities cannot refresh as the rebound project. Independently separated moves require a new deliberate binding.
- Foreground watcher: one expiring owner, renew before scan publication, stop releases ownership, missing/out-of-scope roots fail safely. Dashboard daemon owns listener/poller lifecycle and refuses a competing daemon. The later write-proxy continuation added owner fencing to product mutations and authenticated, owner-bound loopback RPC for CLI/MCP while the daemon is active. Offline direct mode exists only with no daemon lease. Tests include real CLI and official MCP subprocess writes through the owner, direct-writer refusal and forged-endpoint rejection.
- Reversible hooks: three providers, minimal default, standard public-text option, preview/backup/receipt, repeat/conflict/refusal/exact restore and preservation of later settings. Cursor adapter excludes thoughts/tool output/identity/transcript-path fields and rejects ambiguous root selection. Generated Windows command executed with actual stdin and neutral JSON output.
- `install all` explicit six-target manifest: preflight, repeated install, exact restore, uninstall repeat, completed-target rollback and preservation of concurrent edits tested. Multi-file updates are not an OS-atomic transaction; failed-target/receipt recovery can remain manual.
- Runner: bounded transient stderr classification with fixed safe messages; shell/multi-agent/apps/hooks/web disabled using documented configuration; OS process-group/tree timeout termination. No raw stderr or reasoning persisted. Read-only scratch is not a complete confidentiality or future-tool-denial sandbox.

## Local acceptance

`pnpm check`, `pnpm test`, `pnpm format:check` passed after final implementation. **60 passed, 2 skipped, 62 total**, four test files. Managed Windows skips symlink creation EPERM and process-tree capability because taskkill returns Access denied. The process-tree test passed separately outside the managed runner (`-t "runner timeout"`); the eleven other tests shown as skipped in that targeted run were unselected, not failed. Symlink runtime proof remains open.

`tests/remaining-phases.test.ts` holds behavioral import/ownership/identity/matching/privacy/installer/daemon/concurrent-init checks. `tests/local-tools.test.ts` now verifies fourteen official MCP tools and actual import transport. `tests/maintenance.test.ts` covers recovery and v1-to-v3 preservation. A targeted 1,000-file scan measured 612 ms on this Windows host and disclosed the 500-file cap; this is fixture evidence, not a broad production benchmark. Source remained unchanged; credentials excluded. An MCP assertion initially inspected escaped JSON text; corrected to parse transport content. All tests then passed. Earlier tree-test failure was an actual environment capability denial and is preserved as the bounded skip plus independent host proof.

## Actual provider proof

- Codex CLI 0.144.5 `onboard --agent codex` on disposable Continuity Fixture passed schema/evidence validation and persisted analysis in `.project-memory/analysis-check.sqlite`.
- `scripts/verify-codex-host.mjs`: real Codex CLI MCP host read an unknown unique baseline summary and persisted a unique checkpoint; both verified against the fixture database.
- `scripts/verify-claude-host.mjs`: Claude Code 2.1.285 read that Codex checkpoint and saved its own, verified against the same `.project-memory/host-check.sqlite`.
- `scripts/verify-claude-hooks.mjs`: real Claude start/stop/end events recorded with minimal capture in `.project-memory/hook-check.sqlite`. Temporary settings removed; no user settings changed. Initial probe's variadic empty-tools argument swallowed the prompt; moved prompt before tool flags and real events then passed.

Managed execution's Codex home lookup failed. Outside-runner Git initially refused sandbox-owned fixture ownership. A process-only safe.directory exception for the exact known fixture permitted these checks; no global Git setting, provider config or hook-trust setting changed. Authenticated analysis is now proven on this host with that execution boundary, not guaranteed inside managed execution.

## Active dashboard and recovery

Online backup before the live upgrade: `.project-memory/backups/2026-10-02-before-continuity.sqlite`, schema2, two projects, seven snapshots, integrity ok. Original active database migrated to schema3; counts preserved before the new development checkpoint. Stopped the previously owned server and started the lease-owned daemon on http://127.0.0.1:4319/ against `.project-memory/dashboard.sqlite`, allowed root this workspace. Real handshake/projects requests and read-only integrity inspection passed. Source budgets remain disclosed; sample projects are not stored.

## Remaining gates

Full V1 is not complete: Codex trusted live hooks, actual Cursor sessions, standard-mode public capture in real providers, user-wide Claude skill invocation, broader provider export/platform/performance coverage and symlink-capable runtime proof remain open. User-selected projects have not been added. Codex/Claude MCP continuity, authenticated synthesis and Claude minimal lifecycle capture are now actual integration proof. Graph generation2026-10-02T05:20:53Z still marks relied-on source not_tracked; exact source fallback used.

Usage/storage guide: `docs/OPERATIONS.md`; recovery: `docs/BACKUP_RESTORE.md`; delivery gates: `IMPLEMENTATION_PLAN.md`.
