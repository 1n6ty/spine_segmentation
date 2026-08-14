import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SegmentationEvent } from './segmentation-events';
import { SseHttpError } from './sse';

const { stream_sse } = vi.hoisted(() => ({ stream_sse: vi.fn() }));
vi.mock('./sse', async (importOriginal) => ({
	...(await importOriginal<typeof import('./sse')>()),
	stream_sse
}));

import { stream_segmentation_events } from './segmentation-events';

async function* gen_from(items: SegmentationEvent[]) {
	for (const item of items) yield item;
}

// eslint-disable-next-line require-yield -- intentionally throws before ever yielding, to simulate a stream failure
async function* gen_throw(err: Error): AsyncGenerator<SegmentationEvent> {
	throw err;
}

async function collect(uid: string, signal?: AbortSignal) {
	const received: SegmentationEvent[] = [];
	for await (const event of stream_segmentation_events(uid, { signal })) received.push(event);
	return received;
}

beforeEach(() => {
	stream_sse.mockReset();
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('stream_segmentation_events', () => {
	it('surfaces intermediate statuses and stops after a terminal done event', async () => {
		stream_sse.mockReturnValue(
			gen_from([
				{ status: 'segmentation.processing', ref_points: null },
				{ status: 'saving', ref_points: null },
				{ status: 'done', ref_points: { vertebraes: [] } }
			])
		);

		const received = await collect('uid-1');

		expect(received).toHaveLength(3);
		expect(received[2].status).toBe('done');
		expect(stream_sse).toHaveBeenCalledTimes(1);
	});

	it('stops immediately on a terminal error event', async () => {
		stream_sse.mockReturnValue(gen_from([{ status: 'error', ref_points: null }]));

		const received = await collect('uid-2');

		expect(received).toEqual([{ status: 'error', ref_points: null }]);
		expect(stream_sse).toHaveBeenCalledTimes(1);
	});

	it('retries after a transient stream failure and succeeds on reconnect', async () => {
		stream_sse
			.mockImplementationOnce(() => gen_throw(new Error('transient')))
			.mockImplementationOnce(() => gen_from([{ status: 'done', ref_points: { vertebraes: [] } }]));

		const promise = collect('uid-3');
		await vi.advanceTimersByTimeAsync(500);
		const received = await promise;

		expect(received).toHaveLength(1);
		expect(stream_sse).toHaveBeenCalledTimes(2);
	});

	it('gives up after the max reconnect attempts', async () => {
		stream_sse.mockImplementation(() => gen_throw(new Error('down')));

		const promise = collect('uid-4');
		const assertion = expect(promise).rejects.toThrow();
		await vi.advanceTimersByTimeAsync(500 * 5);
		await assertion;

		expect(stream_sse).toHaveBeenCalledTimes(5);
	});

	it('propagates immediately without retrying when the signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		stream_sse.mockImplementation(() => gen_throw(new Error('boom')));

		await expect(collect('uid-5', controller.signal)).rejects.toThrow('boom');
		expect(stream_sse).toHaveBeenCalledTimes(1);
	});

	it('fails fast on a 401 instead of retrying -- an expired/missing session is not transient', async () => {
		stream_sse.mockImplementation(() => gen_throw(new SseHttpError(401, '/x')));

		await expect(collect('uid-6')).rejects.toThrow(SseHttpError);
		expect(stream_sse).toHaveBeenCalledTimes(1);
	});
});
