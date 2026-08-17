import type { DataSet } from 'dicom-parser';
import type { SeriesService } from './series.svelte';
import { extract_dicom_data } from '$lib/features/dicom/parser';
import { create_dicom_bitmap } from '$lib/features/dicom/bitmap';

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

	/** Resolves once `bitmap` is actually populated -- `bitmap` itself is set
	 * asynchronously (create_dicom_bitmap decodes off the main thread), so
	 * code that needs the bitmap (e.g. building a thumbnail) should await this
	 * instead of reading `.bitmap` synchronously right after construction,
	 * which races the decode and silently gets `null`. */
	bitmapReady: Promise<ImageBitmap>;

	constructor(series: SeriesService, dataSet: DataSet) {
		this.series = series;

		const { pixelData: pixel_data, metadata } = extract_dicom_data(dataSet);

		this.sopInstanceUID = metadata.sopInstanceUID;
		this.rows = metadata.rows;
		this.cols = metadata.cols;
		this.slope = metadata.slope;
		this.intercept = metadata.intercept;
		this.windowCenter = metadata.windowCenter;
		this.windowWidth = metadata.windowWidth;
		this.isSigned = metadata.isSigned;
		this.mmPerPixel = metadata.mmPerPixel;

		this.bitmapReady = create_dicom_bitmap(pixel_data, metadata).then((image: ImageBitmap) => {
			this.bitmap = image;
			return image;
		});
	}

	destroy() {
		if (this.bitmap) {
			this.bitmap.close();
		}
	}
}
