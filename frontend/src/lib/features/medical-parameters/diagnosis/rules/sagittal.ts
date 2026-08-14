import type { Finding, Severity } from '../types';
import { resolve_localized } from '$lib/core/i18n/resolve';

/**
 * Thresholds transcribed from "Классификация кифозов таблица.doc.pdf" (regional
 * sagittal grading) and "TABLREHTG.docx.pdf" pages 1-10 (sacral/L5 inclination,
 * L5/L4 spondylolisthesis, Scheuermann's disease). Page 11's disc-angle-by-level
 * table is NOT used here — it extracted with overlapping/garbled text and needs
 * the original .docx to transcribe correctly.
 *
 * Pelvic obliquity ("bicapital line") and the angular (focal, few-vertebra)
 * kyphosis table are also not implemented: neither has a computed geometric
 * input available today (no pelvic landmark points exist in the 4-point
 * vertebra model; the angular table needs identifying "the deformed segment"
 * which isn't derivable from the fixed 3-region grouping used here).
 *
 * Each grading function is a plain if/else chain over the source table's bands
 * rather than a generic table-lookup helper: some tables increase in severity
 * as the value increases (regional kyphosis), others as it decreases
 * (spondylolisthesis) — collapsing both into one generic "first band whose max
 * >= value" helper silently breaks for the second kind. Explicit chains are
 * easier to verify line-by-line against the source tables than debugging a
 * shared abstraction's ordering assumptions.
 */

/** "Классификация кифозов таблица.doc.pdf" page 1, regional central-arc-angle grading. */
export function gradeRegionSagittal(
	regionId: 'cervical' | 'thoracic' | 'lumbar',
	centralAngleDeg: number
): Finding {
	const a = centralAngleDeg;
	if (regionId === 'cervical') {
		if (a <= -56)
			return {
				id: '',
				severity: 'grade2',
				text: resolve_localized('diagnosis.rules.sagittal.regional.cervical.lordosisGrade2')
			};
		if (a <= -41)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.regional.cervical.lordosisGrade1')
			};
		if (a <= -15)
			return {
				id: '',
				severity: 'normal',
				text: resolve_localized('diagnosis.rules.sagittal.regional.cervical.normal')
			};
		if (a <= 0)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.regional.cervical.kyphosisGrade1')
			};
		if (a <= 15)
			return {
				id: '',
				severity: 'grade2',
				text: resolve_localized('diagnosis.rules.sagittal.regional.cervical.kyphosisGrade2')
			};
		if (a <= 30)
			return {
				id: '',
				severity: 'grade3',
				text: resolve_localized('diagnosis.rules.sagittal.regional.cervical.kyphosisGrade3')
			};
		return {
			id: '',
			severity: 'grade4',
			text: resolve_localized('diagnosis.rules.sagittal.regional.cervical.kyphosisGrade4')
		};
	}
	if (regionId === 'thoracic') {
		if (a <= -1)
			return {
				id: '',
				severity: 'grade2',
				text: resolve_localized('diagnosis.rules.sagittal.regional.thoracic.lordosisGrade2')
			};
		if (a <= 39)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.regional.thoracic.lordosisGrade1')
			};
		if (a <= 65)
			return {
				id: '',
				severity: 'normal',
				text: resolve_localized('diagnosis.rules.sagittal.regional.thoracic.normal')
			};
		if (a <= 70)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.regional.thoracic.kyphosisGrade1')
			};
		if (a <= 80)
			return {
				id: '',
				severity: 'grade2',
				text: resolve_localized('diagnosis.rules.sagittal.regional.thoracic.kyphosisGrade2')
			};
		if (a <= 90)
			return {
				id: '',
				severity: 'grade3',
				text: resolve_localized('diagnosis.rules.sagittal.regional.thoracic.kyphosisGrade3')
			};
		return {
			id: '',
			severity: 'grade4',
			text: resolve_localized('diagnosis.rules.sagittal.regional.thoracic.kyphosisGrade4')
		};
	}
	// lumbar
	if (a <= -71)
		return {
			id: '',
			severity: 'grade2',
			text: resolve_localized('diagnosis.rules.sagittal.regional.lumbar.lordosisGrade2')
		};
	if (a <= -56)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.regional.lumbar.lordosisGrade1')
		};
	if (a <= -30)
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.regional.lumbar.normal')
		};
	if (a <= 0)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.regional.lumbar.kyphosisGrade1')
		};
	if (a <= 20)
		return {
			id: '',
			severity: 'grade2',
			text: resolve_localized('diagnosis.rules.sagittal.regional.lumbar.kyphosisGrade2')
		};
	if (a <= 40)
		return {
			id: '',
			severity: 'grade3',
			text: resolve_localized('diagnosis.rules.sagittal.regional.lumbar.kyphosisGrade3')
		};
	return {
		id: '',
		severity: 'grade4',
		text: resolve_localized('diagnosis.rules.sagittal.regional.lumbar.kyphosisGrade4')
	};
}

/** "Наклон S1 позвонка к оси Z" — TABLREHTG.docx.pdf row 8. */
export function gradeSacralSlope(angleDeg: number): Finding {
	if (angleDeg < 99) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.sacralSlope.towardVertical')
		};
	}
	if (angleDeg > 124) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.sacralSlope.towardHorizontal')
		};
	}
	return {
		id: '',
		severity: 'normal',
		text: resolve_localized('diagnosis.rules.sagittal.sacralSlope.normal')
	};
}

/** "Наклон L5 позвонка к оси Z" (graded variant) — TABLREHTG.docx.pdf row 7, applied to L5's superior-endplate inclination as the available proxy. */
export function gradeL5Inclination(angleDeg: number): Finding {
	const a = angleDeg;
	if (a < -3)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.l5Inclination.posterior')
		};
	if (a <= 18)
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.l5Inclination.normal')
		};
	if (a <= 22)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.l5Inclination.anteriorGrade1')
		};
	if (a <= 36)
		return {
			id: '',
			severity: 'grade2',
			text: resolve_localized('diagnosis.rules.sagittal.l5Inclination.anteriorGrade2')
		};
	if (a <= 60)
		return {
			id: '',
			severity: 'grade3',
			text: resolve_localized('diagnosis.rules.sagittal.l5Inclination.anteriorGrade3')
		};
	if (a <= 80)
		return {
			id: '',
			severity: 'grade4',
			text: resolve_localized('diagnosis.rules.sagittal.l5Inclination.anteriorGrade4')
		};
	return {
		id: '',
		severity: 'grade5',
		text: resolve_localized('diagnosis.rules.sagittal.l5Inclination.anteriorGrade5')
	};
}

/**
 * L5 spondylolisthesis grading by L5-S1 disc angle — "Классификация кифозов
 * таблица.doc.pdf" page 3. Input is the gaps.ts L5-S1 special-case angle
 * (`p7`), used as the available proxy for "угол наклона диска L5-S1". Severity
 * increases as the angle becomes MORE negative, the opposite direction from
 * the regional kyphosis tables above.
 */
export function gradeL5Spondylolisthesis(l5s1AngleDeg: number): Finding {
	const a = l5s1AngleDeg;
	if (a > -35)
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.l5Spondylolisthesis.normal')
		};
	if (a > -75)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.l5Spondylolisthesis.grade1')
		};
	if (a > -120)
		return {
			id: '',
			severity: 'grade2',
			text: resolve_localized('diagnosis.rules.sagittal.l5Spondylolisthesis.grade2')
		};
	if (a > -140)
		return {
			id: '',
			severity: 'grade3',
			text: resolve_localized('diagnosis.rules.sagittal.l5Spondylolisthesis.grade3')
		};
	return {
		id: '',
		severity: 'grade4',
		text: resolve_localized('diagnosis.rules.sagittal.l5Spondylolisthesis.grade4')
	};
}

/**
 * Scheuermann's disease (Болезнь Шойермана-Мау) — TABLREHTG.docx.pdf page 7.
 * Simplified v1: flags when at least 3 of the Th6-Th9 vertebrae are wedged
 * more than 5 degrees AND the thoracic region already grades as increased
 * kyphosis. The source's additional disc-height-reduction criterion is
 * skipped (no usable disc-norm table — see file header).
 */
export function gradeScheuermann(
	th6Th9WedgingAnglesDeg: number[],
	thoracicSeverity: Severity
): Finding | null {
	const wedgedCount = th6Th9WedgingAnglesDeg.filter((a) => Math.abs(a) > 5).length;
	if (wedgedCount < 3 || thoracicSeverity === 'normal') return null;
	const grade =
		thoracicSeverity === 'grade3' || thoracicSeverity === 'grade4'
			? 3
			: thoracicSeverity === 'grade2'
				? 2
				: 1;
	return {
		id: '',
		severity: thoracicSeverity,
		text: resolve_localized('diagnosis.rules.sagittal.scheuermann', { grade })
	};
}

/**
 * Possible vertebral body fracture — combinatorial rule from TABLREHTG.docx.pdf
 * page 8 ("Клиновидность тела позвонка + увеличение центрального угла
 * нижележащего отдела" -> "Перелом тела * позвонка"). The source doesn't give
 * an exact fracture-specific wedging threshold ("смотреть норму в таблице"
 * pointing at the same garbled table); >10 degrees is used here as a
 * conservative, clearly-pathological cutoff distinct from Scheuermann's milder
 * >5 degree/3-vertebra pattern, and should be reviewed against clinical input.
 */
export function gradeVertebralFracture(
	wedgingAngleDeg: number,
	lowerRegionSeverity: Severity
): Finding | null {
	if (Math.abs(wedgingAngleDeg) <= 10 || lowerRegionSeverity === 'normal') return null;
	return {
		id: '',
		severity: 'grade3',
		text: resolve_localized('diagnosis.rules.sagittal.vertebralFracture', {
			angle: wedgingAngleDeg.toFixed(1)
		})
	};
}
