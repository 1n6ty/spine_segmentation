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

import { SopInstanceService } from './sop-instance.svelte';

function fake_dataset(overrides: Record<string, string | undefined> = {}) {
	const strings: Record<string, string | undefined> = {
		x00080018: 'SOP1',
		x00281053: '2',
		x00281052: '10',
		x00281050: '128',
		x00281051: '256',
		x00280030: '0.5\\0.5',
		...overrides
	};
	const uint16s: Record<string, number> = {
		x00280010: 64,
		x00280011: 32,
		x00280100: 16,
		x00280103: 0
	};
	return {
		string: (tag: string) => strings[tag],
		uint16: (tag: string) => uint16s[tag],
		elements: { x7fe00010: { dataOffset: 0, length: 64 * 32 * 2 } },
		byteArray: { buffer: new ArrayBuffer(64 * 32 * 2) }
	} as any;
}

describe('SopInstanceService', () => {
	it('hydrates metadata fields from the dataset', () => {
		const sop = new SopInstanceService({} as any, fake_dataset());

		expect(sop.sopInstanceUID).toBe('SOP1');
		expect(sop.rows).toBe(64);
		expect(sop.cols).toBe(32);
		expect(sop.slope).toBe(2);
		expect(sop.intercept).toBe(10);
		expect(sop.windowCenter).toBe(128);
		expect(sop.windowWidth).toBe(256);
		expect(sop.isSigned).toBe(false);
		expect(sop.mmPerPixel).toBe(0.5);
	});

	it('defaults mmPerPixel to 1 when no spacing tag is present', () => {
		const sop = new SopInstanceService({} as any, fake_dataset({ x00280030: undefined }));
		expect(sop.mmPerPixel).toBe(1);
	});

	it('bitmap starts null and resolves asynchronously via bitmapReady', async () => {
		const sop = new SopInstanceService({} as any, fake_dataset());
		expect(sop.bitmap).toBeNull();

		const resolved = await sop.bitmapReady;

		expect(sop.bitmap).toBe(resolved);
		expect((sop.bitmap as any).__fake_bitmap).toBe(true);
	});

	it('destroy() closes the bitmap once it has resolved', async () => {
		const sop = new SopInstanceService({} as any, fake_dataset());
		await sop.bitmapReady;
		const close_spy = vi.spyOn(sop.bitmap!, 'close');

		sop.destroy();

		expect(close_spy).toHaveBeenCalled();
	});

	it('destroy() before the bitmap resolves does not throw', () => {
		const sop = new SopInstanceService({} as any, fake_dataset());
		expect(() => sop.destroy()).not.toThrow();
	});
});
