import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename } from "node:path";
import { analyzeProject } from "@repograph/core";
import { loadViewerTemplate, renderViewerHtml, toViewerData } from "./viewer.js";

export interface ServeOptions {
  entryPoints: string[];
}

/**
 * Build the request handler for `repograph serve`. Re-analyzes the project
 * on every request to `/`, so editing the repo and reloading the browser
 * shows the current graph — no separate watch/rebuild step needed.
 */
export function createRequestHandler(dir: string, options: ServeOptions) {
  const template = loadViewerTemplate();
  return function handle(req: IncomingMessage, res: ServerResponse): void {
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
  server.listen(port);
  return server;
}
