// Deep-imported (rather than the package barrel) so this browser bundle never
// pulls in graph.ts's node:fs/node:path usage — computeBlastRadius itself is
// pure and has no Node dependency, but @repograph/core's index re-exports
// everything from one module graph, and bundlers resolve that whole graph.
import { computeBlastRadius } from "@repograph/core/dist/blastRadius.js";
import type { BlastRadius, GraphNode, ModuleGraph } from "@repograph/core/dist/types.js";
import type { RepographData } from "./data";

/** Rebuild the Map-based ModuleGraph shape core's algorithms expect from the flat, JSON-safe payload. */
export function toModuleGraph(data: RepographData): ModuleGraph {
  const nodes = new Map<string, GraphNode>();
  for (const node of data.nodes) nodes.set(node.path, node);
  return { rootDir: data.rootDir, nodes, edges: data.edges };
}

export function blastRadiusFor(data: RepographData, target: string): BlastRadius {
  return computeBlastRadius(toModuleGraph(data), target);
}

export interface FileStatus {
  isDead: boolean;
  isInCycle: boolean;
  deadExportNames: Set<string>;
}

export function computeFileStatuses(data: RepographData): Map<string, FileStatus> {
  const statuses = new Map<string, FileStatus>();
  const cycleFiles = new Set(data.cycles.flatMap((c) => c.files));
  const deadByFile = new Map<string, Set<string>>();
  for (const dead of data.deadExports) {
    const set = deadByFile.get(dead.path) ?? new Set<string>();
    set.add(dead.export.name);
    deadByFile.set(dead.path, set);
  }
  for (const node of data.nodes) {
    const deadExportNames = deadByFile.get(node.path) ?? new Set<string>();
    statuses.set(node.path, {
      isDead: node.exports.length > 0 && deadExportNames.size === node.exports.length,
      isInCycle: cycleFiles.has(node.path),
      deadExportNames,
    });
  }
  return statuses;
}
