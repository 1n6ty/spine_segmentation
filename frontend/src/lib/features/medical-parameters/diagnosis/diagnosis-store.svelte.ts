import { project } from '$lib/core/project.svelte';
import type { Projection } from '$lib/features/dicom/types';
import { getVertebraeParams } from '../calculators/vertebrae';
import { getGapParams } from '../calculators/gaps';
import { getSegmentParams } from '../calculators/segments';
import { getSpineParams } from '../calculators/spine';
import type { Vertebrae } from '../types';
import { REGIONS, match_items_by_ids } from './regions';
import * as Sagittal from './rules/sagittal';
import * as Frontal from './rules/frontal';
import type {
	Finding,
	GapDiagnosis,
	Localized,
	ProjectionDiagnosis,
	RegionDiagnosis,
	VertebraDiagnosis
} from './types';
import { buildParametersNarrative, vertebraLabel, gapLabel } from './narrative';
import { resolve_localized } from '$lib/core/i18n/resolve';

function withId(finding: Finding, id: string): Finding {
	return { ...finding, id };
}

/** Prefixes a finding's text with its anatomical structure's label, for the
 * conclusion section — which structure a finding belongs to is otherwise
 * unclear once it's lifted out of its region/vertebra/gap context. */
function withStructureLabel(finding: Finding, label: Localized): Finding {
	return {
		...finding,
		text: resolve_localized('diagnosis.narrative.labeledText', { label, text: finding.text })
	};
}

function buildVertebraDiagnosis(
	projection: Projection,
	v: Vertebrae,
	mmPerPixel: number,
	regionFinding: Finding
): VertebraDiagnosis {
	const vParams = getVertebraeParams(projection, v, mmPerPixel)!.params;
	const findings: Finding[] = [];

	if (projection === 'frontal') {
		const wedging = vParams.p6.val as number | null;
		if (wedging !== null) {
			findings.push(withId(Frontal.gradeVertebralWedgingFrontal(wedging), `${v.id}-wedging`));
		}
	} else {
		const wedging = vParams.p5.val as number | null;
		if (wedging !== null) {
			const fracture = Sagittal.gradeVertebralFracture(wedging, regionFinding.severity);
			if (fracture) findings.push(withId(fracture, `${v.id}-fracture`));
		}
	}

	const narrative = buildParametersNarrative(vertebraLabel(v.id), projection, 'vertebrae', vParams);

	return { id: v.id, findings, narrative };
}

function buildGapDiagnosis(
	projection: Projection,
	top: Vertebrae,
	bottom: Vertebrae,
	mmPerPixel: number
): GapDiagnosis {
	const gParams = getGapParams(projection, { top, bottom }, mmPerPixel)!.params;
	const findings: Finding[] = [];

	if (projection === 'frontal') {
		// p5 = linear displacement (mm), per config.ts. (An earlier pass had p1/p5 actually
		// swapped in gaps.ts despite being "fixed" in name only — see gaps.ts and
		// docs/gaps-and-recommendations.md for how that was caught and corrected.)
		const displacement = gParams.p5.val as number | null;
		if (displacement !== null) {
			findings.push(
				withId(
					Frontal.gradeLateralDisplacement(displacement),
					`${top.id}-${bottom.id}-displacement`
				)
			);
		}
	}

	const id = `${top.id}-${bottom.id}`;
	const narrative = buildParametersNarrative(gapLabel(id), projection, 'gaps', gParams);

	return { id, findings, narrative };
}

function computeProjectionDiagnosis(projection: Projection): ProjectionDiagnosis {
	const proj = project.session.projections[projection];
	const polygons = proj.polygons;
	const mmPerPixel = proj.patient?.study.series.sopInstance.mmPerPixel || 1;

	// Each region is gated independently by its own vertebra ids (see
	// match_items_by_ids) — a region renders as soon as it's fully annotated,
	// without waiting for the other regions or the full 24-vertebra spine.
	// Same principle as the measure page's segments tab.
	const regions: RegionDiagnosis[] = [];
	for (const region of REGIONS) {
		const regionVertebrae = match_items_by_ids(polygons, region.ids);
		if (!regionVertebrae) continue;

		// segments.ts's p3 (central angle) is now signed (derived from the fitted circle's
		// actual center, not the unsigned law-of-cosines acos) so both gradeRegionFrontal's
		// left/right branches and gradeRegionSagittal's lordosis/kyphosis branches are
		// genuinely reachable — previously p3 was always >= 0, making "left-sided" and
		// "lordosis-flattening" unreachable regardless of the real curve shape.
		const segmentParams = getSegmentParams(projection, regionVertebrae, mmPerPixel).params;
		const centralAngle = segmentParams.p3.val as number;
		const regionFinding =
			projection === 'side'
				? Sagittal.gradeRegionSagittal(region.id, centralAngle)
				: Frontal.gradeRegionFrontal(centralAngle);

		const findings: Finding[] = [withId(regionFinding, `${region.id}-curve`)];

		const vertebrae = regionVertebrae.map((v) =>
			buildVertebraDiagnosis(projection, v, mmPerPixel, regionFinding)
		);
		const gaps: GapDiagnosis[] = [];
		for (let i = 0; i < regionVertebrae.length - 1; i++) {
			// regionVertebrae is ordered inferior->superior (ids[] order), so the more superior vertebra is at i+1
			gaps.push(
				buildGapDiagnosis(projection, regionVertebrae[i + 1], regionVertebrae[i], mmPerPixel)
			);
		}

		if (projection === 'side' && region.id === 'thoracic') {
			const th6Th9Ids = ['Th9', 'Th8', 'Th7', 'Th6'];
			const wedgingAngles = th6Th9Ids
				.map((id) => regionVertebrae.find((v) => v.id === id)!)
				.map((v) => getVertebraeParams(projection, v, mmPerPixel)!.params.p5.val as number | null)
				.filter((a): a is number => a !== null);
			const scheuermann = Sagittal.gradeScheuermann(wedgingAngles, regionFinding.severity);
			if (scheuermann) findings.push(withId(scheuermann, 'thoracic-scheuermann'));
		}

		if (projection === 'side' && region.id === 'lumbar') {
			// region.ids = ["S1", "L5", "L4", "L3", "L2", "L1"], so regionVertebrae[0]/[1] are S1/L5.
			const s1 = regionVertebrae[0];
			const l5 = regionVertebrae[1];
			const sacralSlope = getVertebraeParams(projection, s1, mmPerPixel)!.params.p9.val as
				| number
				| null;
			if (sacralSlope !== null)
				findings.push(withId(Sagittal.gradeSacralSlope(sacralSlope), 's1-sacral-slope'));

			const l5Inclination = getVertebraeParams(projection, l5, mmPerPixel)!.params.p7.val as
				| number
				| null;
			if (l5Inclination !== null)
				findings.push(withId(Sagittal.gradeL5Inclination(l5Inclination), 'l5-inclination'));

			// p7 is now signed (verified: an unslipped baseline reads ~+90°, correctly inside
			// gradeL5Spondylolisthesis's "normal" band, not immediately misclassified as severe
			// slip like the old unsigned version did). One remaining concern surfaced while
			// fixing this, not yet resolved: p7 measures the ANGLE between L5's contour and
			// S1's endplate, which is mostly sensitive to *rotation* between the two vertebrae,
			// not the *translational* slip spondylolisthesis fundamentally is — a pure
			// translation (no rotation) leaves p7 unchanged. p5/p6 (translational/angular disc
			// displacement) may be the better-suited input; needs clinical input to confirm,
			// not a further code guess.
			const l5s1Angle = getGapParams(projection, { top: l5, bottom: s1 }, mmPerPixel)!.params.p7
				.val as number | null;
			if (l5s1Angle !== null)
				findings.push(withId(Sagittal.gradeL5Spondylolisthesis(l5s1Angle), 'l5-spondylolisthesis'));
		}

		const [regionStart, regionEnd] = region.vertebraeLabel.split('-');
		const regionIdentity: Localized = resolve_localized('diagnosis.narrative.regionIdentity', {
			start: regionStart,
			end: regionEnd
		});
		const narrative = buildParametersNarrative(
			regionIdentity,
			projection,
			'segments',
			segmentParams
		);

		regions.push({
			id: region.id,
			label: region.label,
			vertebraeLabel: region.vertebraeLabel,
			vertebrae,
			gaps,
			findings,
			narrative
		});
	}

	const overall: Finding[] = [];
	if (projection === 'frontal') {
		const gcomMm = getSpineParams(projection, polygons, mmPerPixel).params.p3.val as number | null;
		if (gcomMm !== null && gcomMm !== undefined) {
			overall.push(withId(Frontal.gradeGCoM(gcomMm), 'overall-gcom'));
		}
	}

	const conclusion: Finding[] = [];
	for (const f of overall) if (f.severity !== 'normal') conclusion.push(f);
	for (const region of regions) {
		for (const f of region.findings)
			if (f.severity !== 'normal') conclusion.push(withStructureLabel(f, region.label));
		for (const v of region.vertebrae) {
			for (const f of v.findings)
				if (f.severity !== 'normal') conclusion.push(withStructureLabel(f, vertebraLabel(v.id)));
		}
		for (const g of region.gaps) {
			for (const f of g.findings)
				if (f.severity !== 'normal') conclusion.push(withStructureLabel(f, gapLabel(g.id)));
		}
	}

	if (conclusion.length === 0) {
		conclusion.push({
			id: 'no-findings',
			severity: 'normal',
			text: resolve_localized('diagnosis.narrative.noFindings')
		});
	}

	// Now means "not a single region is fully annotated yet" — each region
	// that IS ready already rendered above, independently of the others.
	return { insufficientAnnotation: regions.length === 0, regions, overall, conclusion };
}

export const diagnosis = {
	get side() {
		return computeProjectionDiagnosis('side');
	},
	get frontal() {
		return computeProjectionDiagnosis('frontal');
	}
};
