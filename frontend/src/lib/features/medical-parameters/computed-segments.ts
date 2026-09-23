import { computeGeneratedVertebraRanges } from '$lib/shared/anatomy/central-arc-segments';
import {
	expand_vertebra_id_range,
	sort_segments_by_vertebra
} from '$lib/shared/anatomy/segment-range';
import { match_items_by_ids } from './diagnosis/regions';
import type { ResolvedSegmentRow, Vertebrae } from './types';

/**
 * Resolves the Segments subtab's "Computed Regions" group -- vertebra ranges auto-detected by
 * the BIC + Dynamic-Programming arc-segmentation pipeline (`computeGeneratedVertebraRanges`),
 * purely as a function of the current polygons. Unlike the old `generated-segments.ts`, this
 * never mutates or persists anything -- callers re-derive it on every reactive read, the same
 * way `structures[projection].vertebrae`/`.gaps` already work with no accompanying `$effect`.
 *
 * Deduplication is scoped to this function's own output only -- never against Default Regions
 * or User-Defined segments. A previous version took a combined Default+User exclude list and
 * dropped any detected arc matching an entry in it, treating dedup as one pass spanning all
 * three subgroups. That silently hid a real, correctly detected computed range any time it
 * happened to exactly coincide with a fixed Default Region or a user's own segment (e.g. a
 * detected lumbar curve landing on exactly L1-S1, the same range as the Default "Lumbar"
 * region) -- even though a curve-driven detection and a fixed anatomical grouping carry
 * independently useful information and neither should suppress the other. Deduplication
 * belongs within a subgroup, not across the whole combined ranges-group; computed ranges are
 * already a non-overlapping partition of the annotated spine, so there is nothing to dedupe
 * within this subgroup in the first place.
 */
export function resolve_computed_regions(polygons: Vertebrae[]): ResolvedSegmentRow[] {
	const rows = computeGeneratedVertebraRanges(polygons)
		.map((range): ResolvedSegmentRow | null => {
			const ids = expand_vertebra_id_range(range.topId, range.bottomId);
			const matched = ids ? match_items_by_ids(polygons, ids) : null;
			if (!matched) return null;

			return {
				definitionId: `computed:${range.bottomId}-${range.topId}`,
				polygons: matched,
				kind: 'computed'
			};
		})
		.filter((r): r is ResolvedSegmentRow => r !== null);

	// `polygons` is ordered bottom-to-top (see `expand_vertebra_id_range`), so index 0 is each
	// row's most-inferior vertebra -- the same field `sort_segments_by_vertebra` sorts by.
	return sort_segments_by_vertebra(rows.map((r) => ({ ...r, bottomId: r.polygons[0]!.id }))).map(
		({ bottomId: _bottomId, ...row }) => row
	);
}
