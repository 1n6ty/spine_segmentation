import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SegmentationRefPoints } from '$lib/core/network/types';
import type { SegmentationEvent } from '$lib/core/network/segmentation-events';

const { stream_segmentation_events } = vi.hoisted(() => ({
	stream_segmentation_events: vi.fn()
}));
vi.mock('$lib/core/network/segmentation-events', () => ({ stream_segmentation_events }));

import { watchAutofillStatus } from './autofill';

async function* events_from(list: SegmentationEvent[]) {
	for (const event of list) yield event;
}

function ref_points(): SegmentationRefPoints {
	return {
		vertebraes: [
			{
				name: 'S1',
				points: [
					[70, 460],
					[70, 400],
					[130, 400],
					[130, 460]
				]
			},
			{
				name: 'L5',
				points: [
					[70, 390],
					[70, 330],
					[130, 330],
					[130, 390]
				]
			}
		]
	};
}

beforeEach(() => {
	stream_segmentation_events.mockReset();
});

describe('watchAutofillStatus success', () => {
	it("resolves via the segmentation stream's done event, without uploading anything", async () => {
		// watchAutofillStatus only watches -- the upload already happened
		// elsewhere (SessionService.uploadFile), so no /api/dcm/parse/ call here.
		stream_segmentation_events.mockReturnValue(
			events_from([
				{ status: 'segmentation.processing', ref_points: null },
				{ status: 'saving', ref_points: null },
				{ status: 'done', ref_points: ref_points() }
			])
		);

		const statuses: string[] = [];
		const polygons = await watchAutofillStatus('1.2.3', (s) => statuses.push(s));

		expect(stream_segmentation_events).toHaveBeenCalledWith('1.2.3');
		expect(statuses).toEqual(['segmentation.processing', 'saving', 'done']);
		expect(polygons).toHaveLength(2);
	});

	it('reflects an already-terminal status immediately (self-hydration), no reconnect needed', async () => {
		stream_segmentation_events.mockReturnValue(
			events_from([{ status: 'done', ref_points: ref_points() }])
		);

		const statuses: string[] = [];
		await watchAutofillStatus('1.2.3', (s) => statuses.push(s));

		expect(statuses).toEqual(['done']);
	});
});

describe('watchAutofillStatus failure paths', () => {
	it('rejects when the stream reports an error status', async () => {
		stream_segmentation_events.mockReturnValue(
			events_from([
				{ status: 'segmentation.processing', ref_points: null },
				{ status: 'error', ref_points: null }
			])
		);

		await expect(watchAutofillStatus('1.2.3', () => {})).rejects.toThrow();
	});

	it('rejects when the stream ends without a done or error event', async () => {
		stream_segmentation_events.mockReturnValue(events_from([{ status: 'saving', ref_points: null }]));

		await expect(watchAutofillStatus('1.2.3', () => {})).rejects.toThrow();
	});
});

describe('watchAutofillStatus point-order safety net', () => {
	it("normalizes to the same canonical point order regardless of the backend's raw point order", async () => {
		const base_vertebraes = [
			{
				name: 'raw-s1',
				points: [
					[70, 460],
					[70, 400],
					[130, 400],
					[130, 460]
				] as [number, number][]
			},
			{
				name: 'raw-l5',
				points: [
					[70, 390],
					[70, 330],
					[130, 330],
					[130, 390]
				] as [number, number][]
			}
		];

		function cyclic_shift(points: [number, number][], n: number): [number, number][] {
			return points.map((_, i) => points[(i + n) % points.length]);
		}

		async function run_with_shift(shift: number) {
			const shifted_ref_points: SegmentationRefPoints = {
				vertebraes: base_vertebraes.map((v) => ({
					name: v.name,
					points: cyclic_shift(v.points, shift)
				}))
			};
			stream_segmentation_events.mockReturnValue(
				events_from([{ status: 'done', ref_points: shifted_ref_points }])
			);
			return watchAutofillStatus('1.2.3', () => {});
		}

		const unshifted = await run_with_shift(0);
		const shifted = await run_with_shift(2);

		expect(shifted.map((p) => p.points)).toEqual(unshifted.map((p) => p.points));
	});
});
