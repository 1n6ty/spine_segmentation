import type { Localized } from '$lib/core/i18n/types';

export type { LocaleKey, Localized } from '$lib/core/i18n/types';
import type { RankedDiagnosis } from './conclusion';
export type { RankedDiagnosis } from './conclusion';

export type Severity = 'normal' | 'grade1' | 'grade2' | 'grade3' | 'grade4' | 'grade5';

/** A clinical reference band for a numeric parameter. ±Infinity for an
 * open-ended bound (e.g. "> -35°" has no upper limit). `center`, when set,
 * requests "{center} ± {tolerance}" display instead of "{min}–{max}" — only
 * for ranges genuinely defined that way in the source (zero-centered
 * thresholds, mean±SD tables), not just any range that happens to have a
 * midpoint. */
export type Range = { min: number; max: number; center?: number };

export type Finding = {
	id: string;
	severity: Severity;
	text: Localized;
};

/** One narrated parameter clause — either the generic fallback ("Arc
 * central angle is 72.3°.", `severity: 'normal'`, no badge) or, once a
 * grading rule has run for this parameter, the clinic doc's own
 * Описание-sourced Finding text ("Vertebral body wedge-deformed, base
 * posterior, angle 6.2°.") shown plain, with its normal range attached as
 * a separate colored badge ("normal −1° to 1°", `severity` the real
 * grade) — see narrative.ts's withClauseFinding. `key` (the raw p1..p9
 * calculator key) and `type` let grading code that runs after the
 * narrative is built (e.g. sacral slope, graded once its own vertebra's
 * narrative already exists) find the right clause to replace — see
 * diagnosis-store.svelte.ts. */
export type NarrativeClause = {
	key: string;
	type: 'linear' | 'angular';
	text: Localized;
	severity: Severity;
	badge?: Localized;
};

export type ParametersNarrative = {
	identity: Localized;
	clauses: NarrativeClause[];
};

export type VertebraDiagnosis = {
	id: string;
	/** Not rendered as its own alert-card list any more — the narrative
	 * below already carries each graded finding's text inline. Still used
	 * internally: feeds collectConclusionFindings (→ `conclusion`) and the
	 * conclusion module's per-diagnosis symptom tallying, which looks up
	 * specific findings by id. */
	findings: Finding[];
	/** Precomputed, structured list of parameter clauses for this vertebra —
	 * see diagnosis/narrative.ts. */
	narrative: ParametersNarrative;
};

export type GapDiagnosis = {
	id: string;
	findings: Finding[];
	narrative: ParametersNarrative;
};

export type RegionDiagnosis = {
	id: string;
	label: Localized;
	vertebraeLabel: string;
	vertebrae: VertebraDiagnosis[];
	gaps: GapDiagnosis[];
	findings: Finding[];
	narrative: ParametersNarrative;
	/** One level deep only, by contract: populated solely for the sagittal
	 * thoracic container (its 3 clinical sub-arcs). Never set on the
	 * sub-regions themselves, or on any other region. */
	subRegions?: RegionDiagnosis[];
};

export type ProjectionDiagnosis = {
	insufficientAnnotation: boolean;
	regions: RegionDiagnosis[];
	/** Whole-spine findings that aren't tied to a single region, e.g. GCoM lateral balance. */
	overall: Finding[];
	conclusion: Finding[];
	/** Top-5 (+ "Others") ranked named diagnoses — see diagnosis/conclusion.ts. */
	conclusionRanking: RankedDiagnosis[];
};
