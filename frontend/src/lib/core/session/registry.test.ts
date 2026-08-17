import { describe, it, expect, vi, beforeEach } from 'vitest';

const { get, del } = vi.hoisted(() => ({
	// Sane default so the eager, constructor-time refresh() (fired the moment
	// this module is first imported below) doesn't crash on an unconfigured mock.
	get: vi.fn().mockResolvedValue({ ok: false }),
	del: vi.fn().mockResolvedValue({ ok: true })
}));
vi.mock('$lib/core/network/client', () => ({ get, del }));

import { registry } from './registry.svelte';

function ref_row(id: number, overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id,
		patient_name: null,
		patient_birth_date: null,
		patient_uid: null,
		thumbnail: null,
		side_present: false,
		frontal_present: false,
		last_accessed: '2026-01-01T00:00:00Z',
		...overrides
	};
}

function mock_list(rows: ReturnType<typeof ref_row>[]) {
	get.mockResolvedValue({ ok: true, json: async () => ({ data: { recent_studies: rows } }) });
}

beforeEach(() => {
	get.mockReset();
	del.mockReset();
	get.mockResolvedValue({ ok: false });
	del.mockResolvedValue({ ok: true });
	registry.sessionValues = {};
	registry.localThumbnails = {};
});

describe('registry.refresh', () => {
	it('populates sessionValues from the list endpoint, converting field shapes', async () => {
		mock_list([
			ref_row(1, {
				patient_name: 'Jane Doe',
				patient_birth_date: '19900115',
				patient_uid: 'PID1',
				thumbnail: 'data:image/jpeg;base64,abc',
				side_present: true,
				frontal_present: false
			})
		]);

		await registry.refresh();

		expect(get).toHaveBeenCalledWith('/api/dcm/recent-studies/?page_size=100');
		const value = registry.sessionValues['1'];
		expect(value).toBeDefined();
		expect(value.sessionUID).toBe('1');
		expect(value.thumbnail).toBe('data:image/jpeg;base64,abc');
		expect(value.brief).toEqual({
			patientName: 'Jane Doe',
			patientBirthdate: new Date(1990, 0, 15),
			patientUID: 'PID1'
		});
		expect(value.sidePresent).toBe(true);
		expect(value.frontalPresent).toBe(false);
		expect(value.lastAccessed).toBe(new Date('2026-01-01T00:00:00Z').getTime());
		expect(registry.ready).toBe(true);
	});

	it('clears sessionValues on a non-ok response (e.g. unauthenticated)', async () => {
		mock_list([ref_row(1)]);
		await registry.refresh();
		expect(Object.keys(registry.sessionValues)).toHaveLength(1);

		get.mockResolvedValue({ ok: false });
		await registry.refresh();

		expect(registry.sessionValues).toEqual({});
	});

	it('logs (rather than throws) on a network error, and still settles ready', async () => {
		const console_error = vi.spyOn(console, 'error').mockImplementation(() => {});
		get.mockRejectedValue(new Error('network down'));

		await registry.refresh();

		expect(console_error).toHaveBeenCalled();
		expect(registry.ready).toBe(true);
		console_error.mockRestore();
	});
});

describe('registry.clear', () => {
	it('empties sessionValues locally without calling the backend', async () => {
		mock_list([ref_row(1)]);
		await registry.refresh();
		del.mockClear();

		registry.clear();

		expect(registry.sessionValues).toEqual({});
		expect(del).not.toHaveBeenCalled();
	});
});

describe('registry.delete', () => {
	it('removes the session locally and deletes it on the backend', async () => {
		mock_list([ref_row(1)]);
		await registry.refresh();

		await registry.delete('1');

		expect(registry.sessionValues['1']).toBeUndefined();
		expect(del).toHaveBeenCalledWith('/api/dcm/recent-studies/1/');
	});

	it('is a no-op (no backend call) for a session not locally known', async () => {
		await registry.delete('does-not-exist');

		expect(del).not.toHaveBeenCalled();
	});
});

describe('registry.clearAll', () => {
	it('empties sessionValues and calls the bulk-delete endpoint', async () => {
		mock_list([ref_row(1), ref_row(2)]);
		await registry.refresh();

		await registry.clearAll();

		expect(registry.sessionValues).toEqual({});
		expect(del).toHaveBeenCalledWith('/api/dcm/recent-studies/clear-all/');
	});
});

describe('registry.localThumbnails', () => {
	it('setLocalThumbnail stores a purely-local preview, never sent to the backend', () => {
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local');

		expect(registry.localThumbnails['1']).toBe('data:image/jpeg;base64,local');
	});

	it('refresh() prunes a local override once the row has its own server thumbnail', async () => {
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local');
		mock_list([ref_row(1, { thumbnail: 'data:image/jpeg;base64,server' })]);

		await registry.refresh();

		expect(registry.localThumbnails['1']).toBeUndefined();
	});

	it('refresh() keeps a local override for a row whose server thumbnail is still null', async () => {
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local');
		mock_list([ref_row(1, { thumbnail: null })]);

		await registry.refresh();

		expect(registry.localThumbnails['1']).toBe('data:image/jpeg;base64,local');
	});

	it('clear() drops local overrides too', async () => {
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local');

		registry.clear();

		expect(registry.localThumbnails).toEqual({});
	});

	it('delete() drops the deleted session\'s local override too', async () => {
		mock_list([ref_row(1)]);
		await registry.refresh();
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local');

		await registry.delete('1');

		expect(registry.localThumbnails['1']).toBeUndefined();
	});

	it('clearAll() drops all local overrides too', async () => {
		mock_list([ref_row(1), ref_row(2)]);
		await registry.refresh();
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local-1');
		registry.setLocalThumbnail('2', 'data:image/jpeg;base64,local-2');

		await registry.clearAll();

		expect(registry.localThumbnails).toEqual({});
	});
});
