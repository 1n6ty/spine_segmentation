import { describe, it, expect } from 'vitest';
import { parametersConfig } from './config';

const CATEGORIES = ['vertebrae', 'gaps', 'segments', 'overall'] as const;
const VALID_TYPES = new Set(['linear', 'angular']);

describe('parametersConfig', () => {
	it('defines both projections', () => {
		expect(Object.keys(parametersConfig).sort()).toEqual(['frontal', 'side']);
	});

	it.each(['side', 'frontal'] as const)('%s defines all four structure categories', (projection) => {
		expect(Object.keys(parametersConfig[projection]).sort()).toEqual([...CATEGORIES].sort());
	});

	it.each(['side', 'frontal'] as const)('%s: every param entry has a valid type', (projection) => {
		for (const category of CATEGORIES) {
			for (const [key, def] of Object.entries(parametersConfig[projection][category])) {
				expect(VALID_TYPES.has(def.type), `${projection}.${category}.${key}`).toBe(true);
			}
		}
	});

	it('side and frontal both define exactly p1-p9 for vertebrae', () => {
		const expected = Array.from({ length: 9 }, (_, i) => `p${i + 1}`).sort();
		expect(Object.keys(parametersConfig.side.vertebrae).sort()).toEqual(expected);
		expect(Object.keys(parametersConfig.frontal.vertebrae).sort()).toEqual(expected);
	});

	it('gaps/segments/overall share the same param-key shape across projections', () => {
		expect(Object.keys(parametersConfig.side.gaps)).toEqual(Object.keys(parametersConfig.frontal.gaps));
		expect(Object.keys(parametersConfig.side.segments)).toEqual(
			Object.keys(parametersConfig.frontal.segments)
		);
		expect(Object.keys(parametersConfig.side.overall)).toEqual(
			Object.keys(parametersConfig.frontal.overall)
		);
	});
});
