// Optional real-provider minimal hook probe, limited to the disposable fixture.
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../packages/db/dist/index.js";
import { ProjectService } from "../packages/service/dist/index.js";
import { prepareHookInstall } from "../packages/integrations/dist/index.js";
const repository = resolve(".project-memory/fixtures/Continuity Fixture");
const database = resolve(".project-memory/hook-check.sqlite");
const scratch = resolve(".project-memory/claude-hook-probe-" + randomUUID());
await mkdir(scratch);
const store = new Store(database);
const service = new ProjectService(store, [repository]);
try {
  const project = await service.register(repository);
  const prior = new Set(store.history(project.id).map((item) => item.id));
  const settings = join(scratch, "settings.json");
  const plan = await prepareHookInstall(
    "claude",
    settings,
    database,
    [repository],
    resolve("packages/cli/dist/index.js"),
    "minimal",
  );
  await writeFile(settings, plan.updated);
  await new Promise((accept, reject) => {
    const child = spawn(
      process.env.PROJECT_MEMORY_CLAUDE ?? "claude",
      [
        "-p",
        "Reply with exactly OK. Do not use tools or inspect files.",
        "--no-session-persistence",
        "--setting-sources",
        "",
        "--settings",
        settings,
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--tools",
        "",
      ],
      {
        cwd: repository,
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore"],
      },
    );
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Claude hook probe timed out"));
    }, 120000);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Claude hook probe could not start"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      code === 0 ? accept() : reject(new Error("Claude hook probe failed"));
    });
  });
  const events = store
    .history(project.id)
    .filter(
      (item) =>
        !prior.has(item.id) && item.source.startsWith("claude hook adapter"),
    );
  if (
    !events.some((item) => item.type === "session.started") ||
    !events.some((item) => item.type === "session.stopped")
  )
    throw new Error(
      "Claude did not emit both start and stop lifecycle records",
    );
  console.log(
    JSON.stringify({
      provider: "claude",
      realHookEvents: [...new Set(events.map((item) => item.type))],
      capture: "minimal",
      database,
      userSettingsChanged: false,
    }),
  );
} finally {
  store.close();
  await rm(scratch, { recursive: true, force: true });
}
