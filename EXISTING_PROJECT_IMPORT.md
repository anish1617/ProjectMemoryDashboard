# Existing Project Reconstruction Specification

Delivery clarification (2026-10-02): Mode A is the first slice; histories and recursive discovery follow in Phase 2B. `scan` currently takes one repository. Root-commit identity handles moved committed repositories and common-ancestry worktrees but groups same-ancestry forks; explicit separation/linking is required before broad discovery. Unborn-to-first-commit registration is preserved at the same path. See `DOCUMENT_REVIEW.md` for coverage/privacy limits.

This is a core feature, not a migration convenience.

## Objective

A user should be able to install Project Memory today and obtain useful, evidence-backed state for projects created months earlier.

## Reconstruction modes

### Mode A — Repository only

Guaranteed baseline.

Sources:

- Git history;
- branch;
- tags;
- worktree;
- README/docs;
- manifests;
- migrations;
- project structure;
- tests;
- TODO/FIXME markers;
- CI config;
- issue references found in commits/docs.

Works even when no agent history exists.

### Mode B — Repository + agent history

Preferred.

Adds:

- prior user requests;
- final agent responses;
- tool/file activity;
- session timing;
- historical intent;
- explicit unfinished items;
- prior agent-created plans.

### Mode C — Repository + manually supplied history

Supports:

```bash
project-memory import-history \
  --project <project-id> \
  --source cursor \
  ./cursor-export.md
```

Also support generic Markdown / JSONL import.

## Discovery

### Repository scan

```bash
project-memory scan ~/Projects
```

Options:

```text
--depth
--include
--exclude
--git-only
--dry-run
```

Output:

```text
7 repositories discovered

5 matched Codex history
2 matched Claude history
1 has Cursor export available
0 require history to be useful
```

## Provider import strategy

### Codex

Use local Codex session rollouts when present.

Match session → repository using, in priority order:

1. explicit working directory/session metadata;
2. Git repository root;
3. remote/repo fingerprint;
4. path at time of session;
5. manual mapping.

Do not import hidden reasoning as a product feature. Extract only allowed user/assistant/tool metadata needed for continuity.

### Claude Code

Discover local project transcripts when available and parse stable fields.

Future sessions should be captured using hook-provided:

- session id;
- cwd;
- transcript path;
- final assistant message;
- lifecycle event.

Use versioned parsers so transcript-format changes do not corrupt the canonical DB.

### Cursor

Reliable V1 paths:

- repository analysis;
- future hook capture;
- user-exported Markdown history.

Cursor documents local chat storage, but the application should not require an undocumented internal desktop SQLite schema to reconstruct old projects.

A best-effort Cursor local-history importer may be added behind a versioned adapter after tests against supported versions.

### Warp

V1 onboarding should work through repository scan even without historical Warp transcript import.

Future integration uses skills + MCP. Transcript/history importer can follow once a stable supported interface exists.

## Evidence bundle

Before semantic analysis, build a bounded evidence bundle.

Example:

```json
{
  "project": {},
  "repository": {},
  "git": {
    "current": {},
    "recentCommits": []
  },
  "structure": [],
  "manifests": [],
  "docs": [],
  "tests": [],
  "sessions": [],
  "existingCheckpoints": [],
  "evidenceIndex": []
}
```

Avoid sending an entire repository or all transcripts blindly.

Prioritize:

1. project instructions;
2. README;
3. manifests;
4. current diff;
5. recent commits;
6. recently changed files;
7. architecture docs;
8. recent relevant sessions;
9. tests relating to recent code;
10. selected historical evidence.

## Baseline analyzer

Command concept:

```bash
project-memory onboard ./my-project --agent codex
```

or:

```bash
project-memory onboard ./my-project --agent auto
```

`auto` selects an authenticated supported CLI with explicit user-visible output.

The runner must operate read-only during baseline analysis.

Expected structured result:

```json
{
  "purpose": [],
  "architecture": [],
  "implemented": [],
  "inProgress": [],
  "blockers": [],
  "knownIssues": [],
  "decisions": [],
  "nextActions": [],
  "relevantFiles": [],
  "lifecycleStage": {}
}
```

## Reconstruction confidence

Dashboard shows evidence coverage:

```text
Repository      High
Git History     High
Codex History   High
Claude History  None
Cursor History  Manual import available
Checkpoints     None
Semantic State  Generated
```

Do not reduce this to a single misleading percentage.

## Handling contradictions

Example:

- old transcript says authentication is unfinished;
- repository now contains completed authentication implementation;
- Git commit after transcript says "complete auth flow."

Resolution:

- later repository/Git evidence takes precedence for current implementation;
- transcript remains historical;
- record contradiction in analyzer diagnostics;
- do not rewrite history.

## Deduplication

Use:

```text
provider + external_session_id
```

and event content hashes.

Repeated scans must be idempotent.

## Re-run reconstruction

```bash
project-memory reconstruct <project>
```

This creates a new immutable state snapshot. It never deletes old state/history.

## Acceptance scenario

Given:

- 5 pre-existing Codex projects;
- 2 pre-existing Claude projects;
- no Project Memory installation;

When the user installs Project Memory and scans their project folders;

Then:

- all seven repos can be registered;
- available Codex/Claude sessions are associated to the correct repos;
- each repo receives a baseline even if no transcript is available;
- each baseline shows evidence provenance;
- the dashboard shows current state, last meaningful activity and next actions;
- future sessions begin with normal synchronization enabled.
