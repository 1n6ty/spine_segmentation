type SseEnvelope<T> = {
	data: T;
};

/** Thrown when the initial SSE request itself fails (before any stream opens) —
 * carries `status` so callers (e.g. the reconnect loop in segmentation-events.ts)
 * can tell a non-retryable auth failure (401) apart from a transient one. */
export class SseHttpError extends Error {
	constructor(
		public readonly status: number,
		url: string
	) {
		super(`SSE request to ${url} failed with ${status}`);
		this.name = 'SseHttpError';
	}
}

/**
 * Reads a `text/event-stream` response as an async generator of parsed `data:`
 * payloads. Each backend frame is a single standalone JSON object wrapped in
 * the app's `ApiResponse` envelope (`{ data: T, ... }`) — this yields the
 * unwrapped `T`, not the raw SSE frame.
 */
export async function* stream_sse<T>(
	url: string,
	options?: { signal?: AbortSignal }
): AsyncGenerator<T> {
	const res = await fetch(url, { signal: options?.signal });
	if (!res.ok || !res.body) {
		throw new SseHttpError(res.status, url);
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) return;

			buffer += decoder.decode(value, { stream: true });

			let separator_index: number;
			while ((separator_index = buffer.indexOf('\n\n')) !== -1) {
				const frame = buffer.slice(0, separator_index);
				buffer = buffer.slice(separator_index + 2);

				const payload = frame
					.split('\n')
					.filter((line) => line.startsWith('data:'))
					.map((line) => line.slice('data:'.length).trimStart())
					.join('\n');

				if (!payload) continue;

				const envelope: SseEnvelope<T> = JSON.parse(payload);
				yield envelope.data;
			}
		}
	} finally {
		reader.releaseLock();
	}
}
