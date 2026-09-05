import type { Polygon } from '$lib/shared/geometry/geometry.type';

export type supportedStructures = 'vertebrae' | 'gaps' | 'segments' | 'overall';

export type Vertebrae = Polygon;
export type Gap = {
	top: Vertebrae;
	bottom: Vertebrae;
};
export type Segment = Polygon[];

/**
 * A user-manageable segment, persisted as an id-range rather than resolved polygons --
 * `parameters-store.svelte.ts` resolves this against a projection's live polygons into
 * a `Segment` on every read. `id` is a stable local identifier (independent of the
 * vertebra ids, which aren't guaranteed unique across arbitrarily-added ranges), used
 * as the delete target and list key.
 */
export type SegmentDefinition = {
	id: string;
	topId: string;
	bottomId: string;
	/** True for a segment auto-detected by the arc-segmentation pipeline (see
	 * `shared/anatomy/central-arc-segments.ts`); absent/false for a user-managed one. Generated
	 * entries are recomputed and re-persisted whenever the underlying polygons change (see
	 * `generated-segments.ts`), but remain ordinary, deletable segments otherwise. */
	generated?: boolean;
};
