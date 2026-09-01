import { buildGraph, parseProject } from "./graph.js";
import { findCycles } from "./cycles.js";
import { findDeadExports } from "./deadcode.js";
import type { AnalysisResult, AnalyzeOptions } from "./types.js";

/**
 * Run the full analysis pipeline over a directory: scan source files, parse
 * imports/exports, resolve internal edges into a module graph, then derive
 * cycles and dead exports from that graph. This is the single entry point
 * both the CLI and the web viewer build on.
 */
export function analyzeProject(rootDir: string, options: AnalyzeOptions = {}): AnalysisResult {
  const parsedModules = parseProject(rootDir, options);
  const graph = buildGraph(rootDir, parsedModules);
  const cycles = findCycles(graph);
  const deadExports = findDeadExports(graph, options.entryPoints ?? []);

  return {
    rootDir,
    graph,
    cycles,
    deadExports,
    fileCount: graph.nodes.size,
    edgeCount: graph.edges.length,
  };
}
