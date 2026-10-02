import { readFile, lstat } from "node:fs/promises";
import { join, relative, resolve, isAbsolute } from "node:path";
import { collectGit } from "@project-memory/git";
import { evidence, hash, type EvidenceBundle } from "@project-memory/core";

export const excluded = (path: string) =>
  /(^|\/)(?:\.env[^/]*|\.git|node_modules|dist|coverage|\.project-memory|\.ssh|\.aws|\.azure)(\/|$)/i.test(
    path,
  ) ||
  /(?:credentials|secrets?|id_rsa|id_ed25519|\.pem$|\.key$|\.p12$|\.sqlite(?:-[a-z]+)?$)/i.test(
    path,
  );
export async function scanRepository(path: string): Promise<EvidenceBundle> {
  const git = await collectGit(path);
  // Worktrees share commonDir; moved clones with history retain the root-commit fingerprint.
  // Independent forks sharing ancestry intentionally require manual separation in a later phase.
  const fingerprint = git.rootCommits.length
    ? `history:${hash(git.rootCommits.join(","))}`
    : `unborn:${hash(git.commonDir)}`;
  const items = [
    evidence(
      "git",
      "git:current",
      JSON.stringify({
        branch: git.branch,
        head: git.head,
        dirty: git.status.length > 0,
      }),
      `Git branch: ${git.branch}; HEAD: ${git.head ?? "unborn"}; worktree: ${git.status ? "dirty" : "clean"}.`,
    ),
  ];
  items.push(evidence("git", "git:recent-commits", git.commits));
  // Only safe path metadata is captured; never include raw diff or excluded filenames.
  const diagnostics: string[] = [];
  let bytes = 0;
  const candidates = git.files
    .filter((path) => !excluded(path.replaceAll("\\", "/")))
    .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
  for (const path of candidates.slice(0, 500)) {
    const absolute = resolve(git.root, path);
    const inside = relative(git.root, absolute);
    if (inside.startsWith("..") || isAbsolute(inside)) continue;
    // Refuse symlinks at every component, including intermediate directories.
    let safe = true;
    let cursor = git.root;
    try {
      for (const part of inside.split(/[\\/]/)) {
        cursor = join(cursor, part);
        if ((await lstat(cursor)).isSymbolicLink()) {
          safe = false;
          break;
        }
      }
      if (!safe) continue;
      const stat = await lstat(absolute);
      if (!stat.isFile() || stat.size > 64000 || bytes + stat.size > 256000) {
        diagnostics.push("File omitted by size or bundle budget");
        continue;
      }
      const content = await readFile(absolute);
      if (content.includes(0)) continue;
      const text = new TextDecoder("utf-8", { fatal: true }).decode(content);
      items.push(
        evidence(
          "file",
          path.replaceAll("\\", "/"),
          text,
          `Repository file observed: ${path.replaceAll("\\", "/")}.`,
        ),
      );
      bytes += content.length;
    } catch {
      diagnostics.push("File unreadable, deleted or non-UTF8");
    }
  }
  if (candidates.length > 500)
    diagnostics.push("File count budget reached; coverage is partial");
  return {
    repository: git.root,
    fingerprint,
    capturedAt: new Date().toISOString(),
    evidence: items,
    diagnostics: [...new Set(diagnostics)],
  };
}
function priority(path: string) {
  return /(?:^|\/)(?:AGENTS\.md|README[^/]*|package\.json|[^/]*\.csproj|pyproject\.toml|Cargo\.toml|ARCHITECTURE\.md)$/i.test(
    path,
  )
    ? 0
    : 1;
}
