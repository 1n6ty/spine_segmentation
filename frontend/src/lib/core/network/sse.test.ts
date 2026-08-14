import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stream_sse, SseHttpError } from './sse';

function stream_from_chunks(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let i = 0;
	return new ReadableStream({
		pull(controller) {
			if (i >= chunks.length) {
				controller.close();
				return;
			}
			controller.enqueue(encoder.encode(chunks[i]));
			i++;
		}
	});
}

function mock_response(chunks: string[], ok = true, status = 200) {
	return { ok, status, body: stream_from_chunks(chunks) };
}

beforeEach(() => {
	global.fetch = vi.fn();
});

describe('stream_sse', () => {
	it('parses multiple frames delivered in a single chunk', async () => {
		const body =
			`data: {"data":{"status":"processing"}}\n\n` + `data: {"data":{"status":"done"}}\n\n`;
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mock_response([body]));

		const received: unknown[] = [];
		for await (const event of stream_sse<{ status: string }>('/x')) received.push(event);

		expect(received).toEqual([{ status: 'processing' }, { status: 'done' }]);
	});

	it('parses a frame split across multiple chunks', async () => {
		const full = `data: {"data":{"status":"done"}}\n\n`;
		const split_at = 20;
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
			mock_response([full.slice(0, split_at), full.slice(split_at)])
		);

		const received: unknown[] = [];
		for await (const event of stream_sse<{ status: string }>('/x')) received.push(event);

		expect(received).toEqual([{ status: 'done' }]);
	});

	it('throws an SseHttpError carrying the status when the response is not ok', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mock_response([], false, 401));

		let caught: unknown;
		try {
			for await (const event of stream_sse('/x')) void event;
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(SseHttpError);
		expect((caught as SseHttpError).status).toBe(401);
	});

	it('skips frames with no data: line (e.g. keep-alive comments)', async () => {
		const body = `: keep-alive\n\n` + `data: {"data":{"status":"done"}}\n\n`;
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mock_response([body]));

		const received: unknown[] = [];
		for await (const event of stream_sse<{ status: string }>('/x')) received.push(event);

		expect(received).toEqual([{ status: 'done' }]);
	});

	it('forwards the abort signal to fetch', async () => {
		(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mock_response([]));
		const controller = new AbortController();

		const received: unknown[] = [];
		for await (const event of stream_sse('/x', { signal: controller.signal })) received.push(event);

		expect(global.fetch).toHaveBeenCalledWith('/x', { signal: controller.signal });
	});
});
