import { it, expect, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Store } from "../packages/db/dist/index.js";
import {
  ProjectService,
  parseHistory,
  ingestHook,
} from "../packages/service/dist/index.js";
import {
  prepareInstall,
  applyInstall,
  prepareUninstall,
  applyUninstall,
} from "../packages/integrations/dist/index.js";
import { readFile } from "node:fs/promises";
import { createDashboardServer } from "../packages/api/dist/server.js";
import { Client } from "@modelcontextprotocol/client";
import { redact } from "../packages/core/dist/index.js";
import { capsule, mockProjects } from "../apps/dashboard/src/data.js";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
const exec = promisify(execFile);
it("copied resume retains claim provenance and evidence references", () => {
  const p = mockProjects[0]!;
  const text = capsule(p);
  expect(text).toContain(`[${p.state.architecture[0]!.provenance}]`);
  expect(text).toContain(p.state.architecture[0]!.evidenceRefs[0]);
  expect(text).toContain("Analyzer: sample");
});
const cleanup: Array<() => Promise<unknown> | void> = [];
afterEach(async () => {
  for (const task of cleanup.splice(0).reverse()) await task();
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "project-memory-tools-"));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo");
  await mkdir(repo);
  await writeFile(join(repo, "README.md"), "# Fixture project\n");
  for (const args of [
    ["init"],
    ["config", "user.name", "Fixture"],
    ["config", "user.email", "fixture@example.invalid"],
    ["add", "."],
    ["commit", "-m", "Initial fixture"],
  ])
    await exec("git", args, { cwd: repo, windowsHide: true });
  const db = join(dir, "memory.sqlite");
  const store = new Store(db);
  cleanup.push(() => store.close());
  const service = new ProjectService(store, [dir]);
  return { dir, repo, db, store, service };
}
it("scopes registration to canonical allowed folders and discovers existing repositories", async () => {
  const f = await fixture();
  await expect(f.service.register(tmpdir())).rejects.toThrow("outside");
  expect(await f.service.discover(f.dir)).toEqual([f.repo]);
  const p = await f.service.register(f.repo);
  expect(p.evidence.length).toBeGreaterThan(0);
  expect(p.freshness).toBe("needs_analysis");
});
it("redacts credentials inside JSON without corrupting structured evidence", () => {
  const raw = JSON.stringify({
    api_key: "private-value",
    branch: "token=private-branch",
    authorization: "Bearer private-bearer",
  });
  const safe = redact(raw);
  expect(safe).not.toContain("private-value");
  expect(safe).not.toContain("private-branch");
  expect(safe).not.toContain("private-bearer");
  expect(() => JSON.parse(safe)).not.toThrow();
});
it("refuses evidence rewritten under a persisted identifier", async () => {
  const f = await fixture();
  const p = await f.service.register(f.repo);
  const bundle = structuredClone(f.service.bundle(p.id));
  bundle.evidence[0]!.content += " forged content";
  const before = f.store.counts();
  expect(() => f.store.saveState(p.id, p.state, "fixture", bundle)).toThrow(
    "immutable persisted content",
  );
  expect(f.store.counts()).toEqual(before);
});
it("installer rejects malformed configuration containers", async () => {
  const f = await fixture();
  const path = join(f.dir, "config.json");
  for (const text of ["[]", "null", '{"mcpServers":[]}']) {
    await writeFile(path, text);
    await expect(
      prepareInstall("claude", path, f.db, [f.dir], "server.js"),
    ).rejects.toThrow("object");
    expect(await readFile(path, "utf8")).toBe(text);
  }
});
it("refresh preserves checkpoints and permits a checkpoint after repository changes", async () => {
  const f = await fixture();
  const p = await f.service.register(f.repo);
  f.service.checkpoint(p.id, {
    title: "Prior",
    summary: "Known explicit context",
    evidenceRefs: [],
  });
  await writeFile(join(f.repo, "README.md"), "# Changed fixture\n");
  await f.service.refresh(p.id);
  expect(
    f.store.view(p.id)!.evidence.some((e) => e.type === "checkpoint"),
  ).toBe(true);
  expect(f.store.view(p.id)!.freshness).toBe("stale_repository");
  expect(() =>
    f.service.checkpoint(p.id, {
      title: "New",
      summary: "Current explicit context",
      evidenceRefs: [],
    }),
  ).not.toThrow();
});
it("records checkpoint and decision provenance, deduplicates activity, and searches literal FTS text", async () => {
  const f = await fixture();
  const p = await f.service.register(f.repo);
  const input = {
    title: "Editor checkpoint",
    summary: "Editor capture tested with fixtures",
    nextActions: ["Add keyboard checks"],
    evidenceRefs: [],
  };
  f.service.checkpoint(p.id, input);
  f.service.checkpoint(p.id, input);
  expect(
    f.store.history(p.id).filter((h) => h.type === "checkpoint"),
  ).toHaveLength(1);
  expect(f.store.view(p.id)!.state.inProgress[0]!.provenance).toBe("explicit");
  f.service.decision(p.id, {
    title: "Local storage",
    decision: "Keep storage local",
    rationale: "Portable continuity",
    alternatives: ["Hosted service"],
    consequences: ["Single-device scope"],
    evidenceRefs: [],
  });
  expect(f.store.view(p.id)!.state.decisions[0]!.provenance).toBe("explicit");
  expect(f.store.search(p.id, "capture")).toHaveLength(1);
  expect(f.store.search(p.id, '" OR *')).toEqual([]);
});
it("rejects unknown checkpoint evidence before mutation and stale state revisions", async () => {
  const f = await fixture();
  const p = await f.service.register(f.repo);
  const before = f.store.counts();
  expect(() =>
    f.service.checkpoint(p.id, {
      title: "Fake",
      summary: "Anything",
      evidenceRefs: ["other-project"],
    }),
  ).toThrow("cross-project");
  expect(f.store.counts()).toEqual(before);
  expect(() => f.service.saveState(p.id, p.state, 9999)).toThrow(
    "revision changed",
  );
});
it("redacts imported history, deduplicates repeated imports and excludes reasoning/tool records", async () => {
  const f = await fixture();
  const p = await f.service.register(f.repo);
  const path = join(f.dir, "history.jsonl");
  await writeFile(
    path,
    [
      JSON.stringify({ role: "user", content: "token: never-store-this" }),
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "hidden-do-not-store" },
          { type: "text", text: "Public result" },
        ],
      }),
      JSON.stringify({ type: "reasoning", content: "hidden" }),
      "{bad",
    ].join("\n"),
  );
  expect((await f.service.importHistory(p.id, path, "generic")).imported).toBe(
    2,
  );
  expect((await f.service.importHistory(p.id, path, "generic")).imported).toBe(
    0,
  );
  const history = JSON.stringify(f.store.history(p.id));
  expect(history).not.toContain("never-store-this");
  expect(history).not.toContain("hidden-do-not-store");
  expect(history).toContain("Public result");
});
it("Codex parsing only permits final assistant responses and user messages", () => {
  const text = [
    { payload: { role: "assistant", phase: "analysis", content: "private" } },
    {
      payload: {
        role: "assistant",
        phase: "final_answer",
        content: [{ type: "output_text", text: "Finished" }],
      },
    },
    {
      payload: {
        role: "user",
        content: [{ type: "input_text", text: "Build it" }],
      },
    },
  ]
    .map(JSON.stringify)
    .join("\n");
  expect(parseHistory(text, "codex")).toEqual([
    { role: "assistant", text: "Finished" },
    { role: "user", text: "Build it" },
  ]);
});
it("hook adapters redact public text, honor minimal capture, and deduplicate event IDs", async () => {
  const f = await fixture();
  const payload = {
    hook_event_name: "UserPromptSubmit",
    session_id: "session-fixture",
    cwd: f.repo,
    event_id: "event-1",
    prompt: "password: do-not-store",
    reasoning: "hidden-reasoning",
  };
  const result = await ingestHook(f.service, "codex", payload);
  expect(result.status).toBe("recorded");
  expect((await ingestHook(f.service, "codex", payload)).status).toBe(
    "duplicate",
  );
  const p = f.store.listProjects()[0]!;
  expect(JSON.stringify(p.history)).not.toContain("do-not-store");
  expect(JSON.stringify(p.history)).not.toContain("hidden-reasoning");
  await ingestHook(
    f.service,
    "claude",
    { ...payload, event_id: "event-2", prompt: "omit-in-minimal" },
    "minimal",
  );
  expect(JSON.stringify(f.store.history(p.id))).not.toContain(
    "omit-in-minimal",
  );
});
it("installer previews, backs up, preserves other settings, and restores exact original bytes", async () => {
  const f = await fixture();
  for (const provider of ["codex", "claude", "cursor"] as const) {
    const path = join(
      f.dir,
      provider + (provider === "codex" ? ".toml" : ".json"),
    );
    const original =
      provider === "codex"
        ? '# Original comment\nmodel = "existing-model"\n'
        : JSON.stringify(
            {
              existing: { keep: true },
              mcpServers: { other: { command: "keep-me" } },
            },
            null,
            2,
          ) + "\n";
    await writeFile(path, original);
    const plan = await prepareInstall(
      provider,
      path,
      f.db,
      [f.dir],
      join(process.cwd(), "packages/mcp-server/dist/index.js"),
    );
    expect(await readFile(path, "utf8")).toBe(original);
    await applyInstall(plan);
    expect(await readFile(path, "utf8")).toContain("project-memory");
    expect(
      (
        await prepareInstall(
          provider,
          path,
          f.db,
          [f.dir],
          join(process.cwd(), "packages/mcp-server/dist/index.js"),
        )
      ).changed,
    ).toBe(false);
    await applyUninstall(await prepareUninstall(path));
    expect(await readFile(path, "utf8")).toBe(original);
  }
});
it("installer refuses a plan if user configuration changed after preview", async () => {
  const f = await fixture();
  const path = join(f.dir, "config.json");
  await writeFile(path, "{}");
  const plan = await prepareInstall("claude", path, f.db, [f.dir], "server.js");
  await writeFile(path, '{"changed":true}');
  await expect(applyInstall(plan)).rejects.toThrow("changed after preview");
});
it("loopback API protects session, origin and path scope and persists a real checkpoint", async () => {
  const f = await fixture();
  const server = createDashboardServer(
    f.service,
    join(process.cwd(), "apps/dashboard/dist"),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  cleanup.push(() => new Promise<void>((r) => server.close(() => r())));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  expect((await fetch(url + "/api/projects")).status).toBe(401);
  expect((await fetch(url + "/api/session")).status).toBe(403);
  expect(
    (
      await fetch(url + "/api/session", {
        headers: {
          "X-Project-Memory": "dashboard",
          Origin: "https://other.invalid",
        },
      })
    ).status,
  ).toBe(403);
  const token = (
    (await (
      await fetch(url + "/api/session", {
        headers: { "X-Project-Memory": "dashboard" },
      })
    ).json()) as { token: string }
  ).token;
  const headers = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };
  expect(
    (
      await fetch(url + "/api/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({ path: tmpdir() }),
      })
    ).status,
  ).toBe(400);
  const response = await fetch(url + "/api/projects", {
    method: "POST",
    headers,
    body: JSON.stringify({ path: f.repo }),
  });
  expect(response.status).toBe(201);
  const p = (await response.json()) as { id: string };
  const saved = await fetch(url + `/api/projects/${p.id}/checkpoints`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Browser checkpoint",
      summary: "Local API fixture verified",
      evidenceRefs: [],
    }),
  });
  expect(saved.status).toBe(201);
  expect(f.store.view(p.id)!.state.inProgress[0]!.text).toContain(
    "fixture verified",
  );
  expect(
    (await fetch(url + "/")).headers.get("content-security-policy"),
  ).toContain("frame-ancestors 'none'");
});
it("real MCP stdio client discovers all tools, registers a repository, and retrieves persisted context", async () => {
  const f = await fixture();
  const client = new Client({
    name: "project-memory-fixture-client",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      join(process.cwd(), "packages/mcp-server/dist/index.js"),
      "--db",
      f.db,
      "--allow-root",
      f.dir,
    ],
    stderr: "pipe",
  });
  cleanup.push(() => client.close());
  await client.connect(transport);
  const { tools } = await client.listTools();
  expect(tools).toHaveLength(14);
  const registered = await client.callTool({
    name: "project_register",
    arguments: { cwd: f.repo },
  });
  expect(registered.isError).not.toBe(true);
  const p = JSON.parse((registered.content[0] as { text: string }).text) as {
    id: string;
  };
  const saved = await client.callTool({
    name: "project_create_checkpoint",
    arguments: {
      projectId: p.id,
      title: "Cross-agent checkpoint",
      summary: "MCP fixture continuation",
      evidenceRefs: [],
    },
  });
  expect(saved.isError).not.toBe(true);
  const resumed = await client.callTool({
    name: "project_get_resume",
    arguments: { projectId: p.id, maxTokens: 1200, includeEvidence: true },
  });
  expect(JSON.stringify(resumed.content)).toContain("MCP fixture continuation");
  expect(f.store.view(p.id)!.state.inProgress[0]!.provenance).toBe("explicit");
  const source = join(f.dir, "mcp-history.jsonl");
  await writeFile(
    source,
    JSON.stringify({ role: "user", content: "MCP imported public context" }),
  );
  const begun = await client.callTool({
    name: "project_begin_import",
    arguments: { projectId: p.id, path: source, provider: "generic" },
  });
  const jobId = JSON.parse((begun.content[0] as { text: string }).text).id;
  const imported = await client.callTool({
    name: "project_resume_import",
    arguments: { jobId },
  });
  expect(
    JSON.parse((imported.content[0] as { text: string }).text).status,
  ).toBe("completed");
  const invalid = await client.callTool({
    name: "project_save_state",
    arguments: {
      projectId: p.id,
      schemaVersion: 1,
      expectedSnapshotId: 999,
      state: f.store.view(p.id)!.state,
    },
  });
  expect(invalid.isError).toBe(true);
}, 20000);
