import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Gap } from '../types';

/**
 * Point convention (confirmed by `features/editor/logic/orderer.ts`): every
 * vertebra's `points` are ordered [bottom-left, top-left, top-right, bottom-right].
 * `g.top` is the more superior vertebra, `g.bottom` the more inferior one
 * (`medical-parameters/store.svelte.ts`'s gap construction). The disc actually
 * sits between `top`'s INFERIOR corners (points[0]/points[3]) and `bottom`'s
 * SUPERIOR corners (points[1]/points[2]) — anterior border: top.points[0] <->
 * bottom.points[1]; posterior border: top.points[3] <-> bottom.points[2].
 *
 * All angles are signed via `getSignedAngle` (CCW-positive, matching the
 * clinical source documents' own stated convention — see vertebras.ts).
 */
export const getGapParams = (projection: Projection, g: Gap, mmPerPixel: number) => {
    const v_top = M.vectorSub(g.top.points[1], g.top.points[0]);
    const v_bot = M.vectorSub(g.bottom.points[1], g.bottom.points[0]);

    // Anterior/posterior vectors crossing the actual disc gap (top's inferior corner -> bottom's superior corner).
    const discAnterior = M.vectorSub(g.bottom.points[1], g.top.points[0]);
    const discPosterior = M.vectorSub(g.bottom.points[2], g.top.points[3]);

    // Top vertebra's own inferior endplate vector (left to right) — the disc's upper border direction.
    const topInferiorEndplate = M.vectorSub(g.top.points[3], g.top.points[0]);

    const displacement = M.dotProduct(discAnterior, topInferiorEndplate) / (M.distance(g.top.points[3], g.top.points[0]) + M.EPSILON);

    const name = `${g.top.id}-${g.bottom.id}`;

    const params = {
        // p1 = Intervertebral angle (angular); p5 = Linear displacement (linear) — per config.ts.
        p1: { val: M.toDegrees(M.getSignedAngle(v_top, v_bot)), type: "angular" },
        p2: { val: M.distance(g.top.points[0], g.bottom.points[1]) * mmPerPixel, type: "linear" },
        p3: { val: M.distance(g.top.points[3], g.bottom.points[2]) * mmPerPixel, type: "linear" },
        p4: { val: M.toDegrees(M.getSignedAngle(discAnterior, discPosterior)), type: "angular" },
        p5: { val: displacement * mmPerPixel, type: "linear" },
        p6: { val: M.toDegrees(M.getSignedAngle(discAnterior, topInferiorEndplate)), type: "angular" },
        p7: {
            // Order matters: a normal (unslipped) L5-S1 pair must read positive (within the clinical
            // "normal" band, > -35°) — verified empirically; the reverse order put a healthy spine
            // at -90°, immediately misclassifying it as severe spondylolisthesis.
            val: (g.top.id.includes("L5") && g.bottom.id.includes("S1"))
                ? M.toDegrees(M.getSignedAngle(M.vectorSub(g.bottom.points[2], g.bottom.points[1]), M.vectorSub(g.top.points[1], g.top.points[0])))
                : null,
            type: "angular"
        }
    } as const;

    if (projection == 'side') {
        return { name, params };
    } else if (projection == 'frontal') {
        return { name, params };
    }
}
