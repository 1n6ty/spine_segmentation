import { writable } from "svelte/store";
import type { CurrentPatient } from "./patient.type";

export const currentPatientStore = writable<CurrentPatient>({
    patientID: "",
    studyUID: "",
    seriesUID: "",
    projectionsSopUID: { frontal: "", side: "" }
});