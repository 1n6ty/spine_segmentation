import type { DicomImagePixelData } from "$lib/stores/dicom/dicom.type";

const CACHE_NAME = 'dicom-pixels-v1';

const PixelCache = {
  /**
   * Save just the raw array buffer to the Cache API.
   * Path: /patient/{id}/study/{id}/series/{id}/{sop}
   */
  async save(sopInstanceUID: string, data: DicomImagePixelData) {
    if (!data) return;

    const cache = await caches.open(CACHE_NAME);
    const url = `/dicom/${sopInstanceUID}.bin`;
    
    // Convert ArrayBuffer to Blob for Cache Storage
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const response = new Response(blob);
    
    await cache.put(url, response);
  },

  /**
   * Load the array buffer from the Cache API.
   */
  async load(sopInstanceUID: string, isSigned: boolean): Promise<DicomImagePixelData | null> {
    const cache = await caches.open(CACHE_NAME);
    const url = `/dicom/${sopInstanceUID}.bin`;
    
    const response = await cache.match(url);
    if (!response) return null;

    const buffer = await response.arrayBuffer();
    
    return isSigned ? new Int16Array(buffer) : new Uint16Array(buffer);
  },

  /**
   * Clear an image from the cache (for LRU logic)
   */
  async clear(sopInstanceUID: string) {
    const cache = await caches.open(CACHE_NAME);
    const url = `/dicom/${sopInstanceUID}.bin`;
    await cache.delete(url);
  }
}

export { PixelCache };