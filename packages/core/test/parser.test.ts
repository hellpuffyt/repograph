import { describe, expect, it } from "vitest";
import { parseModule } from "../src/parser.js";

describe("parseModule: imports", () => {
  it("captures named imports", () => {
    const { imports } = parseModule("a.ts", `import { foo, bar } from "./util";`);
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      specifier: "./util",
      importedNames: ["foo", "bar"],
      importsDefault: false,
      importsNamespace: false,
      isTypeOnly: false,
    });
  });

  it("captures renamed named imports by their original (propertyName)", () => {
    const { imports } = parseModule("a.ts", `import { foo as f } from "./util";`);
    expect(imports[0]?.importedNames).toEqual(["foo"]);
  });

  it("captures default imports", () => {
    const { imports } = parseModule("a.ts", `import React from "react";`);
    expect(imports[0]).toMatchObject({ specifier: "react", importsDefault: true, importedNames: [] });
  });

  it("captures default + named combined", () => {
    const { imports } = parseModule("a.ts", `import Foo, { bar } from "./x";`);
    expect(imports[0]).toMatchObject({ importsDefault: true, importedNames: ["bar"] });
  });

  it("captures namespace imports", () => {
    const { imports } = parseModule("a.ts", `import * as ns from "./x";`);
    expect(imports[0]).toMatchObject({ importsNamespace: true, importedNames: [] });
  });

  it("captures side-effect-only imports", () => {
    const { imports } = parseModule("a.ts", `import "./polyfill";`);
    expect(imports[0]).toMatchObject({ specifier: "./polyfill", importedNames: [] });
  });

  it("marks `import type` as type-only", () => {
    const { imports } = parseModule("a.ts", `import type { Foo } from "./types";`);
    expect(imports[0]).toMatchObject({ isTypeOnly: true, importedNames: ["Foo"] });
  });

  it("captures require() calls", () => {
    const { imports } = parseModule("a.js", `const x = require("./legacy");`);
    expect(imports[0]).toMatchObject({ specifier: "./legacy" });
  });

  it("captures dynamic import() calls", () => {
    const { imports } = parseModule("a.ts", `async function load() { const m = await import("./lazy"); }`);
    expect(imports[0]).toMatchObject({ specifier: "./lazy" });
  });

  it("ignores require() with a non-literal argument", () => {
    const { imports } = parseModule("a.ts", `const name = "./x"; const m = require(name);`);
    expect(imports).toHaveLength(0);
  });

  it("captures export ... from as an import edge plus a re-export", () => {
    const { imports, exports } = parseModule("a.ts", `export { foo, bar as baz } from "./util";`);
    expect(imports[0]).toMatchObject({ specifier: "./util", importedNames: ["foo", "bar"] });
    expect(exports.map((e) => e.name)).toEqual(["foo", "baz"]);
  });

  it("captures export * from as a namespace-ish import", () => {
    const { imports, exports } = parseModule("a.ts", `export * from "./util";`);
    expect(imports[0]).toMatchObject({ specifier: "./util", importsNamespace: true });
    expect(exports).toHaveLength(0);
  });
});

describe("parseModule: exports", () => {
  it("captures export function", () => {
    const { exports } = parseModule("a.ts", `export function greet(name: string) { return name; }`);
    expect(exports[0]).toMatchObject({ name: "greet", kind: "function", isDefault: false });
  });

  it("captures export default function (named)", () => {
    const { exports } = parseModule("a.ts", `export default function greet() {}`);
    expect(exports[0]).toMatchObject({ name: "default", kind: "function", isDefault: true });
  });

  it("captures export default of an expression", () => {
    const { exports } = parseModule("a.ts", `const x = 1;\nexport default x;`);
    expect(exports[0]).toMatchObject({ name: "default", isDefault: true });
  });

  it("captures export class / interface / type / enum", () => {
    const { exports } = parseModule(
      "a.ts",
      `export class Foo {}\nexport interface Bar {}\nexport type Baz = string;\nexport enum Qux { A }`,
    );
    expect(exports.map((e) => [e.name, e.kind])).toEqual([
      ["Foo", "class"],
      ["Bar", "interface"],
      ["Baz", "type"],
      ["Qux", "enum"],
    ]);
  });

  it("captures export const/let/var with multiple declarators", () => {
    const { exports } = parseModule("a.ts", `export const a = 1, b = 2;`);
    expect(exports.map((e) => e.name)).toEqual(["a", "b"]);
    expect(exports.every((e) => e.kind === "const")).toBe(true);
  });

  it("captures local export { } re-export lists", () => {
    const { exports } = parseModule("a.ts", `const x = 1;\nexport { x, x as y };`);
    expect(exports.map((e) => e.name)).toEqual(["x", "y"]);
  });

  it("records the 1-based declaration line", () => {
    const { exports } = parseModule("a.ts", `\n\nexport const z = 1;`);
    expect(exports[0]?.line).toBe(3);
  });

  it("truncates long signatures", () => {
    const long = `export function f(${"a".repeat(200)}: string) {}`;
    const { exports } = parseModule("a.ts", long);
    expect(exports[0]?.signature.length).toBeLessThanOrEqual(100);
  });

  it("does not export unexported declarations", () => {
    const { exports } = parseModule("a.ts", `function internal() {}\nconst x = 1;`);
    expect(exports).toHaveLength(0);
  });

  it("parses tsx and jsx script kinds without throwing", () => {
    expect(() => parseModule("a.tsx", `export const C = () => <div />;`)).not.toThrow();
    expect(() => parseModule("a.jsx", `export const C = () => <div />;`)).not.toThrow();
  });

  it("reports line count", () => {
    const { lineCount } = parseModule("a.ts", `line1\nline2\nline3`);
    expect(lineCount).toBe(3);
  });
});
