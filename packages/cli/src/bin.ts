#!/usr/bin/env node
import { parseArgs, getStringFlag } from "./args.js";
import { dispatch, realIo, helpText, UsageError } from "./commands.js";
import { startServer } from "./serve.js";
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
    const entryFlag = getStringFlag(args, "--entry");
    const entryPoints = entryFlag ? entryFlag.split(",").map((s) => s.trim()).filter(Boolean) : [];
    try {
      startServer(resolve(dir), port, { entryPoints });
      realIo.stdout(`repograph serving ${resolve(dir)} at http://localhost:${port}`);
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
