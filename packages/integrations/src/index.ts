import { readFile, writeFile, mkdir, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { parse, stringify } from "smol-toml";
import { hash } from "@project-memory/core";
export {
  prepareAllInstall,
  applyAllInstall,
  prepareAllUninstall,
  applyAllUninstall,
} from "./bundle.js";
export {
  hookCommand,
  prepareHookInstall,
  applyHookInstall,
  prepareHookUninstall,
  applyHookUninstall,
} from "./hooks.js";
export type Provider = "codex" | "claude" | "cursor";
type Config = Record<string, unknown>;
type Receipt = {
  provider: Provider;
  backup: string;
  originalHash: string;
  installedHash: string;
  server: Config;
};
const ownedKey = "project-memory";
async function read(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
}
function decode(text: string, provider: Provider): Config {
  const config = text.trim()
    ? provider === "codex"
      ? parse(text)
      : JSON.parse(text)
    : {};
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("Configuration must be an object");
  return config as Config;
}
const encode = (config: Config, provider: Provider) =>
  provider === "codex"
    ? stringify(config as Parameters<typeof stringify>[0])
    : JSON.stringify(config, null, 2) + "\n";
function servers(config: Config, provider: Provider): Config {
  const key = provider === "codex" ? "mcp_servers" : "mcpServers";
  const value = config[key];
  if (
    value !== undefined &&
    (!value || typeof value !== "object" || Array.isArray(value))
  )
    throw new Error("Existing MCP configuration is not an object");
  if (value === undefined) config[key] = {};
  return config[key] as Config;
}
export async function prepareInstall(
  provider: Provider,
  target: string,
  db: string,
  roots: string[],
  serverPath: string,
) {
  const path = resolve(target);
  const original = await read(path);
  const config = decode(original, provider);
  const server = {
    command: process.execPath,
    args: [
      resolve(serverPath),
      "--db",
      resolve(db),
      ...roots.flatMap((root) => ["--allow-root", resolve(root)]),
    ],
  };
  const entries = servers(config, provider);
  const existing = entries[ownedKey];
  if (existing && JSON.stringify(existing) !== JSON.stringify(server))
    throw new Error(
      "An existing project-memory server differs. Resolve it explicitly before installation.",
    );
  entries[ownedKey] = server;
  return {
    provider,
    path,
    original,
    updated: encode(config, provider),
    server,
    originalHash: hash(original),
    changed: !existing,
    preview: {
      provider,
      target: path,
      operation: existing ? "already installed" : "add owned MCP entry",
      server,
      formatNote:
        provider === "codex"
          ? "TOML values preserved; formatting/comments may change. Original bytes are backed up."
          : "Existing JSON values are preserved.",
    },
  };
}
export async function applyInstall(
  plan: Awaited<ReturnType<typeof prepareInstall>>,
) {
  if (!plan.changed) return { status: "already installed" };
  if (hash(await read(plan.path)) !== plan.originalHash)
    throw new Error("Configuration changed after preview; regenerate the plan");
  await mkdir(dirname(plan.path), { recursive: true });
  const backup =
    plan.path + ".project-memory-backup-" + plan.originalHash.slice(0, 16);
  try {
    await writeFile(backup, plan.original, { flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    if (hash(await read(backup)) !== plan.originalHash)
      throw new Error("Backup conflict");
  }
  await atomicWrite(plan.path, plan.updated);
  const receipt: Receipt = {
    provider: plan.provider,
    backup,
    originalHash: plan.originalHash,
    installedHash: hash(plan.updated),
    server: plan.server,
  };
  await atomicWrite(
    plan.path + ".project-memory-receipt.json",
    JSON.stringify(receipt, null, 2) + "\n",
  );
  return { status: "installed", backup, target: plan.path };
}
export async function prepareUninstall(target: string) {
  const path = resolve(target);
  const receipt = JSON.parse(
    await readFile(path + ".project-memory-receipt.json", "utf8"),
  ) as Receipt;
  if (!["codex", "claude", "cursor"].includes(receipt.provider))
    throw new Error("Invalid installation receipt");
  const original = await read(path);
  let updated: string;
  if (hash(original) === receipt.originalHash) updated = original;
  else if (hash(original) === receipt.installedHash) {
    const backup = await readFile(receipt.backup, "utf8");
    if (hash(backup) !== receipt.originalHash)
      throw new Error("Backup integrity failed");
    updated = backup;
  } else {
    const config = decode(original, receipt.provider);
    const entries = servers(config, receipt.provider);
    if (JSON.stringify(entries[ownedKey]) !== JSON.stringify(receipt.server))
      throw new Error(
        "Owned server entry changed; refusing to remove user changes",
      );
    delete entries[ownedKey];
    updated = encode(config, receipt.provider);
  }
  return {
    path,
    originalHash: hash(original),
    updated,
    preview: {
      target: path,
      operation:
        "remove only owned project-memory configuration; preserve other settings",
    },
  };
}
export async function applyUninstall(
  plan: Awaited<ReturnType<typeof prepareUninstall>>,
) {
  if (hash(await read(plan.path)) !== plan.originalHash)
    throw new Error("Configuration changed after preview");
  await atomicWrite(plan.path, plan.updated);
  return { status: "uninstalled", target: plan.path };
}
async function atomicWrite(path: string, text: string) {
  const temporary = path + ".project-memory-tmp-" + randomUUID();
  try {
    await writeFile(temporary, text, { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
