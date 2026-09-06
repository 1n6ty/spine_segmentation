import type { Polygon } from '$lib/shared/geometry/geometry.type';

export type supportedStructures = 'vertebrae' | 'gaps' | 'segments' | 'overall';

export type Vertebrae = Polygon;
export type Gap = {
	top: Vertebrae;
	bottom: Vertebrae;
};
export type Segment = Polygon[];

/**
 * A user-defined segment, persisted as an id-range rather than resolved polygons --
 * `parameters-store.svelte.ts` resolves this against a projection's live polygons into
 * a `Segment` on every read. `id` is a stable local identifier (independent of the
 * vertebra ids, which aren't guaranteed unique across arbitrarily-added ranges), used
 * as the delete target and list key. This is the only segment shape ever persisted to
 * the backend -- default and computed regions are derived client-side and never stored
 * here (see `default-segments.ts` / `computed-segments.ts`).
 */
export type SegmentDefinition = {
	id: string;
	topId: string;
	bottomId: string;
};

/**
 * A resolved segments-table row, tagged with which of the Segments subtab's three
 * groups it belongs to -- consumed by `Table.svelte` to render group/sub-group headers
 * and to gate the delete action to `kind: 'user'` rows only.
 */
export type ResolvedSegmentRow = {
	definitionId: string;
	polygons: Vertebrae[];
	kind: 'default' | 'computed' | 'user';
	/** `kind: 'default'` only -- which anatomical sub-header this row renders under. */
	subHeaderKey?: 'cervical' | 'thoracic' | 'lumbar';
	/** `kind: 'default'` only -- set when a bare vertebra-range label would be ambiguous
	 * (the Thoracic sub-header has 4 rows), to prefix the row's name with e.g. "Upper". */
	rowLabelKey?: 'upper' | 'central' | 'lower' | 'total';
};
