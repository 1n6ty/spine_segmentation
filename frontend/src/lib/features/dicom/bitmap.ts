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

	// 2. Pre-calculate windowing constants to save CPU cycles
	const low = window_center - window_width / 2;
	const high = window_center + window_width / 2;
	const range = window_width || 1; // Prevent division by zero

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
