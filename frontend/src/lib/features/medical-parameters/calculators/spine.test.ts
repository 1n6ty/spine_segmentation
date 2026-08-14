import { describe, expect, it } from 'vitest';
import { getSpineParams } from './spine';
import type { Vertebrae } from '../types';

function tinyVertebraAt(id: string, cx: number, cy: number): Vertebrae {
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

function buildSpine(th1xy: [number, number], l5xy: [number, number]): Vertebrae[] {
	// 24 entries; only indices 1 (L5) and 17 (Th1) matter to getSpineParams.
	const vertebrae: Vertebrae[] = Array.from({ length: 24 }, (_, i) =>
		tinyVertebraAt(`v${i}`, 0, i * 20)
	);
	vertebrae[1] = tinyVertebraAt('L5', ...l5xy);
	vertebrae[17] = tinyVertebraAt('Th1', ...th1xy);
	return vertebrae;
}

describe('getSpineParams', () => {
	it('returns null params with fewer than 24 vertebrae', () => {
		const { params } = getSpineParams('side', [tinyVertebraAt('a', 0, 0)], 1);
		expect(params.p1.val).toBeNull();
	});

	it('p1 is 0 when Th1 is directly above L5 (perfectly upright trunk)', () => {
		const { params } = getSpineParams('side', buildSpine([0, 100], [0, 400]), 1);
		expect(params.p1.val).toBeCloseTo(0);
	});

	it('p1 is negative (clockwise) when Th1 leans right of L5', () => {
		const { params } = getSpineParams('side', buildSpine([30, 100], [0, 400]), 1);
		expect(params.p1.val as number).toBeLessThan(0);
	});

	it('p3 GCoM lateral term tracks the horizontal offset magnitude', () => {
		const { params } = getSpineParams('side', buildSpine([30, 100], [0, 400]), 1);
		expect(Math.abs(params.p3.val as number)).toBeCloseTo(30, 0);
	});

	it('p2 trunk axis length is the straight-line Th1-L5 distance', () => {
		const { params } = getSpineParams('side', buildSpine([0, 100], [0, 400]), 1);
		expect(params.p2.val).toBeCloseTo(300);
	});
});
