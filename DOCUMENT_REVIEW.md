# Document review and implementation decisions

Reviewed all nine imported Markdown documents on 2026-10-02. The product remains a local-first, provider-neutral continuity layer. CODEX_BUILD_BRIEF.md controls the initial build; the PRD describes the full V1, not the first milestone.

## Revisions adopted

| Gap                                                                   | Decision                                                                                                    | Impact                                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Phase 2 bundles transcript import with the first analyzer slice       | Split Phase 2 into 2A repository-only reconstruction and 2B historical import                               | Prove the guaranteed no-history baseline before provider parsers                    |
| “No source upload” conflicts with authenticated cloud agent analysis  | Default is deterministic/local-only; explicit `--agent codex` sends redacted evidence via that CLI          | No mandatory API key; cloud analysis is still a disclosure boundary                 |
| A valid evidence reference does not establish the truth of a sentence | Verified analyzer claims must exactly match deterministic factText; feature interpretations remain inferred | File presence and commit messages cannot verify working functionality               |
| Remote URL/ancestry can merge unrelated projects                      | Initial identity uses root commits, not remote alone; disclose same-ancestry fork grouping                  | Explicit separate/link identity override is required before broad discovery         |
| Immutable evidence versus redaction/deletion                          | Redact before persistence and hashing; normal ingestion never updates evidence                              | User-requested deletion/retention must later remove records, not rewrite narratives |
| Daemon required before CLI functionality                              | Direct SQLite ownership for the CLI slice; daemon becomes owner in API/MCP phase                            | Avoid a premature service dependency; WAL and transactions now                      |
| Schema is conceptual, migrations/version ownership unclear            | Zod is canonical; generate JSON Schema; numbered transactional SQLite migration                             | Shared runner validation and versioned persistence                                  |
| Repository input may contain instructions or symlinks                 | Bound evidence; reject symlink paths; use isolated runner scratch cwd                                       | Prompt text is untrusted; read-only is not filesystem confidentiality isolation     |
| Git state claimed “always current”                                    | Refresh on CLI operation; semantic freshness compares evidence digests                                      | No watcher/live-sync claim before hooks exist                                       |
| Hooks assumed identical across vendors                                | Implement versioned capability maps and compatibility fixtures at their phases                              | No vendor configuration is installed in this milestone                              |
| MCP mutation schemas omit scope/version/concurrency fields            | Add project scope, schema version and optimistic state revision before MCP writes                           | Prevent cross-project evidence and stale state writes                               |

## Research verification

Primary sources fetched during this review:

- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) and local `codex exec --help`: structured output and read-only sandbox flags. Local help additionally exposes ignore-user-config, ignore-rules and ephemeral flags; availability is checked before use.
- [Codex hooks](https://learn.chatgpt.com/docs/hooks): use documented events, then test supported payloads at implementation time.
- [Claude hook reference](https://code.claude.com/docs/en/hooks): lifecycle payload contract; do not assume transcript schema stability from hook stability.
- [Cursor hooks](https://cursor.com/docs/hooks): provider-specific compatibility remains a future integration gate.
- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk): current main is stable v2 with separate server/client packages. The original v2 choice is supported, but no SDK is needed before Phase 3.
- [Drizzle SQLite guidance](https://orm.drizzle.team/docs/sqlite/get-started-sqlite): SQLite drivers supported. This slice uses released Drizzle 0.45.3 with better-sqlite3 13.0.3, whose packaged platform prebuilds work without local compilation. Lockfile controls exact dependencies.

The imported research notes were guidance, not proof that every integration works in this installation. No history importer, live hook, MCP handshake, dashboard or authenticated analyzer invocation was proved by reading documentation.

## Outstanding decisions and limits

- Root-commit identity groups forks with identical ancestry. Unborn repositories have path-based identity until their first commit. Separate/link identity and explicit move mapping need a future acceptance gate.
- Scanner currently caps 500 candidate files, 64 KB per file, 256 KB content total. It reports partial coverage; no exhaustive repository interpretation is claimed.
- Pattern redaction is defense in depth, not a guarantee for arbitrary embedded secrets. Add configurable allowlists, provider token fixtures and capture-mode tests before transcripts.
- Read-only Codex scratch execution disables inherited user config and rules; the prompt prohibits tools. An OS read-only sandbox does not guarantee that unrelated readable files cannot be accessed. Strong tool denial/confidentiality isolation and process-tree timeout handling remain runner hardening work before sensitive repositories.
- Analyzer errors currently produce safe generic diagnostics, not persisted analysis-attempt records. Version, scoped errors, observation links and concurrency become necessary before daemon/MCP writes.
- `scan` currently means one repository. Recursive portfolio discovery, manual imports, auto selection, installation and all live integrations remain planned.

## Delivery boundary

This iteration builds and tests the local CLI foundation and repository-only continuity flow. A fake runner tests the analysis pipeline; installed Codex capability help is checked. Authenticated Codex analysis is a separate runtime acceptance gate and is not claimed complete unless exercised.
