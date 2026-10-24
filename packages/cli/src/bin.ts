#!/usr/bin/env node
import { parseArgs, getStringFlag } from "./args.js";
import { dispatch, realIo, helpText, UsageError } from "./commands.js";
import { listenServer } from "./serve.js";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (args.command === "serve") {
    const dir = args.positionals[0];
    if (!dir) {
      realIo.stderr("Usage: repograph serve <dir> [--port 4173] [--entry a.ts,b.ts]");
      return 1;
    }
    const portFlag = getStringFlag(args, "--port");
    const port = portFlag ? Number(portFlag) : 4173;
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      realIo.stderr(`repograph: --port expects an integer between 0 and 65535, got ${JSON.stringify(portFlag)}`);
      return 1;
    }
    const host = getStringFlag(args, "--host") ?? "127.0.0.1";
    const entryFlag = getStringFlag(args, "--entry");
    const entryPoints = entryFlag ? entryFlag.split(",").map((s) => s.trim()).filter(Boolean) : [];
    try {
      // Await "listening" so a busy port is reported instead of crashing after
      // the "serving" banner was already printed.
      const server = await listenServer(resolve(dir), port, { entryPoints, host });
      const actual = (server.address() as AddressInfo).port;
      const shown = host.includes(":") ? `[${host}]` : host;
      realIo.stdout(`repograph serving ${resolve(dir)} at http://${shown}:${actual}`);
      if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
        realIo.stderr(`repograph: warning: bound to ${host}; anyone who can reach it can see this repo's file names and exports.`);
      }
      realIo.stdout("Press Ctrl+C to stop.");
    } catch (err) {
      realIo.stderr(`repograph: failed to start server: ${(err as Error).message}`);
      return 1;
    }
    return -1; // signal "keep running" to main()
  }

  return dispatch(argv, realIo);
}

main()
  .then((code) => {
    if (code >= 0) process.exitCode = code;
  })
  .catch((err) => {
    if (err instanceof UsageError) {
      realIo.stderr(err.message);
      process.exitCode = 1;
      return;
    }
    realIo.stderr(String(err instanceof Error ? (err.stack ?? err.message) : err));
    process.exitCode = 1;
  });

// keep `helpText` reachable for --help wiring in tests importing this module indirectly
export { helpText };
