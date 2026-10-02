import { readFile, writeFile, mkdir, rename, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { hash } from "@project-memory/core";
import type { Provider } from "./index.js";
type Config = Record<string, unknown> & { hooks?: Record<string, unknown[]> };
type Receipt = {
  provider: Provider;
  backup: string;
  originalHash: string;
  installedHash: string;
  entries: Record<string, unknown>;
};
async function read(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
}
function decode(text: string): Config {
  const config = text.trim() ? JSON.parse(text) : {};
  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config) ||
    (config.hooks !== undefined &&
      (!config.hooks ||
        typeof config.hooks !== "object" ||
        Array.isArray(config.hooks)))
  )
    throw new Error("Hook configuration must contain an object");
  for (const entries of Object.values(config.hooks ?? {}))
    if (!Array.isArray(entries))
      throw new Error("Hook event entries must be arrays");
  return config;
}
export function hookCommand(args: string[], platform = process.platform) {
  if (platform === "win32") {
    const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
    const script =
      "$OutputEncoding=[Console]::InputEncoding=[Text.UTF8Encoding]::new($false); $taskInput=[Console]::In.ReadToEnd(); $taskInput | & " +
      args.map(quote).join(" ") +
      "; exit $LASTEXITCODE";
    const command =
      "powershell.exe -NoProfile -NonInteractive -EncodedCommand " +
      Buffer.from(script, "utf16le").toString("base64");
    if (command.length > 7000)
      throw new Error(
        "Hook command exceeds Windows budget; use fewer allowed roots",
      );
    return command;
  }
  return args.map((s) => "'" + s.replaceAll("'", "'\"'\"'") + "'").join(" ");
}
export async function prepareHookInstall(
  provider: Provider,
  target: string,
  db: string,
  roots: string[],
  cli: string,
  capture: "minimal" | "standard" = "minimal",
) {
  const path = resolve(target),
    original = await read(path),
    config = decode(original);
  const priorReceiptText = await read(
    path + ".project-memory-hooks-receipt.json",
  );
  const priorReceipt = priorReceiptText
    ? (JSON.parse(priorReceiptText) as Receipt)
    : undefined;
  if (provider === "cursor") {
    if (config.version !== undefined && config.version !== 1)
      throw new Error("Unsupported Cursor hook config version");
    config.version = 1;
  }
  const command = hookCommand([
    process.execPath,
    resolve(cli),
    "hook",
    "--provider",
    provider,
    "--db",
    resolve(db),
    "--capture",
    capture,
    "--quiet",
    ...roots.flatMap((root) => ["--allow-root", resolve(root)]),
  ]);
  const names =
    provider === "cursor"
      ? [
          "sessionStart",
          "sessionEnd",
          "postToolUse",
          "stop",
          ...(capture === "standard"
            ? ["beforeSubmitPrompt", "afterAgentResponse"]
            : []),
        ]
      : [
          "SessionStart",
          "SessionEnd",
          "PostToolUse",
          "Stop",
          ...(capture === "standard" ? ["UserPromptSubmit"] : []),
        ];
  const entries: Record<string, unknown> = {};
  config.hooks ??= {};
  let changed = false;
  for (const event of names) {
    const handler = {
      type: "command",
      command,
      timeout: event === "SessionEnd" ? 3 : 15,
    };
    const entry = provider === "cursor" ? handler : { hooks: [handler] };
    entries[event] = entry;
    const list = (config.hooks[event] ??= []);
    if (!list.some((item) => JSON.stringify(item) === JSON.stringify(entry))) {
      if (list.some((item) => JSON.stringify(item).includes(resolve(cli))))
        throw new Error(
          "Existing Project Memory hook differs; uninstall its owned configuration before changing bindings",
        );
      list.push(entry);
      changed = true;
    }
  }
  if (changed && priorReceipt && hash(original) !== priorReceipt.originalHash)
    throw new Error(
      "Existing hook installation differs; uninstall or resolve its owned configuration before reinstalling",
    );
  return {
    path,
    original,
    originalHash: hash(original),
    updated: JSON.stringify(config, null, 2) + "\n",
    provider,
    entries,
    changed,
    preview: {
      provider,
      target: path,
      capture,
      events: names,
      command,
      operation: changed
        ? "append owned hooks; preserve existing settings"
        : "already installed",
      note: "Codex hooks require host trust review; installation does not prove host execution.",
    },
  };
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
export async function applyHookInstall(
  plan: Awaited<ReturnType<typeof prepareHookInstall>>,
) {
  if (!plan.changed) return { status: "already installed" };
  if (hash(await read(plan.path)) !== plan.originalHash)
    throw new Error("Configuration changed after preview");
  await mkdir(dirname(plan.path), { recursive: true });
  const backup =
    plan.path +
    ".project-memory-hooks-backup-" +
    plan.originalHash.slice(0, 16);
  try {
    await writeFile(backup, plan.original, { flag: "wx" });
  } catch (e) {
    if (
      (e as NodeJS.ErrnoException).code !== "EEXIST" ||
      hash(await read(backup)) !== plan.originalHash
    )
      throw new Error("Hook backup conflict");
  }
  const receipt: Receipt = {
    provider: plan.provider,
    backup,
    originalHash: plan.originalHash,
    installedHash: hash(plan.updated),
    entries: plan.entries,
  };
  await atomicWrite(
    plan.path + ".project-memory-hooks-receipt.json",
    JSON.stringify(receipt),
  );
  await atomicWrite(plan.path, plan.updated);
  return { status: "installed", target: plan.path, backup };
}
export async function prepareHookUninstall(target: string) {
  const path = resolve(target),
    original = await read(path);
  const receipt = JSON.parse(
    await readFile(path + ".project-memory-hooks-receipt.json", "utf8"),
  ) as Receipt;
  if (
    !["codex", "claude", "cursor"].includes(receipt.provider) ||
    !receipt.entries ||
    typeof receipt.entries !== "object"
  )
    throw new Error("Invalid hook receipt");
  if (
    resolve(receipt.backup) !==
    path + ".project-memory-hooks-backup-" + receipt.originalHash.slice(0, 16)
  )
    throw new Error("Invalid hook backup path");
  let updated: string;
  if (hash(original) === receipt.originalHash) updated = original;
  else if (hash(original) === receipt.installedHash) {
    updated = await readFile(receipt.backup, "utf8");
    if (hash(updated) !== receipt.originalHash)
      throw new Error("Hook backup integrity failed");
  } else {
    const config = decode(original);
    for (const [event, owned] of Object.entries(receipt.entries)) {
      const list = config.hooks?.[event];
      const index =
        list?.findIndex(
          (entry) => JSON.stringify(entry) === JSON.stringify(owned),
        ) ?? -1;
      if (!list || index < 0)
        throw new Error("Owned hook changed; refusing to remove user changes");
      list.splice(index, 1);
    }
    updated = JSON.stringify(config, null, 2) + "\n";
  }
  return {
    path,
    updated,
    originalHash: hash(original),
    preview: {
      target: path,
      operation: "remove owned hooks; preserve other settings",
    },
  };
}
export async function applyHookUninstall(
  plan: Awaited<ReturnType<typeof prepareHookUninstall>>,
) {
  if (hash(await read(plan.path)) !== plan.originalHash)
    throw new Error("Configuration changed after preview");
  await atomicWrite(plan.path, plan.updated);
  return { status: "uninstalled", target: plan.path };
}
