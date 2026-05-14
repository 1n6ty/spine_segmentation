import type { DicomImageMetadata, DicomImagePixelData } from "./types";

/**
 * Converts raw DICOM pixel data into a GPU-ready ImageBitmap.
 * Fixed for TypeScript Overload errors.
 */
export async function createDicomBitmap(pixelData: DicomImagePixelData, imageMeta: DicomImageMetadata): Promise<ImageBitmap> {
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