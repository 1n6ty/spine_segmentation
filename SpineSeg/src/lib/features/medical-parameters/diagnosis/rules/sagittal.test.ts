import { describe, expect, it } from "vitest";
import {
    gradeRegionSagittal,
    gradeSacralSlope,
    gradeL5Inclination,
    gradeL5Spondylolisthesis,
    gradeScheuermann,
    gradeVertebralFracture
} from "./sagittal";

describe("gradeRegionSagittal", () => {
    it("grades cervical lordosis within normal range", () => {
        expect(gradeRegionSagittal("cervical", -20).severity).toBe("normal");
    });

    it("grades cervical grade 1 lordosis-flattening", () => {
        expect(gradeRegionSagittal("cervical", -45).severity).toBe("grade1");
    });

    it("grades cervical grade 2 lordosis-flattening", () => {
        expect(gradeRegionSagittal("cervical", -60).severity).toBe("grade2");
    });

    it("grades cervical kyphosis grade 2", () => {
        expect(gradeRegionSagittal("cervical", 10).severity).toBe("grade2");
    });

    it("grades thoracic normal kyphosis", () => {
        expect(gradeRegionSagittal("thoracic", 50).severity).toBe("normal");
    });

    it("grades thoracic kyphosis grade 1", () => {
        expect(gradeRegionSagittal("thoracic", 68).severity).toBe("grade1");
    });

    it("grades thoracic kyphosis grade 4 beyond all bands", () => {
        expect(gradeRegionSagittal("thoracic", 95).severity).toBe("grade4");
    });

    it("grades lumbar normal lordosis", () => {
        expect(gradeRegionSagittal("lumbar", -40).severity).toBe("normal");
    });

    it("grades lumbar hyperlordosis grade 2", () => {
        expect(gradeRegionSagittal("lumbar", -75).severity).toBe("grade2");
    });

    it("grades lumbar kyphotic deformity grade 1", () => {
        expect(gradeRegionSagittal("lumbar", -10).severity).toBe("grade1");
    });
});

describe("gradeSacralSlope", () => {
    it("is normal within 99-124 degrees", () => {
        expect(gradeSacralSlope(110).severity).toBe("normal");
    });

    it("flags tendency toward vertical below 99", () => {
        expect(gradeSacralSlope(90).severity).toBe("grade1");
    });

    it("flags tendency toward horizontal above 124", () => {
        expect(gradeSacralSlope(130).severity).toBe("grade1");
    });
});

describe("gradeL5Inclination", () => {
    it("is normal within -3 to 18 degrees", () => {
        expect(gradeL5Inclination(10).severity).toBe("normal");
    });

    it("grades posterior tilt below -3", () => {
        expect(gradeL5Inclination(-5).severity).toBe("grade1");
    });

    it("grades anterior tilt grade 3 within 37-60", () => {
        expect(gradeL5Inclination(50).severity).toBe("grade3");
    });

    it("grades anterior tilt grade 5 beyond 80", () => {
        expect(gradeL5Inclination(90).severity).toBe("grade5");
    });
});

describe("gradeL5Spondylolisthesis", () => {
    it("is normal above -35 degrees", () => {
        expect(gradeL5Spondylolisthesis(-20).severity).toBe("normal");
    });

    it("grades 1 between -35 and -75", () => {
        expect(gradeL5Spondylolisthesis(-50).severity).toBe("grade1");
    });

    it("grades 3 between -121 and -140", () => {
        expect(gradeL5Spondylolisthesis(-130).severity).toBe("grade3");
    });

    it("grades 4 beyond -141", () => {
        expect(gradeL5Spondylolisthesis(-150).severity).toBe("grade4");
    });
});

describe("gradeScheuermann", () => {
    it("returns null when fewer than 3 vertebrae are wedged", () => {
        expect(gradeScheuermann([6, 2, 1, 0], "grade1")).toBeNull();
    });

    it("returns null when the thoracic region itself is normal", () => {
        expect(gradeScheuermann([6, 7, 8, 9], "normal")).toBeNull();
    });

    it("flags Scheuermann's disease when 3+ vertebrae wedge >5deg and region is kyphotic", () => {
        const finding = gradeScheuermann([6, 7, 8, 2], "grade2");
        expect(finding?.severity).toBe("grade2");
    });
});

describe("gradeVertebralFracture", () => {
    it("returns null for mild wedging", () => {
        expect(gradeVertebralFracture(5, "grade1")).toBeNull();
    });

    it("returns null when the lower region is normal even with severe wedging", () => {
        expect(gradeVertebralFracture(15, "normal")).toBeNull();
    });

    it("flags possible fracture for severe wedging combined with regional kyphosis", () => {
        const finding = gradeVertebralFracture(15, "grade2");
        expect(finding?.severity).toBe("grade3");
    });
});
