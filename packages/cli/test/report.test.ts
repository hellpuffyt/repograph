import { analyzeProject } from "@repograph/core";
import { afterEach, describe, expect, it } from "vitest";
import { formatBlastRadius, formatReport } from "../src/report.js";
import { blastRadiusForResult } from "../src/blast.js";
import { writeFixture } from "./fixture.js";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("formatReport", () => {
  it("summarizes files, cycles, dead exports and hubs", () => {
    const fx = writeFixture({
      "a.ts": `import { b } from "./b";\nexport const a = b;`,
      "b.ts": `import { a } from "./a";\nexport const b = 1;`,
      "c.ts": `export const unused = 1;`,
    });
    cleanup = fx.cleanup;
    const result = analyzeProject(fx.dir);
    const report = formatReport(result);
    expect(report).toContain("3 files");
    expect(report).toContain("Circular dependencies: 1");
    expect(report).toContain("a.ts -> b.ts -> a.ts");
    expect(report).toContain("Dead exports (never imported): 1");
    expect(report).toContain("c.ts:1 unused (const)");
  });

  it("reports zero cycles and zero dead exports cleanly", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const report = formatReport(analyzeProject(fx.dir));
    expect(report).toContain("Circular dependencies: 0");
    expect(report).toContain("Dead exports (never imported): 1"); // 'a' itself is unused
  });
});

describe("formatBlastRadius", () => {
  it("reports no dependents", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const result = analyzeProject(fx.dir);
    const radius = blastRadiusForResult(result, "a.ts", Infinity);
    expect(formatBlastRadius(radius)).toContain("Nothing in this repo depends on this file.");
  });

  it("reports affected files grouped by hop", () => {
    const fx = writeFixture({
      "a.ts": `export const a = 1;`,
      "b.ts": `import { a } from "./a";\nexport const b = a;`,
    });
    cleanup = fx.cleanup;
    const result = analyzeProject(fx.dir);
    const radius = blastRadiusForResult(result, "a.ts", Infinity);
    const text = formatBlastRadius(radius);
    expect(text).toContain("1 file affected across 1 hop");
    expect(text).toContain("hop 1:");
    expect(text).toContain("b.ts");
    expect(text).toContain("consumed: a");
  });

  it("accepts an absolute path and resolves it to the repo-relative key", () => {
    const fx = writeFixture({
      "a.ts": `export const a = 1;`,
      "b.ts": `import { a } from "./a";\nexport const b = a;`,
    });
    cleanup = fx.cleanup;
    const result = analyzeProject(fx.dir);
    const absolute = `${fx.dir}/a.ts`.replace(/\\/g, "/");
    const radius = blastRadiusForResult(result, absolute, Infinity);
    expect(radius.affected).toEqual(["b.ts"]);
  });
});
