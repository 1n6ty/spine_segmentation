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
import {
	tallySingle,
	tallyComposite,
	rankFromTally,
	triCode,
	evaluatePattern,
	gradeDetail,
	spondyloptosisDetail,
	severityGrade,
	matchedSymptom,
	unmatchedSymptom,
	type DiagnosisKey,
	type DiagnosisTally,
	type Symptom,
	type PatternItem
} from './conclusion';
import { buildParametersNarrative, withClauseFinding, vertebraLabel, gapLabel } from './narrative';
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
	regionFinding: Finding,
	tally: DiagnosisTally
): VertebraDiagnosis {
	const vParams = getVertebraeParams(projection, v, mmPerPixel)!.params;
	const findings: Finding[] = [];
	let narrative = buildParametersNarrative(vertebraLabel(v.id), projection, 'vertebrae', vParams);

	if (projection === 'frontal') {
		const wedging = vParams.p6.val as number | null;
		if (wedging !== null) {
			const finding = Frontal.gradeVertebralWedgingFrontal(wedging);
			findings.push(withId(finding, `${v.id}-wedging`));
			narrative = withClauseFinding(
				narrative,
				'p6',
				finding,
				Frontal.getVertebralWedgingFrontalRange()
			);
		}
	} else {
		const wedging = vParams.p5.val as number | null;
		if (wedging !== null) {
			const wedgingFinding = Sagittal.gradeVertebralWedgingSagittal(wedging);
			findings.push(withId(wedgingFinding, `${v.id}-wedging`));
			narrative = withClauseFinding(
				narrative,
				'p5',
				wedgingFinding,
				Sagittal.getVertebralWedgingSagittalRange()
			);

			// Tallied per-vertebra (a fracture is localized to one specific
			// vertebra, not a whole-spine average) and gated on the SAME
			// shipped gradeVertebralFracture() check shown in this vertebra's
			// own findings list — reusing its collapsed Finding | null result
			// directly rather than re-deriving the 2 sub-conditions
			// separately, so the conclusion card can never show a nonzero
			// probability for a vertebra whose own per-region text says
			// nothing was found. Only fires (100%) when the shipped check
			// actually does; there's no partial-credit state for this one
			// since both of its sub-conditions are already required just to
			// get a non-null Finding.
			const fracture = Sagittal.gradeVertebralFracture(wedging, regionFinding.severity);
			if (fracture) {
				findings.push(withId(fracture, `${v.id}-fracture`));
				tallySingle(tally, `sag-vertebral-fracture:${v.id}`, true, {
					detail: vertebraLabel(v.id),
					symptoms: [matchedSymptom(wedgingFinding), matchedSymptom(regionFinding)]
				});
			}
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
			narrative = withClauseFinding(
				narrative,
				'p5',
				finding,
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
				if (range) narrative = withClauseFinding(narrative, 'p1', finding, range);
			}
		}
		const displacement = gParams.p5.val as number | null;
		if (displacement !== null) {
			const finding = Sagittal.gradeSagittalDisplacement(displacement);
			findings.push(withId(finding, `${id}-displacement`));
			narrative = withClauseFinding(
				narrative,
				'p5',
				finding,
				Sagittal.getSagittalDisplacementRange()
			);
		}
		const discWedging = gParams.p4.val as number | null;
		if (discWedging !== null) {
			const finding = Sagittal.gradeSagittalDiscWedging(discWedging);
			findings.push(withId(finding, `${id}-disc-wedging`));
			narrative = withClauseFinding(
				narrative,
				'p4',
				finding,
				Sagittal.getSagittalDiscWedgingRange()
			);
		}
	}

	return { id, findings, narrative };
}

type RegionMeta = { id: string; label: Localized; vertebraeLabel: string };

type CurveSignalKey =
	| 'cervical'
	| 'thoracic'
	| 'thoracic-upper'
	| 'thoracic-mid'
	| 'thoracic-lower'
	| 'lumbar';

/** Raw values recorded as regions are built, read back once the whole
 * `REGIONS` loop completes — several composite diagnoses need data from
 * more than one region (e.g. Scheuermann's needs the lumbar and cervical
 * curve directions, but is evaluated during thoracic's own loop
 * iteration, which runs before lumbar's). `curves` covers items 1-4 of
 * conclusion.ts's 8-item registry (thoracic sub-arcs + lumbar); the rest
 * (items 5-8, plus Scheuermann's own wedging count) are recorded
 * separately since they're each computed at their own specific call site
 * rather than uniformly via buildCurveDiagnosis. Each curve signal also
 * carries the already-computed `finding` it came from, reused verbatim as
 * that region's symptom text/severity wherever it feeds a composite
 * diagnosis's expandable breakdown — no re-deriving grades. */
type CrossRegionSignals = {
	curves: Partial<Record<CurveSignalKey, { angleDeg: number; range: Range; finding: Finding }>>;
	th6Th9WedgingAngles: number[] | null; // for Scheuermann
	thoracicChordTiltAngle: number | null; // item 5: Th5-Th12 chord tilt
	thoracicChordTiltFinding: Finding | null;
};

function newSignals(): CrossRegionSignals {
	return {
		curves: {},
		th6Th9WedgingAngles: null,
		thoracicChordTiltAngle: null,
		thoracicChordTiltFinding: null
	};
}

/** Maps a sagittal region/sub-arc id to its Bekhterev's flexion-deformity
 * diagnosis key — see conclusion.ts. Cervical frontal curve has no entry:
 * the frontal diagnosis-codes source only covers thoracic/lumbar
 * scoliosis. */
const SAGITTAL_CURVE_DIAGNOSIS_KEYS: Partial<Record<string, DiagnosisKey>> = {
	cervical: 'sag-bekhterev-cervical',
	lumbar: 'sag-bekhterev-lumbar',
	thoracic: 'sag-bekhterev-thoracic-total',
	'thoracic-upper': 'sag-bekhterev-thoracic-upper',
	'thoracic-mid': 'sag-bekhterev-thoracic-mid',
	'thoracic-lower': 'sag-bekhterev-thoracic-lower'
};

/**
 * Tallies the diagnosis this curve check corresponds to (see conclusion.ts's
 * dictionary).
 *
 * Sagittal: Bekhterev's-pattern flexion deformity requires the central
 * angle in the kyphosis direction (distinguished from lordosis-flattening
 * by comparing the raw signed angle against this region's own
 * display-badge range, since Finding.severity alone doesn't preserve
 * direction) — this is the PRIMARY, gating condition: without it, this
 * region simply isn't a candidate (not tallied at all), the same way a
 * region that isn't annotated is already absent from the tally. Once
 * gated, that same span's chord tilt (segments.ts's p4, already computed
 * alongside the central angle p3 in the same getSegmentParams call — no
 * extra calculator call needed) "tending counterclockwise" is a SECONDARY,
 * partial-credit signal — its absence lowers the score but never the
 * gate itself. No graded normal band exists for most of these 6 spans'
 * chord tilt specifically (only Th5-Th12 and L1-L5 have one, and neither
 * matches most of these spans), so this is a sign-only proxy: positive =
 * counter-clockwise, per calculators/vertebrae.ts's and segments.ts's
 * shared get_signed_angle(UP, ...) convention ("positive for
 * counter-clockwise rotation, negative for clockwise") — not a verified
 * clinical threshold.
 *
 * Frontal: unchanged, single-parameter, side read off the angle's sign
 * matching Frontal.gradeRegionFrontal's own left/right branch (angle < 0 =
 * left).
 */
function tallyCurveDiagnosis(
	tally: DiagnosisTally,
	projection: Projection,
	regionId: string,
	centralAngle: number,
	chordTiltAngle: number | null,
	curveFinding: Finding,
	range: Range
) {
	if (projection === 'side') {
		const key = SAGITTAL_CURVE_DIAGNOSIS_KEYS[regionId];
		if (!key) return;
		if (!(centralAngle > range.max)) return; // gate: must be kyphosis-direction
		let abnormal = 1; // the gate itself always counts as a hit
		let total = 1;
		const symptoms: Symptom[] = [matchedSymptom(curveFinding)];
		if (chordTiltAngle !== null) {
			total += 1;
			const ccw = chordTiltAngle > 0;
			if (ccw) abnormal += 1;
			const chordTiltText = resolve_localized('diagnosis.conclusion.symptomChordTiltCcw');
			symptoms.push(
				ccw
					? { text: chordTiltText, severity: 'grade1' }
					: { text: chordTiltText, severity: 'normal' }
			);
		}
		const grade = severityGrade(curveFinding.severity);
		tallyComposite(tally, key, abnormal, total, {
			detail: grade !== null ? gradeDetail(grade) : undefined,
			symptoms
		});
		return;
	}
	if (curveFinding.severity === 'normal') return;
	const key: DiagnosisKey | null =
		regionId === 'thoracic'
			? centralAngle < 0
				? 'frontal-scoliosis-thoracic-left'
				: 'frontal-scoliosis-thoracic-right'
			: regionId === 'lumbar'
				? centralAngle < 0
					? 'frontal-scoliosis-lumbar-left'
					: 'frontal-scoliosis-lumbar-right'
				: null;
	if (key) tallySingle(tally, key, true, { symptoms: [matchedSymptom(curveFinding)] });
}

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
	getCurveRange: () => Range,
	tally: DiagnosisTally,
	signals: CrossRegionSignals
) {
	const segmentParams = getSegmentParams(projection, regionVertebrae, mmPerPixel).params;
	const centralAngle = segmentParams.p3.val as number;
	const chordTiltAngle = segmentParams.p4.val as number | null;
	const curveFinding = gradeCurve(centralAngle);
	const curveRange = getCurveRange();
	tallyCurveDiagnosis(
		tally,
		projection,
		meta.id,
		centralAngle,
		chordTiltAngle,
		curveFinding,
		curveRange
	);
	if (projection === 'side' && meta.id in SAGITTAL_CURVE_DIAGNOSIS_KEYS) {
		signals.curves[meta.id as CurveSignalKey] = {
			angleDeg: centralAngle,
			range: curveRange,
			finding: curveFinding
		};
	}

	const [start, end] = meta.vertebraeLabel.split('-');
	const regionIdentity: Localized = resolve_localized('diagnosis.narrative.regionIdentity', {
		start,
		end
	});
	let narrative = buildParametersNarrative(regionIdentity, projection, 'segments', segmentParams);
	narrative = withClauseFinding(narrative, 'p3', curveFinding, curveRange);

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
	getCurveRange: () => Range,
	tally: DiagnosisTally,
	signals: CrossRegionSignals
): RegionDiagnosis {
	const { curveFinding, narrative } = buildCurveDiagnosis(
		projection,
		regionVertebrae,
		mmPerPixel,
		meta,
		gradeCurve,
		getCurveRange,
		tally,
		signals
	);
	const findings: Finding[] = [withId(curveFinding, `${meta.id}-curve`)];

	const vertebrae = regionVertebrae.map((v) =>
		buildVertebraDiagnosis(projection, v, mmPerPixel, curveFinding, tally)
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
	thoracicRegionDef: RegionDef,
	tally: DiagnosisTally,
	signals: CrossRegionSignals
): RegionDiagnosis {
	const { curveFinding, narrative } = buildCurveDiagnosis(
		'side',
		thoracicVertebrae,
		mmPerPixel,
		thoracicRegionDef,
		(angle) => Sagittal.gradeRegionSagittal('thoracic', angle),
		() => Sagittal.getRegionSagittalRange('thoracic'),
		tally,
		signals
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
			() => Sagittal.getThoracicSubArcRange(sub.subArcId),
			tally,
			signals
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

	// Scheuermann needs the lumbar and cervical curve directions too (per
	// TABLREHTG_Updated.docx), which aren't available yet — REGIONS processes
	// cervical and thoracic before lumbar. Recorded here (this container's
	// own Th6-Th9 wedging angles), evaluated once the whole REGIONS loop
	// completes by evaluateCrossRegionComposites, which mutates `findings`
	// below in place to add the Scheuermann finding if it fires.
	signals.th6Th9WedgingAngles = mid.subVertebrae
		.map((v) => getVertebraeParams('side', v, mmPerPixel)!.params.p5.val as number | null)
		.filter((a): a is number => a !== null);

	// Thoracic chord tilt: a dedicated Th5-Th12 sub-segment, deliberately
	// distinct from both the whole-Th1-Th12 container span above and the 3
	// sub-arcs — no narrated clause exists for this exact span anywhere in
	// the report, so this is a standalone finding with no inline bracket
	// (same as GCoM). Also recorded as item 5 of the cross-region composite
	// registry (see conclusion.ts).
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
		signals.thoracicChordTiltAngle = chordTiltAngle;
		if (chordTiltAngle !== null) {
			const chordTiltFinding = Sagittal.gradeThoracicChordTilt(chordTiltAngle);
			signals.thoracicChordTiltFinding = chordTiltFinding;
			findings.push(withId(chordTiltFinding, 'thoracic-chord-tilt'));
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
	const tally: DiagnosisTally = new Map();
	const signals = newSignals();

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
			regions.push(buildThoracicSideDiagnosis(regionVertebrae, mmPerPixel, region, tally, signals));
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
			getCurveRange,
			tally,
			signals
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
			let sacralSlopeFinding: Finding | null = null;
			if (sacralSlope !== null) {
				sacralSlopeFinding = Sagittal.gradeSacralSlope(sacralSlope);
				regionDiagnosis.findings.push(withId(sacralSlopeFinding, 's1-sacral-slope'));
				const s1Vertebra = regionDiagnosis.vertebrae.find((v) => v.id === 'S1');
				if (s1Vertebra) {
					s1Vertebra.narrative = withClauseFinding(
						s1Vertebra.narrative,
						'p9',
						sacralSlopeFinding,
						Sagittal.getSacralSlopeRange()
					);
				}
			}

			const l5Inclination = getVertebraeParams('side', l5, mmPerPixel)!.params.p7.val as
				| number
				| null;
			let l5InclinationFinding: Finding | null = null;
			if (l5Inclination !== null) {
				l5InclinationFinding = Sagittal.gradeL5Inclination(l5Inclination);
				regionDiagnosis.findings.push(withId(l5InclinationFinding, 'l5-inclination'));
				const l5Vertebra = regionDiagnosis.vertebrae.find((v) => v.id === 'L5');
				if (l5Vertebra) {
					l5Vertebra.narrative = withClauseFinding(
						l5Vertebra.narrative,
						'p7',
						l5InclinationFinding,
						Sagittal.getL5InclinationRange()
					);
				}
			}

			// L5 spondylolisthesis grading — TABLREHTG_Updated.docx: graded off L5's
			// anterior displacement at L5-S1 (p5) as a fraction of L5's own
			// inferior endplate length (p2), not the L5-S1 angle (p7) used by the
			// earlier version — see gradeL5Spondylolisthesis's own doc comment.
			const l5s1DisplacementMm = getGapParams('side', { top: l5, bottom: s1 }, mmPerPixel)!.params
				.p5.val as number | null;
			const l5InferiorEndplateMm = getVertebraeParams('side', l5, mmPerPixel)!.params.p2.val as
				| number
				| null;
			let spondylolisthesisFinding: Finding | null = null;
			if (l5s1DisplacementMm !== null && l5InferiorEndplateMm !== null) {
				spondylolisthesisFinding = Sagittal.gradeL5Spondylolisthesis(
					l5s1DisplacementMm,
					l5InferiorEndplateMm
				);
				regionDiagnosis.findings.push(withId(spondylolisthesisFinding, 'l5-spondylolisthesis'));
				const l5s1Gap = regionDiagnosis.gaps.find((g) => g.id === 'L5-S1');
				if (l5s1Gap) {
					l5s1Gap.narrative = withClauseFinding(
						l5s1Gap.narrative,
						'p5',
						spondylolisthesisFinding,
						Sagittal.getL5SpondylolisthesisRange()
					);
				}
			}

			// Composite "L5 Spondylolisthesis" tally (conclusion.ts). Gated on
			// the shipped displacement-fraction Finding above being non-normal
			// — that's the actual defining measurement; L5 inclination, lumbar
			// lordosis, and (for higher grades) whole-thoracic kyphosis are
			// compensatory/supporting signs per TABLREHTG_Updated.docx, not
			// independently diagnostic. Un-gated, a patient with a completely
			// normal L5-S1 (this Finding says so right above) but abnormal
			// compensatory curves elsewhere could still show a nonzero
			// spondylolisthesis probability, directly contradicting the
			// Finding shown in this very region — the bug that prompted this
			// rewrite. Only tallied at all when the gate holds; the 3
			// remaining signals then determine how much ABOVE the gate's own
			// contribution the score sits.
			//
			// The L5-inclination signal specifically requires the ANTERIOR
			// direction ("Након тела L5 позвонка против часовой стрелки" —
			// counterclockwise, which per calculators/vertebrae.ts's signed-angle
			// convention is the same positive direction as
			// gradeL5Inclination's anterior branch) — a posterior tilt is not
			// evidence for this diagnosis, so checking severity!=='normal'
			// alone (which fires for either direction) would wrongly credit
			// the opposite tilt too.
			const lumbarSignal = signals.curves['lumbar'];
			const thoracicSignal = signals.curves['thoracic'];
			if (spondylolisthesisFinding && spondylolisthesisFinding.severity !== 'normal') {
				let spAbnormal = 1; // the gate itself
				let spTotal = 1;
				const spSymptoms: Symptom[] = [matchedSymptom(spondylolisthesisFinding)];
				if (l5Inclination !== null && l5InclinationFinding) {
					spTotal += 1;
					const anterior = l5Inclination > Sagittal.getL5InclinationRange().max;
					if (anterior) spAbnormal += 1;
					spSymptoms.push(
						anterior ? matchedSymptom(l5InclinationFinding) : unmatchedSymptom(l5InclinationFinding)
					);
				}
				if (lumbarSignal) {
					spTotal += 1;
					const lordosis = lumbarSignal.angleDeg < lumbarSignal.range.min;
					if (lordosis) spAbnormal += 1;
					spSymptoms.push(
						lordosis ? matchedSymptom(lumbarSignal.finding) : unmatchedSymptom(lumbarSignal.finding)
					);
				}
				if (thoracicSignal) {
					spTotal += 1;
					const kyphosis = thoracicSignal.angleDeg > thoracicSignal.range.max;
					if (kyphosis) spAbnormal += 1;
					spSymptoms.push(
						kyphosis
							? matchedSymptom(thoracicSignal.finding)
							: unmatchedSymptom(thoracicSignal.finding)
					);
				}
				const grade = severityGrade(spondylolisthesisFinding.severity);
				const detail =
					spondylolisthesisFinding.severity === 'grade5'
						? spondyloptosisDetail()
						: grade !== null
							? gradeDetail(grade)
							: undefined;
				tallyComposite(tally, 'sag-spondylolisthesis-l5', spAbnormal, spTotal, {
					detail,
					symptoms: spSymptoms
				});
			}

			// L4 spondylolisthesis — newly addable per TABLREHTG_Updated.docx: no
			// staging, just displacement at L4-L5 (the same generic per-gap
			// check already run for every level), gated the same way — lumbar
			// curve in the lordosis direction is a supporting signal, not a
			// substitute for the displacement itself being present.
			const l4l5Gap = regionDiagnosis.gaps.find((g) => g.id === 'L4-L5');
			const l4l5Displacement = l4l5Gap?.findings.find((f) => f.id === 'L4-L5-displacement');
			if (l4l5Displacement && l4l5Displacement.severity !== 'normal') {
				let l4Abnormal = 1;
				let l4Total = 1;
				const l4Symptoms: Symptom[] = [matchedSymptom(l4l5Displacement)];
				if (lumbarSignal) {
					l4Total += 1;
					const lordosis = lumbarSignal.angleDeg < lumbarSignal.range.min;
					if (lordosis) l4Abnormal += 1;
					l4Symptoms.push(
						lordosis ? matchedSymptom(lumbarSignal.finding) : unmatchedSymptom(lumbarSignal.finding)
					);
				}
				tallyComposite(tally, 'sag-l4-spondylolisthesis', l4Abnormal, l4Total, {
					symptoms: l4Symptoms
				});
			}

			const l5InferiorEndplate = getVertebraeParams('side', l5, mmPerPixel)!.params.p8.val as
				| number
				| null;
			if (l5InferiorEndplate !== null) {
				const finding = Sagittal.gradeL5InferiorEndplateInclination(l5InferiorEndplate);
				regionDiagnosis.findings.push(withId(finding, 'l5-inferior-endplate'));
				const l5Vertebra = regionDiagnosis.vertebrae.find((v) => v.id === 'L5');
				if (l5Vertebra) {
					l5Vertebra.narrative = withClauseFinding(
						l5Vertebra.narrative,
						'p8',
						finding,
						Sagittal.getL5InferiorEndplateInclinationRange()
					);
				}
			}

			const lumbarChordTilt = getSegmentParams('side', regionVertebrae, mmPerPixel).params.p4
				.val as number | null;
			let lumbarChordTiltFinding: Finding | null = null;
			if (lumbarChordTilt !== null) {
				lumbarChordTiltFinding = Sagittal.gradeLumbarChordTilt(lumbarChordTilt);
				regionDiagnosis.findings.push(withId(lumbarChordTiltFinding, 'lumbar-chord-tilt'));
				regionDiagnosis.narrative = withClauseFinding(
					regionDiagnosis.narrative,
					'p4',
					lumbarChordTiltFinding,
					Sagittal.getLumbarChordTiltRange()
				);
			}

			// The 5 whole-spine composite diagnoses below (see conclusion.ts's
			// doc comment) reference items 1-8 of TABLREHTG_Updated.docx's
			// general parameter table — despite being filed under a "cervical"
			// heading in the source, they're driven entirely by these
			// region-level parameters, confirmed against the document. Item
			// numbering: 1/2/3 = thoracic upper/mid/lower sub-arcs, 4 = lumbar
			// curve, 5 = thoracic (Th5-Th12) chord tilt, 6 = lumbar chord tilt,
			// 7 = L5 inclination, 8 = sacral slope (inverted sign convention —
			// see triCode's own doc comment). Evaluated here (during lumbar's
			// own loop iteration, which runs after cervical and thoracic) since
			// every item this pattern needs is available by this point,
			// whether recorded earlier via `signals` or computed just above.
			const upperSignal = signals.curves['thoracic-upper'];
			const midSignal = signals.curves['thoracic-mid'];
			const lowerSignal = signals.curves['thoracic-lower'];
			const item1: PatternItem = upperSignal
				? { code: triCode(upperSignal.angleDeg, upperSignal.range), finding: upperSignal.finding }
				: null;
			const item2: PatternItem = midSignal
				? { code: triCode(midSignal.angleDeg, midSignal.range), finding: midSignal.finding }
				: null;
			const item3: PatternItem = lowerSignal
				? { code: triCode(lowerSignal.angleDeg, lowerSignal.range), finding: lowerSignal.finding }
				: null;
			const item4: PatternItem = lumbarSignal
				? {
						code: triCode(lumbarSignal.angleDeg, lumbarSignal.range),
						finding: lumbarSignal.finding
					}
				: null;
			const item5: PatternItem =
				signals.thoracicChordTiltAngle !== null && signals.thoracicChordTiltFinding
					? {
							code: triCode(signals.thoracicChordTiltAngle, Sagittal.getThoracicChordTiltRange()),
							finding: signals.thoracicChordTiltFinding
						}
					: null;
			const item6: PatternItem =
				lumbarChordTilt !== null && lumbarChordTiltFinding
					? {
							code: triCode(lumbarChordTilt, Sagittal.getLumbarChordTiltRange()),
							finding: lumbarChordTiltFinding
						}
					: null;
			const item7: PatternItem =
				l5Inclination !== null && l5InclinationFinding
					? {
							code: triCode(l5Inclination, Sagittal.getL5InclinationRange()),
							finding: l5InclinationFinding
						}
					: null;
			const item8: PatternItem =
				sacralSlope !== null && sacralSlopeFinding
					? {
							code: triCode(sacralSlope, Sagittal.getSacralSlopeRange(), true),
							finding: sacralSlopeFinding
						}
					: null;
			const items: PatternItem[] = [item1, item2, item3, item4, item5, item6, item7, item8];
			evaluatePattern(tally, 'sag-slipped-dislocation', items, [1, 1, -1, 0, 1, 0, 1, -1]);
			evaluatePattern(tally, 'sag-subluxation', items, [1, 1, [-1, 1], 0, 1, 0, -1, -1]);
			evaluatePattern(tally, 'sag-cervical-fracture', items, [0, 0, 0, -1, 1, 0, 0, 0]);
			evaluatePattern(tally, 'sag-disc-rupture', items, [0, [0, 1], -1, 0, 1, 0, 0, 0]);
			evaluatePattern(tally, 'sag-degenerative-disc', [item1, item8], [1, [0, 1]]);
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
					l5Vertebra.narrative = withClauseFinding(
						l5Vertebra.narrative,
						'p8',
						finding,
						Frontal.getL5SuperiorEndplateInclinationFrontalRange()
					);
				}
			}
		}

		regions.push(regionDiagnosis);
	}

	// Scheuermann's needs the lumbar and cervical curve directions (per
	// TABLREHTG_Updated.docx), which weren't available during thoracic's own
	// loop iteration (REGIONS runs cervical, thoracic, lumbar in that order)
	// — evaluated here, now that the whole loop has completed, mutating the
	// already-built thoracic region's findings in place, same pattern as the
	// lumbar block's own narrative-patching above.
	if (projection === 'side') {
		const midSignal = signals.curves['thoracic-mid'];
		const lumbarSignal = signals.curves['lumbar'];
		const cervicalSignal = signals.curves['cervical'];
		if (midSignal && lumbarSignal && cervicalSignal && signals.th6Th9WedgingAngles) {
			const scheuermann = Sagittal.gradeScheuermann(
				signals.th6Th9WedgingAngles,
				midSignal.angleDeg,
				lumbarSignal.angleDeg,
				cervicalSignal.angleDeg
			);
			// gradeScheuermann() already returns null unless ALL 4 of its own
			// conditions hold (wedging count, mid-thoracic kyphosis, lumbar +
			// cervical lordosis) — so there's no meaningful "partial credit"
			// state independent of that gate to tally separately; doing so
			// previously let secondary signs alone push this diagnosis's score
			// up even when the shipped Finding itself never fired. Tallied
			// 1:1 with the shipped check instead: 100% when it fires, absent
			// otherwise.
			if (scheuermann) {
				const thoracicRegion = regions.find((r) => r.id === 'thoracic');
				thoracicRegion?.findings.push(withId(scheuermann, 'thoracic-scheuermann'));
				const grade = severityGrade(scheuermann.severity);
				const wedgedCount = signals.th6Th9WedgingAngles.filter((a) => Math.abs(a) > 5).length;
				const symptoms: Symptom[] = [
					{
						text: resolve_localized('diagnosis.conclusion.symptomWedgingCount', {
							count: wedgedCount,
							total: signals.th6Th9WedgingAngles.length
						}),
						severity: 'grade1'
					},
					matchedSymptom(midSignal.finding),
					matchedSymptom(lumbarSignal.finding),
					matchedSymptom(cervicalSignal.finding)
				];
				tallySingle(tally, 'sag-scheuermann', true, {
					detail: grade !== null ? gradeDetail(grade) : undefined,
					symptoms
				});
			}
		}
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
	return {
		insufficientAnnotation: regions.length === 0,
		regions,
		overall,
		conclusion,
		conclusionRanking: rankFromTally(tally)
	};
}

export const diagnosis = {
	get side() {
		return computeProjectionDiagnosis('side');
	},
	get frontal() {
		return computeProjectionDiagnosis('frontal');
	}
};
