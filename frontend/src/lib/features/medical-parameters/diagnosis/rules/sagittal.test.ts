import { describe, expect, it } from 'vitest';
import {
	gradeRegionSagittal,
	gradeSacralSlope,
	gradeL5Inclination,
	gradeL5Spondylolisthesis,
	gradeScheuermann,
	gradeVertebralFracture,
	gradeVertebralWedgingSagittal,
	getVertebralWedgingSagittalRange,
	gradeThoracicSubArc,
	getThoracicSubArcRange,
	gradeLumbarChordTilt,
	gradeThoracicChordTilt,
	gradeSagittalDiscAngle,
	getSagittalDiscAngleRange,
	gradeSagittalDisplacement,
	gradeSagittalDiscWedging,
	getSagittalDiscWedgingRange,
	gradeL5InferiorEndplateInclination,
	getL5InferiorEndplateInclinationRange
} from './sagittal';

describe('gradeRegionSagittal', () => {
	it('grades cervical lordosis within normal range', () => {
		expect(gradeRegionSagittal('cervical', -20).severity).toBe('normal');
	});

	it('grades cervical grade 1 lordosis-flattening', () => {
		expect(gradeRegionSagittal('cervical', -45).severity).toBe('grade1');
	});

	it('grades cervical grade 2 lordosis-flattening', () => {
		expect(gradeRegionSagittal('cervical', -60).severity).toBe('grade2');
	});

	it('grades cervical kyphosis grade 2', () => {
		expect(gradeRegionSagittal('cervical', 10).severity).toBe('grade2');
	});

	it('grades cervical kyphosis grade 3', () => {
		expect(gradeRegionSagittal('cervical', 25).severity).toBe('grade3');
	});

	it('grades cervical kyphosis grade 4', () => {
		expect(gradeRegionSagittal('cervical', 40).severity).toBe('grade4');
	});

	it('grades thoracic normal kyphosis', () => {
		expect(gradeRegionSagittal('thoracic', 50).severity).toBe('normal');
	});

	it('grades thoracic kyphosis grade 1', () => {
		expect(gradeRegionSagittal('thoracic', 68).severity).toBe('grade1');
	});

	it('grades thoracic kyphosis grade 4 beyond all bands', () => {
		expect(gradeRegionSagittal('thoracic', 95).severity).toBe('grade4');
	});

	it('grades lumbar normal lordosis', () => {
		expect(gradeRegionSagittal('lumbar', -40).severity).toBe('normal');
	});

	it('grades lumbar hyperlordosis grade 2', () => {
		expect(gradeRegionSagittal('lumbar', -75).severity).toBe('grade2');
	});

	it('grades lumbar kyphotic deformity grade 1', () => {
		expect(gradeRegionSagittal('lumbar', -10).severity).toBe('grade1');
	});

	it('grades lumbar kyphotic deformity grade 3', () => {
		expect(gradeRegionSagittal('lumbar', 30).severity).toBe('grade3');
	});

	it('grades lumbar kyphotic deformity grade 4', () => {
		expect(gradeRegionSagittal('lumbar', 50).severity).toBe('grade4');
	});
});

describe('gradeSacralSlope', () => {
	it('is normal within 99-124 degrees', () => {
		expect(gradeSacralSlope(110).severity).toBe('normal');
	});

	it('flags tendency toward vertical below 99', () => {
		expect(gradeSacralSlope(90).severity).toBe('grade1');
	});

	it('flags tendency toward horizontal above 124', () => {
		expect(gradeSacralSlope(130).severity).toBe('grade1');
	});
});

describe('gradeL5Inclination', () => {
	it('is normal within -3 to 18 degrees', () => {
		expect(gradeL5Inclination(10).severity).toBe('normal');
	});

	it('grades posterior tilt below -3', () => {
		expect(gradeL5Inclination(-5).severity).toBe('grade1');
	});

	it('grades anterior tilt grade 3 within 37-60', () => {
		expect(gradeL5Inclination(50).severity).toBe('grade3');
	});

	it('grades anterior tilt grade 5 beyond 80', () => {
		expect(gradeL5Inclination(90).severity).toBe('grade5');
	});
});

describe('gradeL5Spondylolisthesis', () => {
	// endplate length fixed at 30mm across these cases so fraction thresholds
	// land at clean displacement values: 1/4=7.5mm, 1/2=15mm, 3/4=22.5mm, 4/4=30mm
	const ENDPLATE_MM = 30;

	it('is normal within the general displacement noise tolerance', () => {
		expect(gradeL5Spondylolisthesis(1, ENDPLATE_MM).severity).toBe('normal');
	});

	it('is normal for posterior (retrolisthesis) displacement regardless of magnitude', () => {
		expect(gradeL5Spondylolisthesis(-20, ENDPLATE_MM).severity).toBe('normal');
	});

	it('grades 1 for anterior displacement under 1/4 of endplate length', () => {
		expect(gradeL5Spondylolisthesis(5, ENDPLATE_MM).severity).toBe('grade1');
	});

	it('grades 2 for anterior displacement between 1/4 and 1/2 of endplate length', () => {
		expect(gradeL5Spondylolisthesis(10, ENDPLATE_MM).severity).toBe('grade2');
	});

	it('grades 3 for anterior displacement between 1/2 and 3/4 of endplate length', () => {
		expect(gradeL5Spondylolisthesis(20, ENDPLATE_MM).severity).toBe('grade3');
	});

	it('grades 4 for anterior displacement between 3/4 and a full endplate length', () => {
		expect(gradeL5Spondylolisthesis(25, ENDPLATE_MM).severity).toBe('grade4');
	});

	it('grades 5 (spondyloptosis) at or beyond a full endplate length', () => {
		expect(gradeL5Spondylolisthesis(30, ENDPLATE_MM).severity).toBe('grade5');
		expect(gradeL5Spondylolisthesis(35, ENDPLATE_MM).severity).toBe('grade5');
	});
});

describe('gradeScheuermann', () => {
	// Mid sub-arc normal band is 15-35 (THORACIC_SUBARC_NORMAL.mid); lumbar
	// normal is -56 to -30; cervical normal is -41 to -15 (see the constants
	// atop this file). "Compensated" fixtures push lumbar/cervical below
	// their normal min (lordosis direction); "uncompensated" leaves them
	// inside the normal band.
	const KYPHOTIC_MID = 60; // > 35, kyphosis direction
	const COMPENSATED_LUMBAR = -60; // < -56, lordosis direction
	const COMPENSATED_CERVICAL = -45; // < -41, lordosis direction
	const NORMAL_LUMBAR = -40;
	const NORMAL_CERVICAL = -20;

	it('returns null when fewer than 3 vertebrae are wedged', () => {
		expect(
			gradeScheuermann([6, 2, 1, 0], KYPHOTIC_MID, COMPENSATED_LUMBAR, COMPENSATED_CERVICAL)
		).toBeNull();
	});

	it('returns null when the mid-thoracic sub-arc is not in the kyphosis direction', () => {
		expect(
			gradeScheuermann([6, 7, 8, 9], 20, COMPENSATED_LUMBAR, COMPENSATED_CERVICAL)
		).toBeNull();
	});

	it('returns null when the lumbar curve has not compensated into lordosis', () => {
		expect(
			gradeScheuermann([6, 7, 8, 9], KYPHOTIC_MID, NORMAL_LUMBAR, COMPENSATED_CERVICAL)
		).toBeNull();
	});

	it('returns null when the cervical curve has not compensated into lordosis', () => {
		expect(
			gradeScheuermann([6, 7, 8, 9], KYPHOTIC_MID, COMPENSATED_LUMBAR, NORMAL_CERVICAL)
		).toBeNull();
	});

	it("flags Scheuermann's disease when all 4 conditions hold", () => {
		const finding = gradeScheuermann(
			[6, 7, 8, 9],
			KYPHOTIC_MID,
			COMPENSATED_LUMBAR,
			COMPENSATED_CERVICAL
		);
		expect(finding?.severity).not.toBe('normal');
	});
});

describe('gradeVertebralFracture', () => {
	it('returns null for mild wedging', () => {
		expect(gradeVertebralFracture(5, 'grade1')).toBeNull();
	});

	it('returns null when the lower region is normal even with severe wedging', () => {
		expect(gradeVertebralFracture(15, 'normal')).toBeNull();
	});

	it('flags possible fracture for severe wedging combined with regional kyphosis', () => {
		const finding = gradeVertebralFracture(15, 'grade2');
		expect(finding?.severity).toBe('grade3');
	});
});

describe('gradeVertebralWedgingSagittal', () => {
	it('is normal within +-1 degree', () => {
		expect(gradeVertebralWedgingSagittal(0.5).severity).toBe('normal');
	});

	it('flags wedging base-posterior above 1 degree', () => {
		const finding = gradeVertebralWedgingSagittal(3);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('base posterior');
	});

	it('flags wedging base-anterior below -1 degree', () => {
		const finding = gradeVertebralWedgingSagittal(-3);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('base anterior');
	});

	it('range-getter matches the +-1 degree band', () => {
		expect(getVertebralWedgingSagittalRange()).toEqual({ min: -1, max: 1, center: 0 });
	});
});

describe('gradeThoracicSubArc', () => {
	it('grades upper sub-arc normal (8-25 deg)', () => {
		expect(gradeThoracicSubArc('upper', 15).severity).toBe('normal');
	});

	it('grades upper sub-arc lordosis grade 2 at or below -1', () => {
		expect(gradeThoracicSubArc('upper', -1).severity).toBe('grade2');
	});

	it('grades upper sub-arc kyphosis grade 4 beyond 80', () => {
		expect(gradeThoracicSubArc('upper', 90).severity).toBe('grade4');
	});

	it('grades mid sub-arc normal (15-35 deg)', () => {
		expect(gradeThoracicSubArc('mid', 25).severity).toBe('normal');
	});

	it('grades mid sub-arc kyphosis grade 4 beyond 90', () => {
		expect(gradeThoracicSubArc('mid', 95).severity).toBe('grade4');
	});

	it('grades lower sub-arc normal (0-19 deg)', () => {
		expect(gradeThoracicSubArc('lower', 10).severity).toBe('normal');
	});

	it('grades lower sub-arc kyphosis grade 1 just above normal (20-40 deg)', () => {
		expect(gradeThoracicSubArc('lower', 30).severity).toBe('grade1');
	});

	it('grades lower sub-arc kyphosis grade 4 beyond 80', () => {
		expect(gradeThoracicSubArc('lower', 90).severity).toBe('grade4');
	});

	it('range-getters match each sub-arc normal band', () => {
		expect(getThoracicSubArcRange('upper')).toEqual({ min: 8, max: 25 });
		expect(getThoracicSubArcRange('mid')).toEqual({ min: 15, max: 35 });
		expect(getThoracicSubArcRange('lower')).toEqual({ min: 0, max: 19 });
	});
});

describe('gradeLumbarChordTilt', () => {
	it('is normal within -18 to -5 degrees', () => {
		expect(gradeLumbarChordTilt(-10).severity).toBe('normal');
	});

	it('grades backward tilt below -18', () => {
		expect(gradeLumbarChordTilt(-20).severity).toBe('grade1');
	});

	it('grades forward tilt grade 2 within 11-25', () => {
		expect(gradeLumbarChordTilt(20).severity).toBe('grade2');
	});

	it('grades forward tilt grade 3 beyond 25', () => {
		expect(gradeLumbarChordTilt(30).severity).toBe('grade3');
	});
});

describe('gradeThoracicChordTilt', () => {
	it('is normal within -14 to -4 degrees', () => {
		expect(gradeThoracicChordTilt(-10).severity).toBe('normal');
	});

	it('grades backward tilt below -14', () => {
		expect(gradeThoracicChordTilt(-20).severity).toBe('grade1');
	});

	it('grades forward tilt above -4', () => {
		expect(gradeThoracicChordTilt(0).severity).toBe('grade1');
	});
});

describe('gradeSagittalDiscAngle', () => {
	it('is normal within mean +- 1 SD for a known level', () => {
		expect(gradeSagittalDiscAngle('L4-L5', -15.21)?.severity).toBe('normal');
	});

	it('flags abnormal beyond mean +- 1 SD', () => {
		expect(gradeSagittalDiscAngle('L4-L5', 10)?.severity).toBe('grade1');
	});

	it('uses the L5-S1 override band instead of the per-level mean+-SD table', () => {
		expect(gradeSagittalDiscAngle('L5-S1', -105)?.severity).toBe('normal');
		expect(gradeSagittalDiscAngle('L5-S1', -50)?.severity).toBe('grade1');
		expect(getSagittalDiscAngleRange('L5-S1')).toEqual({ min: -117, max: -97.5 });
	});

	it('returns null for a level not in the source table', () => {
		expect(gradeSagittalDiscAngle('C2-C3', 0)).toBeNull();
		expect(getSagittalDiscAngleRange('C2-C3')).toBeNull();
	});
});

describe('gradeSagittalDisplacement', () => {
	it('is normal within +-2mm', () => {
		expect(gradeSagittalDisplacement(1).severity).toBe('normal');
	});

	it('flags anterior displacement beyond 2mm', () => {
		const finding = gradeSagittalDisplacement(5);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('anteriorly');
	});

	it('flags posterior displacement beyond -2mm', () => {
		const finding = gradeSagittalDisplacement(-5);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('posteriorly');
	});
});

describe('gradeSagittalDiscWedging', () => {
	it('is normal within +-1.5 degrees', () => {
		expect(gradeSagittalDiscWedging(1).severity).toBe('normal');
	});

	it('flags wedging beyond 1.5 degrees', () => {
		expect(gradeSagittalDiscWedging(3).severity).toBe('grade1');
		expect(gradeSagittalDiscWedging(-3).severity).toBe('grade1');
	});

	it('range-getter matches the +-1.5 degree band', () => {
		expect(getSagittalDiscWedgingRange()).toEqual({ min: -1.5, max: 1.5, center: 0 });
	});
});

describe('gradeL5InferiorEndplateInclination', () => {
	it('is normal within -1.5 to 18 degrees', () => {
		expect(gradeL5InferiorEndplateInclination(10).severity).toBe('normal');
	});

	it('grades posterior tilt below -1.5', () => {
		const finding = gradeL5InferiorEndplateInclination(-5);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('posteriorly');
	});

	it('grades anterior tilt beyond 18', () => {
		const finding = gradeL5InferiorEndplateInclination(25);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('anteriorly');
	});

	it('range-getter matches the -1.5 to 18 degree band', () => {
		expect(getL5InferiorEndplateInclinationRange()).toEqual({ min: -1.5, max: 18 });
	});
});
