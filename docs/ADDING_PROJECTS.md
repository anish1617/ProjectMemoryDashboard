# Add projects to Project Memory

Project Memory registers an existing **Git repository folder**, whether you work on it in Codex, Claude, Cursor or another editor. Choose the repository root, not a Codex chat. Registration reads bounded repository/Git evidence; it does not copy or change source files.

## This project

`D:\personal-project-2\ProjectsMemoryDashboard` is registered in `.project-memory/dashboard.sqlite`. Its dashboard name is **ProjectsMemoryDashboard**. A local Git repository was initialized because registration requires Git; no commit or remote was created. The disposable **Continuity Fixture** remains a separate test project. The sample **Project Memory** card is illustrative and separate from this real record.

## Add one project through the dashboard

1. Open <http://127.0.0.1:4319/> and choose **Use local projects**.
2. Check **Settings → Allowed project folders**. The project's repository must be inside one of these folders.
3. Choose **Projects → Add project**, enter the full Git repository path, then **Scan and add**.
4. Open its resume. Repository facts appear immediately. Use **Checkpoint** to describe what you built/tested, where you stopped, and one next action. A checkpoint is labeled explicit; it does not automatically verify completed features.
5. After later work, use **Refresh evidence** and save another checkpoint. Reload the dashboard to see changes made by the CLI.

If the folder is outside the allowed roots, restart the service as below. If it is not a Git repository, initialize Git in that project's own workspace only when you intend to manage it with Git. Registration currently requires Git.

## Allow your productivity, harness, MVC2React and side-project folders

Run commands from the Project Memory workspace. Stop its running server before reusing port4319. Keep **the same database path** so existing projects remain visible. Replace the example parent folders with your actual project locations; repeated `--allow-root` options are supported. These options allow later explicit scans; they do not automatically register every folder.

```powershell
Set-Location 'D:\personal-project-2\ProjectsMemoryDashboard'
pnpm serve --port 4319 --db .project-memory/dashboard.sqlite --allow-root 'D:\personal-project-2' --allow-root 'D:\deheus-projects'
```

If an example folder does not exist, omit it. If another server owns4319, stop that server or use a different port and open the corresponding URL. When the server was launched in a terminal, Ctrl+C stops it. For a server launched by Codex, ask Codex to restart the dashboard with your chosen allowed folders.

## Add from the CLI

Use `pnpm run pm` (including `run`); `pnpm pm` conflicts with a pnpm command. Replace the example paths. All commands below use the dashboard database.

```powershell
Set-Location 'D:\personal-project-2\ProjectsMemoryDashboard'
pnpm run pm onboard 'D:\path\to\productivity-repository' --db .project-memory/dashboard.sqlite
pnpm run pm onboard 'D:\path\to\harness-repository' --db .project-memory/dashboard.sqlite
pnpm run pm onboard 'D:\path\to\mvc2react-repository' --db .project-memory/dashboard.sqlite
pnpm run pm list --db .project-memory/dashboard.sqlite
```

Reload the dashboard, choose **Use local projects**, and open the new project. A CLI registration can succeed outside the dashboard's allowed roots; configure those roots too so dashboard refresh works.

For many repositories, preview discovery before registering:

```powershell
pnpm run pm discover 'D:\path\to\side-projects' --depth 2 --db .project-memory/dashboard.sqlite
pnpm run pm scan 'D:\path\to\side-projects' --recursive --depth 2 --db .project-memory/dashboard.sqlite
```

Discovery is bounded; increase depth if your repositories are nested more deeply. The recursive scan registers every Git repository it discovers in that folder, so select a suitable scope. For nested frontend/backend repositories, add the actual Git roots individually.

## Keep continuity while using Codex

### Global conversation skill (installed 2026-10-02)

The user-wide `project-memory` skill is installed for local Codex at `C:\Users\ACER\.agents\skills\project-memory` and local Claude Code at `C:\Users\ACER\.claude\skills\project-memory`. Both use this tool's absolute CLI path and the same `.project-memory/dashboard.sqlite`. No MCP configuration is required for this skill.

From the project's own chat:

```text
Codex: $project-memory add this project and save its current context.
Claude Code: /project-memory add this project and save its current context.
```

Then request ongoing updates for that chat:

```text
Use project-memory throughout this chat. After each meaningful feature is built and tested, save what changed, actual test results, remaining issues and the next action. Save a checkpoint before handing off partial work.
```

For returning projects: `$project-memory resume this project` in Codex or `/project-memory resume this project` in Claude Code. This is an agent workflow; invocation is not an installed background watcher. It updates the database and follows existing project-local memory instructions when asked. It does not automatically read all past chats or overwrite another project's memory files.

The skill should be available on the next turn; if it is missing, restart the agent session. Local skill installation does not make this Windows tool available in Claude Cowork or cloud sessions. CLI behavior and skill files have been validated; actual provider discovery/invocation should be confirmed in the next session.

The maintained source is `skills/project-memory`. `scripts/install-global-project-memory.ps1` installs it in both user-wide locations, permits identical repeat installs and refuses different existing files. It does not modify global instruction files or hook settings. Official discovery/invocation references: [Codex skills](https://learn.chatgpt.com/docs/build-skills) and [Claude Code skills](https://code.claude.com/docs/en/skills).

Registration does **not** automatically import old Codex conversations or activate live synchronization. No live hooks/watcher are installed. Use a checkpoint after a meaningful feature is built/tested:

```powershell
pnpm run pm checkpoint 'D:\path\to\repository' --db .project-memory/dashboard.sqlite --summary 'What changed, what was tested, and remaining limits' --next 'One concrete next action'
pnpm run pm resume 'D:\path\to\repository' --db .project-memory/dashboard.sqlite
```

You can ask Codex in the project's chat: “After testing this feature, save a Project Memory checkpoint using the CLI at D:\personal-project-2\ProjectsMemoryDashboard and its .project-memory\dashboard.sqlite database.” That does not require a new cloud account or API key.

Optional existing public history import uses a file you explicitly select. First use `list` to get the project's ID, then:

```powershell
pnpm run pm import-history 'D:\path\to\selected-public-history.jsonl' --project '<project-id>' --source codex --db .project-memory/dashboard.sqlite --allow-root 'D:\path\to'
```

The bounded parser selects supported public user/final text and excludes reasoning/tool records. It does not automatically discover or associate all historical chats. Imported statements remain separate from current repository verification.

Default onboarding is deterministic and local. Optional `--agent codex` analysis is not needed to add projects; its successful runtime gate is still open. MCP configuration instructions are in `README.md`; configuring a server does not by itself prove automatic event capture.
