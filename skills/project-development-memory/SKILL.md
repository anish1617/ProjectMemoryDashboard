---
name: project-development-memory
description: Maintain concise evidence-backed development memory for this Project Memory repository after tested features, decisions, failures, or handoffs.
---

# Project development memory

This skill maintains this repository's development continuity. It is separate from the product's project-checkpoint skill and database.

## Resume

Read `PROJECT_MEMORY.md` first. Use its source pointers to load the current milestone's files and relevant specification sections. Verify drift-prone facts with current source, Git or commands; previous test results are dated evidence, not proof of the current checkout. Do not reread every imported document each iteration.

## Checkpoint triggers

Update `PROJECT_MEMORY.md` after a meaningful feature passes its acceptance checks, after an adopted architecture decision, and before handoff of incomplete/failed/environment-blocked work. Do not wait for a fixed number of turns or every small edit. The user authorized these project-local updates.

For each checkpoint record:

- date, milestone/feature and status: completed, partial, failed or environment-blocked;
- observable change and exact source/test pointers;
- commands, results and scope; distinguish unit/fixture checks from real integrations;
- unresolved limits and the next 1–3 actions;
- commit SHA if available; otherwise say no Git repository or uncommitted, never invent one.

Completion requires behavior evidence, not merely generated code. Do not mark authenticated runners, browser UX or cross-agent hooks working from mocked tests.

## Compact without losing evidence

Keep `PROJECT_MEMORY.md` near 800–1,200 words; this is a working budget, not a reason to discard unresolved facts. Replace obsolete next steps and consolidate repeated passing checks. Keep stable decisions as short entries with links to their detailed source.

When detailed checkpoint history exceeds that budget, move older details into `docs/checkpoints/YYYY-MM-DD-short-name.md` and retain a one-line indexed pointer. Preserve commands/results, decision rationale and unresolved risks in linked history. Do not copy raw transcripts or secrets. Do not rewrite raw product evidence; the development resume is a mutable projection.

Before finishing, verify referenced paths exist and the memory agrees with tested scope. Failed/skipped tests stay visible until resolved. Partial work must remain distinguishable from completed work.
