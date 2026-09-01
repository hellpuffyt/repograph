import { computeBlastRadius, toPosix } from "@repograph/core";
import type { AnalysisResult, BlastRadius } from "@repograph/core";
import { isAbsolute, relative } from "node:path";

/** Resolve a user-supplied file argument (absolute or repo-relative) to the graph's repo-relative key and query it. */
export function blastRadiusForResult(result: AnalysisResult, file: string, depth: number): BlastRadius {
  const key = isAbsolute(file) ? toPosix(relative(result.rootDir, file)) : toPosix(file);
  return computeBlastRadius(result.graph, key, depth);
}
