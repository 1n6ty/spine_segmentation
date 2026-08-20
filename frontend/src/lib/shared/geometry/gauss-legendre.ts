// 4-point Gauss-Legendre quadrature nodes/weights on [-1, 1]. Mirrors
// `scipy.integrate.fixed_quad(f, a, b, n=4)`, used by the backend's central-path arc-length
// computation (`Dicom/utils/segmentation/interpolation/path.py`).
const NODES = [-0.3399810435848563, 0.3399810435848563, -0.8611363115940526, 0.8611363115940526];
const WEIGHTS = [0.6521451548625461, 0.6521451548625461, 0.3478548451374538, 0.3478548451374538];

/** Fixed 4-point Gauss-Legendre quadrature of `f` over `[a, b]`. */
export function gaussLegendre4(f: (x: number) => number, a: number, b: number): number {
	const halfWidth = (b - a) / 2;
	const midpoint = (a + b) / 2;

	let sum = 0;
	for (let i = 0; i < NODES.length; i++) {
		sum += WEIGHTS[i] * f(midpoint + halfWidth * NODES[i]);
	}

	return halfWidth * sum;
}
