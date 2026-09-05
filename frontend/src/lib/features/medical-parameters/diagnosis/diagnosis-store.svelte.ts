import { project } from '$lib/core/project.svelte';
import type { Projection } from '$lib/features/dicom/types';
import { getVertebraeParams } from '../calculators/vertebrae';
import { getGapParams } from '../calculators/gaps';
import { getSegmentParams } from '../calculators/segments';
import { getSpineParams } from '../calculators/spine';
import type { Vertebrae } from '../types';
import { REGIONS, THORACIC_SUBREGIONS, match_items_by_ids, type RegionDef } from './regions';
import * as Sagittal from './rules/sagittal';
import * as Frontal from './rules/frontal';
import type {
	Finding,
	GapDiagnosis,
	Localized,
	ProjectionDiagnosis,
	Range,
	RegionDiagnosis,
	VertebraDiagnosis
} from './types';
import { buildParametersNarrative, withRangeBadge, vertebraLabel, gapLabel } from './narrative';
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
	let narrative = buildParametersNarrative(vertebraLabel(v.id), projection, 'vertebrae', vParams);

	if (projection === 'frontal') {
		const wedging = vParams.p6.val as number | null;
		if (wedging !== null) {
			const finding = Frontal.gradeVertebralWedgingFrontal(wedging);
			findings.push(withId(finding, `${v.id}-wedging`));
			narrative = withRangeBadge(
				narrative,
				'p6',
				finding.severity,
				Frontal.getVertebralWedgingFrontalRange()
			);
		}
	} else {
		const wedging = vParams.p5.val as number | null;
		if (wedging !== null) {
			const wedgingFinding = Sagittal.gradeVertebralWedgingSagittal(wedging);
			findings.push(withId(wedgingFinding, `${v.id}-wedging`));
			narrative = withRangeBadge(
				narrative,
				'p5',
				wedgingFinding.severity,
				Sagittal.getVertebralWedgingSagittalRange()
			);

			const fracture = Sagittal.gradeVertebralFracture(wedging, regionFinding.severity);
			if (fracture) findings.push(withId(fracture, `${v.id}-fracture`));
		}
	}

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
	const id = `${top.id}-${bottom.id}`;
	let narrative = buildParametersNarrative(gapLabel(id), projection, 'gaps', gParams);

	if (projection === 'frontal') {
		// p5 = linear displacement (mm), per config.ts. (An earlier pass had p1/p5 actually
		// swapped in gaps.ts despite being "fixed" in name only — see gaps.ts and
		// docs/gaps-and-recommendations.md for how that was caught and corrected.)
		const displacement = gParams.p5.val as number | null;
		if (displacement !== null) {
			const finding = Frontal.gradeLateralDisplacement(displacement);
			findings.push(withId(finding, `${top.id}-${bottom.id}-displacement`));
			narrative = withRangeBadge(
				narrative,
				'p5',
				finding.severity,
				Frontal.getLateralDisplacementRange()
			);
		}
	} else {
		const discAngle = gParams.p1.val as number | null;
		if (discAngle !== null) {
			const finding = Sagittal.gradeSagittalDiscAngle(id, discAngle);
			if (finding) {
				findings.push(withId(finding, `${id}-disc-angle`));
				const range = Sagittal.getSagittalDiscAngleRange(id);
				if (range) narrative = withRangeBadge(narrative, 'p1', finding.severity, range);
			}
		}
		const displacement = gParams.p5.val as number | null;
		if (displacement !== null) {
			const finding = Sagittal.gradeSagittalDisplacement(displacement);
			findings.push(withId(finding, `${id}-displacement`));
			narrative = withRangeBadge(
				narrative,
				'p5',
				finding.severity,
				Sagittal.getSagittalDisplacementRange()
			);
		}
		const discWedging = gParams.p4.val as number | null;
		if (discWedging !== null) {
			const finding = Sagittal.gradeSagittalDiscWedging(discWedging);
			findings.push(withId(finding, `${id}-disc-wedging`));
			narrative = withRangeBadge(
				narrative,
				'p4',
				finding.severity,
				Sagittal.getSagittalDiscWedgingRange()
			);
		}
	}

	return { id, findings, narrative };
}

type RegionMeta = { id: string; label: Localized; vertebraeLabel: string };

/** Curve-only: central-angle grading + its narrative sentence, no
 * vertebra/gap construction. Used both by buildRegionDiagnosis below and
 * directly by the thoracic container (which needs the whole-Th1-Th12 curve
 * grading but must NOT materialize 12 vertebra/11 gap entries of its own —
 * those belong to the 3 sub-regions instead). */
function buildCurveDiagnosis(
	projection: Projection,
	regionVertebrae: Vertebrae[],
	mmPerPixel: number,
	meta: RegionMeta,
	gradeCurve: (centralAngleDeg: number) => Finding,
	getCurveRange: () => Range
) {
	const segmentParams = getSegmentParams(projection, regionVertebrae, mmPerPixel).params;
	const centralAngle = segmentParams.p3.val as number;
	const curveFinding = gradeCurve(centralAngle);

	const [start, end] = meta.vertebraeLabel.split('-');
	const regionIdentity: Localized = resolve_localized('diagnosis.narrative.regionIdentity', {
		start,
		end
	});
	let narrative = buildParametersNarrative(regionIdentity, projection, 'segments', segmentParams);
	narrative = withRangeBadge(narrative, 'p3', curveFinding.severity, getCurveRange());

	return { curveFinding, narrative };
}

/** Full region build: curve grading + per-vertebra findings + internal
 * consecutive gaps. This is what REGIONS' cervical/lumbar/frontal-thoracic
 * use today, and what each of the 3 sagittal thoracic sub-regions reuses
 * unchanged (same construction logic, narrower vertebra span, own grading
 * function passed in). */
function buildRegionDiagnosis(
	projection: Projection,
	regionVertebrae: Vertebrae[],
	mmPerPixel: number,
	meta: RegionMeta,
	gradeCurve: (centralAngleDeg: number) => Finding,
	getCurveRange: () => Range
): RegionDiagnosis {
	const { curveFinding, narrative } = buildCurveDiagnosis(
		projection,
		regionVertebrae,
		mmPerPixel,
		meta,
		gradeCurve,
		getCurveRange
	);
	const findings: Finding[] = [withId(curveFinding, `${meta.id}-curve`)];

	const vertebrae = regionVertebrae.map((v) =>
		buildVertebraDiagnosis(projection, v, mmPerPixel, curveFinding)
	);
	const gaps: GapDiagnosis[] = [];
	for (let i = 0; i < regionVertebrae.length - 1; i++) {
		// regionVertebrae is ordered inferior->superior (ids[] order), so the more superior vertebra is at i+1
		gaps.push(
			buildGapDiagnosis(projection, regionVertebrae[i + 1], regionVertebrae[i], mmPerPixel)
		);
	}

	return {
		id: meta.id,
		label: meta.label,
		vertebraeLabel: meta.vertebraeLabel,
		vertebrae,
		gaps,
		findings,
		narrative
	};
}

/**
 * Sagittal-only thoracic container: the whole-Th1-Th12 curve grading (same
 * clinical rule as before, gradeRegionSagittal('thoracic', ...)) attached to
 * a region with no vertebrae/gaps of its own, plus 3 nested sub-regions
 * (upper/mid/lower) each built via buildRegionDiagnosis exactly like
 * cervical/lumbar are. The 2 disc-level gaps that fall on a sub-region
 * boundary (Th5-Th6, Th9-Th10) are computed explicitly and appended, since
 * each sub-region's own internal gap loop only covers vertebrae within its
 * own list.
 */
function buildThoracicSideDiagnosis(
	thoracicVertebrae: Vertebrae[],
	mmPerPixel: number,
	thoracicRegionDef: RegionDef
): RegionDiagnosis {
	const { curveFinding, narrative } = buildCurveDiagnosis(
		'side',
		thoracicVertebrae,
		mmPerPixel,
		thoracicRegionDef,
		(angle) => Sagittal.gradeRegionSagittal('thoracic', angle),
		() => Sagittal.getRegionSagittalRange('thoracic')
	);
	const findings: Finding[] = [withId(curveFinding, 'thoracic-curve')];

	const built = THORACIC_SUBREGIONS.map((sub) => {
		const subVertebrae = match_items_by_ids(thoracicVertebrae, sub.ids)!; // never null: thoracicVertebrae already contains all 12
		const diagnosis = buildRegionDiagnosis(
			'side',
			subVertebrae,
			mmPerPixel,
			sub,
			(angle) => Sagittal.gradeThoracicSubArc(sub.subArcId, angle),
			() => Sagittal.getThoracicSubArcRange(sub.subArcId)
		);
		return { subVertebrae, diagnosis };
	});
	const [upper, mid, lower] = built;

	const th5 = upper.subVertebrae.find((v) => v.id === 'Th5')!;
	const th6 = mid.subVertebrae.find((v) => v.id === 'Th6')!;
	upper.diagnosis.gaps.push(buildGapDiagnosis('side', th5, th6, mmPerPixel));

	const th9 = mid.subVertebrae.find((v) => v.id === 'Th9')!;
	const th10 = lower.subVertebrae.find((v) => v.id === 'Th10')!;
	mid.diagnosis.gaps.push(buildGapDiagnosis('side', th9, th10, mmPerPixel));

	// Scheuermann fires once, here, at the container level — reuses mid's own
	// Th6-Th9 vertebra list instead of re-deriving it.
	const wedgingAngles = mid.subVertebrae
		.map((v) => getVertebraeParams('side', v, mmPerPixel)!.params.p5.val as number | null)
		.filter((a): a is number => a !== null);
	const scheuermann = Sagittal.gradeScheuermann(wedgingAngles, curveFinding.severity);
	if (scheuermann) findings.push(withId(scheuermann, 'thoracic-scheuermann'));

	// Thoracic chord tilt: a dedicated Th5-Th12 sub-segment, deliberately
	// distinct from both the whole-Th1-Th12 container span above and the 3
	// sub-arcs — no narrated clause exists for this exact span anywhere in
	// the report, so this is a standalone finding with no inline bracket
	// (same as GCoM).
	const th5ToTh12 = match_items_by_ids(thoracicVertebrae, [
		'Th12',
		'Th11',
		'Th10',
		'Th9',
		'Th8',
		'Th7',
		'Th6',
		'Th5'
	]);
	if (th5ToTh12) {
		const chordTiltAngle = getSegmentParams('side', th5ToTh12, mmPerPixel).params.p4.val as
			| number
			| null;
		if (chordTiltAngle !== null) {
			findings.push(withId(Sagittal.gradeThoracicChordTilt(chordTiltAngle), 'thoracic-chord-tilt'));
		}
	}

	return {
		id: thoracicRegionDef.id,
		label: thoracicRegionDef.label,
		vertebraeLabel: thoracicRegionDef.vertebraeLabel,
		vertebrae: [],
		gaps: [],
		findings,
		narrative,
		subRegions: [upper.diagnosis, mid.diagnosis, lower.diagnosis]
	};
}

/** Recursively gathers every abnormal finding (region-level, per-vertebra,
 * per-gap, and — for the thoracic container — its nested sub-regions) into
 * the whole-spine conclusion list. */
function collectConclusionFindings(region: RegionDiagnosis, conclusion: Finding[]) {
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
	for (const sub of region.subRegions ?? []) collectConclusionFindings(sub, conclusion);
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

		// Sagittal thoracic gets nested sub-regions instead of the generic
		// build below — frontal thoracic is untouched, still one flat region.
		if (projection === 'side' && region.id === 'thoracic') {
			regions.push(buildThoracicSideDiagnosis(regionVertebrae, mmPerPixel, region));
			continue;
		}

		// segments.ts's p3 (central angle) is now signed (derived from the fitted circle's
		// actual center, not the unsigned law-of-cosines acos) so both gradeRegionFrontal's
		// left/right branches and gradeRegionSagittal's lordosis/kyphosis branches are
		// genuinely reachable — previously p3 was always >= 0, making "left-sided" and
		// "lordosis-flattening" unreachable regardless of the real curve shape.
		const gradeCurve = (angle: number) =>
			projection === 'side'
				? Sagittal.gradeRegionSagittal(region.id, angle)
				: Frontal.gradeRegionFrontal(angle);
		const getCurveRange = () =>
			projection === 'side'
				? Sagittal.getRegionSagittalRange(region.id)
				: Frontal.getRegionFrontalRange();

		const regionDiagnosis = buildRegionDiagnosis(
			projection,
			regionVertebrae,
			mmPerPixel,
			region,
			gradeCurve,
			getCurveRange
		);

		if (projection === 'side' && region.id === 'lumbar') {
			// regionVertebrae[0]/[1] are S1/L5 (region.ids = ["S1", "L5", "L4", "L3", "L2", "L1"]).
			// Findings stay on the region's own findings list, exactly as before this
			// refactor — only the bracket wiring below (patching the already-built
			// vertebra/gap narratives in place) is new.
			const s1 = regionVertebrae[0];
			const l5 = regionVertebrae[1];

			const sacralSlope = getVertebraeParams('side', s1, mmPerPixel)!.params.p9.val as
				| number
				| null;
			if (sacralSlope !== null) {
				const finding = Sagittal.gradeSacralSlope(sacralSlope);
				regionDiagnosis.findings.push(withId(finding, 's1-sacral-slope'));
				const s1Vertebra = regionDiagnosis.vertebrae.find((v) => v.id === 'S1');
				if (s1Vertebra) {
					s1Vertebra.narrative = withRangeBadge(
						s1Vertebra.narrative,
						'p9',
						finding.severity,
						Sagittal.getSacralSlopeRange()
					);
				}
			}

			const l5Inclination = getVertebraeParams('side', l5, mmPerPixel)!.params.p7.val as
				| number
				| null;
			if (l5Inclination !== null) {
				const finding = Sagittal.gradeL5Inclination(l5Inclination);
				regionDiagnosis.findings.push(withId(finding, 'l5-inclination'));
				const l5Vertebra = regionDiagnosis.vertebrae.find((v) => v.id === 'L5');
				if (l5Vertebra) {
					l5Vertebra.narrative = withRangeBadge(
						l5Vertebra.narrative,
						'p7',
						finding.severity,
						Sagittal.getL5InclinationRange()
					);
				}
			}

			// p7 is now signed (verified: an unslipped baseline reads ~+90°, correctly inside
			// gradeL5Spondylolisthesis's "normal" band, not immediately misclassified as severe
			// slip like the old unsigned version did). One remaining concern surfaced while
			// fixing this, not yet resolved: p7 measures the ANGLE between L5's contour and
			// S1's endplate, which is mostly sensitive to *rotation* between the two vertebrae,
			// not the *translational* slip spondylolisthesis fundamentally is — a pure
			// translation (no rotation) leaves p7 unchanged. p5/p6 (translational/angular disc
			// displacement) may be the better-suited input; needs clinical input to confirm,
			// not a further code guess.
			const l5s1Angle = getGapParams('side', { top: l5, bottom: s1 }, mmPerPixel)!.params.p7.val as
				| number
				| null;
			if (l5s1Angle !== null) {
				const finding = Sagittal.gradeL5Spondylolisthesis(l5s1Angle);
				regionDiagnosis.findings.push(withId(finding, 'l5-spondylolisthesis'));
				const l5s1Gap = regionDiagnosis.gaps.find((g) => g.id === 'L5-S1');
				if (l5s1Gap) {
					l5s1Gap.narrative = withRangeBadge(
						l5s1Gap.narrative,
						'p7',
						finding.severity,
						Sagittal.getL5SpondylolisthesisRange()
					);
				}
			}

			const l5InferiorEndplate = getVertebraeParams('side', l5, mmPerPixel)!.params.p8.val as
				| number
				| null;
			if (l5InferiorEndplate !== null) {
				const finding = Sagittal.gradeL5InferiorEndplateInclination(l5InferiorEndplate);
				regionDiagnosis.findings.push(withId(finding, 'l5-inferior-endplate'));
				const l5Vertebra = regionDiagnosis.vertebrae.find((v) => v.id === 'L5');
				if (l5Vertebra) {
					l5Vertebra.narrative = withRangeBadge(
						l5Vertebra.narrative,
						'p8',
						finding.severity,
						Sagittal.getL5InferiorEndplateInclinationRange()
					);
				}
			}

			const lumbarChordTilt = getSegmentParams('side', regionVertebrae, mmPerPixel).params.p4
				.val as number | null;
			if (lumbarChordTilt !== null) {
				const finding = Sagittal.gradeLumbarChordTilt(lumbarChordTilt);
				regionDiagnosis.findings.push(withId(finding, 'lumbar-chord-tilt'));
				regionDiagnosis.narrative = withRangeBadge(
					regionDiagnosis.narrative,
					'p4',
					finding.severity,
					Sagittal.getLumbarChordTiltRange()
				);
			}
		}

		if (projection === 'frontal' && region.id === 'lumbar') {
			// region.ids = ["S1", "L5", "L4", "L3", "L2", "L1"], so regionVertebrae[1] is L5 here too.
			const l5 = regionVertebrae[1];
			const l5SuperiorEndplate = getVertebraeParams('frontal', l5, mmPerPixel)!.params.p8.val as
				| number
				| null;
			if (l5SuperiorEndplate !== null) {
				const finding = Frontal.gradeL5SuperiorEndplateInclinationFrontal(l5SuperiorEndplate);
				regionDiagnosis.findings.push(withId(finding, 'l5-superior-endplate'));
				const l5Vertebra = regionDiagnosis.vertebrae.find((v) => v.id === 'L5');
				if (l5Vertebra) {
					l5Vertebra.narrative = withRangeBadge(
						l5Vertebra.narrative,
						'p8',
						finding.severity,
						Frontal.getL5SuperiorEndplateInclinationFrontalRange()
					);
				}
			}
		}

		regions.push(regionDiagnosis);
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
	for (const region of regions) collectConclusionFindings(region, conclusion);

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
