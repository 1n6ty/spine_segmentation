import { currentPatientStore } from "$lib/stores/patient/patient.store";
import { dicomRegistryStore } from "$lib/stores/dicom/dicom.store";
import { derived } from "svelte/store";

const patientAndStudyExistsInStore = derived(
    [currentPatientStore, dicomRegistryStore],
    ([$patient, $dicom]) =>
        Boolean(
            $patient.patientID &&
            $patient.studyUID &&
            $patient.seriesUID &&
            $dicom.patients[$patient.patientID] && 
            $dicom.patients[$patient.patientID].studies[$patient.studyUID] && 
            $dicom.patients[$patient.patientID].studies[$patient.studyUID].series[$patient.seriesUID]
        )
);

/**
 * Calculate age from a DICOM birth date (DA) string.
 * Returns null if the date is invalid or missing.
 *
 * @param dicomBirthDate - DICOM birth date (YYYYMMDD)
 * @returns Age in years or null if invalid
 */
function getPatientAge(dicomBirthDate: string | null | undefined): number | null {
    if (!dicomBirthDate || dicomBirthDate.length < 8) return null;

    const year = parseInt(dicomBirthDate.slice(0, 4));
    const month = parseInt(dicomBirthDate.slice(4, 6)) - 1; // JS months are 0-based
    const day = parseInt(dicomBirthDate.slice(6, 8));

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    const birthDate = new Date(year, month, day);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    // Adjust if birthday hasn't occurred yet this year
    const hasHadBirthdayThisYear =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!hasHadBirthdayThisYear) age--;

    return age >= 0 ? age : null;
}

export { patientAndStudyExistsInStore, getPatientAge };