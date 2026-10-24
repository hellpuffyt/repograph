# Production readiness — repograph

Audit of the `audit/production-readiness` branch. This document records evidence; it does not
award a production-ready label.

## Scope and architecture

npm workspace with three packages: `@repograph/core` (scanner, TypeScript-compiler-API parser,
resolver, module graph, Tarjan SCC cycles, dead exports, blast radius), `packages/web` (React
viewer built into one HTML file) and `packages/cli` (`html`, `serve`, `report`, `blast`, `analyze`).

## Platforms and prerequisites

Node.js >= 18 (`engines`); CI tests Node 20/22. Verified on macOS (Apple Silicon) with Node 24.19.0.
CI matrix (default branch): ubuntu / windows / macOS x Node 20 / 22; Windows not run locally. The
viewer HTML was generated and served; it was not exercised interactively in a browser.

## Clean-clone setup (README "Install")

`git clone`, `npm ci && npm run build`, `npm link -w packages/cli` (into a throwaway npm prefix): all
exit 0. `repograph html ... --entry src/index.ts` printed the README line exactly (8 files, 1 cycle,
7 dead exports); `report` matched; `serve` listened on `127.0.0.1:4392` and returned 200. Core 74 and
CLI 45 tests passed; lint/typecheck 0; tree clean.

Baseline README said `npm install --global repograph` / `npx repograph`; the npm `repograph`
package belongs to a **different author**, so following it installed unrelated code.

## Commands executed (CI-equivalent, local)

| Command | Baseline (main @ 1231d0f) | Audit branch |
|---|---|---|
| `npm ci` / `npm run build` | 0 / 0 | 0 / 0 |
| `npm test -w packages/core` | 0 — 71 passed, 0 failed, 0 skipped | 0 — 74 passed (3 symlink tests skip on Windows only) |
| `npm test -w packages/cli` | 0 — 41 passed | 0 — 45 passed |
| `npm run typecheck` / `npm run lint` | 0 / 0 | 0 / 0 |
| coverage core / cli (lines) | 98.24 % / 94.98 % | 97.89 % / 95.42 % (thresholds met) |
| CI dogfood (`report` exit 1 + exact diff, `blast` exact diff, `analyze` counts) | pass | pass |
| `npm audit --omit=dev` | 0 | 0 |
| `npm audit` (dev) | 19 (3 critical, 13 high, 3 moderate) | 16 (3 critical, 10 high, 3 moderate) — eslint 8 / typescript-eslint 7 / vitest 2 / vite chains need semver-major upgrades |

## Bugs fixed (regression tests: `packages/core/test/scanner-symlinks.test.ts`, `packages/cli/test/serve-security.test.ts`; 6 of 7 fail on baseline)

| Bug | Impact | Fix |
|---|---|---|
| `serve` listened on `*:4173` | repo structure (file names, exports) exposed to the LAN | binds `127.0.0.1`; `--host` opt-in with warning |
| No Host-header check | any website could read the graph via DNS rebinding | non-loopback Host -> 421 |
| `EADDRINUSE` after the banner | "serving ..." printed, then unhandled crash | `listenServer` awaits `listening`; error + exit 1 |
| Scanner followed symlinks | directory link to an ancestor recursed; links outside the root pulled outside files into reports | symlinked dirs skipped; symlinked files must resolve inside |
| README install via npm | installed a stranger's package | install from source |

## Security review

| Area | Finding | Severity | Status |
|---|---|---|---|
| Network exposure / DNS rebinding (`serve`) | see above | High | Fixed |
| File-system confinement (scanner) | symlink escape / loop | Medium | Fixed |
| HTML report injection | analysis JSON injected with `<`, U+2028/2029 escaped (`safeJson`) | Info | Reviewed, existing tests |
| Code execution | sources parsed with the TS compiler API, never executed | Info | Reviewed |
| Supply chain (docs) | unrelated npm package in install instructions | High (docs) | Fixed |
| Workflow permissions | already `contents: read` | Info | none |
| Secrets in tree/history | 4 commits, no hits | Info | none |

## Acceptance checklist

| Item | Expected | Test | Result |
|---|---|---|---|
| Module graph + resolution | internal edges resolved | `core/test/graph,resolver,parser` | pass |
| Cycles (Tarjan) | real cycles only | `core/test/cycles.test.ts`, dogfood | pass |
| Dead exports | re-export/namespace aware, entries exempt | `core/test/deadcode.test.ts`, dogfood | pass |
| Blast radius | BFS dependents + consumed exports | `core/test/blastRadius.test.ts`, dogfood | pass |
| Self-contained HTML | data safely injected | `cli/test/viewer.test.ts` | pass |
| `serve` safe defaults | loopback, Host check, port errors | `cli/test/serve-security.test.ts`, clean clone | pass |
| Scanner confinement | no symlink escape/loop | `core/test/scanner-symlinks.test.ts` | pass |
| `report` exit code 1 on cycles | as documented | dogfood | pass |

## CI status

Default branch (`main` @ 1231d0f): last run `success`. Audit branch: pending until pushed.

## Limitations

Syntactic analysis only (no type checking); workspace package-name imports count as external;
viewer not browser-tested here; dev-toolchain advisories pending major upgrades.

## Tested commit

`7cfac1a78cef7c7b539824e33c5798368f06e0b6` (clean clone), 2026-10-22.

## Classification proposal

**Partially Verified** — CLI/core verified locally and from a clean clone; audit-branch CI
(incl. Windows) and an interactive browser check of the viewer are outstanding.
