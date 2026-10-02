import { it, expect, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import {
  Store,
  backupDatabase,
  inspectDatabase,
} from "../packages/db/dist/index.js";
import {
  ProjectService,
  ProjectWatcher,
  parseHistory,
} from "../packages/service/dist/index.js";
import { scanRepository } from "../packages/scanner/dist/index.js";
import { createRequire } from "node:module";
import { CodexRunner } from "../packages/runners/dist/index.js";
import { ingestHook } from "../packages/service/dist/index.js";
import {
  prepareHookInstall,
  applyHookInstall,
  prepareHookUninstall,
  applyHookUninstall,
} from "../packages/integrations/dist/index.js";
import { startDashboardDaemon } from "../packages/api/dist/daemon.js";
import { connectService } from "../packages/service/dist/index.js";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  prepareAllInstall,
  applyAllInstall,
  prepareAllUninstall,
  applyAllUninstall,
} from "../packages/integrations/dist/index.js";
const Sqlite = createRequire(
  new URL("../packages/db/package.json", import.meta.url),
)("better-sqlite3");
const exec = promisify(execFile);
const clean: Array<() => unknown> = [];
afterEach(async () => {
  for (const fn of clean.splice(0).reverse()) await fn();
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "project-memory-next-"));
  clean.push(() => rm(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo");
  await mkdir(repo);
  await writeFile(join(repo, "README.md"), "# Fixture\n");
  await exec("git", ["init"], { cwd: repo, windowsHide: true });
  const db = join(dir, "memory.sqlite");
  const store = new Store(db);
  clean.push(() => store.close());
  const service = new ProjectService(store, [dir]);
  const project = await service.register(repo);
  return { dir, repo, db, store, service, id: project.id };
}
const transcript = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    JSON.stringify({
      role: "user",
      content: `Public message ${i} token=do-not-persist`,
    }),
  ).join("\n");
it("resumes durable import jobs from another connection, deduplicates and preserves explicit context", async () => {
  const f = await fixture();
  f.service.checkpoint(f.id, {
    title: "Keep",
    summary: "Current explicit work",
    evidenceRefs: [],
  });
  const source = join(f.dir, "history.jsonl");
  await writeFile(source, transcript(7));
  const job = await f.service.beginImport(f.id, source, "generic");
  expect((await f.service.resumeImport(job.id, 2)).cursor).toBe(2);
  const second = new Store(f.db);
  clean.push(() => second.close());
  const service = new ProjectService(second, [f.dir]);
  expect((await service.beginImport(f.id, source, "generic")).id).toBe(job.id);
  await Promise.all([
    service.resumeImport(job.id, 2),
    f.service.resumeImport(job.id, 2),
  ]);
  const done = await service.resumeImport(job.id, 2);
  expect(done).toMatchObject({
    cursor: 7,
    total: 7,
    imported: 7,
    status: "completed",
  });
  expect((await service.importHistory(f.id, source, "generic")).imported).toBe(
    0,
  );
  expect(second.history(f.id).filter((h) => h.type === "import")).toHaveLength(
    7,
  );
  expect(JSON.stringify(second.view(f.id))).not.toContain("do-not-persist");
  expect(second.latestState(f.id)!.state.inProgress[0]!.text).toBe(
    "Current explicit work",
  );
  expect(second.view(f.id)!.freshness).toBe("stale_activity");
});
it("changed source refuses continuation; batch failure rolls back evidence, activity and cursor together", async () => {
  const f = await fixture();
  const source = join(f.dir, "history.jsonl");
  await writeFile(source, transcript(4));
  const job = await f.service.beginImport(f.id, source, "generic");
  const before = f.store.counts();
  const advance = f.store.advanceImport.bind(f.store);
  f.store.advanceImport = () => {
    throw new Error("Injected persistence interruption");
  };
  await expect(f.service.resumeImport(job.id, 2)).rejects.toThrow(
    "interruption",
  );
  expect(f.store.counts()).toEqual(before);
  expect(f.store.importJob(job.id)!.cursor).toBe(0);
  expect(f.store.history(f.id).filter((h) => h.type === "import")).toHaveLength(
    0,
  );
  f.store.advanceImport = advance;
  await f.service.resumeImport(job.id, 2);
  await writeFile(source, transcript(5));
  await expect(f.service.resumeImport(job.id)).rejects.toThrow("changed");
  const fresh = await f.service.beginImport(f.id, source, "generic");
  expect(fresh.id).not.toBe(job.id);
  await expect(
    new ProjectService(f.store, [f.repo]).resumeImport(fresh.id),
  ).rejects.toThrow("outside");
  await expect(f.service.resumeImport(job.id, 0)).rejects.toThrow("Batch");
});
it("database v2 migrates to v3 preserving prior state and supports backup of pending jobs", async () => {
  const f = await fixture();
  const legacy = join(f.dir, "legacy.sqlite");
  await backupDatabase(f.db, legacy);
  const db = new Sqlite(legacy);
  db.exec(
    "DROP TABLE import_jobs; DROP TABLE leases; DROP TABLE identity_bindings; PRAGMA user_version=2",
  );
  db.close();
  const migrated = new Store(legacy);
  clean.push(() => migrated.close());
  expect(migrated.latestState(f.id)!.state).toEqual(
    f.store.latestState(f.id)!.state,
  );
  expect(inspectDatabase(legacy).schemaVersion).toBe(3);
  const source = join(f.dir, "history.jsonl");
  await writeFile(source, transcript(3));
  const job = await f.service.beginImport(f.id, source, "generic");
  await f.service.resumeImport(job.id, 1);
  const backup = join(f.dir, "job-backup.sqlite");
  await backupDatabase(f.db, backup);
  const recovered = new Store(backup);
  clean.push(() => recovered.close());
  expect(recovered.importJob(job.id)).toMatchObject({
    cursor: 1,
    status: "pending",
  });
  expect(
    (await new ProjectService(recovered, [f.dir]).resumeImport(job.id)).status,
  ).toBe("completed");
});
it("lease ownership is fenced, expires for crashed owners and releases only by owner", async () => {
  const f = await fixture();
  const other = new Store(f.db);
  clean.push(() => other.close());
  expect(f.store.acquireLease("fixture", "first", 10, 100)).toBe(true);
  expect(other.acquireLease("fixture", "second", 10, 105)).toBe(false);
  other.releaseLease("fixture", "second");
  expect(other.acquireLease("fixture", "second", 10, 110)).toBe(true);
  expect(f.store.acquireLease("fixture", "first", 10, 111)).toBe(false);
  other.releaseLease("fixture", "second");
  expect(f.store.acquireLease("fixture", "first", 10, 112)).toBe(true);
});
it("single watcher refreshes current facts, preserves checkpoint, refuses outside roots and stops cleanly", async () => {
  const f = await fixture();
  f.service.checkpoint(f.id, {
    title: "Work",
    summary: "Keep semantic checkpoint",
    evidenceRefs: [],
  });
  const watcher = new ProjectWatcher(f.service);
  clean.push(() => watcher.stop());
  const second = new Store(f.db);
  clean.push(() => second.close());
  const rival = new ProjectWatcher(new ProjectService(second, [f.dir]));
  clean.push(() => rival.stop());
  await writeFile(join(f.repo, "README.md"), "# Changed\n");
  expect((await watcher.tick()).refreshed).toBe(1);
  expect((await rival.tick()).owner).toBe(false);
  expect(f.store.view(f.id)!.freshness).toBe("stale_repository");
  expect(f.store.latestState(f.id)!.state.inProgress[0]!.text).toBe(
    "Keep semantic checkpoint",
  );
  watcher.stop();
  expect((await rival.tick()).owner).toBe(true);
  rival.stop();
  expect((await rival.tick()).owner).toBe(false);
  const outside = new ProjectWatcher(
    new ProjectService(f.store, [join(f.repo, ".git")]),
  );
  expect((await outside.tick()).failed).toBe(1);
  outside.stop();
});
it("separate and link persist explicit root identity without merging or deleting immutable history", async () => {
  const f = await fixture();
  f.service.checkpoint(f.id, {
    title: "Original",
    summary: "Original context",
    evidenceRefs: [],
  });
  const split = await f.service.setIdentity(f.repo);
  expect(split.id).not.toBe(f.id);
  expect(split.state.inProgress).toHaveLength(0);
  expect((await f.service.register(f.repo)).id).toBe(split.id);
  await expect(f.service.refresh(f.id)).rejects.toThrow("identity changed");
  const linked = await f.service.setIdentity(f.repo, f.id);
  expect(linked.id).toBe(f.id);
  expect(linked.state.inProgress[0]!.text).toBe("Original context");
  expect((await f.service.register(f.repo)).id).toBe(f.id);
  expect(f.store.latestState(split.id)).toBeDefined();
  await expect(f.service.setIdentity(f.repo, "missing")).rejects.toThrow(
    "not found",
  );
});
it("actual CLI batches resume across separate processes", async () => {
  const f = await fixture();
  const source = join(f.dir, "history.jsonl");
  await writeFile(source, transcript(3));
  const run = (args: string[]) =>
    exec(
      process.execPath,
      [resolve("packages/cli/dist/index.js"), ...args, "--db", f.db],
      { cwd: f.dir, windowsHide: true, timeout: 10000 },
    );
  const job = JSON.parse(
    (await run(["import-history", source, "--project", f.id, "--batch", "1"]))
      .stdout,
  );
  expect(job.cursor).toBe(1);
  expect(
    JSON.parse((await run(["import-jobs", "--project", f.id])).stdout)[0].id,
  ).toBe(job.id);
  expect(
    JSON.parse(
      (await run(["resume-import", job.id, "--allow-root", f.dir])).stdout,
    ).status,
  ).toBe("completed");
}, 30000);
it("malformed transcript corpus excludes reasoning/tools and preserves parser bounds", () => {
  const corpus = [
    null,
    [],
    4,
    { role: "tool", content: "private" },
    { payload: { role: "assistant", phase: "analysis", content: "private" } },
    {
      role: "user",
      content: [
        null,
        9,
        { type: "tool_result", text: "private" },
        { type: "input_text", text: "safe" },
      ],
    },
  ];
  expect(
    parseHistory(corpus.map(JSON.stringify).join("\n") + "\n{bad", "codex"),
  ).toEqual([{ role: "user", text: "safe" }]);
  expect(
    parseHistory(
      JSON.stringify({ role: "user", content: "x".repeat(10000) }),
      "generic",
    )[0]!.text,
  ).toHaveLength(4000);
});
it("metadata matching is preview-only, exact and refuses ambiguous or unscoped sessions", async () => {
  const f = await fixture();
  const folder = join(f.dir, "exports");
  await mkdir(folder);
  const meta = (cwd: string) =>
    JSON.stringify({ type: "session_meta", payload: { cwd } });
  await writeFile(
    join(folder, "matched.jsonl"),
    meta(f.repo) + "\n" + transcript(2),
  );
  await writeFile(
    join(folder, "ambiguous.jsonl"),
    meta(f.repo) + "\n" + meta(f.dir),
  );
  await writeFile(join(folder, "missing.jsonl"), transcript(2));
  await writeFile(
    join(folder, "claude.jsonl"),
    JSON.stringify({
      cwd: f.repo,
      role: "user",
      content: "Public Claude session",
    }),
  );
  const before = f.store.counts();
  const codex = await f.service.matchHistory(f.id, folder, "codex");
  expect(codex.matched).toEqual([join(folder, "matched.jsonl")]);
  expect(f.store.counts()).toEqual(before);
  expect(
    (await f.service.matchHistory(f.id, folder, "claude")).matched,
  ).toEqual([join(folder, "claude.jsonl")]);
  await expect(
    new ProjectService(f.store, [folder]).matchHistory(f.id, folder, "codex"),
  ).rejects.toThrow("outside");
});
it("runner classifies failure without leaking stderr and applies tool restrictions", async () => {
  const f = await fixture();
  const script = join(f.dir, "analyzer.mjs");
  await writeFile(
    script,
    `const args=process.argv; if (!args.includes('features.shell_tool=false') || !args.includes('features.hooks=false') || !args.includes('web_search="disabled"')) process.exit(3); console.error('Could not find home directory token=never-expose'); process.exit(2);`,
  );
  await expect(
    new CodexRunner(process.execPath, 5000, [script]).analyze({
      bundle: f.service.bundle(f.id),
      validationErrors: [],
    }),
  ).rejects.toMatchObject({
    code: "configuration",
    message: expect.not.stringContaining("never-expose"),
  });
});
it("runner timeout terminates a real child process tree", async (context) => {
  if (process.platform === "win32") {
    const probe = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      windowsHide: true,
      stdio: "ignore",
    });
    try {
      await exec(
        join(
          process.env.SystemRoot ?? "C:\\Windows",
          "System32",
          "taskkill.exe",
        ),
        ["/PID", String(probe.pid), "/T", "/F"],
        { windowsHide: true, timeout: 5000 },
      );
    } catch (error) {
      if (/Access denied/i.test((error as { stderr?: string }).stderr ?? "")) {
        probe.kill("SIGKILL");
        context.skip(
          "Managed Windows runner denies taskkill process enumeration; requires capable host",
        );
      }
      throw error;
    } finally {
      probe.kill("SIGKILL");
    }
  }
  const f = await fixture();
  const script = join(f.dir, "timeout.mjs"),
    pidFile = join(f.dir, "child.pid");
  await writeFile(
    script,
    `import {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs'; const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'}); writeFileSync(${JSON.stringify(pidFile)},String(child.pid)); setInterval(()=>{},1000);`,
  );
  clean.push(async () => {
    try {
      process.kill(Number(await readFile(pidFile, "utf8")), "SIGKILL");
    } catch {
      /* Already terminated or never created. */
    }
  });
  await expect(
    new CodexRunner(process.execPath, 1000, [script]).analyze({
      bundle: f.service.bundle(f.id),
      validationErrors: [],
    }),
  ).rejects.toMatchObject({ code: "timeout" });
  const pid = Number(await readFile(pidFile, "utf8"));
  expect(() => process.kill(pid, 0)).toThrow();
}, 15000);
it("bounded large-repository scan reports omissions and excludes credentials", async () => {
  const f = await fixture();
  await mkdir(join(f.repo, "src"));
  await Promise.all(
    Array.from({ length: 1000 }, (_, i) =>
      writeFile(
        join(f.repo, "src", `file-${i}.ts`),
        "export const value = 1;\n",
      ),
    ),
  );
  await writeFile(join(f.repo, ".env"), "token=private-fixture");
  const start = performance.now();
  const bundle = await scanRepository(f.repo);
  console.info(
    `1000-file bounded scan: ${Math.round(performance.now() - start)} ms`,
  );
  expect(
    bundle.evidence.filter((e) => e.type === "file").length,
  ).toBeLessThanOrEqual(500);
  expect(bundle.diagnostics.join()).toContain("partial");
  expect(JSON.stringify(bundle)).not.toContain("private-fixture");
  expect(await readFile(join(f.repo, ".env"), "utf8")).toBe(
    "token=private-fixture",
  );
}, 30000);
it("three-provider hook installations preview, preserve settings, repeat safely and restore exact original bytes", async () => {
  const f = await fixture();
  const cli = resolve("packages/cli/dist/index.js");
  for (const provider of ["codex", "claude", "cursor"] as const) {
    const config = join(f.dir, `${provider}-hooks.json`);
    const original =
      JSON.stringify({ custom: "keep", hooks: {} }, null, 4) + "\n";
    await writeFile(config, original);
    const plan = await prepareHookInstall(provider, config, f.db, [f.dir], cli);
    expect(await readFile(config, "utf8")).toBe(original);
    expect(plan.preview.capture).toBe("minimal");
    await applyHookInstall(plan);
    expect(
      (await prepareHookInstall(provider, config, f.db, [f.dir], cli)).changed,
    ).toBe(false);
    await expect(
      prepareHookInstall(provider, config, f.db, [f.dir], cli, "standard"),
    ).rejects.toThrow("differs");
    await applyHookUninstall(await prepareHookUninstall(config));
    expect(await readFile(config, "utf8")).toBe(original);
  }
});
it("hook removal preserves later settings and refuses changed owned hooks and changed previews", async () => {
  const f = await fixture();
  const config = join(f.dir, "hooks.json"),
    cli = resolve("packages/cli/dist/index.js");
  await writeFile(config, "{}");
  const plan = await prepareHookInstall("claude", config, f.db, [f.dir], cli);
  await writeFile(config, '{"later":true}');
  await expect(applyHookInstall(plan)).rejects.toThrow("changed");
  await applyHookInstall(
    await prepareHookInstall("claude", config, f.db, [f.dir], cli),
  );
  const installed = JSON.parse(await readFile(config, "utf8"));
  installed.extra = "keep";
  await writeFile(config, JSON.stringify(installed));
  const removal = await prepareHookUninstall(config);
  await applyHookUninstall(removal);
  expect(JSON.parse(await readFile(config, "utf8"))).toMatchObject({
    later: true,
    extra: "keep",
  });
  // The receipt still protects edits to an installed command.
  await writeFile(config, plan.updated);
  const changed = JSON.parse(plan.updated);
  changed.hooks.SessionStart[0].hooks[0].command = "user-edited-command";
  await writeFile(config, JSON.stringify(changed));
  await expect(prepareHookUninstall(config)).rejects.toThrow("changed");
});
it("Cursor adapter excludes thoughts, ambiguous roots, tool output and identities; standard capture redacts public text", async () => {
  const f = await fixture();
  const base = {
    conversation_id: "cursor-fixture",
    generation_id: "generation1",
    workspace_roots: [f.repo],
    cursor_version: "fixture-1",
    user_email: "do-not-retain@example.invalid",
    transcript_path: "do-not-read.jsonl",
  };
  expect(
    (
      await ingestHook(f.service, "cursor", {
        ...base,
        hook_event_name: "afterAgentThought",
        text: "hidden-thought",
      })
    ).status,
  ).toBe("ignored");
  expect(
    (
      await ingestHook(f.service, "cursor", {
        ...base,
        workspace_roots: [f.repo, f.dir],
        hook_event_name: "sessionStart",
      })
    ).status,
  ).toBe("ignored");
  await ingestHook(f.service, "cursor", {
    ...base,
    hook_event_name: "postToolUse",
    tool_name: "Shell",
    tool_output: "private-tool-output",
  });
  await ingestHook(
    f.service,
    "cursor",
    {
      ...base,
      hook_event_name: "afterAgentResponse",
      text: "Public response token=secret-fixture",
    },
    "standard",
  );
  const history = JSON.stringify(f.store.history(f.id));
  expect(history).toContain("Public response");
  for (const forbidden of [
    "hidden-thought",
    "private-tool-output",
    "secret-fixture",
    "do-not-retain",
    "do-not-read",
  ])
    expect(history).not.toContain(forbidden);
});
it("generated hook command executes against actual stdin and returns a neutral host response", async () => {
  const f = await fixture();
  const plan = await prepareHookInstall(
    "cursor",
    join(f.dir, "hooks.json"),
    f.db,
    [f.dir],
    resolve("packages/cli/dist/index.js"),
  );
  const shell =
    process.platform === "win32"
      ? (process.env.ComSpec ?? "cmd.exe")
      : "/bin/sh";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", plan.preview.command]
      : ["-c", plan.preview.command];
  const output = await new Promise<string>((accept, reject) => {
    const child = spawn(shell, args, { cwd: f.dir, windowsHide: true });
    let text = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Hook fixture timed out"));
    }, 10000);
    child.stdout.on("data", (data) => {
      text += data;
    });
    child.stderr.resume();
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? accept(text) : reject(new Error("Hook command failed"));
    });
    child.stdin.end(
      JSON.stringify({
        hook_event_name: "sessionStart",
        conversation_id: "command-fixture",
        workspace_roots: [f.repo],
      }),
    );
  });
  expect(JSON.parse(output)).toEqual({});
  expect(f.store.history(f.id).some((h) => h.type === "session.started")).toBe(
    true,
  );
}, 15000);
it("dashboard daemon owns listener/poller lifecycle, refuses a second owner and releases on stop", async () => {
  const f = await fixture();
  const assets = resolve("apps/dashboard/dist");
  const first = await startDashboardDaemon(f.service, assets, 0);
  clean.push(() => first.stop());
  const port = (first.server.address() as { port: number }).port;
  expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(200);
  await expect(startDashboardDaemon(f.service, assets, 0)).rejects.toThrow(
    "owns this database",
  );
  await first.stop();
  const next = await startDashboardDaemon(f.service, assets, 0);
  clean.push(() => next.stop());
  expect(next.server.listening).toBe(true);
});
it("bundle preflights every provider, installs idempotently and restores all original files", async () => {
  const f = await fixture();
  const manifest = join(f.dir, "integrations.json");
  const entries: Record<string, { mcp: string; hooks: string }> = {};
  for (const provider of ["codex", "claude", "cursor"]) {
    entries[provider] = {
      mcp: `${provider}-mcp.${provider === "codex" ? "toml" : "json"}`,
      hooks: `${provider}-hooks.json`,
    };
    await writeFile(
      join(f.dir, entries[provider]!.mcp),
      provider === "codex" ? 'custom="keep"\n' : '{"custom":"keep"}',
    );
    await writeFile(join(f.dir, entries[provider]!.hooks), '{"custom":"keep"}');
  }
  await writeFile(manifest, JSON.stringify(entries));
  const server = resolve("packages/mcp-server/dist/index.js"),
    cli = resolve("packages/cli/dist/index.js");
  const plan = await prepareAllInstall(manifest, f.db, [f.dir], server, cli);
  expect(plan.preview).toHaveLength(6);
  expect(await applyAllInstall(plan)).toMatchObject({
    status: "installed",
    changed: 6,
  });
  expect(
    await applyAllInstall(
      await prepareAllInstall(manifest, f.db, [f.dir], server, cli),
    ),
  ).toMatchObject({ changed: 0 });
  await applyAllUninstall(await prepareAllUninstall(manifest));
  expect(await readFile(join(f.dir, "codex-mcp.toml"), "utf8")).toBe(
    'custom="keep"\n',
  );
  await applyAllUninstall(await prepareAllUninstall(manifest));
  const second = await prepareAllInstall(manifest, f.db, [f.dir], server, cli);
  await writeFile(join(f.dir, "claude-mcp.json"), '{"later":true}');
  await expect(applyAllInstall(second)).rejects.toThrow("rolled back");
  expect(await readFile(join(f.dir, "codex-mcp.toml"), "utf8")).toBe(
    'custom="keep"\n',
  );
  expect(await readFile(join(f.dir, "codex-hooks.json"), "utf8")).toBe(
    '{"custom":"keep"}',
  );
  expect(await readFile(join(f.dir, "claude-mcp.json"), "utf8")).toBe(
    '{"later":true}',
  );
});
it("simultaneous CLI connections initialize a new schema transactionally", async () => {
  const f = await fixture();
  const path = join(f.dir, "concurrent.sqlite");
  const module = pathToFileURL(resolve("packages/db/dist/index.js")).href;
  const script = `import {Store} from ${JSON.stringify(module)}; const store=new Store(process.argv[1]); console.log(JSON.stringify(store.counts())); store.close();`;
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      exec(process.execPath, ["--input-type=module", "-e", script, path], {
        windowsHide: true,
        timeout: 10000,
      }),
    ),
  );
  for (const result of results)
    expect(JSON.parse(result.stdout).projects).toBe(0);
  expect(inspectDatabase(path).schemaVersion).toBe(3);
}, 15000);
it("active daemon fences direct writers and proxies CLI/service checkpoints, imports and hooks", async () => {
  const f = await fixture();
  const daemon = await startDashboardDaemon(
    f.service,
    resolve("apps/dashboard/dist"),
    0,
  );
  clean.push(() => daemon.stop());
  const client = new Store(f.db);
  clean.push(() => client.close());
  expect(() =>
    new ProjectService(client, [f.dir]).checkpoint(f.id, {
      title: "Denied",
      summary: "Direct write must fail",
      evidenceRefs: [],
    }),
  ).toThrow("active daemon");
  const port = connectService(new ProjectService(client, [f.dir]));
  expect((await port.register(f.repo)).id).toBe(f.id);
  await port.checkpoint(f.id, {
    title: "Proxied",
    summary: "Daemon-owned checkpoint",
    evidenceRefs: [],
  });
  expect(f.store.latestState(f.id)!.state.inProgress[0]!.text).toBe(
    "Daemon-owned checkpoint",
  );
  const source = join(f.dir, "proxy-history.jsonl");
  await writeFile(source, transcript(3));
  const job = await port.beginImport(f.id, source, "generic");
  expect((await port.resumeImport(job.id)).status).toBe("completed");
  await port.recordHook(
    "claude",
    {
      hook_event_name: "SessionStart",
      session_id: "proxy-session",
      cwd: f.repo,
    },
    "minimal",
  );
  expect(f.store.history(f.id).some((h) => h.type === "session.started")).toBe(
    true,
  );
  const cli = resolve("packages/cli/dist/index.js");
  const run = await exec(
    process.execPath,
    [
      cli,
      "checkpoint",
      f.repo,
      "--db",
      f.db,
      "--summary",
      "CLI via active daemon",
    ],
    { windowsHide: true, timeout: 10000 },
  );
  expect(JSON.parse(run.stdout).status).toBe("recorded");
  expect(f.store.latestState(f.id)!.state.inProgress[0]!.text).toBe(
    "CLI via active daemon",
  );
  const mcp = new Client({ name: "daemon-proxy-fixture", version: "0.1.0" });
  await mcp.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [
        resolve("packages/mcp-server/dist/index.js"),
        "--db",
        f.db,
        "--allow-root",
        f.dir,
      ],
      stderr: "pipe",
    }),
  );
  clean.push(() => mcp.close());
  const saved = await mcp.callTool({
    name: "project_create_checkpoint",
    arguments: {
      projectId: f.id,
      title: "MCP proxy",
      summary: "MCP via active daemon",
      evidenceRefs: [],
    },
  });
  expect(saved.isError).not.toBe(true);
  expect(f.store.latestState(f.id)!.state.inProgress[0]!.text).toBe(
    "MCP via active daemon",
  );
  await mcp.close();
  await expect(port.register(f.dir)).rejects.toThrow("Daemon operation failed");
  await daemon.stop();
  expect(
    (
      await port.checkpoint(f.id, {
        title: "Offline",
        summary: "Offline fallback",
        evidenceRefs: [],
      })
    ).state.inProgress[0]!.text,
  ).toBe("Offline fallback");
}, 20000);
it("proxy refuses a forged daemon identity before sending project data", async () => {
  const f = await fixture();
  f.store.acquireLease("dashboard-daemon", "fake-owner", 30000);
  f.store.acquireLease(
    "dashboard-endpoint:https://evil.invalid",
    "fake-owner",
    30000,
  );
  const port = connectService(f.service);
  await expect(
    port.checkpoint(f.id, {
      title: "Never sent",
      summary: "Private project context",
      evidenceRefs: [],
    }),
  ).rejects.toThrow("Invalid daemon endpoint");
  f.store.releaseLease("dashboard-daemon", "fake-owner");
  f.store.releaseLease("dashboard-endpoint:https://evil.invalid", "fake-owner");
});
