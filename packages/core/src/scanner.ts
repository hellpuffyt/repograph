import { lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

export const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

export const DEFAULT_IGNORE_DIRS = [
  "node_modules",
  "dist",
  "build",
  "out",
  ".git",
  "coverage",
  ".next",
  ".turbo",
  ".vite",
];

/** Convert a filesystem path to a repo-relative POSIX path (stable across OSes). */
export function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/**
 * Recursively list source files under `rootDir`, returning repo-relative
 * POSIX paths sorted lexicographically for deterministic output.
 */
export function scanSourceFiles(
  rootDir: string,
  options: { extensions?: string[]; ignoreDirs?: string[] } = {},
): string[] {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const ignoreDirs = new Set(options.ignoreDirs ?? DEFAULT_IGNORE_DIRS);
  const results: string[] = [];
  let realRoot: string;
  try {
    realRoot = realpathSync(rootDir);
  } catch {
    realRoot = rootDir;
  }

  /** True if `path` resolves (through symlinks) to somewhere inside the root. */
  function insideRoot(path: string): boolean {
    try {
      const rel = relative(realRoot, realpathSync(path));
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    } catch {
      return false;
    }
  }

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries.sort()) {
      const full = join(dir, entry);
      let stat;
      try {
        // Symlinked directories are never followed (a link to an ancestor
        // looped forever; a link elsewhere pulled outside files into the
        // report). A symlinked file is kept only if it resolves inside the root.
        const link = lstatSync(full);
        if (link.isSymbolicLink()) {
          stat = statSync(full);
          if (stat.isDirectory() || !insideRoot(full)) continue;
        } else {
          stat = link;
        }
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (ignoreDirs.has(entry) || entry.startsWith(".")) continue;
        walk(full);
      } else if (stat.isFile()) {
        if (extensions.some((ext) => entry.endsWith(ext))) {
          if (entry.endsWith(".d.ts")) continue;
          results.push(toPosix(relative(rootDir, full)));
        }
      }
    }
  }

  walk(rootDir);
  return results.sort();
}
