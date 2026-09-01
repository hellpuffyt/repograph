/**
 * Shared data model for repograph's analysis engine.
 *
 * A `ModuleGraph` is the single artifact every feature (cycle detection,
 * dead-code detection, API-surface extraction, blast-radius queries) is
 * computed from. Everything else in this package is either a producer of
 * one field on this graph or a pure function over it.
 */

/** Kind of a top-level exported declaration, used for API-surface reporting. */
export type ExportKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "const"
  | "let"
  | "var"
  | "unknown";

/** One symbol exported from a module. */
export interface ExportInfo {
  /** Exported name, or "default" for `export default`. */
  name: string;
  kind: ExportKind;
  /** 1-based source line the declaration starts on. */
  line: number;
  /** Best-effort single-line signature text, truncated for display. */
  signature: string;
  /** True for `export default ...`. */
  isDefault: boolean;
}

/** One `import`/`require`/`export ... from` edge found in a module's source. */
export interface RawImport {
  /** The literal specifier as written, e.g. "./util" or "react". */
  specifier: string;
  /** 1-based source line the import statement starts on. */
  line: number;
  /** True for `import type { X } from "./x"` (type-only, erased at runtime). */
  isTypeOnly: boolean;
  /** Named bindings imported, e.g. ["foo", "bar"]. Empty for side-effect/default/namespace-only imports. */
  importedNames: string[];
  /** True if a default import was requested (`import Foo from "..."`). */
  importsDefault: boolean;
  /** True if a namespace import was requested (`import * as ns from "..."`). */
  importsNamespace: boolean;
}

/** A parsed source file before specifiers are resolved to repo-relative paths. */
export interface ParsedModule {
  /** Repo-relative POSIX path, e.g. "src/util/format.ts". */
  path: string;
  exports: ExportInfo[];
  imports: RawImport[];
  /** Lines of source, used for signature/context extraction. */
  lineCount: number;
}

/** A directed dependency edge between two modules in the repo. */
export interface GraphEdge {
  from: string;
  to: string;
  /** Names imported across this edge (union across all import statements on it). */
  importedNames: string[];
  isTypeOnly: boolean;
  /** True if any import statement on this edge imports the default export. */
  importsDefault: boolean;
  /** True if any import statement on this edge imports the whole namespace (`import * as ns` or `export * from`). */
  importsNamespace: boolean;
}

/** A node in the module graph: one source file. */
export interface GraphNode {
  path: string;
  exports: ExportInfo[];
  /** Repo-relative paths of modules this file imports (internal only). */
  dependsOn: string[];
  /** Repo-relative paths of modules that import this file (internal only). */
  dependedOnBy: string[];
  /** External (node_modules / bare specifier) imports, deduplicated. */
  externalImports: string[];
  lineCount: number;
}

/** The full analyzed graph for a repository (or subtree). */
export interface ModuleGraph {
  rootDir: string;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

/** One strongly-connected component of size > 1 (a real import cycle). */
export interface Cycle {
  /** Member file paths, in the order Tarjan's algorithm discovered them. */
  files: string[];
}

/** An exported symbol that is never imported anywhere else in the graph. */
export interface DeadExport {
  path: string;
  export: ExportInfo;
  reason: "unreferenced";
}

/** Result of a blast-radius query for a single file. */
export interface BlastRadius {
  target: string;
  /** Files transitively depending on target, grouped by hop distance (1 = direct importers). */
  levels: string[][];
  /** Flattened, deduplicated list of every affected file. */
  affected: string[];
  /** Exports of `target` that are actually consumed by at least one dependent. */
  consumedExports: string[];
}

export interface AnalyzeOptions {
  /** Glob-ish suffixes to include. Defaults to ts/tsx/js/jsx/mjs/cjs. */
  extensions?: string[];
  /** Directory names to always skip. Defaults include node_modules, dist, build, .git, coverage. */
  ignoreDirs?: string[];
  /** Repo-relative file paths considered "entry points" — their exports are never flagged dead. */
  entryPoints?: string[];
}

export interface AnalysisResult {
  rootDir: string;
  graph: ModuleGraph;
  cycles: Cycle[];
  deadExports: DeadExport[];
  fileCount: number;
  edgeCount: number;
}
