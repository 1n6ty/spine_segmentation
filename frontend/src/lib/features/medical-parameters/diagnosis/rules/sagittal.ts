import type { Finding, Range, Severity } from '../types';
import { resolve_localized } from '$lib/core/i18n/resolve';

/**
 * Thresholds transcribed from "Классификация кифозов таблица.doc.pdf" (regional
 * sagittal grading, including the thoracic sub-arc and chord-tilt bands near
 * the end of this file) and "TABLREHTG.docx.pdf" (sacral/L5 inclination,
 * L5/L4 spondylolisthesis, Scheuermann's disease, the per-level disc-angle
 * table, and sagittal AP displacement) — see each function's own doc comment
 * for its specific source table/row.
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

// Normal-band boundaries for the regional central angle, shared with
// getRegionSagittalRange() below so the display bracket can never drift from
// the grading branches. Only the two numbers bounding "normal" are named —
// the other bands in the chain aren't referenced anywhere else.
const CERVICAL_NORMAL_MIN = -41;
const CERVICAL_NORMAL_MAX = -15;
const THORACIC_NORMAL_MIN = 39;
const THORACIC_NORMAL_MAX = 65;
const LUMBAR_NORMAL_MIN = -56;
const LUMBAR_NORMAL_MAX = -30;

export function getRegionSagittalRange(regionId: 'cervical' | 'thoracic' | 'lumbar'): Range {
	switch (regionId) {
		case 'cervical':
			return { min: CERVICAL_NORMAL_MIN, max: CERVICAL_NORMAL_MAX };
		case 'thoracic':
			return { min: THORACIC_NORMAL_MIN, max: THORACIC_NORMAL_MAX };
		case 'lumbar':
			return { min: LUMBAR_NORMAL_MIN, max: LUMBAR_NORMAL_MAX };
	}
}

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
		if (a <= CERVICAL_NORMAL_MIN)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.regional.cervical.lordosisGrade1')
			};
		if (a <= CERVICAL_NORMAL_MAX)
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
		if (a <= THORACIC_NORMAL_MIN)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.regional.thoracic.lordosisGrade1')
			};
		if (a <= THORACIC_NORMAL_MAX)
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
	if (a <= LUMBAR_NORMAL_MIN)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.regional.lumbar.lordosisGrade1')
		};
	if (a <= LUMBAR_NORMAL_MAX)
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

const SACRAL_SLOPE_MIN = 99;
const SACRAL_SLOPE_MAX = 124;

/** Normal band for sacral slope, shared with the display bracket. */
export function getSacralSlopeRange(): Range {
	return { min: SACRAL_SLOPE_MIN, max: SACRAL_SLOPE_MAX };
}

/** "Наклон S1 позвонка к оси Z" — TABLREHTG.docx.pdf row 8. */
export function gradeSacralSlope(angleDeg: number): Finding {
	if (angleDeg < SACRAL_SLOPE_MIN) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.sacralSlope.towardVertical')
		};
	}
	if (angleDeg > SACRAL_SLOPE_MAX) {
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

const L5_INCLINATION_MIN = -3;
const L5_INCLINATION_MAX = 18;

/** Normal band for L5 inclination, shared with the display bracket. */
export function getL5InclinationRange(): Range {
	return { min: L5_INCLINATION_MIN, max: L5_INCLINATION_MAX };
}

/** "Наклон L5 позвонка к оси Z" (graded variant) — TABLREHTG.docx.pdf row 7, applied to L5's superior-endplate inclination as the available proxy. */
export function gradeL5Inclination(angleDeg: number): Finding {
	const a = angleDeg;
	if (a < L5_INCLINATION_MIN)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.l5Inclination.posterior')
		};
	if (a <= L5_INCLINATION_MAX)
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
const L5_SPONDYLOLISTHESIS_NORMAL_MIN = -35;

/** Normal band for the L5-S1 spondylolisthesis angle, shared with the
 * display bracket. Open-ended above -35°. */
export function getL5SpondylolisthesisRange(): Range {
	return { min: L5_SPONDYLOLISTHESIS_NORMAL_MIN, max: Infinity };
}

export function gradeL5Spondylolisthesis(l5s1AngleDeg: number): Finding {
	const a = l5s1AngleDeg;
	if (a > L5_SPONDYLOLISTHESIS_NORMAL_MIN)
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

const SAGITTAL_WEDGING_TOLERANCE_DEG = 1;

/** Normal band for the sagittal vertebral body wedging angle, shared with
 * the display bracket. Same ±1° magnitude as the frontal wedging rule
 * (gradeVertebralWedgingFrontal) — the source table only states this
 * threshold once and doesn't vary it by projection. */
export function getVertebralWedgingSagittalRange(): Range {
	return { min: -SAGITTAL_WEDGING_TOLERANCE_DEG, max: SAGITTAL_WEDGING_TOLERANCE_DEG, center: 0 };
}

/**
 * "Клиновидность тела позвонка" — ±1° threshold, mirroring
 * gradeVertebralWedgingFrontal exactly. This is a standalone normal-range
 * check on the raw wedging value itself, independent of — and in addition
 * to — gradeVertebralFracture/gradeScheuermann below, which also consume
 * this same angle but combine it with other context (region severity,
 * multi-vertebra counts) to flag a different, more specific condition.
 * A vertebra can be outside this ±1° band without meeting either of those.
 */
export function gradeVertebralWedgingSagittal(angleDeg: number): Finding {
	if (angleDeg > SAGITTAL_WEDGING_TOLERANCE_DEG) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.wedging.posterior', {
				angle: angleDeg.toFixed(1)
			})
		};
	}
	if (angleDeg < -SAGITTAL_WEDGING_TOLERANCE_DEG) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.wedging.anterior', {
				angle: Math.abs(angleDeg).toFixed(1)
			})
		};
	}
	return {
		id: '',
		severity: 'normal',
		text: resolve_localized('diagnosis.rules.sagittal.wedging.normal')
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

/**
 * Thoracic sub-arc grading (upper Th1-Th5 / mid Th6-Th9 / lower Th10-Th12),
 * transcribed from the same "Классификация кифозов таблица.doc.pdf" table as
 * gradeRegionSagittal('thoracic', ...) above, which grades the whole Th1-Th12
 * span and is unaffected by this — these are additional, finer-grained rows
 * from the same source table, not a replacement.
 */
const THORACIC_SUBARC_NORMAL: Record<'upper' | 'mid' | 'lower', Range> = {
	upper: { min: 8, max: 25 },
	mid: { min: 15, max: 35 },
	lower: { min: 19, max: 40 }
};

/** Normal band for a thoracic sub-arc's central angle, shared with the display bracket. */
export function getThoracicSubArcRange(subArcId: 'upper' | 'mid' | 'lower'): Range {
	return THORACIC_SUBARC_NORMAL[subArcId];
}

export function gradeThoracicSubArc(
	subArcId: 'upper' | 'mid' | 'lower',
	centralAngleDeg: number
): Finding {
	const a = centralAngleDeg;
	const { max } = THORACIC_SUBARC_NORMAL[subArcId];
	if (subArcId === 'upper') {
		if (a <= -1)
			return {
				id: '',
				severity: 'grade2',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.upper.lordosisGrade2')
			};
		if (a <= 7)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.upper.lordosisGrade1')
			};
		if (a <= max)
			return {
				id: '',
				severity: 'normal',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.upper.normal')
			};
		if (a <= 40)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.upper.kyphosisGrade1')
			};
		if (a <= 60)
			return {
				id: '',
				severity: 'grade2',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.upper.kyphosisGrade2')
			};
		if (a <= 80)
			return {
				id: '',
				severity: 'grade3',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.upper.kyphosisGrade3')
			};
		return {
			id: '',
			severity: 'grade4',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.upper.kyphosisGrade4')
		};
	}
	if (subArcId === 'mid') {
		if (a <= -1)
			return {
				id: '',
				severity: 'grade2',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.mid.lordosisGrade2')
			};
		if (a <= 14)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.mid.lordosisGrade1')
			};
		if (a <= max)
			return {
				id: '',
				severity: 'normal',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.mid.normal')
			};
		if (a <= 60)
			return {
				id: '',
				severity: 'grade1',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.mid.kyphosisGrade1')
			};
		if (a <= 80)
			return {
				id: '',
				severity: 'grade2',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.mid.kyphosisGrade2')
			};
		if (a <= 90)
			return {
				id: '',
				severity: 'grade3',
				text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.mid.kyphosisGrade3')
			};
		return {
			id: '',
			severity: 'grade4',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.mid.kyphosisGrade4')
		};
	}
	// lower — only 3 kyphosis grades in the source table, no grade4 band.
	if (a <= -1)
		return {
			id: '',
			severity: 'grade2',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.lower.lordosisGrade2')
		};
	if (a <= 18)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.lower.lordosisGrade1')
		};
	if (a <= max)
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.lower.normal')
		};
	if (a <= 60)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.lower.kyphosisGrade1')
		};
	if (a <= 80)
		return {
			id: '',
			severity: 'grade2',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.lower.kyphosisGrade2')
		};
	return {
		id: '',
		severity: 'grade3',
		text: resolve_localized('diagnosis.rules.sagittal.thoracicSubArc.lower.kyphosisGrade3')
	};
}

/** "Наклон хорды дуги L1–L5" — TABLREHTG.docx.pdf row 6, applied to the
 * existing lumbar (S1-L5) region's own chord-tilt angle (segments.p4). */
const LUMBAR_CHORD_TILT_MIN = -18;
const LUMBAR_CHORD_TILT_MAX = -5;

export function getLumbarChordTiltRange(): Range {
	return { min: LUMBAR_CHORD_TILT_MIN, max: LUMBAR_CHORD_TILT_MAX };
}

export function gradeLumbarChordTilt(angleDeg: number): Finding {
	const a = angleDeg;
	if (a < LUMBAR_CHORD_TILT_MIN)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.lumbarChordTilt.backward')
		};
	if (a <= LUMBAR_CHORD_TILT_MAX)
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.lumbarChordTilt.normal')
		};
	if (a <= 10)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.lumbarChordTilt.forwardGrade1')
		};
	if (a <= 25)
		return {
			id: '',
			severity: 'grade2',
			text: resolve_localized('diagnosis.rules.sagittal.lumbarChordTilt.forwardGrade2')
		};
	return {
		id: '',
		severity: 'grade3',
		text: resolve_localized('diagnosis.rules.sagittal.lumbarChordTilt.forwardGrade3')
	};
}

/** "Наклон хордыдуги Th5-Th12" — TABLREHTG.docx.pdf row 5, applied to a
 * dedicated Th5-Th12 sub-segment computed just for this metric (deliberately
 * NOT the whole-thoracic container's Th1-Th12 span, nor any of the 3
 * upper/mid/lower sub-regions — the source's own span for this parameter). */
const THORACIC_CHORD_TILT_MIN = -14;
const THORACIC_CHORD_TILT_MAX = -4;

export function getThoracicChordTiltRange(): Range {
	return { min: THORACIC_CHORD_TILT_MIN, max: THORACIC_CHORD_TILT_MAX };
}

export function gradeThoracicChordTilt(angleDeg: number): Finding {
	const a = angleDeg;
	if (a < THORACIC_CHORD_TILT_MIN)
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicChordTilt.backward')
		};
	if (a <= THORACIC_CHORD_TILT_MAX)
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.thoracicChordTilt.normal')
		};
	return {
		id: '',
		severity: 'grade1',
		text: resolve_localized('diagnosis.rules.sagittal.thoracicChordTilt.forward')
	};
}

/**
 * Per-level sagittal intervertebral (disc) angle norms — TABLREHTG.docx.pdf's
 * "Диск | Угол между телами позвонков" table (mean ± SD per level). Since the
 * source gives no further grading bands, normal = mean ± 1 SD, else a single
 * grade1 tier.
 *
 * L5-S1 is a deliberate exception: it's graded against the discrete
 * hand-graded band from TABLREHTG item 11 ("Угол между L5 и S1", -117 to
 * -97.5°) instead of this table's own L5-S1 row (-106.41±7.0°) — that row's
 * ±2SD band (~-92.4 to -120.4°) closely brackets item 11's stated range,
 * indicating they describe the same underlying quantity, and item 11's
 * explicit clinical grading is more authoritative than a derived SD multiple.
 */
const SAGITTAL_DISC_ANGLE_NORMS: Record<string, { mean: number; sd: number }> = {
	'C3-C4': { mean: -4.4, sd: 10.0 },
	'C4-C5': { mean: -3.3, sd: 7.4 },
	'C5-C6': { mean: -1.6, sd: 7.9 },
	'C6-C7': { mean: -5.7, sd: 6.8 },
	'C7-Th1': { mean: -5.41, sd: 3.9 },
	'Th1-Th2': { mean: -0.21, sd: 4.0 },
	'Th2-Th3': { mean: 2.4, sd: 4.2 },
	'Th3-Th4': { mean: 1.5, sd: 3.0 },
	'Th4-Th5': { mean: 4.61, sd: 3.0 },
	'Th5-Th6': { mean: 4.31, sd: 4.3 },
	'Th6-Th7': { mean: 6.61, sd: 2.5 },
	'Th7-Th8': { mean: 6.31, sd: 4.3 },
	'Th8-Th9': { mean: 5.01, sd: 6.1 },
	'Th9-Th10': { mean: 3.31, sd: 2.7 },
	'Th10-Th11': { mean: 2.51, sd: 5.4 },
	'Th11-Th12': { mean: 2.41, sd: 6.5 },
	'Th12-L1': { mean: 4.41, sd: 3.9 },
	'L1-L2': { mean: 0.21, sd: 3.6 },
	'L2-L3': { mean: -6.9, sd: 3.4 },
	'L3-L4': { mean: -9.51, sd: 6.0 },
	'L4-L5': { mean: -15.21, sd: 7.4 }
};

const L5_S1_DISC_ANGLE_RANGE: Range = { min: -117, max: -97.5 };

/** Normal band for a sagittal gap's intervertebral angle (gaps.p1), keyed by
 * gap id (e.g. "L4-L5"). Returns null for any level not in the source table
 * (e.g. "C2-C3", or the cross-region-boundary gaps that this app never
 * constructs — "C7-Th1"/"Th12-L1" — see diagnosis-store.svelte.ts). */
export function getSagittalDiscAngleRange(gapId: string): Range | null {
	if (gapId === 'L5-S1') return L5_S1_DISC_ANGLE_RANGE;
	const norm = SAGITTAL_DISC_ANGLE_NORMS[gapId];
	if (!norm) return null;
	return { min: norm.mean - norm.sd, max: norm.mean + norm.sd, center: norm.mean };
}

export function gradeSagittalDiscAngle(gapId: string, angleDeg: number): Finding | null {
	const range = getSagittalDiscAngleRange(gapId);
	if (!range) return null;
	if (angleDeg >= range.min && angleDeg <= range.max) {
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.discAngle.normal')
		};
	}
	return {
		id: '',
		severity: 'grade1',
		text: resolve_localized('diagnosis.rules.sagittal.discAngle.abnormal', {
			angle: angleDeg.toFixed(1)
		})
	};
}

/**
 * Sagittal AP (retro-/antero-listhesis) displacement — TABLREHTG.docx.pdf
 * item 25 ("Смещение тела L4"), generalized to every level per the table's
 * own "* позвонка" wildcard convention used elsewhere. Mirrors
 * gradeLateralDisplacement's structure (frontal.ts). Direction labeling
 * (positive = anterior) follows the source's "Более" = антелистез /
 * "Менее" = ретролистез convention, but — unlike p7's L5-S1 sign, which was
 * checked empirically — this hasn't been verified against a known-normal
 * sagittal case; only the ±2mm magnitude (and therefore the severity/bracket
 * color) is load-bearing, not the anterior/posterior wording.
 */
const SAGITTAL_DISPLACEMENT_TOLERANCE_MM = 2;

export function getSagittalDisplacementRange(): Range {
	return {
		min: -SAGITTAL_DISPLACEMENT_TOLERANCE_MM,
		max: SAGITTAL_DISPLACEMENT_TOLERANCE_MM,
		center: 0
	};
}

export function gradeSagittalDisplacement(mm: number): Finding {
	if (Math.abs(mm) <= SAGITTAL_DISPLACEMENT_TOLERANCE_MM) {
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.displacement.normal')
		};
	}
	const direction = resolve_localized(
		mm > 0
			? 'diagnosis.rules.sagittal.direction.anterior'
			: 'diagnosis.rules.sagittal.direction.posterior'
	);
	return {
		id: '',
		severity: 'grade1',
		text: resolve_localized('diagnosis.rules.sagittal.displacement.displaced', {
			mm: Math.abs(mm).toFixed(1),
			direction
		})
	};
}

/**
 * Sagittal disc wedging angle (gaps.p4) — TABLREHTG.docx.pdf's "Клиновидность
 * диска" row: normal 0 ± 1.5° ("Замыкательные пластинки *.* диска
 * параллельны" — the disc's endplates are parallel). Generalized to every
 * level per the row's own "*.* диска" wildcard. The source describes the two
 * abnormal directions only in relative terms ("wedging from reduced/increased
 * ventral height"), not tied to this app's own signed-angle convention for
 * p4 — so unlike the vertebral/frontal wedging rules, the finding text here
 * doesn't claim a base-anterior/posterior direction, only that wedging was
 * detected, to avoid asserting an unverified sign mapping.
 */
const SAGITTAL_DISC_WEDGING_TOLERANCE_DEG = 1.5;

export function getSagittalDiscWedgingRange(): Range {
	return {
		min: -SAGITTAL_DISC_WEDGING_TOLERANCE_DEG,
		max: SAGITTAL_DISC_WEDGING_TOLERANCE_DEG,
		center: 0
	};
}

export function gradeSagittalDiscWedging(angleDeg: number): Finding {
	if (Math.abs(angleDeg) <= SAGITTAL_DISC_WEDGING_TOLERANCE_DEG) {
		return {
			id: '',
			severity: 'normal',
			text: resolve_localized('diagnosis.rules.sagittal.discWedging.normal')
		};
	}
	return {
		id: '',
		severity: 'grade1',
		text: resolve_localized('diagnosis.rules.sagittal.discWedging.abnormal', {
			angle: angleDeg.toFixed(1)
		})
	};
}

/**
 * L5 inferior-endplate inclination (sagittal vertebrae.p8, L5 only) —
 * TABLREHTG.docx.pdf item 9 ("Наклон L5 позвонка к оси Z", -1.5–18° normal).
 * Titled identically to item 7 (already gradeL5Inclination, applied to L5's
 * p7/superior-endplate) but with different numbers and only a single
 * abnormal tier per direction instead of item 7's 5 graded tiers — read as a
 * separate check on the inferior endplate (p8), not a duplicate of item 7.
 */
const L5_INFERIOR_ENDPLATE_MIN = -1.5;
const L5_INFERIOR_ENDPLATE_MAX = 18;

export function getL5InferiorEndplateInclinationRange(): Range {
	return { min: L5_INFERIOR_ENDPLATE_MIN, max: L5_INFERIOR_ENDPLATE_MAX };
}

export function gradeL5InferiorEndplateInclination(angleDeg: number): Finding {
	if (angleDeg < L5_INFERIOR_ENDPLATE_MIN) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.l5InferiorEndplate.posterior')
		};
	}
	if (angleDeg > L5_INFERIOR_ENDPLATE_MAX) {
		return {
			id: '',
			severity: 'grade1',
			text: resolve_localized('diagnosis.rules.sagittal.l5InferiorEndplate.anterior')
		};
	}
	return {
		id: '',
		severity: 'normal',
		text: resolve_localized('diagnosis.rules.sagittal.l5InferiorEndplate.normal')
	};
}
