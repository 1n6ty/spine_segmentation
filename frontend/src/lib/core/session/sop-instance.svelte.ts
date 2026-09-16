import type { DataSet } from 'dicom-parser';
import type { SeriesService } from './series.svelte';
import { extract_dicom_data } from '$lib/features/dicom/parser';
import { render_windowed_bitmap, resolve_window } from '$lib/features/dicom/bitmap';
import type { DicomImagePixelData } from '$lib/features/dicom/types';

export class SopInstanceService {
	series: SeriesService;

	sopInstanceUID = $state<string>('');
	rows = $state<number | null>(null);
	cols = $state<number | null>(null);
	slope = $state<number | null>(null);
	intercept = $state<number | null>(null);
	windowCenter = $state<number | null>(null);
	windowWidth = $state<number | null>(null);
	isSigned = $state<boolean>(false);
	mmPerPixel = $state<number>(1);

	bitmap = $state<ImageBitmap | null>(null);

	/** The window this image actually opened with -- the declared DICOM window, or the auto
	 * min/max fallback when the declared window doesn't overlap the data (see `resolve_window`).
	 * Distinct from `windowCenter`/`windowWidth` above (the raw declared metadata): a live VOI
	 * control's "reset" should target this, not the possibly-nonoverlapping declared values. */
	originalWindowCenter = $state<number | null>(null);
	originalWindowWidth = $state<number | null>(null);

	/** Actual (rescaled) pixel value range, for bounding a live VOI control's drag range. */
	dataMin = $state<number | null>(null);
	dataMax = $state<number | null>(null);

	/** Resolves once `bitmap` is actually populated -- `bitmap` itself is set
	 * asynchronously (create_dicom_bitmap decodes off the main thread), so
	 * code that needs the bitmap (e.g. building a thumbnail) should await this
	 * instead of reading `.bitmap` synchronously right after construction,
	 * which races the decode and silently gets `null`. */
	bitmapReady: Promise<ImageBitmap>;

	/** Kept around (not just used once in the constructor) so `rewindow()` can re-render the
	 * bitmap at a new window center/width without re-parsing the DICOM file. */
	private pixel_data: DicomImagePixelData = null;

	constructor(series: SeriesService, dataSet: DataSet) {
		this.series = series;

		const { pixelData: pixel_data, metadata } = extract_dicom_data(dataSet);
		this.pixel_data = pixel_data;

		this.sopInstanceUID = metadata.sopInstanceUID;
		this.rows = metadata.rows;
		this.cols = metadata.cols;
		this.slope = metadata.slope;
		this.intercept = metadata.intercept;
		this.windowCenter = metadata.windowCenter;
		this.windowWidth = metadata.windowWidth;
		this.isSigned = metadata.isSigned;
		this.mmPerPixel = metadata.mmPerPixel;

		const { low, high, dataMin, dataMax } = resolve_window(pixel_data, metadata);
		this.dataMin = dataMin;
		this.dataMax = dataMax;
		this.originalWindowCenter = (low + high) / 2;
		this.originalWindowWidth = high - low;

		this.bitmapReady = render_windowed_bitmap(
			pixel_data,
			metadata.rows,
			metadata.cols,
			metadata.slope,
			metadata.intercept,
			low,
			high
		).then((image: ImageBitmap) => {
			this.bitmap = image;
			return image;
		});
	}

	/**
	 * Recomputes the displayed bitmap for a new window center/width (live VOI adjustment).
	 * Closes the previous bitmap first, per `destroy()`'s own convention, so repeated calls
	 * during a drag don't leak GPU memory.
	 */
	async rewindow(center: number, width: number): Promise<void> {
		if (!this.rows || !this.cols || this.slope === null || this.intercept === null) return;

		const low = center - width / 2;
		const high = center + width / 2;
		const image = await render_windowed_bitmap(
			this.pixel_data,
			this.rows,
			this.cols,
			this.slope,
			this.intercept,
			low,
			high
		);

		this.bitmap?.close();
		this.bitmap = image;
	}

	destroy() {
		if (this.bitmap) {
			this.bitmap.close();
		}
	}
}
