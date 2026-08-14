import { describe, it, expect, vi, beforeEach } from 'vitest';
import { make_file_cache } from './file-cache';

// Minimal in-memory CacheStorage/Cache polyfill — Node has no global `caches`.
function install_fake_caches() {
	const stores = new Map<string, Map<string, Response>>();

	const fake_caches = {
		async open(name: string) {
			if (!stores.has(name)) stores.set(name, new Map());
			const store = stores.get(name)!;
			return {
				async match(url: string) {
					return store.get(url);
				},
				async put(url: string, response: Response) {
					store.set(url, response);
				},
				async delete(url: string) {
					return store.delete(url);
				}
			};
		}
	};

	vi.stubGlobal('caches', fake_caches);
}

beforeEach(() => {
	install_fake_caches();
});

describe('FileCache', () => {
	it('saves a file and returns its content hash', async () => {
		const cache = make_file_cache('test-cache-1');
		const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

		const hash = await cache.save(file);

		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('loads a previously saved file back with the same name and content', async () => {
		const cache = make_file_cache('test-cache-2');
		const file = new File(['hello world'], 'greeting.txt', { type: 'text/plain' });

		const hash = await cache.save(file);
		const loaded = await cache.load(hash);

		expect(loaded).not.toBeNull();
		expect(loaded!.name).toBe('greeting.txt');
		expect(await loaded!.text()).toBe('hello world');
	});

	it('returns null when loading a hash that was never saved', async () => {
		const cache = make_file_cache('test-cache-3');
		expect(await cache.load('nonexistent-hash')).toBeNull();
	});

	it('deletes a saved file', async () => {
		const cache = make_file_cache('test-cache-4');
		const file = new File(['x'], 'x.txt');
		const hash = await cache.save(file);

		expect(await cache.delete(hash)).toBe(true);
		expect(await cache.load(hash)).toBeNull();
	});

	it("falls back to the name 'file' when the original filename was empty", async () => {
		const cache = make_file_cache('test-cache-6');
		const file = new File(['content'], '');

		const hash = await cache.save(file);
		const loaded = await cache.load(hash);

		expect(loaded!.name).toBe('file');
	});

	it('does not re-write an already-cached file (deduplication)', async () => {
		const cache = make_file_cache('test-cache-5');
		const file = new File(['dedup'], 'a.txt');

		const hash1 = await cache.save(file);
		const hash2 = await cache.save(file);

		expect(hash1).toBe(hash2);
	});
});
