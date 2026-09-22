import type { Vertebrae } from '../../types';
import { getSegmentParams } from '../../calculators/segments';
import { getGapParams } from '../../calculators/gaps';
import { computeGeneratedVertebraRanges } from '$lib/shared/anatomy/central-arc-segments';
import {
	expand_vertebra_id_range,
	sort_segments_by_vertebra
} from '$lib/shared/anatomy/segment-range';
import { match_items_by_ids } from '../regions';
import { gradeSagittalDiscAngle } from './sagittal';
import type { Finding } from '../types';
import {
	tallyComposite,
	congenitalKyphosisRangeDetail,
	matchedSymptom,
	type DiagnosisTally,
	type Symptom
} from '../conclusion';

/**
 * Congenital kyphosis ("Врождённый кифоз") — unlike every other diagnosis in
 * this module, this one is defined directly on the BIC+DP auto-segmented
 * "Computed Regions" (`central-arc-segments.ts`'s `computeGeneratedVertebraRanges`,
 * otherwise only feeding the Segments tab's display), not the fixed
 * REGIONS/THORACIC_SUBREGIONS the rest of the diagnosis engine uses — per the
 * user's own spec, the pattern only makes sense against the spine's actual
 * auto-detected lordosis/kyphosis arcs, which don't necessarily line up with
 * the fixed anatomical region boundaries.
 *
 * Two patterns (both from the user's own diagnostic description, no written
 * source document — these arcs and their sign convention come from this
 * app's own BIC/DP segmentation, not a clinic table):
 *
 * 1. Two sequential lordosis(-) arcs with an abnormal disc angle at their
 *    shared boundary — the boundary disc's own angle should be lordotic
 *    like its neighbors; when it's out of the normal band instead, that
 *    single disc is a congenital kyphotic segment hiding between two
 *    otherwise-normal lordosis arcs.
 * 2. Three sequential arcs (-,+,-) where EVERY disc inside the middle
 *    kyphosis(+) arc is abnormal — not just the arc's central angle: this
 *    additionally requires each of its own internal disc-level angles to
 *    individually fail the level-specific normal band (see
 *    `getSagittalDiscAngleRange`/`gradeSagittalDiscAngle` in `./sagittal`,
 *    same per-level table used by the osteochondrosis checks), confirming
 *    the kyphosis is a structural (multi-level) deformity rather than a
 *    single misgraded disc.
 *
 * Both are instance-keyed (`sag-congenital-kyphosis:${N}-${M}`, same pattern
 * `sag-vertebral-fracture` already uses) since more than one occurrence is
 * anatomically possible.
 */

type SignedComputedRegion = {
	topId: string;
	bottomId: string;
	/** bottom-to-top order, matching `expand_vertebra_id_range`'s convention. */
	vertebraeIds: string[];
	sign: -1 | 0 | 1;
};

function computeSignedRegions(polygons: Vertebrae[], mmPerPixel: number): SignedComputedRegion[] {
	const ranges = computeGeneratedVertebraRanges(polygons);
	const signed: SignedComputedRegion[] = [];
	for (const range of ranges) {
		const ids = expand_vertebra_id_range(range.topId, range.bottomId);
		if (!ids) continue;
		const vertebrae = match_items_by_ids(polygons, ids);
		if (!vertebrae) continue;
		const centralAngle = getSegmentParams('side', vertebrae, mmPerPixel).params.p3.val as
			| number
			| null;
		if (centralAngle === null) continue;
		signed.push({
			topId: range.topId,
			bottomId: range.bottomId,
			vertebraeIds: ids,
			sign: centralAngle < 0 ? -1 : centralAngle > 0 ? 1 : 0
		});
	}
	// Superior -> inferior, matching computed-segments.ts's own display ordering
	// (ascending by each arc's most-inferior vertebra) -- so adjacent array
	// entries are anatomically adjacent arcs.
	return sort_segments_by_vertebra(signed);
}

/** Grades the disc between two specific vertebra ids (by id, not by an
 * already-built Gap), for boundary/internal discs that aren't part of any
 * fixed region's own gap list. Returns null if either vertebra isn't
 * annotated, or its level has no source-table normal band. */
function gradeDiscBetween(
	polygons: Vertebrae[],
	topId: string,
	bottomId: string,
	mmPerPixel: number
): Finding | null {
	const top = polygons.find((v) => v.id === topId);
	const bottom = polygons.find((v) => v.id === bottomId);
	if (!top || !bottom) return null;
	const angle = getGapParams('side', { top, bottom }, mmPerPixel).params.p1.val as number | null;
	if (angle === null) return null;
	return gradeSagittalDiscAngle(`${topId}-${bottomId}`, angle);
}

export function evaluateCongenitalKyphosis(
	tally: DiagnosisTally,
	polygons: Vertebrae[],
	mmPerPixel: number
): void {
	const regions = computeSignedRegions(polygons, mmPerPixel);

	for (let i = 0; i < regions.length - 1; i++) {
		const upper = regions[i];
		const lower = regions[i + 1];

		// Pattern 1: two sequential lordosis arcs, boundary disc abnormal.
		if (upper.sign === -1 && lower.sign === -1) {
			const N = upper.bottomId;
			const M = lower.topId;
			const finding = gradeDiscBetween(polygons, N, M, mmPerPixel);
			if (finding && finding.severity !== 'normal') {
				tallyComposite(tally, `sag-congenital-kyphosis:${N}-${M}`, 1, 1, {
					detail: congenitalKyphosisRangeDetail(N, M),
					symptoms: [matchedSymptom(finding)]
				});
			}
		}
	}

	for (let i = 0; i < regions.length - 2; i++) {
		const upperLordosis = regions[i];
		const kyphosis = regions[i + 1];
		const lowerLordosis = regions[i + 2];

		// Pattern 2: lordosis / kyphosis / lordosis triple, every internal disc
		// of the middle arc abnormal.
		if (upperLordosis.sign !== -1 || kyphosis.sign !== 1 || lowerLordosis.sign !== -1) continue;

		const N = upperLordosis.bottomId;
		const M = lowerLordosis.topId;
		const symptoms: Symptom[] = [];
		let allAbnormal = kyphosis.vertebraeIds.length > 1;
		for (let j = 0; j < kyphosis.vertebraeIds.length - 1; j++) {
			// vertebraeIds is bottom-to-top, so the more superior id is at j+1.
			const bottomId = kyphosis.vertebraeIds[j];
			const topId = kyphosis.vertebraeIds[j + 1];
			const finding = gradeDiscBetween(polygons, topId, bottomId, mmPerPixel);
			if (!finding || finding.severity === 'normal') {
				allAbnormal = false;
				break;
			}
			symptoms.push(matchedSymptom(finding));
		}
		if (allAbnormal) {
			tallyComposite(tally, `sag-congenital-kyphosis:${N}-${M}`, symptoms.length, symptoms.length, {
				detail: congenitalKyphosisRangeDetail(N, M),
				symptoms
			});
		}
	}
}
