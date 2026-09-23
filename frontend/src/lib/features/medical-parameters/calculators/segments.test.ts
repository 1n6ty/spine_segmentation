import { describe, expect, it } from 'vitest';
import { getSegmentParams } from './segments';
import type { Vertebrae } from '../types';

/** A tiny (near-point) vertebra centered exactly on a circle of radius R around (cx,cy), at angle theta from "up". */
function vertebraOnCircle(
	id: string,
	cx: number,
	cy: number,
	R: number,
	thetaDeg: number
): Vertebrae {
	const theta = (thetaDeg * Math.PI) / 180;
	const x = cx + R * Math.sin(theta);
	const y = cy - R * Math.cos(theta);
	const h = 0.5;
	return {
		uuid: id,
		id,
		points: [
			{ x: x - h, y: y + h },
			{ x: x - h, y: y - h },
			{ x: x + h, y: y - h },
			{ x: x + h, y: y + h }
		]
	};
}

describe('getSegmentParams on a known circular arc', () => {
	const R = 300;
	const segment = [
		vertebraOnCircle('v1', 0, 500, R, -20),
		vertebraOnCircle('v2', 0, 500, R, 0),
		vertebraOnCircle('v3', 0, 500, R, 20)
	];
	const { params } = getSegmentParams('side', segment, 1);

	it('p1 recovers the known radius', () =>
		expect(Math.abs((params.p1.val as number) - R)).toBeLessThan(2));
	it('p3 central angle magnitude is close to the 40 degree span (signed, so -40 for this start/end labeling)', () => {
		expect(params.p3.val).toBeCloseTo(-40, 0);
	});
	it('p4 chord inclination is ~-90 (clockwise from vertical) since the symmetric -20/+20 endpoints sit at equal height, making the chord horizontal', () => {
		expect(params.p4.val).toBeCloseTo(-90, 0);
	});
});

describe('getSegmentParams central angle bulge direction', () => {
	/** Three vertebrae whose centers sit on a known circle, going straight up with a lateral bulge. */
	function vertebraAt(id: string, x: number, y: number): Vertebrae {
		const h = 0.5;
		return {
			uuid: id,
			id,
			points: [
				{ x: x - h, y: y + h },
				{ x: x - h, y: y - h },
				{ x: x + h, y: y - h },
				{ x: x + h, y: y + h }
			]
		};
	}

	it('is negative when the arc bulges left', () => {
		const segment = [vertebraAt('a', 0, 400), vertebraAt('b', -30, 250), vertebraAt('c', 0, 100)];
		const { params } = getSegmentParams('side', segment, 1);
		expect(params.p3.val as number).toBeLessThan(0);
	});

	it('is positive when the arc bulges right', () => {
		const segment = [vertebraAt('a', 0, 400), vertebraAt('b', 30, 250), vertebraAt('c', 0, 100)];
		const { params } = getSegmentParams('side', segment, 1);
		expect(params.p3.val as number).toBeGreaterThan(0);
	});
});

function tinySquare(id: string, cx: number, cy: number): Vertebrae {
	const h = 5;
	return {
		uuid: id,
		id,
		points: [
			{ x: cx - h, y: cy + h },
			{ x: cx - h, y: cy - h },
			{ x: cx + h, y: cy - h },
			{ x: cx + h, y: cy + h }
		]
	};
}

describe('getSegmentParams with an empty segment', () => {
	it('returns null params instead of throwing when there are fewer than 3 points', () => {
		const { params } = getSegmentParams('side', [], 1);
		expect(params.p1.val).toBeNull();
		expect(params.p3.val).toBeNull();
	});
});

describe('getSegmentParams chord inclination sign', () => {
	const start = tinySquare('a', 100, 400);
	const endLeansRight = tinySquare('b', 130, 100);
	const endLeansLeft = tinySquare('c', 70, 100);

	it('is negative (clockwise) when the chord leans right going up', () => {
		const { params } = getSegmentParams('side', [start, endLeansRight], 1);
		expect(params.p4.val).toBeLessThan(0);
	});

	it('is positive (counter-clockwise) when the chord leans left going up', () => {
		const { params } = getSegmentParams('side', [start, endLeansLeft], 1);
		expect(params.p4.val).toBeGreaterThan(0);
	});
});

describe("getSegmentParams excludes S1's inferior plate / C2's superior plate", () => {
	const R = 500;
	const cx = 0;
	const cy = 1000;
	const circlePoint = (thetaDeg: number) => {
		const theta = (thetaDeg * Math.PI) / 180;
		return { x: cx + R * Math.sin(theta), y: cy - R * Math.cos(theta) };
	};

	/** A real (non-point) S1 whose superior plate sits exactly on the circle at `thetaDeg`, and
	 * whose inferior plate is a wild outlier -- if the fit wrongly includes it, the recovered
	 * radius will be nowhere near R; if it's correctly excluded, the fit stays close to R. */
	function s1WithOutlierInferior(thetaDeg: number): Vertebrae {
		const { x, y } = circlePoint(thetaDeg);
		return {
			uuid: 's1',
			id: 'S1',
			points: [
				{ x: 9999, y: 9999 }, // AI -- outlier, must not enter the fit
				{ x: x - 1, y }, // AS -- on the circle
				{ x: x + 1, y }, // PS -- on the circle
				{ x: 10001, y: 9999 } // PI -- outlier, must not enter the fit
			]
		};
	}

	/** Same idea for C2, outlier on its superior plate instead. */
	function c2WithOutlierSuperior(thetaDeg: number): Vertebrae {
		const { x, y } = circlePoint(thetaDeg);
		return {
			uuid: 'c2',
			id: 'C2',
			points: [
				{ x: x - 1, y }, // AI -- on the circle
				{ x: -9999, y: -9999 }, // AS -- outlier, must not enter the fit
				{ x: -10001, y: -9999 }, // PS -- outlier, must not enter the fit
				{ x: x + 1, y } // PI -- on the circle
			]
		};
	}

	it("S1's inferior-plate outlier doesn't corrupt the fit, and start substitutes S1's superior plate", () => {
		const s1 = s1WithOutlierInferior(20);
		const l5 = vertebraOnCircle('L5', cx, cy, R, 0);
		const l4 = vertebraOnCircle('L4', cx, cy, R, -20);
		const { params } = getSegmentParams('side', [s1, l5, l4], 1);

		// A wild outlier in the fit would blow the radius far past R; exclusion keeps it tight.
		expect(Math.abs((params.p1.val as number) - R)).toBeLessThan(5);

		// p2 (chord) should be measured from S1's superior plate (on the circle), not its
		// outlier inferior plate -- i.e. close to the true circlePoint(20)-circlePoint(-20) span.
		const expectedChord = Math.hypot(
			circlePoint(-20).x - circlePoint(20).x,
			circlePoint(-20).y - circlePoint(20).y
		);
		expect(params.p2.val as number).toBeCloseTo(expectedChord, 0);
	});

	it("C2's superior-plate outlier doesn't corrupt the fit, and end substitutes C2's inferior plate", () => {
		const s1 = vertebraOnCircle('S1', cx, cy, R, 20);
		const l5 = vertebraOnCircle('L5', cx, cy, R, 0);
		const c2 = c2WithOutlierSuperior(-20);
		const { params } = getSegmentParams('side', [s1, l5, c2], 1);

		expect(Math.abs((params.p1.val as number) - R)).toBeLessThan(5);

		const expectedChord = Math.hypot(
			circlePoint(-20).x - circlePoint(20).x,
			circlePoint(-20).y - circlePoint(20).y
		);
		expect(params.p2.val as number).toBeCloseTo(expectedChord, 0);
	});
});
