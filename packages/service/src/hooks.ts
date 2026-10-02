import { z } from "zod";
import { ProjectService } from "./index.js";
import { redact, hash } from "@project-memory/core";
const hookSchema = z.object({
  hook_event_name: z.string().max(100),
  session_id: z.string().min(1).max(200),
  cwd: z.string().min(1).max(4096),
  event_id: z.string().max(200).optional(),
  prompt: z.string().max(20000).optional(),
  last_assistant_message: z.string().max(20000).optional(),
  tool_name: z.string().max(200).optional(),
});
const events: Record<string, string> = {
  SessionStart: "session.started",
  UserPromptSubmit: "prompt.submitted",
  PostToolUse: "tool.observed",
  Stop: "session.stopped",
  SessionEnd: "session.ended",
  AgentResponse: "agent.responded",
};
export async function ingestHook(
  service: ProjectService,
  provider: "codex" | "claude" | "cursor",
  raw: unknown,
  captureMode: "minimal" | "standard" = "standard",
) {
  if (provider === "cursor") {
    const cursor = z
      .object({
        hook_event_name: z.string(),
        conversation_id: z.string(),
        generation_id: z.string().optional(),
        workspace_roots: z.array(z.string()).min(1).max(20),
        cwd: z.string().optional(),
        text: z.string().max(20000).optional(),
        prompt: z.string().max(20000).optional(),
        tool_name: z.string().max(200).optional(),
        tool_use_id: z.string().optional(),
      })
      .parse(raw);
    const names: Record<string, string> = {
      sessionStart: "SessionStart",
      sessionEnd: "SessionEnd",
      postToolUse: "PostToolUse",
      stop: "Stop",
      beforeSubmitPrompt: "UserPromptSubmit",
      afterAgentResponse: "AgentResponse",
    };
    if (!names[cursor.hook_event_name])
      return {
        status: "ignored",
        reason: "Unsupported Cursor event; thoughts are excluded",
      };
    if (!cursor.cwd && cursor.workspace_roots.length !== 1)
      return { status: "ignored", reason: "Ambiguous multi-root workspace" };
    raw = {
      hook_event_name: names[cursor.hook_event_name],
      session_id: cursor.conversation_id,
      cwd: cursor.cwd ?? cursor.workspace_roots[0],
      event_id: cursor.tool_use_id ?? cursor.generation_id,
      prompt: cursor.prompt,
      last_assistant_message: cursor.text,
      tool_name: cursor.tool_name,
    };
  }
  const input = hookSchema.parse(raw);
  const event = events[input.hook_event_name];
  if (!event)
    return {
      status: "ignored",
      reason: "Unsupported event for this adapter version",
    };
  const project = await service.register(input.cwd);
  const publicText =
    captureMode === "standard"
      ? event === "prompt.submitted"
        ? input.prompt
        : event === "session.stopped" || event === "agent.responded"
          ? input.last_assistant_message
          : undefined
      : undefined;
  const summary = redact(
    publicText ??
      `Observed ${event}${input.tool_name ? `: ${input.tool_name}` : ""}`,
  ).slice(0, 4000);
  const dedup = hash(
    JSON.stringify({
      provider,
      session: input.session_id,
      event,
      eventId: input.event_id ?? null,
      summary,
    }),
  );
  const recorded = service.store.record(project.id, {
    type: event,
    title: `${provider}: ${input.hook_event_name}`,
    summary,
    source: `${provider} hook adapter v1 (${captureMode})`,
    evidenceRefs: [],
    dedupKey: dedup,
  });
  return {
    status: recorded.inserted ? "recorded" : "duplicate",
    projectId: project.id,
    note: input.event_id
      ? "Event ID deduplication"
      : "Identical events in one session collapse when no event ID is supplied",
  };
}
