import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanSourceFiles } from "../src/scanner.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "repograph-scanner-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "node_modules", "dep"), { recursive: true });
  mkdirSync(join(dir, "dist"), { recursive: true });
  mkdirSync(join(dir, ".hidden"), { recursive: true });
  writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;");
  writeFileSync(join(dir, "src", "b.jsx"), "export const b = 1;");
  writeFileSync(join(dir, "src", "types.d.ts"), "export type T = 1;");
  writeFileSync(join(dir, "src", "readme.md"), "# hi");
  writeFileSync(join(dir, "node_modules", "dep", "index.js"), "module.exports = {};");
  writeFileSync(join(dir, "dist", "bundle.js"), "//");
  writeFileSync(join(dir, ".hidden", "x.ts"), "export const x = 1;");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("scanSourceFiles", () => {
  it("finds source files with matched extensions", () => {
    const files = scanSourceFiles(dir);
    expect(files).toContain("src/a.ts");
    expect(files).toContain("src/b.jsx");
  });

  it("excludes .d.ts declaration files", () => {
    const files = scanSourceFiles(dir);
    expect(files).not.toContain("src/types.d.ts");
  });

  it("excludes non-source files", () => {
    const files = scanSourceFiles(dir);
    expect(files).not.toContain("src/readme.md");
  });

  it("excludes node_modules and dist by default", () => {
    const files = scanSourceFiles(dir);
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
    expect(files.some((f) => f.includes("dist"))).toBe(false);
  });

  it("excludes dotdirectories", () => {
    const files = scanSourceFiles(dir);
    expect(files.some((f) => f.includes(".hidden"))).toBe(false);
  });

  it("returns results sorted for determinism", () => {
    const files = scanSourceFiles(dir);
    expect(files).toEqual([...files].sort());
  });

  it("respects custom ignoreDirs and extensions", () => {
    mkdirSync(join(dir, "vendor"), { recursive: true });
    writeFileSync(join(dir, "vendor", "v.ts"), "export const v = 1;");
    const files = scanSourceFiles(dir, { ignoreDirs: ["vendor"], extensions: [".ts"] });
    expect(files.some((f) => f.startsWith("vendor/"))).toBe(false);
    expect(files).not.toContain("src/b.jsx");
  });

  it("returns an empty array for a nonexistent directory", () => {
    expect(scanSourceFiles(join(dir, "does-not-exist"))).toEqual([]);
  });
});
