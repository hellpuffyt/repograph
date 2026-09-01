import type { SerializedAnalysis } from "@repograph/core";

/** The payload the CLI injects into the static viewer, or serves at /api/graph. */
export interface RepographData extends SerializedAnalysis {
  /** Name shown in the header — usually the analyzed directory's basename. */
  projectName: string;
  generatedAt: string;
}
