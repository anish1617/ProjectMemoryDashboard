---
name: project-resume
description: Retrieve concise Project Memory context, refresh repository evidence, and explain where to continue.
---

Identify cwd, refresh Git using project_refresh_git, then fetch project_get_resume with maxTokens 1200. If stale, fetch a scoped delta/bundle and inspect current facts before interpretation. State where work stopped, changed evidence, blockers and 1–3 next actions. Retrieve evidence only for disputed or material claims. Do not change source unless the user asks to continue implementation. Missing history and runner failures do not prevent factual resume.
