import { basename } from "node:path";
import { Store, bundleDigest } from "@project-memory/db";
import { scanRepository } from "@project-memory/scanner";
import { ProjectService, connectService } from "@project-memory/service";
import { AnalyzerError } from "@project-memory/runners";
import {
  factualState,
  sections,
  validateState,
  type AnalysisRunner,
  type EvidenceBundle,
  type ProjectState,
} from "@project-memory/core";

export async function capture(store: Store, path: string) {
  const project = await connectService(
    new ProjectService(store, [path]),
  ).register(path);
  const projectId = project.id;
  const bundle = store.latestBundle(projectId)!;
  return { projectId, bundle };
}
export async function onboard(
  store: Store,
  path: string,
  runner?: AnalysisRunner,
) {
  const { projectId, bundle } = await capture(store, path);
  const diagnostics = [...bundle.diagnostics];
  const expectedSnapshotId = store.latestState(projectId)!.id;
  if (runner && (await runner.isAvailable())) {
    let errors: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const candidate = await runner.analyze({
          bundle,
          validationErrors: errors,
        });
        const state = validateState(candidate, bundle);
        await connectService(new ProjectService(store, [path])).saveAnalysis(
          projectId,
          state,
          expectedSnapshotId,
          runner.id,
        );
        return { projectId, bundle, state, diagnostics };
      } catch (error) {
        if (error instanceof AnalyzerError) diagnostics.push(error.message);
        // Do not log malformed output or stderr: these may contain secrets or reasoning.
        errors = [
          "Previous analysis failed schema/evidence validation or execution. Use only supplied evidence and exact factText for verified claims.",
        ];
      }
    }
    diagnostics.push(
      "Analysis failed after one retry; previous valid state retained",
    );
  } else if (runner)
    diagnostics.push("Analyzer unavailable; deterministic evidence retained");
  let previous = store.latestState(projectId);
  if (!previous) {
    store.saveState(projectId, factualState(bundle), "deterministic", bundle);
    previous = store.latestState(projectId);
  }
  return { projectId, bundle, state: previous!.state, diagnostics };
}
export async function resume(store: Store, path: string) {
  const { projectId, bundle } = await capture(store, path);
  const snapshot = store.latestState(projectId);
  if (!snapshot)
    store.saveState(projectId, factualState(bundle), "deterministic", bundle);
  const latest = store.latestState(projectId)!;
  const freshness = store.view(projectId)!.freshness;
  return render(
    bundle,
    latest.state,
    freshness,
    latest.analyzer,
    latest.generatedAt,
  );
}
function render(
  bundle: EvidenceBundle,
  state: ProjectState,
  freshness: string,
  analyzer: string,
  generatedAt: string,
) {
  const lines = [
    `Project: ${basename(bundle.repository)}`,
    `Stage: ${state.lifecycleStage.value} (confidence ${state.lifecycleStage.confidence}; derived)`,
    `Freshness: ${freshness}`,
    `Analyzer: ${analyzer}; generated: ${generatedAt}`,
    "",
    `Current Git: ${bundle.evidence.find((item) => item.source === "git:current")?.factText ?? "unknown"}`,
  ];
  let budget = 5000;
  for (const section of sections) {
    const claims = state[section];
    if (!claims.length) continue;
    lines.push("", section + ":");
    for (const claim of claims) {
      const line = `- [${claim.provenance}] ${claim.text} (evidence: ${claim.evidenceRefs.map((ref) => ref.slice(0, 12)).join(", ") || "none"})`;
      if (line.length > budget) {
        lines.push("- Additional claims omitted to keep resume concise.");
        break;
      }
      lines.push(line);
      budget -= line.length;
    }
  }
  lines.push(
    "",
    `Coverage: repository/Git${bundle.evidence.some((item) => item.type === "session") ? "; public agent history imported" : "; agent history not imported"}. ${bundle.diagnostics.join("; ")}`,
    "Evidence IDs are abbreviated for display; full references are persisted in SQLite.",
  );
  return lines.join("\n");
}
