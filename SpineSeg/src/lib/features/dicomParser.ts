import type { Polygon } from "$lib/shared/geometry/geometry.type";
import type { SegmentationRefPoints } from "$lib/stores/websocket/xraysockets.store";

/**
 * Converts the backend's segmentation result shape (`{vertebraes:[{name,points:[[x,y],...]}]}`)
 * into this app's `Polygon[]`. The actual autofill flow lives in
 * `$lib/features/autofill/autofill.ts` — this is just the data-shape conversion.
 */
export function formatJson2Polygons(data: SegmentationRefPoints): Polygon[] {
  return data.vertebraes.map((v) => ({
    uuid: crypto.randomUUID(),
    id: v.name,
    points: v.points.map(([x, y]) => ({ x, y }))
  }));
}
