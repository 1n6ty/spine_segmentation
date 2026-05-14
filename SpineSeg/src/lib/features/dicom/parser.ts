import type { DicomImageMetadata, DicomImagePixelData, Patient, Series, Study } from "./types";

import * as dicomParser from 'dicom-parser';

/**
 * Parses a DICOM date (DA) or datetime (DT) string into a human-readable format.
 * Returns null if the value is missing or invalid.
 *
 * @param dicomDate - The DICOM date (YYYYMMDD) or datetime (YYYYMMDDHHMMSS.FFFFFF&ZZXX)
 * @returns Human-readable date/time or null
 */
export function parseDicomDate(dicomDate: string | null | undefined): Date | null {
    if (!dicomDate) return null;

    try {
        // Extract year, month, day
        const year = parseInt(dicomDate.slice(0, 4));
        const month = parseInt(dicomDate.slice(4, 6)) - 1; // JS months are 0-indexed
        const day = parseInt(dicomDate.slice(6, 8));

        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

        if (dicomDate.length >= 14) {
            const hours = parseInt(dicomDate.slice(8, 10)) || 0;
            const minutes = parseInt(dicomDate.slice(10, 12)) || 0;
            const seconds = parseInt(dicomDate.slice(12, 14)) || 0;

            return new Date(year, month, day, hours, minutes, seconds);
        }

        return new Date(year, month, day);
    } catch {
        return null;
    }
}

function createPixelArray(
  buffer: ArrayBuffer, 
  isSigned: boolean, 
  bitsAllocated: number
): Int16Array | Uint16Array | Uint8Array {
  if (bitsAllocated === 8) return new Uint8Array(buffer);
  
  // Enforce word-alignment to prevent RangeError during typed array construction
  const length = Math.floor(buffer.byteLength / 2);
  return isSigned 
    ? new Int16Array(buffer, 0, length) 
    : new Uint16Array(buffer, 0, length);
}

export function extractDicomData(dataSet: any) {
  // Transfer Syntax Check
  const transferSyntax = dataSet.string("x00020010") || "1.2.840.10008.1.2.1";
  const isCompressed = ![
    "1.2.840.10008.1.2",
    "1.2.840.10008.1.2.1",
    "1.2.840.10008.1.2.2"
  ].includes(transferSyntax);

  if (isCompressed) {
    throw new Error(`Compressed Transfer Syntax (${transferSyntax}) requires a specialized decoder.`);
  }

  // Safely extract pixel buffer
  const element = dataSet.elements.x7fe00010;
  if (!element || !element.length) throw new Error("No pixel data found in DICOM file.");

  const pixelBuffer = dataSet.byteArray.buffer.slice(
    element.dataOffset,
    element.dataOffset + element.length
  );

  const spacing = (dataSet.string("x00280030") || dataSet.string("x00181164") || "1.0\\1.0").split('\\').map(Number);
  const bitsAllocated = dataSet.uint16("x00280100") || 16;
  const isSigned = dataSet.uint16("x00280103") === 1;

  const metadata: DicomImageMetadata = {
    sopInstanceUID: dataSet.string("x00080018"),
    rows: dataSet.uint16("x00280010"),
    cols: dataSet.uint16("x00280011"),
    slope: Number(dataSet.string("x00281053") || 1),
    intercept: Number(dataSet.string("x00281052") || 0),
    windowCenter: Number(dataSet.string("x00281050") || 0),
    windowWidth: Number(dataSet.string("x00281051") || 0),
    isSigned,
    mmPerPixel: spacing[0] || 1.0
  };

  const pixelData = createPixelArray(pixelBuffer, isSigned, bitsAllocated);

  return { metadata, pixelData };
}

export function parsePatientFromDicom(dataSet: dicomParser.DataSet): Patient {
  return {
    patientUID: dataSet.string("x00100020") as string,
    name: dataSet.string("x00100010") as string,
    birthDate: parseDicomDate(dataSet.string("x00100030")) as Date,
    sex: dataSet.string("x00100040") as string,
  };
}

export function parseStudyFromDicom(dataSet: dicomParser.DataSet): Study {
  return {
    studyUID: dataSet.string("x0020000d") as string,
    studyDate: parseDicomDate(dataSet.string("x00080020")) as Date,
    description: dataSet.string("x00081030") as string,
    physicianName: dataSet.string('x00080090') as string,
    institutionName: dataSet.string('x00080080') as string,
    institutionAddress: dataSet.string('x00080081') as string,
    stationName: dataSet.string('x00081010') as string
  };
}

export function parseSeriesFromDicom(dataSet: dicomParser.DataSet): Series {
  return {
    seriesUID: dataSet.string("x0020000e") as string,
    modality: dataSet.string("x00080060") as string,
    bodyPart: dataSet.string("x00180015") as string
  };
}
