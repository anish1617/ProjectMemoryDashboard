# Project Memory implementation instructions

Read `PROJECT_MEMORY.md` first at the start of a session or after compaction. Then load `skills/project-development-memory/SKILL.md`. Read only the source/specification sections needed for the current task. The user's latest explicit instruction takes precedence.

## Source of authority

- Product scope: `PRD.md`.
- First milestone and constraints: `CODEX_BUILD_BRIEF.md`.
- Delivery sequence/current gates: `IMPLEMENTATION_PLAN.md` and `PROJECT_MEMORY.md`.
- Adopted revisions and limitations: `DOCUMENT_REVIEW.md`.
- Contracts: `DATA_MODEL.md`, `ARCHITECTURE.md`, `EXISTING_PROJECT_IMPORT.md`, `MCP_AND_SKILLS_SPEC.md`.
- Research notes are time-sensitive references, not runtime evidence.

## Working rules

- Follow the user's 2026-10-02 dashboard-first sequence: mock dashboard, then real local tooling and gradual project onboarding with joint verification. Earlier dashboard phase gates are superseded. Continue remaining phases while preserving explicit runtime acceptance gates.
- Keep TypeScript strict, provider-neutral core, SQLite/Drizzle and Zod. Do not introduce paid/cloud services or a vector database.
- Validate/redact before persistence; never promote historical intent or source presence into verified feature completion.
- Run `pnpm check`, `pnpm test`, and `pnpm format:check` for material implementation changes. Test meaningful behavior and failure boundaries. Record actual results and limitations.
- Update project-local memory immediately after a feature passes relevant checks, and before handing off any partial/blocked work. The user has authorized ongoing updates to this repository's memory. This does not authorize edits to global Codex memory.
- No automatic background memory process is installed. These instructions apply when an agent works in this repository.

## Codebase knowledge graph

Prefer available codebase-memory MCP graph tools for code discovery: `search_graph`, `trace_path`, `get_code_snippet`, `check_index_coverage`, `query_graph`, then `get_architecture`. At session start confirm project/generation via `list_projects` or `index_status`; default evidence tier is Verify.

After discovery, check coverage for all evidence paths and scopes behind negative/exhaustive claims. Paginate relevant results. Clean coverage means no recorded gap, not completeness. Read/grep reported partial, skipped, stale or unknown ranges before relying on them.

Use direct search for non-code documents, literals/configuration, or when tools are unavailable/insufficient; disclose that fallback. Do not claim graph access/coverage if the service failed. Before any authorized delegation, pass scope, generation, queries/pagination, symbols, coverage/fallback and unresolved questions. Do not spawn agents unless the user or applicable instructions authorize delegation.
