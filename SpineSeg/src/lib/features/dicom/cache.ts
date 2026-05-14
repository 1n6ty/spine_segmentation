import { generateHash } from "$lib/shared/utils/file";

const CACHE_NAME = 'dicom-storage-v1';

const FileCache = {
  /**
   * Generates a SHA-256 hash of the file content to use as the ID.
   * If the file exists, it returns the existing hash without re-writing.
   */
  async save(file: File): Promise<string> {
    // 1. Generate Hash from File Content
    const hash = await generateHash(file);
    const url = `/files/${hash}`;

    const cache = await caches.open(CACHE_NAME);
    
    // 2. Check for existence (Deduplication)
    const existing = await cache.match(url);
    if (existing) {
      return hash; // Return the hash, but don't waste time writing
    }

    // 3. Store the file
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
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(`/files/${hash}`);
    if (!response) return null;

    const blob = await response.blob();
    const fileName = response.headers.get('X-File-Name') || 'file';
    return new File([blob], fileName, { type: blob.type });
  },

  async delete(hash: string): Promise<boolean> {
    const cache = await caches.open(CACHE_NAME);
    return await cache.delete(`/files/${hash}`);
  }
}

export { FileCache };