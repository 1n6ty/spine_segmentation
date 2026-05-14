import * as M from '$lib/shared/geometry/geometry';
import type { Polygon } from '$lib/shared/geometry/geometry.type';
import type { Gap } from './parameters.type';

import { get } from 'svelte/store';

export const getGapSagittalParams = (vTop: Polygon, vBottom: Polygon, mmPerPixel: number) => {
    const v_top = M.vectorSub(g.top.shape.points[0], g.top.shape.points[3]);
    const v_bot = M.vectorSub(g.bottom.shape.points[1], g.bottom.shape.points[2]);
    const v_dist = M.vectorSub(v_top, v_bot);
    const g01 = M.vectorSub(g.bottom.shape.points[0], g.top.shape.points[1]);
    const g21 = M.vectorSub(g.top.shape.points[2], g.top.shape.points[1]);
    const p5_val = (M.dotProduct(g01, g21)) / (M.distance(g.top.shape.points[2], g.top.shape.points[1]) + M.EPSILON);

    return {
        name: `${vTop.id}-${vBottom.id}`,
        params: {
            p1: { val: M.distance(g.top.shape.points[1], g.bottom.shape.points[0]) * mmPerPixel, type: "linear" },
            p2: { val: M.distance(g.top.shape.points[2], g.bottom.shape.points[3]) * mmPerPixel, type: "linear" },
            p3: { val: M.distance(v_dist, v_dist) * mmPerPixel, type: "linear" },
            p4: { val: M.angleBetweenVectors(M.vectorSub(g.top.shape.points[1], g.bottom.shape.points[0]), M.vectorSub(g.top.shape.points[2], g.bottom.shape.points[3])), type: "angular" },
            p5: { val: p5_val * mmPerPixel, type: "linear" },
            p6: { val: M.angleBetweenVectors(g01, g21), type: "angular" },
            p7: { val: (g.name.includes("L5") && g.name.includes("S1")) ? M.angleBetweenVectors(M.vectorSub(g.bottom.shape.points[1], g.bottom.shape.points[0]), M.vectorSub(g.top.shape.points[2], g.top.shape.points[1])) : 0, type: "angular" }
        }
    };
};

export const getGapFrontalParams = (g: Gap) => {
    const registry = get(dicomRegistryStore);
    const current = get(currentPatientStore);

    const mmPerPixel = registry.patients?.[current.patientID]
        ?.studies[current.studyUID]
        ?.series[current.seriesUID]
        ?.images[current.projectionsSopUID.frontal]
        ?.mmPerPixel;

    const v_top = M.vectorSub(g.top.shape.points[1], g.top.shape.points[0]);
    const v_bot = M.vectorSub(g.bottom.shape.points[1], g.bottom.shape.points[0]);
    const g01 = M.vectorSub(g.bottom.shape.points[0], g.top.shape.points[1]);
    const g21 = M.vectorSub(g.top.shape.points[2], g.top.shape.points[1]);
    const p5_val = (M.dotProduct(g01, g21)) / (M.distance(g.top.shape.points[2], g.top.shape.points[1]) + M.EPSILON);

    return {
        name: g.name,
        params: {
            p1: { val: M.angleBetweenVectors(v_top, v_bot), type: "angular" },
            p2: { val: M.distance(g.top.shape.points[1], g.bottom.shape.points[0]) * mmPerPixel, type: "linear" },
            p3: { val: M.distance(g.top.shape.points[2], g.bottom.shape.points[3]) * mmPerPixel, type: "linear" },
            p4: { val: M.angleBetweenVectors(M.vectorSub(g.top.shape.points[1], g.bottom.shape.points[0]), M.vectorSub(g.top.shape.points[2], g.bottom.shape.points[3])), type: "angular" },
            p5: { val: p5_val * mmPerPixel, type: "linear" },
            p6: { val: M.angleBetweenVectors(g01, g21), type: "angular" },
            p7: { val: (g.name.includes("L5") || g.name.includes("S1")) ? M.angleBetweenVectors(M.vectorSub(g.bottom.shape.points[1], g.bottom.shape.points[0]), M.vectorSub(g.top.shape.points[2], g.top.shape.points[1])) : 0, type: "angular" }
        }
    };
};