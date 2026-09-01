import type { AnalysisResult, BlastRadius, GraphNode } from "./types.js";

/** JSON-safe shape of an AnalysisResult (Maps become sorted arrays). */
export interface SerializedAnalysis {
  rootDir: string;
  fileCount: number;
  edgeCount: number;
  nodes: GraphNode[];
  edges: AnalysisResult["graph"]["edges"];
  cycles: AnalysisResult["cycles"];
  deadExports: AnalysisResult["deadExports"];
}

/** Convert an in-memory AnalysisResult into a plain, JSON.stringify-able object. */
export function serializeAnalysis(result: AnalysisResult): SerializedAnalysis {
  return {
    rootDir: result.rootDir,
    fileCount: result.fileCount,
    edgeCount: result.edgeCount,
    nodes: [...result.graph.nodes.values()].sort((a, b) => a.path.localeCompare(b.path)),
    edges: result.graph.edges,
    cycles: result.cycles,
    deadExports: result.deadExports,
  };
}

export type { BlastRadius };
