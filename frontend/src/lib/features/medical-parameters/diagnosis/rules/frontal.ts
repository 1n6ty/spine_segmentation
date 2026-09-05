import type { Finding, Range, Severity } from '../types';
import { resolve_localized } from '$lib/core/i18n/resolve';

/**
 * Thresholds transcribed from "Описание спондилограмм во фронтальной
 * плоскости.docx.pdf". Applied to the three FIXED anatomical regions (not
 * dynamically detected scoliotic arcs, per scope decision) — less clinically
 * precise than true arc detection, but a meaningful first-pass screen and a
 * much smaller implementation.
 *
 * Left/right labeling assumes the source document's sign convention (negative
 * central angle = left-sided curve) holds for this app's pixel coordinate
 * system. The app does not currently track DICOM image laterality, so
 * "left"/"right" here is an approximation pending that metadata being wired
 * up — flagged in docs/gaps-and-recommendations.md.
 *
 * Pelvic obliquity ("bicapital line") is not implemented: no pelvic landmark
 * points exist in the current 4-point vertebra polygon model.
 */

const NORMAL_BAND_DEG = 5;

/** Normal band for the regional central angle, shared with the report's
 * display bracket so it can never drift from the grading logic below. */
export function getRegionFrontalRange(): Range {
	return { min: -NORMAL_BAND_DEG, max: NORMAL_BAND_DEG, center: 0 };
}

/** Chaklin scoliosis classification by Cobb-equivalent central arc angle. */
export function gradeRegionFrontal(centralAngleDeg: number): Finding {
	const magnitude = Math.abs(centralAngleDeg);
	if (magnitude <= NORMAL_BAND_DEG) {
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.frontal.regional.normal')
		};
	}
	const side = resolve_localized(
		centralAngleDeg < 0 ? 'diagnosis.rules.frontal.side.left' : 'diagnosis.rules.frontal.side.right'
	);
	let severity: Severity;
	let grade: number;
	if (magnitude <= 10) {
		severity = 'grade1';
		grade = 1;
	} else if (magnitude <= 25) {
		severity = 'grade2';
		grade = 2;
	} else if (magnitude <= 50) {
		severity = 'grade3';
		grade = 3;
	} else {
		severity = 'grade4';
		grade = 4;
	}
	return {
		id: '',
		severity,
		text: resolve_localized('diagnosis.rules.frontal.regional.scoliosis', {
			side,
			grade,
			angle: magnitude.toFixed(1)
		})
	};
}

const WEDGING_TOLERANCE_DEG = 1;

/** Normal band for the frontal wedging angle, shared with the display bracket. */
export function getVertebralWedgingFrontalRange(): Range {
	return { min: -WEDGING_TOLERANCE_DEG, max: WEDGING_TOLERANCE_DEG, center: 0 };
}

/** "Знак и угол клиновидности тела * позвонка" — ±1° threshold. */
export function gradeVertebralWedgingFrontal(angleDeg: number): Finding {
	if (angleDeg > WEDGING_TOLERANCE_DEG) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.frontal.wedging.right', {
				angle: angleDeg.toFixed(1)
			})
		};
	}
	if (angleDeg < -WEDGING_TOLERANCE_DEG) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.frontal.wedging.left', {
				angle: Math.abs(angleDeg).toFixed(1)
			})
		};
	}
	return {
		id: '',
		severity: 'normal',
		text: resolve_localized('diagnosis.rules.frontal.wedging.normal')
	};
}

const LATERAL_DISPLACEMENT_TOLERANCE_MM = 2;

/** Normal band for lateral displacement, shared with the display bracket. */
export function getLateralDisplacementRange(): Range {
	return {
		min: -LATERAL_DISPLACEMENT_TOLERANCE_MM,
		max: LATERAL_DISPLACEMENT_TOLERANCE_MM,
		center: 0
	};
}

/** "Линейное смещение тела * позвонка" — >2mm threshold. */
export function gradeLateralDisplacement(mm: number): Finding {
	if (Math.abs(mm) <= LATERAL_DISPLACEMENT_TOLERANCE_MM) {
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.frontal.lateralDisplacement.normal')
		};
	}
	const direction = resolve_localized(
		mm > 0 ? 'diagnosis.rules.frontal.direction.right' : 'diagnosis.rules.frontal.direction.left'
	);
	return {
		id: '',
		severity: 'grade1',
		text: resolve_localized('diagnosis.rules.frontal.lateralDisplacement.displaced', {
			mm: Math.abs(mm).toFixed(1),
			direction
		})
	};
}

/** GCoM lateral offset — ±70mm threshold, reusing spine.ts's overall p3. */
export function gradeGCoM(mm: number): Finding {
	if (Math.abs(mm) <= 70) {
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.frontal.gcom.normal', { mm: mm.toFixed(1) })
		};
	}
	const direction = resolve_localized(
		mm > 0 ? 'diagnosis.rules.frontal.direction.right' : 'diagnosis.rules.frontal.direction.left'
	);
	return {
		id: '',
		severity: 'grade2',
		text: resolve_localized('diagnosis.rules.frontal.gcom.shifted', {
			direction,
			mm: Math.abs(mm).toFixed(1)
		})
	};
}

/**
 * L5 superior-endplate inclination (frontal vertebrae.p8, L5 only) —
 * "Описание спондилограмм во фронтальной плоскости.docx.pdf": "Величина и
 * угол наклона верхней замыкательной пластинки L5 позвонка к оси Z", normal
 * -89° to 89° ("Тело L5 позвонка не отклонено"). A very wide band — only
 * flags a near-90° rotation — but explicitly L5-specific in the source, not
 * a generic per-vertebra threshold. The source only spells out the "менее
 * -89°" (left) branch; the "более 89°" (right) branch is inferred as the
 * symmetric mirror, consistent with how every other two-directional rule in
 * this file is structured.
 */
const L5_SUPERIOR_ENDPLATE_FRONTAL_TOLERANCE_DEG = 89;

export function getL5SuperiorEndplateInclinationFrontalRange(): Range {
	return {
		min: -L5_SUPERIOR_ENDPLATE_FRONTAL_TOLERANCE_DEG,
		max: L5_SUPERIOR_ENDPLATE_FRONTAL_TOLERANCE_DEG,
		center: 0
	};
}

export function gradeL5SuperiorEndplateInclinationFrontal(angleDeg: number): Finding {
	if (Math.abs(angleDeg) <= L5_SUPERIOR_ENDPLATE_FRONTAL_TOLERANCE_DEG) {
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.frontal.l5SuperiorEndplate.normal')
		};
	}
	const direction = resolve_localized(
		angleDeg < 0
			? 'diagnosis.rules.frontal.direction.left'
			: 'diagnosis.rules.frontal.direction.right'
	);
	return {
		id: '',
		severity: 'grade1',
		text: resolve_localized('diagnosis.rules.frontal.l5SuperiorEndplate.deviated', { direction })
	};
}
