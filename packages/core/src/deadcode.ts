import type { DeadExport, ModuleGraph } from "./types.js";

/**
 * Find exports that no other file in the graph ever imports.
 *
 * A file's export is considered "used" if any edge pointing at that file
 * either imports it by name, imports its default (for `isDefault` exports),
 * or imports the whole namespace (`import * as ns` / `export * from`,
 * which we can't statically prove doesn't touch this symbol, so we treat
 * it as covering every export — conservative in favor of fewer false
 * positives). Files listed in `entryPoints` are skipped entirely: an
 * entry point's exports are its public API by definition, not dead code.
 */
export function findDeadExports(graph: ModuleGraph, entryPoints: readonly string[] = []): DeadExport[] {
  const entrySet = new Set(entryPoints);
  const dead: DeadExport[] = [];

  for (const [path, node] of graph.nodes) {
    if (entrySet.has(path)) continue;
    if (node.exports.length === 0) continue;

    const incoming = graph.edges.filter((e) => e.to === path);
    const anyNamespaceImport = incoming.some((e) => e.importsNamespace);
    if (anyNamespaceImport) continue; // can't prove any single export unused

    const importedNames = new Set(incoming.flatMap((e) => e.importedNames));
    const anyDefaultImport = incoming.some((e) => e.importsDefault);

    for (const exp of node.exports) {
      const used = exp.isDefault ? anyDefaultImport : importedNames.has(exp.name);
      if (!used) {
        dead.push({ path, export: exp, reason: "unreferenced" });
      }
    }
  }

  return dead.sort((a, b) => (a.path === b.path ? a.export.name.localeCompare(b.export.name) : a.path.localeCompare(b.path)));
}
