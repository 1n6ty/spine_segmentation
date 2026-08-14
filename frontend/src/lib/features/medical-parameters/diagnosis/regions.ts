import type { Localized } from '$lib/core/i18n/types';
import { resolve_localized } from '$lib/core/i18n/resolve';

/**
 * Fixed anatomical regions, matched by vertebra id — not by array position —
 * so a region becomes available as soon as its own vertebrae are annotated,
 * independently of the other regions or the full 24-vertebra spine. Same
 * gating principle as the `measure` page's segments tab
 * (`medical-parameters/parameters-store.svelte.ts`'s `SEGMENT_ID_LISTS`), and the same
 * id lists (lumbar here is L1-S1, the clinically-standard "global lumbar
 * lordosis" range that includes the sacrum, matching the measure tab — not
 * L1-L5).
 */
export type RegionDef = {
	id: 'cervical' | 'thoracic' | 'lumbar';
	ids: string[];
	label: Localized;
	vertebraeLabel: string;
};

/**
 * Matches items by id, not array position — so a group becomes available as
 * soon as its own items are annotated, independently of others. Returns null
 * if any id in `ids` isn't present yet. Shared by both the measure page's
 * segments tab (`parameters-store.svelte.ts`) and the report's diagnosis
 * engine (`diagnosis-store.svelte.ts`), which previously reimplemented this
 * identically under two different names.
 */
export function match_items_by_ids<T extends { id: string }>(
	items: T[],
	ids: string[]
): T[] | null {
	const byId = new Map(items.map((item) => [item.id, item]));
	const matched = ids.map((id) => byId.get(id));
	if (matched.some((item) => !item)) return null;
	return matched as T[];
}

export const REGIONS: RegionDef[] = [
	{
		id: 'cervical',
		ids: ['C7', 'C6', 'C5', 'C4', 'C3', 'C2'],
		label: resolve_localized('diagnosis.regions.cervical'),
		vertebraeLabel: 'C2-C7'
	},
	{
		id: 'thoracic',
		ids: ['Th12', 'Th11', 'Th10', 'Th9', 'Th8', 'Th7', 'Th6', 'Th5', 'Th4', 'Th3', 'Th2', 'Th1'],
		label: resolve_localized('diagnosis.regions.thoracic'),
		vertebraeLabel: 'Th1-Th12'
	},
	{
		id: 'lumbar',
		ids: ['S1', 'L5', 'L4', 'L3', 'L2', 'L1'],
		label: resolve_localized('diagnosis.regions.lumbar'),
		vertebraeLabel: 'L1-S1'
	}
];
