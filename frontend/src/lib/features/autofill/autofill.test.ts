import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SegmentationRefPoints } from '$lib/core/network/types';
import type { SegmentationEvent } from '$lib/core/network/segmentation-events';

const { post, stream_segmentation_events } = vi.hoisted(() => ({
	post: vi.fn(),
	stream_segmentation_events: vi.fn()
}));
vi.mock('$lib/core/network/client', () => ({ post }));
vi.mock('$lib/core/network/segmentation-events', () => ({ stream_segmentation_events }));

import { runAutofill } from './autofill';

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
	post.mockReset();
	stream_segmentation_events.mockReset();
	post.mockResolvedValue({ ok: true });
});

describe('runAutofill success', () => {
	it("uploads the DICOM and resolves via the segmentation stream's done event", async () => {
		// The stream connects after upload_and_stream already emitted
		// "segmentation.processing" manually (for immediate UI feedback before
		// the SSE connection is even open), so the fixture starts one step later.
		stream_segmentation_events.mockReturnValue(
			events_from([
				{ status: 'saving', ref_points: null },
				{ status: 'done', ref_points: ref_points() }
			])
		);

		const statuses: string[] = [];
		const polygons = await runAutofill('1.2.3', new ArrayBuffer(0), 'frontal', (s) =>
			statuses.push(s)
		);

		expect(post).toHaveBeenCalledWith('/api/dcm/parse/', { form: expect.any(FormData) });
		const form_data = post.mock.calls[0][1].form as FormData;
		expect(form_data.get('file_role_slug')).toBe('DICOM_XRAY_FRONTAL');
		expect(statuses).toEqual(['uploading', 'segmentation.processing', 'saving']);
		expect(polygons).toHaveLength(2);
	});

	it("maps the 'side' projection to the DICOM_XRAY_SAGITTAL role slug", async () => {
		stream_segmentation_events.mockReturnValue(
			events_from([{ status: 'done', ref_points: ref_points() }])
		);

		await runAutofill('1.2.3', new ArrayBuffer(0), 'side', () => {});

		const form_data = post.mock.calls[0][1].form as FormData;
		expect(form_data.get('file_role_slug')).toBe('DICOM_XRAY_SAGITTAL');
	});
});

describe('runAutofill failure paths', () => {
	it('throws without consuming the stream when the upload response is not ok', async () => {
		post.mockResolvedValue({ ok: false, json: async () => ({}) });

		await expect(runAutofill('1.2.3', new ArrayBuffer(0), 'side', () => {})).rejects.toThrow(
			'DICOM upload failed'
		);
		expect(stream_segmentation_events).not.toHaveBeenCalled();
	});

	it('surfaces the backend issue message for a max_count=1-per-Study rejection', async () => {
		post.mockResolvedValue({
			ok: false,
			json: async () => ({
				details: [
					{
						field: 'file_role_slug',
						message:
							"Role 'DICOM_XRAY_FRONTAL' allows at most 1 file(s) per record. 1 already attached."
					}
				]
			})
		});

		await expect(runAutofill('1.2.3', new ArrayBuffer(0), 'frontal', () => {})).rejects.toThrow(
			'allows at most 1 file'
		);
	});

	it('rejects when the stream reports an error status', async () => {
		stream_segmentation_events.mockReturnValue(
			events_from([
				{ status: 'segmentation.processing', ref_points: null },
				{ status: 'error', ref_points: null }
			])
		);

		await expect(runAutofill('1.2.3', new ArrayBuffer(0), 'side', () => {})).rejects.toThrow();
	});

	it('rejects when the stream ends without a done or error event', async () => {
		stream_segmentation_events.mockReturnValue(
			events_from([{ status: 'saving', ref_points: null }])
		);

		await expect(runAutofill('1.2.3', new ArrayBuffer(0), 'side', () => {})).rejects.toThrow();
	});
});

describe('runAutofill point-order safety net', () => {
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
			return runAutofill('1.2.3', new ArrayBuffer(0), 'side', () => {});
		}

		const unshifted = await run_with_shift(0);
		const shifted = await run_with_shift(2);

		expect(shifted.map((p) => p.points)).toEqual(unshifted.map((p) => p.points));
	});
});
