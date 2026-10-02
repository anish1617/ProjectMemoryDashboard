# Back up and restore Project Memory

Run from `D:\personal-project-2\ProjectsMemoryDashboard` after building the tool. These commands operate on the database; they do not change your project repositories or agent settings.

## Back up the active database

```powershell
pnpm run pm backup .project-memory/backups/memory-backup.sqlite --db .project-memory/dashboard.sqlite
pnpm run pm db-check --db .project-memory/backups/memory-backup.sqlite
```

Choose a new filename for each backup. SQLite's online backup API includes committed WAL data, so the dashboard may stay running. A raw copy of only the active `.sqlite` file can miss committed context in its WAL file.

Before publishing a backup, the tool checks the supported Project Memory table/column signatures, SQLite integrity, foreign keys and schema version. It validates the completed snapshot too. Successful output includes `integrity: "ok"`, schema version, project count and snapshot count. A temporary file is published through a same-directory hard link, then removed; the destination filesystem must support hard links (verified locally on Windows NTFS).

Backup refuses an existing destination, its SQLite sidecars, or the same source/destination. Failures do not overwrite the source or publish a partly written database. Inspection checks storage structure and integrity, not the truth of every historical claim.

## Restore into a new file

```powershell
pnpm run pm restore .project-memory/backups/memory-backup.sqlite --db .project-memory/recovered.sqlite
pnpm run pm db-check --db .project-memory/recovered.sqlite
pnpm run pm list --db .project-memory/recovered.sqlite
```

Restore requires an explicit `--db` destination and refuses existing files/sidecars. It never replaces the live database. Verify the recovered project list and a resume before selecting it for normal use:

```powershell
pnpm run pm resume 'D:\path\to\repository' --db .project-memory/recovered.sqlite
```

Supported v1/v2 databases restore at their original schema version and migrate to v3 on the first normal Store operation such as `list` or `resume`. Evidence and state snapshots survive the tested migration. Newer schema versions, unrelated SQLite files, malformed files and foreign-key failures are rejected. `db-check` inspects without migrating.

## Use the recovered database

Once verified, stop the dashboard server and start it with `--db .project-memory/recovered.sqlite`, preserving your allowed folders and port. CLI, MCP and global project-memory skills must also use the recovered **absolute database path**. The installed skill defaults still point to `.project-memory/dashboard.sqlite`; explicitly provide the recovered path in the chat until its binding is deliberately updated. Restoring does not switch any agent or service automatically.

Keep the old database until you decide it can be retired. This phase provides manual backups and restoration; it does not install a backup schedule or solve exclusive daemon/watcher ownership.
