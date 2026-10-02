import { readFileSync, readdirSync } from "node:fs";
const allowed = {
  core: [],
  git: [],
  scanner: ["core", "git"],
  db: ["core"],
  runners: ["core"],
  cli: [
    "core",
    "db",
    "git",
    "scanner",
    "runners",
    "service",
    "api",
    "mcp-server",
    "integrations",
  ],
  integrations: ["core"],
  service: ["core", "db", "scanner"],
  api: ["core", "db", "service"],
  "mcp-server": ["core", "db", "service"],
};
for (const name of readdirSync("packages")) {
  const pkg = JSON.parse(readFileSync(`packages/${name}/package.json`, "utf8"));
  for (const dependency of Object.keys(pkg.dependencies ?? {})) {
    if (
      dependency.startsWith("@project-memory/") &&
      !allowed[name]?.includes(dependency.split("/")[1])
    )
      throw new Error(`Forbidden dependency: ${name} -> ${dependency}`);
  }
}
console.log("Package dependency boundaries passed");
