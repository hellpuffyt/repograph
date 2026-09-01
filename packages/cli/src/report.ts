import { basename } from "node:path";
import type { AnalysisResult, BlastRadius } from "@repograph/core";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Render a human-readable text summary of a full analysis.
 *
 * Deliberately reports only the project's directory name, not its full
 * absolute path — the same repo analyzed from two different checkouts (or
 * on CI vs. locally) should produce byte-identical report text.
 */
export function formatReport(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push(`repograph report for ${basename(result.rootDir)}`);
  lines.push(`${plural(result.fileCount, "file")}, ${plural(result.edgeCount, "internal dependency edge")}`);
  lines.push("");

  lines.push(`Circular dependencies: ${result.cycles.length}`);
  for (const cycle of result.cycles) {
    lines.push(`  - ${cycle.files.join(" -> ")} -> ${cycle.files[0]}`);
  }
  lines.push("");

  lines.push(`Dead exports (never imported): ${result.deadExports.length}`);
  for (const dead of result.deadExports) {
    lines.push(`  - ${dead.path}:${dead.export.line} ${dead.export.name} (${dead.export.kind})`);
  }
  lines.push("");

  const hubs = [...result.graph.nodes.values()]
    .map((n) => ({ path: n.path, fanIn: n.dependedOnBy.length, fanOut: n.dependsOn.length }))
    .filter((n) => n.fanIn > 0)
    .sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path))
    .slice(0, 10);
  lines.push(`Most-depended-on files (top ${hubs.length}):`);
  for (const hub of hubs) {
    lines.push(`  - ${hub.path} (imported by ${plural(hub.fanIn, "file")}, imports ${hub.fanOut})`);
  }

  return lines.join("\n");
}

/** Render a human-readable text summary of a single blast-radius query. */
export function formatBlastRadius(radius: BlastRadius): string {
  const lines: string[] = [];
  lines.push(`Blast radius for ${radius.target}`);
  if (radius.levels.length === 0) {
    lines.push("  Nothing in this repo depends on this file.");
    return lines.join("\n");
  }
  lines.push(`  ${plural(radius.affected.length, "file")} affected across ${plural(radius.levels.length, "hop")}`);
  if (radius.consumedExports.length > 0) {
    lines.push(`  Exports actually consumed: ${radius.consumedExports.join(", ")}`);
  }
  radius.levels.forEach((level, i) => {
    lines.push(`  hop ${i + 1}:`);
    for (const file of level) {
      lines.push(`    - ${file}`);
    }
  });
  return lines.join("\n");
}
