import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SessionValue } from "./types";
import { FileCache } from "$lib/features/dicom/cache";

interface DicomStorage extends DBSchema {
    sessions: {
        key: SessionValue['sessionUID'];
        value: SessionValue;
        indexes: { 'by-last-accessed': number };
    };
};

class RegistryService {

  ready = $state<boolean>(false);

  sessionValues = $state<Record<string, SessionValue>>({});

  db_name: string;
  db_version: number;
  ttl: number

  constructor(db_name: string, db_version: number, ttl: number) {
    this.db_name = db_name;
    this.db_version = db_version;
    this.ttl = ttl;
    
    this.cleanupOldSessions().then(() => {
      this.getRecentSessions().then((sessions) => {
        let buf: Record<string, SessionValue> = {};
        sessions.forEach((v) => {
          buf[v.sessionUID] = v;
        });
        this.sessionValues = buf;
        this.ready = true;
      })
    }).catch(err => {
      console.error("RegistryService: Failed to clean up old sessions", err);
    });
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
      },
    });
  }

  // Helper to remove null/undefined while keeping types intact
  private filterNulls<T>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj as any).filter(([_, v]) => v != null)
    ) as Partial<T>;
  }

  async upsert(
    data: Partial<DicomStorage['sessions']['value']> & { sessionUID: string }
  ) {
    const db = await this.initDB();

    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');

    const existing = await store.get(data.sessionUID);
    const now = Date.now();

    // Merge logic
    const updated = existing
      ? { ...existing, ...this.filterNulls(data), lastAccessed: now }
      : { ...data, lastAccessed: now };

    this.sessionValues[data.sessionUID] = updated as SessionValue;

    await store.put(updated as SessionValue);
    await tx.done;
  }

  async delete(sessionUID: string): Promise<void> {
    // 1. Check if it exists first to avoid undefined errors
    if (!this.sessionValues[sessionUID]) return;

    // 2. Remove from local state FIRST (Reactive update)
    // Using a temporary variable and reassignment can be cleaner for Svelte's proxy
    const newValues = { ...this.sessionValues };
    const hashes = [ this.sessionValues[sessionUID].projections.side.hash, this.sessionValues[sessionUID].projections.frontal.hash ];
    delete newValues[sessionUID];
    this.sessionValues = newValues;

    // 3. Then handle the DB
    const db = await this.initDB();
    await db.delete('sessions', sessionUID);

    // 4. Delete from FileCache
    hashes.forEach(h => {
      FileCache.delete(h);
    })
  }

  async clearAll(): Promise<void> {
    const sideHashes = Object.values(this.sessionValues).map(sv => {
      return sv.projections.side.hash;
    });
    const frontalHashes = Object.values(this.sessionValues).map(sv => {
      return sv.projections.frontal.hash;
    });

    // 1. Clear reactive state
    this.sessionValues = {};

    // 2. Clear IndexedDB store
    const db = await this.initDB();
    const tx = db.transaction('sessions', 'readwrite');
    await tx.objectStore('sessions').clear();
    await tx.done;

    sideHashes.forEach(h => {
      FileCache.delete(h);
    });
    frontalHashes.forEach(h => {
      FileCache.delete(h);
    })
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
  };
}

const DB_NAME = "DicomDB";
const DB_VERSION = 1;
const TTL = 24 * 60 * 60 * 1000;

export const registry = new RegistryService(DB_NAME, DB_VERSION, TTL);