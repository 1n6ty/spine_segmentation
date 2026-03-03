type CurrentPatient = {
    currentPatientID: string,
    currentStudyUID: string,
    currentSeriesUID: string,
    projectionsSopUID: { frontal: string, side: string }
}

export type { CurrentPatient };