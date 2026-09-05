import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({
	get: vi.fn().mockResolvedValue({ ok: false }),
	patch_json: vi.fn().mockResolvedValue(undefined)
}));

import { project } from '$lib/core/project.svelte';
import { sync_generated_segments } from './generated-segments';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';

/** A vertebra polygon whose bottom/top plate midpoints sit on the given circle at `degrees`
 * (+/- a small spread) -- mirrors `central-arc-segments.test.ts`'s fixture. */
function vertebra_on_circle(id: string, cx: number, cy: number, r: number, degrees: number): Polygon {
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

beforeEach(async () => {
	project.resetSession();
	await project.session.loadingPromise;
});

describe('sync_generated_segments', () => {
	it('adds generated segments and persists when the computed set changes', () => {
		const ids = ['S1', 'L5', 'L4', 'L3'];
		project.session.projections.side.polygons = ids.map((id, i) =>
			vertebra_on_circle(id, 0, 0, 100, i * 10)
		);
		project.session.projections.side.segments = [];
		const requestSave = vi.spyOn(project.session, 'requestSave');

		sync_generated_segments('side');

		const generated = project.session.projections.side.segments.filter((s) => s.generated);
		expect(generated).toEqual([
			{ id: 'generated:S1-L3', topId: 'L3', bottomId: 'S1', generated: true }
		]);
		expect(requestSave).toHaveBeenCalledTimes(1);
	});

	it('leaves user-managed segments untouched', () => {
		const ids = ['S1', 'L5', 'L4', 'L3'];
		project.session.projections.side.polygons = ids.map((id, i) =>
			vertebra_on_circle(id, 0, 0, 100, i * 10)
		);
		project.session.projections.side.segments = [{ id: 'manual-1', topId: 'L4', bottomId: 'S1' }];

		sync_generated_segments('side');

		const manual = project.session.projections.side.segments.filter((s) => !s.generated);
		expect(manual).toEqual([{ id: 'manual-1', topId: 'L4', bottomId: 'S1' }]);
	});

	it('does not save again when the computed set is unchanged', () => {
		const ids = ['S1', 'L5', 'L4', 'L3'];
		project.session.projections.side.polygons = ids.map((id, i) =>
			vertebra_on_circle(id, 0, 0, 100, i * 10)
		);
		project.session.projections.side.segments = [];

		sync_generated_segments('side');
		const requestSave = vi.spyOn(project.session, 'requestSave');
		sync_generated_segments('side');

		expect(requestSave).not.toHaveBeenCalled();
	});

	it('removes stale generated segments once the computed set becomes empty', () => {
		project.session.projections.side.polygons = [];
		project.session.projections.side.segments = [
			{ id: 'generated:S1-L3', topId: 'L3', bottomId: 'S1', generated: true }
		];

		sync_generated_segments('side');

		expect(project.session.projections.side.segments).toEqual([]);
	});

	it('skips a candidate range that exactly matches an existing manual segment', () => {
		const ids = ['S1', 'L5', 'L4', 'L3'];
		project.session.projections.side.polygons = ids.map((id, i) =>
			vertebra_on_circle(id, 0, 0, 100, i * 10)
		);
		project.session.projections.side.segments = [{ id: 'manual-1', topId: 'L3', bottomId: 'S1' }];

		sync_generated_segments('side');

		const segments = project.session.projections.side.segments;
		expect(segments).toEqual([{ id: 'manual-1', topId: 'L3', bottomId: 'S1' }]);
	});

	it('does not affect the other projection', () => {
		const ids = ['S1', 'L5', 'L4', 'L3'];
		project.session.projections.side.polygons = ids.map((id, i) =>
			vertebra_on_circle(id, 0, 0, 100, i * 10)
		);
		project.session.projections.side.segments = [];
		project.session.projections.frontal.segments = [];

		sync_generated_segments('side');

		expect(project.session.projections.frontal.segments).toEqual([]);
	});
});
