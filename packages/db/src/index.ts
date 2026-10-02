import Database from "better-sqlite3";
export {
  backupDatabase,
  restoreDatabase,
  inspectDatabase,
  MaintenanceError,
  type DatabaseInspection,
} from "./maintenance.js";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  validateState,
  type EvidenceBundle,
  type ProjectState,
  type ProjectView,
  type HistoryItem,
  evidence,
  redact,
} from "@project-memory/core";

const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint").notNull().unique(),
  name: text("name").notNull(),
});
const roots = sqliteTable("repository_roots", {
  path: text("path").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
});
const observations = sqliteTable("observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  capturedAt: text("captured_at").notNull(),
  bundle: text("bundle").notNull(),
});
const evidenceRows = sqliteTable("evidence", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  payload: text("payload").notNull(),
});
const snapshots = sqliteTable("state_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  generatedAt: text("generated_at").notNull(),
  analyzer: text("analyzer").notNull(),
  fingerprint: text("fingerprint").notNull(),
  state: text("state").notNull(),
});
export type ImportJob = {
  id: string;
  projectId: string;
  source: string;
  provider: "generic" | "codex" | "claude";
  digest: string;
  total: number;
  cursor: number;
  imported: number;
  status: "pending" | "completed";
};
export class Store {
  private writeOwner: string | undefined;
  private sqlite: Database.Database;
  private db;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new Database(path);
    this.sqlite.pragma("foreign_keys = ON");
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("busy_timeout = 5000");
    try {
      this.sqlite
        .transaction(() => {
          const version = this.sqlite.pragma("user_version", {
            simple: true,
          }) as number;
          if (version > 3) {
            throw new Error("Database schema is newer than this application");
          }
          if (version === 0)
            this.sqlite.transaction(() => {
              this.sqlite.exec(`
        CREATE TABLE projects (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
        CREATE TABLE repository_roots (path TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id));
        CREATE TABLE observations (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL REFERENCES projects(id), captured_at TEXT NOT NULL, bundle TEXT NOT NULL);
        CREATE TABLE evidence (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), payload TEXT NOT NULL);
        CREATE TABLE state_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL REFERENCES projects(id), generated_at TEXT NOT NULL, analyzer TEXT NOT NULL, fingerprint TEXT NOT NULL, state TEXT NOT NULL);
        CREATE INDEX observations_project ON observations(project_id, id);
        CREATE INDEX snapshots_project ON state_snapshots(project_id, id);
        CREATE TRIGGER evidence_no_update BEFORE UPDATE ON evidence BEGIN SELECT RAISE(ABORT, 'Evidence is immutable'); END;
        CREATE TRIGGER state_no_update BEFORE UPDATE ON state_snapshots BEGIN SELECT RAISE(ABORT, 'Snapshots are immutable'); END;
        PRAGMA user_version = 1;
      `);
            })();
          if (version < 2)
            this.sqlite.transaction(() => {
              this.sqlite.exec(`
        CREATE TABLE activity (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), type TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, occurred_at TEXT NOT NULL, source TEXT NOT NULL, evidence_refs TEXT NOT NULL, dedup_key TEXT NOT NULL UNIQUE);
        CREATE INDEX activity_project ON activity(project_id, occurred_at);
        CREATE VIRTUAL TABLE activity_search USING fts5(id UNINDEXED, project_id UNINDEXED, title, summary);
        CREATE TRIGGER activity_search_insert AFTER INSERT ON activity BEGIN INSERT INTO activity_search VALUES (new.id, new.project_id, new.title, new.summary); END;
        PRAGMA user_version = 2;
      `);
            })();
          if (version < 3)
            this.sqlite.transaction(() => {
              this.sqlite.exec(`
        CREATE TABLE import_jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), source TEXT NOT NULL, provider TEXT NOT NULL, digest TEXT NOT NULL, total INTEGER NOT NULL, cursor INTEGER NOT NULL DEFAULT 0, imported INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, UNIQUE(project_id,source,provider,digest));
        CREATE TABLE leases (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE identity_bindings (path TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id));
        PRAGMA user_version = 3;
      `);
            })();
        })
        .immediate();
    } catch (error) {
      this.sqlite.close();
      throw error;
    }
    this.db = drizzle(this.sqlite);
  }
  close() {
    this.sqlite.close();
  }
  atomic<T>(work: () => T): T {
    return this.sqlite.transaction(() => {
      this.assertWriter();
      return work();
    })();
  }
  setWriteOwner(owner?: string) {
    this.writeOwner = owner;
  }
  private assertWriter() {
    const owner = this.sqlite
      .prepare(
        "SELECT owner FROM leases WHERE name='dashboard-daemon' AND expires>?",
      )
      .get(Date.now()) as { owner: string } | undefined;
    if (
      (owner && owner.owner !== this.writeOwner) ||
      (this.writeOwner && owner?.owner !== this.writeOwner)
    )
      throw new Error(
        "Database writes require the active daemon; reconnect or restart it",
      );
  }
  daemonEndpoint() {
    return this.sqlite
      .prepare(
        "SELECT substr(e.name,20) AS url,e.owner FROM leases e JOIN leases d ON d.name='dashboard-daemon' AND d.owner=e.owner WHERE e.name LIKE 'dashboard-endpoint:%' AND e.expires>? AND d.expires>? ORDER BY e.expires DESC LIMIT 1",
      )
      .get(Date.now(), Date.now()) as
      { url: string; owner: string } | undefined;
  }
  hasDaemon() {
    return Boolean(
      this.sqlite
        .prepare(
          "SELECT 1 FROM leases WHERE name='dashboard-daemon' AND expires>?",
        )
        .get(Date.now()),
    );
  }
  identity(path: string) {
    const binding = this.sqlite
      .prepare("SELECT project_id FROM identity_bindings WHERE path=?")
      .get(path) as { project_id: string } | undefined;
    return binding ? this.project(binding.project_id) : undefined;
  }
  bindIdentity(path: string, projectId: string) {
    return this.atomic(() => {
      if (!this.project(projectId)) throw new Error("Project not found");
      this.sqlite
        .prepare(
          "INSERT INTO identity_bindings VALUES (?,?) ON CONFLICT(path) DO UPDATE SET project_id=excluded.project_id",
        )
        .run(path, projectId);
    });
  }
  acquireLease(name: string, owner: string, ttl: number, now = Date.now()) {
    return (
      this.sqlite
        .prepare(
          "INSERT INTO leases VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE leases.owner=excluded.owner OR leases.expires<=?",
        )
        .run(name, owner, now + ttl, now).changes === 1
    );
  }
  releaseLease(name: string, owner: string) {
    this.sqlite
      .prepare("DELETE FROM leases WHERE name=? AND owner=?")
      .run(name, owner);
  }
  createImportJob(
    input: Omit<ImportJob, "id" | "cursor" | "imported" | "status">,
  ) {
    return this.atomic(() => {
      this.sqlite
        .prepare(
          "INSERT INTO import_jobs (id,project_id,source,provider,digest,total,status) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        )
        .run(
          randomUUID(),
          input.projectId,
          input.source,
          input.provider,
          input.digest,
          input.total,
          input.total ? "pending" : "completed",
        );
      return this.sqlite
        .prepare(
          "SELECT id FROM import_jobs WHERE project_id=? AND source=? AND provider=? AND digest=?",
        )
        .get(input.projectId, input.source, input.provider, input.digest) as {
        id: string;
      };
    });
  }
  importJob(id: string) {
    return this.sqlite
      .prepare(
        "SELECT id,project_id AS projectId,source,provider,digest,total,cursor,imported,status FROM import_jobs WHERE id=?",
      )
      .get(id) as ImportJob | undefined;
  }
  importJobs(projectId: string) {
    return (
      this.sqlite
        .prepare(
          "SELECT id FROM import_jobs WHERE project_id=? ORDER BY rowid DESC LIMIT 100",
        )
        .all(projectId) as { id: string }[]
    ).map((row) => this.importJob(row.id)!);
  }
  advanceImport(
    id: string,
    expectedCursor: number,
    cursor: number,
    imported: number,
    total: number,
  ) {
    return this.atomic(() => {
      if (
        this.sqlite
          .prepare(
            "UPDATE import_jobs SET cursor=?,imported=imported+?,status=? WHERE id=? AND cursor=?",
          )
          .run(
            cursor,
            imported,
            cursor === total ? "completed" : "pending",
            id,
            expectedCursor,
          ).changes !== 1
      )
        throw new Error("Import revision changed; retry");
    });
  }
  capture(bundle: EvidenceBundle, name: string): string {
    return this.db.transaction((tx) => {
      this.assertWriter();
      let project = tx
        .select()
        .from(projects)
        .where(eq(projects.fingerprint, bundle.fingerprint))
        .get();
      if (!project && bundle.fingerprint.startsWith("history:")) {
        const knownRoot = tx
          .select()
          .from(roots)
          .where(eq(roots.path, bundle.repository))
          .get();
        const prior = knownRoot
          ? tx
              .select()
              .from(projects)
              .where(eq(projects.id, knownRoot.projectId))
              .get()
          : undefined;
        if (prior?.fingerprint.startsWith("unborn:")) {
          tx.update(projects)
            .set({ fingerprint: bundle.fingerprint })
            .where(eq(projects.id, prior.id))
            .run();
          project = { ...prior, fingerprint: bundle.fingerprint };
        }
      }
      if (!project) {
        project = { id: randomUUID(), name, fingerprint: bundle.fingerprint };
        tx.insert(projects).values(project).run();
      }
      tx.insert(roots)
        .values({ path: bundle.repository, projectId: project.id })
        .onConflictDoUpdate({
          target: roots.path,
          set: { projectId: project.id },
        })
        .run();
      const previous = tx
        .select()
        .from(observations)
        .where(eq(observations.projectId, project.id))
        .orderBy(desc(observations.id))
        .limit(1)
        .get();
      if (
        !previous ||
        bundleDigest(JSON.parse(previous.bundle) as EvidenceBundle) !==
          bundleDigest(bundle)
      ) {
        tx.insert(observations)
          .values({
            projectId: project.id,
            capturedAt: bundle.capturedAt,
            bundle: JSON.stringify(bundle),
          })
          .run();
      }
      for (const item of bundle.evidence) {
        // Scope content-addressed IDs to projects at storage level. State references remain bundle-local.
        tx.insert(evidenceRows)
          .values({
            id: `${project.id}:${item.id}`,
            projectId: project.id,
            payload: JSON.stringify(item),
          })
          .onConflictDoNothing()
          .run();
      }
      return project.id;
    });
  }
  saveState(
    projectId: string,
    candidate: unknown,
    analyzer: string,
    bundle: EvidenceBundle,
  ) {
    return this.atomic(() => {
      const state = validateState(candidate, bundle);
      const project = this.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();
      if (!project || project.fingerprint !== bundle.fingerprint)
        throw new Error("Evidence bundle belongs to another project");
      for (const item of bundle.evidence) {
        const persisted = this.db
          .select()
          .from(evidenceRows)
          .where(eq(evidenceRows.id, `${projectId}:${item.id}`))
          .get();
        if (!persisted) throw new Error("Evidence was not persisted");
        if (persisted.payload !== JSON.stringify(item))
          throw new Error("Evidence differs from immutable persisted content");
      }
      this.db
        .insert(snapshots)
        .values({
          projectId,
          generatedAt: new Date().toISOString(),
          analyzer,
          fingerprint: bundleDigest(bundle),
          state: JSON.stringify(state),
        })
        .run();
      return state;
    });
  }
  latestState(projectId: string) {
    const row = this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, projectId))
      .orderBy(desc(snapshots.id))
      .limit(1)
      .get();
    return row
      ? { ...row, state: JSON.parse(row.state) as ProjectState }
      : undefined;
  }
  project(projectId: string) {
    return this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
  }
  latestBundle(projectId: string): EvidenceBundle | undefined {
    const row = this.db
      .select()
      .from(observations)
      .where(eq(observations.projectId, projectId))
      .orderBy(desc(observations.id))
      .limit(1)
      .get();
    return row ? (JSON.parse(row.bundle) as EvidenceBundle) : undefined;
  }
  listProjects(): ProjectView[] {
    return this.db
      .select()
      .from(projects)
      .all()
      .map((p) => this.view(p.id))
      .filter((p): p is ProjectView => Boolean(p))
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  }
  view(projectId: string): ProjectView | undefined {
    const project = this.project(projectId);
    const bundle = this.latestBundle(projectId);
    const snapshot = this.latestState(projectId);
    if (!project || !bundle || !snapshot) return undefined;
    const gitItem = bundle.evidence.find((e) => e.source === "git:current");
    const git = gitItem
      ? (JSON.parse(gitItem.content) as { branch: string; dirty: boolean })
      : { branch: "unknown", dirty: false };
    const history = this.history(projectId);
    const binding = this.identity(bundle.repository);
    const oldIds = JSON.parse(snapshot.fingerprint) as string[];
    const oldRepositoryIds = oldIds
      .filter((id) => {
        const row = this.db
          .select()
          .from(evidenceRows)
          .where(eq(evidenceRows.id, `${projectId}:${id}`))
          .get();
        return (
          row &&
          ["file", "git"].includes(
            (JSON.parse(row.payload) as { type: string }).type,
          )
        );
      })
      .sort();
    const currentRepositoryIds = bundle.evidence
      .filter((e) => ["file", "git"].includes(e.type))
      .map((e) => e.id)
      .sort();
    const freshness =
      binding && binding.id !== projectId
        ? "identity_detached"
        : JSON.stringify(oldRepositoryIds) !==
            JSON.stringify(currentRepositoryIds)
          ? "stale_repository"
          : snapshot.fingerprint !== bundleDigest(bundle) ||
              history.some((h) => h.occurredAt > snapshot.generatedAt)
            ? "stale_activity"
            : snapshot.analyzer === "deterministic"
              ? "needs_analysis"
              : "fresh";
    return {
      id: projectId,
      name: project.name,
      path: bundle.repository,
      branch: git.branch,
      dirty: git.dirty,
      stage: snapshot.state.lifecycleStage.value,
      stageConfidence: snapshot.state.lifecycleStage.confidence,
      freshness,
      observedAt: bundle.capturedAt,
      generatedAt: snapshot.generatedAt,
      analyzer: snapshot.analyzer,
      state: snapshot.state,
      evidence: bundle.evidence,
      history,
    };
  }
  history(projectId: string, limit = 100, offset = 0): HistoryItem[] {
    return this.sqlite
      .prepare(
        `SELECT * FROM (
      SELECT id,type,title,summary,occurred_at as occurredAt,source FROM activity WHERE project_id=?
      UNION ALL SELECT 'observation:'||id as id,'git' as type,'Evidence bundle captured' as title,'Observed redacted repository and explicit context. Source presence is separate from feature verification.' as summary,captured_at as occurredAt,'Evidence collector' as source FROM observations WHERE project_id=?
    ) ORDER BY occurredAt DESC,id DESC LIMIT ? OFFSET ?`,
      )
      .all(projectId, projectId, limit, offset) as HistoryItem[];
  }
  record(
    projectId: string,
    input: {
      type: string;
      title: string;
      summary: string;
      source: string;
      evidenceRefs: string[];
      dedupKey: string;
      occurredAt?: string;
    },
  ) {
    return this.atomic(() => {
      const bundle = this.latestBundle(projectId);
      if (!bundle) throw new Error("Project not found");
      const ids = new Set(bundle.evidence.map((e) => e.id));
      if (input.evidenceRefs.some((id) => !ids.has(id)))
        throw new Error("Unknown or cross-project evidence reference");
      const existing = this.sqlite
        .prepare("SELECT id FROM activity WHERE dedup_key=? AND project_id=?")
        .get(`${projectId}:${input.dedupKey}`, projectId) as
        { id: string } | undefined;
      if (existing) return { id: existing.id, inserted: false };
      const id = randomUUID();
      this.sqlite
        .prepare("INSERT INTO activity VALUES (?,?,?,?,?,?,?,?,?)")
        .run(
          id,
          projectId,
          input.type,
          redact(input.title),
          redact(input.summary),
          input.occurredAt ?? new Date().toISOString(),
          redact(input.source),
          JSON.stringify(input.evidenceRefs),
          `${projectId}:${input.dedupKey}`,
        );
      return { id, inserted: true };
    });
  }
  search(projectId: string, query: string, limit = 50) {
    // Treat words as literal FTS phrases; never accept user-supplied FTS operators.
    const term = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 10)
      .map((word) => `"${word.replaceAll('"', '""')}"`)
      .join(" AND ");
    if (!term) return [];
    return this.sqlite
      .prepare(
        "SELECT a.id,a.type,a.title,a.summary,a.occurred_at as occurredAt,a.source FROM activity_search s JOIN activity a ON a.id=s.id WHERE activity_search MATCH ? AND a.project_id=? ORDER BY rank LIMIT ?",
      )
      .all(term, projectId, limit) as HistoryItem[];
  }
  counts() {
    return {
      projects: this.db.select().from(projects).all().length,
      observations: this.db.select().from(observations).all().length,
      evidence: this.db.select().from(evidenceRows).all().length,
      snapshots: this.db.select().from(snapshots).all().length,
    };
  }
}
export function bundleDigest(bundle: EvidenceBundle) {
  return JSON.stringify(bundle.evidence.map((item) => item.id).sort());
}
