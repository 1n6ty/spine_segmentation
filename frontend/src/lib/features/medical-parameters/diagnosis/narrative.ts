import type { Localized } from '$lib/core/i18n/types';
import { resolve_localized } from '$lib/core/i18n/resolve';
import { parametersConfig } from '../config';
import type { Projection } from '$lib/features/dicom/types';
import type { NarrativeClause, ParametersNarrative, Range, Severity } from './types';

type StructureType = keyof (typeof parametersConfig)['side'];
type ParamEntry = { val: number | string | null; type: string };

/** Bilingual label for a calculator parameter (e.g. segments p3 -> "Arc central angle"/"Центральный угол дуги"). */
export function paramLabel(
	projection: Projection,
	structureType: StructureType,
	key: string
): Localized {
	return resolve_localized(`diagnosis.parameterNames.${projection}.${structureType}.${key}`);
}

export function vertebraLabel(id: string): Localized {
	return resolve_localized('diagnosis.narrative.vertebraLabel', { id });
}

export function gapLabel(id: string): Localized {
	return resolve_localized('diagnosis.narrative.gapLabel', { id });
}

// No space before "°" (degree symbol attaches directly), a space before "мм"/"mm"
// — matches the existing convention in rules/sagittal.ts and frontal.ts. Reuses
// the shared units.* keys rather than re-declaring the unit text.
function unitFor(type: string): Localized {
	const unit = resolve_localized(type === 'angular' ? 'units.angular' : 'units.linear');
	if (type === 'angular') return unit;
	return { 'ru-RU': ` ${unit['ru-RU']}`, 'en-US': ` ${unit['en-US']}` };
}

/** Rounds to at most 2 decimal places — subtracting two already-rounded
 * bounds (e.g. a mean±SD range's tolerance) can otherwise land on a binary
 * floating-point artifact like 2.499999999999999 instead of 2.5. */
function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

/** Swaps a formatted number's leading hyphen-minus for a true minus sign
 * (U+2212). Without this, a negative bound ("-41") is visually
 * indistinguishable from a hyphen or the range separator — see the "-41–-15°"
 * soup this was introduced to fix. */
function withMinus(s: string): string {
	return s.replace('-', '−');
}

/** Number formatted for display: at most 2 decimals, real minus sign. */
function fmtNum(n: number): string {
	return withMinus(String(round2(n)));
}

/**
 * Formats a clinical reference range for the narrative's "(normal ...)"
 * badge. Three shapes, depending on the range:
 *  - `range.center` set -> "{center} ± {tolerance}{unit}" — only used when
 *    the range-getter explicitly says the band is naturally center+tolerance
 *    shaped (zero-centered thresholds, mean±SD tables), not for every range
 *    that happens to have a midpoint.
 *  - open-ended (`min === -Infinity` or `max === Infinity`) -> "> {min}{unit}" / "< {max}{unit}".
 *  - otherwise -> "от {min} до {max}{unit}" / "{min} to {max}{unit}" — worded,
 *    not "{min}–{max}", so the separator is never confused with a value's sign.
 *
 * Negative bounds are rendered with a real minus sign (see fmtNum).
 */
function formatRange(range: Range, type: string): Localized {
	const unit = unitFor(type);
	if (range.center !== undefined) {
		return resolve_localized('diagnosis.narrative.rangeSymmetric', {
			center: fmtNum(range.center),
			tolerance: fmtNum(range.max - range.center),
			unit
		});
	}
	if (range.min === -Infinity) {
		return resolve_localized('diagnosis.narrative.rangeBelow', { max: fmtNum(range.max), unit });
	}
	if (range.max === Infinity) {
		return resolve_localized('diagnosis.narrative.rangeAbove', { min: fmtNum(range.min), unit });
	}
	return resolve_localized('diagnosis.narrative.rangeBetween', {
		min: fmtNum(range.min),
		max: fmtNum(range.max),
		unit
	});
}

/**
 * Builds the structured list of parameter clauses for a region/vertebra/gap
 * — not just the ones a grading rule happened to flag. The qualitative
 * verdict is conveyed both by the existing severity cards rendered right
 * after this narrative, and — per clause, once a reference-range badge is
 * attached via withRangeBadge — by that clause's own coloring.
 *
 * Parameters with a null value (e.g. p9 on a non-S1 vertebra, p7 on a non-
 * L5/S1 gap) are skipped — there's nothing measured to report for them.
 */
export function buildParametersNarrative(
	identity: Localized,
	projection: Projection,
	structureType: StructureType,
	params: Record<string, ParamEntry>
): ParametersNarrative {
	const clauses: NarrativeClause[] = [];
	for (const key of Object.keys(params)) {
		const entry = params[key];
		if (typeof entry.val !== 'number') continue;
		const label = paramLabel(projection, structureType, key);
		const unit = unitFor(entry.type);
		const text = resolve_localized('diagnosis.narrative.clause', {
			label,
			value: withMinus(entry.val.toFixed(1)),
			unit
		});
		clauses.push({ key, type: entry.type === 'angular' ? 'angular' : 'linear', text });
	}

	return { identity, clauses };
}

/**
 * Attaches a colored reference-range badge to the clause for `key` (e.g.
 * 'p3'), returning a new narrative — clauses are otherwise unchanged.
 * A no-op (returns `narrative` as-is) if no clause has that key, e.g. the
 * parameter's value was null and so was skipped when the narrative was built.
 */
export function withRangeBadge(
	narrative: ParametersNarrative,
	key: string,
	severity: Severity,
	range: Range
): ParametersNarrative {
	return {
		identity: narrative.identity,
		clauses: narrative.clauses.map((clause) =>
			clause.key === key
				? { ...clause, badge: { display: formatRange(range, clause.type), severity } }
				: clause
		)
	};
}

/** Flattens a structured narrative back into the single plain-text sentence
 * the app used before per-clause badges existed — for future PDF/DOCX
 * export, which wants running text, not colored spans. */
export function narrativeSentence(narrative: ParametersNarrative): Localized {
	const joined: Localized = {
		'ru-RU': narrative.clauses.map((c) => c.text['ru-RU']).join(', '),
		'en-US': narrative.clauses.map((c) => c.text['en-US']).join(', ')
	};
	return resolve_localized('diagnosis.narrative.sentence', {
		identity: narrative.identity,
		clauses: joined
	});
}
