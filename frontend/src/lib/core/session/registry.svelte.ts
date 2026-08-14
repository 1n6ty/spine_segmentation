import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SessionValue } from './types';
import { FileCache } from '$lib/core/storage/file-cache';

interface DicomStorage extends DBSchema {
	sessions: {
		key: SessionValue['sessionUID'];
		value: SessionValue;
		indexes: { 'by-last-accessed': number };
	};
}

export class RegistryService {
	ready = $state<boolean>(false);

	// The currently locally-authenticated account, set by the auth service
	// once the backend confirms a live session. Sessions belonging to any
	// other account are loaded from IndexedDB (for TTL cleanup) but never
	// exposed through `sessionValues`.
	accountId = $state<string | null>(null);

	private allSessions = $state<Record<string, SessionValue>>({});

	sessionValues = $derived(
		Object.fromEntries(
			Object.entries(this.allSessions).filter(([, v]) => v.accountId === this.accountId)
		)
	);

	db_name: string;
	db_version: number;
	ttl: number;

	constructor(db_name: string, db_version: number, ttl: number) {
		this.db_name = db_name;
		this.db_version = db_version;
		this.ttl = ttl;

		this.cleanupOldSessions()
			.then(() => {
				this.getRecentSessions().then((sessions) => {
					let buf: Record<string, SessionValue> = {};
					sessions.forEach((v) => {
						buf[v.sessionUID] = v;
					});
					this.allSessions = buf;
					this.ready = true;
				});
			})
			.catch((err) => {
				console.error('RegistryService: Failed to clean up old sessions', err);
			});
	}

	// Called by the auth service once login/logout/account-switch is known.
	// `sessionValues` recomputes automatically since it's derived from
	// `accountId` + the already-loaded `allSessions`.
	setAccountId(accountId: string | null): void {
		this.accountId = accountId;
	}

	// Deletes all sessions where lastAccessed is older than 7 days
	private async cleanupOldSessions(): Promise<void> {
		const db = await this.initDB();
		const tx = db.transaction('sessions', 'readwrite');
		const store = tx.objectStore('sessions');
		const index = store.index('by-last-accessed');

		const cutoffTimestamp = Date.now() - this.ttl;

		// Get a cursor for everything older than the cutoff timestamp
		let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoffTimestamp));

		while (cursor) {
			await cursor.delete();
			cursor = await cursor.continue();
		}

		await tx.done;
	}

	async initDB(): Promise<IDBPDatabase<DicomStorage>> {
		return openDB<DicomStorage>(this.db_name, this.db_version, {
			upgrade(db) {
				const sessionsStore = db.createObjectStore('sessions', { keyPath: 'sessionUID' });
				sessionsStore.createIndex('by-last-accessed', 'lastAccessed');
			}
		});
	}

	// Helper to remove null/undefined while keeping types intact
	private filterNulls<T>(obj: T): Partial<T> {
		return Object.fromEntries(
			Object.entries(obj as any).filter(([_, v]) => v != null)
		) as Partial<T>;
	}

	async upsert(data: Partial<DicomStorage['sessions']['value']> & { sessionUID: string }) {
		const db = await this.initDB();

		const tx = db.transaction('sessions', 'readwrite');
		const store = tx.objectStore('sessions');

		const existing = await store.get(data.sessionUID);
		const now = Date.now();

		// Merge logic. `data.accountId` wins if a caller explicitly passes one
		// (e.g. a direct account-scoped write); otherwise new records are
		// stamped with whichever account is currently active.
		const updated = existing
			? { ...existing, ...this.filterNulls(data), lastAccessed: now }
			: { ...data, accountId: data.accountId ?? this.accountId, lastAccessed: now };

		this.allSessions[data.sessionUID] = updated as SessionValue;

		await store.put(updated as SessionValue);
		await tx.done;
	}

	async delete(sessionUID: string): Promise<void> {
		// 1. Check if it exists first to avoid undefined errors
		if (!this.allSessions[sessionUID]) return;

		// 2. Remove from local state FIRST (Reactive update)
		// Using a temporary variable and reassignment can be cleaner for Svelte's proxy
		const newValues = { ...this.allSessions };
		const hashes = [
			this.allSessions[sessionUID].projections.side.hash,
			this.allSessions[sessionUID].projections.frontal.hash
		];
		delete newValues[sessionUID];
		this.allSessions = newValues;

		// 3. Then handle the DB
		const db = await this.initDB();
		await db.delete('sessions', sessionUID);

		// 4. Delete from FileCache
		hashes.forEach((h) => {
			FileCache.delete(h);
		});
	}

	// Scoped to the current account only — other accounts' locally-cached
	// sessions are left untouched.
	async clearAll(): Promise<void> {
		const mine = Object.values(this.sessionValues);

		const db = await this.initDB();
		const tx = db.transaction('sessions', 'readwrite');
		const store = tx.objectStore('sessions');
		await Promise.all(mine.map((sv) => store.delete(sv.sessionUID)));
		await tx.done;

		const newAll = { ...this.allSessions };
		mine.forEach((sv) => {
			delete newAll[sv.sessionUID];
		});
		this.allSessions = newAll;

		mine.forEach((sv) => {
			FileCache.delete(sv.projections.side.hash);
			FileCache.delete(sv.projections.frontal.hash);
		});
	}

	private async getRecentSessions(): Promise<DicomStorage['sessions']['value'][]> {
		const db = await this.initDB();
		const tx = db.transaction('sessions', 'readonly');

		const store = tx.objectStore('sessions');
		const index = store.index('by-last-accessed');

		let cursor = await index.openCursor(null, 'prev');

		const results: DicomStorage['sessions']['value'][] = [];

		while (cursor) {
			results.push(cursor.value);
			cursor = await cursor.continue();
		}

		return results;
	}
}

const DB_NAME = 'DicomDB';
const DB_VERSION = 1;
const TTL = 24 * 60 * 60 * 1000;

export const registry = new RegistryService(DB_NAME, DB_VERSION, TTL);
