import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({
	get: vi.fn().mockResolvedValue({ ok: false }),
	patch_json: vi.fn().mockResolvedValue(undefined)
}));

import { project } from '$lib/core/project.svelte';
import { remove_segment } from './segments';

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
