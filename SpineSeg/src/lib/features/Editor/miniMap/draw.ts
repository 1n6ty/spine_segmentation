import type { BitmapMeta, DicomBitmap } from "../editor.type";

function drawMinimap(mainMapBitmapMeta: BitmapMeta, miniMapBitmapMeta: BitmapMeta, dicomBitmap: DicomBitmap) {
    if (!dicomBitmap || !mainMapBitmapMeta.canvas || !miniMapBitmapMeta.ctx || !miniMapBitmapMeta.canvas) return;
    miniMapBitmapMeta.ctx.clearRect(0, 0, miniMapBitmapMeta.canvas.width, miniMapBitmapMeta.canvas.height);

    const ratio = Math.min(
        miniMapBitmapMeta.canvas.width / dicomBitmap.width,
        miniMapBitmapMeta.canvas.height / dicomBitmap.height
    );

    const imageOffsetX = (miniMapBitmapMeta.canvas.width - dicomBitmap.width * ratio) / 2;
    const imageOffsetY = (miniMapBitmapMeta.canvas.height - dicomBitmap.height * ratio) / 2;

    miniMapBitmapMeta.ctx.drawImage(
        dicomBitmap,
        imageOffsetX,
        imageOffsetY,
        dicomBitmap.width * ratio,
        dicomBitmap.height * ratio
    );

    // Current viewport in world coordinates
    const viewWidth = mainMapBitmapMeta.canvas.width / mainMapBitmapMeta.scale.x;
    const viewHeight = mainMapBitmapMeta.canvas.height / mainMapBitmapMeta.scale.y;

    const worldX = -mainMapBitmapMeta.offset.x / mainMapBitmapMeta.scale.x;
    const worldY = -mainMapBitmapMeta.offset.y / mainMapBitmapMeta.scale.y;

    // Draw viewport rectangle (add image offsets!)
    miniMapBitmapMeta.ctx.strokeStyle = "red";
    miniMapBitmapMeta.ctx.strokeRect(
        imageOffsetX + worldX * ratio,
        imageOffsetY + worldY * ratio,
        viewWidth * ratio,
        viewHeight * ratio
    );
}

export { drawMinimap };