from pathlib import Path

import numpy as np
import cv2
import pydicom

from logging import basicConfig, INFO, Logger, getLogger
basicConfig(format="%(asctime)s %(name)s %(levelname)s | %(message)s", level=INFO)
logger: Logger = getLogger("test")

DATA_DIR = Path(__file__).resolve().parent / "Data/physionet.org/files/vindr-spinexr/1.0.0/test_images/"

# ------------------------- Side ----------------------------------

test_file_path: Path = DATA_DIR / "0a02fcb99f78a525dd29f446af7d179d.dicom"
logger.info(f"Start testing side: {test_file_path}")
if test_file_path.suffix == ".dicom":
    side_pixel_array: np.ndarray = pydicom.dcmread(test_file_path).pixel_array
else:
    side_pixel_array: np.ndarray = cv2.cvtColor(cv2.imread(test_file_path), cv2.COLOR_BGR2GRAY)

import seaborn as sns
import matplotlib.pyplot as plt
fig, ax = plt.subplots(nrows=1, ncols=1)

sns.heatmap(side_pixel_array, ax=ax)
plt.show()
