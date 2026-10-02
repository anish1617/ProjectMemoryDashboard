import { createHash } from "node:crypto";
import { z } from "zod";
export type { ProjectView, HistoryItem } from "./views.js";

export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const sections = [
  "purpose",
  "architecture",
  "implemented",
  "inProgress",
  "blockers",
  "knownIssues",
  "decisions",
  "nextActions",
] as const;
const refs = z.array(z.string().min(1)).max(100);
export const claimSchema = z.strictObject({
  text: z.string().min(1).max(2000),
  provenance: z.enum(["verified", "explicit", "inferred", "recommended"]),
  confidence: z.number().min(0).max(1),
  evidenceRefs: refs,
});
export const stateSchema = z.strictObject({
  purpose: z.array(claimSchema).max(30),
  architecture: z.array(claimSchema).max(30),
  implemented: z.array(claimSchema).max(30),
  inProgress: z.array(claimSchema).max(30),
  blockers: z.array(claimSchema).max(30),
  knownIssues: z.array(claimSchema).max(30),
  decisions: z.array(claimSchema).max(30),
  nextActions: z.array(claimSchema).max(3),
  relevantFiles: z
    .array(
      z.strictObject({
        path: z.string(),
        reason: z.string().max(1000),
        evidenceRefs: refs,
      }),
    )
    .max(30),
  lifecycleStage: z.strictObject({
    value: z.enum([
      "idea",
      "planning",
      "building",
      "debugging",
      "paused",
      "mvp_ready",
      "shipped",
      "archived",
    ]),
    confidence: z.number().min(0).max(1),
    evidenceRefs: refs,
  }),
});
export type ProjectState = z.infer<typeof stateSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type Evidence = {
  id: string;
  type: "git" | "file" | "session" | "test" | "checkpoint" | "decision";
  source: string;
  content: string;
  factText: string | null;
};
export type EvidenceBundle = {
  repository: string;
  fingerprint: string;
  capturedAt: string;
  evidence: Evidence[];
  diagnostics: string[];
};
export type AnalysisInput = {
  bundle: EvidenceBundle;
  validationErrors: string[];
};
export interface AnalysisRunner {
  id: string;
  isAvailable(): Promise<boolean>;
  analyze(input: AnalysisInput): Promise<unknown>;
}

// Raw inputs are redacted BEFORE hashing, persistence and runner delivery.
export function redact(text: string): string {
  return text
    .replace(
      /-----BEGIN [^-]*(?:PRIVATE KEY)[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      "[REDACTED PRIVATE KEY]",
    )
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{16})\b/g,
      "[REDACTED TOKEN]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /((?:api[_-]?key|token|password|secret|authorization)\s*["']?\s*[:=]\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\r\n,}]+)/gi,
      (_match: string, prefix: string, value: string) => {
        const quote = value.startsWith('"')
          ? '"'
          : value.startsWith("'")
            ? "'"
            : "";
        const trailing =
          quote ||
          (value.trimEnd().endsWith('"')
            ? '"'
            : value.trimEnd().endsWith("'")
              ? "'"
              : "");
        return prefix + quote + "[REDACTED]" + trailing;
      },
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, "$1[REDACTED]@");
}
export function evidence(
  type: Evidence["type"],
  source: string,
  content: string,
  factText: string | null = null,
): Evidence {
  const safe = {
    type,
    source: redact(source),
    content: redact(content),
    factText: factText === null ? null : redact(factText),
  };
  return { id: hash(JSON.stringify(safe)), ...safe };
}
export function validateState(
  candidate: unknown,
  bundle: EvidenceBundle,
): ProjectState {
  const state = stateSchema.parse(candidate);
  const index = new Map(bundle.evidence.map((item) => [item.id, item]));
  function checkRefs(ids: string[]) {
    for (const id of ids)
      if (!index.has(id)) throw new Error(`Unknown evidence reference: ${id}`);
  }
  for (const section of sections)
    for (const claim of state[section]) {
      checkRefs(claim.evidenceRefs);
      claim.text = redact(claim.text);
      if (section === "nextActions" && claim.provenance !== "recommended")
        throw new Error("Next actions must be recommended");
      if (claim.provenance !== "recommended" && claim.evidenceRefs.length === 0)
        throw new Error("Factual claims require evidence");
      const supporting = claim.evidenceRefs.map((id) => index.get(id)!);
      if (
        claim.provenance === "verified" &&
        !supporting.some(
          (item) =>
            item.factText === claim.text &&
            ["git", "file", "test"].includes(item.type),
        )
      ) {
        throw new Error(
          "Verified claim must match a deterministic observation; file presence does not prove feature completion",
        );
      }
      if (
        claim.provenance === "explicit" &&
        !supporting.some((item) =>
          ["session", "checkpoint", "decision"].includes(item.type),
        )
      )
        throw new Error("Explicit claim needs explicit evidence");
      if (
        section === "implemented" &&
        !supporting.some((item) => ["file", "test"].includes(item.type))
      )
        throw new Error(
          "Implemented claim requires current file or test evidence, not historical intent",
        );
    }
  for (const file of state.relevantFiles) {
    checkRefs(file.evidenceRefs);
    if (
      !file.evidenceRefs.some(
        (id) =>
          index.get(id)?.type === "file" && index.get(id)?.source === file.path,
      )
    )
      throw new Error(`Unobserved relevant file: ${file.path}`);
    file.reason = redact(file.reason);
  }
  checkRefs(state.lifecycleStage.evidenceRefs);
  if (!state.lifecycleStage.evidenceRefs.length)
    throw new Error("Stage requires evidence");
  return state;
}
export function factualState(bundle: EvidenceBundle): ProjectState {
  const claims = bundle.evidence
    .filter((item) => item.factText !== null)
    .slice(0, 30)
    .map((item) => ({
      text: item.factText!,
      provenance: "verified" as const,
      confidence: 1,
      evidenceRefs: [item.id],
    }));
  return {
    purpose: [],
    architecture: claims,
    implemented: [],
    inProgress: [],
    blockers: [],
    knownIssues: [],
    decisions: [],
    nextActions: [
      {
        text: "Review current repository evidence and establish a semantic checkpoint.",
        provenance: "recommended",
        confidence: 1,
        evidenceRefs: [],
      },
    ],
    relevantFiles: bundle.evidence
      .filter((item) => item.type === "file")
      .slice(0, 10)
      .map((item) => ({
        path: item.source,
        reason: "Observed repository file",
        evidenceRefs: [item.id],
      })),
    lifecycleStage: {
      value: "planning",
      confidence: 0,
      evidenceRefs: [bundle.evidence[0]!.id],
    },
  };
}
export const stateJsonSchema = z.toJSONSchema(stateSchema);
