import type { DataSet } from "dicom-parser";
import type { SeriesService } from "./series.svelte";
import { extractDicomData } from "$lib/features/dicom/parser";
import { createDicomBitmap } from "$lib/features/dicom/bitmap";

export class SopInstanceService {
    series: SeriesService;

    sopInstanceUID = $state<string>("");
    rows = $state<number | null>(null);
    cols = $state<number | null>(null);
    slope = $state<number | null>(null);
    intercept = $state<number | null>(null);
    windowCenter = $state<number | null>(null);
    windowWidth = $state<number | null>(null);
    isSigned = $state<boolean>(false);
    mmPerPixel = $state<number>(1);

    bitmap = $state<ImageBitmap | null>(null);

    constructor(series: SeriesService, dataSet: DataSet) {
        this.series = series;

        const { pixelData, metadata } = extractDicomData(dataSet);

        this.sopInstanceUID = metadata.sopInstanceUID;
        this.rows = metadata.rows;
        this.cols = metadata.cols;
        this.slope = metadata.slope;
        this.intercept = metadata.intercept;
        this.windowCenter = metadata.windowCenter;
        this.windowWidth = metadata.windowWidth;
        this.isSigned = metadata.isSigned;
        this.mmPerPixel = metadata.mmPerPixel;

        createDicomBitmap(pixelData, metadata).then(
            (image: ImageBitmap) => {
                this.bitmap = image;
            }
        );
    }

    destroy() {
        if(this.bitmap) {
            this.bitmap.close();
        }
    }
};