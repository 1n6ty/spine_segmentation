import { describe, it, expect, vi, beforeEach } from 'vitest';

class FakeImageData {
	constructor(
		public data: Uint8ClampedArray,
		public width: number,
		public height: number
	) {}
}

beforeEach(() => {
	vi.stubGlobal('ImageData', FakeImageData);
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async (image_data: FakeImageData) => ({ __fake_bitmap: true, image_data, close: vi.fn() }))
	);
});

import { SeriesService } from './series.svelte';

function fake_dataset(overrides: Record<string, string> = {}) {
	const strings: Record<string, string> = {
		x0020000e: 'SERIES1',
		x00080060: 'CR',
		x00180015: 'SPINE',
		x00080018: 'SOP1',
		x00281053: '1',
		x00281052: '0',
		x00281050: '128',
		x00281051: '256',
		...overrides
	};
	const uint16s: Record<string, number> = {
		x00280010: 1,
		x00280011: 1,
		x00280100: 16,
		x00280103: 0
	};
	return {
		string: (tag: string) => strings[tag],
		uint16: (tag: string) => uint16s[tag],
		elements: { x7fe00010: { dataOffset: 0, length: 2 } },
		byteArray: { buffer: new ArrayBuffer(2) }
	} as any;
}

describe('SeriesService', () => {
	it('hydrates series fields from the dataset', () => {
		const series = new SeriesService({} as any, fake_dataset());

		expect(series.seriesUID).toBe('SERIES1');
		expect(series.modality).toBe('CR');
		expect(series.bodyPart).toBe('SPINE');
	});

	it('stores the passed-in study reference', () => {
		const fake_study = { studyUID: 'STUDY1' } as any;
		const series = new SeriesService(fake_study, fake_dataset());
		expect(series.study).toBe(fake_study);
	});

	it('constructs a nested SopInstanceService from the same dataset', () => {
		const series = new SeriesService({} as any, fake_dataset());
		expect(series.sopInstance.sopInstanceUID).toBe('SOP1');
		expect(series.sopInstance.series).toBe(series);
	});

	it('destroy() cascades to the nested sopInstance, closing its bitmap once ready', async () => {
		const series = new SeriesService({} as any, fake_dataset());
		await series.sopInstance.bitmapReady;
		const close_spy = vi.spyOn(series.sopInstance.bitmap!, 'close');

		series.destroy();

		expect(close_spy).toHaveBeenCalled();
	});
});
