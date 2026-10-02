# Architecture — Project Memory v0.1

Implementation clarification (2026-10-02): follow `DOCUMENT_REVIEW.md`. The active daemon owns product writes; CLI/MCP use its authenticated loopback command port. Offline CLI mode retains transactional SQLite access when no daemon lease exists. Evidence is redacted before hashing/persistence. Optional Codex synthesis runs in a separate scratch workspace with the bounded bundle, rather than the source repository. Read-only execution is not a confidentiality sandbox. Current Git means refreshed on an operation until live capture is implemented.

## 1. Architecture goals

Current local implementation (2026-10-02): React/Vite UI → native Node loopback HTTP adapter → scoped ProjectService → SQLite Store. CLI and official MCP v2 stdio adapters share ProjectService and the configured database. SQLite WAL/transactions support multiple local connections; a lease-owned dashboard listener/poller now owns product writes. Cooperating CLI/MCP writers proxy through authenticated loopback commands; readers may retain SQLite connections. An offline writer is fenced while a daemon lease exists. A thin native HTTP adapter replaces the suggested framework for this slice. Current Git refreshes on registration, resume, refresh and normalized hook ingestion; explicit daemon/watch commands poll registered allowed repositories without regenerating semantic state. See project memory for real integration boundaries.

- local first;
- agent neutral;
- evidence first;
- resumable;
- deterministic core;
- optional AI synthesis;
- low installation friction;
- reversible integration;
- no dependence on undocumented vendor internals for core functionality.

## 2. High-level architecture

```text
 Codex         Claude         Cursor         Warp / Future
   │              │              │                │
   ├──── Skills ──┼──────────────┼────────────────┤
   ├──── MCP ─────┼──────────────┼────────────────┤
   └──── Hooks / Adapter Events ──────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Project Memory Core │
              │                      │
              │ CLI                  │
              │ Local HTTP API       │
              │ MCP Server           │
              │ Hook Receiver        │
              │ Repo Scanner         │
              │ Git Collector        │
              │ Import Pipeline      │
              │ State Projector      │
              │ Resume Builder       │
              │ Secret Redactor      │
              └──────────┬───────────┘
                         │
              ┌──────────┴───────────┐
              ▼                      ▼
         SQLite DB              Markdown Export
       + SQLite FTS5             (portable)
              │
              ▼
        Local Dashboard

                         +
                         │ optional / on demand
                         ▼
                Analysis Runners
          Codex / Claude / Cursor / Local
```

## 3. Monorepo

Recommended:

```text
project-memory/
├─ apps/
│  └─ dashboard/
│
├─ packages/
│  ├─ core/
│  ├─ db/
│  ├─ cli/
│  ├─ api/
│  ├─ mcp-server/
│  ├─ git/
│  ├─ scanner/
│  ├─ resume/
│  ├─ redaction/
│  ├─ importers/
│  │  ├─ codex/
│  │  ├─ claude/
│  │  ├─ cursor/
│  │  └─ generic/
│  ├─ runners/
│  │  ├─ codex/
│  │  ├─ claude/
│  │  ├─ cursor/
│  │  └─ custom/
│  └─ adapters/
│     ├─ codex/
│     ├─ claude/
│     └─ cursor/
│
├─ skills/
│  ├─ project-onboard/
│  ├─ project-resume/
│  ├─ project-checkpoint/
│  ├─ project-decision/
│  └─ project-status/
│
├─ schemas/
│  └─ project-state.schema.json
│
└─ docs/
```

## 4. Recommended stack

- Node.js current LTS
- TypeScript
- pnpm workspaces
- React + Vite
- Tailwind CSS
- shadcn/ui
- Hono or Fastify for loopback API
- SQLite
- Drizzle ORM
- SQLite FTS5
- Zod
- official MCP TypeScript SDK v2
- simple-git or direct Git subprocess wrapper
- chokidar only where filesystem watching is required
- Vitest
- Playwright for dashboard E2E

Do not add a vector DB in V1.

## 5. Local runtime

The daemon owns the database and API.

```bash
project-memory daemon
```

Default:

```text
127.0.0.1:<dynamic-or-configured-port>
```

Responsibilities:

- migrations;
- ingest hook events;
- project lookup by repository root;
- current-state projections;
- MCP backing services;
- dashboard API;
- importer coordination;
- synchronization locks.

The daemon must not expose a LAN interface unless explicitly configured.

## 6. Project identity

A project should not be identified only by directory path.

Preferred identity inputs:

1. normalized Git remote(s);
2. repository root fingerprint;
3. first/known commit IDs;
4. user-defined project id.

This permits repository moves and multiple worktrees.

Suggested:

```text
project
  1 ── * repository_root
```

## 7. Event architecture

Raw activity should be append-only.

```text
Hook / Git / Import
       │
       ▼
 SessionEvent
       │
       ├── Evidence
       │
       └── Projection
              │
              ▼
       ProjectCurrentState
```

Examples:

- `session.started`
- `session.ended`
- `prompt.submitted`
- `tool.executed`
- `file.changed`
- `git.snapshot`
- `test.executed`
- `commit.observed`
- `checkpoint.created`
- `decision.created`
- `baseline.generated`
- `analysis.generated`

Never overwrite raw evidence to make the narrative look cleaner.

## 8. State freshness

Project state must have:

```ts
type Freshness =
  | "fresh"
  | "stale_activity"
  | "stale_repository"
  | "needs_analysis"
  | "unknown";
```

A factual Git projection can be current while the semantic summary is stale.

Example:

```text
Git state: updated 20 seconds ago
Resume analysis: generated 3 days ago
New activity since analysis: yes
```

## 9. Analyzer architecture

The core prepares an evidence bundle and asks a runner for a strict `ProjectStateCandidate`.

The analyzer may inspect repository content but must default to no writes.

Pipeline:

```text
Evidence Bundle
     ↓
Analyzer Runner
     ↓
JSON Schema validation
     ↓
Claim/evidence validation
     ↓
Project State Candidate
     ↓
Persist State Snapshot
```

If validation fails:

- retry once with validation errors;
- otherwise retain previous semantic state;
- mark analysis failed;
- do not silently store malformed/invented data.

## 10. Cross-agent integration

### Portable layer

- MCP
- Agent Skills
- CLI
- HTTP localhost API

### Vendor adapters

- lifecycle hooks;
- session transcript discovery;
- provider-specific installation.

Adapters must never contain core domain rules.

## 11. Codex integration

Use:

- Agent Skills;
- MCP configuration;
- lifecycle hooks;
- local rollout/session import;
- `codex exec` for optional read-only analysis.

Hooks should capture:

- SessionStart
- UserPromptSubmit (subject to privacy mode)
- PostToolUse
- Stop
- SessionEnd

## 12. Claude integration

Use:

- skills;
- MCP;
- SessionStart / Stop / SessionEnd hooks;
- transcript path supplied by hook payload;
- historical JSONL discovery;
- `claude -p --output-format json` for optional analysis.

## 13. Cursor integration

Use:

- skills;
- MCP;
- hooks;
- transcript path when provided;
- explicit Markdown export for reliable historical import;
- optional best-effort importer for locally stored history only when version-compatible.

Do not make an undocumented internal Cursor DB schema a V1 dependency.

## 14. Security boundary

The Project Memory daemon receives potentially sensitive development information.

Controls:

- loopback binding;
- origin/token protection for browser API;
- path allowlist;
- `.gitignore`-aware scanning;
- default secret patterns;
- ignore `.env`, credentials, private keys;
- maximum file sizes;
- binary-file exclusion;
- opt-in raw transcript persistence;
- audit log for import source and deletions.

## 15. Failure mode principle

The system should degrade from:

```text
Semantic state + history
        ↓
Structured checkpoints + Git
        ↓
Git + repository facts
```

It should never degrade to “no usable project state” merely because an LLM runner or transcript importer is unavailable.

### Daemon write ownership completion — 2026-10-02

Schema v3 leases publish an owner-bound loopback endpoint. CLI/MCP discover it from the selected database, require an owner-matching handshake and send bounded schema-validated commands. Store mutation transactions fence nonowners while the daemon lease is active; expired old owners also refuse commits. Endpoints are restricted to literal loopback HTTP with redirects denied. No bearer token is stored in SQLite. Leases/endpoint housekeeping remain coordinator operations. Offline direct writes remain available when no daemon exists; they are never used as a silent fallback after a failed live handshake. This is cooperative application ownership, not protection against a local user editing SQLite directly.
