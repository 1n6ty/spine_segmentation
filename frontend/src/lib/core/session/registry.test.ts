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

function page_response(rows: ReturnType<typeof ref_row>[], meta: Record<string, unknown> = {}) {
	return {
		ok: true,
		json: async () => ({
			data: {
				recent_studies: rows,
				meta: {
					total_items: rows.length,
					total_pages: 1,
					current_page: 1,
					page_size: 12,
					next: null,
					previous: null,
					...meta
				}
			}
		})
	};
}

function mock_list(rows: ReturnType<typeof ref_row>[], meta?: Record<string, unknown>) {
	get.mockResolvedValue(page_response(rows, meta));
}

beforeEach(() => {
	get.mockReset();
	del.mockReset();
	get.mockResolvedValue({ ok: false });
	del.mockResolvedValue({ ok: true });
	registry.sessionValues = {};
	registry.localThumbnails = {};
	registry.order = [];
	registry.totalItems = 0;
	registry.loadedPages = 0;
	registry.loading = false;
});

/** A `get` mock whose resolution is held until the returned `resolve` is
 * called -- lets a test inspect state while a fetch is still "in flight". */
function deferred_list(rows: ReturnType<typeof ref_row>[], meta?: Record<string, unknown>) {
	let release!: () => void;
	const gate = new Promise<void>((r) => (release = r));
	get.mockImplementationOnce(async () => {
		await gate;
		return page_response(rows, meta);
	});
	return release;
}

describe('registry.refresh', () => {
	it('loads page 1 and populates sessionValues + order, converting field shapes', async () => {
		mock_list(
			[
				ref_row(1, {
					patient_name: 'Jane Doe',
					patient_birth_date: '19900115',
					patient_uid: 'PID1',
					thumbnail: 'data:image/jpeg;base64,abc',
					side_present: true,
					frontal_present: false
				})
			],
			{ total_items: 1, current_page: 1 }
		);

		await registry.refresh();

		expect(get).toHaveBeenCalledWith('/api/dcm/recent-studies/?page=1&page_size=12');
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
		expect(registry.order).toEqual(['1']);
		expect(registry.totalItems).toBe(1);
		expect(registry.hasMore).toBe(false);
		expect(registry.ready).toBe(true);
	});

	it('preserves server order in `order`', async () => {
		mock_list([ref_row(3), ref_row(1), ref_row(2)], { total_items: 3 });

		await registry.refresh();

		expect(registry.order).toEqual(['3', '1', '2']);
	});

	it('replaces `order` with page 1 rather than appending to it', async () => {
		mock_list([ref_row(1), ref_row(2)], { total_items: 2 });
		await registry.refresh();
		expect(registry.order).toEqual(['1', '2']);

		mock_list([ref_row(3), ref_row(1)], { total_items: 2 });
		await registry.refresh();

		expect(registry.order).toEqual(['3', '1']);
	});

	it('keeps the currently-loaded list on screen while a refresh is in flight', async () => {
		mock_list([ref_row(1), ref_row(2)], { total_items: 2 });
		await registry.refresh();
		expect(registry.order).toEqual(['1', '2']);

		// Second refresh whose response is held open.
		const release = deferred_list([ref_row(9)], { total_items: 1 });
		const pending = registry.refresh();

		// Mid-flight: old cards still there, nothing blanked, loading flagged.
		expect(registry.order).toEqual(['1', '2']);
		expect(registry.totalItems).toBe(2);
		expect(registry.loading).toBe(true);

		release();
		await pending;

		expect(registry.order).toEqual(['9']);
		expect(registry.loading).toBe(false);
	});

	it('clears the list on a non-ok first page (e.g. unauthenticated)', async () => {
		mock_list([ref_row(1)], { total_items: 1 });
		await registry.refresh();
		expect(registry.order).toHaveLength(1);

		get.mockResolvedValue({ ok: false });
		await registry.refresh();

		expect(registry.sessionValues).toEqual({});
		expect(registry.order).toEqual([]);
		expect(registry.totalItems).toBe(0);
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

describe('registry.loadMore', () => {
	it('appends the next page to order without duplicating', async () => {
		get.mockResolvedValueOnce(
			page_response([ref_row(1), ref_row(2), ref_row(3)], {
				total_items: 5,
				current_page: 1,
				next: '/api/dcm/recent-studies/?page=2&page_size=12'
			})
		);
		await registry.refresh();
		expect(registry.order).toEqual(['1', '2', '3']);
		expect(registry.hasMore).toBe(true);

		get.mockResolvedValueOnce(
			page_response([ref_row(3), ref_row(4), ref_row(5)], {
				total_items: 5,
				current_page: 2,
				next: null
			})
		);
		await registry.loadMore();

		expect(get).toHaveBeenLastCalledWith('/api/dcm/recent-studies/?page=2&page_size=12');
		expect(registry.order).toEqual(['1', '2', '3', '4', '5']);
		expect(registry.hasMore).toBe(false);
	});

	it('is a no-op once every row is loaded', async () => {
		mock_list([ref_row(1), ref_row(2)], { total_items: 2 });
		await registry.refresh();
		get.mockClear();

		await registry.loadMore();

		expect(get).not.toHaveBeenCalled();
	});
});

describe('registry.clear', () => {
	it('empties sessionValues + order locally without calling the backend', async () => {
		mock_list([ref_row(1)], { total_items: 1 });
		await registry.refresh();
		del.mockClear();

		registry.clear();

		expect(registry.sessionValues).toEqual({});
		expect(registry.order).toEqual([]);
		expect(registry.totalItems).toBe(0);
		expect(del).not.toHaveBeenCalled();
	});
});

describe('registry.delete', () => {
	it('removes the session locally (list + order + count) and deletes it on the backend', async () => {
		mock_list([ref_row(1), ref_row(2)], { total_items: 2 });
		await registry.refresh();

		await registry.delete('1');

		expect(registry.sessionValues['1']).toBeUndefined();
		expect(registry.order).toEqual(['2']);
		expect(registry.totalItems).toBe(1);
		expect(del).toHaveBeenCalledWith('/api/dcm/recent-studies/1/');
	});

	it('is a no-op (no backend call) for a session not locally known', async () => {
		await registry.delete('does-not-exist');

		expect(del).not.toHaveBeenCalled();
	});
});

describe('registry.clearAll', () => {
	it('empties sessionValues + order and calls the bulk-delete endpoint', async () => {
		mock_list([ref_row(1), ref_row(2)], { total_items: 2 });
		await registry.refresh();

		await registry.clearAll();

		expect(registry.sessionValues).toEqual({});
		expect(registry.order).toEqual([]);
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
		mock_list([ref_row(1, { thumbnail: 'data:image/jpeg;base64,server' })], { total_items: 1 });

		await registry.refresh();

		expect(registry.localThumbnails['1']).toBeUndefined();
	});

	it('refresh() keeps a local override for a row whose server thumbnail is still null', async () => {
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local');
		mock_list([ref_row(1, { thumbnail: null })], { total_items: 1 });

		await registry.refresh();

		expect(registry.localThumbnails['1']).toBe('data:image/jpeg;base64,local');
	});

	it('clear() drops local overrides too', async () => {
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local');

		registry.clear();

		expect(registry.localThumbnails).toEqual({});
	});

	it("delete() drops the deleted session's local override too", async () => {
		mock_list([ref_row(1)], { total_items: 1 });
		await registry.refresh();
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local');

		await registry.delete('1');

		expect(registry.localThumbnails['1']).toBeUndefined();
	});

	it('clearAll() drops all local overrides too', async () => {
		mock_list([ref_row(1), ref_row(2)], { total_items: 2 });
		await registry.refresh();
		registry.setLocalThumbnail('1', 'data:image/jpeg;base64,local-1');
		registry.setLocalThumbnail('2', 'data:image/jpeg;base64,local-2');

		await registry.clearAll();

		expect(registry.localThumbnails).toEqual({});
	});
});
