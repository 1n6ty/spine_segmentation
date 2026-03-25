import * as M from '$lib/utils/geometry/geometry';
import type { Spine } from './parameters.type';

import { dicomRegistryStore } from "$lib/stores/dicom/dicom.store";
import { currentPatientStore } from '$lib/stores/patient/patient.store';
import { get } from 'svelte/store';

export const getSpineSagittalParams = (spine: Spine) => {
    const registry = get(dicomRegistryStore);
    const current = get(currentPatientStore);

    const mmPerPixel = registry.patients?.[current.patientID]
        ?.studies[current.studyUID]
        ?.series[current.seriesUID]
        ?.images[current.projectionsSopUID.side]
        ?.mmPerPixel;
    
    if (spine.vertebrae.length < 18) return {
        name: "overall",
        params: {
            p1: { val: 0, type: "angular" }, p2: { val: 0, type: "linear" }, p3: { val: 0, type: "linear" }
        }
    };

    const th1 = spine.vertebrae[1].shape.points[0]; 
    const l5 = spine.vertebrae[17].shape.points[1];
    const angle = Math.atan2(th1.x - l5.x, th1.y - l5.y);

    return {
        name: "overall",
        params: {
            p1: { val: M.toDegrees(angle), type: "angular" },
            p2: { val: M.distance(th1, l5) * mmPerPixel, type: "linear" },
            p3: { val: M.distance(th1, l5) * Math.sin(angle) * mmPerPixel, type: "linear" }
        }
    };
};

export const getSpineFrontalParams = (spine: Spine) => {
    const registry = get(dicomRegistryStore);
    const current = get(currentPatientStore);

    const mmPerPixel = registry.patients?.[current.patientID]
        ?.studies[current.studyUID]
        ?.series[current.seriesUID]
        ?.images[current.projectionsSopUID.frontal]
        ?.mmPerPixel;
    
    if (spine.vertebrae.length < 18) return {
        name: "overall",
        params: {
            p1: { val: 0, type: "angular" }, p2: { val: 0, type: "linear" }, p3: { val: 0, type: "linear" }
        }
    };

    const th1 = spine.vertebrae[1].shape.points[0]; 
    const l5 = spine.vertebrae[17].shape.points[1];
    const angle = Math.atan2(th1.x - l5.x, th1.y - l5.y);

    return {
        name: "overall",
        params: {
            p1: { val: M.toDegrees(angle), type: "angular" },
            p2: { val: M.distance(th1, l5) * mmPerPixel, type: "linear" },
            p3: { val: M.distance(th1, l5) * Math.sin(angle) * mmPerPixel, type: "linear" }
        }
    };
};