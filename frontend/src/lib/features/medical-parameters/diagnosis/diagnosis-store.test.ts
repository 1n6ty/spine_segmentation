import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { project } from '$lib/core/project.svelte';
import { diagnosis } from './diagnosis-store.svelte';
import type { Vertebrae } from '../types';

function make_vertebra(id: string, cx = 0, cy = 0): Vertebrae {
	const h = 20;
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

const CERVICAL_IDS = ['C2', 'C3', 'C4', 'C5', 'C6', 'C7'];

beforeEach(async () => {
	project.resetSession();
	await project.session.loadingPromise;
});

describe('diagnosis.side / diagnosis.frontal', () => {
	it('reports insufficientAnnotation when no region is fully annotated', () => {
		project.session.projections.side.polygons = [make_vertebra('C2')];

		const result = diagnosis.side;

		expect(result.insufficientAnnotation).toBe(true);
		expect(result.regions).toEqual([]);
	});

	it('renders a region as soon as its own ids are fully present, independent of the others', () => {
		const cervical = CERVICAL_IDS.map((id, i) => make_vertebra(id, 0, i * 40));
		project.session.projections.side.polygons = cervical;

		const result = diagnosis.side;

		expect(result.insufficientAnnotation).toBe(false);
		expect(result.regions).toHaveLength(1);
		expect(result.regions[0].id).toBe('cervical');
		expect(result.regions[0].vertebrae).toHaveLength(6);
		expect(result.regions[0].gaps).toHaveLength(5);
	});

	it('conclusion is never empty -- falls back to a normal "no findings" entry when nothing is abnormal', () => {
		const cervical = CERVICAL_IDS.map((id, i) => make_vertebra(id, 0, i * 40));
		project.session.projections.side.polygons = cervical;

		const result = diagnosis.side;

		expect(result.conclusion.length).toBeGreaterThan(0);
		if (result.conclusion.length === 1 && result.conclusion[0].id === 'no-findings') {
			expect(result.conclusion[0].severity).toBe('normal');
		}
	});

	it('side and frontal are wired to their own projection independently', () => {
		const cervical = CERVICAL_IDS.map((id, i) => make_vertebra(id, 0, i * 40));
		project.session.projections.side.polygons = cervical;
		project.session.projections.frontal.polygons = [];

		expect(diagnosis.side.insufficientAnnotation).toBe(false);
		expect(diagnosis.frontal.insufficientAnnotation).toBe(true);
	});
});
