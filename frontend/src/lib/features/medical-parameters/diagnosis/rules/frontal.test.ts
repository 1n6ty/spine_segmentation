import { describe, expect, it } from 'vitest';
import {
	gradeRegionFrontal,
	gradeVertebralWedgingFrontal,
	gradeLateralDisplacement,
	gradeGCoM,
	gradeL5SuperiorEndplateInclinationFrontal,
	getL5SuperiorEndplateInclinationFrontalRange
} from './frontal';

describe('gradeRegionFrontal', () => {
	it('is normal within the +-5 degree band', () => {
		expect(gradeRegionFrontal(3).severity).toBe('normal');
		expect(gradeRegionFrontal(-4).severity).toBe('normal');
	});

	it('grades Chaklin 1 for magnitudes up to 10 degrees', () => {
		expect(gradeRegionFrontal(8).severity).toBe('grade1');
	});

	it('grades Chaklin 2 for magnitudes 11-25 degrees', () => {
		expect(gradeRegionFrontal(20).severity).toBe('grade2');
	});

	it('grades Chaklin 3 for magnitudes 26-50 degrees', () => {
		expect(gradeRegionFrontal(-40).severity).toBe('grade3');
	});

	it('grades Chaklin 4 beyond 50 degrees', () => {
		expect(gradeRegionFrontal(55).severity).toBe('grade4');
	});

	it('labels negative angle as left-sided', () => {
		expect(gradeRegionFrontal(-30).text['en-US']).toContain('left-sided');
	});

	it('labels positive angle as right-sided', () => {
		expect(gradeRegionFrontal(30).text['en-US']).toContain('right-sided');
	});
});

describe('gradeVertebralWedgingFrontal', () => {
	it('is normal within +-1 degree', () => {
		expect(gradeVertebralWedgingFrontal(0.5).severity).toBe('normal');
	});

	it('flags wedging base-right above 1 degree', () => {
		const finding = gradeVertebralWedgingFrontal(3);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('base right');
	});

	it('flags wedging base-left below -1 degree', () => {
		const finding = gradeVertebralWedgingFrontal(-3);
		expect(finding.text['en-US']).toContain('base left');
	});
});

describe('gradeLateralDisplacement', () => {
	it('is normal within +-2mm', () => {
		expect(gradeLateralDisplacement(1).severity).toBe('normal');
	});

	it('flags displacement beyond 2mm to the right', () => {
		expect(gradeLateralDisplacement(5).severity).toBe('grade1');
	});

	it('flags displacement beyond 2mm to the left', () => {
		const finding = gradeLateralDisplacement(-5);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('left');
	});
});

describe('gradeGCoM', () => {
	it('is normal within +-70mm', () => {
		expect(gradeGCoM(50).severity).toBe('normal');
	});

	it('flags significant shift beyond 70mm', () => {
		expect(gradeGCoM(-90).severity).toBe('grade2');
	});

	it('labels positive offset as shifted right', () => {
		expect(gradeGCoM(80).text['en-US']).toContain('right');
	});
});

describe('gradeL5SuperiorEndplateInclinationFrontal', () => {
	it('is normal within +-89 degrees', () => {
		expect(gradeL5SuperiorEndplateInclinationFrontal(0).severity).toBe('normal');
		expect(gradeL5SuperiorEndplateInclinationFrontal(89).severity).toBe('normal');
	});

	it('flags deviation beyond 89 degrees to the left', () => {
		const finding = gradeL5SuperiorEndplateInclinationFrontal(-95);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('left');
	});

	it('flags deviation beyond 89 degrees to the right', () => {
		const finding = gradeL5SuperiorEndplateInclinationFrontal(95);
		expect(finding.severity).toBe('grade1');
		expect(finding.text['en-US']).toContain('right');
	});

	it('range-getter matches the +-89 degree band', () => {
		expect(getL5SuperiorEndplateInclinationFrontalRange()).toEqual({
			min: -89,
			max: 89,
			center: 0
		});
	});
});
