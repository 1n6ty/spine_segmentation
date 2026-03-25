import type { BitmapMeta, BitmapOptions, DicomBitmap } from "../editor.type";

function clampOffset(bitmapMeta: BitmapMeta, dicomBitmap: DicomBitmap) {
    if (!dicomBitmap || !bitmapMeta.canvas) return;
    
    // X axis
    if (dicomBitmap.width * bitmapMeta.scale.x < bitmapMeta.canvas.width) {
        bitmapMeta.offset.x = (bitmapMeta.canvas.width - dicomBitmap.width * bitmapMeta.scale.x) / 2;
    } else {
        bitmapMeta.offset.x = Math.min(0, Math.max(bitmapMeta.offset.x, bitmapMeta.canvas.width - dicomBitmap.width * bitmapMeta.scale.x));
    }

    // Y axis
    if (dicomBitmap.height * bitmapMeta.scale.y < bitmapMeta.canvas.height) {
        bitmapMeta.offset.y = (bitmapMeta.canvas.height - dicomBitmap.height * bitmapMeta.scale.y) / 2;
    } else {
        bitmapMeta.offset.y = Math.min(0, Math.max(bitmapMeta.offset.y, bitmapMeta.canvas.height - dicomBitmap.height * bitmapMeta.scale.y));
    }
}

function resizeCanvas(bitmapMeta: BitmapMeta, bitmapOptions: BitmapOptions, dicomBitmap: DicomBitmap) {
    if (!bitmapMeta.canvas) return ;
    const rect = bitmapMeta.canvas.getBoundingClientRect();
    
    // Sync internal buffer to display size
    bitmapMeta.canvas.width = rect.width;
    bitmapMeta.canvas.height = rect.height;

    if (dicomBitmap) {
        const ratio = Math.min(
            bitmapMeta.canvas.width / dicomBitmap.width,
            bitmapMeta.canvas.height / dicomBitmap.height
        );

        bitmapMeta.scale.x = ratio;
        bitmapMeta.scale.y = ratio;

        clampOffset(bitmapMeta, dicomBitmap);

        bitmapMeta.scale.min = ratio;
        bitmapMeta.scale.max = ratio * bitmapOptions.scale.maxC;
    }

    return ;
}

export { resizeCanvas, clampOffset };