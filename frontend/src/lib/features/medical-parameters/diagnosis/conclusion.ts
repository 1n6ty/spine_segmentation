import { resolve_localized } from '$lib/core/i18n/resolve';
import type { Localized } from '$lib/core/i18n/types';
import type { Finding, Range, Severity } from './types';

/**
 * The named diagnoses this module can score, derived from the real clinical
 * "diagnosis codes" dictionary in Data/clinic/TABLREHTG_Updated.docx
 * (sagittal) and Data/clinic/Описание спондилограмм во фронтальной
 * плоскости.docx.pdf (frontal) — see diagnosis-store.svelte.ts for where
 * each is tallied. Bounded to diagnoses whose required parameters are
 * already computed elsewhere in this module; diagnoses needing data not
 * yet computed (disc-height ratio for osteochondrosis, congenital kyphosis
 * — which has no numeric criteria in the source at all) are deliberately
 * not represented here.
 *
 * The 5 "sag-slipped-dislocation" .. "sag-degenerative-disc" keys are filed
 * under a "шейного отдела" (cervical) heading in the source document, but
 * — confirmed against the document — are actually driven entirely by
 * whole-spine region-level parameters (thoracic sub-arc curves, lumbar
 * curve, chord tilts, L5 inclination, sacral slope), not a direct cervical
 * measurement. See evaluatePattern's call sites in diagnosis-store.svelte.ts.
 */
export type DiagnosisKey =
	| 'sag-bekhterev-cervical'
	| 'sag-bekhterev-thoracic-upper'
	| 'sag-bekhterev-thoracic-mid'
	| 'sag-bekhterev-thoracic-lower'
	| 'sag-bekhterev-thoracic-total'
	| 'sag-bekhterev-lumbar'
	| 'sag-scheuermann'
	| 'sag-spondylolisthesis-l5'
	| 'sag-l4-spondylolisthesis'
	| 'sag-vertebral-fracture'
	| 'sag-slipped-dislocation'
	| 'sag-subluxation'
	| 'sag-cervical-fracture'
	| 'sag-disc-rupture'
	| 'sag-degenerative-disc'
	| 'frontal-scoliosis-thoracic-right'
	| 'frontal-scoliosis-thoracic-left'
	| 'frontal-scoliosis-lumbar-right'
	| 'frontal-scoliosis-lumbar-left';

/**
 * Key actually stored in the tally. Most diagnoses are whole-projection
 * singletons (`DiagnosisKey` alone) but a diagnosis that's inherently
 * localized to one anatomical instance — currently only vertebral fracture,
 * which can occur at any one vertebra — is tracked per-instance as
 * `${DiagnosisKey}:${instanceId}`, so e.g. a fracture at Th7 doesn't get
 * blended into one meaningless spine-wide average with every other
 * vertebra's fracture check. `baseKey` strips the instance suffix back off
 * to resolve the display label.
 */
export type TallyKey = DiagnosisKey | `${DiagnosisKey}:${string}`;

function baseKey(key: TallyKey): DiagnosisKey {
	const i = key.indexOf(':');
	return (i === -1 ? key : key.slice(0, i)) as DiagnosisKey;
}

const DIAGNOSIS_LABEL_KEYS: Record<DiagnosisKey, string> = {
	'sag-bekhterev-cervical': 'diagnosis.conclusion.bekhterevCervical',
	'sag-bekhterev-thoracic-upper': 'diagnosis.conclusion.bekhterevThoracicUpper',
	'sag-bekhterev-thoracic-mid': 'diagnosis.conclusion.bekhterevThoracicMid',
	'sag-bekhterev-thoracic-lower': 'diagnosis.conclusion.bekhterevThoracicLower',
	'sag-bekhterev-thoracic-total': 'diagnosis.conclusion.bekhterevThoracicTotal',
	'sag-bekhterev-lumbar': 'diagnosis.conclusion.bekhterevLumbar',
	'sag-scheuermann': 'diagnosis.conclusion.scheuermann',
	'sag-spondylolisthesis-l5': 'diagnosis.conclusion.spondylolisthesisL5',
	'sag-l4-spondylolisthesis': 'diagnosis.conclusion.spondylolisthesisL4',
	'sag-vertebral-fracture': 'diagnosis.conclusion.vertebralFracture',
	'sag-slipped-dislocation': 'diagnosis.conclusion.slippedDislocation',
	'sag-subluxation': 'diagnosis.conclusion.subluxation',
	'sag-cervical-fracture': 'diagnosis.conclusion.cervicalFracture',
	'sag-disc-rupture': 'diagnosis.conclusion.discRupture',
	'sag-degenerative-disc': 'diagnosis.conclusion.degenerativeDisc',
	'frontal-scoliosis-thoracic-right': 'diagnosis.conclusion.scoliosisThoracicRight',
	'frontal-scoliosis-thoracic-left': 'diagnosis.conclusion.scoliosisThoracicLeft',
	'frontal-scoliosis-lumbar-right': 'diagnosis.conclusion.scoliosisLumbarRight',
	'frontal-scoliosis-lumbar-left': 'diagnosis.conclusion.scoliosisLumbarLeft'
};

function diagnosisLabel(key: DiagnosisKey): Localized {
	return resolve_localized(DIAGNOSIS_LABEL_KEYS[key]);
}

function combineLabel(base: Localized, detail?: Localized): Localized {
	if (!detail) return base;
	return {
		'en-US': `${base['en-US']} — ${detail['en-US']}`,
		'ru-RU': `${base['ru-RU']} — ${detail['ru-RU']}`
	};
}

/** "grade {N}" / "степень {N}" — the generic stage suffix shown on a
 * conclusion card, e.g. "Bekhterev's disease — cervical — grade 2". */
export function gradeDetail(grade: number): Localized {
	return resolve_localized('diagnosis.conclusion.gradeSuffix', { grade });
}

/** "spondyloptosis" — L5 spondylolisthesis's own grade5 is clinically a
 * distinct named condition rather than just "grade 5". */
export function spondyloptosisDetail(): Localized {
	return resolve_localized('diagnosis.conclusion.spondyloptosisSuffix');
}

/** Extracts the numeric grade from a Severity, or null for 'normal' (which
 * callers should never be building a detail for anyway) or any non-graded
 * value. */
export function severityGrade(severity: Severity): number | null {
	const match = /^grade(\d)$/.exec(severity);
	return match ? Number(match[1]) : null;
}

/**
 * One sub-condition tallied into a diagnosis's score, shown as a symptom
 * row when the diagnosis card is expanded. Deliberately shaped like a
 * trimmed-down `Finding` — wherever a symptom is backed by an
 * already-computed Finding (true for nearly every one — see
 * diagnosis-store.svelte.ts), it's built by copying that Finding's own
 * `text`/`severity` directly, so the report never says two different
 * things about the same measurement. For a symptom that didn't count
 * toward this diagnosis, `severity` is forced to `'normal'` regardless of
 * the source Finding's real severity — it renders muted, signaling
 * "checked, didn't count", while `text` still shows what was actually
 * observed.
 */
export type Symptom = { text: Localized; severity: Severity };

/** Builds a matched symptom from an existing Finding — copies its text and
 * real severity as-is. */
export function matchedSymptom(finding: Finding): Symptom {
	return { text: finding.text, severity: finding.severity };
}

/** Builds an unmatched symptom from an existing Finding — keeps its text
 * (what was actually observed) but forces severity to 'normal' so it
 * renders muted, since it didn't count toward this diagnosis. */
export function unmatchedSymptom(finding: Finding): Symptom {
	return { text: finding.text, severity: 'normal' };
}

type TallyEntry = { abnormal: number; total: number; detail?: Localized; symptoms?: Symptom[] };
export type DiagnosisTally = Map<TallyKey, TallyEntry>;

export type TallyOptions = { detail?: Localized; symptoms?: Symptom[] };

/**
 * Records one single-parameter diagnosis check. Only tallied when
 * `triggered` — an un-triggered single-parameter diagnosis isn't a "0%
 * match", it's simply not a candidate this round (it never enters N_total
 * bookkeeping), matching how a diagnosis whose region isn't annotated at
 * all is already absent from the tally.
 */
export function tallySingle(
	tally: DiagnosisTally,
	key: TallyKey,
	triggered: boolean,
	options?: TallyOptions
): void {
	if (!triggered) return;
	const entry = tally.get(key) ?? { abnormal: 0, total: 0 };
	entry.abnormal += 1;
	entry.total += 1;
	if (options?.detail) entry.detail = options.detail;
	if (options?.symptoms) entry.symptoms = options.symptoms;
	tally.set(key, entry);
}

/** Records a composite diagnosis's partial-match contribution. */
export function tallyComposite(
	tally: DiagnosisTally,
	key: TallyKey,
	abnormalCount: number,
	totalCount: number,
	options?: TallyOptions
): void {
	if (totalCount <= 0) return;
	const entry = tally.get(key) ?? { abnormal: 0, total: 0 };
	entry.abnormal += abnormalCount;
	entry.total += totalCount;
	if (options?.detail) entry.detail = options.detail;
	if (options?.symptoms) entry.symptoms = options.symptoms;
	tally.set(key, entry);
}

/**
 * Three-state discrete code for a region-level parameter, matching the
 * clinic document's own "-1/0/1" coding of a value against its normal band:
 * below the band's min, within it, or above its max. `invert` flips which
 * side gets the positive code — needed for item 8 (sacral slope), whose
 * source table codes "below min" as +1 and "above max" as -1, the opposite
 * of every other item's convention.
 */
export function triCode(
	value: number,
	range: Pick<Range, 'min' | 'max'>,
	invert = false
): -1 | 0 | 1 {
	if (value < range.min) return invert ? 1 : -1;
	if (value > range.max) return invert ? -1 : 1;
	return 0;
}

/** One item of an 8-item (or fewer) lock-and-key pattern: its current
 * tri-state code plus the already-computed Finding that code was derived
 * from (reused verbatim as that item's symptom text/severity when the
 * pattern matches). `null` when the item isn't computable this round. */
export type PatternItem = { code: -1 | 0 | 1; finding: Finding } | null;

/**
 * Evaluates one "item 1-8" lock-and-key diagnosis pattern (see
 * diagnosis-store.svelte.ts's cross-region composite evaluation): `items`
 * carries each item's current tri-state code alongside the Finding it came
 * from (in item-number order, `null` when that item isn't computable this
 * round — its region/span isn't annotated), `pattern` is the required code
 * per item, or an array of codes when the source document says "either".
 *
 * Gated like every other composite in this module, just with a different
 * shape: these 5 diagnoses have no single "primary" measurement the way
 * Bekhterev's (curve direction) or spondylolisthesis (displacement) do —
 * the source document defines each as one indivisible combination of all
 * 8 (or 2) codes, a genuine lock-and-key match, not "mostly matches, so
 * probably". So the gate here is that ANY available item contradicting
 * its required code invalidates the whole pattern (no tally at all — 0%,
 * absent), rather than merely lowering a shared ratio the way an
 * ungated version let a handful of mismatches still clear the display
 * threshold. Items that aren't yet computable (`null`, that region/span
 * isn't annotated) are skipped rather than treated as a mismatch, per
 * this module's partial-annotation-aware philosophy elsewhere — once
 * every *available* item matches, the diagnosis tallies at 100% of
 * however many items were actually checkable this round, with one matched
 * symptom per included item (every included item necessarily matched,
 * or this function would have already bailed out).
 */
export function evaluatePattern(
	tally: DiagnosisTally,
	key: DiagnosisKey,
	items: PatternItem[],
	pattern: (-1 | 0 | 1 | (-1 | 0 | 1)[])[]
): void {
	let total = 0;
	const symptoms: Symptom[] = [];
	for (let i = 0; i < pattern.length; i++) {
		const item = items[i];
		if (item === null || item === undefined) continue;
		const want = pattern[i];
		const matches = Array.isArray(want) ? want.includes(item.code) : want === item.code;
		if (!matches) return; // gate: one contradicting item invalidates the whole match
		total += 1;
		symptoms.push(matchedSymptom(item.finding));
	}
	tallyComposite(tally, key, total, total, { symptoms });
}

export type RankedDiagnosis = {
	key: string;
	label: Localized;
	probability: number;
	symptoms: Symptom[];
};

const DISPLAY_THRESHOLD = 0.5;

/**
 * Raw match score S_d = N_abnormal / N_total for every tallied diagnosis —
 * NOT normalized across diagnoses (a patient can genuinely have more than
 * one concurrent diagnosis, so rescaling to sum to 1 would be wrong).
 * Returns every diagnosis whose raw score exceeds 0.5, sorted descending
 * for display order only. Pure and state-free so it's directly testable
 * against synthetic tallies.
 */
export function rankFromTally(tally: DiagnosisTally): RankedDiagnosis[] {
	return [...tally.entries()]
		.map(([key, { abnormal, total, detail, symptoms }]) => ({
			key,
			probability: total > 0 ? abnormal / total : 0,
			detail,
			symptoms: symptoms ?? []
		}))
		.filter((d) => d.probability > DISPLAY_THRESHOLD)
		.sort((a, b) => b.probability - a.probability)
		.map((d) => ({
			key: d.key,
			label: combineLabel(diagnosisLabel(baseKey(d.key as TallyKey)), d.detail),
			probability: d.probability,
			symptoms: d.symptoms
		}));
}
