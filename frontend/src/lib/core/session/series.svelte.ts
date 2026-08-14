import { parse_series_from_dicom } from '$lib/features/dicom/parser';
import type { DataSet } from 'dicom-parser';
import type { StudyService } from './study.svelte';
import { SopInstanceService } from './sop-instance.svelte';

export class SeriesService {
	study: StudyService;

	seriesUID = $state<string>('');
	modality = $state<string | null>(null);
	bodyPart = $state<string | null>(null);

	sopInstance: SopInstanceService;

	constructor(study: StudyService, dataSet: DataSet) {
		this.study = study;

		const series = parse_series_from_dicom(dataSet);

		this.seriesUID = series.seriesUID;
		this.modality = series.modality;
		this.bodyPart = series.bodyPart;

		this.sopInstance = new SopInstanceService(this, dataSet);
	}

	destroy() {
		this.sopInstance.destroy();
	}
}
