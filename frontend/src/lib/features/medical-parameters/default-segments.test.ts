import { describe, it, expect } from 'vitest';
import { DEFAULT_REGION_DEFINITIONS, resolve_default_regions } from './default-segments';
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
const LUMBAR_IDS = ['L1', 'L2', 'L3', 'L4', 'L5', 'S1'];

function vertebrae(ids: string[]): Vertebrae[] {
	return ids.map((id, i) => make_vertebra(id, 0, i * 40));
}

describe('DEFAULT_REGION_DEFINITIONS', () => {
	it('declares Cervical, Thoracic (Upper/Central/Lower/Total), then Lumbar, in that order', () => {
		expect(DEFAULT_REGION_DEFINITIONS.map((d) => d.id)).toEqual([
			'default:cervical',
			'default:thoracic-upper',
			'default:thoracic-central',
			'default:thoracic-lower',
			'default:thoracic-total',
			'default:lumbar'
		]);
	});

	it('matches the Report tab ranges exactly', () => {
		expect(DEFAULT_REGION_DEFINITIONS).toEqual([
			{ id: 'default:cervical', topId: 'C2', bottomId: 'C7', subHeaderKey: 'cervical' },
			{
				id: 'default:thoracic-upper',
				topId: 'Th1',
				bottomId: 'Th5',
				subHeaderKey: 'thoracic',
				rowLabelKey: 'upper'
			},
			{
				id: 'default:thoracic-central',
				topId: 'Th6',
				bottomId: 'Th9',
				subHeaderKey: 'thoracic',
				rowLabelKey: 'central'
			},
			{
				id: 'default:thoracic-lower',
				topId: 'Th10',
				bottomId: 'Th12',
				subHeaderKey: 'thoracic',
				rowLabelKey: 'lower'
			},
			{
				id: 'default:thoracic-total',
				topId: 'Th1',
				bottomId: 'Th12',
				subHeaderKey: 'thoracic',
				rowLabelKey: 'total'
			},
			{ id: 'default:lumbar', topId: 'L1', bottomId: 'S1', subHeaderKey: 'lumbar' }
		]);
	});
});

describe('resolve_default_regions', () => {
	it('returns nothing when no region is fully annotated', () => {
		expect(resolve_default_regions(vertebrae(['C2']))).toEqual([]);
	});

	it('includes only the Cervical row once C2-C7 is fully annotated', () => {
		const rows = resolve_default_regions(vertebrae(CERVICAL_IDS));
		expect(rows).toHaveLength(1);
		expect(rows[0].definitionId).toBe('default:cervical');
		expect(rows[0].kind).toBe('default');
		expect(rows[0].subHeaderKey).toBe('cervical');
		expect(rows[0].rowLabelKey).toBeUndefined();
		expect(rows[0].polygons.map((v) => v.id).sort()).toEqual([...CERVICAL_IDS].sort());
	});

	it('includes all 4 Thoracic rows once Th1-Th12 is fully annotated, independently of Cervical/Lumbar', () => {
		const rows = resolve_default_regions(vertebrae(THORACIC_IDS));
		expect(rows.map((r) => r.definitionId)).toEqual([
			'default:thoracic-upper',
			'default:thoracic-central',
			'default:thoracic-lower',
			'default:thoracic-total'
		]);
		expect(rows.every((r) => r.subHeaderKey === 'thoracic')).toBe(true);
	});

	it('includes the Lumbar/Sacral row once L1-S1 is fully annotated', () => {
		const rows = resolve_default_regions(vertebrae(LUMBAR_IDS));
		expect(rows).toHaveLength(1);
		expect(rows[0].definitionId).toBe('default:lumbar');
	});

	it('resolves all regions together, in declared order, for a fully-annotated spine', () => {
		const rows = resolve_default_regions(
			vertebrae([...CERVICAL_IDS, ...THORACIC_IDS, ...LUMBAR_IDS])
		);
		expect(rows.map((r) => r.definitionId)).toEqual(DEFAULT_REGION_DEFINITIONS.map((d) => d.id));
	});
});
