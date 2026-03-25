import * as M from '$lib/utils/geometry/geometry';
import type { Vertebrae } from './parameters.type';

import { dicomRegistryStore } from "$lib/stores/dicom/dicom.store";
import { currentPatientStore } from '$lib/stores/patient/patient.store';
import { get } from 'svelte/store';

export const getVertebraSagittalParams = (v: Vertebrae) => {
    const registry = get(dicomRegistryStore);
    const current = get(currentPatientStore);

    const mmPerPixel = registry.patients?.[current.patientID]
        ?.studies[current.studyUID]
        ?.series[current.seriesUID]
        ?.images[current.projectionsSopUID.side]
        ?.mmPerPixel;
    
    return {
        name: v.name,
        params: {
            p1: { val: M.distance(v.shape.points[1], v.shape.points[2]) * mmPerPixel, type: "linear" },
            p2: { val: M.distance(v.shape.points[0], v.shape.points[3]) * mmPerPixel, type: "linear" },
            p3: { val: M.distance(v.shape.points[0], v.shape.points[1]) * mmPerPixel, type: "linear" },
            p4: { val: M.distance(v.shape.points[2], v.shape.points[3]) * mmPerPixel, type: "linear" },
            p5: { 
                name: v.name,
                val: M.angleBetweenVectors(
                    M.vectorSub(v.shape.points[1], v.shape.points[0]),
                    M.vectorSub(v.shape.points[2], v.shape.points[3])
                ), 
                type: "angular" 
            },
            p6: { val: M.toDegrees(Math.atan2(v.shape.points[0].x - v.shape.points[1].x, v.shape.points[1].y - v.shape.points[0].y)), type: "angular" },
            p7: { val: M.toDegrees(Math.atan2(v.shape.points[1].x - v.shape.points[2].x, v.shape.points[1].y - v.shape.points[2].y)), type: "angular" },
            p8: { val: M.toDegrees(Math.atan2(v.shape.points[0].x - v.shape.points[3].x, v.shape.points[0].y - v.shape.points[3].y)), type: "angular" },
            p9: { val: v.name === "S1" ? M.toDegrees(Math.asin((v.shape.points[2].y - v.shape.points[1].y) / (M.distance(v.shape.points[1], v.shape.points[2]) + M.EPSILON))) : 0, type: "angular" }
        }
    }   
}

export const getVertebraFrontalParams = (v: Vertebrae) => {
    const registry = get(dicomRegistryStore);
    const current = get(currentPatientStore);

    const mmPerPixel = registry.patients?.[current.patientID]
        ?.studies[current.studyUID]
        ?.series[current.seriesUID]
        ?.images[current.projectionsSopUID.frontal]
        ?.mmPerPixel;

    return {
        name: v.name,
        params: {
            p1: { val: M.distance(v.shape.points[1], v.shape.points[2]) * mmPerPixel, type: "linear" },
            p2: { val: M.distance(v.shape.points[0], v.shape.points[3]) * mmPerPixel, type: "linear" },
            p3: { val: M.distance(v.shape.points[2], v.shape.points[3]) * mmPerPixel, type: "linear" },
            p4: { val: M.distance(v.shape.points[1], v.shape.points[0]) * mmPerPixel, type: "linear" },
            p5: { val: M.distance(M.getMidpoint(v.shape.points[1], v.shape.points[2]), M.getMidpoint(v.shape.points[0], v.shape.points[3])) * mmPerPixel, type: "linear" },
            p6: { val: M.angleBetweenVectors(M.vectorSub(v.shape.points[1], v.shape.points[0]), M.vectorSub(v.shape.points[2], v.shape.points[3])), type: "angular" },
            p7: { val: M.toDegrees(Math.atan2(M.getMidpoint(v.shape.points[1], v.shape.points[2]).x - M.getMidpoint(v.shape.points[0], v.shape.points[3]).x, M.getMidpoint(v.shape.points[1], v.shape.points[2]).y - M.getMidpoint(v.shape.points[0], v.shape.points[3]).y)), type: "angular" },
            p8: { val: M.toDegrees(Math.atan2(v.shape.points[1].x - v.shape.points[2].x, v.shape.points[1].y - v.shape.points[2].y)), type: "angular" },
            p9: { val: M.toDegrees(Math.atan2(v.shape.points[0].x - v.shape.points[3].x, v.shape.points[0].y - v.shape.points[3].y)), type: "angular" }
        }
    };
};
