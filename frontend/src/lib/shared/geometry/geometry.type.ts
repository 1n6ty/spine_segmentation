type Point = { x: number; y: number };
type Polygon = {
	uuid: string;
	id: string;
	points: Point[];
};

export type { Point, Polygon };
