from pathlib import Path

import numpy as np
import cv2
import pydicom

from ultralytics import YOLO

from segmentation.compose import segment_spine_from_S1_to_C2

from logging import basicConfig, DEBUG, INFO, Logger, getLogger
basicConfig(format="%(asctime)s %(name)s %(levelname)s | %(message)s", level=INFO)
logger: Logger = getLogger("test")

DATA_DIR = Path(__file__).resolve().parent.parent / "Data/spine-segmentation/"

# ------------------------- Side ----------------------------------

from PIL import Image
from pydicom.pixels import apply_voi_lut

def open_dicom(dicom_path):
    ds = pydicom.dcmread(dicom_path)
    
    # 1. Apply Value of Interest (VOI) LUT (handles Window Center/Width)
    # This transforms raw Hounsfield Units/pixel values into viewable intensities
    out = apply_voi_lut(ds.pixel_array, ds)

    return out

#test_file_path: Path = Path(__file__).resolve().parent.parent / "Data/physionet.org/files/vindr-spinexr/1.0.0/test_images/0d192c436070f2c7030b942994e6dc80.dicom"
test_file_path: Path = Path(__file__).resolve().parent.parent / "Data/spine-segmentation/dicom/001_SD.dcm"
logger.info(f"Start testing side: {test_file_path}")

# Usage
side_pixel = open_dicom(str(test_file_path))
side_vertebraes = segment_spine_from_S1_to_C2(side_pixel, str(Path(__file__).resolve().parent / "side-exp/train4/weights/best.pt"))

side_spine_conv: np.ndarray = np.zeros_like(side_pixel, dtype=np.uint8)
for v in side_vertebraes:
    cv2.fillConvexPoly(side_spine_conv, v.mask_xy, 255, 1)
    cv2.polylines(side_spine_conv, [v.reference_points], True, 200, 3)
    
    for p in range(0, 4):
        cv2.circle(side_spine_conv, v.reference_points[p], 5, (p + 1) * 50, 5, 0)

import seaborn as sns
import matplotlib.pyplot as plt

fig, ax = plt.subplots(nrows=1, ncols=2)

sns.heatmap(side_spine_conv, ax=ax[0])
sns.heatmap(side_pixel, ax=ax[1])
plt.show()
