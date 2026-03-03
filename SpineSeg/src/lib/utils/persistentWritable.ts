import { writable } from "svelte/store";

export function persistentCacheWritable<T>(key: string, initialValue: T) {
    const CACHE_NAME = "dicom-app-cache-v1";
    const REQUEST_URL = `https://local-app/${key}`;
    
    // Internal Svelte store
    const store = writable<T>(initialValue);
    const { subscribe, set, update } = store;

    let saveTimeout: number;

    // 1. ASYNC HYDRATION: Load from Cache without blocking
    if (typeof window !== "undefined") {
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                const response = await cache.match(REQUEST_URL);
                if (response) {
                    const data = await response.json();
                    set(data);
                }
            } catch (err) {
                console.error("Cache Load Error:", err);
            }
        })();
    }

    // 2. OPTIMIZED PERSISTENCE: Save using Blobs and Idle time
    async function persist(value: T) {
        if (typeof window === "undefined") return;

        // Use requestIdleCallback to ensure we don't drop frames (prevent green screen)
        const runSave = async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                
                // Convert to Blob: More memory efficient than JSON.stringify alone
                const blob = new Blob([JSON.stringify(value)], { type: 'application/json' });
                const response = new Response(blob);
                
                await cache.put(REQUEST_URL, response);
            } catch (err) {
                console.error("Cache Save Error:", err);
            }
        };

        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(() => runSave());
        } else {
            setTimeout(runSave, 1);
        }
    }

    // 3. DEBOUNCED SYNC: Don't hammer the disk on every single change
    function debouncedSave(value: T) {
        if (typeof window === "undefined") return;
        
        clearTimeout(saveTimeout);
        // Wait 500ms after the last change before writing to disk
        saveTimeout = window.setTimeout(() => {
            persist(value);
        }, 500);
    }

    return {
        subscribe,
        set: (value: T) => {
            set(value);
            debouncedSave(value);
        },
        update: (fn: (v: T) => T) => {
            update((oldValue) => {
                const newValue = fn(oldValue);
                debouncedSave(newValue);
                return newValue;
            });
        }
    };
}