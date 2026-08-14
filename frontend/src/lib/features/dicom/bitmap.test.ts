import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DicomImageMetadata } from './types';

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
		vi.fn(async (image_data: FakeImageData) => ({ __fake_bitmap: true, image_data }))
	);
});

import { create_dicom_bitmap } from './bitmap';

function meta(overrides: Partial<DicomImageMetadata> = {}): DicomImageMetadata {
	return {
		sopInstanceUID: '1.2.3',
		rows: 1,
		cols: 3,
		slope: 1,
		intercept: 0,
		windowCenter: 128,
		windowWidth: 256,
		isSigned: false,
		mmPerPixel: 1,
		...overrides
	};
}

describe('create_dicom_bitmap', () => {
	it("maps a value at or below the window's low edge to black (0)", async () => {
		const pixel_data = new Uint16Array([0]);
		const result = (await create_dicom_bitmap(
			pixel_data,
			meta({ rows: 1, cols: 1 })
		)) as unknown as { image_data: FakeImageData };
		expect(result.image_data.data[0]).toBe(0);
		expect(result.image_data.data[3]).toBe(255); // alpha always opaque
	});

	it("maps a value at or above the window's high edge to white (255)", async () => {
		// window: center=128, width=256 -> high edge = 128 + 128 = 256
		const pixel_data = new Uint16Array([256]);
		const result = (await create_dicom_bitmap(
			pixel_data,
			meta({ rows: 1, cols: 1 })
		)) as unknown as { image_data: FakeImageData };
		expect(result.image_data.data[0]).toBe(255);
	});

	it('maps the window center to mid-gray (~127)', async () => {
		const pixel_data = new Uint16Array([128]);
		const result = (await create_dicom_bitmap(
			pixel_data,
			meta({ rows: 1, cols: 1 })
		)) as unknown as { image_data: FakeImageData };
		expect(result.image_data.data[0]).toBeGreaterThan(120);
		expect(result.image_data.data[0]).toBeLessThan(135);
	});

	it('applies slope/intercept rescaling before windowing', async () => {
		const pixel_data = new Uint16Array([0]);
		const result = (await create_dicom_bitmap(
			pixel_data,
			meta({ rows: 1, cols: 1, slope: 1, intercept: 256 })
		)) as unknown as {
			image_data: FakeImageData;
		};
		// raw 0 * slope(1) + intercept(256) = 256 -> at/above high edge (256) -> white
		expect(result.image_data.data[0]).toBe(255);
	});

	it('throws when rows or cols are missing', async () => {
		await expect(create_dicom_bitmap(new Uint16Array([1]), meta({ rows: 0 }))).rejects.toThrow();
	});

	it('produces RGBA output sized 4 bytes per pixel', async () => {
		const pixel_data = new Uint16Array([10, 20, 30]);
		const result = (await create_dicom_bitmap(
			pixel_data,
			meta({ rows: 1, cols: 3 })
		)) as unknown as { image_data: FakeImageData };
		expect(result.image_data.data.length).toBe(12);
	});
});
