import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Gap } from '../types';

const UP: Point = { x: 0, y: -1 };

/**
 * Point convention (confirmed by `features/editor/logic/orderer.ts`): every
 * vertebra's `points` are ordered [bottom-left, top-left, top-right, bottom-right].
 * `g.top` is the more superior vertebra, `g.bottom` the more inferior one
 * (`medical-parameters/parameters-store.svelte.ts`'s gap construction). The disc actually
 * sits between `top`'s INFERIOR corners (points[0]/points[3]) and `bottom`'s
 * SUPERIOR corners (points[1]/points[2]) — anterior border: top.points[0] <->
 * bottom.points[1]; posterior border: top.points[3] <-> bottom.points[2].
 *
 * All angles are signed via `get_signed_angle` (CCW-positive, matching the
 * clinical source documents' own stated convention — see vertebrae.ts).
 */
export const getGapParams = (projection: Projection, g: Gap, mmPerPixel: number) => {
	const v_top = M.vector_sub(g.top.points[1], g.top.points[0]);
	const v_bot = M.vector_sub(g.bottom.points[1], g.bottom.points[0]);

	// Anterior/posterior vectors crossing the actual disc gap (top's inferior corner -> bottom's superior corner).
	const discAnterior = M.vector_sub(g.bottom.points[1], g.top.points[0]);
	const discPosterior = M.vector_sub(g.bottom.points[2], g.top.points[3]);

	// Top vertebra's own inferior endplate vector (left to right) — the disc's upper border direction.
	const topInferiorEndplate = M.vector_sub(g.top.points[3], g.top.points[0]);

	const displacement =
		M.dot_product(discAnterior, topInferiorEndplate) /
		(M.distance(g.top.points[3], g.top.points[0]) + M.EPSILON);

	const name = `${g.top.id}-${g.bottom.id}`;

	const params = {
		// p1 = Intervertebral angle (angular); p5 = Linear displacement (linear) — per config.ts.
		p1: { val: M.to_degrees(M.get_signed_angle(v_top, v_bot)), type: 'angular' },
		p2: { val: M.distance(g.top.points[0], g.bottom.points[1]) * mmPerPixel, type: 'linear' },
		p3: { val: M.distance(g.top.points[3], g.bottom.points[2]) * mmPerPixel, type: 'linear' },
		p4: { val: M.to_degrees(M.get_signed_angle(discAnterior, discPosterior)), type: 'angular' },
		p5: { val: displacement * mmPerPixel, type: 'linear' },
		p6: {
			val: M.to_degrees(M.get_signed_angle(discAnterior, topInferiorEndplate)),
			type: 'angular'
		},
		p7: {
			// "Угол наклона диска L5-S1" — Клинико-биомеханичечкая оценка позвоночника при
			// истинном спондилолистезе L5 позвонка.docx, §3.5: "величина угла наклона к
			// вертикальной оси (ось Z) линии, соединяющей точку кранио-вентрального угла тела
			// крестца с точкой каудо-вентрального угла тела сместившегося L5-позвонка" — the
			// inclination FROM VERTICAL of the single line from S1's cranio-ventral corner
			// (points[1], AS) to L5's caudo-ventral corner (points[0], AI). Not an angle
			// between two edges (the previous implementation compared S1's superior plate to
			// L5's anterior wall, a mismatched-edge-type formula analogous to the wedging bug
			// in vertebrae.ts) -- confirmed against the doc's own severity-group diagrams,
			// which each draw exactly one short line at the L5-S1 junction, not two.
			// Grading (rules/sagittal.ts's gradeL5Spondylolisthesis, same source): 1: -35..-75,
			// 2: -76..-120, 3: -121..-140, 4&5: <=-141; normal > -35.
			// Direction matters: S1's point first (bottom.points[1]), L5's point second
			// (top.points[0]), i.e. UP vs (top.points[0] - bottom.points[1]) -- reversing which
			// endpoint is the vector's tail flips the sign entirely, same ambiguity as any
			// undirected line's angle from vertical.
			val:
				g.top.id.includes('L5') && g.bottom.id.includes('S1')
					? M.to_degrees(
							M.get_signed_angle(UP, M.vector_sub(g.top.points[0], g.bottom.points[1]))
						)
					: null,
			type: 'angular'
		}
	} as const;

	return { name, params };
};
