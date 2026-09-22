import { describe, it, expect } from 'vitest';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { evaluateCongenitalKyphosis } from './congenital-kyphosis';
import type { DiagnosisTally } from '../conclusion';

/** Same synthetic-vertebra builder as central-arc-segments.test.ts: places a
 * vertebra's bottom/top plate midpoints on the given circle at `degrees`. */
function vertebra_on_circle(
	id: string,
	cx: number,
	cy: number,
	r: number,
	degrees: number
): Polygon {
	const spread = 3;
	const rad = (deg: number) => (deg * Math.PI) / 180;
	const at = (deg: number): Point => ({
		x: cx + r * Math.cos(rad(deg)),
		y: cy + r * Math.sin(rad(deg))
	});
	const bottom = at(degrees - spread / 2);
	const top = at(degrees + spread / 2);
	const perp = { x: -(top.y - bottom.y), y: top.x - bottom.x };
	const norm = Math.hypot(perp.x, perp.y) || 1;
	const half = { x: (perp.x / norm) * 2, y: (perp.y / norm) * 2 };
	return {
		uuid: id,
		id,
		points: [
			{ x: bottom.x - half.x, y: bottom.y - half.y },
			{ x: top.x - half.x, y: top.y - half.y },
			{ x: top.x + half.x, y: top.y + half.y },
			{ x: bottom.x + half.x, y: bottom.y + half.y }
		]
	};
}

describe('evaluateCongenitalKyphosis', () => {
	it('does nothing for too few vertebrae', () => {
		const tally: DiagnosisTally = new Map();
		const polygons = [
			vertebra_on_circle('S1', 0, 0, 100, 0),
			vertebra_on_circle('L5', 0, 0, 100, 10)
		];
		evaluateCongenitalKyphosis(tally, polygons, 1);
		expect(tally.size).toBe(0);
	});

	it('pattern 1: flags the boundary disc between two sequential lordosis arcs when it is abnormal', () => {
		// Two distinct lordosis(-) arcs (same circle shape, different centers so
		// BIC/DP detects 2 arcs instead of merging into 1) whose shared boundary
		// disc (L2-L3) lands at -30°, well outside L2-L3's normal band (-6.9±3.4).
		const lower = ['S1', 'L5', 'L4', 'L3'].map((id, i) =>
			vertebra_on_circle(id, 0, 0, 100, i * 10)
		);
		const upper = ['L2', 'L1', 'Th12', 'Th11'].map((id, i) =>
			vertebra_on_circle(id, -200, 0, 100, i * 10)
		);
		const polygons = [...lower, ...upper];

		const tally: DiagnosisTally = new Map();
		evaluateCongenitalKyphosis(tally, polygons, 1);

		expect(tally.size).toBe(1);
		const entry = tally.get('sag-congenital-kyphosis:L2-L3');
		expect(entry).toEqual({
			abnormal: 1,
			total: 1,
			detail: expect.objectContaining({ 'ru-RU': 'на уровне L2-L3 позвонков' }),
			symptoms: expect.arrayContaining([expect.objectContaining({ severity: 'grade1' })])
		});
	});

	it('pattern 1: does not fire when the boundary disc is within its normal band', () => {
		// Same 2-arc shape as above, but continued on one smooth circle so the
		// boundary disc angle is small (within L2-L3's normal band) even though
		// BIC still happens to split it into 2 arcs.
		const lower = ['S1', 'L5', 'L4', 'L3'].map((id, i) =>
			vertebra_on_circle(id, 0, 0, 100, i * 10)
		);
		const upper = ['L2', 'L1', 'Th12', 'Th11'].map((id, i) =>
			vertebra_on_circle(id, 0, 0, 100, 40 + i * 10)
		);
		const polygons = [...lower, ...upper];

		const tally: DiagnosisTally = new Map();
		evaluateCongenitalKyphosis(tally, polygons, 1);

		expect(tally.size).toBe(0);
	});

	it('pattern 2: flags a kyphosis arc sandwiched between two lordosis arcs when every internal disc is abnormal', () => {
		// 3 sequential arcs: lordosis(-), kyphosis(+), lordosis(-) again. The
		// middle arc's own internal discs (L2-L3, L1-L2) both land at -25°,
		// outside their normal bands.
		const g1 = ['S1', 'L5', 'L4'].map((id, i) => vertebra_on_circle(id, 0, 0, 100, i * 10));
		const g2 = ['L3', 'L2', 'L1'].map((id, i) =>
			vertebra_on_circle(id, -300, 0, 100, 200 - i * 25)
		);
		const g3 = ['Th12', 'Th11', 'Th10'].map((id, i) =>
			vertebra_on_circle(id, -600, 0, 100, i * 10)
		);
		const polygons = [...g1, ...g2, ...g3];

		const tally: DiagnosisTally = new Map();
		evaluateCongenitalKyphosis(tally, polygons, 1);

		expect(tally.size).toBe(1);
		const entry = tally.get('sag-congenital-kyphosis:Th12-L4');
		expect(entry?.abnormal).toBe(2);
		expect(entry?.total).toBe(2);
		expect(entry?.symptoms).toHaveLength(2);
	});

	it('pattern 2: does not fire when only some internal discs of the middle arc are abnormal', () => {
		// Same 3-arc shape as the positive case, but the middle arc's sweep is
		// shallow enough that its internal disc angles stay within their
		// normal bands, so the AND-gate across all internal discs never holds.
		const g1 = ['S1', 'L5', 'L4'].map((id, i) => vertebra_on_circle(id, 0, 0, 100, i * 10));
		const g2 = ['L3', 'L2', 'L1'].map((id, i) =>
			vertebra_on_circle(id, -300, 0, 100, 200 - i * 10)
		);
		const g3 = ['Th12', 'Th11', 'Th10'].map((id, i) =>
			vertebra_on_circle(id, -600, 0, 100, i * 10)
		);
		const polygons = [...g1, ...g2, ...g3];

		const tally: DiagnosisTally = new Map();
		evaluateCongenitalKyphosis(tally, polygons, 1);

		expect(tally.size).toBe(0);
	});
});
