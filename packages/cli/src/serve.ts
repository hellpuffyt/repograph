import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename } from "node:path";
import { analyzeProject } from "@repograph/core";
import { loadViewerTemplate, renderViewerHtml, toViewerData } from "./viewer.js";

export interface ServeOptions {
  entryPoints: string[];
  /** Interface to bind. Default 127.0.0.1: the graph exposes the repo's file names and exports. */
  host?: string;
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * DNS-rebinding guard: a page on another origin can resolve its own name to
 * 127.0.0.1 and read this server, so only Host headers naming the loopback
 * interface (or the explicitly bound host) are answered.
 */
export function isAllowedHostHeader(hostHeader: string | undefined, boundHost: string): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.startsWith("[")
    ? hostHeader.slice(0, hostHeader.indexOf("]") + 1)
    : hostHeader.replace(/:\d+$/, "");
  const lower = hostname.toLowerCase();
  return LOOPBACK_HOSTNAMES.has(lower) || lower === boundHost.toLowerCase();
}

/**
 * Build the request handler for `repograph serve`. Re-analyzes the project
 * on every request to `/`, so editing the repo and reloading the browser
 * shows the current graph — no separate watch/rebuild step needed.
 */
export function createRequestHandler(dir: string, options: ServeOptions) {
  const template = loadViewerTemplate();
  const boundHost = options.host ?? "127.0.0.1";
  return function handle(req: IncomingMessage, res: ServerResponse): void {
    if (!isAllowedHostHeader(req.headers.host, boundHost)) {
      res.writeHead(421, { "content-type": "text/plain" });
      res.end("Misdirected request: unexpected Host header.");
      return;
    }
    if (req.url !== "/" && req.url !== "/index.html") {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found. repograph serve only serves the graph at /.");
      return;
    }
    try {
      const result = analyzeProject(dir, { entryPoints: options.entryPoints });
      const data = toViewerData(result, basename(dir));
      const html = renderViewerHtml(template, data);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`repograph: analysis failed: ${(err as Error).message}`);
    }
  };
}

export function startServer(dir: string, port: number, options: ServeOptions): Server {
  const server = createHttpServer(createRequestHandler(dir, options));
  server.listen(port, options.host ?? "127.0.0.1");
  return server;
}

/** Start the server and resolve once it is listening (rejects on e.g. EADDRINUSE). */
export function listenServer(dir: string, port: number, options: ServeOptions): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = startServer(dir, port, options);
    server.once("error", reject);
    server.once("listening", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}
