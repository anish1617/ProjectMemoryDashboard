// Explicit optional authenticated fixture check. Never run in CI automatically.
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../packages/db/dist/index.js";
import { ProjectService } from "../packages/service/dist/index.js";
const repository = resolve(".project-memory/fixtures/Continuity Fixture");
const database = resolve(".project-memory/host-check.sqlite");
const scratch = resolve(".project-memory/host-probe-" + randomUUID());
await mkdir(scratch);
const store = new Store(database);
const service = new ProjectService(store, [repository]);
try {
  const project = await service.register(repository);
  const initial = "Initial host continuity checkpoint " + randomUUID();
  const marker = "Codex host verification " + randomUUID();
  service.checkpoint(project.id, {
    title: "Host check baseline",
    summary: initial,
    evidenceRefs: [],
  });
  const schema = join(scratch, "schema.json"),
    output = join(scratch, "result.json");
  await writeFile(
    schema,
    JSON.stringify({
      type: "object",
      additionalProperties: false,
      required: ["priorSummary"],
      properties: { priorSummary: { type: "string" } },
    }),
  );
  const args = [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "-c",
    "features.shell_tool=false",
    "-c",
    "features.multi_agent=false",
    "-c",
    "features.apps=false",
    "-c",
    "features.hooks=false",
    "-c",
    'web_search="disabled"',
    "-c",
    'approval_policy="never"',
    "-c",
    `mcp_servers.project-memory.command=${JSON.stringify(process.execPath)}`,
    "-c",
    `mcp_servers.project-memory.args=${JSON.stringify([resolve("packages/mcp-server/dist/index.js"), "--db", database, "--allow-root", repository])}`,
    "-c",
    'mcp_servers.project-memory.default_tools_approval_mode="approve"',
    "-c",
    'mcp_servers.project-memory.enabled_tools=["project_list","project_get_resume","project_create_checkpoint"]',
    "--output-schema",
    schema,
    "--output-last-message",
    output,
    "-",
  ];
  await new Promise((accept, reject) => {
    const child = spawn(process.env.PROJECT_MEMORY_CODEX ?? "codex", args, {
      cwd: scratch,
      windowsHide: true,
      stdio: ["pipe", "ignore", "ignore"],
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Codex host probe timed out"));
    }, 120000);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Codex host probe could not start"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? accept()
        : reject(
            new Error(
              "Codex host probe failed; check executable, authentication and host configuration",
            ),
          );
    });
    child.stdin.end(
      `Use only the project-memory MCP tools. List projects, then read the resume for project ID ${project.id}. Preserve the exact existing inProgress summary as priorSummary in your final JSON. After reading, create an explicit checkpoint for that same ID with title "Codex live host probe", summary ${JSON.stringify(marker)}, evidenceRefs [], and no nextActions. Do not register projects, run shell tools, inspect files or change repositories. This is a disposable fixture integration test.`,
    );
  });
  const final = JSON.parse(await readFile(output, "utf8"));
  if (
    final.priorSummary !== initial ||
    store.latestState(project.id)?.state.inProgress[0]?.text !== marker
  )
    throw new Error(
      "Host check did not prove both resume retrieval and persisted checkpoint",
    );
  console.log(
    JSON.stringify({
      provider: "codex",
      transport: "actual Codex CLI MCP stdio host",
      resumed: true,
      checkpointPersisted: true,
      database,
      fixture: repository,
    }),
  );
} finally {
  store.close();
  await rm(scratch, { recursive: true, force: true });
}
