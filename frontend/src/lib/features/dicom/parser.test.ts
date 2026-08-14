import { describe, it, expect } from 'vitest';
import {
	parse_dicom_date,
	extract_dicom_data,
	parse_patient_from_dicom,
	parse_study_from_dicom,
	parse_series_from_dicom
} from './parser';

describe('parse_dicom_date', () => {
	it('returns null for a missing value', () => {
		expect(parse_dicom_date(null)).toBeNull();
		expect(parse_dicom_date(undefined)).toBeNull();
		expect(parse_dicom_date('')).toBeNull();
	});

	it('parses a date-only (DA) string', () => {
		const result = parse_dicom_date('19900115');
		expect(result?.getFullYear()).toBe(1990);
		expect(result?.getMonth()).toBe(0);
		expect(result?.getDate()).toBe(15);
	});

	it('parses a full datetime (DT) string with time components', () => {
		const result = parse_dicom_date('19900115143025');
		expect(result?.getHours()).toBe(14);
		expect(result?.getMinutes()).toBe(30);
		expect(result?.getSeconds()).toBe(25);
	});

	it('returns null for a malformed string', () => {
		expect(parse_dicom_date('not-a-date')).toBeNull();
	});
});

function build_fake_dataset(
	strings: Record<string, string>,
	uint16s: Record<string, number>,
	pixel_bytes = 6
) {
	const byte_array_buffer = new ArrayBuffer(pixel_bytes);
	return {
		string: (tag: string) => strings[tag],
		uint16: (tag: string) => uint16s[tag],
		elements: {
			x7fe00010: { dataOffset: 0, length: pixel_bytes }
		},
		byteArray: { buffer: byte_array_buffer }
	};
}

describe('extract_dicom_data', () => {
	it('extracts metadata and produces pixel data of the right length', () => {
		const dataset = build_fake_dataset(
			{
				x00080018: '1.2.3',
				x00281053: '1',
				x00281052: '0',
				x00281050: '128',
				x00281051: '256'
			},
			{
				x00280010: 2,
				x00280011: 3,
				x00280100: 16,
				x00280103: 0
			},
			12 // 6 pixels * 2 bytes
		);

		const { metadata, pixelData } = extract_dicom_data(dataset);

		expect(metadata.sopInstanceUID).toBe('1.2.3');
		expect(metadata.rows).toBe(2);
		expect(metadata.cols).toBe(3);
		expect(metadata.isSigned).toBe(false);
		expect(pixelData).toHaveLength(6);
		expect(pixelData).toBeInstanceOf(Uint16Array);
	});

	it('produces a signed Int16Array when the pixel representation flag is set', () => {
		const dataset = build_fake_dataset(
			{ x00080018: '1.2.3' },
			{ x00280010: 1, x00280011: 1, x00280100: 16, x00280103: 1 },
			2
		);

		const { pixelData } = extract_dicom_data(dataset);
		expect(pixelData).toBeInstanceOf(Int16Array);
	});

	it('produces a Uint8Array when 8 bits are allocated', () => {
		const dataset = build_fake_dataset(
			{ x00080018: '1.2.3' },
			{ x00280010: 1, x00280011: 1, x00280100: 8, x00280103: 0 },
			1
		);

		const { pixelData } = extract_dicom_data(dataset);
		expect(pixelData).toBeInstanceOf(Uint8Array);
	});

	it('throws for a compressed transfer syntax', () => {
		const dataset = {
			...build_fake_dataset({ x00080018: '1.2.3' }, { x00280010: 1, x00280011: 1 }, 2),
			string: (tag: string) => (tag === 'x00020010' ? '1.2.840.10008.1.2.4.70' : undefined)
		};

		expect(() => extract_dicom_data(dataset)).toThrow();
	});

	it('throws when there is no pixel data element', () => {
		const dataset = {
			string: () => undefined,
			uint16: () => undefined,
			elements: {},
			byteArray: { buffer: new ArrayBuffer(0) }
		};
		expect(() => extract_dicom_data(dataset)).toThrow();
	});
});

describe('parse_patient_from_dicom', () => {
	it('extracts patient fields', () => {
		const dataset = {
			string: (tag: string) =>
				({
					x00100020: 'PID123',
					x00100010: 'Doe John',
					x00100030: '19900115',
					x00100040: 'M'
				})[tag]
		};

		const patient = parse_patient_from_dicom(dataset as any);
		expect(patient.patientUID).toBe('PID123');
		expect(patient.name).toBe('Doe John');
		expect(patient.sex).toBe('M');
		expect(patient.birthDate?.getFullYear()).toBe(1990);
	});
});

describe('parse_study_from_dicom', () => {
	it('extracts study fields', () => {
		const dataset = {
			string: (tag: string) =>
				({
					x0020000d: 'STUDY1',
					x00080020: '20200101',
					x00081030: 'Spine Xray'
				})[tag]
		};

		const study = parse_study_from_dicom(dataset as any);
		expect(study.studyUID).toBe('STUDY1');
		expect(study.description).toBe('Spine Xray');
		expect(study.studyDate?.getFullYear()).toBe(2020);
	});
});

describe('parse_series_from_dicom', () => {
	it('extracts series fields', () => {
		const dataset = {
			string: (tag: string) =>
				({
					x0020000e: 'SERIES1',
					x00080060: 'CR',
					x00180015: 'SPINE'
				})[tag]
		};

		const series = parse_series_from_dicom(dataset as any);
		expect(series.seriesUID).toBe('SERIES1');
		expect(series.modality).toBe('CR');
		expect(series.bodyPart).toBe('SPINE');
	});
});
