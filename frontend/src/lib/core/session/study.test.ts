import { describe, it, expect, vi, beforeEach } from 'vitest';

class FakeImageData {
	constructor(
		public data: Uint8ClampedArray,
		public width: number,
		public height: number
	) {}
}

beforeEach(() => {
	vi.stubGlobal('ImageData', FakeImageData);
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async (image_data: FakeImageData) => ({ __fake_bitmap: true, image_data, close: vi.fn() }))
	);
});

import { StudyService } from './study.svelte';

function fake_dataset(overrides: Record<string, string> = {}) {
	const strings: Record<string, string> = {
		x0020000d: 'STUDY1',
		x00080020: '20200101',
		x00081030: 'Spine Xray',
		x00080090: 'Dr. Smith',
		x00080080: 'General Hospital',
		x00080081: '123 Main St',
		x00081010: 'STATION1',
		x0020000e: 'SERIES1',
		x00080060: 'CR',
		x00180015: 'SPINE',
		x00080018: 'SOP1',
		x00281053: '1',
		x00281052: '0',
		x00281050: '128',
		x00281051: '256',
		...overrides
	};
	const uint16s: Record<string, number> = {
		x00280010: 1,
		x00280011: 1,
		x00280100: 16,
		x00280103: 0
	};
	return {
		string: (tag: string) => strings[tag],
		uint16: (tag: string) => uint16s[tag],
		elements: { x7fe00010: { dataOffset: 0, length: 2 } },
		byteArray: { buffer: new ArrayBuffer(2) }
	} as any;
}

describe('StudyService', () => {
	it('hydrates study fields from the dataset', () => {
		const study = new StudyService({} as any, fake_dataset());

		expect(study.studyUID).toBe('STUDY1');
		expect(study.description).toBe('Spine Xray');
		expect(study.physicianName).toBe('Dr. Smith');
		expect(study.institutionName).toBe('General Hospital');
		expect(study.institutionAddress).toBe('123 Main St');
		expect(study.stationName).toBe('STATION1');
		expect(study.studyDate?.getFullYear()).toBe(2020);
	});

	it('stores the passed-in patient reference', () => {
		const fake_patient = { patientUID: 'PID1' } as any;
		const study = new StudyService(fake_patient, fake_dataset());
		expect(study.patient).toBe(fake_patient);
	});

	it('constructs a nested SeriesService from the same dataset', () => {
		const study = new StudyService({} as any, fake_dataset());
		expect(study.series.seriesUID).toBe('SERIES1');
		expect(study.series.study).toBe(study);
	});

	it('destroy() cascades to the nested series', () => {
		const study = new StudyService({} as any, fake_dataset());
		const series_destroy = vi.spyOn(study.series, 'destroy');

		study.destroy();

		expect(series_destroy).toHaveBeenCalled();
	});
});
