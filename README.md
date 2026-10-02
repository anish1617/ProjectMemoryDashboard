# Project Memory — Product & Architecture Blueprint v0.1

## Development status

The repository contains a resume-first React dashboard, local CLI/service/API, SQLite persistence, MCP stdio server, public-history importer and reversible MCP config tooling. Samples are clearly labeled and separate from live records. Authenticated Codex analysis and Codex-host MCP resume/checkpoint passed on a disposable fixture. Real vendor hook sessions and remaining host compatibility retain their own acceptance gates. Start future work from `PROJECT_MEMORY.md`; see `IMPLEMENTATION_PLAN.md` for tested and pending phases.

Requirements: Node.js 24+, Git, pnpm 11.15.0. Dependency versions are locked. SQLite platform prebuilds are used; local native compilation is disabled.

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm run pm init --db .project-memory/memory.sqlite
pnpm run pm onboard D:/path/to/existing-repository --db .project-memory/memory.sqlite
pnpm run pm resume D:/path/to/existing-repository --db .project-memory/memory.sqlite
```

`pnpm run pm onboard <repository> --agent codex` explicitly enables optional redacted evidence synthesis through the authenticated Codex CLI. Without it, onboarding produces a useful persisted factual baseline. `PROJECT_MEMORY_DB` can select a stable database path; the default is `~/.project-memory/memory.sqlite`. `PROJECT_MEMORY_CODEX` can select the executable path when Codex is not on PATH. No provider config is modified.

`scan <folder> --recursive --depth 2` discovers and registers repositories. This workspace initially contained documents and no Git repository; target an existing Git project. Tests create disposable fixtures. Source/test evidence and real integration evidence are distinguished in project memory.

## Dashboard and shared tool

For adding your productivity, harness, MVC2React and other Codex repositories, follow [Adding projects](docs/ADDING_PROJECTS.md). Use the same database as your dashboard and configure allowed folders before dashboard scans.

```powershell
pnpm build
pnpm fixture
pnpm serve --db .project-memory/dashboard.sqlite --allow-root D:/personal-project-2/ProjectsMemoryDashboard
```

Open [the local dashboard](http://127.0.0.1:4317). Explore samples, then choose **Use local projects** and **Add project**. The fixture command prints a disposable repository path. Add further allowed folders with repeated `--allow-root`; keep the same `--db` for CLI and MCP. `pnpm dev` starts Vite for sample UI development; the production service supplies the live API.

```powershell
pnpm run pm list --db .project-memory/dashboard.sqlite
pnpm run pm checkpoint D:/path/to/repo --db .project-memory/dashboard.sqlite --summary "What changed and passed" --next "One concrete next action"
pnpm run pm history D:/path/to/repo --db .project-memory/dashboard.sqlite
pnpm run pm import-history D:/path/to/public-history.jsonl --project <id> --source codex --db .project-memory/dashboard.sqlite --allow-root D:/path/to/history
pnpm run pm mcp --db .project-memory/dashboard.sqlite --allow-root D:/path/to/projects
```

The fourteen MCP tools are defined in `packages/mcp-server/src/server.ts`; portable workflows live in `skills/project-onboard`, `project-resume`, `project-checkpoint`, `project-decision`, and `project-status`. Hook ingestion accepts selected normalized public fields on stdin through `pm hook --provider codex|claude|cursor --capture minimal|standard`. It is not installed automatically and provider compatibility remains unverified.

See [Operations and storage](docs/OPERATIONS.md) for the active database location, durable import jobs, metadata matching, foreground refresh, identity bindings and reversible lifecycle hooks.

## Reversible MCP configuration

Manual database recovery is available through `pm backup`, `pm restore` and `pm db-check`; see [Backup and restore](docs/BACKUP_RESTORE.md). Restore writes only to an explicit new destination and preserves the active database.

```powershell
pnpm run pm install codex --config D:/path/to/config.toml --db .project-memory/dashboard.sqlite --allow-root D:/path/to/projects
```

This previews the owned MCP entry. Add `--apply` to write it with an adjacent original backup and receipt. Providers: `codex` (TOML), `claude` and `cursor` (JSON). Existing values are preserved; TOML comments/formatting may change. `pnpm run pm uninstall --config <same-path>` previews removal; `--apply` restores unchanged original bytes or removes only the unchanged owned entry while preserving later settings. Conflicts fail before overwrite. Skills/hooks require separate host setup; successful config writing does not prove host loading.

`pnpm run pm doctor --db <database>` reports storage, dashboard assets and Codex executable availability; it does not prove authentication or installed hooks. Automated checks cover real HTTP and official MCP client/stdio calls, normalized hooks and temporary installer configurations. See memory for remaining V1 gates and the Windows symlink test skip.

---

Working name: **Project Memory**  
Working package name: `project-memory`  
Core principle: **The project is the source of continuity; coding agents are interchangeable workers.**

## Problem

AI-assisted developers frequently switch between projects and coding agents. After days or months away, a developer must spend significant time reconstructing:

- what the project does;
- what is already implemented;
- what was being worked on;
- why architectural decisions were made;
- what is broken or blocked;
- what files matter;
- what should happen next.

Existing agent-memory products generally optimize for persistent recall. Project Memory focuses on **project continuity**: reconstructing the current state of a software project and making it portable across Codex, Claude Code, Cursor, Warp, and future agent environments.

## Product promise

> Open any project—even one created before Project Memory was installed—and understand where you stopped, what is true now, and what to do next in under 30 seconds.

## Key differentiator

Project Memory stores two distinct classes of information:

1. **Evidence / facts**
   - Git commits, branches and worktree state
   - repository files and manifests
   - tests and build results
   - agent session metadata
   - file changes
   - explicit checkpoints and decisions

2. **Derived interpretation**
   - current project summary
   - project stage
   - completed work
   - active work
   - blockers
   - likely next actions
   - recommendations

Derived claims must reference evidence and carry confidence/provenance.

## V1 outcome

V1 must solve three flows extremely well:

1. **Onboard an existing project**
2. **Automatically keep the project state synchronized**
3. **Resume a project from any supported coding agent**

See the other documents in this bundle for the detailed PRD, architecture, data model, MCP contract, existing-project import specification, and implementation plan.
