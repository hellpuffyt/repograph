import { writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { analyzeProject, serializeAnalysis } from "@repograph/core";
import type { AnalysisResult } from "@repograph/core";
import { getStringFlag, parseArgs, type ParsedArgs } from "./args.js";
import { formatBlastRadius, formatReport } from "./report.js";
import { loadViewerTemplate, renderViewerHtml, toViewerData } from "./viewer.js";
import { blastRadiusForResult } from "./blast.js";

export interface Io {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export const realIo: Io = {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

function requireDir(args: ParsedArgs, command: string): string {
  const dir = args.positionals[0];
  if (!dir) {
    throw new UsageError(`Usage: repograph ${command} <dir> [options]`);
  }
  return resolve(dir);
}

export class UsageError extends Error {}

function runAnalysis(dir: string, args: ParsedArgs): AnalysisResult {
  const entryFlag = getStringFlag(args, "--entry");
  const entryPoints = entryFlag ? entryFlag.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return analyzeProject(dir, { entryPoints });
}

export function cmdAnalyze(args: ParsedArgs, io: Io): number {
  const dir = requireDir(args, "analyze");
  const result = runAnalysis(dir, args);
  const json = JSON.stringify(serializeAnalysis(result), null, 2);
  const out = getStringFlag(args, "--out");
  if (out) {
    writeFileSync(out, json);
    io.stdout(`Wrote analysis JSON to ${out}`);
  } else {
    io.stdout(json);
  }
  return 0;
}

export function cmdReport(args: ParsedArgs, io: Io): number {
  const dir = requireDir(args, "report");
  const result = runAnalysis(dir, args);
  io.stdout(formatReport(result));
  return result.cycles.length > 0 ? 1 : 0;
}

export function cmdBlast(args: ParsedArgs, io: Io): number {
  const dir = requireDir(args, "blast");
  const file = args.positionals[1];
  if (!file) throw new UsageError("Usage: repograph blast <dir> <file> [--depth n]");
  const result = runAnalysis(dir, args);
  const depthFlag = getStringFlag(args, "--depth");
  const depth = depthFlag ? Number(depthFlag) : Infinity;
  const radius = blastRadiusForResult(result, file, depth);
  io.stdout(formatBlastRadius(radius));
  return 0;
}

export function cmdHtml(args: ParsedArgs, io: Io): number {
  const dir = requireDir(args, "html");
  const result = runAnalysis(dir, args);
  const out = getStringFlag(args, "--out") ?? "repograph.html";
  const data = toViewerData(result, basename(dir));
  const html = renderViewerHtml(loadViewerTemplate(), data);
  writeFileSync(out, html);
  io.stdout(`Wrote interactive graph to ${out} (${result.fileCount} files, ${result.cycles.length} cycles, ${result.deadExports.length} dead exports).`);
  return 0;
}

export function dispatch(argv: string[], io: Io = realIo): number {
  const args = parseArgs(argv);
  try {
    switch (args.command) {
      case "analyze":
        return cmdAnalyze(args, io);
      case "report":
        return cmdReport(args, io);
      case "blast":
        return cmdBlast(args, io);
      case "html":
        return cmdHtml(args, io);
      case "serve":
        throw new UsageError("`repograph serve` must be run from the CLI entrypoint (needs a live process).");
      case "--version":
      case "-v":
        io.stdout("0.1.0");
        return 0;
      case undefined:
      case "--help":
      case "-h":
      case "help":
        io.stdout(helpText());
        return 0;
      default:
        io.stderr(`Unknown command: ${args.command}\n\n${helpText()}`);
        return 1;
    }
  } catch (err) {
    if (err instanceof UsageError) {
      io.stderr(err.message);
      return 1;
    }
    throw err;
  }
}

export function helpText(): string {
  return [
    "repograph — an interactive architecture map for a codebase",
    "",
    "Usage:",
    "  repograph analyze <dir> [--entry a.ts,b.ts] [--out file.json]   Print/write the raw analysis as JSON",
    "  repograph report <dir> [--entry a.ts,b.ts]                     Print a human-readable text report",
    "  repograph blast <dir> <file> [--depth n]                       Print the blast radius of one file",
    "  repograph html <dir> [--entry a.ts,b.ts] [--out file.html]     Write a self-contained interactive HTML graph",
    "  repograph serve <dir> [--port 4173] [--entry a.ts,b.ts]        Serve the interactive graph over HTTP",
    "  repograph --version                                            Print the CLI version",
    "",
    "Notes:",
    "  --entry marks files whose exports are never flagged as dead code (comma-separated repo-relative paths).",
  ].join("\n");
}
