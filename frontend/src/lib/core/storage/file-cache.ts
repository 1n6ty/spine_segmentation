import { sha256_hex } from '$lib/shared/utils/hash';

const DEFAULT_CACHE_NAME = 'dicom-storage-v1';

export function make_file_cache(cache_name: string = DEFAULT_CACHE_NAME) {
	return {
		/**
		 * Generates a SHA-256 hash of the file content to use as the ID.
		 * If the file exists, it returns the existing hash without re-writing.
		 */
		async save(file: File): Promise<string> {
			const hash = await sha256_hex(file);
			const url = `/files/${hash}`;

			const cache = await caches.open(cache_name);

			// Check for existence (deduplication)
			const existing = await cache.match(url);
			if (existing) {
				return hash; // Return the hash, but don't waste time writing
			}

			const response = new Response(file, {
				headers: {
					'Content-Type': file.type,
					'X-File-Name': file.name
				}
			});

			await cache.put(url, response);
			return hash;
		},

		async load(hash: string): Promise<File | null> {
			const cache = await caches.open(cache_name);
			const response = await cache.match(`/files/${hash}`);
			if (!response) return null;

			const blob = await response.blob();
			const fileName = response.headers.get('X-File-Name') || 'file';
			return new File([blob], fileName, { type: blob.type });
		},

		async delete(hash: string): Promise<boolean> {
			const cache = await caches.open(cache_name);
			return await cache.delete(`/files/${hash}`);
		}
	};
}

export const FileCache = make_file_cache();
