import type { Evidence, ProjectState } from "./index.js";
export type HistoryItem = {
  id: string;
  type: string;
  title: string;
  summary: string;
  occurredAt: string;
  source: string;
};
export type ProjectView = {
  id: string;
  name: string;
  path: string;
  branch: string;
  dirty: boolean;
  stage: string;
  stageConfidence: number;
  freshness: string;
  observedAt: string;
  generatedAt: string | null;
  analyzer: string;
  state: ProjectState;
  evidence: Evidence[];
  history: HistoryItem[];
};
