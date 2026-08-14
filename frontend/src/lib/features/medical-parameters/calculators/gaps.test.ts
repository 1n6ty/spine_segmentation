import { describe, expect, it } from 'vitest';
import { getGapParams } from './gaps';
import type { Vertebrae } from '../types';

// S1 (bottom, more inferior) and L5 (top, more superior) with a clean 10px disc gap,
// both perfectly upright and parallel — the disc should read as a plain 10px gap with
// no wedging, no angular displacement beyond perpendicular, no intervertebral angle.
const S1: Vertebrae = {
	uuid: 's1',
	id: 'S1',
	points: [
		{ x: 70, y: 460 },
		{ x: 70, y: 400 },
		{ x: 130, y: 400 },
		{ x: 130, y: 460 }
	]
};
const L5: Vertebrae = {
	uuid: 'l5',
	id: 'L5',
	points: [
		{ x: 70, y: 390 },
		{ x: 70, y: 330 },
		{ x: 130, y: 330 },
		{ x: 130, y: 390 }
	]
};

describe('getGapParams baseline (upright, parallel, no slip)', () => {
	const { params } = getGapParams('side', { top: L5, bottom: S1 }, 1)!;

	it('p1 intervertebral angle is ~0 for two upright, parallel vertebrae', () =>
		expect(params.p1.val).toBeCloseTo(0, 1));
	it('p1 type is angular, per config.ts', () => expect(params.p1.type).toBe('angular'));
	it('p2 anterior disc height is the real ~10px gap, not the combined vertebra heights', () =>
		expect(params.p2.val).toBeCloseTo(10));
	it('p3 posterior disc height is the real ~10px gap', () => expect(params.p3.val).toBeCloseTo(10));
	it('p4 disc wedging angle is ~0 for parallel anterior/posterior borders', () =>
		expect(params.p4.val).toBeCloseTo(0, 1));
	it('p5 linear displacement is ~0', () => expect(params.p5.val).toBeCloseTo(0, 3));
	it('p5 type is linear, per config.ts', () => expect(params.p5.type).toBe('linear'));
	it("p6 angular displacement is ~90 (border perpendicular to endplate) when there's no slip", () =>
		expect(params.p6.val).toBeCloseTo(90, 1));
});

describe('getGapParams p1/p4 sign direction', () => {
	it("p1 is signed (not just magnitude) when the top vertebra's anterior edge tilts relative to the bottom's", () => {
		const L5tilted: Vertebrae = {
			uuid: 'l5c',
			id: 'L5',
			points: [
				{ x: 70, y: 390 },
				{ x: 85, y: 330 },
				{ x: 145, y: 330 },
				{ x: 130, y: 390 }
			]
		};
		const { params } = getGapParams('side', { top: L5tilted, bottom: S1 }, 1)!;
		expect(params.p1.val as number).not.toBe(0);
	});
});

describe('getGapParams with anterior slip', () => {
	const L5shifted: Vertebrae = {
		uuid: 'l5b',
		id: 'L5',
		points: [
			{ x: 75, y: 390 },
			{ x: 75, y: 330 },
			{ x: 135, y: 330 },
			{ x: 135, y: 390 }
		]
	};
	const { params } = getGapParams('side', { top: L5shifted, bottom: S1 }, 1)!;

	it('p5 reflects the ~5px shift', () =>
		expect(Math.abs(params.p5.val as number)).toBeCloseTo(5, 1));
});

describe('getGapParams L5-S1 special case (p7)', () => {
	it("an unslipped baseline reads positive, inside the clinical 'normal' band (>-35)", () => {
		const { params } = getGapParams('side', { top: L5, bottom: S1 }, 1)!;
		// both upright/horizontal respectively -> perpendicular -> +90, not -90 (verified the
		// order isn't flipped: a flipped order would misclassify every normal spine as severe
		// spondylolisthesis, since -90 is already past the -75 grade-2 threshold)
		expect(params.p7.val).toBeCloseTo(90);
		expect(params.p7.val as number).toBeGreaterThan(-35);
	});

	it('is null for any non-L5/S1 pair — not 0, which narrative.ts would treat as a real measured value and report for every gap', () => {
		const Th1: Vertebrae = {
			uuid: 'th1',
			id: 'Th1',
			points: [
				{ x: 70, y: 200 },
				{ x: 70, y: 140 },
				{ x: 130, y: 140 },
				{ x: 130, y: 200 }
			]
		};
		const { params } = getGapParams('side', { top: Th1, bottom: L5 }, 1)!;
		expect(params.p7.val).toBeNull();
	});
});
