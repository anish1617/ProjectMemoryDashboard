# Project Memory — development resume

Updated: 2026-10-02, Asia/Katmandu. This is project-local development memory, not the product evidence database. Read this first; follow `AGENTS.md` and `skills/project-development-memory/SKILL.md` for checkpoint updates.

## Purpose and authority

Build a local-first, agent-neutral continuity layer that reconstructs existing repositories and supplies concise, evidence-backed resume context. The project owns continuity; coding agents are interchangeable workers. No required API key, cloud/database service, vector database or orchestration.

`PRD.md` governs full V1 scope. `CODEX_BUILD_BRIEF.md` governs the initial vertical slice. `IMPLEMENTATION_PLAN.md` contains revised delivery gates. `DOCUMENT_REVIEW.md` explains adopted revisions and research sources. Imported documents are specifications, not evidence that features already exist.

## Current checkpoint — initial CLI slice

Status: **local foundation and deterministic CLI continuity tested; full first-milestone authenticated analysis gate remains open**. The workspace initially contained nine Markdown documents and no Git repository. No root Git repository or commit was created; current changes have no commit SHA.

Implemented:

- Six pnpm packages: core, git, scanner, db, runners and cli; strict TypeScript; lockfile; cross-platform CI definition. `scripts/check-boundaries.mjs` checks declared internal package dependency direction.
- Bounded repository scan using Git-listed tracked/untracked files, with ignored/untracked exclusion, secret paths, binary/UTF-8 and size filters. Symlink components are refused in source. Limits: 500 candidates, 64 KB per file, 256 KB content total. Omitted coverage is disclosed.
- Redaction before evidence hashing, persistence and analysis input. Content-addressed immutable evidence; transactional version-1 SQLite migration, Drizzle queries, WAL, timeout and immutable snapshot updates.
- Root-commit project identity survives committed-repository moves. At the same registered path, unborn identity upgrades after the first commit. Same-ancestry forks intentionally group for now; unborn moves cannot be matched reliably.
- Zod owns strict ProjectState and generated JSON Schema. All non-recommended claims need scoped evidence; verified text must match deterministic factText. Implemented claims require current file/test evidence; transcript-only completion is rejected. Relevant file references must point to observed files.
- `init`, `add`, `scan`, `onboard`, `resume`, `status` CLI. `scan` accepts one repository. Resume refreshes Git and compares evidence digests with persisted state, showing needs_analysis/stale_repository/fresh. No-history onboarding works.
- Codex adapter checks required flags, uses read-only scratch cwd, ignores user config/rules, uses ephemeral structured output and discards event/stderr streams. One retry; unavailable/invalid analysis preserves the previous state or creates a factual fallback.
- Reviewed all documents, refreshed primary integration references, added clarifications to imported specs, and created project-local instructions/memory skill.

## Evidence and checks

2026-10-02, local Windows/Node 24.16.0, pnpm 11.15.0:

- `pnpm install --frozen-lockfile`: passed using packaged better-sqlite3 13.0.3 platform prebuilds. Native compilation is disabled in workspace allowBuilds. Initial compilation attempt failed for missing Python; resolved by using shipped prebuilds, not installing a compiler.
- `pnpm check`: passed strict package builds and declared dependency-boundary check.
- `pnpm schema`: generated `schemas/project-state.schema.json` from canonical Zod schema.
- `pnpm test`: **19 passed, 1 skipped, 20 total** in `tests/continuity.test.ts`. Covers non-Git, clean/dirty/unborn, multiple commits, moved identity, first-commit transition, repeat-scan deduplication, exclusions/redaction, malformed/unknown/fabricated claims, transcript-only completion rejection, analyzer unavailable/failure and previous-state retention.
- Real separate Node CLI processes onboard and resume from the same persisted SQLite database against a disposable Unicode/space-path Git fixture. Source content/status unchanged checks pass.
- Real subprocess runner contract tested with a fake Codex executable: required sandbox/schema flags, scratch cwd, stdin bundle and final structured response. This does **not** prove authenticated Codex inference.
- Symlink traversal fixture skipped because Windows returned EPERM when creating a symlink. Refusal logic is present but this host has no runtime proof for that case; retain the test for CI on a capable host.
- `pnpm format:check`: passed including project memory and instructions. CI is configured, not executed remotely.
- Skill creator `quick_validate.py`: passed. PyYAML was installed only into ignored `.project-memory/skill-validation` for validation; no global Python configuration changed.

## Important limitations

- Authenticated Codex analysis has not been invoked. Installed `codex exec --help` confirms required flags; credentials and end-to-end inference are unverified.
- Read-only scratch execution is not filesystem confidentiality isolation. The prompt forbids tools, but strong tool denial/OS isolation and process-tree timeout handling remain hardening work. Pattern redaction is not an arbitrary-secret guarantee.
- Analyzer-attempt persistence, scoped diagnostics, observation links/schema/analyzer versions, optimistic revisions, explicit identity split/link and recursive discovery are pending.
- No historical importer, MCP server/client proof, daemon, API, dashboard, watcher, product skills, vendor hook or installer exists yet. No provider/user configuration was changed.
- Codebase graph service failed with `Transport closed`; direct source/document fallback was used. No graph coverage/generation was obtained. Retry graph discovery in the next session before structural claims.

## Resume commands and source map

Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm format:check`. Use `pnpm pm onboard <existing-git-repository> --db <database-path>` then `pnpm pm resume <same-repository> --db <same-database>`. `--agent codex` explicitly enables disclosure of the redacted evidence bundle via the authenticated CLI. `PROJECT_MEMORY_DB` and `PROJECT_MEMORY_CODEX` override paths.

- Claims/redaction/schema: `packages/core/src/index.ts`.
- Git/scanning/identity: `packages/git/src/index.ts`, `packages/scanner/src/index.ts`.
- Migration/evidence/snapshots: `packages/db/src/index.ts`.
- Codex subprocess: `packages/runners/src/index.ts`.
- CLI/workflows/resume: `packages/cli/src/index.ts`, `packages/cli/src/service.ts`.
- Behavior fixtures: `tests/continuity.test.ts`.

## Next actions

1. Complete runner confidentiality/process-tree hardening and exercise authenticated Codex against an approved disposable fixture; record runtime result separately from mocks. Keep fallback behavior usable regardless.
2. Phase 2B: explicit identity separation/linking and recursive discovery, then versioned generic/Codex/Claude history imports with redaction, scoped deduplication, contradiction diagnostics and interrupted-job tests.
3. Phase 3: daemon ownership, versioned/revision-aware state writes, MCP v2 and product skills. Hold dashboard/live adapters until their prerequisite contracts and actual integrations pass.
