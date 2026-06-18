import type { Finding, Severity } from "../types";

/**
 * Thresholds transcribed from "Описание спондилограмм во фронтальной
 * плоскости.docx.pdf". Applied to the three FIXED anatomical regions (not
 * dynamically detected scoliotic arcs, per scope decision) — less clinically
 * precise than true arc detection, but a meaningful first-pass screen and a
 * much smaller implementation.
 *
 * Left/right labeling assumes the source document's sign convention (negative
 * central angle = left-sided curve) holds for this app's pixel coordinate
 * system. The app does not currently track DICOM image laterality, so
 * "left"/"right" here is an approximation pending that metadata being wired
 * up — flagged in docs/gaps-and-recommendations.md.
 *
 * Pelvic obliquity ("bicapital line") is not implemented: no pelvic landmark
 * points exist in the current 4-point vertebra polygon model.
 */

const NORMAL_BAND_DEG = 5;

/** Chaklin scoliosis classification by Cobb-equivalent central arc angle. */
export function gradeRegionFrontal(centralAngleDeg: number): Finding {
    const magnitude = Math.abs(centralAngleDeg);
    if (magnitude <= NORMAL_BAND_DEG) {
        return { id: "", severity: "normal", text: { "ru-RU": "Форма отдела во фронтальной плоскости не изменена", "en-US": "Frontal-plane shape of the region unchanged" } };
    }
    const side = centralAngleDeg < 0 ? { "ru-RU": "левосторонняя", "en-US": "left-sided" } : { "ru-RU": "правосторонняя", "en-US": "right-sided" };
    let severity: Severity;
    let grade: number;
    if (magnitude <= 10) { severity = "grade1"; grade = 1; }
    else if (magnitude <= 25) { severity = "grade2"; grade = 2; }
    else if (magnitude <= 50) { severity = "grade3"; grade = 3; }
    else { severity = "grade4"; grade = 4; }
    return {
        id: "",
        severity,
        text: {
            "ru-RU": `Сколиотическая деформация (${side["ru-RU"]}) ${grade} ст по Чаклину, центральный угол ${magnitude.toFixed(1)}°`,
            "en-US": `Scoliotic deformity (${side["en-US"]}) Chaklin grade ${grade}, central angle ${magnitude.toFixed(1)}°`
        }
    };
}

/** "Знак и угол клиновидности тела * позвонка" — ±1° threshold. */
export function gradeVertebralWedgingFrontal(angleDeg: number): Finding {
    if (angleDeg > 1) {
        return { id: "", severity: "grade1", text: { "ru-RU": `Тело позвонка клиновидно деформировано, основание справа, угол ${angleDeg.toFixed(1)}°`, "en-US": `Vertebral body wedge-deformed, base right, angle ${angleDeg.toFixed(1)}°` } };
    }
    if (angleDeg < -1) {
        return { id: "", severity: "grade1", text: { "ru-RU": `Тело позвонка клиновидно деформировано, основание слева, угол ${Math.abs(angleDeg).toFixed(1)}°`, "en-US": `Vertebral body wedge-deformed, base left, angle ${Math.abs(angleDeg).toFixed(1)}°` } };
    }
    return { id: "", severity: "normal", text: { "ru-RU": "Клиновидной деформации тела позвонка не выявлено", "en-US": "No vertebral body wedging detected" } };
}

/** "Линейное смещение тела * позвонка" — >2mm threshold. */
export function gradeLateralDisplacement(mm: number): Finding {
    if (Math.abs(mm) <= 2) {
        return { id: "", severity: "normal", text: { "ru-RU": "Латерального смещения тела позвонка не выявлено", "en-US": "No lateral vertebral body displacement detected" } };
    }
    const direction = mm > 0 ? { "ru-RU": "вправо", "en-US": "to the right" } : { "ru-RU": "влево", "en-US": "to the left" };
    return {
        id: "",
        severity: "grade1",
        text: {
            "ru-RU": `Латеролистез тела позвонка на ${Math.abs(mm).toFixed(1)} мм ${direction["ru-RU"]}`,
            "en-US": `Lateral vertebral displacement ${Math.abs(mm).toFixed(1)}mm ${direction["en-US"]}`
        }
    };
}

/** GCoM lateral offset — ±70mm threshold, reusing spine.ts's overall p3. */
export function gradeGCoM(mm: number): Finding {
    if (Math.abs(mm) <= 70) {
        return {
            id: "",
            severity: "normal",
            text: {
                "ru-RU": `Положение ОГЦМ в границах нормы и составляет ${mm.toFixed(1)} мм`,
                "en-US": `GCoM position within normal range, ${mm.toFixed(1)}mm`
            }
        };
    }
    const direction = mm > 0 ? { "ru-RU": "вправо", "en-US": "to the right" } : { "ru-RU": "влево", "en-US": "to the left" };
    return {
        id: "",
        severity: "grade2",
        text: {
            "ru-RU": `Положение ОГЦМ значительно смещено ${direction["ru-RU"]} и составляет ${Math.abs(mm).toFixed(1)} мм`,
            "en-US": `GCoM position significantly shifted ${direction["en-US"]}, ${Math.abs(mm).toFixed(1)}mm`
        }
    };
}
