import { describe, expect, it } from 'vitest';
import {
	buildParametersNarrative,
	narrativeSentence,
	withClauseFinding,
	paramLabel,
	vertebraLabel,
	gapLabel
} from './narrative';
import type { Finding } from './types';

function fakeFinding(text = 'Vertebral body wedge-deformed', severity: Finding['severity'] = 'grade1'): Finding {
	return { id: 'fake', text: { 'en-US': text, 'ru-RU': text }, severity };
}

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

	it('lists every non-null parameter, in order, skipping nulls, at normal severity with no badge', () => {
		const params = {
			p1: { val: 145.2, type: 'linear' },
			p2: { val: 210.4, type: 'linear' },
			p3: { val: 72.3, type: 'angular' },
			p4: { val: null, type: 'angular' }
		};
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		expect(narrative.clauses).toHaveLength(3);
		expect(narrative.clauses.map((c) => c.key)).toEqual(['p1', 'p2', 'p3']);
		expect(narrative.clauses.every((c) => c.severity === 'normal')).toBe(true);
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

describe('withClauseFinding', () => {
	const identity = { 'ru-RU': 'Отрезок от Th1 до Th12', 'en-US': 'Segment from Th1 to Th12' };
	const params = {
		p3: { val: 72.3, type: 'angular' }
	};

	it('replaces the clause text with the Finding text and attaches a center ± tolerance badge', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const finding = fakeFinding('Central curve unchanged', 'normal');
		const replaced = withClauseFinding(narrative, 'p3', finding, { min: -5, max: 5, center: 0 });
		expect(replaced.clauses[0].text).toEqual(finding.text);
		expect(replaced.clauses[0].severity).toBe('normal');
		expect(replaced.clauses[0].badge?.['en-US']).toBe('normal 0 ± 5°');
	});

	it('formats a non-symmetric range as a worded "min to max"', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const finding = fakeFinding('Thoracic kyphosis increased grade 1', 'grade1');
		const replaced = withClauseFinding(narrative, 'p3', finding, { min: 39, max: 65 });
		expect(replaced.clauses[0].severity).toBe('grade1');
		expect(replaced.clauses[0].text['en-US']).toBe('Thoracic kyphosis increased grade 1');
		expect(replaced.clauses[0].badge?.['en-US']).toBe('normal 39 to 65°');
		expect(replaced.clauses[0].badge?.['ru-RU']).toBe('норма от 39 до 65°');
	});

	it('renders negative bounds with a real minus sign, no dash collision', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const finding = fakeFinding('Cervical lordosis unchanged', 'normal');
		const replaced = withClauseFinding(narrative, 'p3', finding, { min: -41, max: -15 });
		expect(replaced.clauses[0].badge?.['en-US']).toBe('normal −41 to −15°');
		expect(replaced.clauses[0].badge?.['ru-RU']).toBe('норма от −41 до −15°');
	});

	it('formats an open-ended range with a bare lower bound', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const finding = fakeFinding('No signs of spondylolisthesis', 'normal');
		const replaced = withClauseFinding(narrative, 'p3', finding, { min: -35, max: Infinity });
		expect(replaced.clauses[0].badge?.['en-US']).toBe('normal > −35°');
	});

	it('is a no-op when no clause has the given key', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const finding = fakeFinding();
		const replaced = withClauseFinding(narrative, 'p9', finding, { min: 0, max: 1 });
		expect(replaced.clauses[0].severity).toBe('normal');
		expect(replaced.clauses[0].badge).toBeUndefined();
		expect(replaced.clauses[0].text).toEqual(narrative.clauses[0].text);
	});

	it('rounds a center+tolerance range to 2 decimals, not a raw floating-point subtraction', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const finding = fakeFinding();
		// 9.11 - 6.61 === 2.499999999999999 in raw JS float math -- must round to 2.5.
		const replaced = withClauseFinding(narrative, 'p3', finding, {
			min: 4.11,
			max: 9.11,
			center: 6.61
		});
		expect(replaced.clauses[0].badge?.['en-US']).toBe('normal 6.61 ± 2.5°');
	});

	it('rounds a plain min-max range to 2 decimals', () => {
		const narrative = buildParametersNarrative(identity, 'side', 'segments', params);
		const finding = fakeFinding();
		const replaced = withClauseFinding(narrative, 'p3', finding, { min: 1.005, max: 2.0049999 });
		expect(replaced.clauses[0].badge?.['en-US']).toBe('normal 1 to 2°');
	});
});
