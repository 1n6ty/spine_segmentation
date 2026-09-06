import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({
	get: vi.fn().mockResolvedValue({ ok: false }),
	patch_json: vi.fn().mockResolvedValue(undefined)
}));

import { project } from '$lib/core/project.svelte';
import { remove_segment, add_segment, can_add_segment } from './segments';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

function square(id: string, cx: number, cy: number, h = 10): Polygon {
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

beforeEach(async () => {
	project.resetSession();
	await project.session.loadingPromise;
});

describe('remove_segment', () => {
	it('removes only the matching definition from the given projection', () => {
		project.session.projections.side.segments = [
			{ id: 'a', topId: 'C2', bottomId: 'C7' },
			{ id: 'b', topId: 'Th1', bottomId: 'Th12' }
		];

		remove_segment('side', 'a');

		expect(project.session.projections.side.segments.map((s) => s.id)).toEqual(['b']);
	});

	it('does not affect the other projection', () => {
		project.session.projections.side.segments = [{ id: 'a', topId: 'C2', bottomId: 'C7' }];
		project.session.projections.frontal.segments = [{ id: 'a', topId: 'C2', bottomId: 'C7' }];

		remove_segment('side', 'a');

		expect(project.session.projections.side.segments).toEqual([]);
		expect(project.session.projections.frontal.segments).toHaveLength(1);
	});

	it('is a no-op when the id is not present', () => {
		project.session.projections.side.segments = [{ id: 'a', topId: 'C2', bottomId: 'C7' }];

		remove_segment('side', 'nonexistent');

		expect(project.session.projections.side.segments).toHaveLength(1);
	});
});

describe('add_segment', () => {
	it('appends a new definition with a generated id to the given projection', () => {
		project.session.projections.side.segments = [];

		add_segment('side', 'C2', 'C7');

		expect(project.session.projections.side.segments).toHaveLength(1);
		const added = project.session.projections.side.segments[0];
		expect(added.topId).toBe('C2');
		expect(added.bottomId).toBe('C7');
		expect(added.id).toBeTruthy();
	});

	it('does not affect the other projection', () => {
		project.session.projections.side.segments = [];
		project.session.projections.frontal.segments = [];

		add_segment('side', 'C2', 'C7');

		expect(project.session.projections.side.segments).toHaveLength(1);
		expect(project.session.projections.frontal.segments).toHaveLength(0);
	});

	it('leaves existing segments alone when appending a new one', () => {
		project.session.projections.side.segments = [{ id: 'a', topId: 'Th1', bottomId: 'Th12' }];

		add_segment('side', 'C2', 'C7');

		const segments = project.session.projections.side.segments;
		expect(segments).toHaveLength(2);
		expect(segments.some((s) => s.id === 'a')).toBe(true);
	});
});

describe('can_add_segment', () => {
	it('is false with fewer than 2 annotated vertebrae', () => {
		project.session.projections.side.polygons = [];
		expect(can_add_segment('side')).toBe(false);

		project.session.projections.side.polygons = [square('C2', 0, 0)];
		expect(can_add_segment('side')).toBe(false);
	});

	it('is true with 2 or more annotated vertebrae', () => {
		project.session.projections.side.polygons = [square('C2', 0, 0), square('C3', 0, 40)];
		expect(can_add_segment('side')).toBe(true);
	});
});
