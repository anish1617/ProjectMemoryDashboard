import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { parseArgs } from "node:util";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { Store } from "@project-memory/db";
import { ProjectService, connectService } from "@project-memory/service";
import { createMcpServer } from "./server.js";
const { values } = parseArgs({
  options: {
    db: { type: "string" },
    "allow-root": { type: "string", multiple: true },
  },
});
const store = new Store(
  resolve(
    values.db ??
      process.env.PROJECT_MEMORY_DB ??
      join(homedir(), ".project-memory", "memory.sqlite"),
  ),
);
const service = connectService(
  new ProjectService(
    store,
    (values["allow-root"] ?? [process.cwd()]).map((p) => resolve(p)),
  ),
);
await serveStdio(() => createMcpServer(service));
