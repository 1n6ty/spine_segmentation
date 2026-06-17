# Clinical rules reference

Three reference documents sit in the `SpineSeg` repo root (not in `docs/`, left as-is since they're the user's own source material, not generated documentation):

- `Классификация кифозов таблица.doc.pdf` ("My classification of...")
- `TABLREHTG.docx.pdf` ("Computer diagnostics of spine pathology from X-rays")
- `Описание спондилограмм во фронтальной плоскости.docx.pdf` ("Description of spondylograms in the frontal plane")

Together these are a **deterministic, threshold-based rule engine**: numeric angle/distance parameter → coded range → diagnostic text phrase. This is exactly the missing piece for the report page's diagnostic conclusion (see [diagnostic-pipeline.md](diagnostic-pipeline.md) and [gaps-and-recommendations.md](gaps-and-recommendations.md)), and it maps directly onto parameters the app already computes — no ML model required for a first version.

**Coverage note:** `TABLREHTG.docx.pdf` is 12 pages; only pages 1–5 were reviewed for this audit (enough to confirm structure and content). A follow-up pass should extract the full table into a structured format (JSON/TS) before implementation.

## What each document contains

**`Классификация кифозов таблица.doc.pdf`** (3 pages) — degree-grading tables, sagittal plane:
- Per-region (Cervical C2-C7, Upper/Mid/Lower/whole Thoracic, Lumbar) central-arc-angle bands covering both lordosis-exaggeration (2 grades) and pathological kyphosis (4 grades), in degrees.
- A separate angular-kyphotic-deformity table (4 grades) per region.
- L5 spondylolisthesis grading by L5–S1 disc angle (5 grades, in degrees).
- Cobb-angle scoliosis classification per Chaklin (4 grades: <10°, 11–25°, 26–50°, >50°).

**`TABLREHTG.docx.pdf`** (12 pages, sagittal plane) — numbered parameter table (central arc angle per region, chord inclination, L5/S1 inclination to the Z axis, disc wedging, L4/L5 vertebral slip, etc.), each row giving a coded value range and the resulting text phrase (e.g. "Кифоз средне-грудного отдела усилен 1 ст" / "thoracic kyphosis increased grade 1"). A combinatorial diagnosis-code table follows: specific combinations of per-parameter codes (e.g. `1(0) and 2(0) and ... and 25(0)` → "no deviation from normal detected") map to named diagnoses including Bechterew's disease stages by region. The document explicitly describes itself as a "lock-and-key" rule engine ("Код диагноза формируется автоматически при компьютерной обработки показателей формы и ориентации позвоночника").

**`Описание спондилограмм во фронтальной плоскости.docx.pdf`** (9 pages, frontal plane) — two parts:
1. An **arc-detection algorithm**: climb vertebra-to-vertebra from L4-L5 upward, tracking the sign of the inter-vertebral angle; the first sign change marks the lumbar arc's upper boundary, the next reversal marks the thoracic arc's boundary, and so on. The arc with the largest central angle is "primary," the others "compensatory." Includes a fully worked numeric example.
2. A parameter→code→phrase table: central arc angle (±5° threshold for "no deformity"), arc sign (left/right curve), vertebral wedging angle (±1° threshold), vertebral lateral displacement (>2mm threshold, towards concave/convex side), sacral/L5 endplate tilt, pelvic obliquity via a "bicapital line," GCoM lateral offset (±70mm threshold). Followed by a diagnosis-code list: right/left thoracic/lumbar scoliosis grades 1–4 (structural from grade 3), congenital subtypes, Bechterew's disease.

## Mapping to already-computed parameters

| Clinical rule | Existing code | File |
|---|---|---|
| Cobb angle / curvature grading (Chaklin, kyphosis-by-region) | `p3` (arc central angle) | `medical-parameters/calculators/segments.ts` |
| Vertebral wedging (±1° threshold) | `p5` (wedging angle) | `medical-parameters/calculators/vertebras.ts` |
| Vertebral displacement / spondylolisthesis (>2mm, L5-S1 angle grading) | `p5`/`p6` (displacement), `p7` (L5–S1 special case) | `medical-parameters/calculators/gaps.ts` |
| Sacral slope | `p9` (S1-only) | `medical-parameters/calculators/vertebras.ts` |
| Sagittal balance / GCoM (±70mm threshold) | `p3` | `medical-parameters/calculators/spine.ts` |
| Frontal-plane arc detection (sign-change climb) | **not implemented** | would need new logic; `gaps.ts`/`segments.ts` compute per-pair/per-segment values but nothing currently detects arc boundaries automatically — see the `structures[projection].segments` gap noted in [diagnostic-pipeline.md](diagnostic-pipeline.md) |

## Recommended path

Build a deterministic rule-evaluation module that consumes `params.side`/`params.frontal` (already-computed output of `medical-parameters/store.svelte.ts`), looks up each value against the threshold tables above, and assembles the Russian/English diagnostic phrases for the report page. This can ship entirely client-side, ahead of and independent from the backend's unintegrated `classify` ML module (KNN/Random Forest — see [backend-integration.md](backend-integration.md)), which is better suited as a v2 "second opinion" once there's enough labeled data to outgrow clean threshold rules.

Two prerequisites this path depends on, both already flagged in [gaps-and-recommendations.md](gaps-and-recommendations.md):
1. The frontal-plane arc-detection algorithm needs to actually be implemented — today `segments` has no producer.
2. The full 12-page sagittal table needs transcribing before its rules can be coded against.
