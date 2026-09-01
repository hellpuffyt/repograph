import { afterEach, describe, expect, it } from "vitest";
import { buildGraph, parseProject } from "../src/graph.js";
import { writeFixture } from "./fixture.js";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("buildGraph", () => {
  it("wires dependsOn / dependedOnBy across resolved relative imports", () => {
    const fx = writeFixture({
      "src/a.ts": `import { b } from "./b";\nexport const a = b + 1;`,
      "src/b.ts": `export const b = 1;`,
    });
    cleanup = fx.cleanup;

    const parsed = parseProject(fx.dir);
    const graph = buildGraph(fx.dir, parsed);

    expect(graph.nodes.get("src/a.ts")?.dependsOn).toEqual(["src/b.ts"]);
    expect(graph.nodes.get("src/b.ts")?.dependedOnBy).toEqual(["src/a.ts"]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ from: "src/a.ts", to: "src/b.ts", importedNames: ["b"] });
  });

  it("merges multiple import statements between the same two files into one edge", () => {
    const fx = writeFixture({
      "src/a.ts": `import { b1 } from "./b";\nimport { b2 } from "./b";\nexport const a = b1 + b2;`,
      "src/b.ts": `export const b1 = 1;\nexport const b2 = 2;`,
    });
    cleanup = fx.cleanup;

    const graph = buildGraph(fx.dir, parseProject(fx.dir));
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]?.importedNames.sort()).toEqual(["b1", "b2"]);
  });

  it("classifies bare specifiers as external, not as broken internal edges", () => {
    const fx = writeFixture({
      "src/a.ts": `import { useState } from "react";\nexport const a = useState;`,
    });
    cleanup = fx.cleanup;

    const graph = buildGraph(fx.dir, parseProject(fx.dir));
    expect(graph.nodes.get("src/a.ts")?.dependsOn).toEqual([]);
    expect(graph.nodes.get("src/a.ts")?.externalImports).toEqual(["react"]);
    expect(graph.edges).toHaveLength(0);
  });

  it("drops relative imports that don't resolve to a known file instead of misreporting them", () => {
    const fx = writeFixture({
      "src/a.ts": `import { x } from "./does-not-exist";\nexport const a = x;`,
    });
    cleanup = fx.cleanup;

    const graph = buildGraph(fx.dir, parseProject(fx.dir));
    expect(graph.nodes.get("src/a.ts")?.dependsOn).toEqual([]);
    expect(graph.nodes.get("src/a.ts")?.externalImports).toEqual([]);
  });

  it("ignores self-imports", () => {
    const fx = writeFixture({
      "src/a.ts": `import { a } from "./a";\nexport const a = 1;`,
    });
    cleanup = fx.cleanup;

    const graph = buildGraph(fx.dir, parseProject(fx.dir));
    expect(graph.nodes.get("src/a.ts")?.dependsOn).toEqual([]);
  });

  it("resolves directory imports to their index file", () => {
    const fx = writeFixture({
      "src/a.ts": `import { util } from "./lib";\nexport const a = util;`,
      "src/lib/index.ts": `export const util = 1;`,
    });
    cleanup = fx.cleanup;

    const graph = buildGraph(fx.dir, parseProject(fx.dir));
    expect(graph.nodes.get("src/a.ts")?.dependsOn).toEqual(["src/lib/index.ts"]);
  });
});
