import { realpath, readFile, readdir, lstat } from "node:fs/promises";
import { relative, isAbsolute, basename, join, resolve } from "node:path";
import { Store } from "@project-memory/db";
import { scanRepository, excluded } from "@project-memory/scanner";
import {
  factualState,
  validateState,
  evidence,
  redact,
  hash,
  sections,
  type EvidenceBundle,
  type ProjectState,
} from "@project-memory/core";
import { z } from "zod";
import { randomUUID } from "node:crypto";
export { ingestHook } from "./hooks.js";
export { ProjectWatcher } from "./watcher.js";
export {
  connectService,
  writeMethods,
  type ServicePort,
} from "./connection.js";
import { ingestHook } from "./hooks.js";
export class WorkflowError extends Error {}
export const checkpointSchema = z.strictObject({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(4000),
  evidenceRefs: z.array(z.string()).max(100),
  nextActions: z.array(z.string().min(1).max(1000)).max(3).optional(),
});
export const decisionSchema = z.strictObject({
  title: z.string().min(1).max(200),
  decision: z.string().min(1).max(4000),
  rationale: z.string().max(4000),
  alternatives: z.array(z.string().max(1000)).max(20),
  consequences: z.array(z.string().max(1000)).max(20),
  evidenceRefs: z.array(z.string()).max(100),
});
export class ProjectService {
  recordHook(
    provider: "codex" | "claude" | "cursor",
    raw: unknown,
    mode: "minimal" | "standard",
  ) {
    return ingestHook(this, provider, raw, mode);
  }
  constructor(
    public store: Store,
    public allowedRoots: string[],
  ) {}
  async allowed(path: string) {
    const absolute = await realpath(resolve(path));
    for (const root of this.allowedRoots) {
      const canonical = await realpath(root);
      const delta = relative(canonical, absolute);
      if (
        delta === "" ||
        (!delta.startsWith(
          ".." + (process.platform === "win32" ? "\\" : "/"),
        ) &&
          delta !== ".." &&
          !isAbsolute(delta))
      )
        return absolute;
    }
    throw new WorkflowError(
      "Repository is outside the allowed folders. Restart the service with --allow-root for its parent folder.",
    );
  }
  async register(path: string, canCommit: () => boolean = () => true) {
    const absolute = await this.allowed(path);
    const bundle = await scanRepository(absolute);
    await this.allowed(bundle.repository);
    const binding = this.store.identity(bundle.repository);
    if (binding) bundle.fingerprint = binding.fingerprint;
    const known = this.store
      .listProjects()
      .find(
        (p) =>
          p.path === bundle.repository ||
          this.store.project(p.id)?.fingerprint === bundle.fingerprint,
      );
    if (known)
      bundle.evidence.push(
        ...known.evidence.filter((e) =>
          ["checkpoint", "decision", "session"].includes(e.type),
        ),
      );
    return this.store.atomic(() => {
      if (!canCommit())
        throw new WorkflowError("Refresh ownership lost; no changes saved");
      const id = this.store.capture(bundle, basename(bundle.repository));
      if (!this.store.latestState(id))
        this.store.saveState(id, factualState(bundle), "deterministic", bundle);
      return this.store.view(id)!;
    });
  }
  async refresh(id: string) {
    const view = this.store.view(id);
    if (!view) throw new WorkflowError("Project not found");
    const current = await this.register(view.path);
    if (current.id !== id)
      throw new WorkflowError(
        "Repository identity changed; select its current project",
      );
    return current;
  }
  bundle(id: string) {
    const bundle = this.store.latestBundle(id);
    if (!bundle) throw new WorkflowError("Project not found");
    return bundle;
  }
  saveState(id: string, candidate: unknown, expectedSnapshotId: number) {
    return this.store.atomic(() => {
      const current = this.store.latestState(id);
      if (!current || current.id !== expectedSnapshotId)
        throw new WorkflowError("State revision changed; refresh and retry");
      const bundle = this.bundle(id);
      this.store.saveState(
        id,
        validateState(candidate, bundle),
        "agent-checkpoint",
        bundle,
      );
      return this.store.view(id)!;
    });
  }
  saveAnalysis(
    id: string,
    candidate: unknown,
    expectedSnapshotId: number,
    analyzer: string,
  ) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(analyzer))
      throw new WorkflowError("Unsupported analyzer label");
    return this.store.atomic(() => {
      if (this.store.latestState(id)?.id !== expectedSnapshotId)
        throw new WorkflowError("State revision changed; refresh and retry");
      return this.store.saveState(id, candidate, analyzer, this.bundle(id));
    });
  }
  checkpoint(id: string, raw: unknown) {
    return this.store.atomic(() => {
      const input = checkpointSchema.parse(raw);
      const bundle = this.bundle(id);
      // validate refs before any mutation
      if (
        input.evidenceRefs.some(
          (ref) => !bundle.evidence.some((e) => e.id === ref),
        )
      )
        throw new WorkflowError("Unknown or cross-project evidence reference");
      const item = evidence(
        "checkpoint",
        `checkpoint:${hash(JSON.stringify(input))}`,
        input.summary,
      );
      const updated = {
        ...bundle,
        capturedAt: new Date().toISOString(),
        evidence: [...bundle.evidence.filter((e) => e.id !== item.id), item],
      };
      const previous = currentClaims(
        this.store.latestState(id)!.state,
        updated,
      );
      this.store.capture(updated, this.store.project(id)!.name);
      this.store.record(id, {
        type: "checkpoint",
        title: input.title,
        summary: input.summary,
        source: "Explicit checkpoint",
        evidenceRefs: [...input.evidenceRefs, item.id],
        dedupKey: item.id,
      });
      const state = {
        ...previous,
        inProgress: [
          {
            text: redact(input.summary),
            provenance: "explicit",
            confidence: 1,
            evidenceRefs: [item.id],
          },
        ],
        nextActions: input.nextActions
          ? input.nextActions.map((text) => ({
              text: redact(text),
              provenance: "recommended",
              confidence: 1,
              evidenceRefs: [item.id],
            }))
          : previous.nextActions,
      };
      this.store.saveState(id, state, "checkpoint", updated);
      return this.store.view(id)!;
    });
  }
  decision(id: string, raw: unknown) {
    return this.store.atomic(() => {
      const input = decisionSchema.parse(raw);
      const bundle = this.bundle(id);
      if (
        input.evidenceRefs.some(
          (ref) => !bundle.evidence.some((e) => e.id === ref),
        )
      )
        throw new WorkflowError("Unknown or cross-project evidence reference");
      const summary = `${input.decision}\nRationale: ${input.rationale}\nAlternatives: ${input.alternatives.join("; ")}\nConsequences: ${input.consequences.join("; ")}`;
      const item = evidence(
        "decision",
        `decision:${hash(JSON.stringify(input))}`,
        summary,
      );
      const updated = {
        ...bundle,
        capturedAt: new Date().toISOString(),
        evidence: [...bundle.evidence.filter((e) => e.id !== item.id), item],
      };
      const previous = currentClaims(
        this.store.latestState(id)!.state,
        updated,
      );
      this.store.capture(updated, this.store.project(id)!.name);
      this.store.record(id, {
        type: "decision",
        title: input.title,
        summary,
        source: "Explicit decision",
        evidenceRefs: [...input.evidenceRefs, item.id],
        dedupKey: item.id,
      });
      this.store.saveState(
        id,
        {
          ...previous,
          decisions: [
            ...previous.decisions,
            {
              text: redact(input.decision),
              provenance: "explicit",
              confidence: 1,
              evidenceRefs: [item.id],
            },
          ].slice(-30),
        },
        "checkpoint",
        updated,
      );
      return this.store.view(id)!;
    });
  }
  async discover(path: string, depth = 2) {
    const root = await this.allowed(path);
    const found: string[] = [];
    let visited = 0;
    const walk = async (dir: string, level: number) => {
      if (++visited > 1000)
        throw new WorkflowError(
          "Discovery directory budget reached; choose a narrower folder",
        );
      const entries = await readdir(dir, { withFileTypes: true });
      if (entries.some((e) => e.name === ".git")) {
        found.push(dir);
        return;
      }
      if (level >= depth) return;
      for (const entry of entries)
        if (
          entry.isDirectory() &&
          !entry.isSymbolicLink() &&
          !entry.name.startsWith(".") &&
          !["node_modules", "dist"].includes(entry.name)
        )
          await walk(join(dir, entry.name), level + 1);
    };
    await walk(root, 0);
    return found;
  }
  async setIdentity(path: string, targetId?: string) {
    const source = await this.allowed(path);
    const binding = this.store.identity(source);
    if (!targetId && binding?.fingerprint.startsWith("separate:"))
      return this.register(source);
    const bundle = await scanRepository(source);
    if (targetId) {
      const target = this.store.project(targetId);
      if (!target) throw new WorkflowError("Project not found");
      await this.allowed(this.bundle(targetId).repository);
      bundle.fingerprint = target.fingerprint;
      bundle.evidence.push(
        ...this.bundle(targetId).evidence.filter((e) =>
          ["checkpoint", "decision", "session"].includes(e.type),
        ),
      );
    } else bundle.fingerprint = `separate:${randomUUID()}`;
    return this.store.atomic(() => {
      const id = this.store.capture(bundle, basename(bundle.repository));
      this.store.bindIdentity(bundle.repository, id);
      if (!this.store.latestState(id))
        this.store.saveState(id, factualState(bundle), "deterministic", bundle);
      return this.store.view(id)!;
    });
  }
  async readHistory(path: string, provider: "generic" | "codex" | "claude") {
    if (excluded(path.replaceAll("\\", "/")))
      throw new WorkflowError("Secret or credential paths cannot be imported");
    const source = await this.allowed(path);
    if (excluded(source.replaceAll("\\", "/")))
      throw new WorkflowError("Secret or credential paths cannot be imported");
    const stat = await lstat(source);
    if (!stat.isFile() || stat.size > 2_000_000)
      throw new WorkflowError("History must be a file smaller than 2 MB");
    const text = await readFile(source, "utf8");
    if (Buffer.byteLength(text) > 2_000_000)
      throw new WorkflowError("History exceeds byte budget");
    const messages = parseHistory(text, provider);
    const digest = hash(messages.map((m) => m.role + ":" + m.text).join("\n"));
    return { source, messages, digest };
  }
  async beginImport(
    id: string,
    path: string,
    provider: "generic" | "codex" | "claude",
  ) {
    this.bundle(id);
    const data = await this.readHistory(path, provider);
    const job = this.store.createImportJob({
      projectId: id,
      source: data.source,
      provider,
      digest: data.digest,
      total: data.messages.length,
    });
    return this.store.importJob(job.id)!;
  }
  async matchHistory(id: string, folder: string, provider: "codex" | "claude") {
    const repository = await this.allowed(this.bundle(id).repository);
    const root = await this.allowed(folder);
    const entries = await readdir(root, { withFileTypes: true });
    if (entries.length > 1000)
      throw new WorkflowError(
        "History directory budget reached; choose a narrower folder",
      );
    const matched: string[] = [];
    let skipped = 0;
    for (const entry of entries) {
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !entry.name.endsWith(".jsonl")
      )
        continue;
      const path = join(root, entry.name);
      try {
        const data = await this.readHistory(path, provider);
        const text = await readFile(data.source, "utf8");
        if (Buffer.byteLength(text) > 2_000_000) {
          skipped++;
          continue;
        }
        const directories = new Set<string>();
        for (const line of text.split(/\r?\n/).slice(0, 10000)) {
          try {
            const row = JSON.parse(line);
            const cwd =
              provider === "codex"
                ? row?.type === "session_meta"
                  ? row.payload?.cwd
                  : undefined
                : row?.cwd;
            if (typeof cwd === "string" && isAbsolute(cwd))
              directories.add(await realpath(cwd));
          } catch {
            /* Malformed metadata is not a match. */
          }
        }
        // Ambiguous or missing metadata never selects a project automatically.
        if (directories.size === 1 && directories.has(repository))
          matched.push(data.source);
        else skipped++;
      } catch {
        skipped++;
      }
    }
    return {
      projectId: id,
      matched,
      skipped,
      scope: "top-level JSONL files; exact canonical cwd metadata only",
    };
  }
  async resumeImport(jobId: string, batch = 100) {
    if (!Number.isInteger(batch) || batch < 1 || batch > 500)
      throw new WorkflowError("Batch must be between 1 and 500");
    const job = this.store.importJob(jobId);
    if (!job) throw new WorkflowError("Import job not found");
    const data = await this.readHistory(job.source, job.provider);
    if (data.digest !== job.digest || data.messages.length !== job.total)
      throw new WorkflowError("History changed; start a new import job");
    return this.store.atomic(() => {
      const current = this.store.importJob(jobId)!;
      if (current.status === "completed") return current;
      const bundle = this.bundle(current.projectId);
      const end = Math.min(current.cursor + batch, current.total);
      const items = data.messages
        .slice(current.cursor, end)
        .map((m, index) =>
          evidence(
            "session",
            `agent:${current.provider}:${current.digest}#message:${current.cursor + index}`,
            m.text,
          ),
        );
      const index = new Map(bundle.evidence.map((e) => [e.id, e]));
      for (const item of items) index.set(item.id, item);
      this.store.capture(
        {
          ...bundle,
          capturedAt: new Date().toISOString(),
          evidence: [...index.values()],
        },
        this.store.project(current.projectId)!.name,
      );
      let imported = 0;
      for (const [i, item] of items.entries()) {
        if (
          this.store.record(current.projectId, {
            type: "import",
            title: `${current.provider} history: ${data.messages[current.cursor + i]!.role}`,
            summary: item.content,
            source: `${current.provider} imported history`,
            evidenceRefs: [item.id],
            dedupKey: item.id,
          }).inserted
        )
          imported++;
      }
      this.store.advanceImport(
        jobId,
        current.cursor,
        end,
        imported,
        current.total,
      );
      return this.store.importJob(jobId)!;
    });
  }
  async importHistory(
    id: string,
    path: string,
    provider: "generic" | "codex" | "claude",
  ) {
    let job = await this.beginImport(id, path, provider);
    const before = job.imported;
    while (job.status !== "completed") job = await this.resumeImport(job.id);
    const imported = job.imported - before;
    return {
      seen: job.total,
      imported,
      skipped: job.total - imported,
      jobId: job.id,
    };
  }
}
function currentClaims(
  previous: ProjectState,
  bundle: EvidenceBundle,
): ProjectState {
  const ids = new Set(bundle.evidence.map((e) => e.id));
  const state = structuredClone(previous);
  for (const section of sections)
    state[section] = state[section].filter((c) =>
      c.evidenceRefs.every((id) => ids.has(id)),
    );
  state.relevantFiles = state.relevantFiles.filter((f) =>
    f.evidenceRefs.every((id) => ids.has(id)),
  );
  if (!state.lifecycleStage.evidenceRefs.every((id) => ids.has(id)))
    state.lifecycleStage = factualState(bundle).lifecycleStage;
  return state;
}
export function parseHistory(
  text: string,
  provider: "generic" | "codex" | "claude",
): Array<{ role: string; text: string }> {
  if (provider === "generic" && !text.trimStart().startsWith("{"))
    return [{ role: "user", text: redact(text).slice(0, 4000) }];
  const messages: Array<{ role: string; text: string }> = [];
  for (const line of text.split(/\r?\n/).filter(Boolean).slice(0, 10000)) {
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const payload = (
      row.payload && typeof row.payload === "object" ? row.payload : row
    ) as Record<string, unknown>;
    const msg = (
      payload.message && typeof payload.message === "object"
        ? payload.message
        : payload
    ) as Record<string, unknown>;
    // Only allow public user text and final assistant text. All reasoning/tool records are excluded.
    const role = String(msg.role ?? row.type ?? "");
    if (!["user", "assistant"].includes(role)) continue;
    if (
      provider === "codex" &&
      role === "assistant" &&
      msg.phase !== "final_answer"
    )
      continue;
    if (msg.type === "reasoning" || payload.type === "reasoning") continue;
    const content = msg.content;
    const publicText =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .filter(
                (item) =>
                  item &&
                  typeof item === "object" &&
                  ["text", "input_text", "output_text"].includes(
                    (item as { type: string }).type,
                  ),
              )
              .map((item) => (item as { text?: string }).text ?? "")
              .join("\n")
          : "";
    if (publicText)
      messages.push({ role, text: redact(publicText).slice(0, 4000) });
  }
  return messages;
}
