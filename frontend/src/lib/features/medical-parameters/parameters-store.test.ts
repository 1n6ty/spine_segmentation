import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { project } from '$lib/core/project.svelte';
import { structures, params } from './parameters-store.svelte';
import type { Vertebrae } from './types';

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
	params.activeStructure = 'vertebrae';
});

describe('structures.vertebrae', () => {
	it('mirrors the session projection polygons for both side and frontal, independently', () => {
		const side_polys = [make_vertebra('C2', 0, 0), make_vertebra('C3', 0, 40)];
		project.session.projections.side.polygons = side_polys;

		expect(structures.side.vertebrae).toEqual(side_polys);
		expect(structures.frontal.vertebrae).toEqual([]);
	});
});

describe('structures.gaps', () => {
	it('pairs each polygon with the one directly above it, dropping the topmost', () => {
		const c2 = make_vertebra('C2', 0, 0);
		const c3 = make_vertebra('C3', 0, 40);
		const c4 = make_vertebra('C4', 0, 80);
		project.session.projections.side.polygons = [c4, c3, c2];

		expect(structures.side.gaps).toEqual([
			{ top: c3, bottom: c4 },
			{ top: c2, bottom: c3 }
		]);
	});

	it('is empty for 0 or 1 vertebrae', () => {
		project.session.projections.side.polygons = [];
		expect(structures.side.gaps).toEqual([]);

		project.session.projections.side.polygons = [make_vertebra('C2')];
		expect(structures.side.gaps).toEqual([]);
	});
});

describe('structures.segments', () => {
	it('is empty when no fixed region is fully annotated', () => {
		project.session.projections.side.polygons = [make_vertebra('C2')];
		expect(structures.side.segments).toEqual([]);
	});

	it('includes a region once every one of its vertebra ids is present, regardless of array order', () => {
		const cervical = [...CERVICAL_IDS].reverse().map((id, i) => make_vertebra(id, 0, i * 40));
		project.session.projections.side.polygons = cervical;

		expect(structures.side.segments).toHaveLength(1);
		expect(structures.side.segments[0].map((v) => v.id).sort()).toEqual([...CERVICAL_IDS].sort());
	});
});

describe('params.calculate', () => {
	it('returns vertebrae/gaps/segments/overall sized to the session state', () => {
		project.session.projections.side.polygons = [make_vertebra('C2', 0, 0), make_vertebra('C3', 0, 40)];

		const result = params.calculate('side');

		expect(result.vertebrae).toHaveLength(2);
		expect(result.gaps).toHaveLength(1);
		expect(result.segments).toHaveLength(0);
		expect(result.overall).toBeDefined();
	});

	it('does not throw when the projection has no attached patient (defaults mmPerPixel to 1)', () => {
		project.session.projections.side.polygons = [make_vertebra('C2', 0, 0), make_vertebra('C3', 0, 40)];
		project.session.projections.side.patient = null;

		expect(() => params.calculate('side')).not.toThrow();
	});

	it('scales linear params by the projection patient chain mmPerPixel when a patient is attached', () => {
		project.session.projections.side.polygons = [make_vertebra('C2', 0, 0), make_vertebra('C3', 0, 40)];

		project.session.projections.side.patient = null;
		const without_scale = params.calculate('side');

		project.session.projections.side.patient = {
			study: { series: { sopInstance: { mmPerPixel: 2 } } },
			destroy: () => {}
		} as any;
		const with_scale = params.calculate('side');

		expect(with_scale.vertebrae[0]!.params.p1.val).toBeCloseTo(
			(without_scale.vertebrae[0]!.params.p1.val as number) * 2
		);
	});
});

describe('params.side / params.frontal getters', () => {
	it('are wired to their own respective projection', () => {
		project.session.projections.side.polygons = [make_vertebra('C2', 0, 0), make_vertebra('C3', 0, 40)];

		expect(params.side.vertebrae).toHaveLength(2);
		expect(params.frontal.vertebrae).toHaveLength(0);
	});
});

describe('params.activeStructure', () => {
	it('defaults to vertebrae and is directly settable', () => {
		expect(params.activeStructure).toBe('vertebrae');
		params.activeStructure = 'gaps';
		expect(params.activeStructure).toBe('gaps');
	});
});
