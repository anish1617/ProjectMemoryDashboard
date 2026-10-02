import { randomUUID } from "node:crypto";
import { ProjectWatcher, type ProjectService } from "@project-memory/service";
import { createDashboardServer } from "./server.js";

// Own the dashboard listener, polling lifecycle and product writes. CLI/MCP
// discover the owner-bound endpoint; direct mutation transactions are fenced.
export async function startDashboardDaemon(
  service: ProjectService,
  assets: string,
  port: number,
) {
  const owner = randomUUID(),
    key = "dashboard-daemon";
  if (!service.store.acquireLease(key, owner, 30000))
    throw new Error(
      "Another dashboard daemon owns this database; stop it or wait for its lease to expire",
    );
  service.store.setWriteOwner(owner);
  const watcher = new ProjectWatcher(service);
  const server = createDashboardServer(service, assets, owner);
  let endpointKey: string | undefined;
  let stopping = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    if (timer) clearInterval(timer);
    watcher.stop();
    await new Promise<void>((accept) => server.close(() => accept()));
    service.store.releaseLease(key, owner);
    if (endpointKey) service.store.releaseLease(endpointKey, owner);
    service.store.setWriteOwner();
  };
  try {
    await new Promise<void>((accept, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", reject);
        accept();
      });
    });
    const tick = async () => {
      if (stopping) return;
      if (!service.store.acquireLease(key, owner, 30000)) {
        await stop();
        return;
      }
      if (endpointKey) service.store.acquireLease(endpointKey, owner, 30000);
      await watcher.tick();
    };
    endpointKey = `dashboard-endpoint:http://127.0.0.1:${(server.address() as { port: number }).port}`;
    await tick();
    timer = setInterval(() => {
      void tick().catch(() => {
        void stop();
      });
    }, 5000);
    server.once("close", () => {
      if (timer) clearInterval(timer);
      watcher.stop();
      service.store.releaseLease(key, owner);
      if (endpointKey) service.store.releaseLease(endpointKey, owner);
      service.store.setWriteOwner();
    });
    return { server, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
