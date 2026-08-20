type Point = { x: number; y: number };
type Polygon = {
	uuid: string;
	id: string;
	points: Point[];
};
type AABB = { minX: number; minY: number; maxX: number; maxY: number };

export type { Point, Polygon, AABB };
