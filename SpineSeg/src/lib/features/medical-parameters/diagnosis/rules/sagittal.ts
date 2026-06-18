import type { Finding, Severity } from "../types";

/**
 * Thresholds transcribed from "Классификация кифозов таблица.doc.pdf" (regional
 * sagittal grading) and "TABLREHTG.docx.pdf" pages 1-10 (sacral/L5 inclination,
 * L5/L4 spondylolisthesis, Scheuermann's disease). Page 11's disc-angle-by-level
 * table is NOT used here — it extracted with overlapping/garbled text and needs
 * the original .docx to transcribe correctly.
 *
 * Pelvic obliquity ("bicapital line") and the angular (focal, few-vertebra)
 * kyphosis table are also not implemented: neither has a computed geometric
 * input available today (no pelvic landmark points exist in the 4-point
 * vertebra model; the angular table needs identifying "the deformed segment"
 * which isn't derivable from the fixed 3-region grouping used here).
 *
 * Each grading function is a plain if/else chain over the source table's bands
 * rather than a generic table-lookup helper: some tables increase in severity
 * as the value increases (regional kyphosis), others as it decreases
 * (spondylolisthesis) — collapsing both into one generic "first band whose max
 * >= value" helper silently breaks for the second kind. Explicit chains are
 * easier to verify line-by-line against the source tables than debugging a
 * shared abstraction's ordering assumptions.
 */

/** "Классификация кифозов таблица.doc.pdf" page 1, regional central-arc-angle grading. */
export function gradeRegionSagittal(regionId: "cervical" | "thoracic" | "lumbar", centralAngleDeg: number): Finding {
    const a = centralAngleDeg;
    if (regionId === "cervical") {
        if (a <= -56) return { id: "", severity: "grade2", text: { "ru-RU": "Лордозирование шейного отдела 2 ст", "en-US": "Cervical lordosis-flattening grade 2" } };
        if (a <= -41) return { id: "", severity: "grade1", text: { "ru-RU": "Лордозирование шейного отдела 1 ст", "en-US": "Cervical lordosis-flattening grade 1" } };
        if (a <= -15) return { id: "", severity: "normal", text: { "ru-RU": "Шейный лордоз не изменён", "en-US": "Cervical lordosis unchanged" } };
        if (a <= 0) return { id: "", severity: "grade1", text: { "ru-RU": "Кифозирование шейного отдела 1 ст", "en-US": "Cervical kyphotic deformity grade 1" } };
        if (a <= 15) return { id: "", severity: "grade2", text: { "ru-RU": "Кифозирование шейного отдела 2 ст", "en-US": "Cervical kyphotic deformity grade 2" } };
        if (a <= 30) return { id: "", severity: "grade3", text: { "ru-RU": "Кифозирование шейного отдела 3 ст", "en-US": "Cervical kyphotic deformity grade 3" } };
        return { id: "", severity: "grade4", text: { "ru-RU": "Кифозирование шейного отдела 4 ст", "en-US": "Cervical kyphotic deformity grade 4" } };
    }
    if (regionId === "thoracic") {
        if (a <= -1) return { id: "", severity: "grade2", text: { "ru-RU": "Лордозирование грудного отдела 2 ст", "en-US": "Thoracic lordosis-flattening grade 2" } };
        if (a <= 39) return { id: "", severity: "grade1", text: { "ru-RU": "Лордозирование грудного отдела 1 ст", "en-US": "Thoracic lordosis-flattening grade 1" } };
        if (a <= 65) return { id: "", severity: "normal", text: { "ru-RU": "Грудной кифоз не изменён", "en-US": "Thoracic kyphosis unchanged" } };
        if (a <= 70) return { id: "", severity: "grade1", text: { "ru-RU": "Грудной кифоз усилен 1 ст", "en-US": "Thoracic kyphosis increased grade 1" } };
        if (a <= 80) return { id: "", severity: "grade2", text: { "ru-RU": "Грудной кифоз усилен 2 ст", "en-US": "Thoracic kyphosis increased grade 2" } };
        if (a <= 90) return { id: "", severity: "grade3", text: { "ru-RU": "Грудной кифоз усилен 3 ст", "en-US": "Thoracic kyphosis increased grade 3" } };
        return { id: "", severity: "grade4", text: { "ru-RU": "Грудной кифоз усилен 4 ст", "en-US": "Thoracic kyphosis increased grade 4" } };
    }
    // lumbar
    if (a <= -71) return { id: "", severity: "grade2", text: { "ru-RU": "Гиперлордоз поясничного отдела 2 ст", "en-US": "Lumbar hyperlordosis grade 2" } };
    if (a <= -56) return { id: "", severity: "grade1", text: { "ru-RU": "Гиперлордоз поясничного отдела 1 ст", "en-US": "Lumbar hyperlordosis grade 1" } };
    if (a <= -30) return { id: "", severity: "normal", text: { "ru-RU": "Поясничный лордоз не изменён", "en-US": "Lumbar lordosis unchanged" } };
    if (a <= 0) return { id: "", severity: "grade1", text: { "ru-RU": "Кифозирование поясничного отдела 1 ст", "en-US": "Lumbar kyphotic deformity grade 1" } };
    if (a <= 20) return { id: "", severity: "grade2", text: { "ru-RU": "Кифозирование поясничного отдела 2 ст", "en-US": "Lumbar kyphotic deformity grade 2" } };
    if (a <= 40) return { id: "", severity: "grade3", text: { "ru-RU": "Кифозирование поясничного отдела 3 ст", "en-US": "Lumbar kyphotic deformity grade 3" } };
    return { id: "", severity: "grade4", text: { "ru-RU": "Кифозирование поясничного отдела 4 ст", "en-US": "Lumbar kyphotic deformity grade 4" } };
}

/** "Наклон S1 позвонка к оси Z" — TABLREHTG.docx.pdf row 8. */
export function gradeSacralSlope(angleDeg: number): Finding {
    if (angleDeg < 99) {
        return { id: "", severity: "grade1", text: { "ru-RU": "Положение крестца стремится к вертикали", "en-US": "Sacral position tends toward vertical" } };
    }
    if (angleDeg > 124) {
        return { id: "", severity: "grade1", text: { "ru-RU": "Положение крестца стремится к горизонтали", "en-US": "Sacral position tends toward horizontal" } };
    }
    return { id: "", severity: "normal", text: { "ru-RU": "Положение крестца к оси Z не изменено", "en-US": "Sacral inclination to the Z axis unchanged" } };
}

/** "Наклон L5 позвонка к оси Z" (graded variant) — TABLREHTG.docx.pdf row 7, applied to L5's superior-endplate inclination as the available proxy. */
export function gradeL5Inclination(angleDeg: number): Finding {
    const a = angleDeg;
    if (a < -3) return { id: "", severity: "grade1", text: { "ru-RU": "Тело L5 позвонка отклонено кзади", "en-US": "L5 vertebral body tilted posteriorly" } };
    if (a <= 18) return { id: "", severity: "normal", text: { "ru-RU": "Наклон L5 позвонка не изменён", "en-US": "L5 inclination unchanged" } };
    if (a <= 22) return { id: "", severity: "grade1", text: { "ru-RU": "Тело L5 позвонка отклонено кпереди 1 ст", "en-US": "L5 vertebral body tilted anteriorly grade 1" } };
    if (a <= 36) return { id: "", severity: "grade2", text: { "ru-RU": "Тело L5 позвонка отклонено кпереди 2 ст", "en-US": "L5 vertebral body tilted anteriorly grade 2" } };
    if (a <= 60) return { id: "", severity: "grade3", text: { "ru-RU": "Тело L5 позвонка отклонено кпереди 3 ст", "en-US": "L5 vertebral body tilted anteriorly grade 3" } };
    if (a <= 80) return { id: "", severity: "grade4", text: { "ru-RU": "Тело L5 позвонка отклонено кпереди 4 ст", "en-US": "L5 vertebral body tilted anteriorly grade 4" } };
    return { id: "", severity: "grade5", text: { "ru-RU": "Тело L5 позвонка отклонено кпереди 5 ст", "en-US": "L5 vertebral body tilted anteriorly grade 5" } };
}

/**
 * L5 spondylolisthesis grading by L5-S1 disc angle — "Классификация кифозов
 * таблица.doc.pdf" page 3. Input is the gaps.ts L5-S1 special-case angle
 * (`p7`), used as the available proxy for "угол наклона диска L5-S1". Severity
 * increases as the angle becomes MORE negative, the opposite direction from
 * the regional kyphosis tables above.
 */
export function gradeL5Spondylolisthesis(l5s1AngleDeg: number): Finding {
    const a = l5s1AngleDeg;
    if (a > -35) return { id: "", severity: "normal", text: { "ru-RU": "Признаков спондилолистеза L5 не выявлено", "en-US": "No signs of L5 spondylolisthesis" } };
    if (a > -75) return { id: "", severity: "grade1", text: { "ru-RU": "Спондилолистез L5 позвонка 1 ст", "en-US": "L5 spondylolisthesis grade 1" } };
    if (a > -120) return { id: "", severity: "grade2", text: { "ru-RU": "Спондилолистез L5 позвонка 2 ст", "en-US": "L5 spondylolisthesis grade 2" } };
    if (a > -140) return { id: "", severity: "grade3", text: { "ru-RU": "Спондилолистез L5 позвонка 3 ст", "en-US": "L5 spondylolisthesis grade 3" } };
    return { id: "", severity: "grade4", text: { "ru-RU": "Спондилолистез L5 позвонка 4-5 ст / спондилоптоз", "en-US": "L5 spondylolisthesis grade 4-5 / spondyloptosis" } };
}

/**
 * Scheuermann's disease (Болезнь Шойермана-Мау) — TABLREHTG.docx.pdf page 7.
 * Simplified v1: flags when at least 3 of the Th6-Th9 vertebrae are wedged
 * more than 5 degrees AND the thoracic region already grades as increased
 * kyphosis. The source's additional disc-height-reduction criterion is
 * skipped (no usable disc-norm table — see file header).
 */
export function gradeScheuermann(th6Th9WedgingAnglesDeg: number[], thoracicSeverity: Severity): Finding | null {
    const wedgedCount = th6Th9WedgingAnglesDeg.filter((a) => Math.abs(a) > 5).length;
    if (wedgedCount < 3 || thoracicSeverity === "normal") return null;
    const grade = thoracicSeverity === "grade3" || thoracicSeverity === "grade4" ? 3 : thoracicSeverity === "grade2" ? 2 : 1;
    return {
        id: "",
        severity: thoracicSeverity,
        text: {
            "ru-RU": `Болезнь Шойермана-Мау ${grade} ст`,
            "en-US": `Scheuermann's disease grade ${grade}`
        }
    };
}

/**
 * Possible vertebral body fracture — combinatorial rule from TABLREHTG.docx.pdf
 * page 8 ("Клиновидность тела позвонка + увеличение центрального угла
 * нижележащего отдела" -> "Перелом тела * позвонка"). The source doesn't give
 * an exact fracture-specific wedging threshold ("смотреть норму в таблице"
 * pointing at the same garbled table); >10 degrees is used here as a
 * conservative, clearly-pathological cutoff distinct from Scheuermann's milder
 * >5 degree/3-vertebra pattern, and should be reviewed against clinical input.
 */
export function gradeVertebralFracture(wedgingAngleDeg: number, lowerRegionSeverity: Severity): Finding | null {
    if (Math.abs(wedgingAngleDeg) <= 10 || lowerRegionSeverity === "normal") return null;
    return {
        id: "",
        severity: "grade3",
        text: {
            "ru-RU": `Возможный перелом тела позвонка (угол клиновидности ${wedgingAngleDeg.toFixed(1)}°)`,
            "en-US": `Possible vertebral body fracture (wedging angle ${wedgingAngleDeg.toFixed(1)}°)`
        }
    };
}
