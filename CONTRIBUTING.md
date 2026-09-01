# Contributing to repograph

## Setup

```
npm install
npm run build
```

`npm run build` builds packages in dependency order: `@repograph/core` first, then
`@repograph/web` (compiled by Vite into a single-file HTML viewer), then the
`repograph` CLI (which copies that built viewer into its own `dist/` and injects
analysis data into it at runtime). If you only touched `packages/core`, you can
rebuild just that with `npm run build -w packages/core` — but `packages/cli`'s tests
read the pre-built viewer from `packages/cli/web/viewer.html`, so run the full
`npm run build` at least once after a fresh clone.

## Project layout

- `packages/core` — the analysis engine. No Node-specific code outside
  `scanner.ts`/`graph.ts` (file I/O); everything else (`parser.ts`, `resolver.ts`,
  `cycles.ts`, `deadcode.ts`, `blastRadius.ts`) is pure functions over plain data, so
  it's straightforward to unit test and to reuse in the browser (the web viewer
  deep-imports `computeBlastRadius` directly).
- `packages/cli` — argument parsing (`args.ts`), the five subcommands
  (`commands.ts`), text rendering (`report.ts`), the HTTP server (`serve.ts`), and
  HTML-injection (`viewer.ts`). `bin.ts` is the thin process entrypoint; keep new
  logic in a testable module and have `bin.ts` just call into it.
- `packages/web` — the viewer. `forceLayout.ts` is a from-scratch force-directed
  layout (no D3/graph-library dependency, by design — see the README's "why this and
  not the 1,000 clones" section). `graphModel.ts` bridges the flat JSON payload back
  into the `ModuleGraph` shape `@repograph/core`'s algorithms expect.
- `fixtures/demo-app` — a small, deliberately-crafted example app with one known
  import cycle and several known-dead exports. If you change its source, regenerate
  the golden files CI diffs against:
  ```
  npm run build
  node packages/cli/dist/bin.js report fixtures/demo-app --entry src/index.ts > fixtures/demo-app.report.txt
  node packages/cli/dist/bin.js blast fixtures/demo-app src/store/state.ts > fixtures/demo-app.blast.txt
  ```

## Ground rules

- **Tests are real and deterministic.** No snapshot tests of large opaque blobs, no
  tests that just assert "didn't throw." Every test should describe a specific
  behavior and fail if that behavior regresses. Fixtures are written to temp
  directories (see `test/fixture.ts` in each package) rather than checked into the
  repo, except `fixtures/demo-app`, which is deliberately a real, readable, versioned
  example.
- **`repograph report`'s and `repograph blast`'s text output is a public,
  CI-asserted contract.** `formatReport` intentionally prints only the analyzed
  directory's basename (not its full path), so the same repo produces byte-identical
  output regardless of where it's checked out — don't reintroduce absolute paths into
  that output without updating the golden fixtures and thinking about why.
- **No new runtime dependencies without a real reason.** `@repograph/core`'s only
  runtime dependency is the TypeScript compiler API (used for parsing, not type
  checking). `@repograph/web`'s only runtime dependency is React. If you're tempted to
  add a graph-layout or charting library, read `packages/web/src/forceLayout.ts`
  first — it may already do what you need, and keeping the viewer dependency-light is
  a deliberate project goal, not an oversight.
- **`tsc --noEmit` and `eslint` must both be clean** (`npm run typecheck`, `npm run
  lint`) before a PR is mergeable. `strict` mode, `noUncheckedIndexedAccess`, and
  `exactOptionalPropertyTypes` are all on — don't work around them with `any` or
  non-null assertions; if a type genuinely needs loosening, do it narrowly and explain
  why in a comment.
- **Coverage thresholds in each package's `vitest.config.ts` are enforced in CI** (90%
  for core, 85% for the CLI, whose `bin.ts` process-entrypoint glue is intentionally
  excluded from the threshold since it has no meaningful branches of its own — new
  logic belongs in a testable module it calls into, not in `bin.ts` itself).

## Before opening a PR

```
npm run build
npm run typecheck
npm run lint
npm run coverage -w packages/core
npm run coverage -w packages/cli
```

All five must pass. CI runs the same commands (across Ubuntu, Windows, and macOS for
the test job) plus a dogfood job that runs the built CLI against `fixtures/demo-app`
and diffs its output against the golden files above — so if you touched CLI output
formatting or the fixture, regenerate those golden files as part of your change.
