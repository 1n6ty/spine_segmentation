import type { Point } from './geometry.type';
import { distance } from './geometry';
import { fitNaturalCubicSpline1D, type NaturalCubicSpline1D } from './natural-cubic-spline';
import { gaussLegendre4 } from './gauss-legendre';

const DEFAULT_MAX_ITER = 50;
const DEFAULT_TOL = 1e-9;

export interface ArcLengthSpline2D {
	/** Arc-length parameter per input control point, ascending. */
	readonly t: number[];
	readonly totalLength: number;
	evaluate(t: number): Point;
	/** (dx/dt, dy/dt), unnormalized. */
	derivative(t: number): Point;
}

function speedAt(csX: NaturalCubicSpline1D, csY: NaturalCubicSpline1D, t: number): number {
	return Math.hypot(csX.derivative(t), csY.derivative(t));
}

/**
 * Fits a 2D curve through `points` parametrized by arc length, via the same fixed-point
 * iteration as the backend's `CentralPath` (`Dicom/utils/segmentation/interpolation/path.py`):
 * start from a chord-length parametrization, refit natural cubic splines for x(t)/y(t), then
 * re-measure `t` as the true arc length along the fitted curve (piecewise 4-point
 * Gauss-Legendre quadrature per segment, mirroring `fixed_quad(..., n=4)`) and repeat until the
 * derivative field stops changing (a single global quadrature call of the L2 difference,
 * matching `path.py`'s single whole-domain `fixed_quad` convergence check).
 */
export function fitArcLengthSpline2D(
	points: Point[],
	opts: { maxIter?: number; tol?: number } = {}
): ArcLengthSpline2D {
	const maxIter = opts.maxIter ?? DEFAULT_MAX_ITER;
	const tol = opts.tol ?? DEFAULT_TOL;

	if (points.length < 2) {
		throw new Error('fitArcLengthSpline2D requires >= 2 points.');
	}

	let t: number[] = [0];
	for (let i = 1; i < points.length; i++) {
		t.push(t[i - 1] + distance(points[i - 1], points[i]));
	}

	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);

	let csX: NaturalCubicSpline1D | null = null;
	let csY: NaturalCubicSpline1D | null = null;
	let oldCsX: NaturalCubicSpline1D | null = null;
	let oldCsY: NaturalCubicSpline1D | null = null;

	let diff = Infinity;
	for (let it = 0; it < maxIter; it++) {
		if (diff < tol) break;

		csX = fitNaturalCubicSpline1D(t, xs);
		csY = fitNaturalCubicSpline1D(t, ys);

		const tmp: number[] = [0];
		for (let i = 1; i < t.length; i++) {
			tmp.push(tmp[i - 1] + gaussLegendre4((u) => speedAt(csX!, csY!, u), t[i - 1], t[i]));
		}
		t = tmp;

		if (it > 0 && oldCsX && oldCsY) {
			diff = gaussLegendre4(
				(u) => {
					const dx = csX!.derivative(u) - oldCsX!.derivative(u);
					const dy = csY!.derivative(u) - oldCsY!.derivative(u);
					return Math.hypot(dx, dy);
				},
				0,
				t[t.length - 1]
			);
		}
		oldCsX = csX;
		oldCsY = csY;
	}

	const finalCsX = csX!;
	const finalCsY = csY!;

	return {
		t,
		totalLength: t[t.length - 1],
		evaluate: (u: number) => ({ x: finalCsX.evaluate(u), y: finalCsY.evaluate(u) }),
		derivative: (u: number) => ({ x: finalCsX.derivative(u), y: finalCsY.derivative(u) })
	};
}
