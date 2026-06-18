# Architecture

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | SvelteKit 2.50 / Svelte 5.48 | Runes-based reactivity (`$state`, `$derived`, `$effect`) throughout, no Svelte 4 `$:` syntax. |
| Language | TypeScript 5.9, `strict: true` | |
| Build | Vite 7.3 | |
| Adapter | `@sveltejs/adapter-static` (`svelte.config.js`) | `fallback: 'index.html'` — built as a pure client-side SPA, no SSR/server routes are actually used at runtime. |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography`, `@tailwindcss/forms` | |
| DICOM | `dicom-parser` 1.8.21 | Used directly for tag/pixel extraction. |
| Geometry/math | `mathjs` 15.1 | Used only for `solveCircleFit`'s linear-system solve (`lusolve`); everything else is plain `Math`. |
| Local persistence | `idb` 8.0 (IndexedDB wrapper) + browser Cache Storage API | Two separate stores — see below. |
| i18n | `svelte-i18n` 4.0 | `ru-RU` and `en-US` locale files under `src/lib/core/i18n/`. |
| Testing | Vitest 4 + `@vitest/browser-playwright`, Playwright 1.58 | Configured but essentially unused — see [testing-strategy.md](testing-strategy.md). |

**Notable discrepancy:** `@cornerstonejs/core` and `@cornerstonejs/dicom-image-loader` are listed in `package.json` dependencies, but nothing under `src/` imports `@cornerstonejs/*`. DICOM rendering is a hand-rolled 2D canvas pipeline (`src/lib/features/editor/rendering/main-draw.ts` and `minimap-draw.ts`), not Cornerstone.js. Either this is planned work that never landed, or dead weight in the bundle.

## Routing

```
src/routes/
  +layout.server.ts
  [lang]/                          # locale segment, e.g. /ru-RU/, /en-US/
    +layout.ts, +layout.svelte
    +page.svelte                   # upload + session list (home)
    (public)/
      login/+page.svelte
    (authenticated)/
      +layout.svelte                # client-side auth guard (see below)
      patient/+page.svelte
      edit/+page.svelte
      measure/+page.svelte
      report/+page.svelte
```

`login` now submits real credentials to the backend's session auth, and `(authenticated)/+layout.svelte` redirects to `/login` (client-side, via `onMount`) if no `sessionid` cookie is present. There is **no** `+layout.server.ts` guard — this app is a static SPA (`adapter-static` + SPA fallback), so there's no server at request time to run one against. This guard is a UX heuristic only; the real gap is server-side — see [security-privacy.md](security-privacy.md) and [../../docs/doctor-profile.md](../../docs/doctor-profile.md).

## State management

All state is Svelte 5 runes — no external state library.

- **`core/project.svelte.ts`** — a singleton `Project` holding `session = $state.raw(new SessionService(null))`. This is the app's single root of truth, imported wherever session data is needed.
- **`core/session/session.svelte.ts`** (`SessionService`) — holds `sessionUID`, `lastTimeAccessed`, and a `projections` record with `side`/`frontal` entries, each carrying `hash` (file cache key), `arrayBuffer` (raw DICOM bytes), `patient` (a `PatientService` wrapping parsed metadata), and `polygons` (vertebra annotation data). Three `$derived.by` getters (`mergedPatient`, `mergedStudy`, `mergedSeries`) combine metadata across both projections, preferring the side projection's value and falling back to the frontal projection's when a field is missing — used so the app still shows complete patient info if only one of the two X-rays carries a given DICOM tag.
- **`features/medical-parameters/store.svelte.ts`** — derives computed clinical parameters reactively from `project.session.projections[*].polygons`; see [diagnostic-pipeline.md](diagnostic-pipeline.md) for the calculation details.
- **`core/i18n/index.svelte.ts`** — locale store.

## Local persistence (two separate mechanisms)

1. **`features/dicom/cache.ts` (`FileCache`)** — uses the browser **Cache Storage API** (`caches.open('dicom-storage-v1')`), not IndexedDB. Files are keyed by a SHA-256 hash of their content (`generateHash`, `shared/utils/file.ts`), which gives free deduplication: re-uploading the same file returns the existing hash without rewriting.
2. **`core/session/registry.svelte.ts`** (`RegistryService`, exported singleton `registry`) — uses IndexedDB via `idb`. Stores one row per session (`SessionValue`: sessionUID, thumbnail blob, patient brief, per-projection `{ hash, polygons }`), indexed `by-last-accessed`. On construction it sweeps and deletes any session row older than `TTL = 24 * 60 * 60 * 1000` ms — **24 hours**, not the 7 days a stale draft document once claimed.

`SessionService.requestSave()` debounces writes to `registry` by 500ms and generates a 128×128 JPEG thumbnail via `OffscreenCanvas` for the session list.

See [security-privacy.md](security-privacy.md) for a gap in how these two stores interact on TTL expiry.

## Folder conventions

- **`core/`** — singletons and infrastructure: `i18n`, `network` (CSRF token helper), `session` (`SessionService` and its sub-entities `patient`/`study`/`series`/`sopInstance`/`researcher`), `project.svelte.ts`.
- **`features/`** — domain logic, one folder per feature: `dicom` (parsing, caching, bitmap rendering), `editor` (canvas interaction split into `core/controllers` for edit/history/nav state, `rendering` for draw functions, `logic` for polygon ordering/selection), `autofill` (the magic-button orchestration — DSL cache-check, upload, segmentation WebSocket, point-order normalization; see [../../docs/autofill-integration.md](../../docs/autofill-integration.md)), `medical-parameters` (`calculators/`, `store.svelte.ts`, `config.ts`, `types.ts`, `locale.ts` (shared `LocaleKey`/`Localized` types), `regions.ts` (fixed anatomical regions, shared by the `measure` page's segments tab and the diagnosis engine), and `diagnosis/` — the rule-based diagnosis-text engine powering the report page, see [clinical-rules-reference.md](clinical-rules-reference.md)).
- **`shared/`** — `geometry` (pure math, no Svelte/DOM dependency), `utils` (file hashing, patient helpers).
- **`components/`** — `layout/` for page-section components (`Measurements/*`, `PatientInfo/*`, `Header`/`Footer`/`ProfileBar`), `ui/` for generic widgets (`Button`, `DicomUploadCard`, `Editor/Container.svelte`, `Sessions/{Card,Manager}.svelte`, `Nav`).
- **`stores/websocket/`** — `websocket.store.ts` (generic reconnecting-socket factory) + `xraysockets.store.ts` (`createSegmentationSocket`, a thin typed wrapper for the segmentation WebSocket).

Naming convention: reactive class/store files use the `.svelte.ts` suffix (Svelte 5's signal for "this file uses runes"); everything else is plain kebab-case TypeScript. One naming collision worth knowing about: `features/dicomParser.ts` (top-level) and `features/dicom/parser.ts` are two different files with different responsibilities — see [gaps-and-recommendations.md](gaps-and-recommendations.md).
