import { afterEach, describe, expect, it } from "vitest";
import { analyzeProject } from "../src/analyze.js";
import { serializeAnalysis } from "../src/serialize.js";
import { computeBlastRadius } from "../src/blastRadius.js";
import { writeFixture } from "./fixture.js";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("analyzeProject (integration)", () => {
  it("wires cycle detection and dead-export detection off one real file tree", () => {
    const fx = writeFixture({
      "src/index.ts": `export { start } from "./app";`,
      "src/app.ts": `import { helper } from "./helper";\nexport function start() { return helper(); }`,
      "src/helper.ts": `import type { Unused } from "./types";\nexport function helper() { return 1; }\nexport function orphan() { return 2; }`,
      "src/types.ts": `export type Unused = string;\nexport type AlsoUnused = number;`,
      "src/cycleA.ts": `import { b } from "./cycleB";\nexport function a() { return b(); }`,
      "src/cycleB.ts": `import { a } from "./cycleA";\nexport function b() { return 1; }`,
    });
    cleanup = fx.cleanup;

    const result = analyzeProject(fx.dir, { entryPoints: ["src/index.ts"] });

    expect(result.fileCount).toBe(6);
    expect(result.cycles).toHaveLength(1);
    expect(result.cycles[0]?.files).toEqual(["src/cycleA.ts", "src/cycleB.ts"]);

    const deadNames = result.deadExports.map((d) => `${d.path}:${d.export.name}`);
    expect(deadNames).toContain("src/helper.ts:orphan");
    expect(deadNames).toContain("src/types.ts:AlsoUnused");
    // Unused is imported (type-only) by helper.ts, so it's used, not dead.
    expect(deadNames).not.toContain("src/types.ts:Unused");
    // start is re-exported from the declared entry point, never flagged.
    expect(deadNames.some((n) => n.endsWith(":start"))).toBe(false);
  });

  it("computes blast radius from an analyzed graph", () => {
    const fx = writeFixture({
      "src/core.ts": `export function core() { return 1; }`,
      "src/mid.ts": `import { core } from "./core";\nexport function mid() { return core(); }`,
      "src/top.ts": `import { mid } from "./mid";\nexport function top() { return mid(); }`,
    });
    cleanup = fx.cleanup;

    const result = analyzeProject(fx.dir);
    const radius = computeBlastRadius(result.graph, "src/core.ts");
    expect(radius.levels).toEqual([["src/mid.ts"], ["src/top.ts"]]);
    expect(radius.consumedExports).toEqual(["core"]);
  });

  it("serializes to a JSON-safe plain object", () => {
    const fx = writeFixture({ "src/a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;

    const result = analyzeProject(fx.dir);
    const serialized = serializeAnalysis(result);
    expect(() => JSON.stringify(serialized)).not.toThrow();
    expect(serialized.nodes.map((n) => n.path)).toEqual(["src/a.ts"]);
    expect(serialized.fileCount).toBe(1);
    expect(serialized.edgeCount).toBe(0);
  });

  it("handles an empty project directory", () => {
    const fx = writeFixture({});
    cleanup = fx.cleanup;
    const result = analyzeProject(fx.dir);
    expect(result.fileCount).toBe(0);
    expect(result.cycles).toEqual([]);
    expect(result.deadExports).toEqual([]);
  });
});
