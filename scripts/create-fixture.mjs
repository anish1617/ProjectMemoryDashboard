import { mkdir, writeFile, access, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const root = resolve(".project-memory/fixtures/Continuity Fixture");
let exists = false;
try {
  await access(root);
  exists = true;
} catch {}
if (exists) {
  await access(join(root, ".git"));
  console.log(`Existing disposable fixture: ${root}`);
} else {
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "README.md"),
    "# Continuity Fixture\n\nDisposable repository for verifying Project Memory onboarding, refresh, checkpoints, MCP and the dashboard. This is a test fixture, not a user project.\n",
  );
  await writeFile(
    join(root, "src", "notes.ts"),
    "export const notes: string[] = [];\n",
  );
  for (const args of [
    ["-c", "init.defaultBranch=main", "init"],
    ["config", "user.name", "Project Memory Fixture"],
    ["config", "user.email", "fixture@example.invalid"],
    ["add", "."],
    ["commit", "-m", "Create disposable continuity fixture"],
  ])
    await exec("git", args, { cwd: root, windowsHide: true });
  console.log(`Created disposable fixture: ${await realpath(root)}`);
}
