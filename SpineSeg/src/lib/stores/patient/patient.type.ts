type CurrentPatient = {
    patientID: string,
    studyUID: string,
    seriesUID: string,
    projectionsSopUID: { frontal: string, side: string }
}

export type { CurrentPatient };