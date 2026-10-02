# Codex Build Brief — Initial Vertical Slice

Implementation clarification (2026-10-02): `DOCUMENT_REVIEW.md` records adopted refinements; `IMPLEMENTATION_PLAN.md` separates repository-only Phase 2A from history Phase 2B. Zod owns the JSON Schema. Verified claims must match deterministic observations, not merely cite an existing evidence ID. Default onboarding remains local/deterministic; `--agent codex` opts into runner synthesis. Authenticated runner execution is an explicit acceptance gate distinct from fixture tests.

Use this after the repository has been created.

## Objective

Implement the first end-to-end vertical slice of Project Memory:

> Existing Git repository → deterministic evidence scan → read-only analyzer → validated Project State → persisted SQLite snapshot → concise resume output.

Continuation revision (2026-10-02): the user authorized dashboard-first development followed by the local tool and gradual project validation. The dashboard restriction is superseded; `IMPLEMENTATION_PLAN.md` records current scope and remaining gates. Embeddings, cloud sync and orchestration remain deferred. The initial slice above remains a tested foundation, not the entire current milestone.

## Required reading

Read, in order:

1. `PRD.md`
2. `ARCHITECTURE.md`
3. `DATA_MODEL.md`
4. `EXISTING_PROJECT_IMPORT.md`
5. `MCP_AND_SKILLS_SPEC.md`
6. `IMPLEMENTATION_PLAN.md`

## Engineering constraints

- TypeScript strict mode.
- pnpm monorepo.
- SQLite.
- Drizzle ORM.
- Zod.
- Domain code must not depend on Codex-specific code.
- Analyzer runners are adapters behind an interface.
- Repository analysis is read-only.
- Raw evidence is immutable.
- Derived state is immutable by snapshot.
- No vector database.
- No cloud service.
- No API key requirement.
- No source code sent anywhere except through the explicitly selected analysis runner.
- Ignore secrets and `.env`-like files.
- Do not capture hidden reasoning.

## First packages

Create:

```text
packages/core
packages/db
packages/git
packages/scanner
packages/runners
packages/cli
schemas
```

## First commands

Implement:

```bash
project-memory init
project-memory add .
project-memory scan .
project-memory onboard . --agent codex
project-memory resume .
```

## Analyzer

Create:

```ts
interface AnalysisRunner {
  id: string;
  isAvailable(): Promise<boolean>;
  analyze(input: AnalysisInput): Promise<ProjectStateCandidate>;
}
```

First adapter: Codex.

Run Codex in read-only non-interactive mode and require the supplied JSON schema.

The runner must be replaceable without changing core domain logic.

## Important validation behavior

Reject or downgrade claims when:

- a `verified` claim has no evidence;
- evidence reference does not exist;
- output schema is invalid;
- analyzer states a file/commit exists when it does not;
- analyzer claims something is complete based only on old conversation text.

On analyzer failure, preserve deterministic evidence and return a useful partial result.

## Tests

At minimum:

1. repository without Git;
2. clean Git repository;
3. dirty Git repository;
4. repository with several commits;
5. moved repository path;
6. repeated scan idempotency;
7. secret exclusion;
8. malformed analyzer JSON;
9. unknown evidence reference;
10. stale transcript contradicting current Git state;
11. analyzer unavailable;
12. Unicode/Windows paths.

## Definition of done

This milestone is complete only when a fixture project can be onboarded and then:

```bash
project-memory resume ./fixture
```

produces an evidence-backed continuation summary from persisted state.
