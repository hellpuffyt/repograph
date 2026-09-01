import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cmdAnalyze, cmdBlast, cmdHtml, cmdReport, dispatch, helpText, type Io } from "../src/commands.js";
import { parseArgs } from "../src/args.js";
import { writeFixture } from "./fixture.js";

function collectIo(): { io: Io; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (l) => out.push(l), stderr: (l) => err.push(l) }, out, err };
}

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("cmdAnalyze", () => {
  it("prints JSON to stdout by default", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const { io, out } = collectIo();
    const code = cmdAnalyze(parseArgs(["analyze", fx.dir]), io);
    expect(code).toBe(0);
    const json = JSON.parse(out[0]!);
    expect(json.fileCount).toBe(1);
  });

  it("writes JSON to a file when --out is given", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const outFile = join(fx.dir, "out.json");
    const { io, out } = collectIo();
    cmdAnalyze(parseArgs(["analyze", fx.dir, "--out", outFile]), io);
    expect(existsSync(outFile)).toBe(true);
    expect(out[0]).toContain("Wrote analysis JSON");
    const json = JSON.parse(readFileSync(outFile, "utf8"));
    expect(json.fileCount).toBe(1);
  });

  it("throws a UsageError when no directory is given", () => {
    const { io } = collectIo();
    expect(() => cmdAnalyze(parseArgs(["analyze"]), io)).toThrow(/Usage: repograph analyze/);
  });

  it("respects --entry to exclude entry-point exports from dead-export detection", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const { io, out } = collectIo();
    cmdAnalyze(parseArgs(["analyze", fx.dir, "--entry", "a.ts"]), io);
    const json = JSON.parse(out[0]!);
    expect(json.deadExports).toEqual([]);
  });
});

describe("cmdReport", () => {
  it("returns exit code 0 when there are no cycles", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const { io } = collectIo();
    expect(cmdReport(parseArgs(["report", fx.dir]), io)).toBe(0);
  });

  it("returns exit code 1 when a cycle exists", () => {
    const fx = writeFixture({
      "a.ts": `import { b } from "./b";\nexport const a = b;`,
      "b.ts": `import { a } from "./a";\nexport const b = 1;`,
    });
    cleanup = fx.cleanup;
    const { io } = collectIo();
    expect(cmdReport(parseArgs(["report", fx.dir]), io)).toBe(1);
  });
});

describe("cmdBlast", () => {
  it("throws a UsageError when no file is given", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const { io } = collectIo();
    expect(() => cmdBlast(parseArgs(["blast", fx.dir]), io)).toThrow(/Usage: repograph blast/);
  });

  it("prints the blast radius for a real file", () => {
    const fx = writeFixture({
      "a.ts": `export const a = 1;`,
      "b.ts": `import { a } from "./a";\nexport const b = a;`,
    });
    cleanup = fx.cleanup;
    const { io, out } = collectIo();
    cmdBlast(parseArgs(["blast", fx.dir, "a.ts"]), io);
    expect(out[0]).toContain("b.ts");
  });
});

describe("cmdHtml", () => {
  it("writes a self-contained HTML file with the analysis embedded", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const outFile = join(fx.dir, "map.html");
    const { io, out } = collectIo();
    cmdHtml(parseArgs(["html", fx.dir, "--out", outFile]), io);
    expect(existsSync(outFile)).toBe(true);
    const html = readFileSync(outFile, "utf8");
    expect(html).toContain("window.__REPOGRAPH_DATA__");
    expect(out[0]).toContain("Wrote interactive graph");
  });

  it("defaults to repograph.html in the current directory", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const { io } = collectIo();
    const cwd = process.cwd();
    process.chdir(fx.dir);
    try {
      cmdHtml(parseArgs(["html", fx.dir]), io);
      expect(existsSync(join(fx.dir, "repograph.html"))).toBe(true);
    } finally {
      process.chdir(cwd);
      rmSync(join(fx.dir, "repograph.html"), { force: true });
    }
  });
});

describe("dispatch", () => {
  it("prints help text with no command", () => {
    const { io, out } = collectIo();
    expect(dispatch([], io)).toBe(0);
    expect(out[0]).toBe(helpText());
  });

  it("prints help text for --help", () => {
    const { io, out } = collectIo();
    expect(dispatch(["--help"], io)).toBe(0);
    expect(out[0]).toContain("repograph");
  });

  it("prints version for --version", () => {
    const { io, out } = collectIo();
    expect(dispatch(["--version"], io)).toBe(0);
    expect(out[0]).toBe("0.1.0");
  });

  it("returns 1 and reports unknown commands", () => {
    const { io, err } = collectIo();
    expect(dispatch(["frobnicate"], io)).toBe(1);
    expect(err[0]).toContain("Unknown command: frobnicate");
  });

  it("catches UsageError and returns 1 with the message on stderr", () => {
    const { io, err } = collectIo();
    expect(dispatch(["analyze"], io)).toBe(1);
    expect(err[0]).toContain("Usage: repograph analyze");
  });

  it("routes 'analyze' through to cmdAnalyze", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const { io, out } = collectIo();
    expect(dispatch(["analyze", fx.dir], io)).toBe(0);
    expect(JSON.parse(out[0]!).fileCount).toBe(1);
  });

  it("refuses to run 'serve' through dispatch (needs a live process)", () => {
    const { io, err } = collectIo();
    expect(dispatch(["serve", "./x"], io)).toBe(1);
    expect(err[0]).toContain("must be run from the CLI entrypoint");
  });
});
