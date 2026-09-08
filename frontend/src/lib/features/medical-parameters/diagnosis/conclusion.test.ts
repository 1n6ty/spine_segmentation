import { describe, it, expect } from 'vitest';
import {
	rankFromTally,
	tallySingle,
	tallyComposite,
	evaluatePattern,
	triCode,
	gradeDetail,
	severityGrade,
	type DiagnosisTally
} from './conclusion';

describe('rankFromTally', () => {
	it('returns an empty ranking for an empty tally', () => {
		expect(rankFromTally(new Map())).toEqual([]);
	});

	it('returns an empty ranking when nothing is abnormal', () => {
		const tally: DiagnosisTally = new Map();
		tallyComposite(tally, 'sag-scheuermann', 0, 5);
		expect(rankFromTally(tally)).toEqual([]);
	});

	it('a fully-triggered single-parameter diagnosis shows at 100%', () => {
		const tally: DiagnosisTally = new Map();
		tallySingle(tally, 'sag-bekhterev-cervical', true);

		const ranking = rankFromTally(tally);
		expect(ranking).toHaveLength(1);
		expect(ranking[0].key).toBe('sag-bekhterev-cervical');
		expect(ranking[0].probability).toBeCloseTo(1);
	});

	it('never tallies an untriggered single-parameter diagnosis', () => {
		const tally: DiagnosisTally = new Map();
		tallySingle(tally, 'sag-bekhterev-cervical', false);
		expect(tally.size).toBe(0);
		expect(rankFromTally(tally)).toEqual([]);
	});

	it('never divides by zero for a diagnosis with total=0', () => {
		const tally: DiagnosisTally = new Map();
		tallyComposite(tally, 'sag-scheuermann', 0, 0);
		expect(tally.size).toBe(0);
		expect(rankFromTally(tally)).toEqual([]);
	});

	it('excludes a diagnosis at exactly the 0.5 threshold', () => {
		const tally: DiagnosisTally = new Map();
		tallyComposite(tally, 'sag-scheuermann', 2, 4); // S = 0.5, not > 0.5
		expect(rankFromTally(tally)).toEqual([]);
	});

	it('includes a diagnosis just above the 0.5 threshold', () => {
		const tally: DiagnosisTally = new Map();
		tallyComposite(tally, 'sag-scheuermann', 3, 4); // S = 0.75
		const ranking = rankFromTally(tally);
		expect(ranking).toHaveLength(1);
		expect(ranking[0].probability).toBeCloseTo(0.75);
	});

	it('does NOT normalize — two independently-scored diagnoses both show their own raw score', () => {
		const tally: DiagnosisTally = new Map();
		tallySingle(tally, 'sag-bekhterev-lumbar', true); // S = 1.0
		tallyComposite(tally, 'sag-spondylolisthesis-l5', 3, 4); // S = 0.75

		const ranking = rankFromTally(tally);
		expect(ranking).toHaveLength(2);
		expect(ranking[0].key).toBe('sag-bekhterev-lumbar');
		expect(ranking[0].probability).toBeCloseTo(1);
		expect(ranking[1].key).toBe('sag-spondylolisthesis-l5');
		expect(ranking[1].probability).toBeCloseTo(0.75);
		// Explicitly not summing to 1 — a patient can have multiple concurrent diagnoses.
		const total = ranking.reduce((acc, d) => acc + d.probability, 0);
		expect(total).toBeCloseTo(1.75);
	});

	it('has no cap on how many diagnoses can be shown at once', () => {
		const tally: DiagnosisTally = new Map();
		const keys = [
			'sag-bekhterev-cervical',
			'sag-bekhterev-thoracic-upper',
			'sag-bekhterev-thoracic-mid',
			'sag-bekhterev-thoracic-lower',
			'sag-bekhterev-thoracic-total',
			'sag-bekhterev-lumbar',
			'sag-l4-spondylolisthesis'
		] as const;
		for (const key of keys) tallySingle(tally, key, true);

		const ranking = rankFromTally(tally);
		expect(ranking).toHaveLength(7);
	});

	it('sorts descending by probability', () => {
		const tally: DiagnosisTally = new Map();
		tallyComposite(tally, 'sag-spondylolisthesis-l5', 3, 4); // S = 0.75
		tallyComposite(tally, 'sag-vertebral-fracture', 4, 4); // S = 1.0

		const ranking = rankFromTally(tally);
		expect(ranking.map((d) => d.key)).toEqual(['sag-vertebral-fracture', 'sag-spondylolisthesis-l5']);
	});
});

describe('per-instance keys and detail (vertebra name / grade display)', () => {
	it('appends a detail onto the base diagnosis label', () => {
		const tally: DiagnosisTally = new Map();
		tallySingle(tally, 'sag-bekhterev-cervical', true, gradeDetail(2));

		const ranking = rankFromTally(tally);
		expect(ranking).toHaveLength(1);
		expect(ranking[0].label['en-US']).toContain('grade 2');
	});

	it('shows the base label unchanged when no detail is given', () => {
		const tally: DiagnosisTally = new Map();
		tallySingle(tally, 'sag-scheuermann', true);

		const ranking = rankFromTally(tally);
		expect(ranking[0].label['en-US']).toBe("Scheuermann-Mau disease");
	});

	it('tracks multiple per-vertebra instances of the same base diagnosis independently', () => {
		const tally: DiagnosisTally = new Map();
		tallySingle(tally, 'sag-vertebral-fracture:Th7', true, {
			'en-US': 'Vertebra Th7',
			'ru-RU': 'Позвонок Th7'
		});
		tallySingle(tally, 'sag-vertebral-fracture:L2', true, {
			'en-US': 'Vertebra L2',
			'ru-RU': 'Позвонок L2'
		});

		const ranking = rankFromTally(tally);
		expect(ranking).toHaveLength(2);
		const labels = ranking.map((d) => d.label['en-US']);
		expect(labels.some((l) => l.includes('Th7'))).toBe(true);
		expect(labels.some((l) => l.includes('L2'))).toBe(true);
	});
});

describe('severityGrade', () => {
	it('extracts the numeric grade', () => {
		expect(severityGrade('grade3')).toBe(3);
	});

	it('returns null for normal', () => {
		expect(severityGrade('normal')).toBeNull();
	});
});

describe('triCode', () => {
	const range = { min: -10, max: 10 };

	it('codes a value within the range as 0', () => {
		expect(triCode(0, range)).toBe(0);
	});

	it('codes a value below the range as -1', () => {
		expect(triCode(-20, range)).toBe(-1);
	});

	it('codes a value above the range as 1', () => {
		expect(triCode(20, range)).toBe(1);
	});

	it('inverts the sign when invert is true', () => {
		expect(triCode(-20, range, true)).toBe(1);
		expect(triCode(20, range, true)).toBe(-1);
		expect(triCode(0, range, true)).toBe(0);
	});
});

describe('evaluatePattern', () => {
	it('tallies a full exact match as 100%', () => {
		const tally: DiagnosisTally = new Map();
		evaluatePattern(tally, 'sag-slipped-dislocation', [1, 1, -1, 0, 1, 0, 1, -1], [
			1, 1, -1, 0, 1, 0, 1, -1
		]);
		expect(rankFromTally(tally)).toEqual([
			expect.objectContaining({ key: 'sag-slipped-dislocation', probability: 1 })
		]);
	});

	it('supports an "any of" match for a single item position', () => {
		const tally: DiagnosisTally = new Map();
		evaluatePattern(tally, 'sag-degenerative-disc', [1, 1], [1, [0, 1]]);
		expect(rankFromTally(tally)).toEqual([
			expect.objectContaining({ key: 'sag-degenerative-disc', probability: 1 })
		]);
	});

	it('does not tally anything when every referenced item is null', () => {
		const tally: DiagnosisTally = new Map();
		evaluatePattern(tally, 'sag-degenerative-disc', [null, null], [1, [0, 1]]);
		expect(tally.size).toBe(0);
	});

	it('gates to absent (no tally at all) when even one available item contradicts the pattern', () => {
		const tally: DiagnosisTally = new Map();
		// 7 of 8 items match the required pattern exactly; item 3 (index 2)
		// is 1 instead of the required -1 — a real mismatch, not a missing
		// value. Under the old ungated ratio this would have shown 7/8 =
		// 87.5%; gated, a single contradicting item invalidates the whole
		// lock-and-key match.
		evaluatePattern(tally, 'sag-slipped-dislocation', [1, 1, 1, 0, 1, 0, 1, -1], [
			1, 1, -1, 0, 1, 0, 1, -1
		]);
		expect(tally.size).toBe(0);
		expect(rankFromTally(tally)).toEqual([]);
	});

	it('gates an "any of" position too — a code outside the accepted set invalidates the match', () => {
		const tally: DiagnosisTally = new Map();
		evaluatePattern(tally, 'sag-degenerative-disc', [1, -1], [1, [0, 1]]);
		expect(tally.size).toBe(0);
	});

	it('still gives full credit for however many items were actually checkable when the rest are unavailable', () => {
		const tally: DiagnosisTally = new Map();
		// Only items 4 and 5 (indices 3, 4) are computable this round, and
		// both match -> 100% of the 2 items actually checked, same as before.
		evaluatePattern(
			tally,
			'sag-cervical-fracture',
			[null, null, null, -1, 1, null, null, null],
			[0, 0, 0, -1, 1, 0, 0, 0]
		);
		const ranking = rankFromTally(tally);
		expect(ranking).toHaveLength(1);
		expect(ranking[0].probability).toBeCloseTo(1);
	});
});
