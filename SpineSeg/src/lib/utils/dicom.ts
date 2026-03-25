import type { DicomImageMetadata, DicomImagePixelData } from "$lib/stores/dicom/dicom.type";

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
 * Converts raw DICOM pixel data into a GPU-ready ImageBitmap.
 * Fixed for TypeScript Overload errors.
 */
async function createDicomBitmap(pixelData: DicomImagePixelData, imageMeta: DicomImageMetadata): Promise<ImageBitmap> {
  const { slope, intercept, windowCenter, windowWidth, rows, cols } = imageMeta;
  
  // Guard against missing dimensions
  if (!rows || !cols || !pixelData) {
    throw new Error("Invalid DICOM metadata or pixel data");
  }

  const numPixels = rows * cols;
  const output = new Uint8ClampedArray(numPixels * 4);

  // 2. Pre-calculate windowing constants to save CPU cycles
  const low = windowCenter - windowWidth / 2;
  const high = windowCenter + windowWidth / 2;
  const range = windowWidth || 1; // Prevent division by zero

  for (let i = 0; i < numPixels; i++) {
    // FIX: Access pixelData directly (not .buffer)
    // The TypedArray (Uint16/Int16) handles the 2-byte offset automatically
    const rawVal = pixelData[i];
    const val = rawVal * slope + intercept;

    let intensity: number;
    if (val <= low) {
      intensity = 0;
    } else if (val >= high) {
      intensity = 255;
    } else {
      intensity = ((val - low) / range) * 255;
    }

    const idx = i * 4;
    output[idx] = intensity;     // R
    output[idx + 1] = intensity; // G
    output[idx + 2] = intensity; // B
    output[idx + 3] = 255;       // A
  }

  // 3. Create ImageData with explicit dimensions
  const imageData = new ImageData(output, cols, rows);
  
  return await createImageBitmap(imageData);
}

export { parseDicomDate, createDicomBitmap };