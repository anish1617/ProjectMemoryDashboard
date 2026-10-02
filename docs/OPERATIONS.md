# Project Memory operations

The running dashboard at http://127.0.0.1:4319/ uses **D:/personal-project-2/ProjectsMemoryDashboard/.project-memory/dashboard.sqlite**. This local SQLite database stores registered projects, evidence, immutable state snapshots, checkpoints, decisions, activity/search, import jobs and identity bindings. It is not cloud storage. The adjacent `-wal` and `-shm` files belong to SQLite; use the online backup command rather than copying only the main file while it is open.

Illustrative sample projects are bundled with the dashboard and never saved to this database. `PROJECT_MEMORY.md` is the compact development handoff for this tool; product project records live in SQLite. CLI/MCP defaults use `~/.project-memory/memory.sqlite` unless selected explicitly, so always pass the dashboard database or set `PROJECT_MEMORY_DB` to its absolute path. Installed global skills already bind to the dashboard database.

## Durable history imports

```powershell
pnpm run pm import-history D:/exports/session.jsonl --project <project-id> --source codex --batch 100 --db .project-memory/dashboard.sqlite --allow-root D:/exports
pnpm run pm import-jobs --project <project-id> --db .project-memory/dashboard.sqlite
pnpm run pm resume-import <job-id> --batch 100 --db .project-memory/dashboard.sqlite --allow-root D:/exports
```

Each batch commits public redacted messages and its cursor together. Repeat `resume-import` until status is `completed`. Without `--batch`, `import-history` runs all batches. Repeating an unchanged source finds the same job. Changed normalized public content requires a new job; previously committed batches remain immutable. Imports preserve semantic checkpoints and mark activity stale. Source must remain available and within allowed roots after restart. Paths/provider/digests/progress are persisted; hidden reasoning and tool records are excluded.

Metadata matching previews exported files before importing:

```powershell
pnpm run pm match-history D:/exports --project <project-id> --source codex --db .project-memory/dashboard.sqlite --allow-root D:/exports --allow-root D:/path/to/project
```

Add `--apply` to import matches. Matching checks at most 1,000 top-level directory entries and files below 2 MB. It selects only an exact canonical repository `cwd` in Codex session metadata or Claude public export rows. Missing/ambiguous metadata is skipped. Nested export discovery, missing/moved historical paths and unrecognized provider formats require explicit selection; no home-directory transcript crawl runs automatically.

## Dashboard daemon

`pnpm run pm daemon --db .project-memory/dashboard.sqlite --allow-root D:/path/to/projects --port 4319` starts the loopback dashboard and fact poller together. One daemon lease per database refuses a competing daemon; stop releases listener/poller ownership. This is a foreground process, not an installed OS service. While active, the daemon owns product writes. CLI/MCP readers retain SQLite connections and mutations use its authenticated loopback command port. Direct mutations are refused while its lease exists. With no daemon, explicit CLI operations use transactional offline mode. Failed live handshakes never silently fall back to direct writes. Allowed roots are enforced by the daemon; restart it with all desired project/export roots before importing or registering there. The current workspace dashboard is running in this mode.

## Refresh repository facts

```powershell
pnpm run pm watch --db .project-memory/dashboard.sqlite --allow-root D:/path/to/projects --interval 5000
```

This is an explicit foreground poller; stop with Ctrl+C. One owner per database holds an expiring lease, renewed before committing scans. A crashed owner's lease expires. A second watcher waits rather than competing. It scans already registered, allowed repositories and preserves explicit checkpoints. It neither captures conversations nor performs semantic analysis. Missing/out-of-scope projects report a failure count. No OS service is installed; product mutations are routed through the active daemon; direct transactional mode remains available when it is stopped.

## Separate or link repository identities

```powershell
pnpm run pm separate D:/path/to/fork --db .project-memory/dashboard.sqlite
pnpm run pm link D:/path/to/fork --project <target-project-id> --db .project-memory/dashboard.sqlite --allow-root D:/path/to/projects
```

`separate` creates an independent project identity for this canonical root; repeating an existing separate binding is idempotent. `link` explicitly binds the root to an existing project. Target and source must be allowed. These operations do not merge/delete old snapshots or histories. Detached records remain inspectable with `identity_detached` freshness; they must not be refreshed as the newly bound project. Identity bindings are path-based: an independently separated repository moved later needs a deliberate new binding. Default committed ancestry matching and unborn-move limitations still apply.

## Reversible lifecycle hooks

```powershell
pnpm run pm install-hooks codex --config D:/path/to/hooks.json --db .project-memory/dashboard.sqlite --allow-root D:/path/to/projects
pnpm run pm install-hooks claude --config D:/path/to/settings.json --db .project-memory/dashboard.sqlite --allow-root D:/path/to/projects
pnpm run pm install-hooks cursor --config D:/path/to/hooks.json --db .project-memory/dashboard.sqlite --allow-root D:/path/to/projects
```

These commands preview. Add `--apply` to append generated owned entries with original backup and receipt. Minimal capture is default; `--capture standard` also permits bounded redacted public prompt/final response text. Existing settings and unrelated hooks are preserved. Changed bindings/capture require uninstalling the previous owned hooks first. Windows commands use encoded PowerShell with literal arguments; Unix commands use shell quoting. Configuration is generated for the current OS and must be regenerated on another OS.

```powershell
pnpm run pm uninstall-hooks --config <same-config-file>
pnpm run pm uninstall-hooks --config <same-config-file> --apply
```

Removal restores original bytes when unchanged; otherwise it removes only unchanged owned entries and preserves later settings. User-edited owned commands are refused. Codex requires trust review through `/hooks`; successful installation alone does not prove live execution. Provider schema sources checked on 2026-10-02: [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude Code hooks](https://code.claude.com/docs/en/hooks), [Cursor hooks](https://cursor.com/docs/hooks).

Cursor's adapter rejects thought events, ambiguous multiroot payloads, tool output and user identity fields. Transcript paths are not read automatically. Supported lifecycle fixtures and a generated command executed against actual stdin are local proof; provider-emitted real sessions remain a separate gate. No existing user/global hook configuration was changed during development.

## Install all integrations with explicit targets

Create an integration manifest with codex, claude and cursor entries, each containing `mcp` and `hooks` config paths. All six targets must be distinct; relative paths resolve beside the manifest. Codex MCP uses TOML; all other targets use JSON. Choose the actual paths documented by your installed host; no default user configuration is guessed.

```json
{
  "codex": { "mcp": "codex/config.toml", "hooks": "codex/hooks.json" },
  "claude": { "mcp": "claude/mcp.json", "hooks": "claude/settings.json" },
  "cursor": { "mcp": "cursor/mcp.json", "hooks": "cursor/hooks.json" }
}
```

`pnpm run pm install all --config <manifest.json> --db <shared-db> --allow-root <projects>` previews all targets before writing. Add `--apply` to install; conflicts fail at preflight and later failures roll back completed targets where their owned entries are unchanged. Adjacent receipts/backups identify any rollback that was refused. `uninstall all --config <same-manifest>` previews removal; add `--apply` to remove. Multi-file updates are not an OS-atomic transaction; concurrent modifications can require manual recovery. Provider fixtures verify repeat installs, exact restore and rollback. Skills remain a separate installation helper.

## Optional authenticated verification

Build and run `pnpm fixture` first. `scripts/verify-codex-host.mjs` configures only a temporary Codex CLI MCP host against `.project-memory/host-check.sqlite`, proves resume retrieval and saves a unique checkpoint. `scripts/verify-claude-host.mjs` then tests Claude retrieval of that Codex checkpoint and its own persisted update. These require authenticated local clients, can consume subscription usage, and are never run automatically by CI. They disable unrelated tools/hooks/configs and do not alter global provider settings. Both passed on 2026-10-02 with Codex CLI 0.144.5 and Claude Code 2.1.285. `scripts/verify-claude-hooks.mjs` separately passed real start/stop/end events using temporary minimal settings; the generated command was executed by Claude itself. Codex trusted hooks and Cursor actual sessions remain unverified.

Authenticated analysis remains explicit through `onboard --agent codex`. The runner disables shell, multi-agent, apps, hooks and web search using current [Codex configuration settings](https://learn.chatgpt.com/docs/config-file/config-reference); read-only scratch contains redacted evidence. This is not a claim of complete confidentiality isolation or denial of every possible future host tool. Classified errors retain previous valid state without exposing raw stderr/reasoning. Timeouts terminate the process group/tree when the host permits it; failure to terminate is reported separately.

See [backup and restore](BACKUP_RESTORE.md) for recovery. Schema v3 migrates v1/v2 in normal Store operations; read-only `db-check` does not migrate. Keep a backup before upgrading and use the current executable with upgraded databases.
