import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanSourceFiles } from "../src/scanner.js";

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "repograph-symlink-"));
  dirs.push(d);
  return d;
}

describe.skipIf(process.platform === "win32")("scanSourceFiles and symlinks", () => {
  it("does not loop on a directory symlink to an ancestor", () => {
    const root = tmp();
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "a.ts"), "export const a = 1;");
    symlinkSync(root, join(root, "src", "loop"));
    expect(scanSourceFiles(root)).toEqual(["src/a.ts"]);
  });

  it("does not pull in files from outside the root through symlinks", () => {
    const outside = tmp();
    writeFileSync(join(outside, "secret.ts"), "export const secret = 1;");
    mkdirSync(join(outside, "dir"));
    writeFileSync(join(outside, "dir", "other.ts"), "export const o = 1;");
    const root = tmp();
    writeFileSync(join(root, "a.ts"), "export const a = 1;");
    symlinkSync(join(outside, "secret.ts"), join(root, "linked.ts"));
    symlinkSync(join(outside, "dir"), join(root, "linkeddir"));
    expect(scanSourceFiles(root)).toEqual(["a.ts"]);
  });

  it("keeps a symlinked file that points inside the root", () => {
    const root = tmp();
    writeFileSync(join(root, "a.ts"), "export const a = 1;");
    symlinkSync(join(root, "a.ts"), join(root, "alias.ts"));
    expect(scanSourceFiles(root)).toEqual(["a.ts", "alias.ts"]);
  });
});
