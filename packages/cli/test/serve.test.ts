import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createRequestHandler, startServer } from "../src/serve.js";
import { writeFixture } from "./fixture.js";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function withServer(dir: string, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(createRequestHandler(dir, { entryPoints: [] }));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("createRequestHandler", () => {
  it("serves the viewer with injected analysis data at /", async () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    await withServer(fx.dir, async (base) => {
      const res = await fetch(`${base}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const body = await res.text();
      expect(body).toContain("window.__REPOGRAPH_DATA__");
      expect(body).toContain('"fileCount":1');
    });
  });

  it("returns 404 for any other path", async () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    await withServer(fx.dir, async (base) => {
      const res = await fetch(`${base}/nope`);
      expect(res.status).toBe(404);
    });
  });

  it("re-analyzes on every request, reflecting file changes without a restart", async () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    await withServer(fx.dir, async (base) => {
      const first = await (await fetch(`${base}/`)).text();
      expect(first).toContain('"fileCount":1');

      writeFileSync(join(fx.dir, "b.ts"), "export const b = 2;");

      const second = await (await fetch(`${base}/`)).text();
      expect(second).toContain('"fileCount":2');
    });
  });
});

describe("startServer", () => {
  it("starts listening and serves the graph", async () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const server = startServer(fx.dir, 0, { entryPoints: [] });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
