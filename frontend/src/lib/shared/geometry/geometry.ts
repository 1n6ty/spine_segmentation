import type { AABB, Point } from './geometry.type';

export const EPSILON = 1e-9;

function centroid(points: Point[]): Point {
	const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
	return {
		x: sum.x / points.length,
		y: sum.y / points.length
	};
}

// Replicates get_signed_angle
function get_signed_angle(v1: Point, v2: Point): number {
	return Math.atan2(v1.y * v2.x - v1.x * v2.y, v1.x * v2.x + v1.y * v2.y);
}

// Replicates np.linalg.norm (distance between two points)
function distance(p1: Point, p2: Point): number {
	return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Returns a new Point representing the vector difference
function vector_sub(p1: Point, p2: Point): Point {
	return { x: p1.x - p2.x, y: p1.y - p2.y };
}

function dot_product(v1: Point, v2: Point): number {
	return v1.x * v2.x + v1.y * v2.y;
}

function to_degrees(radians: number): number {
	return radians * (180 / Math.PI);
}

/**
 * Arc radius/center from a circle-fit's [c, a, b] coefficients (equation:
 * x^2 + y^2 + ax + by + c = 0). See circle-fit.ts's `solveCircleFit`.
 */
export const get_arc_radius = (abc: [number, number, number]): number => {
	const [c, a, b] = abc;
	const discriminant = Math.pow(a, 2) + Math.pow(b, 2) - 4 * c;
	return 0.5 * Math.sqrt(Math.max(0, discriminant)); // Ensure no negative sqrt due to float precision
};

export const get_arc_center = (abc: [number, number, number]): Point => {
	const [, a, b] = abc;
	return { x: -a / 2, y: -b / 2 };
};

export const get_midpoint = (p1: Point, p2: Point): Point => ({
	x: (p1.x + p2.x) / 2,
	y: (p1.y + p2.y) / 2
});

export function screen_to_world(p: Point, offset: Point, scale: number): Point {
	return {
		x: (p.x - offset.x) / scale,
		y: (p.y - offset.y) / scale
	};
}

/** Ray Casting Algorithm to determine if a point is inside a polygon. */
export function is_point_in_polygon(point: Point, vertices: Point[]): boolean {
	const { x, y } = point;
	let inside = false;

	for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
		const xi = vertices[i].x,
			yi = vertices[i].y;
		const xj = vertices[j].x,
			yj = vertices[j].y;

		const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

		if (intersect) inside = !inside;
	}

	return inside;
}

/** Axis-aligned bounding box enclosing a set of points. */
export function aabb_of_points(points: Point[]): AABB {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const p of points) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}

	return { minX, minY, maxX, maxY };
}

/** Inclusive overlap test -- touching edges count as overlapping. */
export function aabb_overlaps(a: AABB, b: AABB): boolean {
	return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export { centroid, get_signed_angle, distance, vector_sub, dot_product, to_degrees };
