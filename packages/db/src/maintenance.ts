import Database from "better-sqlite3";
import { mkdir, link, rm, lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export class MaintenanceError extends Error {}
export type DatabaseInspection = {
  schemaVersion: number;
  projects: number;
  snapshots: number;
  integrity: "ok";
};
const baseColumns: Record<string, string[]> = {
  projects: ["id", "fingerprint", "name"],
  repository_roots: ["path", "project_id"],
  observations: ["id", "project_id", "captured_at", "bundle"],
  evidence: ["id", "project_id", "payload"],
  state_snapshots: [
    "id",
    "project_id",
    "generated_at",
    "analyzer",
    "fingerprint",
    "state",
  ],
};
function inspect(connection: Database.Database): DatabaseInspection {
  const version = connection.pragma("user_version", { simple: true }) as number;
  if (version > 3)
    throw new MaintenanceError(
      "Database schema is newer than this application; use a compatible version.",
    );
  if (version < 1)
    throw new MaintenanceError(
      "File is not a supported Project Memory database.",
    );
  const required = {
    ...baseColumns,
    ...(version >= 2
      ? {
          activity: [
            "id",
            "project_id",
            "type",
            "title",
            "summary",
            "occurred_at",
            "source",
            "evidence_refs",
            "dedup_key",
          ],
          activity_search: ["id", "project_id", "title", "summary"],
        }
      : {}),
    ...(version >= 3
      ? {
          import_jobs: [
            "id",
            "project_id",
            "source",
            "provider",
            "digest",
            "total",
            "cursor",
            "imported",
            "status",
          ],
          leases: ["name", "owner", "expires"],
          identity_bindings: ["path", "project_id"],
        }
      : {}),
  };
  for (const [table, columns] of Object.entries(required)) {
    const entry = connection
      .prepare("SELECT type FROM sqlite_master WHERE name=?")
      .get(table) as { type: string } | undefined;
    const actual = (
      connection.pragma(`table_info(${table})`) as Array<{ name: string }>
    ).map((c) => c.name);
    if (
      entry?.type !== "table" ||
      columns.some((column) => !actual.includes(column))
    )
      throw new MaintenanceError(
        "File is not a supported Project Memory database.",
      );
  }
  if (
    connection.pragma("integrity_check(1)", { simple: true }) !== "ok" ||
    (connection.pragma("foreign_key_check") as unknown[]).length
  )
    throw new MaintenanceError(
      "Database integrity check failed; original file preserved.",
    );
  return {
    schemaVersion: version,
    projects: (
      connection.prepare("SELECT count(*) AS n FROM projects").get() as {
        n: number;
      }
    ).n,
    snapshots: (
      connection.prepare("SELECT count(*) AS n FROM state_snapshots").get() as {
        n: number;
      }
    ).n,
    integrity: "ok",
  };
}
export function inspectDatabase(path: string): DatabaseInspection {
  let connection: Database.Database | undefined;
  try {
    connection = new Database(resolve(path), {
      readonly: true,
      fileMustExist: true,
    });
    return inspect(connection);
  } catch (error) {
    if (error instanceof MaintenanceError) throw error;
    throw new MaintenanceError(
      "Cannot read a valid database; check the selected file and permissions.",
    );
  } finally {
    connection?.close();
  }
}
async function assertNewDestination(path: string) {
  for (const candidate of [
    path,
    path + "-wal",
    path + "-shm",
    path + "-journal",
  ]) {
    try {
      await lstat(candidate);
      throw new MaintenanceError(
        "Destination already exists (or has SQLite sidecars); select a new database path.",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
async function snapshot(
  source: string,
  destination: string,
  operation: "backup" | "restore",
) {
  const from = resolve(source),
    to = resolve(destination);
  if (from === to)
    throw new MaintenanceError(
      "Source and destination must be different database paths.",
    );
  await assertNewDestination(to);
  let connection: Database.Database | undefined;
  const temporary = to + ".partial-" + randomUUID();
  try {
    connection = new Database(from, { readonly: true, fileMustExist: true });
    connection.pragma("busy_timeout=5000");
    inspect(connection);
    await mkdir(dirname(to), { recursive: true });
    // SQLite's backup API includes committed WAL pages; copying the main file alone does not.
    await connection.backup(temporary);
    connection.close();
    connection = undefined;
    const complete = new Database(temporary, { fileMustExist: true });
    let inspection: DatabaseInspection;
    try {
      complete.pragma("journal_mode=DELETE");
      inspection = inspect(complete);
    } finally {
      complete.close();
    }
    await assertNewDestination(to);
    // Same-directory hard link publishes the completed snapshot without overwriting a racing file.
    await link(temporary, to);
    return { operation, path: to, ...inspection };
  } catch (error) {
    if (error instanceof MaintenanceError) throw error;
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new MaintenanceError(
        "Destination already exists; select a new database path.",
      );
    throw new MaintenanceError(
      "Could not create a validated database snapshot; check source, permissions, free space and filesystem hard-link support.",
    );
  } finally {
    connection?.close();
    for (const suffix of ["", "-wal", "-shm", "-journal"])
      await rm(temporary + suffix, { force: true });
  }
}
export const backupDatabase = (source: string, destination: string) =>
  snapshot(source, destination, "backup");
export const restoreDatabase = (source: string, destination: string) =>
  snapshot(source, destination, "restore");
