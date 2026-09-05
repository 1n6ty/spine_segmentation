import type { DicomImageMetadata, DicomImagePixelData, Patient, Series, Study } from './types';

import * as dicom_parser_lib from 'dicom-parser';

/**
 * Parses a DICOM date (DA) or datetime (DT) string into a human-readable format.
 * Returns null if the value is missing or invalid.
 *
 * @param dicom_date - The DICOM date (YYYYMMDD) or datetime (YYYYMMDDHHMMSS.FFFFFF&ZZXX)
 * @returns Human-readable date/time or null
 */
export function parse_dicom_date(dicom_date: string | null | undefined): Date | null {
	if (!dicom_date) return null;

	try {
		// Extract year, month, day
		const year = parseInt(dicom_date.slice(0, 4));
		const month = parseInt(dicom_date.slice(4, 6)) - 1; // JS months are 0-indexed
		const day = parseInt(dicom_date.slice(6, 8));

		if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

		if (dicom_date.length >= 14) {
			const hours = parseInt(dicom_date.slice(8, 10)) || 0;
			const minutes = parseInt(dicom_date.slice(10, 12)) || 0;
			const seconds = parseInt(dicom_date.slice(12, 14)) || 0;

			return new Date(year, month, day, hours, minutes, seconds);
		}

		return new Date(year, month, day);
	} catch {
		return null;
	}
}

/**
 * Parses a DICOM DS (decimal string) element that may be multi-valued
 * (backslash-separated, e.g. multiple windowing presets on WindowCenter/
 * WindowWidth). dataSet.string() returns the raw backslash-joined string for
 * these, and Number() on that is NaN -- take the first value, matching the
 * backend's get_dcm_value handling of pydicom.multival.MultiValue.
 */
function parse_first_ds_value(raw: string | undefined, fallback: number): number {
	if (!raw) return fallback;
	const first = Number(raw.split('\\')[0]);
	return Number.isNaN(first) ? fallback : first;
}

function create_pixel_array(
	buffer: ArrayBuffer,
	is_signed: boolean,
	bits_allocated: number
): Int16Array | Uint16Array | Uint8Array {
	if (bits_allocated === 8) return new Uint8Array(buffer);

	// Enforce word-alignment to prevent RangeError during typed array construction
	const length = Math.floor(buffer.byteLength / 2);
	return is_signed ? new Int16Array(buffer, 0, length) : new Uint16Array(buffer, 0, length);
}

export function extract_dicom_data(dataSet: any) {
	// Transfer Syntax Check
	const transfer_syntax = dataSet.string('x00020010') || '1.2.840.10008.1.2.1';
	const is_compressed = ![
		'1.2.840.10008.1.2',
		'1.2.840.10008.1.2.1',
		'1.2.840.10008.1.2.2'
	].includes(transfer_syntax);

	if (is_compressed) {
		throw new Error(
			`Compressed Transfer Syntax (${transfer_syntax}) requires a specialized decoder.`
		);
	}

	// Safely extract pixel buffer
	const element = dataSet.elements.x7fe00010;
	if (!element || !element.length) throw new Error('No pixel data found in DICOM file.');

	const pixel_buffer = dataSet.byteArray.buffer.slice(
		element.dataOffset,
		element.dataOffset + element.length
	);

	const spacing = (dataSet.string('x00280030') || dataSet.string('x00181164') || '1.0\\1.0')
		.split('\\')
		.map(Number);
	const bits_allocated = dataSet.uint16('x00280100') || 16;
	const is_signed = dataSet.uint16('x00280103') === 1;

	const metadata: DicomImageMetadata = {
		sopInstanceUID: dataSet.string('x00080018'),
		rows: dataSet.uint16('x00280010'),
		cols: dataSet.uint16('x00280011'),
		slope: Number(dataSet.string('x00281053') || 1),
		intercept: Number(dataSet.string('x00281052') || 0),
		windowCenter: parse_first_ds_value(dataSet.string('x00281050'), 0),
		windowWidth: parse_first_ds_value(dataSet.string('x00281051'), 0),
		isSigned: is_signed,
		mmPerPixel: spacing[0] || 1.0
	};

	const pixel_data = create_pixel_array(pixel_buffer, is_signed, bits_allocated);

	return { metadata, pixelData: pixel_data };
}

export function parse_patient_from_dicom(dataSet: dicom_parser_lib.DataSet): Patient {
	return {
		patientUID: dataSet.string('x00100020') as string,
		name: dataSet.string('x00100010') as string,
		birthDate: parse_dicom_date(dataSet.string('x00100030')) as Date,
		sex: dataSet.string('x00100040') as string
	};
}

export function parse_study_from_dicom(dataSet: dicom_parser_lib.DataSet): Study {
	return {
		studyUID: dataSet.string('x0020000d') as string,
		studyDate: parse_dicom_date(dataSet.string('x00080020')) as Date,
		description: dataSet.string('x00081030') as string,
		physicianName: dataSet.string('x00080090') as string,
		institutionName: dataSet.string('x00080080') as string,
		institutionAddress: dataSet.string('x00080081') as string,
		stationName: dataSet.string('x00081010') as string
	};
}

export function parse_series_from_dicom(dataSet: dicom_parser_lib.DataSet): Series {
	return {
		seriesUID: dataSet.string('x0020000e') as string,
		modality: dataSet.string('x00080060') as string,
		bodyPart: dataSet.string('x00180015') as string
	};
}
