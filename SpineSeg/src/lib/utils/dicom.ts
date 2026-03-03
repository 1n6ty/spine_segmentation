import type { DicomImage } from "$lib/stores/dicom/dicom.type";

/**
 * Parses a DICOM date (DA) or datetime (DT) string into a human-readable format.
 * Returns null if the value is missing or invalid.
 *
 * @param dicomDate - The DICOM date (YYYYMMDD) or datetime (YYYYMMDDHHMMSS.FFFFFF&ZZXX)
 * @returns Human-readable date/time or null
 */
function parseDicomDate(dicomDate: string | null | undefined): string | null {
    if (!dicomDate) return null;

    try {
        // Extract year, month, day
        const year = parseInt(dicomDate.slice(0, 4));
        const month = parseInt(dicomDate.slice(4, 6)) - 1; // JS months are 0-indexed
        const day = parseInt(dicomDate.slice(6, 8));

        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

        // Check if datetime with hours/minutes/seconds exists
        const hasTime = dicomDate.length >= 14;
        let date: Date;

        if (hasTime) {
            const hours = parseInt(dicomDate.slice(8, 10)) || 0;
            const minutes = parseInt(dicomDate.slice(10, 12)) || 0;
            const seconds = parseInt(dicomDate.slice(12, 14)) || 0;

            date = new Date(year, month, day, hours, minutes, seconds);
        } else {
            date = new Date(year, month, day);
        }

        // Format nicely
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
        if (hasTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        return date.toLocaleString('ru-RU', options);
    } catch {
        return null;
    }
}

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

/**
 * Converts raw DICOM pixel data into a GPU-ready ImageBitmap.
 * Fixed for TypeScript Overload errors.
 */
async function createDicomBitmap(image: any): Promise<ImageBitmap> {
  const rows = image.rows;
  const cols = image.cols;
  const pixelData = image.pixelData;
  const { slope, intercept, windowCenter, windowWidth } = image;

  const numPixels = rows * cols;
  const output = new Uint8ClampedArray(numPixels * 4);

  const low = windowCenter - windowWidth / 2;
  const high = windowCenter + windowWidth / 2;

  for (let i = 0; i < numPixels; i++) {
    const val = pixelData[i] * slope + intercept;

    let intensity = 0;
    if (val <= low) intensity = 0;
    else if (val > high) intensity = 255;
    else intensity = ((val - low) / windowWidth) * 255;

    const idx = i * 4;
    output[idx] = intensity;     // R
    output[idx + 1] = intensity; // G
    output[idx + 2] = intensity; // B
    output[idx + 3] = 255;       // A
  }

  // FIX: Explicitly cast or ensure rows/cols are numbers to satisfy Overload 2
  const imageData = new ImageData(output, cols, rows);
  
  return await createImageBitmap(imageData);
}

export { parseDicomDate, getPatientAge, createDicomBitmap };