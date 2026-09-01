import type { BlastRadius, ModuleGraph } from "./types.js";

/**
 * Compute the "blast radius" of a file: every module that transitively
 * depends on it, grouped by hop distance (BFS over the reversed edge set),
 * plus which of its own exports are actually reached by that BFS's
 * outgoing edges — i.e. which exports would actually break something if
 * removed or changed, versus exports that happen to be unused dead weight.
 */
export function computeBlastRadius(graph: ModuleGraph, target: string, maxDepth = Infinity): BlastRadius {
  if (!graph.nodes.has(target)) {
    return { target, levels: [], affected: [], consumedExports: [] };
  }

  const visited = new Set<string>([target]);
  const levels: string[][] = [];
  let frontier = [target];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const next = new Set<string>();
    for (const path of frontier) {
      const node = graph.nodes.get(path);
      if (!node) continue;
      for (const dependent of node.dependedOnBy) {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          next.add(dependent);
        }
      }
    }
    if (next.size === 0) break;
    const level = [...next].sort();
    levels.push(level);
    frontier = level;
    depth += 1;
  }

  const affected = levels.flat();

  const directImporters = graph.edges.filter((e) => e.to === target);
  const consumedExports = [...new Set(directImporters.flatMap((e) => e.importedNames))].sort();

  return { target, levels, affected, consumedExports };
}
