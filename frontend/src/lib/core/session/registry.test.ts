import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDB } from 'idb';

vi.mock('$lib/core/storage/file-cache', () => ({ FileCache: { delete: vi.fn() } }));

import { RegistryService } from './registry.svelte';
import { FileCache } from '$lib/core/storage/file-cache';

let db_counter = 0;
function fresh_db_name() {
	return `test-db-${db_counter++}`;
}

function build_session(session_uid: string, last_accessed: number, account_id: string | null = null) {
	return {
		sessionUID: session_uid,
		accountId: account_id,
		thumbnail: null,
		brief: { patientName: null, patientBirthdate: null, patientUID: null },
		projections: {
			side: { hash: `${session_uid}-side-hash`, polygons: [] },
			frontal: { hash: `${session_uid}-frontal-hash`, polygons: [] }
		},
		lastAccessed: last_accessed
	};
}

async function wait_ready(registry: RegistryService) {
	await vi.waitFor(() => expect(registry.ready).toBe(true));
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('RegistryService', () => {
	it('starts not-ready and becomes ready once initial load completes', async () => {
		const registry = new RegistryService(fresh_db_name(), 1, 1000);
		await wait_ready(registry);
		expect(registry.sessionValues).toEqual({});
	});

	it('upsert adds a session to sessionValues and persists it', async () => {
		const registry = new RegistryService(fresh_db_name(), 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);

		await registry.upsert(build_session('s1', Date.now()));

		expect(registry.sessionValues['s1']).toBeDefined();
		expect(registry.sessionValues['s1'].sessionUID).toBe('s1');
	});

	it('upsert on an existing session merges fields, dropping nulls from the incoming patch', async () => {
		const registry = new RegistryService(fresh_db_name(), 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);

		await registry.upsert(build_session('s1', Date.now()));
		const original_thumbnail_field = registry.sessionValues['s1'].brief;

		// Partial patch with a null field — filterNulls should drop it, leaving
		// the existing `brief` from the first upsert untouched.
		await registry.upsert({ sessionUID: 's1', brief: null as any });

		expect(registry.sessionValues['s1'].brief).toEqual(original_thumbnail_field);
	});

	it('a fresh instance against the same db loads previously-upserted sessions', async () => {
		const db_name = fresh_db_name();
		const first = new RegistryService(db_name, 1, 1000 * 60 * 60 * 24);
		await wait_ready(first);
		await first.upsert(build_session('s1', Date.now()));

		const second = new RegistryService(db_name, 1, 1000 * 60 * 60 * 24);
		await wait_ready(second);

		expect(second.sessionValues['s1']).toBeDefined();
	});

	it('cleanupOldSessions (run on construction) removes sessions older than the ttl', async () => {
		const db_name = fresh_db_name();
		const ttl = 1000 * 60 * 60; // 1 hour

		// Seed the DB directly (bypassing upsert, which always bumps lastAccessed
		// to "now") so a genuinely old record exists for cleanup to find.
		const db = await openDB(db_name, 1, {
			upgrade(db) {
				const store = db.createObjectStore('sessions', { keyPath: 'sessionUID' });
				store.createIndex('by-last-accessed', 'lastAccessed');
			}
		});
		await db.put('sessions', build_session('old', Date.now() - ttl * 2));
		await db.put('sessions', build_session('fresh', Date.now()));
		db.close();

		const registry = new RegistryService(db_name, 1, ttl);
		await wait_ready(registry);

		expect(registry.sessionValues['old']).toBeUndefined();
		expect(registry.sessionValues['fresh']).toBeDefined();
	});

	it('logs (rather than throws) when initial load fails, e.g. opening at a lower version than already exists', async () => {
		const console_error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const db_name = fresh_db_name();

		const opened_at_v2 = new RegistryService(db_name, 2, 1000 * 60 * 60 * 24);
		await wait_ready(opened_at_v2);

		// Opening the same db at a lower version than it was already upgraded to
		// rejects inside idb's openDB — exercises the constructor's .catch path.
		const failing = new RegistryService(db_name, 1, 1000 * 60 * 60 * 24);
		await vi.waitFor(() => expect(console_error).toHaveBeenCalled());
		expect(failing.ready).toBe(false);

		console_error.mockRestore();
	});

	it('delete removes a session from sessionValues and deletes its cached files', async () => {
		const registry = new RegistryService(fresh_db_name(), 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);
		await registry.upsert(build_session('s1', Date.now()));

		await registry.delete('s1');

		expect(registry.sessionValues['s1']).toBeUndefined();
		expect(FileCache.delete).toHaveBeenCalledWith('s1-side-hash');
		expect(FileCache.delete).toHaveBeenCalledWith('s1-frontal-hash');
	});

	it('delete on a nonexistent session is a no-op', async () => {
		const registry = new RegistryService(fresh_db_name(), 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);

		await expect(registry.delete('nope')).resolves.toBeUndefined();
		expect(FileCache.delete).not.toHaveBeenCalled();
	});

	it('clearAll empties sessionValues and deletes every cached file', async () => {
		const registry = new RegistryService(fresh_db_name(), 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);
		await registry.upsert(build_session('s1', Date.now()));
		await registry.upsert(build_session('s2', Date.now()));

		await registry.clearAll();

		expect(registry.sessionValues).toEqual({});
		expect(FileCache.delete).toHaveBeenCalledTimes(4); // 2 sessions * (side + frontal)
	});

	it('sessionValues only exposes sessions belonging to the current account', async () => {
		const db_name = fresh_db_name();
		const db = await openDB(db_name, 1, {
			upgrade(db) {
				const store = db.createObjectStore('sessions', { keyPath: 'sessionUID' });
				store.createIndex('by-last-accessed', 'lastAccessed');
			}
		});
		await db.put('sessions', build_session('mine', Date.now(), 'acc-a'));
		await db.put('sessions', build_session('theirs', Date.now(), 'acc-b'));
		db.close();

		const registry = new RegistryService(db_name, 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);
		registry.setAccountId('acc-a');

		expect(registry.sessionValues['mine']).toBeDefined();
		expect(registry.sessionValues['theirs']).toBeUndefined();
	});

	it('switching accounts via setAccountId swaps the exposed view without re-reading the DB', async () => {
		const db_name = fresh_db_name();
		const db = await openDB(db_name, 1, {
			upgrade(db) {
				const store = db.createObjectStore('sessions', { keyPath: 'sessionUID' });
				store.createIndex('by-last-accessed', 'lastAccessed');
			}
		});
		await db.put('sessions', build_session('a-session', Date.now(), 'acc-a'));
		await db.put('sessions', build_session('b-session', Date.now(), 'acc-b'));
		db.close();

		const registry = new RegistryService(db_name, 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);

		registry.setAccountId('acc-a');
		expect(Object.keys(registry.sessionValues)).toEqual(['a-session']);

		registry.setAccountId('acc-b');
		expect(Object.keys(registry.sessionValues)).toEqual(['b-session']);
	});

	it('upsert stamps a new session with the currently active account', async () => {
		const registry = new RegistryService(fresh_db_name(), 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);
		registry.setAccountId('acc-a');

		await registry.upsert(build_session('s1', Date.now()));

		expect(registry.sessionValues['s1'].accountId).toBe('acc-a');
	});

	it('clearAll only removes the current account\'s sessions, leaving other accounts untouched', async () => {
		const registry = new RegistryService(fresh_db_name(), 1, 1000 * 60 * 60 * 24);
		await wait_ready(registry);

		registry.setAccountId('acc-a');
		await registry.upsert(build_session('a-session', Date.now()));

		registry.setAccountId('acc-b');
		await registry.upsert(build_session('b-session', Date.now()));

		await registry.clearAll();
		expect(registry.sessionValues).toEqual({});

		registry.setAccountId('acc-a');
		expect(registry.sessionValues['a-session']).toBeDefined();
	});
});
