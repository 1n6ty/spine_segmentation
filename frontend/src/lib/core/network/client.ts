import { getCSRFToken } from './csrf';

function with_csrf(headers?: HeadersInit): Headers {
	const merged = new Headers(headers);
	merged.set('X-CSRFToken', getCSRFToken() ?? '');
	return merged;
}

/**
 * Returns the raw `Response` for a GET request. No CSRF header: Django only
 * enforces CSRF on unsafe methods.
 */
export async function get(path: string): Promise<Response> {
	return fetch(path);
}

/** Always expects a JSON response body; throws on non-2xx. */
export async function post_json<T>(path: string, payload: unknown): Promise<T> {
	const res = await fetch(path, {
		method: 'POST',
		headers: with_csrf({ 'Content-Type': 'application/json' }),
		body: JSON.stringify(payload)
	});
	if (!res.ok) throw new Error(`POST ${path} failed with ${res.status}`);
	return res.json() as Promise<T>;
}

/**
 * Returns the raw `Response` — for callers that only check `.ok` or ignore
 * the response entirely (login, logout, DICOM upload).
 */
export async function post(
	path: string,
	init?: { json?: unknown; form?: FormData }
): Promise<Response> {
	const is_json = init?.json !== undefined;
	return fetch(path, {
		method: 'POST',
		headers: with_csrf(is_json ? { 'Content-Type': 'application/json' } : undefined),
		body: is_json ? JSON.stringify(init!.json) : init?.form
	});
}
