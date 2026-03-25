import type { BitmapMeta } from "../editor.type";

function resizeMinimap(bitmapMeta: BitmapMeta) {
    if (!bitmapMeta.canvas) return;
    
    const rect = bitmapMeta.canvas.getBoundingClientRect();
    bitmapMeta.canvas.width = rect.width;
    bitmapMeta.canvas.height = rect.height;
}

export { resizeMinimap };