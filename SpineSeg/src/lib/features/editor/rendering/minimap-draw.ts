import type { Point } from "$lib/shared/geometry/geometry.type";

export function drawMinimap(
    ctx: CanvasRenderingContext2D,
    bitmap: ImageBitmap,
    mainView: { offset: Point; scale: number },
    mainCanvasOptions: { width: number; height: number }
) {
    // 1. Sync internal resolution to the actual display size
    // This prevents the "squashed" look caused by CSS stretching
    const dpr = window.devicePixelRatio || 1;
    const displayW = ctx.canvas.clientWidth;
    const displayH = ctx.canvas.clientHeight;

    if (ctx.canvas.width !== displayW * dpr || ctx.canvas.height !== displayH * dpr) {
        ctx.canvas.width = displayW * dpr;
        ctx.canvas.height = displayH * dpr;
    }

    // Scale context so we can continue using "CSS pixels" for our math
    ctx.save();
    ctx.scale(dpr, dpr);

    // 2. Clear and set high-quality scaling (crucial for small maps)
    ctx.clearRect(0, 0, displayW, displayH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 3. Calculate aspect-ratio fit based on display size
    const ratio = Math.min(displayW / bitmap.width, displayH / bitmap.height);
    const imgX = (displayW - bitmap.width * ratio) / 2;
    const imgY = (displayH - bitmap.height * ratio) / 2;

    // 4. Draw Image
    ctx.drawImage(bitmap, imgX, imgY, bitmap.width * ratio, bitmap.height * ratio);

    // 5. Calculate Viewport in World Coords
    const worldW = mainCanvasOptions.width / mainView.scale;
    const worldH = mainCanvasOptions.height / mainView.scale;
    const worldX = -mainView.offset.x / mainView.scale;
    const worldY = -mainView.offset.y / mainView.scale;

    // 6. Draw Viewport Rect
    ctx.strokeStyle = "#ef4444"; // A nicer Tailwind-style red
    ctx.lineWidth = 1.5;
    
    // We stroke the rectangle on the minimap
    ctx.strokeRect(
        imgX + worldX * ratio,
        imgY + worldY * ratio,
        worldW * ratio,
        worldH * ratio
    );

    ctx.restore();
}