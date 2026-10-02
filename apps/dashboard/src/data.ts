import type { ProjectView, ProjectState, Claim } from "@project-memory/core";
const claim = (
  text: string,
  provenance: Claim["provenance"] = "inferred",
  refs = ["sample-readme"],
): Claim => ({ text, provenance, confidence: 0.8, evidenceRefs: refs });
function sample(
  id: string,
  name: string,
  purpose: string,
  stage: string,
  action: string,
  freshness: string,
): ProjectView {
  const state: ProjectState = {
    purpose: [claim(purpose)],
    architecture: [
      claim("React interface, TypeScript services, and local persistence."),
    ],
    implemented: [claim("The first capture and retrieval flow is in place.")],
    inProgress: [
      claim("Connecting the editor to saved notes and refining empty states."),
    ],
    blockers:
      id === "receipts"
        ? [claim("Waiting for a representative receipt dataset.")]
        : [],
    knownIssues: [
      claim(
        "Keyboard navigation in the command menu needs a regression check.",
      ),
    ],
    decisions: [
      claim("Keep the first version local-first.", "explicit", [
        "sample-checkpoint",
      ]),
    ],
    nextActions: [
      claim(action, "recommended"),
      claim("Run the focused tests and record a checkpoint.", "recommended"),
    ],
    relevantFiles: [
      {
        path: "src/editor/Editor.tsx",
        reason: "Main editor interaction",
        evidenceRefs: ["sample-file"],
      },
    ],
    lifecycleStage: {
      value: stage as ProjectState["lifecycleStage"]["value"],
      confidence: 0.8,
      evidenceRefs: ["sample-checkpoint"],
    },
  };
  return {
    id,
    name,
    path: `/Projects/${name.toLowerCase().replaceAll(" ", "-")}`,
    branch: id === "atlas" ? "feat/note-editor" : "main",
    dirty: id === "atlas",
    stage,
    stageConfidence: 0.8,
    freshness,
    observedAt: "2026-10-02T04:00:00Z",
    generatedAt: "2026-10-01T10:00:00Z",
    analyzer: "sample",
    state,
    evidence: [
      {
        id: "sample-readme",
        type: "file",
        source: "README.md",
        content: purpose,
        factText: null,
      },
      {
        id: "sample-file",
        type: "file",
        source: "src/editor/Editor.tsx",
        content: "Illustrative file reference; no real repository was scanned.",
        factText: null,
      },
      {
        id: "sample-checkpoint",
        type: "checkpoint",
        source: "checkpoint:sample",
        content: "Keep the first version local-first.",
        factText: null,
      },
    ],
    history: [
      {
        id: "sample-1",
        type: "checkpoint",
        title: "Editor foundation",
        summary: "Added note creation and retrieval. Next: connect the editor.",
        occurredAt: "2026-10-01T10:00:00Z",
        source: "Sample checkpoint",
      },
      {
        id: "sample-2",
        type: "git",
        title: "Repository scanned",
        summary:
          "Observed branch and current worktree. This is illustrative activity.",
        occurredAt: "2026-10-02T04:00:00Z",
        source: "Sample Git",
      },
    ],
  };
}
export const mockProjects = [
  sample(
    "atlas",
    "Atlas Notes",
    "A quiet space to capture notes, connect ideas, and find them again.",
    "building",
    "Connect the editor to the note persistence service.",
    "stale_repository",
  ),
  sample(
    "fieldwork",
    "Fieldwork API",
    "An offline-friendly API for collecting field observations.",
    "debugging",
    "Reproduce the sync conflict with the fixture dataset.",
    "fresh",
  ),
  sample(
    "receipts",
    "Receipt Studio",
    "Turn receipts into searchable, structured expense records.",
    "paused",
    "Add representative receipt fixtures for parser verification.",
    "stale_activity",
  ),
  sample(
    "memory",
    "Project Memory",
    "Project continuity across coding agents, grounded in evidence.",
    "building",
    "Connect the dashboard to the local repository scanner.",
    "needs_analysis",
  ),
  sample(
    "routine",
    "Routine",
    "A simple weekly planner for habits and focused work.",
    "mvp_ready",
    "Review the keyboard and mobile flows before release.",
    "fresh",
  ),
  sample(
    "landing",
    "Landing Kit",
    "Reusable pages for small experiments and new ideas.",
    "planning",
    "Define the first reusable page and its acceptance criteria.",
    "needs_analysis",
  ),
];
export function capsule(project: ProjectView) {
  return [
    `Project: ${project.name}`,
    `Freshness: ${project.freshness}`,
    `Branch: ${project.branch}`,
    `Analyzer: ${project.analyzer}; generated: ${project.generatedAt ?? "not generated"}`,
    `Stage: ${project.stage}; confidence: ${project.stageConfidence}`,
    ...Object.entries(project.state)
      .filter(([, v]) => Array.isArray(v))
      .flatMap(([key, value]) => [
        key + ":",
        ...(
          value as Array<{
            text?: string;
            path?: string;
            provenance?: string;
            evidenceRefs?: string[];
          }>
        ).map(
          (item) =>
            "- " +
            (item.provenance ? `[${item.provenance}] ` : "") +
            (item.text ?? item.path ?? "") +
            (item.evidenceRefs
              ? ` (evidence: ${item.evidenceRefs.join(", ") || "none"})`
              : ""),
        ),
      ]),
  ].join("\n");
}
let token = "";
export async function api<T>(
  path: string,
  body?: unknown,
  attempt = 0,
): Promise<T> {
  if (!token) {
    const response = await fetch("/api/session", {
      headers: { "X-Project-Memory": "dashboard" },
    });
    if (!response.ok)
      throw new Error(
        "The local service is unavailable. Start it with pnpm serve, then retry.",
      );
    token = ((await response.json()) as { token: string }).token;
  }
  const response = await fetch("/api" + path, {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
  });
  if (response.status === 401 && attempt === 0) {
    token = "";
    return api<T>(path, body, 1);
  }
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(
      result.error ?? "The request failed. Check the local service and retry.",
    );
  return result;
}
