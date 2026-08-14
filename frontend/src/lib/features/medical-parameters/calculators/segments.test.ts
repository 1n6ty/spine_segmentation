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
