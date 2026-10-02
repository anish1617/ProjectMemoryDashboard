# MCP & Skills Contract — v0.1

Implementation clarification (2026-10-02): product MCP/tools/skills are implemented locally; vendor-host runtime acceptance remains open. The repository's `skills/project-development-memory` is a development workflow, not an implemented product tool. State mutations use schemaVersion, expectedSnapshotId/revision and explicit project scope; evidence is validated against the selected project observation. Use current stable MCP v2 server/client packages and verify real clients. See `DOCUMENT_REVIEW.md`.

## Design rule

Current implementation (2026-10-02): eleven scoped tools in `packages/mcp-server/src/server.ts` and five product skills under `skills/project-*` are built. Real official MCP client/stdio tests verify discovery, repository registration, checkpoint/resume and revision rejection. Actual Codex/Claude/Cursor host loading and live cross-agent sessions remain open gates; temporary installer fixtures do not prove provider compatibility. The development-memory skill remains separate.

MCP exposes state/data operations.  
Skills define the repeatable workflow that agents should follow.

Do not encode a whole workflow into one giant MCP tool.

## MCP tools

### `project_identify`

Input:

```json
{
  "cwd": "/path/to/repo"
}
```

Output:

```json
{
  "found": true,
  "projectId": "...",
  "repositoryRoot": "...",
  "semanticFreshness": "fresh|stale_activity|needs_analysis"
}
```

### `project_register`

Register an untracked repository.

Input:

```json
{
  "cwd": "/path/to/repo",
  "name": "optional"
}
```

### `project_get_resume`

Input:

```json
{
  "projectId": "...",
  "maxTokens": 1200,
  "includeEvidence": false
}
```

Returns the latest concise Resume Capsule plus freshness.

### `project_get_evidence_bundle`

Input:

```json
{
  "projectId": "...",
  "reason": "onboard|resume|checkpoint|reconstruct",
  "since": "optional timestamp"
}
```

Returns bounded evidence and evidence IDs.

### `project_save_state`

Input: strict ProjectState candidate with evidence refs.

Server validates provenance/evidence before persistence.

### `project_create_checkpoint`

Input:

```json
{
  "projectId": "...",
  "title": "...",
  "summary": "...",
  "completed": [],
  "inProgress": [],
  "blockers": [],
  "nextActions": [],
  "evidenceRefs": []
}
```

### `project_record_decision`

Input:

```json
{
  "projectId": "...",
  "title": "...",
  "decision": "...",
  "rationale": "...",
  "alternatives": [],
  "consequences": [],
  "evidenceRefs": []
}
```

### `project_get_history`

Filters:

- project;
- date;
- source agent;
- event types;
- full-text query.

### `project_list`

Returns concise portfolio state.

### `project_refresh_git`

Captures a fresh deterministic Git snapshot.

### `project_search`

FTS5 search across memories/checkpoints/decisions/session summaries.

## Skills

## `project-onboard/SKILL.md`

Workflow:

1. identify/register repo;
2. request onboarding evidence bundle;
3. inspect only the minimum necessary additional files;
4. build ProjectState using evidence labels;
5. do not infer completed work solely from TODO text or old transcript claims;
6. save state;
7. show uncertainties.

## `project-resume/SKILL.md`

Workflow:

1. identify project;
2. refresh Git;
3. fetch Resume Capsule;
4. if stale, fetch delta evidence and refresh state;
5. present:
   - where we stopped;
   - what changed;
   - blockers;
   - next 1–3 actions;
6. do not modify code unless the user's request also asks to continue implementation.

## `project-checkpoint/SKILL.md`

Workflow:

1. inspect current diff/Git state;
2. review this session's relevant tool actions;
3. separate completed / partial / failed work;
4. record test/build evidence;
5. record next intended actions;
6. create checkpoint;
7. update Project State if material changes occurred.

## `project-decision/SKILL.md`

Capture:

- context;
- decision;
- rationale;
- alternatives;
- consequences;
- references.

## `project-status/SKILL.md`

Return concise project status suitable for dashboard review. Never fabricate a completion percentage.

## Resume Capsule contract

Recommended target: 500–1,500 tokens.

```text
Project
Purpose
Stage
Architecture
Implemented
Current Work
Blockers / Known Issues
Recent Changes
Important Decisions
Next Actions
Relevant Files
Git State
Evidence/Freshness Note
```

## Installation philosophy

Provide:

```bash
npx project-memory init
npx project-memory install codex
npx project-memory install claude
npx project-memory install cursor
npx project-memory install warp
npx project-memory install all
```

Installer responsibilities:

- start/configure local daemon;
- add MCP server configuration;
- install skills in the provider-supported location;
- install provider hook adapter where supported;
- never overwrite existing config blindly;
- backup config before mutation;
- show a diff;
- support `uninstall` cleanly.
