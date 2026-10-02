import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join, resolve, relative, isAbsolute, extname } from "node:path";
import {
  ProjectService,
  writeMethods,
  checkpointSchema,
  decisionSchema,
} from "@project-memory/service";
import { stateSchema } from "@project-memory/core";
import { z } from "zod";
const pathSchema = z.strictObject({ path: z.string().min(1).max(4096) });
const rpcId = z.string().min(1).max(100),
  rpcPath = z.string().min(1).max(4096);
const rpcSchemas = {
  register: z.tuple([rpcPath]),
  refresh: z.tuple([rpcId]),
  checkpoint: z.tuple([rpcId, checkpointSchema]),
  decision: z.tuple([rpcId, decisionSchema]),
  saveState: z.tuple([rpcId, stateSchema, z.number().int()]),
  saveAnalysis: z.tuple([
    rpcId,
    stateSchema,
    z.number().int(),
    z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
  ]),
  setIdentity: z.tuple([rpcPath, rpcId.optional()]),
  beginImport: z.tuple([
    rpcId,
    rpcPath,
    z.enum(["generic", "codex", "claude"]),
  ]),
  resumeImport: z.tuple([rpcId, z.number().int().min(1).max(500).optional()]),
  importHistory: z.tuple([
    rpcId,
    rpcPath,
    z.enum(["generic", "codex", "claude"]),
  ]),
  recordHook: z.tuple([
    z.enum(["codex", "claude", "cursor"]),
    z.unknown(),
    z.enum(["minimal", "standard"]),
  ]),
};
const media: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};
export function createDashboardServer(
  service: ProjectService,
  staticRoot: string,
  owner?: string,
) {
  const token = randomBytes(32).toString("hex");
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    const port = (server.address() as { port: number } | null)?.port;
    const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    if (!hosts.has(req.headers.host ?? "")) {
      json(res, 403, { error: "Host not allowed" });
      return;
    }
    const origin = req.headers.origin;
    if (
      origin &&
      !new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]).has(
        origin,
      )
    ) {
      json(res, 403, { error: "Origin not allowed" });
      return;
    }
    if (req.headers["sec-fetch-site"] === "cross-site") {
      json(res, 403, { error: "Cross-site access is not allowed" });
      return;
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    try {
      if (url.pathname === "/api/session" && req.method === "GET") {
        if (req.headers["x-project-memory"] !== "dashboard") {
          json(res, 403, { error: "Dashboard handshake required" });
          return;
        }
        json(res, 200, { token, owner });
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        const supplied =
          req.headers.authorization?.replace(/^Bearer /, "") ?? "";
        if (
          supplied.length !== token.length ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
        ) {
          json(res, 401, { error: "Local session required" });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/commands") {
          if (!owner) {
            json(res, 409, { error: "Start daemon mode for proxied writes" });
            return;
          }
          const input = z
            .strictObject({
              method: z.enum(writeMethods),
              args: z.array(z.unknown()).max(5),
            })
            .parse(await body(req));
          const method = service[input.method] as (
            ...args: unknown[]
          ) => unknown;
          json(res, 200, {
            result: await method.apply(
              service,
              rpcSchemas[input.method].parse(input.args),
            ),
          });
          return;
        }
        if (req.method === "GET" && url.pathname === "/api/projects") {
          json(res, 200, { projects: service.store.listProjects() });
          return;
        }
        if (req.method === "GET" && url.pathname === "/api/settings") {
          json(res, 200, {
            allowedRoots: service.allowedRoots,
            captureMode: "minimal",
            telemetry: false,
          });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/projects") {
          const input = pathSchema.parse(await body(req));
          json(res, 201, await service.register(input.path));
          return;
        }
        const match =
          /^\/api\/projects\/([^/]+)(?:\/(refresh|checkpoints|decisions|history|search))?$/.exec(
            url.pathname,
          );
        if (match) {
          const id = match[1]!;
          const action = match[2];
          if (!service.store.project(id)) {
            json(res, 404, { error: "Project not found" });
            return;
          }
          if (req.method === "GET" && !action) {
            json(res, 200, service.store.view(id));
            return;
          }
          if (req.method === "POST" && action === "refresh") {
            await body(req);
            json(res, 200, await service.refresh(id));
            return;
          }
          if (req.method === "POST" && action === "checkpoints") {
            json(res, 201, service.checkpoint(id, await body(req)));
            return;
          }
          if (req.method === "POST" && action === "decisions") {
            json(res, 201, service.decision(id, await body(req)));
            return;
          }
          if (req.method === "GET" && action === "history") {
            json(res, 200, { items: service.store.history(id) });
            return;
          }
          if (req.method === "GET" && action === "search") {
            json(res, 200, {
              items: service.store.search(
                id,
                (url.searchParams.get("q") ?? "").slice(0, 500),
              ),
            });
            return;
          }
        }
        json(res, 404, { error: "Operation not found" });
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        json(res, 405, { error: "Method not allowed" });
        return;
      }
      let pathname: string;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        json(res, 400, { error: "Invalid URL" });
        return;
      }
      const root = await realpath(staticRoot);
      const target = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      const delta = relative(root, target);
      if (delta.startsWith("..") || isAbsolute(delta)) {
        json(res, 403, { error: "Path not allowed" });
        return;
      }
      const canonical = await realpath(target);
      const canonicalDelta = relative(root, canonical);
      if (canonicalDelta.startsWith("..") || isAbsolute(canonicalDelta)) {
        json(res, 403, { error: "Path not allowed" });
        return;
      }
      const content = await readFile(canonical);
      res.writeHead(200, {
        "Content-Type": media[extname(canonical)] ?? "application/octet-stream",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (error instanceof z.ZodError)
        json(res, 400, {
          error: "Invalid input. Check required fields and limits.",
        });
      else if ((error as NodeJS.ErrnoException).code === "ENOENT")
        json(res, 404, {
          error: "Repository or file not found. Check its path.",
        });
      else json(res, 400, { error: safeError(error) });
    }
  });
  return server;
}
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 20000) throw new Error("Request too large");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as unknown;
}
function safeError(error: unknown) {
  const message = (error as Error).message;
  return [
    "Repository is outside",
    "Project not found",
    "Unknown or cross-project",
    "Request too large",
    "A Git repository",
    "State revision changed",
  ].some((prefix) => message.startsWith(prefix))
    ? message
    : "Operation failed. Check the repository path and local service, then retry.";
}
