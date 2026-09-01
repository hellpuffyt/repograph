import { describe, expect, it } from "vitest";
import { getBoolFlag, getStringFlag, parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("parses a command and positionals", () => {
    const args = parseArgs(["report", "./src"]);
    expect(args.command).toBe("report");
    expect(args.positionals).toEqual(["./src"]);
  });

  it("parses a value flag", () => {
    const args = parseArgs(["analyze", "./src", "--out", "result.json"]);
    expect(getStringFlag(args, "--out")).toBe("result.json");
  });

  it("parses a boolean flag with no value", () => {
    const args = parseArgs(["report", "./src", "--verbose"]);
    expect(getBoolFlag(args, "--verbose")).toBe(true);
  });

  it("throws when a value flag is missing its value", () => {
    expect(() => parseArgs(["analyze", "./src", "--out"])).toThrow(/requires a value/);
  });

  it("throws when a value flag is immediately followed by another flag", () => {
    expect(() => parseArgs(["analyze", "./src", "--out", "--verbose"])).toThrow(/requires a value/);
  });

  it("handles multiple positionals interleaved with flags", () => {
    const args = parseArgs(["blast", "./src", "a.ts", "--depth", "2"]);
    expect(args.positionals).toEqual(["./src", "a.ts"]);
    expect(getStringFlag(args, "--depth")).toBe("2");
  });

  it("returns undefined command for an empty argv", () => {
    const args = parseArgs([]);
    expect(args.command).toBeUndefined();
    expect(args.positionals).toEqual([]);
  });

  it("getStringFlag returns undefined for a boolean flag", () => {
    const args = parseArgs(["report", "./src", "--verbose"]);
    expect(getStringFlag(args, "--verbose")).toBeUndefined();
  });

  it("getBoolFlag returns false when the flag is absent", () => {
    const args = parseArgs(["report", "./src"]);
    expect(getBoolFlag(args, "--verbose")).toBe(false);
  });
});
