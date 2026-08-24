import type { DicomImageMetadata, DicomImagePixelData } from './types';

/**
 * Converts raw DICOM pixel data into a GPU-ready ImageBitmap.
 * Fixed for TypeScript Overload errors.
 */
export async function create_dicom_bitmap(
	pixel_data: DicomImagePixelData,
	image_meta: DicomImageMetadata
): Promise<ImageBitmap> {
	const {
		slope,
		intercept,
		windowCenter: window_center,
		windowWidth: window_width,
		rows,
		cols
	} = image_meta;

	// Guard against missing dimensions
	if (!rows || !cols || !pixel_data) {
		throw new Error('Invalid DICOM metadata or pixel data');
	}

	const num_pixels = rows * cols;
	const output = new Uint8ClampedArray(num_pixels * 4);

	// 2. Find the actual (rescaled) pixel value range so we can fall back to
	// auto min/max contrast when the declared window doesn't overlap it at
	// all -- some source files carry a WindowCenter/Width computed for a
	// different bit depth than the pixel data actually stored (stale/mismatched
	// metadata), which would otherwise window every real pixel to a single
	// solid color. The backend's thumbnail renderer sidesteps this the same
	// way, via an unconditional min/max stretch.
	let data_min = Infinity;
	let data_max = -Infinity;
	for (let i = 0; i < num_pixels; i++) {
		const val = pixel_data[i] * slope + intercept;
		if (val < data_min) data_min = val;
		if (val > data_max) data_max = val;
	}

	let low = window_center - window_width / 2;
	let high = window_center + window_width / 2;

	const window_overlaps_data = window_width > 0 && low <= data_max && high >= data_min;
	if (!window_overlaps_data) {
		low = data_min;
		high = data_max;
	}

	const range = high - low || 1; // Prevent division by zero

	for (let i = 0; i < num_pixels; i++) {
		// FIX: Access pixelData directly (not .buffer)
		// The TypedArray (Uint16/Int16) handles the 2-byte offset automatically
		const raw_val = pixel_data[i];
		const val = raw_val * slope + intercept;

		let intensity: number;
		if (val <= low) {
			intensity = 0;
		} else if (val >= high) {
			intensity = 255;
		} else {
			intensity = ((val - low) / range) * 255;
		}

		const idx = i * 4;
		output[idx] = intensity; // R
		output[idx + 1] = intensity; // G
		output[idx + 2] = intensity; // B
		output[idx + 3] = 255; // A
	}

	// 3. Create ImageData with explicit dimensions
	const image_data = new ImageData(output, cols, rows);

	return await createImageBitmap(image_data);
}
