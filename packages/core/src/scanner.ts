import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

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
        stat = statSync(full);
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
