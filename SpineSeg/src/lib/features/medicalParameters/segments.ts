import * as M from '$lib/utils/geometry/geometry';
import type { Point } from '$lib/utils/geometry/geometry.type';
import type { Segment } from './parameters.type';

import { dicomRegistryStore } from "$lib/stores/dicom/dicom.store";
import { currentPatientStore } from '$lib/stores/patient/patient.store';
import { get } from 'svelte/store';

export const getSegmentSagittalParams = (s: Segment) => {
    const registry = get(dicomRegistryStore);
    const current = get(currentPatientStore);

    const mmPerPixel = registry.patients?.[current.patientID]
        ?.studies[current.studyUID]
        ?.series[current.seriesUID]
        ?.images[current.projectionsSopUID.side]
        ?.mmPerPixel;

    const points: Point[] = [];
    s.vertebrae.forEach(v => {
        v.shape.points.forEach(p => {
            points.push(p);
        });
    });

    const abc = M.solveCircleFit(points);
    const radius = 0.5 * Math.sqrt(Math.max(0, abc[1]**2 + abc[2]**2 - 4*abc[0]));
    
    const start = M.getMidpoint(s.vertebrae[0].shape.points[0], s.vertebrae[0].shape.points[3]);
    const end = M.getMidpoint(s.vertebrae[s.vertebrae.length-1].shape.points[1], s.vertebrae[s.vertebrae.length-1].shape.points[2]);
    const chord = Math.min(M.distance(start, end), 2 * radius);

    return {
        name: s.name,
        params: {
            p1: { val: radius * mmPerPixel, type: "linear" },
            p2: { val: chord * mmPerPixel, type: "linear" },
            p3: { val: M.toDegrees(Math.acos((2*radius**2 - chord**2) / (2*radius**2 + M.EPSILON))), type: "angular" },
            p4: { val: M.toDegrees(Math.atan2(start.y - end.y, start.x - end.x)), type: "angular" }
        }
    };
};

export const getSegmentFrontalParams = (s: Segment) => {
    const registry = get(dicomRegistryStore);
    const current = get(currentPatientStore);

    const mmPerPixel = registry.patients?.[current.patientID]
        ?.studies[current.studyUID]
        ?.series[current.seriesUID]
        ?.images[current.projectionsSopUID.frontal]
        ?.mmPerPixel;

    const points: Point[] = [];
    s.vertebrae.forEach(v => {
        v.shape.points.forEach(p => {
            points.push(p);
        });
    });

    const abc = M.solveCircleFit(points);
    const radius = 0.5 * Math.sqrt(Math.max(0, abc[1]**2 + abc[2]**2 - 4*abc[0]));
    
    const start = M.getMidpoint(s.vertebrae[0].shape.points[0], s.vertebrae[0].shape.points[3]);
    const end = M.getMidpoint(s.vertebrae[s.vertebrae.length-1].shape.points[1], s.vertebrae[s.vertebrae.length-1].shape.points[2]);
    const chord = Math.min(M.distance(start, end), 2 * radius);

    return {
        name: s.name,
        params: {
            p1: { val: radius * mmPerPixel, type: "linear" },
            p2: { val: chord * mmPerPixel, type: "linear" },
            p3: { val: M.toDegrees(Math.acos((2*radius**2 - chord**2) / (2*radius**2 + M.EPSILON))), type: "angular" },
            p4: { val: M.toDegrees(Math.atan2(start.y - end.y, start.x - end.x)), type: "angular" }
        }
    };
};