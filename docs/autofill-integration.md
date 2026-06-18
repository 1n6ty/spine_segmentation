# Autofill ("magic button") integration

Lets a doctor click one button on a projection (lateral or frontal) in the editor and get AI-generated vertebra polygons instead of drawing them by hand, by talking to three already-implemented backend endpoints. No backend changes were made for this — see [backend-architecture.md](backend-architecture.md) for how those endpoints work server-side, and [doctor-profile.md](doctor-profile.md) for a correction about what login does and doesn't gate.

## Flow

Entry point: the magic `<Button>` in `src/lib/components/ui/Editor/Container.svelte`, handled by `handleMagicClick()` in that component, which calls `runAutofill()` in `src/lib/features/autofill/autofill.ts`.

1. **Confirm before overwrite.** If the target projection already has polygons (`project.session.projections[projection].polygons.length > 0`), a native `confirm()` dialog asks before continuing. (Per explicit instruction — no overwrite happens silently.)
2. **Status → `checking`.** `POST /api/dsl/select/` with:
   ```json
   { "dataset": "dicom_images", "select": ["ref_points"], "filter": { "field": "sop_uid", "op": "eq", "value": "<sopInstanceUID>" } }
   ```
   This schema was verified against `DSL/v1/schemas/dsl.py` and `DSL/datasets/dicom_images.py` directly — it's a real, implemented endpoint, not a guess.
3. **Cache hit** (`meta.total_items > 0`): take `result[0].ref_points` directly, skip to step 6. This covers the case where the image was already segmented in a previous session (the backend keeps `reference_points` on the `DicomImage` row indefinitely).
4. **Cache miss → status `uploading`.** Open the segmentation WebSocket *first* (`ws/dcm/segment/{sopInstanceUID}/`, relative URL so it works over both `ws://` in dev and `wss://` behind TLS in prod, no env var needed), then `POST /api/dcm/parse` as multipart with the projection's DICOM bytes — reconstructed as a `File` from the `ArrayBuffer` already cached in `SessionService` (the original browser `File` object isn't retained after the initial upload, only its bytes+hash are).
5. The socket relays whatever the Celery task (`segment_vertebraes`) broadcasts: `segmentation.processing` → status `segmentation.processing`, `saving` → status `saving`, `done` → resolves with `ref_points` and closes the socket. If the socket closes for any other reason first, the flow rejects with an error.
6. **Convert + normalize.** `formatJson2Polygons()` (`src/lib/features/dicomParser.ts`) converts `{vertebraes: [{name, points}]}` into this app's `Polygon[]` shape. The result is then **always** run through `orderAndName()` (`src/lib/features/editor/logic/orderer.ts`) before being returned — never trusted as-is.
7. **Status → `done`**, the returned `Polygon[]` is assigned to `project.session.projections[projection].polygons`, and `project.session.requestSave()` persists it. The overlay then resets to idle after ~800ms. On any failure, status → `error`, the loading overlay shows the message with a dismiss button, and the magic button re-enables for a retry.

## Why every AI result goes through `orderAndName()`

`orderAndName()` is the same function that normalizes manually-drawn polygons — proven (in earlier work on this codebase) to reorder *any* input point sequence into this app's `[bottom-left, top-left, top-right, bottom-right]` convention, which every calculator under `medical-parameters/` depends on. `Dicom/utils/segmentation/` (where the YOLO postprocessing and its own point/name convention live) was intentionally not read, so the backend's raw output is treated as untrusted input with unknown ordering — exactly like a freshly hand-drawn polygon would be. This sidesteps needing to know the backend's internal convention at all: whatever order it emits, the same normalizer that's already trusted for manual input is applied uniformly.

One consequence: `orderAndName()` also re-derives each vertebra's name from its position in the chain (`S1, L5, L4, ..., C2`), so whatever `name` the backend assigns per-vertebra is discarded and replaced. This is existing behavior, unchanged by this integration — see `vertebraeNames` in `orderer.ts`.

## What changed vs. the original (unfinished) attempt

The previous draft (`lib/stores/websocket/xraysockets.store.ts` + `lib/features/dicomParser.ts`) had several issues, fixed in this pass:

- `xraysockets.store.ts` imported a non-existent `../study/study.store` (an `autoPolygons` global store that was never created) — the whole module failed to even type-check. Rewritten to take plain callbacks (`onStatus`, `onDone`, `onClose`) instead of writing into a shared store; the caller (autofill orchestration) now updates `project.session` directly.
- The WS URL was hardcoded to `wss://${env.PUBLIC_DOMAIN}`, an env var that doesn't exist anywhere in this project. Replaced with a relative URL, which browsers resolve against the current page's scheme/host automatically.
- `formatJson2Polygons` was missing the `uuid` field required by the `Polygon` type (a real type/runtime mismatch, not just a lint issue).
- The magic button and its loading overlay were fully commented out in `Container.svelte`, and the commented code itself referenced an undeclared `magicPressed` variable and a non-existent `$processingStatusStore`.
- `src/lib/core/session/autosegmentation.svelte.ts` was an orphaned, syntactically-incomplete stub (a dangling `this.projectionState.` with no continuation) that nothing referenced — deleted rather than completed, since the orchestration now lives in `autofill.ts`.

## Files

- `src/lib/features/autofill/autofill.ts` — orchestration (`checkCache`, `uploadAndSegment`, `runAutofill`).
- `src/lib/features/dicomParser.ts` — `formatJson2Polygons`, the data-shape conversion only.
- `src/lib/stores/websocket/xraysockets.store.ts` — `createSegmentationSocket`, thin wrapper over the generic `createSocket()` factory in `websocket.store.ts`.
- `src/lib/components/ui/Editor/Container.svelte` — the button, the confirm-before-overwrite check, and the loading/error overlay.
- New i18n keys: `editor.autofill_confirm_overwrite`, `editor.loading.checking`, `editor.loading.uploading`, `editor.loading.error` (existing: `editor.loading.segmentation.processing`, `editor.loading.saving`, `editor.loading.done`).
- Tests: `src/lib/features/autofill/autofill.test.ts` — cache-hit vs. cache-miss branching, socket-close-without-done rejection, and a point-order invariance test (feeding the same vertebrae with cyclically-shifted input point order and asserting the final output is identical, demonstrating the `orderAndName` safety net actually holds through the full `runAutofill` call, not just in isolation).

## Known limitation: no live end-to-end test

Exercising the real flow needs MySQL, Redis, Celery, and the actual YOLO model weight files running via Docker Compose — not attempted in this environment. Verification here is: the unit tests above (with mocked `fetch`/WebSocket), `svelte-check` showing no new type errors, and manual review of the request/response shapes against the backend source directly (not assumed). If a running backend stack becomes available, this flow should be exercised by hand against it before considering it fully verified.
