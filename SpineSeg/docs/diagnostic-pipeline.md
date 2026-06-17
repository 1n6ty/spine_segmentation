# Diagnostic pipeline

The app's purpose is a 5-screen flow: upload a spine X-ray, verify the patient, annotate/correct vertebra outlines, review computed geometric parameters, and (intended, not yet built) get a text-based first diagnosis. This doc walks each screen with exact file references, then documents precisely what the medical-parameter calculators compute.

## 1. Upload (`routes/[lang]/+page.svelte`)

`DicomUploadCard` (`components/ui/DicomUploadCard/`) and `Sessions/Manager.svelte` + `Card.svelte` (session list). Selecting a file calls `SessionService.uploadFile(file, projection)` (`core/session/session.svelte.ts`), which:
1. Hashes and stores the raw file via `FileCache.save` (Cache Storage API).
2. Reads it into an `ArrayBuffer` and parses it immediately, client-side, with `dicom-parser` (`dicomParser.parseDicom(...)`).
3. Wraps the parsed dataset in a `PatientService`.
4. Debounce-saves session metadata to IndexedDB via `registry`.

No AI segmentation happens at this point — see [backend-integration.md](backend-integration.md) for why.

## 2. Patient (`(authenticated)/patient/+page.svelte`)

`PatientInfo.svelte` / `InfoBlock.svelte` render `project.session.mergedPatient` / `mergedStudy` / `mergedSeries`. Fields are pulled straight from DICOM tags in `features/dicom/parser.ts`:

- `parsePatientFromDicom`: PatientUID (`x00100020`), name (`x00100010`), birth date (`x00100030`), sex (`x00100040`).
- `parseStudyFromDicom`: study UID (`x0020000d`), study date (`x00080020`), description (`x00081030`), physician name (`x00080090`), institution name/address (`x00080080`/`x00080081`), station name (`x00081010`).
- `parseSeriesFromDicom`: series UID (`x0020000e`), modality (`x00080060`), body part (`x00180015`).

If both projections are loaded and one is missing a field, `mergedPatient`/`mergedStudy`/`mergedSeries` (the `$derived.by` getters in `SessionService`) fill it from the other.

## 3. Edit (`(authenticated)/edit/+page.svelte`)

Renders one `XrayEditorCard` (`components/ui/Editor/Container.svelte`) per loaded projection. This is a hand-rolled 2D canvas editor (not Cornerstone.js — see [architecture.md](architecture.md)):

- `InstanceContainer` (`features/editor/core/instance-container.svelte.ts`) composes three controllers: `nav` (pan/zoom/wheel, `controllers/nav.svelte.ts`), `edit` (point dragging, add/select/delete polygon, draw mode, `controllers/edit.svelte.ts`), `history` (undo/redo, `controllers/history.svelte.ts`).
- `drawMain`/`drawMinimap` (`features/editor/rendering/`) paint the parsed pixel bitmap plus the polygon overlay onto two `<canvas>` elements (main view + minimap).
- Every vertebra is a 4-point polygon (the four body corners). `editor/logic/orderer.ts` and `selection.ts` handle point ordering and hit-testing.
- Editing a point mutates `project.session.projections[projection].polygons` directly; because everything downstream reads from that same reactive array, the `measure` page recomputes instantly.

## 4. Measure (`(authenticated)/measure/+page.svelte`)

The one page that is fully wired to live data. Imports `params` from `medical-parameters/store.svelte.ts`; `Navigation.svelte` switches `params.activeStructure` between `vertebras`/`gaps`/`segments`/`overall`; `View.svelte`/`Table.svelte`/`OverallSpine.svelte` render whichever is active. Recomputation is automatic — Svelte reactivity, no manual invalidation.

## 5. Report (`(authenticated)/report/+page.svelte`)

**Not wired to any data.** The entire page is static hardcoded markup: literal Russian placeholder text (`Отдел 1`, `Позвонок 1`, `Параметр 1 - значение с текстовым описанием`, `Текст заключения`), and PDF/DOCX buttons with no click handlers. The only real, non-placeholder content is a static medical disclaimer paragraph ("this report is generated automatically... for educational/screening purposes only... does not replace professional diagnosis"). See [gaps-and-recommendations.md](gaps-and-recommendations.md) and [clinical-rules-reference.md](clinical-rules-reference.md) for how to close this gap.

## Medical-parameter calculators

All four calculator files share the same shape: `get*Params(projection, input, mmPerPixel)` returning `{ name, params: { p1..p9: { val, type } } }`, where `type` is `"linear"` (mm) or `"angular"` (degrees). Geometry primitives live in `shared/geometry/geometry.ts` and `mathjs` is used only inside `solveCircleFit`.

- **`geometry.ts`** — `distance`, `vectorSub`, `dotProduct`, `vectorNorm`, `angleBetweenVectors` (acos of normalized dot product), `angleBetweenPoints` (atan2 slope), `getPolygonCenter`, `getMidpoint`, `solveCircleFit` (least-squares fit of `x²+y²+ax+by+c=0` via the normal equations, solved with `mathjs.lusolve`), `getArcRadius`.

- **`calculators/vertebras.ts`** (`getVertebraeParams`) — per-vertebra, from its 4 corner points. Side projection: `p1`/`p2` superior/inferior endplate length, `p3`/`p4` anterior/posterior body height, `p5` wedging angle (angle between top-edge and bottom-edge vectors), `p6`–`p8` contour/endplate inclination to the vertical (Z) axis, `p9` sacral slope — computed only when `v.id === "S1"`, via `asin` of the endplate's vertical component. Frontal projection: analogous `p1`–`p9` (right/left contour heights, central height via midpoint distance, frontal wedging angle, central-line inclination).

- **`calculators/gaps.ts`** (`getGapParams`) — per adjacent vertebra pair (`top`, `bottom`): `p1` intervertebral angle, `p2`/`p3` anterior/posterior disc height, `p4` disc wedging angle, `p5`/`p6` linear/angular displacement of the upper vertebra relative to the lower in the disc plane (a spondylolisthesis proxy, computed via dot-product projection), `p7` a special term active only for the L5–S1 pair (angle between L5's anterior contour and S1's endplate).

- **`calculators/segments.ts`** (`getSegmentParams`) — given an arbitrary contiguous run of vertebrae (a "segment"): collects all their corner points, fits a circle (`solveCircleFit`), derives `p1` arc radius, `p2` chord length (distance between the segment's end midpoints, capped at the diameter), `p3` central angle (`acos` from radius/chord), `p4` chord inclination to vertical. This is the lordosis/kyphosis curvature math.

- **`calculators/spine.ts`** (`getSpineParams`) — requires ≥24 annotated vertebrae (a fully-marked spine); computes `p1` Th1–L5 trunk-axis inclination, `p2` trunk-axis length, `p3` a GCoM-style lateral-deviation term (`distance × sin(angle)`).

- **`medical-parameters/store.svelte.ts`** orchestrates all four: `structures.{side,frontal}.vertebras` reads polygons directly; `.gaps` is auto-derived from adjacent polygon pairs; `.segments` has a getter/setter but **no code path found in the reviewed UI actually calls the setter** — meaning the `segments` tab in `measure` likely has nothing to show today (see [gaps-and-recommendations.md](gaps-and-recommendations.md)). `params.calculate(projection)` combines everything with `mmPerPixel` (from the DICOM `PixelSpacing`/`ImagerPixelSpacing` tag, set in `extractDicomData`, `features/dicom/parser.ts`).

- **`medical-parameters/config.ts`** holds bilingual (`ru-RU`/`en-US`) human-readable names and unit type for every `p1..p9` key, per structure and per projection — this is what `measure`'s `Table.svelte` uses for labels. The `report` page does not reference this file at all currently.
