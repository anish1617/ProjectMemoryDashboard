// Explicit optional authenticated cross-agent check; fixture-only, no global config writes.
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../packages/db/dist/index.js";
import { ProjectService } from "../packages/service/dist/index.js";
const repository = resolve(".project-memory/fixtures/Continuity Fixture");
const database = resolve(".project-memory/host-check.sqlite");
const scratch = resolve(".project-memory/claude-host-probe-" + randomUUID());
await mkdir(scratch);
const store = new Store(database);
const service = new ProjectService(store, [repository]);
try {
  const project = await service.register(repository);
  const initial = store.latestState(project.id)?.state.inProgress[0]?.text;
  if (!initial?.startsWith("Codex host verification"))
    throw new Error(
      "Run verify-codex-host.mjs first to establish the cross-agent checkpoint",
    );
  const marker = "Claude host verification " + randomUUID();
  const mcp = {
    mcpServers: {
      "project-memory": {
        command: process.execPath,
        args: [
          resolve("packages/mcp-server/dist/index.js"),
          "--db",
          database,
          "--allow-root",
          repository,
        ],
      },
    },
  };
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["priorSummary"],
    properties: { priorSummary: { type: "string" } },
  };
  const args = [
    "-p",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--mcp-config",
    JSON.stringify(mcp),
    "--setting-sources",
    "",
    "--settings",
    JSON.stringify({ disableAllHooks: true }),
    "--tools",
    "",
    "--allowedTools",
    "mcp__project-memory__project_list",
    "mcp__project-memory__project_get_resume",
    "mcp__project-memory__project_create_checkpoint",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
  ];
  const stdout = await new Promise((accept, reject) => {
    const child = spawn(process.env.PROJECT_MEMORY_CLAUDE ?? "claude", args, {
      cwd: scratch,
      windowsHide: true,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let result = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Claude host probe timed out"));
    }, 120000);
    child.stdout.on("data", (chunk) => {
      if (result.length < 200000)
        result += chunk.toString().slice(0, 200000 - result.length);
    });
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Claude host probe could not start"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? accept(result)
        : reject(
            new Error(
              "Claude host probe failed; check executable, authentication and host configuration",
            ),
          );
    });
    child.stdin.end(
      `Use only the project-memory MCP tools. List projects, then read the resume for project ID ${project.id}. Preserve the exact existing inProgress summary as priorSummary in your final JSON. Then create an explicit checkpoint for that same ID with title "Claude live host probe", summary ${JSON.stringify(marker)}, evidenceRefs [], and no nextActions. Do not register projects, inspect files or change repositories. This is a disposable cross-agent integration test.`,
    );
  });
  const final = JSON.parse(stdout);
  const structured =
    final.structured_output ??
    (typeof final.result === "string"
      ? JSON.parse(final.result)
      : final.result);
  if (
    structured?.priorSummary !== initial ||
    store.latestState(project.id)?.state.inProgress[0]?.text !== marker
  )
    throw new Error(
      "Claude host check did not prove both Codex-context retrieval and persisted checkpoint",
    );
  console.log(
    JSON.stringify({
      provider: "claude",
      transport: "actual Claude Code MCP stdio host",
      resumedCodexCheckpoint: true,
      checkpointPersisted: true,
      database,
      fixture: repository,
    }),
  );
} finally {
  store.close();
  await rm(scratch, { recursive: true, force: true });
}
