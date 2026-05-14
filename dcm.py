import os
import pydicom
import numpy as np
import cv2

def merge_dicom_with_pure_red_mask(dicom_folder, mask_folder, output_folder):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    for filename in os.listdir(dicom_folder):
        if filename.lower().endswith(".dcm"):
            try:
                # 1. Load and Normalize DICOM to 8-bit Grayscale
                ds = pydicom.dcmread(os.path.join(dicom_folder, filename))
                img_pixels = ds.pixel_array.astype(float)
                img_norm = ((img_pixels - np.min(img_pixels)) / (np.max(img_pixels) - np.min(img_pixels)) * 255).astype(np.uint8)
                
                # Convert Grayscale to BGR (Color) so we can add Red
                img_bgr = cv2.cvtColor(img_norm, cv2.COLOR_GRAY2BGR)

                # 2. Load Mask
                mask_name = filename.replace(".dcm", ".png")
                mask_path = os.path.join(mask_folder, mask_name)

                if os.path.exists(mask_path):
                    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
                    
                    # Ensure mask size matches DICOM
                    if mask.shape != img_norm.shape:
                        mask = cv2.resize(mask, (img_norm.shape[1], img_norm.shape[0]))

                    # 3. REPLACEMENT (The Secret Sauce)
                    # Create a boolean map where the mask is "on" (white)
                    # We use a threshold to handle any non-pure-black pixels
                    mask_indices = mask > 128 

                    # Force those specific pixels to Pure Red [Blue=0, Green=0, Red=255]
                    img_bgr[mask_indices] = [0, 0, 255]
                    
                    # Save result
                    save_path = os.path.join(output_folder, f"{mask_name}")
                    cv2.imwrite(save_path, img_bgr)
                    print(f"Success: {filename}")
                else:
                    print(f"Missing mask for: {filename}")

            except Exception as e:
                print(f"Error on {filename}: {e}")

# Usage
dicom_dir = 'Data/spine-segmentation/dicom'
mask_dir = 'Data/spine-segmentation/filled'
output_dir = 'Data/spine-segmentation/png_niito'

merge_dicom_with_pure_red_mask(dicom_dir, mask_dir, output_dir)