import * as math from 'mathjs';
import type { Point } from './geometry.type';

/**
 * Least squares circle fit.
 * Finds coefficients [c, a, b] for the equation: x^2 + y^2 + ax + by + c = 0
 * @param points - The spinal segment containing a list of vertebrae.
 * @returns [c, a, b] coefficients used to calculate Radius and Center.
 */
export function solveCircleFit(points: Point[]): [number, number, number] {
	if (points.length < 3) {
		throw new Error('At least 3 points are required to fit a circle.');
	}

	// 1. Construct Matrix W and Vector U
	// W rows: [1, x, y]
	// U rows: -(x^2 + y^2)
	const W_data: number[][] = [];
	const U_data: number[] = [];

	points.forEach((p) => {
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
	const [c, a, b] = (result.toArray() as number[][]).map((row) => row[0]);

	return [c, a, b];
}
