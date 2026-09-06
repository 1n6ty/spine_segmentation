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
 * `excludeRanges` drops any detected arc that exactly matches a Default Region or a current
 * User-Defined segment, so the same vertebra range never appears twice in the table (previously
 * this dedup only checked against user-managed segments; it now also covers Default ranges,
 * since those no longer live in the same persisted list to be checked against directly).
 */
export function resolve_computed_regions(
	polygons: Vertebrae[],
	excludeRanges: { topId: string; bottomId: string }[]
): ResolvedSegmentRow[] {
	const excluded = new Set(excludeRanges.map((r) => `${r.topId}:${r.bottomId}`));

	const rows = computeGeneratedVertebraRanges(polygons)
		.filter((range) => !excluded.has(`${range.topId}:${range.bottomId}`))
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
