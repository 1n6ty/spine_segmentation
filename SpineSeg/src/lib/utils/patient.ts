import { currentPatientStore } from "$lib/stores/patient/patient.store";
import { dicomStore } from "$lib/stores/dicom/dicom.store";
import { derived } from "svelte/store";

const patientExistsInStore = derived(
    [currentPatientStore, dicomStore],
    ([$patient, $dicom]) =>
        Boolean(
            $patient.currentPatientID &&
            $patient.currentStudyUID &&
            $patient.currentSeriesUID &&
            $dicom.patients[$patient.currentPatientID] && 
            $dicom.patients[$patient.currentPatientID].studies[$patient.currentStudyUID] && 
            $dicom.patients[$patient.currentPatientID].studies[$patient.currentStudyUID].series[$patient.currentSeriesUID]
        )
);

const sideProjectionExistsInStore = derived(
    [currentPatientStore, dicomStore, patientExistsInStore],
    ([$patient, $dicom, $patientExists]) =>
        Boolean(
            $patientExists &&
            $dicom.patients[$patient.currentPatientID].studies[$patient.currentStudyUID].series[$patient.currentSeriesUID].images[$patient.projectionsSopUID.side]
        )
);

const frontalProjectionExistsInStore = derived(
    [currentPatientStore, dicomStore, patientExistsInStore],
    ([$patient, $dicom, $patientExists]) =>
        Boolean(
            $patientExists &&
            $dicom.patients[$patient.currentPatientID].studies[$patient.currentStudyUID].series[$patient.currentSeriesUID].images[$patient.projectionsSopUID.frontal]
        )
);

export { patientExistsInStore, sideProjectionExistsInStore, frontalProjectionExistsInStore };