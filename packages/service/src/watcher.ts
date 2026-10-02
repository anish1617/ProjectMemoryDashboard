import { randomUUID } from "node:crypto";
import type { ProjectService } from "./index.js";

// Explicit foreground polling is portable; no OS service is installed.
export class ProjectWatcher {
  private owner = randomUUID();
  private active = true;
  private running = false;
  constructor(
    private service: ProjectService,
    private ttl = 30000,
  ) {}
  stop() {
    this.active = false;
    this.service.store.releaseLease("repository-watch", this.owner);
  }
  async tick() {
    if (!this.active || this.running)
      return { owner: false, refreshed: 0, failed: 0 };
    const renew = () =>
      this.active &&
      this.service.store.acquireLease("repository-watch", this.owner, this.ttl);
    if (!renew()) return { owner: false, refreshed: 0, failed: 0 };
    this.running = true;
    let refreshed = 0,
      failed = 0;
    try {
      for (const project of this.service.store.listProjects()) {
        if (!renew()) break;
        try {
          const binding = this.service.store.identity(project.path);
          if (binding && binding.id !== project.id) continue;
          await this.service.register(project.path, renew);
          refreshed++;
        } catch {
          failed++;
        }
      }
      return { owner: true, refreshed, failed };
    } finally {
      this.running = false;
    }
  }
}
