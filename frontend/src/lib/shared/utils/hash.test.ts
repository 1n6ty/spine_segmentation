import { describe, it, expect } from 'vitest';
import { sha256_hex } from './hash';

describe('sha256_hex', () => {
	it('returns a 64-character lowercase hex digest', async () => {
		const file = new File(['hello world'], 'test.txt');
		const digest = await sha256_hex(file);

		expect(digest).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is deterministic for identical content', async () => {
		const a = await sha256_hex(new File(['same content'], 'a.txt'));
		const b = await sha256_hex(new File(['same content'], 'b.txt'));

		expect(a).toBe(b);
	});

	it('differs for different content', async () => {
		const a = await sha256_hex(new File(['content a'], 'a.txt'));
		const b = await sha256_hex(new File(['content b'], 'b.txt'));

		expect(a).not.toBe(b);
	});
});
