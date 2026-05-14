import type { Point } from "$lib/shared/geometry/geometry.type";

export function drawCircle(ctx: CanvasRenderingContext2D, p: Point, r: number, color: string) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.lineWidth = ctx.lineWidth / 2;
    ctx.stroke();
    ctx.restore();
}

/**
 * Resizes canvas buffer to match client size and returns initial scale/offset
 */
export function calculateInitialView(
    canvas: HTMLCanvasElement,
    bitmap: ImageBitmap,
    maxScaleMultiplier: number = 16
) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // 1. Calculate 'Fit' scale
    const fitScale = Math.min(
        canvas.width / bitmap.width,
        canvas.height / bitmap.height
    );

    // 2. Initial centered offset
    const initialOffset = {
        x: (canvas.width - bitmap.width * fitScale) / 2,
        y: (canvas.height - bitmap.height * fitScale) / 2
    };

    return {
        scale: fitScale,
        minScale: fitScale,
        maxScale: fitScale * maxScaleMultiplier,
        offset: initialOffset
    };
}

/**
 * Basic resize for minimap (usually just matches rect)
 */
export function resizeMinimapBuffer(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}

export function getClampedOffset(
    offset: { x: number; y: number },
    scale: number,
    bitmapSize: ImageBitmap,
    canvasSize: { width: number; height: number }
) {
    const scaledWidth = bitmapSize.width * scale;
    const scaledHeight = bitmapSize.height * scale;
    let { x, y } = offset;

    // X axis: Center if smaller, clamp edges if larger
    if (scaledWidth < canvasSize.width) {
        x = (canvasSize.width - scaledWidth) / 2;
    } else {
        x = Math.min(0, Math.max(x, canvasSize.width - scaledWidth));
    }

    // Y axis: Center if smaller, clamp edges if larger
    if (scaledHeight < canvasSize.height) {
        y = (canvasSize.height - scaledHeight) / 2;
    } else {
        y = Math.min(0, Math.max(y, canvasSize.height - scaledHeight));
    }

    return { x, y };
}