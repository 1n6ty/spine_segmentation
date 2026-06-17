# Gaps & recommendations

Prioritized, ticket-shaped. Each item links to the doc with full detail.

## P0 — blocking or clinically risky

1. **Backend segmentation/parse utilities deleted from disk.** `backend/Mainland/Dicom/utils/parse.py` and `Dicom/utils/segmentation/*` are unstaged-deleted while still imported by `views/dcmparse.py` and `tasks/segmentation.py`. Both `/api/dcm/parse/` and the WebSocket segmentation route crash as a result. Blocks all real frontend↔backend integration. Backend-side fix, not frontend — but everything else in this list that depends on integration is blocked by it. → [backend-integration.md](backend-integration.md)

2. **Report page has zero dynamic content.** It's 100% static placeholder markup — not even wired to the `params` store that `measure` already uses, let alone producing a real diagnosis or supporting PDF/DOCX export. Concrete path: build a rule-evaluation module from the threshold tables in [clinical-rules-reference.md](clinical-rules-reference.md), consuming `params.side`/`params.frontal` (already computed) — entirely client-side, no need to wait on the backend's unintegrated ML `classify` module. → [diagnostic-pipeline.md](diagnostic-pipeline.md), [clinical-rules-reference.md](clinical-rules-reference.md)

3. **`xraysockets.store.ts` has a broken import.** `import { autoPolygons } from "../study/study.store"` points at a file that doesn't exist anywhere in the repo. Currently silent (dead code, nothing imports this store), but it will break the build the instant the commented-out integration code is re-enabled. → [backend-integration.md](backend-integration.md)

4. **No real authentication.** The `(authenticated)` route guard's redirect logic is fully commented out; the login form has no submit handler. Any visitor reaches PHI-bearing pages today. Should be fixed before any use with real patient data. → [security-privacy.md](security-privacy.md)

## P1 — significant functional gaps

5. **Zero live backend wiring.** All API calls (`dicomParser.ts`) and the WebSocket hookup (`xraysockets.store.ts`) are commented out. The intended "AI auto-segments, doctor corrects" workflow doesn't happen — every vertebra polygon must be hand-drawn in `edit` today. → [backend-integration.md](backend-integration.md)

6. **`segments` parameters likely never populate.** `medical-parameters/store.svelte.ts` exposes a `structures[projection].segments` setter, but no code path in the reviewed UI calls it. That means the `segments` tab in `measure` (lordosis/kyphosis arc radius, chord, central angle) is likely always empty in practice. Worth a quick manual run-through to confirm, then either wire up a segment-selection UI or implement the frontal-plane arc-detection algorithm described in [clinical-rules-reference.md](clinical-rules-reference.md) to populate it automatically.

7. **`FileCache` orphan-on-TTL-expiry.** The 24-hour IndexedDB session sweep doesn't clean up the corresponding Cache Storage API file entries, unlike the explicit `delete()`/`clearAll()` paths which do. PHI can persist past its intended retention window. → [security-privacy.md](security-privacy.md)

## P2 — worth doing, not urgent

8. **Near-zero test coverage** on the most clinically consequential code in the repo (the geometry/medical-parameter calculators are pure functions and cheap to test). → [testing-strategy.md](testing-strategy.md)

9. **Unused Cornerstone.js dependency.** `@cornerstonejs/core` and `@cornerstonejs/dicom-image-loader` are installed but never imported; DICOM rendering is a separate hand-rolled canvas pipeline. Either finish the planned integration or drop the dependency. → [architecture.md](architecture.md)

10. **Naming collision risk.** `features/dicomParser.ts` (commented backend calls + `formatJson2Polygons`) and `features/dicom/parser.ts` (actual DICOM tag extraction) are easy to confuse by name despite very different responsibilities. → [architecture.md](architecture.md)
