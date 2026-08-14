import type { Polygon } from '$lib/shared/geometry/geometry.type';
import type { SegmentationRefPoints } from '$lib/core/network/types';

/**
 * Converts the backend's segmentation result shape (`{vertebraes:[{name,points:[[x,y],...]}]}`)
 * into this app's `Polygon[]`.
 */
export function format_json_to_polygons(data: SegmentationRefPoints): Polygon[] {
	return data.vertebraes.map((v) => ({
		uuid: crypto.randomUUID(),
		id: v.name,
		points: v.points.map(([x, y]) => ({ x, y }))
	}));
}
