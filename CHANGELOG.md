# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security

- `repograph serve` bound every interface (`*:4173`) and answered any `Host`
  header; it now binds `127.0.0.1` by default (`--host` to change, with a warning)
  and rejects non-loopback `Host` headers (DNS rebinding) with 421.
- The scanner followed symlinks: a directory link to an ancestor recursed
  without end and links pointing outside the root pulled outside files into the
  report. Symlinked directories are skipped; symlinked files must resolve inside.

### Fixed

- TypeScript ESM imports that name the emitted file (`import "./graph.js"` for
  `graph.ts`, the node16/nodenext convention) were treated as unresolved, so a
  codebase written that way showed no internal edges and every export as dead.
  `.js`/`.jsx`/`.mjs`/`.cjs` specifiers now fall back to the matching TS source.
- `repograph serve` on a busy port printed "serving" and then crashed with an
  unhandled `EADDRINUSE`; it now reports the error and exits 1. `--port` is validated.

### Documentation

- The README no longer says `npm install --global repograph` / `npx repograph`:
  that npm package is an unrelated project.

## [0.1.0] - 2026-09-01

### Added

- `@repograph/core`: a dependency-free analysis engine — recursive source-file
  scanning, syntactic import/export parsing (TypeScript compiler API), internal
  import-specifier resolution, module-graph construction, Tarjan SCC-based circular
  dependency detection, dead-export detection (aware of default/namespace/type-only
  imports and re-exports), and blast-radius BFS with consumed-export reporting.
- `repograph` CLI with five commands: `analyze` (raw JSON), `report` (human-readable
  text summary, exit code reflects whether cycles were found), `blast` (blast-radius
  query for one file), `html` (writes a self-contained interactive HTML graph), and
  `serve` (serves the same viewer over HTTP, re-analyzing on every request).
- `@repograph/web`: an interactive graph viewer (React + a hand-written canvas
  force-directed layout) built into a single self-contained HTML file, with file
  search/filtering, dead-code and cycle badges, an API-surface + blast-radius detail
  panel, and a light/dark theme toggle.
- `fixtures/demo-app`: a small, deterministic example codebase (one import cycle,
  several dead exports, a couple of hub files) used by the test suite and by CI's
  dogfood job, which asserts the CLI's text output against it byte-for-byte.
