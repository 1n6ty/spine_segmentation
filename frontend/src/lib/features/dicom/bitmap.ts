import type { DicomImageMetadata, DicomImagePixelData } from './types';

export type ResolvedWindow = {
	low: number;
	high: number;
	/** Actual (rescaled) pixel value range found in the data -- used both for the auto
	 * min/max windowing fallback and as sane drag bounds for a live VOI control. */
	dataMin: number;
	dataMax: number;
};

/**
 * Resolves the low/high windowing edges for a DICOM image, applying the same
 * declared-window-vs-actual-data-range fallback `create_dicom_bitmap` always has: some source
 * files carry a WindowCenter/Width computed for a different bit depth than the pixel data
 * actually stored (stale/mismatched metadata), which would otherwise window every real pixel to
 * a single solid color. Also returns the scanned data range so callers (e.g. a live VOI pad) can
 * derive sane drag bounds without re-scanning the pixel data themselves.
 */
export function resolve_window(
	pixel_data: DicomImagePixelData,
	image_meta: Pick<
		DicomImageMetadata,
		'slope' | 'intercept' | 'windowCenter' | 'windowWidth' | 'rows' | 'cols'
	>
): ResolvedWindow {
	const {
		slope,
		intercept,
		windowCenter: window_center,
		windowWidth: window_width,
		rows,
		cols
	} = image_meta;

	if (!rows || !cols || !pixel_data) {
		throw new Error('Invalid DICOM metadata or pixel data');
	}

	const num_pixels = rows * cols;

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

	return { low, high, dataMin: data_min, dataMax: data_max };
}

/**
 * Renders raw DICOM pixel data into a GPU-ready ImageBitmap using explicit low/high windowing
 * edges. Shared by `create_dicom_bitmap` (which resolves low/high from metadata, via
 * `resolve_window`) and any live re-windowing (e.g. a VOI pad), which already knows the edges it
 * wants and shouldn't re-run the auto min/max fallback on every drag frame.
 */
export async function render_windowed_bitmap(
	pixel_data: DicomImagePixelData,
	rows: number,
	cols: number,
	slope: number,
	intercept: number,
	low: number,
	high: number
): Promise<ImageBitmap> {
	if (!rows || !cols || !pixel_data) {
		throw new Error('Invalid DICOM metadata or pixel data');
	}

	const num_pixels = rows * cols;
	const output = new Uint8ClampedArray(num_pixels * 4);
	const range = high - low || 1; // Prevent division by zero

	for (let i = 0; i < num_pixels; i++) {
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

	const image_data = new ImageData(output, cols, rows);
	return await createImageBitmap(image_data);
}

/**
 * Converts raw DICOM pixel data into a GPU-ready ImageBitmap, windowed per the image's own
 * metadata (falling back to an auto min/max stretch when the declared window doesn't overlap the
 * actual data -- see `resolve_window`).
 */
export async function create_dicom_bitmap(
	pixel_data: DicomImagePixelData,
	image_meta: DicomImageMetadata
): Promise<ImageBitmap> {
	const { low, high } = resolve_window(pixel_data, image_meta);
	return render_windowed_bitmap(
		pixel_data,
		image_meta.rows,
		image_meta.cols,
		image_meta.slope,
		image_meta.intercept,
		low,
		high
	);
}
