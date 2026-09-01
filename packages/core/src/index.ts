export { analyzeProject } from "./analyze.js";
export { computeBlastRadius } from "./blastRadius.js";
export { findCycles } from "./cycles.js";
export { findDeadExports } from "./deadcode.js";
export { buildGraph, parseProject } from "./graph.js";
export { parseModule } from "./parser.js";
export { resolveSpecifier } from "./resolver.js";
export { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS, scanSourceFiles, toPosix } from "./scanner.js";
export { serializeAnalysis } from "./serialize.js";
export type { SerializedAnalysis } from "./serialize.js";
export type {
  AnalysisResult,
  AnalyzeOptions,
  BlastRadius,
  Cycle,
  DeadExport,
  ExportInfo,
  ExportKind,
  GraphEdge,
  GraphNode,
  ModuleGraph,
  ParsedModule,
  RawImport,
} from "./types.js";
