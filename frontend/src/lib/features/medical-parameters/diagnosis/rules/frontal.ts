import type { Finding, Severity } from '../types';
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

/** "Знак и угол клиновидности тела * позвонка" — ±1° threshold. */
export function gradeVertebralWedgingFrontal(angleDeg: number): Finding {
	if (angleDeg > 1) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.frontal.wedging.right', {
				angle: angleDeg.toFixed(1)
			})
		};
	}
	if (angleDeg < -1) {
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

/** "Линейное смещение тела * позвонка" — >2mm threshold. */
export function gradeLateralDisplacement(mm: number): Finding {
	if (Math.abs(mm) <= 2) {
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
