# Implementation Plan — Project Memory v0.1

## Execution revision — 2026-10-02

### Dashboard-first continuation (user-authorized)

The user superseded the original ordering: build the resume-first dashboard with sample data, then connect the local tool and add projects gradually. The numbered phases below remain a V1 scope inventory, not completed work or a restriction on the new order.

| Delivery                            | Current status                                                                                                             | Remaining acceptance gate                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Foundation and deterministic CLI    | Tested locally; authenticated Codex analysis passed on disposable fixture                                                  | Broad OS/confidentiality isolation guarantees remain out of scope                            |
| Mock dashboard                      | Desktop/dark/mobile/keyboard review passed                                                                                 | Gradual user-project feedback                                                                |
| Local dashboard + API + service     | Registration, refresh, checkpoint and timeline tested; live server now daemon mode                                         | Broader user-project validation; semantic analysis remains CLI                               |
| MCP + product skills                | Fourteen tools; official transport and actual Codex/Claude host resume/checkpoint passed                                   | Cursor host; user-wide Claude skill invocation                                               |
| Discovery and public history import | Durable atomic batches/restart/dedup; exact canonical metadata preview; separate/link tested                               | Nested export discovery, moved history paths and broader provider format coverage            |
| Hook normalization                  | Codex/Claude/Cursor fixtures; real Claude start/stop/end minimal capture passed                                            | Codex host trust/live hooks; Cursor actual session; standard public capture in real hosts    |
| Config installer                    | Reversible MCP/hooks and three-provider install-all manifest preflight/rollback fixtures passed                            | Actual target configurations remain user-selected; live loading/trust varies by host         |
| Hardening                           | Schema v3/v1/v2 migration, restore, malformed/privacy tests, 1,000-file bounded scan and actual process-tree timeout proof | Cross-platform runtime and broad performance dataset                                         |
| Daemon lifecycle                    | Lease-owned listener and polling, second-owner refusal, crash-expiring ownership and clean stop tested                     | Active daemon owns writes; CLI/MCP proxy verified; offline direct mode remains transactional |

Keep mock UI, local HTTP/MCP proof and real provider proof separate. Each completed feature updates project memory. No provider configuration is changed implicitly.

### Remaining-phase continuation � 2026-10-02

Implemented durable import cursors with each batch's evidence/activity in one transaction, exact repository metadata matching preview, manual separate/link identity bindings, a single foreground watcher and a lease-owned dashboard daemon. Schema v3 adds jobs/leases/bindings; simultaneous first-open processes and legacy preservation are tested. Reversible hook installers include Cursor public-field normalization; `install all` uses an explicit six-path manifest with complete preflight and rollback of completed installs. See docs/OPERATIONS.md.

Authenticated Codex synthesis, real Codex MCP retrieval/checkpoint, real Claude retrieval of Codex context and persisted checkpoint, and real Claude minimal lifecycle events passed using isolated fixture databases and temporary host configuration. Default managed Windows execution cannot resolve Codex home or use taskkill; outside-runner proof succeeded. No global provider configuration/trust settings were changed. Process-only Git ownership exception was restricted to the disposable fixture; global safe.directory was not changed.

All original phase numbers have been advanced, but full V1 acceptance is still partial. Codex trusted-hook execution, real Cursor sessions, standard-mode live public capture, broader platform/performance checks remain open. The daemon now owns product writes as well as its listener/poller. CLI/MCP commands proxy to it while active; direct Store mutation is fenced. Offline mode uses transactional SQLite only when no daemon lease exists.

### Recovery hardening continuation — 2026-10-02

Added online SQLite backup, explicit new-path restore and read-only `db-check`. Storage/schema/integrity and foreign-key checks precede publication; existing destinations and sidecars are refused. Tests cover committed WAL state, evidence/history/FTS round-trip, corrupt/unrelated/future schema rejection, v1/v2-to-v3 preservation and real separate CLI processes. This closes the local manual backup/restore and v1 migration acceptance subset of Phase9. Broader performance benchmarking, automatic schedules and stronger runner isolation remain open; watcher ownership and legacy migration preservation are now tested. See `docs/BACKUP_RESTORE.md` and dated project-memory evidence for final results.

`CODEX_BUILD_BRIEF.md` governs the current milestone. See `DOCUMENT_REVIEW.md` for adopted changes and `PROJECT_MEMORY.md` for tested progress. Original phases below retain the full V1 roadmap.

| Order | Deliverable                                                                                                | Exit gate                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Strict TypeScript/pnpm packages, versioned SQLite migration, CI and dependency boundaries                  | Local build, boundary checks and tests; CI execution separately evidenced                                                                         |
| 1     | Bounded/redacted repository scan, Git facts, evidence persistence, moved committed repo identity           | Clean/dirty/unborn/Unicode fixtures; idempotency; source unchanged; privacy checks                                                                |
| 2A    | Repository-only reconstruction, Codex adapter, schema/claim validation, persisted resume                   | First CLI slice; malformed/unknown/stale-history cases rejected; failure retains previous state; authenticated Codex fixture remains its own gate |
| 2B    | Recursive portfolio discovery, separate/link identity, import jobs, versioned generic/Codex/Claude parsers | No-history baseline retained; scope/dedup/redaction/contradictions tested per provider; interrupted import recovery                               |
| 3     | Daemon ownership, versioned state revision, MCP v2 server and product skills                               | Scoped validation and optimistic concurrency; real Codex/Claude MCP retrieval and checkpoint compatibility                                        |
| 4–5   | Capability-tested Codex and Claude lifecycle adapters                                                      | Install preview/backup before writes; observed factual events and stale semantic state; cross-agent resume                                        |
| 6     | Loopback API and dashboard                                                                                 | Origin/token/path protections; rendered and browser-tested resume/portfolio/history                                                               |
| 7–9   | Cursor integration, full installer and hardening                                                           | Version fixtures, reversible installs, restore/migrations, performance and privacy regression gates                                               |

Every successful feature updates project-local memory through `AGENTS.md` and the development-memory skill. Partial work records its remaining acceptance gates; it must not be labeled complete from source or mocks alone.

Phase 2A uses direct CLI SQLite access until Phase 3 introduces daemon ownership. `scan <path>` initially scans one repository; recursive discovery belongs to 2B. Default onboarding is deterministic; `--agent codex` explicitly selects external synthesis. No hooks or provider config are installed by the initial slice.

## Principle

Build the smallest vertical slice that proves continuity before adding broad integrations.

## Phase 0 — Repository foundation

Deliverables:

- pnpm monorepo;
- TypeScript strict mode;
- lint/format/test;
- CI;
- package boundaries;
- architecture decision records.

Acceptance:

- all packages build;
- tests run from root;
- dependency direction is enforced.

## Phase 1 — Core + SQLite + Git

Build:

- database migrations;
- projects;
- repository roots;
- Git snapshots;
- evidence store;
- state snapshots;
- project identity;
- repository scanner;
- secret/path filtering.

CLI:

```bash
project-memory init
project-memory add .
project-memory scan <path>
project-memory status .
```

Acceptance:

- move a repo to a different directory and retain project identity;
- repeated scans are idempotent;
- factual Git state is always current.

## Phase 2 — Existing-project reconstruction

Build:

- evidence bundle builder;
- manifest/doc/test discovery;
- recent commit selection;
- Codex history importer;
- Claude history importer;
- generic Markdown/JSONL import;
- analyzer runner abstraction;
- Codex runner first;
- strict ProjectState schema validation.

CLI:

```bash
project-memory onboard . --agent codex
project-memory reconstruct .
project-memory import-history ...
```

This phase is critical. Do not postpone it.

Acceptance:

- onboard a repository with no agent transcript;
- onboard an old Codex repository and associate historical sessions;
- onboard an old Claude repository and associate historical sessions;
- all inferred claims are labeled;
- invalid analysis never overwrites the last valid state.

## Phase 3 — MCP server + skills

Build MCP tools from `MCP_AND_SKILLS_SPEC.md`.

Build skills:

- project-onboard;
- project-resume;
- project-checkpoint;
- project-decision;
- project-status.

Acceptance:

- Codex can call `project_get_resume`;
- Claude can retrieve the same project resume;
- both save compatible checkpoints.

## Phase 4 — Codex live synchronization

Install:

- SessionStart;
- UserPromptSubmit subject to capture mode;
- PostToolUse;
- Stop;
- SessionEnd.

Capture:

- session metadata;
- supported tool metadata;
- current Git snapshot;
- end-of-turn/end-of-session factual checkpoint.

Acceptance:

- work in Codex;
- close/reopen;
- dashboard reflects factual activity without manual editing;
- Resume Capsule is marked stale when semantic state has not yet been regenerated.

## Phase 5 — Claude live synchronization

Same domain contract, Claude-specific hook adapter.

Use stable hook fields rather than assumptions about UI internals.

Acceptance:

- start in Claude;
- checkpoint;
- open in Codex;
- Codex sees the updated project context.

This is the first major cross-agent milestone.

## Phase 6 — Dashboard

Pages:

### Portfolio

- search/filter;
- project cards;
- lifecycle stage;
- last activity;
- current branch;
- current work;
- next action;
- stale indicator;
- evidence coverage.

### Project Resume

- Resume Capsule;
- copy context;
- refresh analysis;
- evidence badges.

### Timeline

- sessions;
- checkpoints;
- commits;
- decisions;
- imports.

### Project Details

- decisions;
- milestones;
- repository;
- integrations;
- privacy/capture settings.

Acceptance:

- user can understand an abandoned project without opening the IDE.

## Phase 7 — Cursor integration

Build:

- MCP setup;
- skills;
- hooks;
- transcript-path ingestion for future sessions;
- Markdown export import.

Keep internal Cursor database import experimental unless a documented/stable API is available.

## Phase 8 — Installer UX

Commands:

```bash
project-memory doctor
project-memory install all
project-memory uninstall <provider>
project-memory integrations
```

Requirements:

- config backup;
- idempotent install;
- diff preview;
- Windows/macOS/Linux path handling;
- no destructive overwrite.

## Phase 9 — Hardening

- secret regression suite;
- large repo benchmarks;
- malformed transcript fuzz tests;
- interrupted import recovery;
- DB backup/restore;
- migration tests;
- adapter compatibility fixtures;
- telemetry remains off by default.

## Deferred V2+

- Warp live adapter/history importer;
- Gemini CLI/OpenCode/Copilot adapters;
- semantic embeddings;
- encrypted multi-device sync;
- team mode;
- issue trackers;
- GitHub activity ingestion;
- release/deployment awareness;
- optional local model analysis;
- project relationship graph.

## Suggested first Codex implementation milestone

Do not ask Codex to build the whole product at once.

Milestone:

> **Existing repository → deterministic evidence → Codex read-only analysis → validated Project State → CLI resume output**

End-to-end command:

```bash
project-memory onboard .
project-memory resume .
```

Expected output:

```text
Project: Example
Stage: Building

Where you stopped:
...

Implemented:
...

In progress:
...

Blockers:
...

Next:
1. ...
2. ...

Evidence:
Git: high
Repository: high
Agent history: none
Analysis generated: now
```

The original dashboard ordering above is superseded by the user's dashboard-first continuation. Authenticated analysis and real live-hook gates remain mandatory before claiming those integrations work.
