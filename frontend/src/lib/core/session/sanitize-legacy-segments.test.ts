import { describe, it, expect } from 'vitest';
import { sanitize_persisted_segments } from './sanitize-legacy-segments';

describe('sanitize_persisted_segments', () => {
	it('drops a legacy hardcoded-id default entry whose range matches the old default', () => {
		const result = sanitize_persisted_segments([
			{ id: 'cervical', topId: 'C2', bottomId: 'C7' },
			{ id: 'thoracic', topId: 'Th1', bottomId: 'Th12' },
			{ id: 'lumbar', topId: 'L1', bottomId: 'S1' }
		]);
		expect(result).toEqual([]);
	});

	it('drops any entry tagged generated: true', () => {
		const result = sanitize_persisted_segments([
			{ id: 'generated:S1-L3', topId: 'L3', bottomId: 'S1', generated: true }
		]);
		expect(result).toEqual([]);
	});

	it('keeps a genuine user segment with a UUID id, even if it spans the same range as a legacy default', () => {
		const result = sanitize_persisted_segments([
			{ id: 'a1b2c3d4-uuid', topId: 'C2', bottomId: 'C7' }
		]);
		expect(result).toEqual([{ id: 'a1b2c3d4-uuid', topId: 'C2', bottomId: 'C7' }]);
	});

	it('keeps an unrelated user segment untouched', () => {
		const result = sanitize_persisted_segments([
			{ id: 'custom-uuid', topId: 'C4', bottomId: 'Th2' }
		]);
		expect(result).toEqual([{ id: 'custom-uuid', topId: 'C4', bottomId: 'Th2' }]);
	});

	it('returns an empty array for an empty input', () => {
		expect(sanitize_persisted_segments([])).toEqual([]);
	});
});
