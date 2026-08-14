import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getCSRFToken } = vi.hoisted(() => ({
	getCSRFToken: vi.fn((): string | null => 'test-csrf-token')
}));
vi.mock('./csrf', () => ({ getCSRFToken }));

import { get, post, post_json } from './client';

beforeEach(() => {
	global.fetch = vi.fn();
	getCSRFToken.mockReturnValue('test-csrf-token');
});

describe('post_json', () => {
	it('sends a JSON body with the CSRF header and returns the parsed response', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({ hello: 'world' })
		});

		const result = await post_json('/api/x/', { a: 1 });

		expect(global.fetch).toHaveBeenCalledWith(
			'/api/x/',
			expect.objectContaining({ method: 'POST', body: JSON.stringify({ a: 1 }) })
		);
		const headers = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Headers;
		expect(headers.get('X-CSRFToken')).toBe('test-csrf-token');
		expect(headers.get('Content-Type')).toBe('application/json');
		expect(result).toEqual({ hello: 'world' });
	});

	it('throws on a non-ok response', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });

		await expect(post_json('/api/x/', {})).rejects.toThrow();
	});
});

describe('get', () => {
	it('sends a bare GET request and returns the raw response', async () => {
		const raw_response = { ok: true, status: 200 };
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(raw_response);

		const result = await get('/api/me/');

		expect(global.fetch).toHaveBeenCalledWith('/api/me/');
		expect(result).toBe(raw_response);
	});
});

describe('post', () => {
	it('sends a JSON body when json is provided', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

		await post('/api/x/', { json: { a: 1 } });

		const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(init.body).toBe(JSON.stringify({ a: 1 }));
		expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
	});

	it('sends a FormData body without a Content-Type header when form is provided', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
		const form = new FormData();
		form.append('file', new Blob(['x']));

		await post('/api/x/', { form });

		const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(init.body).toBe(form);
		expect((init.headers as Headers).get('Content-Type')).toBeNull();
	});

	it('sends no body and no Content-Type when called with no init', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

		await post('/api/logout/');

		const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(init.body).toBeUndefined();
		expect((init.headers as Headers).get('X-CSRFToken')).toBe('test-csrf-token');
	});

	it('returns the raw response without parsing it', async () => {
		const raw_response = { ok: true, status: 204 };
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(raw_response);

		const result = await post('/api/x/');

		expect(result).toBe(raw_response);
	});

	it('sends an empty CSRF header when no token is available', async () => {
		getCSRFToken.mockReturnValue(null);
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

		await post('/api/x/');

		const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect((init.headers as Headers).get('X-CSRFToken')).toBe('');
	});
});
