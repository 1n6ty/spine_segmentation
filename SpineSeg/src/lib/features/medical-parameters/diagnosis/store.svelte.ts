import { project } from "$lib/core/project.svelte";
import type { Projection } from "$lib/features/dicom/types";
import { getVertebraeParams } from "../calculators/vertebras";
import { getGapParams } from "../calculators/gaps";
import { getSegmentParams } from "../calculators/segments";
import { getSpineParams } from "../calculators/spine";
import type { Vertebrae } from "../types";
import { REGIONS, TOTAL_VERTEBRAE } from "../regions";
import * as Sagittal from "./rules/sagittal";
import * as Frontal from "./rules/frontal";
import type { Finding, GapDiagnosis, ProjectionDiagnosis, RegionDiagnosis, VertebraDiagnosis } from "./types";

function withId(finding: Finding, id: string): Finding {
    return { ...finding, id };
}

function buildVertebraDiagnosis(projection: Projection, v: Vertebrae, mmPerPixel: number, regionFinding: Finding): VertebraDiagnosis {
    const vParams = getVertebraeParams(projection, v, mmPerPixel)!.params;
    const findings: Finding[] = [];

    if (projection === "frontal") {
        const wedging = vParams.p6.val as number | null;
        if (wedging !== null) {
            findings.push(withId(Frontal.gradeVertebralWedgingFrontal(wedging), `${v.id}-wedging`));
        }
    } else {
        const wedging = vParams.p5.val as number | null;
        if (wedging !== null) {
            const fracture = Sagittal.gradeVertebralFracture(wedging, regionFinding.severity);
            if (fracture) findings.push(withId(fracture, `${v.id}-fracture`));
        }
    }

    return { id: v.id, findings };
}

function buildGapDiagnosis(projection: Projection, top: Vertebrae, bottom: Vertebrae, mmPerPixel: number): GapDiagnosis {
    const gParams = getGapParams(projection, { top, bottom }, mmPerPixel)!.params;
    const findings: Finding[] = [];

    if (projection === "frontal") {
        // p5 = linear displacement (mm), per config.ts. (An earlier pass had p1/p5 actually
        // swapped in gaps.ts despite being "fixed" in name only — see gaps.ts and
        // docs/gaps-and-recommendations.md for how that was caught and corrected.)
        const displacement = gParams.p5.val as number | null;
        if (displacement !== null) {
            findings.push(withId(Frontal.gradeLateralDisplacement(displacement), `${top.id}-${bottom.id}-displacement`));
        }
    }

    return { id: `${top.id}-${bottom.id}`, findings };
}

function computeProjectionDiagnosis(projection: Projection): ProjectionDiagnosis {
    const proj = project.session.projections[projection];
    const polygons = proj.polygons;
    const mmPerPixel = proj.patient?.study.series.sopInstance.mmPerPixel || 1;

    if (polygons.length < TOTAL_VERTEBRAE) {
        return { insufficientAnnotation: true, regions: [], overall: [], conclusion: [] };
    }

    const regions: RegionDiagnosis[] = REGIONS.map((region) => {
        const [start, end] = region.slice;
        const regionVertebrae = polygons.slice(start, end);

        // segments.ts's p3 (central angle) is now signed (derived from the fitted circle's
        // actual center, not the unsigned law-of-cosines acos) so both gradeRegionFrontal's
        // left/right branches and gradeRegionSagittal's lordosis/kyphosis branches are
        // genuinely reachable — previously p3 was always >= 0, making "left-sided" and
        // "lordosis-flattening" unreachable regardless of the real curve shape.
        const centralAngle = getSegmentParams(projection, regionVertebrae, mmPerPixel).params.p3.val as number;
        const regionFinding =
            projection === "side"
                ? Sagittal.gradeRegionSagittal(region.id, centralAngle)
                : Frontal.gradeRegionFrontal(centralAngle);

        const findings: Finding[] = [withId(regionFinding, `${region.id}-curve`)];

        const vertebras = regionVertebrae.map((v) => buildVertebraDiagnosis(projection, v, mmPerPixel, regionFinding));
        const gaps: GapDiagnosis[] = [];
        for (let i = 0; i < regionVertebrae.length - 1; i++) {
            // polygons are ordered S1->C2 (ascending), so the more superior vertebra is at i+1
            gaps.push(buildGapDiagnosis(projection, regionVertebrae[i + 1], regionVertebrae[i], mmPerPixel));
        }

        if (projection === "side" && region.id === "thoracic") {
            // Th6-Th9 = polygons indices 9-12 (Th9,Th8,Th7,Th6), the subrange Scheuermann's disease is graded on
            const th6Th9 = polygons.slice(9, 13);
            const wedgingAngles = th6Th9
                .map((v) => getVertebraeParams(projection, v, mmPerPixel)!.params.p5.val as number | null)
                .filter((a): a is number => a !== null);
            const scheuermann = Sagittal.gradeScheuermann(wedgingAngles, regionFinding.severity);
            if (scheuermann) findings.push(withId(scheuermann, "thoracic-scheuermann"));
        }

        if (projection === "side" && region.id === "lumbar") {
            const s1 = polygons[0];
            const l5 = polygons[1];
            const sacralSlope = getVertebraeParams(projection, s1, mmPerPixel)!.params.p9.val as number | null;
            if (sacralSlope !== null) findings.push(withId(Sagittal.gradeSacralSlope(sacralSlope), "s1-sacral-slope"));

            const l5Inclination = getVertebraeParams(projection, l5, mmPerPixel)!.params.p7.val as number | null;
            if (l5Inclination !== null) findings.push(withId(Sagittal.gradeL5Inclination(l5Inclination), "l5-inclination"));

            // p7 is now signed (verified: an unslipped baseline reads ~+90°, correctly inside
            // gradeL5Spondylolisthesis's "normal" band, not immediately misclassified as severe
            // slip like the old unsigned version did). One remaining concern surfaced while
            // fixing this, not yet resolved: p7 measures the ANGLE between L5's contour and
            // S1's endplate, which is mostly sensitive to *rotation* between the two vertebrae,
            // not the *translational* slip spondylolisthesis fundamentally is — a pure
            // translation (no rotation) leaves p7 unchanged. p5/p6 (translational/angular disc
            // displacement) may be the better-suited input; needs clinical input to confirm,
            // not a further code guess.
            const l5s1Angle = getGapParams(projection, { top: l5, bottom: s1 }, mmPerPixel)!.params.p7.val as number | null;
            if (l5s1Angle !== null) findings.push(withId(Sagittal.gradeL5Spondylolisthesis(l5s1Angle), "l5-spondylolisthesis"));
        }

        return {
            id: region.id,
            label: region.label,
            vertebraeLabel: region.vertebraeLabel,
            vertebras,
            gaps,
            findings
        };
    });

    const overall: Finding[] = [];
    if (projection === "frontal") {
        const gcomMm = getSpineParams(projection, polygons, mmPerPixel).params.p3.val as number | null;
        if (gcomMm !== null && gcomMm !== undefined) {
            overall.push(withId(Frontal.gradeGCoM(gcomMm), "overall-gcom"));
        }
    }

    const conclusion: Finding[] = [];
    for (const f of overall) if (f.severity !== "normal") conclusion.push(f);
    for (const region of regions) {
        for (const f of region.findings) if (f.severity !== "normal") conclusion.push(f);
        for (const v of region.vertebras) for (const f of v.findings) if (f.severity !== "normal") conclusion.push(f);
        for (const g of region.gaps) for (const f of g.findings) if (f.severity !== "normal") conclusion.push(f);
    }

    if (conclusion.length === 0) {
        conclusion.push({
            id: "no-findings",
            severity: "normal",
            text: { "ru-RU": "Достоверных признаков нарушения формы и ориентации отделов позвоночника не выявлено", "en-US": "No reliable signs of spinal shape/orientation abnormality detected" }
        });
    }

    return { insufficientAnnotation: false, regions, overall, conclusion };
}

export const diagnosis = {
    get side() {
        return computeProjectionDiagnosis("side");
    },
    get frontal() {
        return computeProjectionDiagnosis("frontal");
    }
};
