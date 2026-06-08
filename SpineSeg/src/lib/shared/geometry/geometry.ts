import type { Point, Polygon } from "./geometry.type";
import * as math from 'mathjs';

export const EPSILON = 1e-9;

function getPolygonCenter(poly: Polygon): Point {
    const sum = poly.points.reduce(
        (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
        { x: 0, y: 0 }
    );
    return {
        x: sum.x / poly.points.length,
        y: sum.y / poly.points.length
    };
}

// Replicates np.linalg.norm (distance between two points)
function getDistance(p1: Point, p2: Point): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// Replicates get_signed_angle
function getSignedAngle(v1: Point, v2: Point): number {
    return Math.atan2(v1.y * v2.x - v1.x * v2.y, v1.x * v2.x + v1.y * v2.y);
}

function distance(p1: Point, p2: Point): number {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// Returns a new Point representing the vector difference
function vectorSub(p1: Point, p2: Point): Point {
    return { x: p1.x - p2.x, y: p1.y - p2.y };
}

function dotProduct(v1: Point, v2: Point): number {
    return v1.x * v2.x + v1.y * v2.y;
}

function vectorNorm(v: Point): number {
    return Math.hypot(v.x, v.y);
}

function toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
}

/**
 * Least squares circle fit.
 * Finds coefficients [c, a, b] for the equation: x^2 + y^2 + ax + by + c = 0
 * * @param points - The spinal segment containing a list of vertebrae.
 * @returns [c, a, b] coefficients used to calculate Radius and Center.
 */
function solveCircleFit(points: Point[]): [number, number, number] {
    if (points.length < 3) {
        throw new Error("At least 3 points are required to fit a circle.");
    }

    // 1. Construct Matrix W and Vector U
    // W rows: [1, x, y]
    // U rows: -(x^2 + y^2)
    const W_data: number[][] = [];
    const U_data: number[] = [];

    points.forEach(p => {
        W_data.push([1, p.x, p.y]);
        U_data.push(-(Math.pow(p.x, 2) + Math.pow(p.y, 2)));
    });

    const W = math.matrix(W_data);
    const U = math.matrix(U_data);

    // 2. Solve the Normal Equations: (W^T * W) * A = (W^T * U)
    const WT = math.transpose(W);
    const WTW = math.multiply(WT, W);
    const WTU = math.multiply(WT, U);

    // math.lusolve returns a matrix (column vector), we flatten it to an array
    const result = math.lusolve(WTW, WTU) as math.Matrix;
    const [c, a, b] = (result.toArray() as number[][]).map(row => row[0]);

    return [c, a, b];
}

export const getArcRadius = (abc: [number, number, number]): number => {
    const [c, a, b] = abc;
    const discriminant = Math.pow(a, 2) + Math.pow(b, 2) - 4 * c;
    return 0.5 * Math.sqrt(Math.max(0, discriminant)); // Ensure no negative sqrt due to float precision
};

export const getMidpoint = (p1: Point, p2: Point): Point => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
});

export const angleBetweenPoints = (p1: Point, p2: Point): number => {
    // Math.atan2 returns the angle in radians between the positive x-axis 
    // and the point (x, y). We use it here to find the slope of the segment.
    const radians = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    return radians * (180 / Math.PI);
};

export const angleBetweenVectors = (v1: Point, v2: Point): number => {
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    return toDegrees(Math.acos(dotProduct(v1, v2) / (mag + EPSILON)));
};

export function screenToWorld(p: Point, offset: Point, scale: number): Point {
    return {
        x: (p.x - offset.x) / scale,
        y: (p.y - offset.y) / scale
    };
};

export { getPolygonCenter, getDistance, getSignedAngle, distance, vectorSub, dotProduct, vectorNorm, toDegrees, solveCircleFit };