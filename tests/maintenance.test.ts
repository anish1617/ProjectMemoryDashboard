import { it, expect, afterEach } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  Store,
  backupDatabase,
  restoreDatabase,
  inspectDatabase,
} from "../packages/db/dist/index.js";
import { ProjectService } from "../packages/service/dist/index.js";
const Sqlite = createRequire(
  new URL("../packages/db/package.json", import.meta.url),
)("better-sqlite3");
const exec = promisify(execFile);
const cleanup: Array<() => Promise<unknown> | void> = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "project-memory-recovery-"));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo résumé");
  await mkdir(repo);
  await writeFile(join(repo, "README.md"), "# Recovery fixture\n");
  await exec("git", ["init"], { cwd: repo, windowsHide: true });
  const source = join(dir, "source.sqlite");
  const store = new Store(source);
  cleanup.push(() => store.close());
  const service = new ProjectService(store, [dir]);
  const project = await service.register(repo);
  service.checkpoint(project.id, {
    title: "Before backup",
    summary: "Known context before backup",
    evidenceRefs: [],
    nextActions: ["Restore into a new file"],
  });
  return { dir, repo, source, store, service, id: project.id };
}
it("online backup includes committed WAL state and restored history, evidence and search survive", async () => {
  const f = await fixture();
  expect((await stat(f.source + "-wal")).size).toBeGreaterThan(0);
  const backup = join(f.dir, "backups", "snapshot.sqlite");
  const before = f.store.counts();
  const state = f.store.latestState(f.id)!.state;
  expect(await backupDatabase(f.source, backup)).toMatchObject({
    operation: "backup",
    integrity: "ok",
    projects: 1,
    snapshots: before.snapshots,
  });
  f.service.checkpoint(f.id, {
    title: "After backup",
    summary: "Later work not in earlier snapshot",
    evidenceRefs: [],
  });
  const restored = join(f.dir, "restored.sqlite");
  await restoreDatabase(backup, restored);
  const recovered = new Store(restored);
  cleanup.push(() => recovered.close());
  expect(recovered.counts()).toEqual(before);
  expect(recovered.latestState(f.id)!.state).toEqual(state);
  expect(
    recovered.view(f.id)!.evidence.some((e) => e.type === "checkpoint"),
  ).toBe(true);
  expect(recovered.search(f.id, "Known context")).toHaveLength(1);
  expect(
    recovered.history(f.id).some((h) => h.summary.includes("Later work")),
  ).toBe(false);
  expect(await readdir(join(f.dir, "backups"))).toEqual(["snapshot.sqlite"]);
});
it("backup and restore refuse existing files, same paths and orphaned sidecars without modifying them", async () => {
  const f = await fixture();
  const backup = join(f.dir, "backup.sqlite");
  await backupDatabase(f.source, backup);
  const bytes = await readFile(backup);
  await expect(backupDatabase(f.source, backup)).rejects.toThrow("exists");
  expect(await readFile(backup)).toEqual(bytes);
  await expect(restoreDatabase(backup, f.source)).rejects.toThrow("exists");
  expect(f.store.view(f.id)!.state.inProgress[0]!.text).toContain(
    "Known context",
  );
  await expect(backupDatabase(f.source, f.source)).rejects.toThrow("different");
  const target = join(f.dir, "sidecar.sqlite");
  await writeFile(target + "-wal", "orphan");
  await expect(restoreDatabase(backup, target)).rejects.toThrow("sidecars");
  expect(await readFile(target + "-wal", "utf8")).toBe("orphan");
});
it("rejects invalid, unrelated and future-schema databases before publishing a destination", async () => {
  const f = await fixture();
  const corrupt = join(f.dir, "corrupt.sqlite");
  await writeFile(corrupt, "not a database");
  const unrelated = join(f.dir, "unrelated.sqlite");
  const unrelatedDb = new Sqlite(unrelated);
  unrelatedDb.exec("CREATE TABLE arbitrary (id TEXT); PRAGMA user_version=2");
  unrelatedDb.close();
  const future = join(f.dir, "future.sqlite");
  await backupDatabase(f.source, future);
  const nextDb = new Sqlite(future);
  nextDb.pragma("user_version=99");
  nextDb.close();
  const before = await readFile(future);
  for (const input of [corrupt, unrelated, future])
    await expect(
      restoreDatabase(input, join(f.dir, "never.sqlite")),
    ).rejects.toThrow();
  expect(await readFile(future)).toEqual(before);
  expect(
    (await readdir(f.dir)).some(
      (name) => name.includes("partial") || name === "never.sqlite",
    ),
  ).toBe(false);
  expect(() => inspectDatabase(future)).toThrow("newer");
});
it("rejects foreign-key corruption and removes partial artifacts", async () => {
  const f = await fixture();
  const broken = join(f.dir, "broken.sqlite");
  await backupDatabase(f.source, broken);
  const corrupt = new Sqlite(broken);
  corrupt.exec(
    "PRAGMA foreign_keys=OFF; INSERT INTO repository_roots VALUES ('missing-repository','missing-project')",
  );
  corrupt.close();
  await expect(
    restoreDatabase(broken, join(f.dir, "never.sqlite")),
  ).rejects.toThrow("integrity");
  expect(
    (await readdir(f.dir)).some(
      (name) => name.includes("partial") || name === "never.sqlite",
    ),
  ).toBe(false);
});
it("restored schema v1 migrates to v3 without losing evidence or state and does not migrate again", async () => {
  const f = await fixture();
  const legacy = join(f.dir, "legacy.sqlite");
  await backupDatabase(f.source, legacy);
  const old = new Sqlite(legacy);
  old.exec(
    "DROP TABLE import_jobs; DROP TABLE leases; DROP TABLE identity_bindings; DROP TABLE activity; DROP TABLE activity_search; PRAGMA user_version=1",
  );
  old.close();
  expect(inspectDatabase(legacy).schemaVersion).toBe(1);
  const restored = join(f.dir, "upgrade.sqlite");
  await restoreDatabase(legacy, restored);
  const first = new Store(restored);
  expect(first.latestState(f.id)!.state).toEqual(
    f.store.latestState(f.id)!.state,
  );
  const counts = first.counts();
  first.close();
  expect(inspectDatabase(restored).schemaVersion).toBe(3);
  const second = new Store(restored);
  expect(second.counts()).toEqual(counts);
  second.close();
});
it("separate CLI processes back up and restore safely and show actionable overwrite refusal", async () => {
  const f = await fixture();
  const cli = resolve("packages/cli/dist/index.js");
  const backup = join(f.dir, "cli backup.sqlite"),
    restored = join(f.dir, "cli restored.sqlite");
  const run = (args: string[]) =>
    exec(process.execPath, [cli, ...args], {
      cwd: f.repo,
      windowsHide: true,
      timeout: 10000,
    });
  await expect(run(["restore", backup])).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining("explicit new destination"),
  });
  expect(
    JSON.parse((await run(["backup", backup, "--db", f.source])).stdout)
      .integrity,
  ).toBe("ok");
  expect(
    JSON.parse((await run(["restore", backup, "--db", restored])).stdout)
      .snapshots,
  ).toBe(f.store.counts().snapshots);
  expect(
    JSON.parse((await run(["db-check", "--db", restored])).stdout).projects,
  ).toBe(1);
  await expect(
    run(["restore", backup, "--db", restored]),
  ).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining("Destination already exists"),
  });
  expect((await run(["resume", f.repo, "--db", restored])).stdout).toContain(
    "Known context before backup",
  );
}, 30000);
