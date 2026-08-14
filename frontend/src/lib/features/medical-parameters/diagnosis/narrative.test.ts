import { describe, expect, it } from 'vitest';
import { buildParametersNarrative, paramLabel, vertebraLabel, gapLabel } from './narrative';

describe('vertebraLabel', () => {
	it('returns a bilingual vertebra label with the id interpolated', () => {
		const label = vertebraLabel('L5');
		expect(label['en-US']).toBe('Vertebra L5');
		expect(label['ru-RU']).toBe('Позвонок L5');
	});
});

describe('gapLabel', () => {
	it('returns a bilingual gap label with the id interpolated', () => {
		const label = gapLabel('L5-S1');
		expect(label['en-US']).toBe('Disc L5-S1');
		expect(label['ru-RU']).toBe('Диск L5-S1');
	});
});

describe('paramLabel', () => {
	it('returns the bilingual label for a known parameter', () => {
		const label = paramLabel('side', 'segments', 'p3');
		expect(label['ru-RU']).toBe('Центральный угол дуги');
		expect(label['en-US']).toBe('Arc central angle');
	});
});

describe('buildParametersNarrative', () => {
	const identity = { 'ru-RU': 'Отрезок от Th1 до Th12', 'en-US': 'Segment from Th1 to Th12' };

	it('lists every non-null parameter, in order, skipping nulls', () => {
		const params = {
			p1: { val: 145.2, type: 'linear' },
			p2: { val: 210.4, type: 'linear' },
			p3: { val: 72.3, type: 'angular' },
			p4: { val: null, type: 'angular' }
		};
		const result = buildParametersNarrative(identity, 'side', 'segments', params);
		expect(result['ru-RU']).toBe(
			'Отрезок от Th1 до Th12: Радиус дуги составляет 145.2 мм, Длина хорды дуги составляет 210.4 мм, Центральный угол дуги составляет 72.3°.'
		);
		expect(result['en-US']).toBe(
			'Segment from Th1 to Th12: Arc radius is 145.2 mm, Arc chord length is 210.4 mm, Arc central angle is 72.3°.'
		);
	});

	it('produces an empty list (just identity + colon + period) when every value is null', () => {
		const params = {
			p1: { val: null, type: 'linear' },
			p2: { val: null, type: 'linear' }
		};
		const result = buildParametersNarrative(identity, 'side', 'segments', params);
		expect(result['ru-RU']).toBe('Отрезок от Th1 до Th12: .');
	});
});
