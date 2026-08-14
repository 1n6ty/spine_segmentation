import { describe, expect, it } from 'vitest';
import { getVertebraeParams } from './vertebrae';
import type { Vertebrae } from '../types';

// Point convention confirmed against features/editor/logic/orderer.ts: [bottom-left, top-left, top-right, bottom-right].
// Wedge-shaped vertebra: anterior (left) height 30, posterior (right) height 50, superior width 60.
const wedge: Vertebrae = {
	uuid: 'u1',
	id: 'Th5',
	points: [
		{ x: 20, y: 30 }, // BL
		{ x: 20, y: 0 }, // TL
		{ x: 80, y: 0 }, // TR
		{ x: 80, y: 50 } // BR
	]
};

describe('getVertebraeParams side', () => {
	const { params } = getVertebraeParams('side', wedge, 1)!;

	it('p1 superior endplate length', () => expect(params.p1.val).toBeCloseTo(60));
	it('p2 inferior endplate length', () => expect(params.p2.val).toBeCloseTo(Math.hypot(60, 20)));
	it('p3 anterior height', () => expect(params.p3.val).toBeCloseTo(30));
	it('p4 posterior height', () => expect(params.p4.val).toBeCloseTo(50));

	it('p6 anterior contour inclination is 0 for a vertical anterior edge', () => {
		const vertical: Vertebrae = {
			uuid: 'u2',
			id: 'Th4',
			points: [
				{ x: 20, y: 30 },
				{ x: 20, y: 0 },
				{ x: 80, y: 0 },
				{ x: 80, y: 30 }
			]
		};
		expect(getVertebraeParams('side', vertical, 1)!.params.p6.val).toBeCloseTo(0);
	});

	it("p6 reads negative (clockwise) when the anterior edge's top leans right", () => {
		const leansRight: Vertebrae = {
			uuid: 'u3',
			id: 'Th4',
			points: [
				{ x: 20, y: 30 },
				{ x: 25, y: 0 },
				{ x: 80, y: 0 },
				{ x: 80, y: 30 }
			]
		};
		expect(getVertebraeParams('side', leansRight, 1)!.params.p6.val).toBeLessThan(0);
	});

	it('p7 superior endplate inclination near +-90 for a horizontal endplate', () => {
		expect(Math.abs(params.p7.val as number)).toBeCloseTo(90);
	});

	it('p9 is null for non-S1 vertebrae', () => expect(params.p9.val).toBeNull());

	it('p9 sacral slope is 0 for a horizontal S1 superior endplate', () => {
		const s1: Vertebrae = {
			uuid: 'u4',
			id: 'S1',
			points: [
				{ x: 20, y: 30 },
				{ x: 20, y: 0 },
				{ x: 80, y: 0 },
				{ x: 80, y: 30 }
			]
		};
		expect(getVertebraeParams('side', s1, 1)!.params.p9.val).toBeCloseTo(0);
	});

	it("p9 is positive (CCW) when S1's right endplate corner is higher than the left", () => {
		const s1: Vertebrae = {
			uuid: 'u5',
			id: 'S1',
			points: [
				{ x: 0, y: 30 },
				{ x: 0, y: 0 },
				{ x: 60, y: -10 },
				{ x: 60, y: 30 }
			]
		};
		expect(getVertebraeParams('side', s1, 1)!.params.p9.val).toBeGreaterThan(0);
	});

	it('p5 wedging angle is 0 when anterior and posterior edges are parallel (regardless of height difference)', () => {
		expect(params.p5.val).toBeCloseTo(0);
	});

	it('p5 is positive when the posterior (right) edge is taller and the edges converge', () => {
		const v: Vertebrae = {
			uuid: 'u6',
			id: 'Th4',
			points: [
				{ x: 20, y: 30 },
				{ x: 20, y: 0 },
				{ x: 90, y: 0 },
				{ x: 80, y: 50 }
			]
		};
		expect(getVertebraeParams('side', v, 1)!.params.p5.val as number).toBeGreaterThan(0);
	});

	it('p5 is negative when the anterior (left) edge is taller and the edges converge', () => {
		const v: Vertebrae = {
			uuid: 'u7',
			id: 'Th4',
			points: [
				{ x: 20, y: 50 },
				{ x: 20, y: 0 },
				{ x: 70, y: 0 },
				{ x: 80, y: 30 }
			]
		};
		expect(getVertebraeParams('side', v, 1)!.params.p5.val as number).toBeLessThan(0);
	});
});

describe('getVertebraeParams frontal', () => {
	const { params } = getVertebraeParams('frontal', wedge, 1)!;

	it('p1 superior endplate width', () => expect(params.p1.val).toBeCloseTo(60));
	it('p2 inferior endplate width', () => expect(params.p2.val).toBeCloseTo(Math.hypot(60, 20)));
	it('p3 right contour height', () => expect(params.p3.val).toBeCloseTo(50));
	it('p4 left contour height', () => expect(params.p4.val).toBeCloseTo(30));
	it('p5 center height is the midline distance', () => expect(params.p5.val).toBeCloseTo(40));

	it('p8 superior endplate inclination near +-90 for a horizontal endplate', () => {
		expect(Math.abs(params.p8.val as number)).toBeCloseTo(90);
	});

	it('p6 frontal wedging is positive (base right) when the right side is taller and edges converge', () => {
		const v: Vertebrae = {
			uuid: 'u8',
			id: 'Th4',
			points: [
				{ x: 20, y: 30 },
				{ x: 20, y: 0 },
				{ x: 90, y: 0 },
				{ x: 80, y: 50 }
			]
		};
		expect(getVertebraeParams('frontal', v, 1)!.params.p6.val as number).toBeGreaterThan(0);
	});

	it('p6 frontal wedging is negative (base left) when the left side is taller and edges converge', () => {
		const v: Vertebrae = {
			uuid: 'u9',
			id: 'Th4',
			points: [
				{ x: 20, y: 50 },
				{ x: 20, y: 0 },
				{ x: 70, y: 0 },
				{ x: 80, y: 30 }
			]
		};
		expect(getVertebraeParams('frontal', v, 1)!.params.p6.val as number).toBeLessThan(0);
	});
});
