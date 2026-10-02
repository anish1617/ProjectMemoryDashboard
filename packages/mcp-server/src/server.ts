import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import {
  ProjectService,
  checkpointSchema,
  decisionSchema,
  WorkflowError,
  type ServicePort,
} from "@project-memory/service";
import { stateSchema, sections } from "@project-memory/core";
const id = z.string().min(1).max(100);
const result = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});
async function safe(work: () => unknown | Promise<unknown>) {
  try {
    return result(await work());
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text:
            error instanceof WorkflowError
              ? error.message
              : "Operation failed. Check project scope, evidence references, current revision, and allowed folders.",
        },
      ],
    };
  }
}
export function createMcpServer(service: ProjectService | ServicePort) {
  const server = new McpServer({ name: "project-memory", version: "0.1.0" });
  server.registerTool(
    "project_list",
    {
      description: "List persisted local projects and freshness.",
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: true },
    },
    async () =>
      result({
        projects: service.store
          .listProjects()
          .map(({ evidence, state, history, ...project }) => project),
      }),
  );
  server.registerTool(
    "project_identify",
    {
      description:
        "Identify a registered project by repository path. Does not register or scan.",
      inputSchema: z.strictObject({ cwd: z.string() }),
      annotations: { readOnlyHint: true },
    },
    async ({ cwd }) =>
      safe(async () => {
        const path = await service.allowed(cwd);
        const binding = service.store.identity(path);
        const view = binding
          ? service.store.view(binding.id)
          : service.store.listProjects().find((p) => p.path === path);
        return view
          ? {
              found: true,
              projectId: view.id,
              repositoryRoot: view.path,
              semanticFreshness: view.freshness,
            }
          : { found: false };
      }),
  );
  server.registerTool(
    "project_register",
    {
      description:
        "Register and scan an allowed existing Git repository without changing source.",
      inputSchema: z.strictObject({ cwd: z.string() }),
      annotations: { readOnlyHint: false },
    },
    async ({ cwd }) => safe(() => service.register(cwd)),
  );
  server.registerTool(
    "project_refresh_git",
    {
      description:
        "Refresh Git and bounded repository facts for a registered project.",
      inputSchema: z.strictObject({ projectId: id }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId }) => safe(() => service.refresh(projectId)),
  );
  server.registerTool(
    "project_get_evidence_bundle",
    {
      description:
        "Get scoped redacted evidence and the current state revision.",
      inputSchema: z.strictObject({
        projectId: id,
        reason: z.enum(["onboard", "resume", "checkpoint", "reconstruct"]),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId }) =>
      safe(() => ({
        bundle: service.bundle(projectId),
        schemaVersion: 1,
        snapshotId: service.store.latestState(projectId)?.id,
      })),
  );
  server.registerTool(
    "project_get_resume",
    {
      description:
        "Get a bounded resume with provenance and freshness. Token budget is estimated from characters.",
      inputSchema: z.strictObject({
        projectId: id,
        maxTokens: z.number().int().min(200).max(3000).default(1200),
        includeEvidence: z.boolean().default(false),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, maxTokens, includeEvidence }) =>
      safe(() => {
        const view = service.store.view(projectId);
        if (!view) throw new Error("Project not found");
        const lines = [
          `Project: ${view.name}`,
          `Branch: ${view.branch}; dirty: ${view.dirty}; observed: ${view.observedAt}`,
          `Freshness: ${view.freshness}`,
        ];
        for (const section of sections) {
          lines.push(section + ":");
          for (const claim of view.state[section])
            lines.push(
              `[${claim.provenance}] ${claim.text}${includeEvidence ? " refs: " + claim.evidenceRefs.join(",") : ""}`,
            );
        }
        const full = lines.join("\n");
        return {
          projectId,
          freshness: view.freshness,
          capsule: full.slice(0, maxTokens * 4),
          truncated: full.length > maxTokens * 4,
          budgetEstimate: "characters / 4; not exact tokenization",
        };
      }),
  );
  server.registerTool(
    "project_save_state",
    {
      description:
        "Save a validated state against an expected snapshot revision. Old snapshots remain immutable.",
      inputSchema: z.strictObject({
        projectId: id,
        schemaVersion: z.literal(1),
        expectedSnapshotId: z.number().int(),
        state: stateSchema,
      }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, state, expectedSnapshotId }) =>
      safe(() => service.saveState(projectId, state, expectedSnapshotId)),
  );
  server.registerTool(
    "project_create_checkpoint",
    {
      description:
        "Record an explicit checkpoint with scoped evidence, not automatic feature verification.",
      inputSchema: checkpointSchema.extend({ projectId: id }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, ...input }) =>
      safe(() => service.checkpoint(projectId, input)),
  );
  server.registerTool(
    "project_record_decision",
    {
      description:
        "Record decision rationale, alternatives and consequences with evidence.",
      inputSchema: decisionSchema.extend({ projectId: id }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, ...input }) =>
      safe(() => service.decision(projectId, input)),
  );
  server.registerTool(
    "project_get_history",
    {
      description: "Read bounded project history. Pagination uses offset.",
      inputSchema: z.strictObject({
        projectId: id,
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, limit, offset }) =>
      safe(() => ({
        items: service.store.history(projectId, limit, offset),
        nextOffset: offset + limit,
      })),
  );
  server.registerTool(
    "project_search",
    {
      description:
        "Search redacted checkpoints, decisions and imported public conversation text with SQLite FTS5.",
      inputSchema: z.strictObject({
        projectId: id,
        query: z.string().min(1).max(500),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, query }) =>
      safe(() => ({ items: service.store.search(projectId, query) })),
  );
  server.registerTool(
    "project_begin_import",
    {
      description:
        "Start or find a durable job importing selected public history; does not import messages until resumed.",
      inputSchema: z.strictObject({
        projectId: id,
        path: z.string().min(1).max(4096),
        provider: z.enum(["generic", "codex", "claude"]),
      }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, path, provider }) =>
      safe(() => service.beginImport(projectId, path, provider)),
  );
  server.registerTool(
    "project_resume_import",
    {
      description:
        "Resume one bounded atomic import batch; source must still match and remain in scope.",
      inputSchema: z.strictObject({
        jobId: id,
        batch: z.number().int().min(1).max(500).default(100),
      }),
      annotations: { readOnlyHint: false },
    },
    async ({ jobId, batch }) => safe(() => service.resumeImport(jobId, batch)),
  );
  server.registerTool(
    "project_get_import_jobs",
    {
      description: "List up to 100 recent import jobs for a project.",
      inputSchema: z.strictObject({ projectId: id }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId }) => safe(() => service.store.importJobs(projectId)),
  );
  return server;
}
export async function startMcp(service: ProjectService | ServicePort) {
  await serveStdio(() => createMcpServer(service));
}
