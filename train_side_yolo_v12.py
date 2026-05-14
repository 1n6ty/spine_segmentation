import pydicom, cv2, shutil, os
from pathlib import Path
import numpy as np
from random import random

from ultralytics import YOLO

import logging
logging.basicConfig(format="%(asctime)s %(name)s %(levelname)s | %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)


def tile_image(dicom_path: Path, filled_path: Path, tile_size: int, overlap: int, save_dir: Path, keep_empty=0.2, jitter=80):
    img = pydicom.dcmread(str(dicom_path)).pixel_array.astype(np.float32)
    img = (img - img.min()) / (img.max() - img.min() + 1e-6)
    img = (img * 255).astype(np.uint8)

    filled = cv2.imread(str(filled_path))

    h, w = img.shape

    tiles_dir = save_dir / "images"
    labels_dir = save_dir / "labels"
    tiles_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)

    tile_id = 0
    stride = tile_size - overlap
    for gy in range(0, h, stride):
        for gx in range(0, w, stride):

            jx = int((random() * 2 - 1) * jitter)
            jy = int((random() * 2 - 1) * jitter)

            x = np.clip(gx + jx, 0, max(0, w - tile_size))
            y = np.clip(gy + jy, 0, max(0, h - tile_size))

            x_end = min(x + tile_size, w)
            y_end = min(y + tile_size, h)

            tile = img[y:y_end, x:x_end]
            filled_tile = filled[y:y_end, x:x_end]

            # vertebrae
            tresh = cv2.inRange(filled_tile, np.array([0, 0, 200], dtype=np.uint8), np.array([100, 100, 255], dtype=np.uint8))
            contours, hierarchy = cv2.findContours(tresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            label_txt = ""
            for cnt in contours:
                if cnt.shape[0] < 3 or cv2.contourArea(cnt) / (tile_size * tile_size) < 0.001:
                    continue

                cnt = cnt.squeeze(1).astype(np.float32)
                cnt = cnt.astype(np.float32)

                cnt[:, 0] /= x_end - x
                cnt[:, 1] /= y_end - y
                cnt = np.clip(cnt, 0, 1)

                flat = cnt.flatten().tolist()
                label_txt += "0 " + " ".join([f"{v:.6f}" for v in flat]) + "\n"
            
            label_name = f"{Path(dicom_path).stem}_{tile_id}.txt"
            tile_name = f"{Path(dicom_path).stem}_{tile_id}.png"

            if (label_txt == "" and random() < keep_empty) or (label_txt != ""):
                cv2.imwrite(str(tiles_dir / tile_name), tile)
                with open(labels_dir / label_name, 'w') as f:
                    f.write(label_txt)

            tile_id += 1

MODE = "side"
BASE_DIR = Path(__file__).resolve().parent
TMP_DIR = BASE_DIR / f'tmp/tiles/{MODE}'

KEEP_EMPTY_PROB = 0.2
VAL_TO_TRAIN_RATIO = 0.2
TILE_SIZE = 640
TILE_OVERLAP = 160
JITTER = 80

import torch
torch.set_num_threads(32)

if __name__ == "__main__":
    logger.info("Creating tmp directory")
    if TMP_DIR.exists():
        logger.info("Tmp already exists, removing it")
        shutil.rmtree(TMP_DIR)
    TMP_DIR.mkdir(parents=True)

    logger.info("Tiling images")
    for dcm_file_path, png_file_path in zip(
        sorted(os.listdir(BASE_DIR / f"Data/spine-segmentation/dicom/{MODE}/")),
        sorted(os.listdir(BASE_DIR / f"Data/spine-segmentation/filled/{MODE}/"))
    ):
        direction = 'train' if random() > VAL_TO_TRAIN_RATIO else 'val'
        tile_image(
            BASE_DIR / f"Data/spine-segmentation/dicom/{MODE}/" / dcm_file_path,
            BASE_DIR / f"Data/spine-segmentation/filled/{MODE}/" / png_file_path,
            TILE_SIZE,
            TILE_OVERLAP,
            save_dir=TMP_DIR / direction,
            keep_empty=KEEP_EMPTY_PROB,
            jitter=JITTER
        )
        logger.info(f"Image {dcm_file_path} has been tiled into {direction}")

    logger.info("Creating data.yaml file")
    with open(str(TMP_DIR / "data.yaml"), 'w') as f:
        f.write(
f"""path: {TMP_DIR}
train: train
val: val

train_label_dir: train/labels
val_label_dir: val/labels

names:
    0: vertebrae"""
        )

    yolo_model_name = "yolo26m-seg.pt"
    model = YOLO(yolo_model_name)
    logger.info(f"Start training model {yolo_model_name}")

    model.train(
        data=str(TMP_DIR / "data.yaml"),
        epochs=500,
        imgsz=TILE_SIZE,
        batch=4,
        device="cpu",

        # ---- Augmentations ----
        # hsv_h=0.0,
        # hsv_s=0.0,
        # hsv_v=0.15,

        # fliplr=0.5,
        # flipud=0.0,

        # scale=0.2,
        # translate=0.05,
        degrees=7.0,

        # mosaic=0.0,
        mixup=0.0,

        # ---- Optimization ----
        optimizer="AdamW",
        lr0=0.0005,
        weight_decay=0.0005,

        # ---- Logging ----
        patience=20,
        plots=True,
        project=str(BASE_DIR / f"{MODE}-exp")
    )
