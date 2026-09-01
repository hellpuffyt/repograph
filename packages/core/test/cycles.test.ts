import { describe, expect, it } from "vitest";
import { findCycles } from "../src/cycles.js";
import type { GraphNode, ModuleGraph } from "../src/types.js";

function makeGraph(adjacency: Record<string, string[]>): ModuleGraph {
  const nodes = new Map<string, GraphNode>();
  for (const [path, deps] of Object.entries(adjacency)) {
    nodes.set(path, {
      path,
      exports: [],
      dependsOn: deps,
      dependedOnBy: [],
      externalImports: [],
      lineCount: 1,
    });
  }
  return { rootDir: "/repo", nodes, edges: [] };
}

describe("findCycles", () => {
  it("finds no cycles in a DAG", () => {
    const graph = makeGraph({ a: ["b"], b: ["c"], c: [] });
    expect(findCycles(graph)).toEqual([]);
  });

  it("finds a direct two-file cycle", () => {
    const graph = makeGraph({ a: ["b"], b: ["a"] });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.files).toEqual(["a", "b"]);
  });

  it("finds a longer indirect cycle", () => {
    const graph = makeGraph({ a: ["b"], b: ["c"], c: ["a"] });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.files).toEqual(["a", "b", "c"]);
  });

  it("does not flag a self-loop-free single node", () => {
    const graph = makeGraph({ a: [] });
    expect(findCycles(graph)).toEqual([]);
  });

  it("finds multiple independent cycles", () => {
    const graph = makeGraph({ a: ["b"], b: ["a"], c: ["d"], d: ["c"], e: [] });
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(2);
    expect(cycles.map((c) => c.files)).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles a diamond with no cycle correctly", () => {
    const graph = makeGraph({ a: ["b", "c"], b: ["d"], c: ["d"], d: [] });
    expect(findCycles(graph)).toEqual([]);
  });

  it("handles a large cycle without stack overflow (iterative Tarjan)", () => {
    const n = 5000;
    const adjacency: Record<string, string[]> = {};
    for (let i = 0; i < n; i++) {
      adjacency[`f${i}`] = [`f${(i + 1) % n}`];
    }
    const graph = makeGraph(adjacency);
    const cycles = findCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.files).toHaveLength(n);
  });
});
