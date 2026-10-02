# Data Model — Project Memory v0.1

Initial-slice mapping (2026-10-02): `packages/db/src/index.ts` implements projects, root associations, immutable content-addressed evidence, observed bundles and state snapshots with migration version 1. The remaining entities are planned contracts. Each bundle scopes validation to one project/current observation. Verified claim text must match deterministic factText. Before MCP mutation, add schema/analyzer version, analysis-attempt records, observation links and optimistic snapshot revision; see `DOCUMENT_REVIEW.md`.

## Core entities

Current mapping (2026-10-02): schema v2 adds scoped activity, deduplication and FTS5 literal search to the initial tables. State mutation requires schemaVersion1 and expectedSnapshotId through MCP; immutable persisted evidence payloads are compared before saving. Activity/checkpoint/import changes are transactional. This is a subset of the full entities below: analysis-attempt/version tracking, full session/import-job lifecycle, explicit identity links and backup/restore are still pending.

### `projects`

- `id`
- `name`
- `slug`
- `description`
- `lifecycle_stage`
- `created_at`
- `updated_at`
- `archived_at`

### `repository_roots`

- `id`
- `project_id`
- `path`
- `remote_fingerprint`
- `repo_fingerprint`
- `is_primary`
- `first_seen_at`
- `last_seen_at`

### `agent_sessions`

- `id`
- `project_id`
- `provider`
- `external_session_id`
- `repository_root_id`
- `started_at`
- `ended_at`
- `transcript_ref`
- `capture_mode`
- `imported`
- `metadata_json`

Unique key:

```text
(provider, external_session_id)
```

### `session_events`

Append-only.

- `id`
- `session_id`
- `project_id`
- `type`
- `occurred_at`
- `sequence`
- `payload_json`
- `content_hash`
- `redaction_status`

### `git_snapshots`

- `id`
- `project_id`
- `repository_root_id`
- `captured_at`
- `branch`
- `head_sha`
- `upstream`
- `ahead`
- `behind`
- `dirty`
- `changed_files_json`
- `stash_count`

### `evidence`

Canonical references used by derived claims.

- `id`
- `project_id`
- `type`
- `source_uri`
- `observed_at`
- `content_hash`
- `excerpt_or_metadata_json`

Example source URIs:

```text
git:commit:8ca17e2
git:worktree:2026-10-02T10:15:00Z
file:src/auth.ts@sha256:...
agent:codex:<session-id>#event:104
agent:claude:<session-id>#message:38
checkpoint:<checkpoint-id>
```

### `checkpoints`

- `id`
- `project_id`
- `session_id`
- `title`
- `summary`
- `completed_json`
- `in_progress_json`
- `blockers_json`
- `next_actions_json`
- `created_at`
- `source`

### `decisions`

- `id`
- `project_id`
- `title`
- `decision`
- `rationale`
- `alternatives_json`
- `consequences_json`
- `status`
- `created_at`
- `evidence_refs_json`

### `milestones`

- `id`
- `project_id`
- `title`
- `status`
- `sort_order`
- `created_at`
- `completed_at`

Status:

```text
planned | active | completed | cancelled
```

### `state_snapshots`

Immutable semantic state generations.

- `id`
- `project_id`
- `generated_at`
- `analyzer`
- `analyzer_version`
- `schema_version`
- `confidence`
- `freshness_at_generation`
- `state_json`

### `project_current_state`

Projection pointing to the current snapshot and live factual state.

- `project_id`
- `state_snapshot_id`
- `last_activity_at`
- `last_git_snapshot_id`
- `semantic_freshness`
- `evidence_coverage_json`

### `imports`

- `id`
- `project_id`
- `source_type`
- `source_location`
- `started_at`
- `completed_at`
- `status`
- `items_seen`
- `items_imported`
- `items_skipped`
- `errors_json`

## ProjectState schema concept

```ts
type Provenance = "verified" | "explicit" | "inferred" | "recommended";

type Claim = {
  text: string;
  provenance: Provenance;
  confidence: number; // 0..1
  evidenceRefs: string[];
};

type ProjectState = {
  purpose: Claim[];
  architecture: Claim[];
  implemented: Claim[];
  inProgress: Claim[];
  blockers: Claim[];
  knownIssues: Claim[];
  decisions: Claim[];
  nextActions: Claim[]; // normally provenance=recommended
  relevantFiles: Array<{
    path: string;
    reason: string;
    evidenceRefs: string[];
  }>;
  lifecycleStage: {
    value:
      | "idea"
      | "planning"
      | "building"
      | "debugging"
      | "paused"
      | "mvp_ready"
      | "shipped"
      | "archived";
    confidence: number;
    evidenceRefs: string[];
  };
};
```

## Evidence validation rule

A state candidate must obey:

- `verified` requires at least one verifiable evidence reference;
- `explicit` requires a checkpoint/decision/user/session reference;
- `inferred` should normally include supporting evidence;
- `recommended` may have evidence but is clearly future-facing;
- no derived claim may be stored as `verified` solely because an LLM said it.

## Search

V1:

- SQLite FTS5 over checkpoints, decisions, final responses, summaries and selected text evidence;
- project filter;
- provider filter;
- date range;
- provenance filter.

Embeddings are deferred.
