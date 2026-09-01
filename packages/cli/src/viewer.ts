import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalysisResult } from "@repograph/core";
import { serializeAnalysis, type SerializedAnalysis } from "@repograph/core";

const here = dirname(fileURLToPath(import.meta.url));

export interface RepographDataPayload extends SerializedAnalysis {
  projectName: string;
  generatedAt: string;
}

/** Turn an AnalysisResult into the JSON payload the web viewer expects. */
export function toViewerData(result: AnalysisResult, projectName: string): RepographDataPayload {
  return {
    ...serializeAnalysis(result),
    projectName,
    generatedAt: new Date().toISOString(),
  };
}

/** Read the pre-built single-file viewer HTML shipped alongside the CLI. */
export function loadViewerTemplate(): string {
  const path = join(here, "..", "web", "viewer.html");
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(
      `repograph: could not find the bundled web viewer at ${path}. ` +
        `This usually means the package was installed without its build artifacts. (${(err as Error).message})`,
    );
  }
}

const LT_RE = /</g;
const LINE_SEPARATOR_RE = new RegExp(String.fromCharCode(0x2028), "g");
const PARA_SEPARATOR_RE = new RegExp(String.fromCharCode(0x2029), "g");

/** Serialize `<script>`-unsafe characters so JSON data can't break out of the injected <script> tag. */
function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(LT_RE, "\\u003c")
    .replace(LINE_SEPARATOR_RE, "\\u2028")
    .replace(PARA_SEPARATOR_RE, "\\u2029");
}

/** Inject the analysis payload into the viewer template as a global the app reads on boot. */
export function renderViewerHtml(template: string, data: RepographDataPayload): string {
  const script = `<script>window.__REPOGRAPH_DATA__=${safeJson(data)};</script>`;
  const bodyOpenMatch = template.match(/<body[^>]*>/i);
  if (!bodyOpenMatch || bodyOpenMatch.index === undefined) {
    throw new Error("repograph: viewer template is missing a <body> tag; cannot inject analysis data.");
  }
  const insertAt = bodyOpenMatch.index + bodyOpenMatch[0].length;
  return template.slice(0, insertAt) + script + template.slice(insertAt);
}
