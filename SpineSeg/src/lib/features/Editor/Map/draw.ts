import type { BitmapMeta, DicomBitmap } from "../editor.type";
import { getPolygonCenter } from "$lib/utils/geometry/geometry";
import type { Polygon, Point } from "$lib/utils/geometry/geometry.type";

function drawPolygons(bitmapMeta: BitmapMeta, selectedPolygon: Polygon | null, polygons: Polygon[], points: Point[] = []) {
    if (!bitmapMeta.ctx || !bitmapMeta.pointsMeta) return ;

    const minScale = Math.min(bitmapMeta.scale.x, bitmapMeta.scale.y);
    bitmapMeta.ctx.lineWidth = 2 / minScale;
    
    for (const poly of polygons) {
        bitmapMeta.ctx.beginPath();
        poly.points.forEach((p, i) => {
            if (i === 0) bitmapMeta.ctx?.moveTo(p.x, p.y);
            else bitmapMeta.ctx?.lineTo(p.x, p.y);
        });
        bitmapMeta.ctx.closePath();

        bitmapMeta.ctx.strokeStyle = poly.id === selectedPolygon?.id ? "red" : "lime";
        bitmapMeta.ctx.stroke();

        // Compute left-most point for label
        const minX = Math.min(...poly.points.map(p => p.x));
        const centerY = getPolygonCenter(poly).y;

        bitmapMeta.ctx.fillStyle = "yellow";
        bitmapMeta.ctx.font = `${22 / minScale}px sans-serif`;
        bitmapMeta.ctx.textAlign = "right"; // align text to the left of minX
        bitmapMeta.ctx.textBaseline = "middle"; // vertically centered
        bitmapMeta.ctx.fillText(poly.id, minX - 5 / minScale, centerY); // 5px padding left
    }

    // Draw current creating polygon
    if (polygons.length > 0) {
        bitmapMeta.ctx.beginPath();
        points.forEach((p, i) => {
            if (i === 0) bitmapMeta.ctx?.moveTo(p.x, p.y);
            else bitmapMeta.ctx?.lineTo(p.x, p.y);
        });
        bitmapMeta.ctx.strokeStyle = "cyan";
        bitmapMeta.ctx.stroke();
    }
    for (const p of points) {
        bitmapMeta.ctx.beginPath();
        bitmapMeta.ctx.arc(p.x, p.y, bitmapMeta.pointsMeta.radius / minScale, 0, Math.PI * 2);
        bitmapMeta.ctx.fillStyle = "cyan";
        bitmapMeta.ctx.fill();
        bitmapMeta.ctx.strokeStyle = "black";
        bitmapMeta.ctx.lineWidth = 1 / minScale;
        bitmapMeta.ctx.stroke();
    }

    for (const poly of polygons) {
        for (let i = 0; i < poly.points.length; i++) {
            const p = poly.points[i];
            bitmapMeta.ctx.beginPath();
            bitmapMeta.ctx.arc(p.x, p.y, bitmapMeta.pointsMeta.radius / minScale, 0, Math.PI * 2);
            bitmapMeta.ctx.fillStyle = poly.id === selectedPolygon?.id ? "red" : "lime";
            bitmapMeta.ctx.fill();
            bitmapMeta.ctx.strokeStyle = "black";
            bitmapMeta.ctx.lineWidth = 1 / minScale;
            bitmapMeta.ctx.stroke();
        }
    }
}

function draw(bitmapMeta: BitmapMeta, dicomBitmap: DicomBitmap, selectedPolygon: Polygon | null, polygons: Polygon[], points: Point[] = []) {
    if (!dicomBitmap || !bitmapMeta.ctx || !bitmapMeta.canvas) return;
    bitmapMeta.ctx.clearRect(0, 0, bitmapMeta.canvas.width, bitmapMeta.canvas.height);

    bitmapMeta.ctx.save();
    bitmapMeta.ctx.translate(bitmapMeta.offset.x, bitmapMeta.offset.y);
    bitmapMeta.ctx.scale(bitmapMeta.scale.x, bitmapMeta.scale.y);

    // Drawing the bitmap is identical to drawing an image
    bitmapMeta.ctx.drawImage(dicomBitmap, 0, 0);

    drawPolygons(bitmapMeta, selectedPolygon, polygons, points);
    bitmapMeta.ctx.restore();
}

export { draw, drawPolygons };