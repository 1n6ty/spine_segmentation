import { parsePatientFromDicom } from "$lib/features/dicom/parser";
import type { DataSet } from "dicom-parser";
import type { SessionService } from "./session.svelte";
import { StudyService } from "./study.svelte";

export class PatientService{
    session: SessionService

    patientUID = $state<string>("");
    name = $state<string | null>(null);
    birthDate = $state<Date | null>(null);
    sex = $state<string | null>(null);

    study: StudyService;

    constructor(session: SessionService, dataSet: DataSet) {
        this.session = session;

        const patient = parsePatientFromDicom(dataSet);
        this.patientUID = patient.patientUID;
        this.name = patient.name;
        this.birthDate = patient.birthDate;
        this.sex = patient.sex;

        this.study = new StudyService(this, dataSet);
    }

    destroy() {
        this.study.destroy();
    }
}