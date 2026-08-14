import { project } from '$lib/core/project.svelte';
import { getGapParams } from './calculators/gaps';
import { getSegmentParams } from './calculators/segments';
import { getSpineParams } from './calculators/spine';
import { getVertebraeParams } from './calculators/vertebrae';
import { REGIONS, match_items_by_ids } from './diagnosis/regions';
import type { Segment, Vertebrae } from './types';

/**
 * 3 standard segments shown on the `measure` page, gated INDEPENDENTLY of each
 * other and of the full 24-vertebra spine: each one appears as soon as its own
 * vertebrae are present, by matching `id` (not array position/index). Reuses
 * `regions.ts`'s `REGIONS` id lists — the report's diagnosis engine gates on
 * the full 24-vertebra spine before considering any region, but the underlying
 * anatomical groupings (and their id lists, including lumbar = L1-S1) are the
 * same ones used here.
 *
 * Caveat: this relies on `editor/logic/orderer.ts`'s naming being correct,
 * which itself assumes vertebrae are annotated contiguously from S1 upward.
 * Annotating an isolated region with nothing below it (e.g. only cervical,
 * with no thoracic/lumbar/sacral vertebrae at all) will mis-name the
 * bottommost one "S1" rather than recognizing it as cervical — a limitation
 * of the naming algorithm itself, not of this gating logic.
 */
function getFixedSegments(polygons: Vertebrae[]): Segment[] {
	return REGIONS.map((region) => match_items_by_ids(polygons, region.ids)).filter(
		(s): s is Vertebrae[] => s !== null
	);
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
		get segments() {
			return getFixedSegments(project.session.projections[projection].polygons);
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
			segments: structures[projection].segments.map((s) => getSegmentParams(projection, s, mm)),
			overall: getSpineParams(projection, structures[projection].vertebrae, mm)
		};
	}
});
