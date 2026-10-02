# Database recovery hardening

2026-10-02, Asia/Katmandu. Scope: manual backup, restore to a new path, integrity inspection and legacy v1 migration. Git repository exists on main with no root commit/remote.

Implemented in `packages/db/src/maintenance.ts`, exported by db and exposed in CLI as `backup`, `restore`, `db-check`. SQLite online backup includes committed WAL state. Validation checks supported table/column signatures, version, integrity and foreign keys. Completed temporary snapshot uses DELETE journal mode, then publishes through same-directory hard link. Existing files/sidecars and same paths refused; restore requires an explicit new `--db`. Source never replaced. Filesystems without hard-link support fail with an actionable message. Content-truth validation, scheduling and daemon ownership are not part of this subset.

## Evidence

- `pnpm check`: strict builds/dependency boundaries passed.
- `pnpm test`: **40 passed, one skipped, 41 total** in three files. Existing Windows symlink test remains skipped EPERM.
- `pnpm format:check`: passed.
- Six new tests in `tests/maintenance.test.ts`: committed WAL, exact evidence/state/history/FTS round-trip, overwrite/sidecar/same-path refusal, malformed/unrelated/future-schema rejection, foreign-key corruption rejection/partial cleanup, v1-to-v2 evidence/state preservation and repeat-open idempotency, plus real CLI processes. The final test covers multiple conditions and commands. Initial five-second multi-process test budget timed out and cleanup encountered a child-process lock; set bounded 30-second test/10-second command timeouts, then complete suite passed. No timeout remains open.
- Real active database backup: `.project-memory/backups/2026-10-02-phase9.sqlite`; restored copy: `.project-memory/recovery-check.sqlite`. Both inspected schema2, two projects, six snapshots, integrity ok. These counts describe the snapshot at capture time. Active dashboard continues using original `.project-memory/dashboard.sqlite`.

## Remaining gates/blockers

No blocker for this local phase. Prior authenticated Codex analysis failed after one retry; successful inference/diagnosis remains open. Real vendor host/live-hook sessions unverified. Codex now lists the globally installed project-memory skill; Claude host discovery/skill invocation still requires a real session. Graph generation2026-10-02T05:20:53Z still does not track source; fallback source checks used. Large-repo benchmarks, resumable/automatic history matching, watcher/daemon ownership, identity links and runner isolation remain planned.

Usage and careful database switching: `docs/BACKUP_RESTORE.md`. Manual recovery does not automatically rebind global skills or schedule future backups.
