import type { Localized } from '$lib/core/i18n/types';
import { resolve_localized } from '$lib/core/i18n/resolve';
import { parametersConfig } from '../config';
import type { Projection } from '$lib/features/dicom/types';

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

/**
 * Builds the human-readable sentence listing every geometric parameter for a
 * region/vertebra/gap — not just the ones a grading rule happened to flag.
 * The qualitative verdict (normal or not) is conveyed separately by the
 * existing severity cards rendered right after this narrative, not folded
 * into the sentence itself.
 *
 * Parameters with a null value (e.g. p9 on a non-S1 vertebra, p7 on a non-
 * L5/S1 gap) are skipped — there's nothing measured to report for them.
 */
export function buildParametersNarrative(
	identity: Localized,
	projection: Projection,
	structureType: StructureType,
	params: Record<string, ParamEntry>
): Localized {
	const clauses: Localized[] = [];
	for (const key of Object.keys(params)) {
		const entry = params[key];
		if (typeof entry.val !== 'number') continue;
		const label = paramLabel(projection, structureType, key);
		const unit = unitFor(entry.type);
		clauses.push(
			resolve_localized('diagnosis.narrative.clause', { label, value: entry.val.toFixed(1), unit })
		);
	}

	const joined: Localized = {
		'ru-RU': clauses.map((c) => c['ru-RU']).join(', '),
		'en-US': clauses.map((c) => c['en-US']).join(', ')
	};

	return resolve_localized('diagnosis.narrative.sentence', { identity, clauses: joined });
}
