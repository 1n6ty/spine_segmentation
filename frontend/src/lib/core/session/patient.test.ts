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
		vi.fn(async (image_data: FakeImageData) => ({ __fake_bitmap: true, image_data }))
	);
});

import { PatientService } from './patient.svelte';

function build_full_fake_dataset() {
	const strings: Record<string, string> = {
		x00100020: 'PID123',
		x00100010: 'Doe John',
		x00100030: '19900115',
		x00100040: 'M',
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
		x00281051: '256'
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

describe('PatientService construction chain (Patient -> Study -> Series -> SopInstance)', () => {
	it('hydrates patient fields from the dataset', () => {
		const patient = new PatientService({} as any, build_full_fake_dataset());
		expect(patient.patientUID).toBe('PID123');
		expect(patient.name).toBe('Doe John');
		expect(patient.sex).toBe('M');
		expect(patient.birthDate?.getFullYear()).toBe(1990);
	});

	it('hydrates the nested study', () => {
		const patient = new PatientService({} as any, build_full_fake_dataset());
		expect(patient.study.studyUID).toBe('STUDY1');
		expect(patient.study.description).toBe('Spine Xray');
	});

	it('hydrates the nested series', () => {
		const patient = new PatientService({} as any, build_full_fake_dataset());
		expect(patient.study.series.seriesUID).toBe('SERIES1');
		expect(patient.study.series.modality).toBe('CR');
	});

	it('hydrates the nested sopInstance including derived metadata', () => {
		const patient = new PatientService({} as any, build_full_fake_dataset());
		const sop = patient.study.series.sopInstance;
		expect(sop.sopInstanceUID).toBe('SOP1');
		expect(sop.rows).toBe(1);
		expect(sop.cols).toBe(1);
	});

	it('destroy() cascades down through study/series', () => {
		const patient = new PatientService({} as any, build_full_fake_dataset());
		const study_destroy = vi.spyOn(patient.study, 'destroy');
		patient.destroy();
		expect(study_destroy).toHaveBeenCalled();
	});
});
