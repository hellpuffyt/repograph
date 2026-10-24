import { posix } from "node:path";

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const INDEX_CANDIDATES = RESOLVABLE_EXTENSIONS.map((ext) => `index${ext}`);

// TypeScript ESM (moduleResolution node16/nodenext/bundler) writes the
// *emitted* extension in import specifiers: `./util.js` refers to `util.ts`.
const TS_SOURCE_FOR_JS_EXTENSION: Record<string, readonly string[]> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

/**
 * Resolve an import specifier written inside `fromPath` to a repo-relative
 * path present in `knownFiles`. Returns null for bare/external specifiers
 * (npm packages) or relative specifiers that don't resolve to a known file.
 */
export function resolveSpecifier(
  fromPath: string,
  specifier: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return null; // bare specifier: node_modules / external package
  }

  const fromDir = posix.dirname(fromPath);
  const base = specifier.startsWith("/") ? specifier.slice(1) : posix.normalize(posix.join(fromDir, specifier));

  // Exact match (specifier already included an extension).
  if (knownFiles.has(base)) return base;

  // `./x.js` written in TS source for a file that only exists as `x.ts`.
  const jsExt = posix.extname(base);
  for (const tsExt of TS_SOURCE_FOR_JS_EXTENSION[jsExt] ?? []) {
    const candidate = `${base.slice(0, -jsExt.length)}${tsExt}`;
    if (knownFiles.has(candidate)) return candidate;
  }

  // Try appending each resolvable extension.
  for (const ext of RESOLVABLE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (knownFiles.has(candidate)) return candidate;
  }

  // Try as a directory with an index file.
  for (const indexFile of INDEX_CANDIDATES) {
    const candidate = posix.join(base, indexFile);
    if (knownFiles.has(candidate)) return candidate;
  }

  return null;
}
