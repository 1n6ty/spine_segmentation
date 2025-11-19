from pathlib import Path

import numpy as np
import cv2
import pydicom

from ultralytics import YOLO

from segmentation.elements.spine import PSpine
from segmentation.elements.utils import segment_vertebraes

from logging import basicConfig, INFO, Logger, getLogger
basicConfig(format="%(asctime)s %(name)s %(levelname)s | %(message)s", level=INFO)
logger: Logger = getLogger("test")

DATA_DIR = Path(__file__).resolve().parent / "Data/spine-segmentation/"

# ------------------------- Side ----------------------------------

test_file_path: Path = DATA_DIR / "t_side.png"
logger.info(f"Start testing side: {test_file_path}")
if test_file_path.suffix == ".dcm":
    side_pixel_array: np.ndarray = pydicom.dcmread(test_file_path).pixel_array
else:
    side_pixel_array: np.ndarray = cv2.cvtColor(cv2.imread(test_file_path), cv2.COLOR_BGR2GRAY)

model: YOLO = YOLO(Path(__file__).resolve().parent / "weights/best.pt")
side_vertebraes = segment_vertebraes(side_pixel_array, model)
side_spine: PSpine = PSpine("side", side_vertebraes)

side_spine_conv: np.ndarray = np.zeros_like(side_pixel_array, dtype=np.uint8)
for v in side_spine.vertebraes:
    cv2.fillConvexPoly(side_spine_conv, v.mask_xy, 255, 1)
    cv2.polylines(side_spine_conv, [v.reference_points], True, 200, 3)
    if not (v.p is None):
        cv2.circle(side_spine_conv, side_spine.vpath.f(v.p.t_up).astype(np.int32), 5, 150, 5, 0)
        cv2.circle(side_spine_conv, side_spine.vpath.f(v.p.t_bottom).astype(np.int32), 5, 150, 5, 0)
    for p in range(0, 4):
        cv2.circle(side_spine_conv, v.reference_points[p], 5, (p + 1) * 50, 5, 0)
for i in np.linspace(side_spine.vpath._t[0], side_spine.vpath._t[-1], 3000):
    side_spine_conv[*side_spine.vpath.f(i).astype(np.int32)[::-1]] = 150

# ------------------------- Frontal -------------------------------

test_file_path: Path = DATA_DIR / "t_front.png"
logger.info(f"Start testing front: {test_file_path}")
if test_file_path.suffix == ".dcm":
    front_pixel_array: np.ndarray = pydicom.dcmread(test_file_path).pixel_array
else:
    front_pixel_array: np.ndarray = cv2.cvtColor(cv2.imread(test_file_path), cv2.COLOR_BGR2GRAY)

model: YOLO = YOLO(Path(__file__).resolve().parent / "weights/best.pt")

front_vertebraes = segment_vertebraes(front_pixel_array, model)
front_spine: PSpine = PSpine("frontal", front_vertebraes, side_spine=side_spine)

front_spine_conv: np.ndarray = np.zeros_like(front_pixel_array, dtype=np.uint8)
for v in front_spine.vertebraes:
    cv2.fillConvexPoly(front_spine_conv, v.mask_xy, 255, 1)
    cv2.polylines(front_spine_conv, [v.reference_points], True, 200, 3)
    if not (v.p is None):
        cv2.circle(front_spine_conv, front_spine.vpath.f(v.p.t_up).astype(np.int32), 5, 150, 5, 0)
        cv2.circle(front_spine_conv, front_spine.vpath.f(v.p.t_bottom).astype(np.int32), 5, 150, 5, 0)
    for p in range(0, 4):
        cv2.circle(front_spine_conv, v.reference_points[p], 5, (p + 1) * 50, 5, 0)
for i in np.linspace(front_spine.vpath._t[0], front_spine.vpath._t[-1], 3000):
    front_spine_conv[*front_spine.vpath.f(i).astype(np.int32)[::-1]] = 150

# TODO Alignment by head of leg

# -------------------------Assembling-------------------------

dfs = {
    "Саг. Позвонки": side_spine.vertebraes_parameters.dataframe,
    "Саг. Межпозвонковые диски": side_spine.gap_parameters.dataframe,
    "Саг. Сегменты": side_spine.segment_parameters.dataframe,
    "Саг. Позвоночник": side_spine.spine_parameters.dataframe,
    "Фронт. Позвонки": front_spine.vertebraes_parameters.dataframe,
    "Фронт. Межпозвонковые диски": front_spine.gap_parameters.dataframe,
    "Фронт. Сегменты": front_spine.segment_parameters.dataframe,
    "Фронт. Позвоночник": front_spine.spine_parameters.dataframe
}

import pandas as pd
with pd.ExcelWriter("report.xlsx", engine="openpyxl") as writer:
    for sheet_name, df in dfs.items():
        df.to_excel(writer, sheet_name=sheet_name, index=True)

    workbook = writer.book

    for sheet_name, df in dfs.items():
        sheet = workbook[sheet_name]

        for row in sheet.iter_rows(min_row=2):
            for cell in row:
                if isinstance(cell.value, (int, float)):
                    cell.number_format = "0.00"

import seaborn as sns
import matplotlib.pyplot as plt
fig, ax = plt.subplots(nrows=1, ncols=4)

sns.heatmap(front_pixel_array, ax=ax[0])
sns.heatmap(front_spine_conv, ax=ax[1])
sns.heatmap(side_pixel_array, ax=ax[2])
sns.heatmap(side_spine_conv, ax=ax[3])
plt.show()
