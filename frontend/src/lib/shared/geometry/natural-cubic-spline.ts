import { EPSILON } from './geometry';

export interface NaturalCubicSpline1D {
	evaluate(x: number): number;
	derivative(x: number): number;
	secondDerivative(x: number): number;
}

/**
 * Solves a tridiagonal system `a[i]*x[i-1] + b[i]*x[i] + c[i]*x[i+1] = d[i]` via the Thomas
 * algorithm. `a[0]` and `c[m - 1]` are never read (there is no `x[-1]`/`x[m]` to connect to),
 * so callers may leave them as any value.
 */
function thomasSolve(a: number[], b: number[], c: number[], d: number[]): number[] {
	const m = b.length;
	const cPrime = new Array<number>(m);
	const dPrime = new Array<number>(m);

	cPrime[0] = c[0] / b[0];
	dPrime[0] = d[0] / b[0];

	for (let i = 1; i < m; i++) {
		const denom = b[i] - a[i] * cPrime[i - 1];
		cPrime[i] = c[i] / denom;
		dPrime[i] = (d[i] - a[i] * dPrime[i - 1]) / denom;
	}

	const x = new Array<number>(m);
	x[m - 1] = dPrime[m - 1];
	for (let i = m - 2; i >= 0; i--) {
		x[i] = dPrime[i] - cPrime[i] * x[i + 1];
	}

	return x;
}

/** Finds `i` such that `t[i] <= x <= t[i + 1]`, clamping to the first/last segment outside the domain. */
function findSegment(t: number[], x: number): number {
	if (x <= t[0]) return 0;
	if (x >= t[t.length - 1]) return t.length - 2;

	let lo = 0;
	let hi = t.length - 2;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (t[mid] <= x) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

/**
 * Fits a 1D natural cubic spline through `(t[i], y[i])` -- equivalent to
 * `scipy.interpolate.CubicSpline(t, y, bc_type="natural")`, which the backend's central-path
 * computation relies on (`Dicom/utils/segmentation/interpolation/path.py`). `t` must be strictly
 * ascending; segment widths are clamped to `EPSILON` to avoid `NaN` propagation on coincident
 * points (the Python original throws instead -- a silently blank curve is a worse failure mode
 * to replicate here than a slightly-stiffened near-zero segment).
 *
 * Evaluates the classic moment form directly rather than mirroring scipy's approach of building
 * separate derivative `PPoly`s via `.derivative(nu=1/2)` -- the derivatives of a per-segment
 * cubic are closed-form, so there's nothing to refit.
 */
export function fitNaturalCubicSpline1D(t: number[], y: number[]): NaturalCubicSpline1D {
	const n = t.length;
	if (n < 2 || y.length !== n) {
		throw new Error('fitNaturalCubicSpline1D requires >= 2 points with matching t/y lengths.');
	}

	const h: number[] = [];
	for (let i = 0; i < n - 1; i++) {
		h.push(Math.max(t[i + 1] - t[i], EPSILON));
	}

	// Natural boundary conditions: M[0] = M[n - 1] = 0. Interior moments solved via the
	// standard tridiagonal system; degenerates to all-zero (a straight line) when n === 2.
	const M = new Array<number>(n).fill(0);

	if (n > 2) {
		const m = n - 2;
		const a = new Array<number>(m);
		const b = new Array<number>(m);
		const c = new Array<number>(m);
		const d = new Array<number>(m);

		for (let k = 0; k < m; k++) {
			const i = k + 1;
			a[k] = h[i - 1];
			b[k] = 2 * (h[i - 1] + h[i]);
			c[k] = h[i];
			d[k] = 6 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1]);
		}

		const interior = thomasSolve(a, b, c, d);
		for (let k = 0; k < m; k++) {
			M[k + 1] = interior[k];
		}
	}

	function segment(x: number): { i: number; hi: number; A: number; B: number } {
		const i = findSegment(t, x);
		const hi = h[i];
		return { i, hi, A: (t[i + 1] - x) / hi, B: (x - t[i]) / hi };
	}

	return {
		evaluate(x: number): number {
			const { i, hi, A, B } = segment(x);
			return (
				A * y[i] + B * y[i + 1] + (((A ** 3 - A) * M[i] + (B ** 3 - B) * M[i + 1]) * hi ** 2) / 6
			);
		},
		derivative(x: number): number {
			const { i, hi, A, B } = segment(x);
			return (
				(y[i + 1] - y[i]) / hi + (hi / 6) * ((3 * B ** 2 - 1) * M[i + 1] - (3 * A ** 2 - 1) * M[i])
			);
		},
		secondDerivative(x: number): number {
			const { i, A, B } = segment(x);
			return A * M[i] + B * M[i + 1];
		}
	};
}
