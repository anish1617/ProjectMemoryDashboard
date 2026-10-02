import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
const exec = promisify(execFile);
export async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec(
    "git",
    ["-c", "core.quotepath=false", ...args],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 15000,
      windowsHide: true,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    },
  );
  return stdout;
}
export type GitState = {
  root: string;
  commonDir: string;
  branch: string;
  head: string | null;
  rootCommits: string[];
  status: string;
  commits: string;
  files: string[];
};
export async function collectGit(path: string): Promise<GitState> {
  let root: string;
  try {
    root = await realpath(
      (await git(path, ["rev-parse", "--show-toplevel"])).trim(),
    );
  } catch {
    throw new Error(
      "A Git repository is required; target repository was not modified",
    );
  }
  const optional = async (args: string[]) => {
    try {
      return (await git(root, args)).trim();
    } catch {
      return "";
    }
  };
  const head = await optional(["rev-parse", "--verify", "HEAD"]);
  const [branch, commonDir, status, commits, roots, files] = await Promise.all([
    optional(["symbolic-ref", "--short", "HEAD"]),
    optional(["rev-parse", "--path-format=absolute", "--git-common-dir"]),
    git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    head
      ? git(root, ["log", "-20", "--format=%H %cI %s"])
      : Promise.resolve(""),
    head
      ? git(root, ["rev-list", "--max-parents=0", "HEAD"])
      : Promise.resolve(""),
    git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]),
  ]);
  return {
    root,
    commonDir,
    branch: branch || "(detached)",
    head: head || null,
    rootCommits: roots.trim().split(/\r?\n/).filter(Boolean).sort(),
    status,
    commits,
    files: [...new Set(files.split("\0").filter(Boolean))].sort(),
  };
}
