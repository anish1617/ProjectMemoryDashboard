# PRD — Project Memory v0.1

Privacy clarification (2026-10-02): local-only/no-upload describes deterministic collection and storage by default. Explicit selection of an authenticated external analysis runner may send a redacted evidence bundle through that provider. Show the selected provider before execution. Read-only does not mean offline. See `DOCUMENT_REVIEW.md` for implementation decisions.

## 1. Product vision

Project Memory is a local-first continuity layer for AI-assisted software development. It tracks the evolving state of development projects across multiple coding-agent environments and creates a concise, evidence-backed resume context that can be consumed by any supported agent.

### Product principle

**The project owns the memory. The agent is an interchangeable worker.**

## 2. Target user

Primary V1 user:

- individual developer;
- works on multiple side projects or PoCs;
- frequently switches context;
- uses coding agents such as Codex, Claude Code, Cursor, or Warp;
- may abandon projects for weeks or months and return later;
- wants minimal manual project management.

V1 is intentionally not a team project-management product.

## 3. Jobs to be done

### JTBD-1 — Resume an abandoned project

When I return to a project after time away, show me:

- project purpose;
- current architecture and technologies;
- what is definitely implemented;
- most recent meaningful work;
- unfinished work;
- known issues / blockers;
- important decisions;
- current Git state;
- the next 1–3 recommended actions;
- evidence supporting those claims.

### JTBD-2 — Track progress without manual upkeep

While I work in Codex, Claude, Cursor or another supported environment, automatically capture enough evidence that Project Memory remains useful without requiring me to manually update a dashboard.

### JTBD-3 — Import projects created before installation

When Project Memory is installed after projects already exist, reconstruct as much state as possible from:

- repository contents;
- Git history;
- current worktree;
- existing documentation;
- tests/build configuration;
- discoverable agent histories;
- optional manually imported conversation exports.

The system must clearly distinguish reconstructed/inferred information from verified facts.

### JTBD-4 — Switch agents without losing continuity

If I stop in Claude and continue in Codex, the new agent should receive the same concise project state and important context.

## 4. Core user experience

### Dashboard

Each project card shows:

- name;
- lifecycle stage;
- last meaningful activity;
- source agent(s);
- branch;
- milestone count if configured;
- current work;
- next action;
- stale-analysis indicator;
- evidence coverage indicator.

Recommended lifecycle stages:

- Idea
- Planning
- Building
- Debugging
- Paused
- MVP Ready
- Shipped
- Archived

Do not use an AI-generated percentage as the primary progress signal.

### Project Resume

The default project detail screen is a **Resume Capsule**:

- Purpose
- Architecture
- Current State
- Implemented
- Work in Progress
- Known Issues / Blockers
- Important Decisions
- Next Actions
- Relevant Files
- Git State
- Last Meaningful Session
- Confidence / evidence coverage
- Analysis freshness

Actions:

- Copy Resume Context
- Refresh Analysis
- Open Repository
- Create Checkpoint
- View History

### History

Chronological view combining:

- sessions;
- Git events;
- checkpoints;
- decisions;
- milestones;
- imports;
- state snapshots.

## 5. Existing-project onboarding

Existing projects are a first-class V1 requirement.

Example:

A user has:

- 5 projects previously developed with Codex;
- 2 projects previously developed with Claude;
- no Project Memory database.

Expected flow:

```bash
npx project-memory init
npx project-memory scan ~/Projects
npx project-memory onboard --all --agent auto
```

System behavior:

1. discover Git repositories;
2. identify language/framework/manifests;
3. collect repository facts;
4. inspect Git history;
5. discover supported local agent histories;
6. match historical sessions to repositories;
7. generate an evidence bundle;
8. run a read-only analysis through an available authenticated agent;
9. validate structured output;
10. store a baseline Project State;
11. show import confidence and source coverage;
12. install future-sync integrations.

A project MUST still be onboardable when no historical agent transcript exists. In that case Git + repository analysis forms the baseline.

## 6. Truth model

Every meaningful claim has one of these provenance classes:

- `verified` — directly supported by repository/Git/tool result
- `explicit` — explicitly recorded by the user/agent as a checkpoint or decision
- `inferred` — model-derived from evidence
- `recommended` — proposed future action, not a statement of current fact

Every derived state has:

- generated timestamp;
- source evidence references;
- analyzer identity;
- confidence;
- freshness status.

## 7. Synchronization model

### Always automatic

The system should automatically capture lightweight factual data:

- project/repository identity;
- branch;
- HEAD commit;
- worktree dirty state;
- changed-file metadata;
- session start/end;
- tool/file-edit metadata where adapters support it;
- test/build command outcomes when observable;
- explicit MCP tool calls;
- timestamps.

### Semantic updates

A semantic Project State can be refreshed by:

1. explicit `project-checkpoint` skill;
2. automatic analyzer run at session completion if configured;
3. dashboard “Refresh Analysis” action;
4. onboarding/reconstruction;
5. next-session resume if the previous analysis is stale.

The dashboard must show factual recent activity immediately even when the last semantic summary is stale.

## 8. Agent-independent analysis

Core storage and synchronization must work with no LLM API key.

Analysis runner interface:

```ts
interface AnalysisRunner {
  id: "codex" | "claude" | "cursor" | "ollama" | "custom";
  isAvailable(): Promise<boolean>;
  analyze(input: AnalysisInput): Promise<ProjectStateCandidate>;
}
```

Possible implementations:

- Codex CLI non-interactive mode
- Claude Code print mode
- Cursor Agent print mode
- optional local Ollama
- optional direct provider later

Analysis is read-only by default.

## 9. Required skills

### `project-onboard`

Use when a repository is new to Project Memory.

Responsibilities:

- collect evidence;
- review history;
- understand architecture;
- create initial Project State;
- identify uncertain conclusions.

### `project-resume`

Use when the user returns to a project.

Responsibilities:

- fetch Resume Capsule;
- inspect changes since last analyzed checkpoint;
- update stale state if necessary;
- return concise continuation guidance.

### `project-checkpoint`

Use after meaningful work.

Responsibilities:

- capture what changed;
- identify completed vs incomplete work;
- record blockers;
- record next intended action;
- attach evidence.

### `project-decision`

Use for an architectural/product/technical decision.

Responsibilities:

- decision;
- rationale;
- alternatives;
- consequences;
- evidence/reference.

### `project-status`

Produce a concise factual project status without modifying the repository.

## 10. V1 supported environments

Priority:

1. Codex
2. Claude Code
3. Cursor
4. Warp (MCP/skills integration after core adapters are stable)

V1 core must remain provider-neutral.

## 11. V1 scope

### In scope

- local-first installation;
- SQLite storage;
- Git repository discovery;
- repository scan;
- Codex history import;
- Claude history import;
- manual Markdown/JSONL session import;
- project baseline reconstruction;
- Project Resume;
- timeline/history;
- current Git state;
- MCP server;
- CLI;
- web dashboard;
- skills;
- Codex hooks;
- Claude hooks;
- Cursor hooks;
- source/evidence references;
- secret redaction;
- analyzer runner abstraction;
- no mandatory API key.

### Out of scope

- team collaboration;
- cloud synchronization;
- issue-tracker replacement;
- agent orchestration;
- autonomous feature development;
- billing/accounts;
- graph database;
- mandatory vector search;
- generated completion percentages;
- hidden chain-of-thought capture.

## 12. Privacy requirements

Defaults:

- local-only;
- listen on loopback only;
- no telemetry;
- no source upload;
- no API key required;
- secrets redacted;
- raw conversation storage optional;
- hidden model reasoning must not be intentionally captured or surfaced.

Capture modes:

- `minimal`: metadata + Git + checkpoints
- `standard`: minimal + user prompts + final responses + tool metadata
- `full`: additionally store available raw transcripts, subject to redaction

Default: `standard`.

## 13. Success criteria

V1 is successful when:

1. A previously unknown Git repository can be onboarded without agent history.
2. Existing Codex/Claude histories can enrich the baseline when available.
3. A user can switch from one supported coding agent to another and receive the same Resume Capsule.
4. Returning to a project after a long gap takes less than 30 seconds to understand.
5. A Project State never presents an inferred item as a verified fact.
6. Removing Project Memory does not damage the source repository.
7. Project Memory can operate without a paid cloud/database dependency.
