# Testing strategy

## Current state

`vitest` + `@vitest/browser-playwright` are configured for unit tests (`npm run test:unit`), Playwright for e2e (`npm run test:e2e`), and `npm test` runs both. In practice: one e2e test (`e2e/demo.test.ts`) that asserts an `h1` is visible. No `*.test.ts`/`*.spec.ts` files exist anywhere else in the repo — zero unit test coverage.

This is the standout weak spot in an otherwise clean codebase (see [architecture.md](architecture.md)), and it's particularly notable given how much pure, clinically-consequential math the app contains.

## Highest-value first targets

These are pure functions — no DOM, no Svelte component harness needed, cheap to write, and they compute the numbers a doctor will read off the `measure`/`report` pages. A wrong wedging angle or Cobb angle here is a clinical-safety bug, not a cosmetic one.

1. **`shared/geometry/geometry.ts`** — `solveCircleFit`, `angleBetweenVectors`, `getPolygonCenter`, `getMidpoint`, etc. Easy to test with hand-computed fixtures (e.g. three points on a known circle of known radius; two perpendicular vectors should yield 90°).
2. **`medical-parameters/calculators/{vertebras,spine,gaps,segments}.ts`** — feed fixed 4-point polygons (or small polygon arrays) and assert the expected mm/degree outputs against hand-calculated or clinically-sourced expected values. See [diagnostic-pipeline.md](diagnostic-pipeline.md) for exactly what each `p1..p9` represents.
3. Once a rule-evaluation module is built per [clinical-rules-reference.md](clinical-rules-reference.md): feed known parameter values, assert the documented diagnosis code/phrase comes out. Equally pure-function-testable.

## Second tier: interaction tests

- Polygon drag-and-drop and add/select/delete logic in `features/editor/core/instance-container.svelte.ts` / `controllers/edit.svelte.ts`.
- Undo/redo in `controllers/history.svelte.ts`.

## Third tier: e2e happy path

A full upload → patient → edit → measure → report run is valuable, but more valuable once backend integration exists (see [backend-integration.md](backend-integration.md)) — today it would only exercise the manual-annotation-only path, which is real but partial (no AI segmentation step to test).

## Recommendation

If only one thing gets done: write unit tests for the four calculator files and `geometry.ts` first. They're the cheapest tests to write in the repo and cover the code most directly responsible for what ends up in front of a doctor.
