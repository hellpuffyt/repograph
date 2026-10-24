import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { isAllowedHostHeader, listenServer } from "../src/serve.js";
import { writeFixture } from "./fixture.js";

let cleanup: (() => void) | undefined;
const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  cleanup?.();
  cleanup = undefined;
});

function get(port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path: "/", headers: { host } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });
}

describe("repograph serve hardening", () => {
  it("binds to the loopback interface by default", async () => {
    const fx = writeFixture({ "a.ts": "export const a = 1;" });
    cleanup = fx.cleanup;
    const server = await listenServer(fx.dir, 0, { entryPoints: [] });
    servers.push(server);
    expect((server.address() as AddressInfo).address).toBe("127.0.0.1");
  });

  it("refuses requests whose Host header is not loopback (DNS rebinding)", async () => {
    const fx = writeFixture({ "a.ts": "export const a = 1;" });
    cleanup = fx.cleanup;
    const server = await listenServer(fx.dir, 0, { entryPoints: [] });
    servers.push(server);
    const { port } = server.address() as AddressInfo;
    expect(await get(port, "evil.example")).toBe(421);
    expect(await get(port, `localhost:${port}`)).toBe(200);
    expect(await get(port, `127.0.0.1:${port}`)).toBe(200);
  });

  it("rejects (instead of crashing later) when the port is already in use", async () => {
    const fx = writeFixture({ "a.ts": "export const a = 1;" });
    cleanup = fx.cleanup;
    const first = await listenServer(fx.dir, 0, { entryPoints: [] });
    servers.push(first);
    const { port } = first.address() as AddressInfo;
    await expect(listenServer(fx.dir, port, { entryPoints: [] })).rejects.toMatchObject({ code: "EADDRINUSE" });
  });

  it("classifies Host headers", () => {
    expect(isAllowedHostHeader("localhost:4173", "127.0.0.1")).toBe(true);
    expect(isAllowedHostHeader("[::1]:4173", "127.0.0.1")).toBe(true);
    expect(isAllowedHostHeader("my-box.lan:4173", "my-box.lan")).toBe(true);
    expect(isAllowedHostHeader("127.0.0.1.evil.example", "127.0.0.1")).toBe(false);
    expect(isAllowedHostHeader(undefined, "127.0.0.1")).toBe(false);
  });
});
