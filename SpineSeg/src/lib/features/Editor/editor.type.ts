type DicomBitmap = ImageBitmap | null;

type BitmapMeta = {
    canvas: HTMLCanvasElement | null,
    ctx: CanvasRenderingContext2D | null,
    scale: { min: number, max: number, x: number, y: number},
    offset: { x: number, y:number },
    pointsMeta?: {
        radius: number
    }
};

type BitmapOptions = {
    scale: { maxC: number },
    point: { hitC: number }
};

export type { BitmapMeta, BitmapOptions, DicomBitmap };