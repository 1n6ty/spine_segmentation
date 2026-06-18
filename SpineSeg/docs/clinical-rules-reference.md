# Clinical rules reference

The clinical source documents live in `clinic/` (originally PDFs only; the original `.doc`/`.docx` files were added later, letting a previously-garbled table be re-extracted cleanly — see below):

- `Классификация кифозов таблица.doc` ("My classification of...")
- `TABLREHTG.docx` ("Computer diagnostics of spine pathology from X-rays")
- `Описание спондилограмм во фронтальной плоскости.docx` ("Description of spondylograms in the frontal plane")

Together these are a **deterministic, threshold-based rule engine**: numeric angle/distance parameter → coded range → diagnostic text phrase. **This is now implemented** in `src/lib/features/medical-parameters/diagnosis/` and powers the report page's diagnostic conclusion (see [diagnostic-pipeline.md](diagnostic-pipeline.md)) — entirely client-side, no ML model needed for v1.

**Confirmed sign convention** (found while re-extracting `Описание спондилограмм...docx` directly via Python `zipfile`+XML, since no `pandoc`/`antiword` was available to convert it): the document states explicitly *"Знак (-) отражает угол отклонение прямой от вертикали почасовой стрелки"* — "negative sign = clockwise deviation from vertical." This confirms the app's CCW-positive convention (see [diagnostic-pipeline.md](diagnostic-pipeline.md)) isn't an arbitrary choice — it's the source documents' own stated convention.

## What each document contains

**`Классификация кифозов таблица.doc`** (3 pages) — degree-grading tables, sagittal plane:
- Per-region (Cervical C2-C7, Upper/Mid/Lower/whole Thoracic, Lumbar) central-arc-angle bands covering both lordosis-exaggeration (2 grades) and pathological kyphosis (4 grades), in degrees.
- A separate angular-kyphotic-deformity table (4 grades) per region.
- L5 spondylolisthesis grading by L5–S1 disc angle (5 grades, in degrees).
- Cobb-angle scoliosis classification per Chaklin (4 grades: <10°, 11–25°, 26–50°, >50°).

**`TABLREHTG.docx`** (sagittal plane, fully reviewed, cleanly re-extracted) — numbered parameter table (central arc angle per region, chord inclination, L5/S1 inclination to the Z axis, disc wedging, L4/L5 vertebral slip, sacral slope, Bechterev's/Scheuermann's/fracture/spondylolisthesis combinatorial diagnosis codes, a cervical-specific diagnosis-code table), each row giving a coded value range and the resulting text phrase. Two findings from the clean re-extraction:
- The disc-angle-by-vertebral-level norm table (garbled in the PDF) is now readable (e.g. "L5-S1: -106.41°±7.0°", "Th1-Th2: 0.4°", decreasing through the thoracic region) — but its magnitude doesn't match any parameter currently computed (too large to be `gaps.ts`'s small wedge-style intervertebral angle). It likely corresponds to a *different* row in this same document ("11 | Угол между L5 и S1 | normal band -97.5° to -117°" — matches the table's L5-S1 value almost exactly), which in turn isn't what `gaps.ts`'s L5 spondylolisthesis input (`p7`, "угол наклона диска L5-S1") was assumed to be either. **Not implemented** — needs your input on the exact geometric definition before it can be wired to anything; implementing on a guess here would mean guessing clinical logic.
- The vertebral-body-height norm table, also previously suspected garbled, is confirmed **genuinely blank** in the original (`мм ± мм` placeholders, never filled in by the source's author) — nothing to extract, not a transcription problem.

**`Описание спондилограмм во фронтальной плоскости.docx`** (frontal plane) — two parts:
1. An **arc-detection algorithm**: climb vertebra-to-vertebra from L4-L5 upward, tracking the sign of the inter-vertebral angle, to find actual scoliotic curve boundaries (which don't follow fixed anatomical regions).
2. A parameter→code→phrase table: central arc angle (±5° threshold for "no deformity"), arc sign (left/right curve — code 1/(-) = left, code -1/(+) = right), vertebral wedging angle (±1° threshold, code 1/(+) = base right, code -1/(-) = base left), vertebral lateral displacement (>2mm threshold), sacral/L5 endplate tilt, pelvic obliquity via a "bicapital line," GCoM lateral offset (±70mm threshold).

**Also found, not implemented**: `TABLREHTG.docx`'s sagittal cervical-specific diagnosis-code table (sliding dislocation, tipping subluxation, fracture, disc rupture, degenerative disc lesion — coded combinations of "parameters 1-8") references parameters that aren't defined anywhere in the extracted text. Implementing this would mean guessing what those 8 parameters are; skipped.

## Implementation (`medical-parameters/diagnosis/`)

- **`medical-parameters/regions.ts`** (moved up from `diagnosis/regions.ts` once the `measure` page's segments tab needed the same regions — see [diagnostic-pipeline.md](diagnostic-pipeline.md)) — fixed anatomical regions (Cervical C2-C7, Thoracic Th1-Th12, Lumbar L1-L5), sliced against the *guaranteed* vertebra ordering enforced by `features/editor/logic/orderer.ts` (`polygons[0]` is always S1 ascending to `polygons[23]` = C2, whenever all 24 are annotated; confirmed empirically, not just by reading the code).
- **`rules/sagittal.ts`** / **`rules/frontal.ts`** — one explicit if/else chain per rule (not a shared generic table-lookup helper — an earlier generic-helper attempt silently mismatched severity/text because some source tables increase in severity as the value *increases* and others as it *decreases*; explicit chains are easier to verify line-by-line against the source and were kept after the bug was found and fixed).
- **`store.svelte.ts`** — assembles per-region, per-vertebra, and per-gap findings into a `ProjectionDiagnosis`, with a "no deviations detected" fallback mirroring the source documents' own fallback row.
- Unit tests (`rules/sagittal.test.ts`, `rules/frontal.test.ts`) cover every grading function against known threshold values — the first real test coverage in this repo, per [testing-strategy.md](testing-strategy.md).

### Mapping to already-computed parameters

| Clinical rule | Existing code | File |
|---|---|---|
| Regional kyphosis/lordosis grading (sagittal) | `p3` (arc central angle), sliced per fixed region | `medical-parameters/calculators/segments.ts` |
| Chaklin scoliosis grading (frontal) | same `p3`, applied to fixed regions instead of detected arcs | `medical-parameters/calculators/segments.ts` |
| Vertebral wedging (sagittal: Scheuermann's/fracture combinatorial; frontal: ±1° threshold) | `p5` (side) / `p6` (frontal) | `medical-parameters/calculators/vertebras.ts` |
| Sacral slope, L5 inclination | `p9` (S1-only), `p7` | `medical-parameters/calculators/vertebras.ts` |
| L5 spondylolisthesis grading | L5-S1 gap's `p7` special case | `medical-parameters/calculators/gaps.ts` |
| Frontal lateral vertebral displacement (>2mm threshold) | `p1` (was `p5` before the gaps.ts slot-swap fix — see below) | `medical-parameters/calculators/gaps.ts` |
| GCoM lateral balance (±70mm threshold, frontal only) | `p3` | `medical-parameters/calculators/spine.ts` |

## Deliberate v1 simplifications (not bugs — see code comments at each site)

1. **Fixed anatomical regions instead of dynamic scoliosis-arc detection.** Frontal-plane Chaklin grading is applied to the same Cervical/Thoracic/Lumbar regions as sagittal grading, not to algorithmically-detected curve boundaries. Less clinically precise for scoliosis specifically, but a much smaller implementation and still a meaningful first-pass screen. The arc-detection algorithm above remains unimplemented — it's the natural next step if frontal-plane precision matters more than current v1 delivers.
2. **Page 11's disc-angle-by-level table is skipped** (garbled extraction, see above).
3. **Pelvic obliquity ("bicapital line") is not implemented** — no pelvic landmark points exist in the current 4-point vertebra polygon model.
4. **The angular (focal, few-vertebra) kyphosis table is not implemented** — it requires identifying "the deformed segment," which isn't derivable from the fixed 3-region grouping used here.
5. **Vertebral fracture's wedging threshold (>10°) is a conservative judgment call**, not a number from the source (which points at the same garbled table). Should be reviewed against clinical input before relying on it.
6. **Sign-based left/right labeling assumes the source documents' sign convention matches this app's pixel coordinate system.** The app does not track DICOM image laterality metadata, so this is an approximation — see [gaps-and-recommendations.md](gaps-and-recommendations.md).

## Bugs found during the measurements-tab audit — now fixed, with one residual concern

An audit of the underlying calculators (see [diagnostic-pipeline.md](diagnostic-pipeline.md)) fixed several `gaps.ts`/`vertebras.ts`/`segments.ts`/`spine.ts` formula bugs, including making every previously-unsigned angle (`acos`/`angleBetweenVectors`-based) genuinely signed via `getSignedAngle`. That mechanically fixed two consumer bugs in this diagnosis engine that were previously flagged as "needs domain input":

1. ~~L5 spondylolisthesis grading effectively always read "normal."~~ **Mechanically fixed, one open concern remains.** `gaps.ts`'s `p7` is now signed; verified an unslipped baseline reads `+90°` (correctly inside `gradeL5Spondylolisthesis`'s "normal" band), not the old unsigned version's range which made every negative-threshold grade unreachable. **Residual concern, flagged in code at the call site in `diagnosis/store.svelte.ts`:** `p7` measures the angle between L5's contour and S1's endplate, which only changes when the two vertebrae *rotate* relative to each other — a pure *translational* slip (which is what spondylolisthesis fundamentally is) leaves `p7` unchanged. `gaps.ts`'s `p5`/`p6` (which directly measure translational/angular disc displacement) may be the better-suited input. Needs clinical input to confirm, not a further code guess.
2. ~~Frontal scoliosis grading could never report "left-sided."~~ **Fixed.** `segments.ts`'s `p3` (central angle) is now derived from the fitted circle's actual center (`getSignedAngle(start-center, end-center)`) rather than the unsigned law-of-cosines `acos`, so it carries real bulge-direction information — verified with synthetic left-bulging and right-bulging arcs in `segments.test.ts`. The same fix also resolved an equivalent, previously-unnoticed bug on the *sagittal* side: `Sagittal.gradeRegionSagittal`'s lordosis-flattening grades were equally unreachable before this fix, since they also depend on `p3`'s sign.
