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
const LUMBAR_IDS = ['S1', 'L5', 'L4', 'L3', 'L2', 'L1'];

function make_lumbar(): Vertebrae[] {
	return LUMBAR_IDS.map((id, i) => make_vertebra(id, 0, i * 40));
}

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

const THORACIC_IDS = [
	'Th1',
	'Th2',
	'Th3',
	'Th4',
	'Th5',
	'Th6',
	'Th7',
	'Th8',
	'Th9',
	'Th10',
	'Th11',
	'Th12'
];

function make_thoracic(): Vertebrae[] {
	return THORACIC_IDS.map((id, i) => make_vertebra(id, 0, i * 40));
}

describe('sagittal thoracic sub-regions', () => {
	it('splits into 3 nested sub-regions, with the whole-Th1-Th12 curve on the container', () => {
		project.session.projections.side.polygons = make_thoracic();

		const result = diagnosis.side;
		expect(result.regions).toHaveLength(1);
		const thoracic = result.regions[0];
		expect(thoracic.id).toBe('thoracic');
		expect(thoracic.vertebrae).toEqual([]);
		expect(thoracic.gaps).toEqual([]);
		expect(thoracic.subRegions).toHaveLength(3);
		expect(thoracic.findings.some((f) => f.id === 'thoracic-curve')).toBe(true);

		const [upper, mid, lower] = thoracic.subRegions!;
		expect(upper.id).toBe('thoracic-upper');
		expect(upper.vertebrae).toHaveLength(5);
		expect(upper.gaps).toHaveLength(5); // 4 internal + Th5-Th6 boundary
		expect(upper.gaps.at(-1)!.id).toBe('Th5-Th6');

		expect(mid.id).toBe('thoracic-mid');
		expect(mid.vertebrae).toHaveLength(4);
		expect(mid.gaps).toHaveLength(4); // 3 internal + Th9-Th10 boundary
		expect(mid.gaps.at(-1)!.id).toBe('Th9-Th10');

		expect(lower.id).toBe('thoracic-lower');
		expect(lower.vertebrae).toHaveLength(3);
		expect(lower.gaps).toHaveLength(2); // no boundary gap appended here
	});

	it('fires Scheuermann at most once, at the container level, never inside a sub-region', () => {
		project.session.projections.side.polygons = make_thoracic();
		const thoracic = diagnosis.side.regions[0];

		const containerScheuermann = thoracic.findings.filter((f) => f.id === 'thoracic-scheuermann');
		expect(containerScheuermann.length).toBeLessThanOrEqual(1);
		for (const sub of thoracic.subRegions!) {
			expect(sub.findings.some((f) => f.id.includes('scheuermann'))).toBe(false);
		}
	});

	it('conclusionRanking never includes a diagnosis at or below the 0.5 threshold', () => {
		project.session.projections.side.polygons = make_thoracic();
		const result = diagnosis.side;

		expect(result.conclusionRanking.every((d) => d.probability > 0.5)).toBe(true);
	});

	it('propagates every abnormal sub-region finding into the whole-spine conclusion', () => {
		project.session.projections.side.polygons = make_thoracic();
		const result = diagnosis.side;
		const thoracic = result.regions[0];

		const abnormalSubFindingIds = thoracic
			.subRegions!.flatMap((sub) => [
				...sub.findings,
				...sub.vertebrae.flatMap((v) => v.findings),
				...sub.gaps.flatMap((g) => g.findings)
			])
			.filter((f) => f.severity !== 'normal')
			.map((f) => f.id);

		expect(abnormalSubFindingIds.length).toBeGreaterThan(0);
		for (const id of abnormalSubFindingIds) {
			expect(result.conclusion.some((f) => f.id === id)).toBe(true);
		}
	});

	it('leaves frontal projection thoracic as a single flat region, unaffected', () => {
		project.session.projections.frontal.polygons = make_thoracic();
		const result = diagnosis.frontal;

		expect(result.regions).toHaveLength(1);
		const thoracic = result.regions[0];
		expect(thoracic.id).toBe('thoracic');
		expect(thoracic.vertebrae).toHaveLength(12);
		expect(thoracic.gaps).toHaveLength(11);
		expect(thoracic.subRegions).toBeUndefined();
	});
});

describe('lumbar-region composite diagnoses (module 4 revision 2)', () => {
	it('wires L4-L5 displacement and the rewritten L5 spondylolisthesis grading without throwing', () => {
		project.session.projections.side.polygons = make_lumbar();
		const result = diagnosis.side;

		expect(result.regions).toHaveLength(1);
		const lumbar = result.regions[0];
		expect(lumbar.id).toBe('lumbar');

		const l4l5Gap = lumbar.gaps.find((g) => g.id === 'L4-L5');
		expect(l4l5Gap?.findings.some((f) => f.id === 'L4-L5-displacement')).toBe(true);
		expect(lumbar.findings.some((f) => f.id === 'l5-spondylolisthesis')).toBe(true);
		expect(result.conclusionRanking.every((d) => d.probability > 0.5)).toBe(true);
	});

	it('never shows L5 spondylolisthesis in the conclusion when its own Finding says normal', () => {
		project.session.projections.side.polygons = make_lumbar();
		const result = diagnosis.side;
		const lumbar = result.regions[0];

		const spondylolisthesisFinding = lumbar.findings.find((f) => f.id === 'l5-spondylolisthesis');
		expect(spondylolisthesisFinding).toBeDefined();
		if (spondylolisthesisFinding?.severity === 'normal') {
			expect(result.conclusionRanking.some((d) => d.key === 'sag-spondylolisthesis-l5')).toBe(
				false
			);
		}
	});

	it('never shows a per-vertebra fracture in the conclusion for a vertebra with no fracture finding', () => {
		project.session.projections.side.polygons = make_lumbar();
		const result = diagnosis.side;
		const lumbar = result.regions[0];

		expect(lumbar.vertebrae.length).toBeGreaterThan(0);
		for (const v of lumbar.vertebrae) {
			const hasFractureFinding = v.findings.some((f) => f.id === `${v.id}-fracture`);
			const hasFractureCard = result.conclusionRanking.some(
				(d) => d.key === `sag-vertebral-fracture:${v.id}`
			);
			// A fracture card can only ever appear for a vertebra whose own
			// per-region Finding actually fired — never a phantom aggregate.
			expect(hasFractureCard).toBe(hasFractureFinding);
		}
	});
});
