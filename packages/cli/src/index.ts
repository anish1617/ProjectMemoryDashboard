#!/usr/bin/env node
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  Store,
  backupDatabase,
  restoreDatabase,
  inspectDatabase,
  MaintenanceError,
} from "@project-memory/db";
import { CodexRunner } from "@project-memory/runners";
import { capture, onboard, resume } from "./service.js";
import {
  ProjectService,
  ProjectWatcher,
  WorkflowError,
  connectService,
  ingestHook,
} from "@project-memory/service";
import { createDashboardServer } from "@project-memory/api";
import { startDashboardDaemon } from "@project-memory/api/daemon";
import { startMcp } from "@project-memory/mcp-server";
import {
  prepareInstall,
  applyInstall,
  prepareUninstall,
  applyUninstall,
  type Provider,
  prepareAllInstall,
  applyAllInstall,
  prepareAllUninstall,
  applyAllUninstall,
  prepareHookInstall,
  applyHookInstall,
  prepareHookUninstall,
  applyHookUninstall,
} from "@project-memory/integrations";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      db: { type: "string" },
      agent: { type: "string" },
      help: { type: "boolean" },
      port: { type: "string" },
      "allow-root": { type: "string", multiple: true },
      recursive: { type: "boolean" },
      depth: { type: "string" },
      project: { type: "string" },
      source: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      next: { type: "string", multiple: true },
      query: { type: "string" },
      provider: { type: "string" },
      capture: { type: "string" },
      config: { type: "string" },
      apply: { type: "boolean" },
      batch: { type: "string" },
      interval: { type: "string" },
      quiet: { type: "boolean" },
    },
  });
  const [command, target = "."] = positionals;
  if (values.help || !command) {
    console.log(
      "project-memory <init|add|scan|onboard|resume|status|list|discover|checkpoint|decision|import-history|history|search|doctor|daemon|serve|mcp|hook|install|uninstall|backup|restore|db-check|import-jobs|resume-import|match-history|watch|separate|link|install-hooks|uninstall-hooks|integrations> [path]\n--db path selects shared storage; --allow-root folder can repeat.\nscan --recursive discovers/registers repos. checkpoint requires --summary and accepts --next.\nimport-history <file> --project <id> --source generic|codex|claude [--batch 100]\nresume-import <job-id> resumes one batch; import-jobs --project <id> lists progress.\nwatch refreshes facts; separate/link bind repository identities; install-hooks previews.\ndaemon (or serve) starts the dashboard and repository poller; mcp serves stdio tools.\nDefault analysis is local/deterministic. --agent codex explicitly sends redacted evidence via your authenticated CLI.",
    );
    return;
  }
  if (
    ![
      "init",
      "add",
      "scan",
      "onboard",
      "resume",
      "status",
      "list",
      "discover",
      "checkpoint",
      "decision",
      "import-history",
      "history",
      "search",
      "doctor",
      "serve",
      "mcp",
      "hook",
      "install",
      "uninstall",
      "backup",
      "restore",
      "db-check",
      "import-jobs",
      "resume-import",
      "separate",
      "link",
      "watch",
      "match-history",
      "install-hooks",
      "uninstall-hooks",
      "integrations",
      "daemon",
    ].includes(command)
  )
    throw new Error("Unknown command");
  if (values.agent && values.agent !== "codex")
    throw new Error("Only --agent codex is supported in this milestone");
  const path = resolve(target);
  const db = resolve(
    values.db ??
      process.env.PROJECT_MEMORY_DB ??
      join(homedir(), ".project-memory", "memory.sqlite"),
  );
  if (command === "backup" || command === "restore") {
    if (command === "restore" && !values.db)
      throw new MaintenanceError(
        "Restore requires --db with an explicit new destination path.",
      );
    if (!positionals[1])
      throw new MaintenanceError(
        "Specify a backup destination or restore source file. Restore --db must select a new path.",
      );
    console.log(
      JSON.stringify(
        command === "backup"
          ? await backupDatabase(db, path)
          : await restoreDatabase(path, db),
        null,
        2,
      ),
    );
    return;
  }
  if (command === "db-check") {
    console.log(JSON.stringify(inspectDatabase(db), null, 2));
    return;
  }
  const store = new Store(db);
  const directService = new ProjectService(
    store,
    (
      values["allow-root"] ??
      (command === "import-history"
        ? [dirname(path)]
        : command === "resume-import"
          ? [process.cwd()]
          : [path])
    ).map((p) => resolve(p)),
  );
  let persistent = false;
  const service = connectService(directService);
  try {
    if (command === "daemon" || command === "serve") {
      const port = Number(values.port ?? 4317);
      if (!Number.isInteger(port) || port < 0 || port > 65535)
        throw new Error("Invalid port");
      const daemon = await startDashboardDaemon(
        directService,
        fileURLToPath(new URL("../../../apps/dashboard/dist", import.meta.url)),
        port,
      );
      persistent = true;
      console.log(
        `Project Memory daemon: http://127.0.0.1:${(daemon.server.address() as { port: number }).port}; repository polling active`,
      );
      for (const signal of ["SIGINT", "SIGTERM"] as const)
        process.on(signal, () => {
          void daemon.stop().then(() => {
            store.close();
            process.exit(0);
          });
        });
      return;
    }
    if (command === "integrations") {
      console.log(
        JSON.stringify(
          {
            providers: ["codex", "claude", "cursor"],
            mcp: "reversible config installer",
            hooks: "reversible JSON config installer; minimal capture default",
            skills: "Codex and Claude user-wide project-memory skill",
            hostExecution:
              "Requires provider trust/version and real-session verification",
          },
          null,
          2,
        ),
      );
      return;
    }
    if (command === "install-hooks") {
      if (!["codex", "claude", "cursor"].includes(target) || !values.config)
        throw new Error("Provider and --config JSON path required");
      const mode = values.capture ?? "minimal";
      if (!["minimal", "standard"].includes(mode))
        throw new Error("Invalid capture mode");
      const plan = await prepareHookInstall(
        target as Provider,
        values.config,
        db,
        values["allow-root"] ?? [process.cwd()],
        fileURLToPath(import.meta.url),
        mode as "minimal" | "standard",
      );
      console.log(
        JSON.stringify(
          values.apply ? await applyHookInstall(plan) : plan.preview,
          null,
          2,
        ),
      );
      return;
    }
    if (command === "uninstall-hooks") {
      if (!values.config) throw new Error("--config required");
      const plan = await prepareHookUninstall(values.config);
      console.log(
        JSON.stringify(
          values.apply ? await applyHookUninstall(plan) : plan.preview,
          null,
          2,
        ),
      );
      return;
    }
    if (command === "match-history") {
      if (!values.project || !["codex", "claude"].includes(values.source ?? ""))
        throw new Error("Project and --source codex|claude required");
      const provider = values.source as "codex" | "claude";
      const plan = await service.matchHistory(values.project, path, provider);
      const results = [];
      if (values.apply)
        for (const file of plan.matched)
          results.push(
            await service.importHistory(values.project, file, provider),
          );
      console.log(
        JSON.stringify(values.apply ? { ...plan, results } : plan, null, 2),
      );
      return;
    }
    if (command === "watch") {
      const interval = Number(values.interval ?? 5000);
      if (!Number.isInteger(interval) || interval < 1000 || interval > 3600000)
        throw new Error("Invalid watch interval");
      const watcher = new ProjectWatcher(
        directService,
        Math.max(30000, interval * 3),
      );
      await watcher.tick();
      const timer = setInterval(() => {
        void watcher
          .tick()
          .then((result) => {
            if (result.failed)
              console.error(
                "Some projects could not refresh; check allowed roots and identity bindings.",
              );
          })
          .catch(() => console.error("Watcher refresh failed"));
      }, interval);
      persistent = true;
      console.log(
        "Foreground repository watch active; no semantic analysis or transcript capture. Stop with Ctrl+C.",
      );
      for (const signal of ["SIGINT", "SIGTERM"] as const)
        process.on(signal, () => {
          clearInterval(timer);
          watcher.stop();
          process.exit(0);
        });
      return;
    }
    if (command === "separate" || command === "link") {
      if (command === "link" && !values.project)
        throw new Error("Target --project required");
      console.log(
        JSON.stringify(
          await service.setIdentity(
            path,
            command === "link" ? values.project : undefined,
          ),
        ),
      );
      return;
    }
    if (command === "import-jobs") {
      if (!values.project) throw new Error("Project ID required");
      console.log(JSON.stringify(store.importJobs(values.project), null, 2));
      return;
    }
    if (command === "resume-import") {
      if (!positionals[1]) throw new Error("Import job ID required");
      console.log(
        JSON.stringify(
          await service.resumeImport(target, Number(values.batch ?? 100)),
        ),
      );
      return;
    }
    if (command === "install") {
      if (target === "all") {
        if (!values.config)
          throw new Error("--config integration manifest required");
        const plan = await prepareAllInstall(
          values.config,
          db,
          values["allow-root"] ?? [process.cwd()],
          fileURLToPath(
            new URL("../../mcp-server/dist/index.js", import.meta.url),
          ),
          fileURLToPath(import.meta.url),
        );
        console.log(
          JSON.stringify(
            values.apply ? await applyAllInstall(plan) : plan.preview,
            null,
            2,
          ),
        );
        return;
      }
      if (!["codex", "claude", "cursor"].includes(target) || !values.config)
        throw new Error("Provider and --config path are required");
      const plan = await prepareInstall(
        target as Provider,
        values.config,
        db,
        values["allow-root"] ?? [process.cwd()],
        fileURLToPath(
          new URL("../../mcp-server/dist/index.js", import.meta.url),
        ),
      );
      console.log(
        JSON.stringify(
          values.apply ? await applyInstall(plan) : plan.preview,
          null,
          2,
        ),
      );
      return;
    }
    if (command === "uninstall") {
      if (target === "all") {
        if (!values.config)
          throw new Error("--config integration manifest required");
        const plan = await prepareAllUninstall(values.config);
        console.log(
          JSON.stringify(
            values.apply ? await applyAllUninstall(plan) : plan.preview,
            null,
            2,
          ),
        );
        return;
      }
      if (!values.config) throw new Error("--config required");
      const plan = await prepareUninstall(values.config);
      console.log(
        JSON.stringify(
          values.apply ? await applyUninstall(plan) : plan.preview,
          null,
          2,
        ),
      );
      return;
    }
    if (command === "hook") {
      if (!["codex", "claude", "cursor"].includes(values.provider ?? ""))
        throw new Error("Provider required");
      const captureMode = values.capture ?? "standard";
      if (!["minimal", "standard"].includes(captureMode))
        throw new Error("Invalid capture mode");
      let input = "";
      for await (const chunk of process.stdin) {
        input += String(chunk);
        if (input.length > 50000) throw new Error("Hook input too large");
      }
      const result = await service.recordHook(
        values.provider as "codex" | "claude" | "cursor",
        JSON.parse(input),
        captureMode as "minimal" | "standard",
      );
      console.log(JSON.stringify(values.quiet ? {} : result));
      return;
    }
    if (command === "mcp") {
      persistent = true;
      await startMcp(service);
      return;
    }
    if (command === "doctor") {
      console.log(
        JSON.stringify(
          {
            node: process.version,
            database: db,
            storage: store.counts(),
            codexAvailable: await new CodexRunner(
              process.env.PROJECT_MEMORY_CODEX ?? "codex",
            ).isAvailable(),
            dashboardBuilt: existsSync(
              fileURLToPath(
                new URL(
                  "../../../apps/dashboard/dist/index.html",
                  import.meta.url,
                ),
              ),
            ),
            note: "CLI availability does not prove authentication or installed hooks.",
          },
          null,
          2,
        ),
      );
      return;
    }
    if (command === "list") {
      console.log(
        JSON.stringify(
          store
            .listProjects()
            .map(({ state, evidence, history, ...project }) => project),
          null,
          2,
        ),
      );
      return;
    }
    if (command === "discover" || (command === "scan" && values.recursive)) {
      const depth = Number(values.depth ?? 2);
      if (!Number.isInteger(depth) || depth < 0 || depth > 10)
        throw new Error("Invalid depth");
      const roots = await service.discover(path, depth);
      if (command === "scan")
        for (const root of roots) await service.register(root);
      console.log(
        JSON.stringify(
          { repositories: roots, registered: command === "scan" },
          null,
          2,
        ),
      );
      return;
    }
    if (command === "import-history") {
      if (!values.project) throw new Error("Project ID required");
      const provider = values.source ?? "generic";
      if (!["generic", "codex", "claude"].includes(provider))
        throw new Error("Unsupported source");
      console.log(
        JSON.stringify(
          values.batch
            ? await service.resumeImport(
                (
                  await service.beginImport(
                    values.project,
                    path,
                    provider as "generic" | "codex" | "claude",
                  )
                ).id,
                Number(values.batch),
              )
            : await service.importHistory(
                values.project,
                path,
                provider as "generic" | "codex" | "claude",
              ),
        ),
      );
      return;
    }
    if (["checkpoint", "decision", "history", "search"].includes(command)) {
      const project = values.project
        ? store.view(values.project)
        : await service.register(path);
      if (!project) throw new Error("Project not found");
      if (command === "history") {
        console.log(JSON.stringify(store.history(project.id), null, 2));
        return;
      }
      if (command === "search") {
        console.log(
          JSON.stringify(store.search(project.id, values.query ?? ""), null, 2),
        );
        return;
      }
      if (!values.summary) throw new Error("Summary required");
      const updated =
        command === "checkpoint"
          ? await service.checkpoint(project.id, {
              title: values.title ?? "Development checkpoint",
              summary: values.summary,
              evidenceRefs: [],
              nextActions: values.next ?? [],
            })
          : await service.decision(project.id, {
              title: values.title ?? "Project decision",
              decision: values.summary,
              rationale: "Recorded via CLI",
              alternatives: [],
              consequences: [],
              evidenceRefs: [],
            });
      console.log(
        JSON.stringify({
          projectId: updated.id,
          status: "recorded",
          provenance: "explicit",
        }),
      );
      return;
    }
    if (command === "init") {
      console.log(`Database initialized: ${db}`);
      return;
    }
    if (command === "resume" || command === "status") {
      console.log(await resume(store, path));
      return;
    }
    if (command === "onboard") {
      if (values.agent)
        console.log(
          "Selected analyzer: Codex (redacted bundle; read-only scratch workspace)",
        );
      const result = await onboard(
        store,
        path,
        values.agent
          ? new CodexRunner(process.env.PROJECT_MEMORY_CODEX ?? "codex")
          : undefined,
      );
      for (const diagnostic of result.diagnostics) console.log(diagnostic);
      console.log(await resume(store, path));
    } else {
      const result = await capture(store, path);
      console.log(
        `Registered ${result.projectId}; ${result.bundle.evidence.length} evidence records; ${result.bundle.diagnostics.join("; ")}`,
      );
    }
  } finally {
    if (!persistent) store.close();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof MaintenanceError || error instanceof WorkflowError
      ? error.message
      : "Command failed: check repository, database path, and supported options. Source repository was not intentionally modified.",
  );
  process.exitCode = 1;
});
