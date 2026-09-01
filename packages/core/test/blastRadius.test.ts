import { describe, expect, it } from "vitest";
import { computeBlastRadius } from "../src/blastRadius.js";
import type { GraphEdge, GraphNode, ModuleGraph } from "../src/types.js";

function makeGraph(adjacency: Record<string, string[]>): ModuleGraph {
  // adjacency[x] = files that DEPEND ON x (dependedOnBy), to make blast-radius fixtures easy to read.
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  for (const path of Object.keys(adjacency)) {
    nodes.set(path, { path, exports: [], dependsOn: [], dependedOnBy: adjacency[path] ?? [], externalImports: [], lineCount: 1 });
  }
  for (const [target, dependents] of Object.entries(adjacency)) {
    for (const dependent of dependents) {
      edges.push({ from: dependent, to: target, importedNames: ["x"], isTypeOnly: false, importsDefault: false, importsNamespace: false });
      if (!nodes.has(dependent)) {
        nodes.set(dependent, { path: dependent, exports: [], dependsOn: [target], dependedOnBy: [], externalImports: [], lineCount: 1 });
      }
    }
  }
  return { rootDir: "/repo", nodes, edges };
}

describe("computeBlastRadius", () => {
  it("returns empty result for an unknown target", () => {
    const graph = makeGraph({ a: [] });
    expect(computeBlastRadius(graph, "missing.ts")).toEqual({
      target: "missing.ts",
      levels: [],
      affected: [],
      consumedExports: [],
    });
  });

  it("returns no levels for a leaf nothing depends on", () => {
    const graph = makeGraph({ a: [] });
    const result = computeBlastRadius(graph, "a");
    expect(result.levels).toEqual([]);
    expect(result.affected).toEqual([]);
  });

  it("finds direct dependents at level 1", () => {
    const graph = makeGraph({ a: ["b", "c"] });
    const result = computeBlastRadius(graph, "a");
    expect(result.levels[0]).toEqual(["b", "c"]);
    expect(result.affected).toEqual(["b", "c"]);
  });

  it("finds transitive dependents grouped by hop distance", () => {
    // a <- b <- c   (b depends on a, c depends on b)
    const graph = makeGraph({ a: ["b"], b: ["c"] });
    const result = computeBlastRadius(graph, "a");
    expect(result.levels).toEqual([["b"], ["c"]]);
    expect(result.affected).toEqual(["b", "c"]);
  });

  it("does not revisit a node reachable through two paths", () => {
    // a <- b, a <- c, b <- d, c <- d  => d reachable via both b and c at level 2, once only
    const graph = makeGraph({ a: ["b", "c"], b: ["d"], c: ["d"] });
    const result = computeBlastRadius(graph, "a");
    expect(result.levels).toEqual([["b", "c"], ["d"]]);
  });

  it("respects maxDepth", () => {
    const graph = makeGraph({ a: ["b"], b: ["c"] });
    const result = computeBlastRadius(graph, "a", 1);
    expect(result.levels).toEqual([["b"]]);
  });

  it("reports which exports of the target are actually consumed", () => {
    const graph = makeGraph({ a: ["b"] });
    const result = computeBlastRadius(graph, "a");
    expect(result.consumedExports).toEqual(["x"]);
  });
});
