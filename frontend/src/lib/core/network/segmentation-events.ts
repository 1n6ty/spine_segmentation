import { stream_sse, SseHttpError } from './sse';
import type { SegmentationStatus, SegmentationRefPoints } from './types';

export type SegmentationEvent = {
	status: SegmentationStatus;
	ref_points: SegmentationRefPoints | null;
};

const TERMINAL_STATUSES: SegmentationStatus[] = ['done', 'error'];
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Streams segmentation status/result for a DICOM instance. The backend
 * self-hydrates on every connect (re-reads the current DB status first), so
 * an unexpected disconnect before a terminal event is safe to retry plainly —
 * no reconnect-with-backoff state machine needed, unlike a websocket.
 */
export async function* stream_segmentation_events(
	sop_instance_uid: string,
	options?: { signal?: AbortSignal }
): AsyncGenerator<SegmentationEvent> {
	const url = `/api/dcm/${encodeURIComponent(sop_instance_uid)}/segment/events/`;
	let attempt = 0;

	while (true) {
		try {
			for await (const event of stream_sse<SegmentationEvent>(url, options)) {
				yield event;
				if (TERMINAL_STATUSES.includes(event.status)) return;
			}
			// Stream closed without a terminal event — the server self-hydrates
			// current status on every connect, so retrying is safe.
		} catch (err) {
			if (options?.signal?.aborted) throw err;
			// 401 (session expired/never authenticated) can't be fixed by retrying
			// the same request -- fail fast instead of burning all 5 attempts.
			if (err instanceof SseHttpError && err.status === 401) throw err;
		}

		attempt++;
		if (attempt >= MAX_RECONNECT_ATTEMPTS) {
			throw new Error(
				`Segmentation event stream for ${sop_instance_uid} failed after ${MAX_RECONNECT_ATTEMPTS} attempts`
			);
		}
		await sleep(RECONNECT_DELAY_MS);
	}
}
