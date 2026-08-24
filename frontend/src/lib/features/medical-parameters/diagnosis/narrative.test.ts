import { describe, expect, it } from 'vitest';
import {
	buildParametersNarrative,
	narrativeSentence,
	withRangeBadge,
	paramLabel,
	vertebraLabel,
	gapLabel
} from './narrative';

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
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		expect(narrative.clauses).toHaveLength(3);
		expect(narrative.clauses.map((c) => c.key)).toEqual(['p1', 'p2', 'p3']);
		expect(narrative.clauses.every((c) => c.badge === undefined)).toBe(true);

		const result = narrativeSentence(narrative);
		expect(result['ru-RU']).toBe(
			'Отрезок от Th1 до Th12: Радиус дуги составляет 145.2 мм, Длина хорды дуги составляет 210.4 мм, Центральный угол дуги составляет 72.3°.'
		);
		expect(result['en-US']).toBe(
			'Segment from Th1 to Th12: Arc radius is 145.2 mm, Arc chord length is 210.4 mm, Arc central angle is 72.3°.'
		);
	});

	it('produces an empty clause list when every value is null', () => {
		const params = {
			p1: { val: null, type: 'linear' },
			p2: { val: null, type: 'linear' }
		};
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		expect(narrative.clauses).toHaveLength(0);
		expect(narrativeSentence(narrative)['ru-RU']).toBe('Отрезок от Th1 до Th12: .');
	});
});

describe('withRangeBadge', () => {
	const identity = { 'ru-RU': 'Отрезок от Th1 до Th12', 'en-US': 'Segment from Th1 to Th12' };
	const params = {
		p3: { val: 72.3, type: 'angular' }
	};

	it('attaches a badge to the matching clause, formatted as center ± tolerance', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const badged = withRangeBadge(narrative, 'p3', 'normal', { min: -5, max: 5, center: 0 });
		expect(badged.clauses[0].badge?.severity).toBe('normal');
		expect(badged.clauses[0].badge?.display['en-US']).toBe('normal 0 ± 5°');
	});

	it('formats a non-symmetric range as min–max', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const badged = withRangeBadge(narrative, 'p3', 'grade1', { min: 39, max: 65 });
		expect(badged.clauses[0].badge?.display['en-US']).toBe('normal 39–65°');
	});

	it('formats an open-ended range with a bare lower bound', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const badged = withRangeBadge(narrative, 'p3', 'normal', { min: -35, max: Infinity });
		expect(badged.clauses[0].badge?.display['en-US']).toBe('normal > -35°');
	});

	it('is a no-op when no clause has the given key', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const badged = withRangeBadge(narrative, 'p9', 'normal', { min: 0, max: 1 });
		expect(badged.clauses[0].badge).toBeUndefined();
	});

	it('rounds a center+tolerance range to 2 decimals, not a raw floating-point subtraction', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		// 9.11 - 6.61 === 2.499999999999999 in raw JS float math -- must round to 2.5.
		const badged = withRangeBadge(narrative, 'p3', 'normal', {
			min: 4.11,
			max: 9.11,
			center: 6.61
		});
		expect(badged.clauses[0].badge?.display['en-US']).toBe('normal 6.61 ± 2.5°');
	});

	it('rounds a plain min-max range to 2 decimals', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const badged = withRangeBadge(narrative, 'p3', 'normal', { min: 1.005, max: 2.0049999 });
		expect(badged.clauses[0].badge?.display['en-US']).toBe('normal 1–2°');
	});
});
