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

/** One narrated parameter clause (e.g. "Arc central angle is 72.3°"), with
 * an optional colored reference-range badge when a normal band is known.
 * `key` (the raw p1..p9 calculator key) and `type` let grading code that
 * runs after the narrative is built (e.g. sacral slope, graded once its own
 * vertebra's narrative already exists) find the right clause and attach a
 * badge to it via narrative.ts's withRangeBadge — see diagnosis-store.svelte.ts. */
export type NarrativeClause = {
	key: string;
	type: 'linear' | 'angular';
	text: Localized;
	badge?: { display: Localized; severity: Severity };
};

export type ParametersNarrative = {
	identity: Localized;
	clauses: NarrativeClause[];
};

export type VertebraDiagnosis = {
	id: string;
	findings: Finding[];
	/** Precomputed, structured list of parameter clauses for this vertebra —
	 * see diagnosis/narrative.ts. The qualitative verdict is conveyed both by
	 * `findings`' own cards and, per-clause, by each clause's optional
	 * reference-range badge. */
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
