import type { Cycle, ModuleGraph } from "./types.js";

/**
 * Find every strongly-connected component of size > 1 in the module graph
 * using Tarjan's algorithm (iterative, to avoid stack overflows on large
 * repos). A component of size > 1 is a genuine import cycle: every file in
 * it can reach every other file in it by following imports.
 *
 * A single self-loop (a file importing itself) is excluded by the graph
 * builder already, so size-1 components are never cycles here.
 */
export function findCycles(graph: ModuleGraph): Cycle[] {
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: Cycle[] = [];
  let counter = 0;

  const paths = [...graph.nodes.keys()].sort();

  type Frame = { node: string; childIndex: number };

  for (const start of paths) {
    if (indices.has(start)) continue;

    const callStack: Frame[] = [{ node: start, childIndex: 0 }];
    indices.set(start, counter);
    lowlink.set(start, counter);
    counter += 1;
    stack.push(start);
    onStack.add(start);

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1]!;
      const node = frame.node;
      const neighbors = [...(graph.nodes.get(node)?.dependsOn ?? [])];

      if (frame.childIndex < neighbors.length) {
        const next = neighbors[frame.childIndex]!;
        frame.childIndex += 1;

        if (!indices.has(next)) {
          indices.set(next, counter);
          lowlink.set(next, counter);
          counter += 1;
          stack.push(next);
          onStack.add(next);
          callStack.push({ node: next, childIndex: 0 });
        } else if (onStack.has(next)) {
          lowlink.set(node, Math.min(lowlink.get(node)!, indices.get(next)!));
        }
      } else {
        callStack.pop();
        const parentFrame = callStack[callStack.length - 1];
        if (parentFrame) {
          lowlink.set(parentFrame.node, Math.min(lowlink.get(parentFrame.node)!, lowlink.get(node)!));
        }

        if (lowlink.get(node) === indices.get(node)) {
          const component: string[] = [];
          let member: string;
          do {
            member = stack.pop()!;
            onStack.delete(member);
            component.push(member);
          } while (member !== node);

          if (component.length > 1) {
            cycles.push({ files: component.sort() });
          }
        }
      }
    }
  }

  return cycles.sort((a, b) => a.files[0]!.localeCompare(b.files[0]!));
}
