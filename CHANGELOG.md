# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
