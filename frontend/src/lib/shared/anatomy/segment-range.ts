import { VERTEBRA_ORDER, vertebra_order_index } from './vertebra-order';

/**
 * Expands a topId/bottomId pair into the full ordered list of vertebra ids between
 * them (inclusive), in bottom-to-top order -- matching `REGIONS.ids`'s existing
 * convention (e.g. cervical = ['C7','C6','C5','C4','C3','C2']) so the result plugs
 * directly into `match_items_by_ids` and `getSegmentParams`'s
 * `${segment.at(-1)?.id}-${segment.at(0)?.id}` naming.
 *
 * Returns null if either id is unknown, or if topId is not superior-or-equal to
 * bottomId (a reversed/malformed range).
 */
export function expand_vertebra_id_range(topId: string, bottomId: string): string[] | null {
	const topIdx = vertebra_order_index(topId);
	const bottomIdx = vertebra_order_index(bottomId);
	if (topIdx === -1 || bottomIdx === -1 || topIdx > bottomIdx) return null;

	return VERTEBRA_ORDER.slice(topIdx, bottomIdx + 1).reverse();
}

/**
 * Sorts a copy of `defs` ascending by the anatomical position of each segment's
 * most-inferior (bottommost) vertebra -- i.e. superior segments first. This is the
 * "always sorted for display" comparator: callers should re-sort on every read rather
 * than relying on the underlying list's insertion order, so a newly added segment
 * always renders in its canonically sorted position regardless of where it landed in
 * the source array. Never mutates `defs`.
 */
export function sort_segments_by_vertebra<T extends { bottomId: string }>(defs: T[]): T[] {
	return [...defs].sort(
		(a, b) => vertebra_order_index(a.bottomId) - vertebra_order_index(b.bottomId)
	);
}
