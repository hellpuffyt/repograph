import { describe, expect, it } from "vitest";
import { findDeadExports } from "../src/deadcode.js";
import type { ExportInfo, GraphEdge, GraphNode, ModuleGraph } from "../src/types.js";

function exp(name: string, isDefault = false): ExportInfo {
  return { name, kind: "const", line: 1, signature: `export const ${name}`, isDefault };
}

function makeGraph(nodes: Record<string, ExportInfo[]>, edges: GraphEdge[]): ModuleGraph {
  const nodeMap = new Map<string, GraphNode>();
  for (const [path, exports] of Object.entries(nodes)) {
    nodeMap.set(path, { path, exports, dependsOn: [], dependedOnBy: [], externalImports: [], lineCount: 1 });
  }
  return { rootDir: "/repo", nodes: nodeMap, edges };
}

describe("findDeadExports", () => {
  it("flags an export nothing imports", () => {
    const graph = makeGraph({ "a.ts": [exp("used"), exp("unused")] }, [
      { from: "b.ts", to: "a.ts", importedNames: ["used"], isTypeOnly: false, importsDefault: false, importsNamespace: false },
    ]);
    const dead = findDeadExports(graph);
    expect(dead.map((d) => d.export.name)).toEqual(["unused"]);
  });

  it("does not flag a used named export", () => {
    const graph = makeGraph({ "a.ts": [exp("used")] }, [
      { from: "b.ts", to: "a.ts", importedNames: ["used"], isTypeOnly: false, importsDefault: false, importsNamespace: false },
    ]);
    expect(findDeadExports(graph)).toEqual([]);
  });

  it("treats a default export as used only when some importer takes the default", () => {
    const graph = makeGraph({ "a.ts": [exp("default", true)] }, [
      { from: "b.ts", to: "a.ts", importedNames: [], isTypeOnly: false, importsDefault: true, importsNamespace: false },
    ]);
    expect(findDeadExports(graph)).toEqual([]);
  });

  it("flags an unused default export", () => {
    const graph = makeGraph({ "a.ts": [exp("default", true)] }, []);
    const dead = findDeadExports(graph);
    expect(dead).toHaveLength(1);
    expect(dead[0]?.export.isDefault).toBe(true);
  });

  it("treats every export as used when any importer takes the whole namespace", () => {
    const graph = makeGraph({ "a.ts": [exp("x"), exp("y")] }, [
      { from: "b.ts", to: "a.ts", importedNames: [], isTypeOnly: false, importsDefault: false, importsNamespace: true },
    ]);
    expect(findDeadExports(graph)).toEqual([]);
  });

  it("skips files with no exports entirely", () => {
    const graph = makeGraph({ "a.ts": [] }, []);
    expect(findDeadExports(graph)).toEqual([]);
  });

  it("never flags exports of a declared entry point", () => {
    const graph = makeGraph({ "src/index.ts": [exp("main")] }, []);
    expect(findDeadExports(graph, ["src/index.ts"])).toEqual([]);
  });

  it("sorts results by path then export name", () => {
    const graph = makeGraph(
      { "b.ts": [exp("z"), exp("a")], "a.ts": [exp("m")] },
      [],
    );
    const dead = findDeadExports(graph);
    expect(dead.map((d) => `${d.path}:${d.export.name}`)).toEqual(["a.ts:m", "b.ts:a", "b.ts:z"]);
  });
});
