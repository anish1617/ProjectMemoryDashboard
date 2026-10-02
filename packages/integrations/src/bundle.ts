import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  prepareInstall,
  applyInstall,
  prepareUninstall,
  applyUninstall,
  type Provider,
} from "./index.js";
import {
  prepareHookInstall,
  applyHookInstall,
  prepareHookUninstall,
  applyHookUninstall,
} from "./hooks.js";
async function targets(manifest: string) {
  const base = dirname(resolve(manifest));
  const content = await readFile(manifest, "utf8");
  if (Buffer.byteLength(content) > 20000)
    throw new Error("Integration manifest exceeds budget");
  const input = JSON.parse(content);
  const result: Array<{ provider: Provider; mcp: string; hooks: string }> = [];
  const paths = new Set<string>();
  for (const provider of ["codex", "claude", "cursor"] as const) {
    const row = input?.[provider];
    if (
      !row ||
      typeof row.mcp !== "string" ||
      typeof row.hooks !== "string" ||
      !row.mcp ||
      !row.hooks
    )
      throw new Error(
        "Manifest requires codex, claude and cursor entries with mcp and hooks paths",
      );
    const mcp = resolve(base, row.mcp),
      hooks = resolve(base, row.hooks);
    for (const path of [mcp, hooks]) {
      const key = process.platform === "win32" ? path.toLowerCase() : path;
      if (paths.has(key))
        throw new Error("Integration target paths must be distinct");
      paths.add(key);
    }
    result.push({ provider, mcp, hooks });
  }
  return result;
}
export async function prepareAllInstall(
  manifest: string,
  db: string,
  roots: string[],
  server: string,
  cli: string,
) {
  const plans = [];
  for (const target of await targets(manifest))
    plans.push({
      mcp: await prepareInstall(target.provider, target.mcp, db, roots, server),
      hooks: await prepareHookInstall(
        target.provider,
        target.hooks,
        db,
        roots,
        cli,
      ),
    });
  return {
    plans,
    preview: plans.flatMap((plan) => [plan.mcp.preview, plan.hooks.preview]),
  };
}
export async function applyAllInstall(
  bundle: Awaited<ReturnType<typeof prepareAllInstall>>,
) {
  const applied: Array<{ path: string; hooks: boolean }> = [];
  try {
    for (const plan of bundle.plans) {
      if (plan.mcp.changed) {
        await applyInstall(plan.mcp);
        applied.push({ path: plan.mcp.path, hooks: false });
      }
      if (plan.hooks.changed) {
        await applyHookInstall(plan.hooks);
        applied.push({ path: plan.hooks.path, hooks: true });
      }
    }
    return { status: "installed", changed: applied.length };
  } catch {
    let rollbackFailed = 0;
    for (const item of applied.reverse()) {
      try {
        if (item.hooks)
          await applyHookUninstall(await prepareHookUninstall(item.path));
        else await applyUninstall(await prepareUninstall(item.path));
      } catch {
        rollbackFailed++;
      }
    }
    throw new Error(
      rollbackFailed
        ? "Bundle failed; some rollback actions were refused. Inspect adjacent receipts/backups before retrying."
        : "Bundle failed; completed targets rolled back. Inspect the failed target and adjacent receipts/backups before retrying.",
    );
  }
}
export async function prepareAllUninstall(manifest: string) {
  const plans = [];
  for (const target of await targets(manifest))
    plans.push({
      mcp: await prepareUninstall(target.mcp),
      hooks: await prepareHookUninstall(target.hooks),
    });
  return {
    plans,
    preview: plans.flatMap((plan) => [plan.mcp.preview, plan.hooks.preview]),
  };
}
export async function applyAllUninstall(
  bundle: Awaited<ReturnType<typeof prepareAllUninstall>>,
) {
  // Per-file revision checks preserve later edits; backups remain available on failure.
  for (const plan of bundle.plans) {
    await applyHookUninstall(plan.hooks);
    await applyUninstall(plan.mcp);
  }
  return { status: "uninstalled", targets: bundle.plans.length * 2 };
}
