import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { join } from "node:path";
import { Store } from "@project-memory/db";
import { ProjectService } from "@project-memory/service";
import { startDashboardDaemon } from "./daemon.js";
const { values } = parseArgs({
  options: {
    db: { type: "string" },
    port: { type: "string" },
    "allow-root": { type: "string", multiple: true },
  },
});
const port = Number(values.port ?? 4317);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("Invalid port");
const store = new Store(
  resolve(
    values.db ??
      process.env.PROJECT_MEMORY_DB ??
      join(homedir(), ".project-memory", "memory.sqlite"),
  ),
);
const service = new ProjectService(
  store,
  (values["allow-root"] ?? [process.cwd()]).map((p) => resolve(p)),
);
const daemon = await startDashboardDaemon(
  service,
  resolve("apps/dashboard/dist"),
  port,
);
console.log(
  `Project Memory dashboard: http://127.0.0.1:${(daemon.server.address() as { port: number }).port}; daemon owns writes and repository polling`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void daemon.stop().then(() => {
      store.close();
      process.exit(0);
    });
  });
