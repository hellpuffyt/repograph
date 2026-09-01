import { describe, expect, it } from "vitest";
import { resolveSpecifier } from "../src/resolver.js";

const files = new Set([
  "src/index.ts",
  "src/util/format.ts",
  "src/util/index.ts",
  "src/data.json",
  "src/legacy.js",
]);

describe("resolveSpecifier", () => {
  it("returns null for bare (external) specifiers", () => {
    expect(resolveSpecifier("src/index.ts", "react", files)).toBeNull();
    expect(resolveSpecifier("src/index.ts", "@scope/pkg", files)).toBeNull();
  });

  it("resolves a relative specifier with explicit extension", () => {
    expect(resolveSpecifier("src/index.ts", "./util/format.ts", files)).toBe("src/util/format.ts");
  });

  it("resolves a relative specifier missing its extension", () => {
    expect(resolveSpecifier("src/index.ts", "./util/format", files)).toBe("src/util/format.ts");
  });

  it("resolves a directory specifier to its index file", () => {
    expect(resolveSpecifier("src/index.ts", "./util", files)).toBe("src/util/index.ts");
  });

  it("resolves ../ specifiers relative to the importing file's directory", () => {
    expect(resolveSpecifier("src/util/format.ts", "../data.json", files)).toBe("src/data.json");
  });

  it("resolves .js specifiers to their .ts source (common TS-ESM pattern)", () => {
    // Not applicable here since format.ts already matches, but a specifier
    // ending in .js pointing at a real .js file should still resolve.
    expect(resolveSpecifier("src/index.ts", "./legacy.js", files)).toBe("src/legacy.js");
  });

  it("returns null for a relative specifier that resolves to nothing known", () => {
    expect(resolveSpecifier("src/index.ts", "./nope", files)).toBeNull();
  });

  it("treats a leading-slash specifier as repo-root relative", () => {
    expect(resolveSpecifier("src/util/format.ts", "/src/data.json", files)).toBe("src/data.json");
  });
});
