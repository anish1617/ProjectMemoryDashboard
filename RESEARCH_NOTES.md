# Research Notes — Verified Integration Basis (October 2026)

Review status (2026-10-02): primary pages were refreshed during implementation review; citations and capability limits are in `DOCUMENT_REVIEW.md`. Documentation verification does not prove installed hooks, transcript parser compatibility or authenticated runner operation. Pin dependency versions in the lockfile and recheck provider contracts when each adapter is built.

These are implementation references, not product requirements.

## Codex

OpenAI documents:

- Agent Skills as reusable `SKILL.md` workflows.
- MCP configuration in Codex.
- lifecycle hooks including SessionStart, UserPromptSubmit, PostToolUse, Stop and SessionEnd.
- non-interactive `codex exec`.
- JSONL event output via `codex exec --json`.
- structured final output using `--output-schema`.
- local session rollout JSONL used for replay/inspection.

References:

- https://developers.openai.com/codex/build-skills
- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/hooks
- https://developers.openai.com/codex/non-interactive-mode
- https://github.com/openai/codex

## Claude Code

Anthropic documents:

- lifecycle hooks;
- hook payloads with `session_id`, `cwd`, and `transcript_path`;
- Stop/SessionEnd behavior;
- `claude -p`;
- JSON output in print mode;
- resuming sessions and transcript JSONL paths.

References:

- https://docs.anthropic.com/en/docs/claude-code/hooks
- https://docs.anthropic.com/en/docs/claude-code/cli-reference

## Cursor

Cursor documents:

- project/user hooks;
- SessionStart/SessionEnd/tool/file events;
- transcript path when transcripts are enabled;
- local chat history;
- Markdown export;
- Agent CLI non-interactive mode and JSON output.

References:

- https://cursor.com/docs/hooks
- https://cursor.com/docs/cli/overview
- https://docs.cursor.com/en/agent/chat/history

## Warp

Warp documents:

- reusable Skills;
- global/project skill discovery;
- `.agents/skills` and compatibility paths;
- MCP servers.

References:

- https://docs.warp.dev/agents/capabilities/skills
- https://docs.warp.dev/knowledge-and-collaboration/warp-drive/ai-objects

## MCP

Use the official current TypeScript SDK and current MCP specification.

References:

- https://modelcontextprotocol.io/docs/2026-07-28/sdk
- https://ts.sdk.modelcontextprotocol.io/v2/
