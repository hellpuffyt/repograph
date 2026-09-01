import { analyzeProject } from "@repograph/core";
import { afterEach, describe, expect, it } from "vitest";
import { loadViewerTemplate, renderViewerHtml, toViewerData } from "../src/viewer.js";
import { writeFixture } from "./fixture.js";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("toViewerData", () => {
  it("attaches a project name and an ISO timestamp to the serialized analysis", () => {
    const fx = writeFixture({ "a.ts": `export const a = 1;` });
    cleanup = fx.cleanup;
    const result = analyzeProject(fx.dir);
    const data = toViewerData(result, "my-project");
    expect(data.projectName).toBe("my-project");
    expect(() => new Date(data.generatedAt).toISOString()).not.toThrow();
    expect(data.fileCount).toBe(1);
  });
});

describe("loadViewerTemplate", () => {
  it("loads the pre-built single-file HTML shipped with the CLI", () => {
    const html = loadViewerTemplate();
    expect(html).toContain("<body");
    expect(html).toContain("<script");
  });
});

describe("renderViewerHtml", () => {
  const template = `<!doctype html><html><head><title>repograph</title></head><body><div id="root"></div></body></html>`;

  it("injects a script tag with the data right after <body>", () => {
    const html = renderViewerHtml(template, {
      projectName: "demo",
      generatedAt: "2024-01-01T00:00:00.000Z",
      rootDir: "/repo",
      fileCount: 1,
      edgeCount: 0,
      nodes: [],
      edges: [],
      cycles: [],
      deadExports: [],
    });
    expect(html).toMatch(/<body><script>window\.__REPOGRAPH_DATA__=/);
    expect(html).toContain('"projectName":"demo"');
  });

  it("escapes < so injected data can't break out of the script tag", () => {
    const html = renderViewerHtml(template, {
      projectName: "</script><script>alert(1)</script>",
      generatedAt: "2024-01-01T00:00:00.000Z",
      rootDir: "/repo",
      fileCount: 0,
      edgeCount: 0,
      nodes: [],
      edges: [],
      cycles: [],
      deadExports: [],
    });
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("\\u003c/script>");
  });

  it("throws a clear error when the template has no <body> tag", () => {
    expect(() =>
      renderViewerHtml("<html></html>", {
        projectName: "x",
        generatedAt: "now",
        rootDir: "/",
        fileCount: 0,
        edgeCount: 0,
        nodes: [],
        edges: [],
        cycles: [],
        deadExports: [],
      }),
    ).toThrow(/missing a <body> tag/);
  });

  it("produces valid JSON parseable back into the same data", () => {
    const payload = {
      projectName: "demo",
      generatedAt: "2024-01-01T00:00:00.000Z",
      rootDir: "/repo",
      fileCount: 2,
      edgeCount: 1,
      nodes: [],
      edges: [],
      cycles: [],
      deadExports: [],
    };
    const html = renderViewerHtml(template, payload);
    const match = html.match(/window\.__REPOGRAPH_DATA__=(.*?);<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]!);
    expect(parsed).toEqual(payload);
  });
});
