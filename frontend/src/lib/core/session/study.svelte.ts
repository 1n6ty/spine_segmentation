import { parse_study_from_dicom } from '$lib/features/dicom/parser';
import type { DataSet } from 'dicom-parser';
import type { PatientService } from './patient.svelte';
import { SeriesService } from './series.svelte';

export class StudyService {
	patient: PatientService;

	studyUID = $state<string>('');
	studyDate = $state<Date | null>(null);
	description = $state<string | null>(null);
	physicianName = $state<string | null>(null);
	institutionName = $state<string | null>(null);
	institutionAddress = $state<string | null>(null);
	stationName = $state<string | null>(null);

	series: SeriesService;

	constructor(patient: PatientService, dataSet: DataSet) {
		this.patient = patient;

		const study = parse_study_from_dicom(dataSet);

		this.studyUID = study.studyUID;
		this.studyDate = study.studyDate;
		this.description = study.description;
		this.physicianName = study.physicianName;
		this.institutionName = study.institutionName;
		this.institutionAddress = study.institutionAddress;
		this.stationName = study.stationName;

		this.series = new SeriesService(this, dataSet);
	}

	destroy() {
		this.series.destroy();
	}
}
