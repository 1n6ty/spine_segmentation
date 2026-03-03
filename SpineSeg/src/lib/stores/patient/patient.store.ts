import { writable } from "svelte/store";

import type { CurrentPatient } from "./patient.type";
import { persistentCacheWritable } from "$lib/utils/persistentWritable";

export const currentPatientStore = persistentCacheWritable<CurrentPatient>("currentPatientStore", {
    currentPatientID: "",
    currentStudyUID: "",
    currentSeriesUID: "",
    projectionsSopUID: { frontal: "", side: "" }
});