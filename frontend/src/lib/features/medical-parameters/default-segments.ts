import { expand_vertebra_id_range } from '$lib/shared/anatomy/segment-range';
import { match_items_by_ids, REGIONS, THORACIC_SUBREGIONS } from './diagnosis/regions';
import type { ResolvedSegmentRow, Vertebrae } from './types';

export type DefaultRegionDefinition = {
	id: string;
	topId: string;
	bottomId: string;
	subHeaderKey: 'cervical' | 'thoracic' | 'lumbar';
	rowLabelKey?: 'upper' | 'central' | 'lower' | 'total';
};

function region_range(regionId: 'cervical' | 'thoracic' | 'lumbar'): {
	topId: string;
	bottomId: string;
} {
	const region = REGIONS.find((r) => r.id === regionId)!;
	return { topId: region.ids.at(-1)!, bottomId: region.ids[0]! };
}

function thoracic_sub_range(subArcId: 'upper' | 'mid' | 'lower'): {
	topId: string;
	bottomId: string;
} {
	const sub = THORACIC_SUBREGIONS.find((s) => s.subArcId === subArcId)!;
	return { topId: sub.ids.at(-1)!, bottomId: sub.ids[0]! };
}

/**
 * The Segments subtab's "Default Regions" group -- hardcoded baseline anatomical ranges,
 * declared in the exact order they must render (Cervical, then Thoracic's 4 rows, then
 * Lumbar/Sacral). Ranges are single-sourced from `diagnosis/regions.ts` (the same data the
 * Report tab uses), not re-hardcoded here, so the two tabs' groupings can't drift apart.
 *
 * Declared (not sorted) order matters: "Lower" (Th10-Th12) and "Total" (Th1-Th12) share a
 * `bottomId`, so `sort_segments_by_vertebra`-style sorting can't disambiguate them.
 */
export const DEFAULT_REGION_DEFINITIONS: DefaultRegionDefinition[] = [
	{ id: 'default:cervical', ...region_range('cervical'), subHeaderKey: 'cervical' },
	{
		id: 'default:thoracic-upper',
		...thoracic_sub_range('upper'),
		subHeaderKey: 'thoracic',
		rowLabelKey: 'upper'
	},
	{
		id: 'default:thoracic-central',
		...thoracic_sub_range('mid'),
		subHeaderKey: 'thoracic',
		rowLabelKey: 'central'
	},
	{
		id: 'default:thoracic-lower',
		...thoracic_sub_range('lower'),
		subHeaderKey: 'thoracic',
		rowLabelKey: 'lower'
	},
	{
		id: 'default:thoracic-total',
		...region_range('thoracic'),
		subHeaderKey: 'thoracic',
		rowLabelKey: 'total'
	},
	{ id: 'default:lumbar', ...region_range('lumbar'), subHeaderKey: 'lumbar' }
];

/**
 * Resolves the Default Regions group against a projection's live polygons, gated
 * per-region -- a region only appears once every one of its own vertebrae is annotated,
 * independently of the others (same principle as the Report tab's `computeProjectionDiagnosis`
 * and the user-defined segments' `resolve_segments`). Declared order is preserved, not
 * re-sorted, since it's already the intended display order.
 */
export function resolve_default_regions(polygons: Vertebrae[]): ResolvedSegmentRow[] {
	return DEFAULT_REGION_DEFINITIONS.map((def): ResolvedSegmentRow | null => {
		const ids = expand_vertebra_id_range(def.topId, def.bottomId);
		const matched = ids ? match_items_by_ids(polygons, ids) : null;
		if (!matched) return null;

		return {
			definitionId: def.id,
			polygons: matched,
			kind: 'default',
			subHeaderKey: def.subHeaderKey,
			rowLabelKey: def.rowLabelKey
		};
	}).filter((r): r is ResolvedSegmentRow => r !== null);
}
