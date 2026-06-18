# Testing strategy

## Current state

`vitest` + `@vitest/browser-playwright` are configured for unit tests (`npm run test:unit`), Playwright for e2e (`npm run test:e2e`), and `npm test` runs both. The project's `vite.config.ts` splits unit tests into two projects: `server` (plain `*.test.ts`/`*.spec.ts`, runs in Node) and `client` (`*.svelte.test.ts`/`*.svelte.spec.ts`, runs in a real headless browser via `@vitest/browser-playwright`) — reactive `.svelte.ts` modules are expected to be tested under `client`.

`medical-parameters/diagnosis/rules/{sagittal,frontal}.test.ts` (42 tests) cover every grading function in the diagnosis rule engine, and `medical-parameters/calculators/{vertebras,gaps,segments,spine}.test.ts` (35 tests) now cover the calculator layer too — added during a measurements-tab audit that found and fixed real bugs in `gaps.ts` (wrong corner-pairing badly inflating disc-height readings, swapped parameter slots) and an inconsistent angle sign/zero-point convention across `vertebras.ts`/`segments.ts`/`spine.ts` (see [diagnostic-pipeline.md](diagnostic-pipeline.md)). Beyond that: one e2e test (`e2e/demo.test.ts`) that asserts an `h1` is visible. `shared/geometry/geometry.ts`'s primitives (`solveCircleFit`, `getSignedAngle`, etc.) are still untested directly — only indirectly, through the calculator tests that depend on them.

## Highest-value first targets

These are pure functions — no DOM, no Svelte component harness needed, cheap to write, and they compute the numbers a doctor will read off the `measure`/`report` pages. A wrong wedging angle or Cobb angle here is a clinical-safety bug, not a cosmetic one.

1. ~~`shared/geometry/geometry.ts`~~ — `solveCircleFit`, `getSignedAngle`, `angleBetweenVectors`, `getPolygonCenter`, `getMidpoint`, etc. Still untested *directly* (e.g. no test asserts `getSignedAngle` itself is CCW-positive in isolation) — covered only indirectly via the calculator tests below, which lean on it heavily. Direct tests here would be cheap and would document the sign convention explicitly.
2. ~~`medical-parameters/calculators/{vertebras,spine,gaps,segments}.ts`~~ **Done** — see `medical-parameters/calculators/*.test.ts` (35 tests). Caught real bugs in `gaps.ts` during the same pass (see [diagnostic-pipeline.md](diagnostic-pipeline.md)).
3. ~~Once a rule-evaluation module is built~~ **Done** — see `medical-parameters/diagnosis/rules/*.test.ts`. One thing those tests deliberately don't cover: the full `store.svelte.ts` wiring (region slicing + calculator invocation + conclusion assembly) was instead verified manually via a scripted browser run (upload → annotate 24 vertebrae → report) during implementation, not as a committed automated test — a `*.svelte.test.ts` integration test exercising that store directly (mutating `project.session.projections[...].polygons` with synthetic fixtures and asserting on `diagnosis.side`/`.frontal`) would be a reasonable next addition, run under the `client` Vitest project per the convention above.

## Second tier: interaction tests

- Polygon drag-and-drop and add/select/delete logic in `features/editor/core/instance-container.svelte.ts` / `controllers/edit.svelte.ts`.
- Undo/redo in `controllers/history.svelte.ts`.

## Third tier: e2e happy path

A full upload → patient → edit → measure → report run is valuable. Backend integration now exists (autofill — see [../../docs/autofill-integration.md](../../docs/autofill-integration.md)), with unit coverage for its pure orchestration logic (`autofill.test.ts`: cache-hit/miss branching, socket-close-without-done rejection, point-order invariance), but no e2e run against a live backend stack (MySQL/Redis/Celery/YOLO weights) has been done in this environment — still a gap worth closing once such a stack is reachable.

## Recommendation

The calculators and diagnosis rules now have real coverage (77 tests total: 42 diagnosis-rule tests + 35 calculator tests). If only one thing gets done next: add direct tests for `geometry.ts`'s primitives, and the `client`-project integration test for `diagnosis/store.svelte.ts` described above — the calculator-level fixes already caught real bugs, so the remaining untested seams (raw geometry helpers, and the store wiring that glues calculators to rules) are the next highest-value targets.
