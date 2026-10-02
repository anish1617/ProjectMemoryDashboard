import { ProjectService, WorkflowError } from "./index.js";
export const writeMethods = [
  "register",
  "refresh",
  "checkpoint",
  "decision",
  "saveState",
  "saveAnalysis",
  "setIdentity",
  "beginImport",
  "resumeImport",
  "importHistory",
  "recordHook",
] as const;
type Method = (typeof writeMethods)[number];
export type ServicePort = Omit<ProjectService, Method> & {
  [K in Method]: (
    ...args: Parameters<ProjectService[K]>
  ) => Promise<Awaited<ReturnType<ProjectService[K]>>>;
};
export function connectService(service: ProjectService): ServicePort {
  const methods = new Set<string>(writeMethods);
  return new Proxy(service, {
    get(target, property) {
      if (typeof property === "string" && methods.has(property))
        return async (...args: unknown[]) => {
          while (args.length && args.at(-1) === undefined) args.pop();
          const endpoint = target.store.daemonEndpoint();
          if (!endpoint) {
            if (target.store.hasDaemon())
              throw new WorkflowError(
                "Daemon endpoint unavailable; reconnect or restart the daemon",
              );
            const method = property as Method;
            return (target[method] as (...input: unknown[]) => unknown).apply(
              target,
              args,
            );
          }
          if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(endpoint.url))
            throw new WorkflowError(
              "Invalid daemon endpoint; refusing remote access",
            );
          const session = await fetch(endpoint.url + "/api/session", {
            headers: { "X-Project-Memory": "dashboard" },
            signal: AbortSignal.timeout(5000),
            redirect: "error",
          });
          const handshake = (await session.json()) as {
            token?: string;
            owner?: string;
          };
          if (
            !session.ok ||
            handshake.owner !== endpoint.owner ||
            !handshake.token
          )
            throw new WorkflowError(
              "Daemon identity changed; reconnect and retry",
            );
          const response = await fetch(endpoint.url + "/api/commands", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + handshake.token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ method: property, args }),
            signal: AbortSignal.timeout(120000),
            redirect: "error",
          });
          const result = (await response.json()) as {
            result?: unknown;
            error?: string;
          };
          if (!response.ok)
            throw new WorkflowError(
              "Daemon operation failed; check allowed roots, source, revision and ownership",
            );
          return result.result;
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as ServicePort;
}
