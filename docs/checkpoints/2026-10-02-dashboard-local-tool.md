# Dashboard and local tool verification

2026-10-02, Windows, Node24.16.0, pnpm11.15.0. No root Git repository/commit. Dashboard-first order and resume priority confirmed by user.

## Passing evidence

- `pnpm test`: 34 passed, one skipped, 35 total. Symlink test skipped for Windows EPERM. Includes real separate CLI processes, HTTP origin/token/path protection, official MCP client/stdio handshake and tools, revisions/immutable evidence, refresh-preserved explicit context, importer privacy/dedup, FTS literal queries, normalized hook fixtures and three-provider temporary configuration install/restore. Fake analyzer is contract proof only.
- `pnpm check`: strict builds plus package dependency checks passed. `pnpm format:check`: passed. All six skills passed skill-creator validation.
- Browser production service4319: sample search/filter/empty results; real fixture onboarding; explicit checkpoint/next action save; timeline; reload/refresh persistence; copied provenance/full references. Independent CLI resume reads same checkpoint from `.project-memory/dashboard.sqlite`.
- Desktop1440, mobile390 and dark screenshots: `.impeccable/review/{desktop,mobile,dark}.png`; live resume screenshot also saved. Mobile client/scroll width equal. Keyboard Enter activates filter; active states exposed.
- Impeccable detector ran once, no findings. Fresh default-role reviewer used because shipped role unavailable. Two material findings (muted text contrast and selected-control semantics) fixed in one batch. Verdict: ship **at that fix scope**, both resolved; not a certification of full V1 or assistive technology support. Muted/soft contrast4.60:1. Design documented by fresh default-role documenter fallback.
- `pm doctor` sees storage, built dashboard and Codex executable. No actual vendor config changed.

## Failed/open evidence

Real `pnpm run pm onboard '.project-memory/fixtures/Continuity Fixture' --agent codex --db .project-memory/analysis-verification.sqlite` attempted external analysis. Failed after one retry; deterministic baseline retained. No inference success or specific auth diagnosis established; raw stderr intentionally discarded. No actual user repository was sent.

Provider hook fixtures are normalized synthetic payloads. MCP transport test is real, vendor-host loading is unverified. Automatic history matching/resumable imports, watcher/daemon ownership, identity linking, DB restore/migration/performance gates and runner process isolation remain in the plan.

Graph generation2026-10-02T05:20:53Z returned only two nodes; relevant code paths not_tracked. Direct-source fallback used. No completeness claim.

## Local review

Running service: `pnpm serve --port 4319 --db .project-memory/dashboard.sqlite --allow-root D:/personal-project-2/ProjectsMemoryDashboard`. Use samples first, then local projects. CLI script requires `pnpm run pm` because `pnpm pm` collides with pnpm's own command. Setup and remaining gates: README.md, IMPLEMENTATION_PLAN.md, PROJECT_MEMORY.md.
