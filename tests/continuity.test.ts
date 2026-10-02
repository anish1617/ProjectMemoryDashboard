import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtemp,
  writeFile,
  mkdir,
  rename,
  rm,
  readFile,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Store } from "../packages/db/dist/index.js";
import { scanRepository } from "../packages/scanner/dist/index.js";
import {
  factualState,
  evidence,
  validateState,
  redact,
  type AnalysisRunner,
} from "../packages/core/dist/index.js";
import { capture, onboard, resume } from "../packages/cli/dist/service.js";
import { CodexRunner } from "../packages/runners/dist/index.js";

const exec = promisify(execFile);
const temporary: string[] = [];
const stores: Store[] = [];
afterEach(async () => {
  for (const store of stores.splice(0)) store.close();
  for (const dir of temporary.splice(0))
    await rm(dir, { recursive: true, force: true });
});
async function fixture(committed = true) {
  const dir = await mkdtemp(join(tmpdir(), "project-memory-test-"));
  temporary.push(dir);
  const repo = join(dir, "项目 café space");
  await mkdir(repo);
  const git = async (...args: string[]) =>
    (await exec("git", args, { cwd: repo, windowsHide: true })).stdout;
  await git("init");
  await git("config", "user.email", "fixture@example.invalid");
  await git("config", "user.name", "Fixture");
  await writeFile(join(repo, "README.md"), "# Example continuity fixture\n");
  await writeFile(join(repo, ".gitignore"), ".env\nignored.txt\n");
  if (committed) {
    await git("add", ".");
    await git("commit", "-m", "Initial fixture");
  }
  const store = new Store(join(dir, "memory.sqlite"));
  stores.push(store);
  return { dir, repo, git, store };
}
describe("deterministic repository continuity", () => {
  it("rejects non-Git directories without initializing the source", async () => {
    const f = await fixture();
    await expect(scanRepository(f.dir)).rejects.toThrow("Git repository");
  });
  it("captures clean state and persists a resume across database reopen", async () => {
    const f = await fixture();
    await onboard(f.store, f.repo);
    expect(await resume(f.store, f.repo)).toContain("worktree: clean");
    f.store.close();
    stores.splice(stores.indexOf(f.store), 1);
    const reopened = new Store(join(f.dir, "memory.sqlite"));
    stores.push(reopened);
    expect(await resume(reopened, f.repo)).toContain("needs_analysis");
    expect(reopened.counts().snapshots).toBe(1);
  });
  it("refreshes dirty Git state and marks persisted semantics stale", async () => {
    const f = await fixture();
    await onboard(f.store, f.repo);
    await writeFile(join(f.repo, "README.md"), "# Changed\n");
    const output = await resume(f.store, f.repo);
    expect(output).toContain("worktree: dirty");
    expect(output).toContain("stale_repository");
  });
  it("collects several commits without treating commit messages as feature verification", async () => {
    const f = await fixture();
    await writeFile(
      join(f.repo, "auth.ts"),
      "export const placeholder = true;",
    );
    await f.git("add", ".");
    await f.git("commit", "-m", "Complete auth flow");
    const bundle = await scanRepository(f.repo);
    expect(
      bundle.evidence.find((e) => e.source === "git:recent-commits")?.content,
    ).toContain("Complete auth flow");
    expect(factualState(bundle).implemented).toEqual([]);
  });
  it("retains project identity after moving a committed repository", async () => {
    const f = await fixture();
    const before = await capture(f.store, f.repo);
    const moved = join(f.dir, "moved");
    await rename(f.repo, moved);
    const after = await capture(f.store, moved);
    expect(after.projectId).toBe(before.projectId);
  });
  it("deduplicates repeated scans", async () => {
    const f = await fixture();
    await capture(f.store, f.repo);
    const before = f.store.counts();
    await capture(f.store, f.repo);
    expect(f.store.counts()).toEqual(before);
  });
  it("excludes ignored, secret, binary and tracked env files; redacts before persistence", async () => {
    const f = await fixture();
    await writeFile(join(f.repo, ".env"), "SECRET=never-store-env");
    await f.git("add", "-f", ".env");
    await writeFile(join(f.repo, "ignored.txt"), "never-store-ignored");
    await writeFile(join(f.repo, "binary.bin"), Buffer.from([1, 0, 255]));
    await writeFile(
      join(f.repo, "config.txt"),
      "api_key = test-secret-never-store",
    );
    const { bundle } = await capture(f.store, f.repo);
    const encoded = JSON.stringify(bundle);
    expect(encoded).not.toContain("never-store-env");
    expect(encoded).not.toContain("never-store-ignored");
    expect(encoded).not.toContain("test-secret-never-store");
    expect(bundle.evidence.some((e) => e.source === "binary.bin")).toBe(false);
    expect(encoded).toContain("[REDACTED]");
  });
  it("does not mutate source contents or git status", async () => {
    const f = await fixture();
    const before = await f.git("status", "--porcelain");
    const text = await readFile(join(f.repo, "README.md"), "utf8");
    await onboard(f.store, f.repo);
    await resume(f.store, f.repo);
    expect(await f.git("status", "--porcelain")).toBe(before);
    expect(await readFile(join(f.repo, "README.md"), "utf8")).toBe(text);
  });
  it("supports Unicode and Windows-style path separators", async () => {
    const f = await fixture();
    expect((await scanRepository(f.repo)).repository).toContain(
      "项目 café space",
    );
  });
  it("creates a useful baseline in an unborn repository", async () => {
    const f = await fixture(false);
    expect(await resume(f.store, f.repo)).toContain("HEAD: unborn");
  });
  it("retains unborn project registration after the first commit", async () => {
    const f = await fixture(false);
    const before = await capture(f.store, f.repo);
    await f.git("add", ".");
    await f.git("commit", "-m", "First commit");
    expect((await capture(f.store, f.repo)).projectId).toBe(before.projectId);
  });
  it("onboards and resumes from separate CLI processes using the same database", async () => {
    const f = await fixture();
    const cli = join(process.cwd(), "packages/cli/dist/index.js");
    const db = join(f.dir, "cli-memory.sqlite");
    await exec(process.execPath, [cli, "onboard", f.repo, "--db", db], {
      windowsHide: true,
    });
    const { stdout } = await exec(
      process.execPath,
      [cli, "resume", f.repo, "--db", db],
      { windowsHide: true },
    );
    expect(stdout).toContain("Project: 项目 café space");
    expect(stdout).toContain("Current Git:");
    expect(stdout).toContain("[verified]");
    expect(stdout).toContain("needs_analysis");
  });
  it("never follows a repository file symlink", async (context) => {
    const f = await fixture();
    await writeFile(join(f.dir, "outside.txt"), "outside-private-data");
    try {
      await symlink(join(f.dir, "outside.txt"), join(f.repo, "linked.txt"));
    } catch (error) {
      if (
        process.platform === "win32" &&
        (error as NodeJS.ErrnoException).code === "EPERM"
      ) {
        context.skip("Windows symlink privilege unavailable");
        return;
      }
      throw error;
    }
    expect(JSON.stringify(await scanRepository(f.repo))).not.toContain(
      "outside-private-data",
    );
  });
});
describe("analysis trust boundary", () => {
  it("rejects malformed analyzer output and retries once", async () => {
    const f = await fixture();
    let calls = 0;
    const runner: AnalysisRunner = {
      id: "fixture",
      isAvailable: async () => true,
      analyze: async () => {
        calls++;
        return { bad: "JSON" };
      },
    };
    const result = await onboard(f.store, f.repo, runner);
    expect(calls).toBe(2);
    expect(result.diagnostics.join()).toContain("failed");
    expect(f.store.counts().snapshots).toBe(1);
  });
  it("rejects unknown evidence IDs and invented file paths", async () => {
    const f = await fixture();
    const bundle = await scanRepository(f.repo);
    const state = factualState(bundle);
    state.purpose = [
      {
        text: "Some purpose",
        provenance: "inferred",
        confidence: 0.5,
        evidenceRefs: ["missing"],
      },
    ];
    expect(() => validateState(state, bundle)).toThrow("Unknown evidence");
    state.purpose = [];
    state.relevantFiles = [
      {
        path: "imaginary.ts",
        reason: "Fake",
        evidenceRefs: [bundle.evidence[0]!.id],
      },
    ];
    expect(() => validateState(state, bundle)).toThrow("Unobserved");
  });
  it("rejects transcript-only completion and fabricated verified claims", async () => {
    const f = await fixture();
    const bundle = await scanRepository(f.repo);
    const session = evidence(
      "session",
      "historical-session",
      "Authentication complete months ago",
    );
    bundle.evidence.push(session);
    const state = factualState(bundle);
    state.implemented = [
      {
        text: "Authentication works",
        provenance: "explicit",
        confidence: 1,
        evidenceRefs: [session.id],
      },
    ];
    expect(() => validateState(state, bundle)).toThrow("current file or test");
    state.implemented[0]!.provenance = "verified";
    state.implemented[0]!.evidenceRefs = [
      bundle.evidence.find((e) => e.type === "file")!.id,
    ];
    expect(() => validateState(state, bundle)).toThrow(
      "deterministic observation",
    );
  });
  it("preserves the previous semantic state after failure", async () => {
    const f = await fixture();
    await onboard(f.store, f.repo, {
      id: "fixture",
      isAvailable: async () => true,
      analyze: async ({ bundle }) => factualState(bundle),
    });
    const first = f.store.counts().snapshots;
    await onboard(f.store, f.repo, {
      id: "broken",
      isAvailable: async () => true,
      analyze: async () => {
        throw new Error("broken");
      },
    });
    expect(f.store.counts().snapshots).toBe(first);
  });
  it("degrades usefully when analyzer unavailable", async () => {
    const f = await fixture();
    const result = await onboard(f.store, f.repo, {
      id: "missing",
      isAvailable: async () => false,
      analyze: async () => {
        throw new Error("must not run");
      },
    });
    expect(result.diagnostics.join()).toContain("unavailable");
    expect(await resume(f.store, f.repo)).toContain("Current Git");
  });
  it("redacts common tokens and private keys", () => {
    expect(
      redact(
        "token: value123\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      ),
    ).not.toContain("value123");
  });
  it("runs a subprocess against redacted scratch input with the required CLI flags", async () => {
    const f = await fixture();
    const script = join(f.dir, "fake-codex.mjs");
    const coreUrl = pathToFileURL(
      join(process.cwd(), "packages/core/dist/index.js"),
    ).href;
    await writeFile(
      script,
      `import {writeFile, readFile} from 'node:fs/promises';
      import {factualState} from ${JSON.stringify(coreUrl)};
      const args = process.argv.slice(2);
      if (args.includes('--help')) {console.log('--sandbox --output-schema --output-last-message --ignore-user-config --ignore-rules --ephemeral'); process.exit(0);}
      if (args[args.indexOf('--sandbox')+1] !== 'read-only') process.exit(2);
      let input = ''; for await (const chunk of process.stdin) input += chunk;
      const {bundle} = JSON.parse(input.split('\\n').at(-1));
      if (process.cwd() === bundle.repository) process.exit(3);
      const schema = JSON.parse(await readFile(args[args.indexOf('--output-schema')+1], 'utf8'));
      if (!schema.properties.purpose) process.exit(4);
      await writeFile(args[args.indexOf('--output-last-message')+1], JSON.stringify(factualState(bundle)));`,
    );
    const runner = new CodexRunner(process.execPath, 10000, [script]);
    expect(await runner.isAvailable()).toBe(true);
    const result = await onboard(f.store, f.repo, runner);
    expect(result.diagnostics).toEqual([]);
    expect(await resume(f.store, f.repo)).toContain("Freshness: fresh");
  });
});
