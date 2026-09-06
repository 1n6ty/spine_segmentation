import { project } from '$lib/core/project.svelte';
import {
	expand_vertebra_id_range,
	sort_segments_by_vertebra
} from '$lib/shared/anatomy/segment-range';
import { getGapParams } from './calculators/gaps';
import { getSegmentParams } from './calculators/segments';
import { getSpineParams } from './calculators/spine';
import { getVertebraeParams } from './calculators/vertebrae';
import { match_items_by_ids } from './diagnosis/regions';
import { DEFAULT_REGION_DEFINITIONS, resolve_default_regions } from './default-segments';
import { resolve_computed_regions } from './computed-segments';
import type { ResolvedSegmentRow, SegmentDefinition, Vertebrae } from './types';

/**
 * Resolves a projection's user-managed `SegmentDefinition[]` (persisted id-ranges)
 * against its live polygons, gated INDEPENDENTLY per definition: a definition only
 * appears once every vertebra in its range is annotated, by matching `id` (not array
 * position/index) — same gating principle the report's diagnosis engine uses via
 * `match_items_by_ids`.
 *
 * Always returns definitions pre-sorted by anatomical position (superior first) —
 * this is the "sorted for display" step: it re-sorts on every read rather than
 * relying on the underlying list's insertion order, so a newly added segment lands in
 * its canonically sorted position regardless of where it was inserted. Pairs each
 * resolved polygon list with its originating definition's `id` (needed by the table's
 * delete action) in the same pass, rather than zipping two independently-filtered
 * arrays back together afterwards.
 *
 * Caveat: this relies on `editor/logic/orderer.ts`'s naming being correct, which
 * itself assumes vertebrae are annotated contiguously from S1 upward. Annotating an
 * isolated region with nothing below it (e.g. only cervical, with no
 * thoracic/lumbar/sacral vertebrae at all) will mis-name the bottommost one "S1"
 * rather than recognizing it as cervical — a limitation of the naming algorithm
 * itself, not of this resolution logic.
 */
function resolve_segments(
	polygons: Vertebrae[],
	definitions: SegmentDefinition[]
): ResolvedSegmentRow[] {
	return sort_segments_by_vertebra(definitions)
		.map((def): ResolvedSegmentRow | null => {
			const ids = expand_vertebra_id_range(def.topId, def.bottomId);
			const matched = ids ? match_items_by_ids(polygons, ids) : null;
			return matched ? { definitionId: def.id, polygons: matched, kind: 'user' } : null;
		})
		.filter((r): r is ResolvedSegmentRow => r !== null);
}

function make_projection_structures(projection: 'side' | 'frontal') {
	return {
		get vertebrae() {
			return project.session.projections[projection].polygons;
		},
		get gaps() {
			const polygons = project.session.projections[projection].polygons;
			return polygons.slice(0, -1).map((v, i) => ({
				top: polygons[i + 1],
				bottom: v
			}));
		},
		/**
		 * Fixed render order: Default Regions, then Computed Regions, then User-Defined --
		 * matches the Segments subtab's top-to-bottom group layout directly, so `Table.svelte`
		 * never needs to re-sort/re-group this array itself. Default and Computed rows are
		 * derived purely from live polygons on every read (never persisted); only the
		 * user-defined subset comes from -- and is ever written back to -- session state.
		 */
		get segments(): ResolvedSegmentRow[] {
			const polygons = project.session.projections[projection].polygons;
			const userDefs = project.session.projections[projection].segments;

			const defaultRows = resolve_default_regions(polygons);
			const userRows = resolve_segments(polygons, userDefs);
			const excludeRanges = [...DEFAULT_REGION_DEFINITIONS, ...userDefs].map((d) => ({
				topId: d.topId,
				bottomId: d.bottomId
			}));
			const computedRows = resolve_computed_regions(polygons, excludeRanges);

			return [...defaultRows, ...computedRows, ...userRows];
		}
	};
}

export const structures = {
	side: make_projection_structures('side'),
	frontal: make_projection_structures('frontal')
};

export const params = $state({
	activeStructure: 'vertebrae',

	get side() {
		return this.calculate('side');
	},

	get frontal() {
		return this.calculate('frontal');
	},

	calculate(projection: 'side' | 'frontal') {
		const proj = project.session.projections[projection];
		const mm = proj.patient?.study.series.sopInstance.mmPerPixel || 1;

		return {
			vertebrae: structures[projection].vertebrae.map((v) => getVertebraeParams(projection, v, mm)),
			gaps: structures[projection].gaps.map((g) => getGapParams(projection, g, mm)),
			segments: structures[projection].segments.map((r) => ({
				...getSegmentParams(projection, r.polygons, mm),
				definitionId: r.definitionId
			})),
			overall: getSpineParams(projection, structures[projection].vertebrae, mm)
		};
	}
});
