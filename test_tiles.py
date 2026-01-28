import numpy as np
import cv2
import pydicom
from pathlib import Path
from ultralytics import YOLO

def two_pass_instances(
    dicom_path: Path,
    model: YOLO,
    tile_size: int = 640,
    overlap: int = 160,
    conf_threshold: float = 0.2
):
    """
    Two-pass YOLO segmentation on a DICOM image, returning individual instances.
    
    Returns:
        instances: list of dicts with keys:
            'mask': np.ndarray (H, W) binary mask of this instance
            'polygon': np.ndarray (N,2) global coordinates
            'centroid': tuple (cx, cy)
    """

    # -------------------------
    # Load DICOM image
    # -------------------------
    dicom = pydicom.dcmread(str(dicom_path))
    img = dicom.pixel_array.astype(np.float32)
    img = (img - img.min()) / (img.max() - img.min() + 1e-6)
    img = (img * 255).astype(np.uint8)
    H, W = img.shape

    # -------------------------
    # First pass: coarse tiling
    # -------------------------
    stride = tile_size - overlap
    first_pass_centers = []

    for gy in range(0, H, stride):
        for gx in range(0, W, stride):
            x_end = min(gx + tile_size, W)
            y_end = min(gy + tile_size, H)

            tile = img[gy:y_end, gx:x_end]
            tile_rgb = cv2.cvtColor(tile, cv2.COLOR_GRAY2BGR)

            results = model.predict(
                tile_rgb,
                imgsz=tile_size,
                conf=conf_threshold,
                verbose=False
            )

            # Extract polygon centers
            for r in results:
                if not hasattr(r, 'masks') or r.masks is None:
                    continue

                for mask_poly in r.masks.xy:
                    poly = np.array(mask_poly).reshape(-1, 2)
                    if poly.shape[0] < 3:
                        continue

                    cx = int(poly[:, 0].mean()) + gx
                    cy = int(poly[:, 1].mean()) + gy
                    first_pass_centers.append((cx, cy))

    # -------------------------
    # Second pass: refinement tiles
    # -------------------------
    instances = []

    for cx, cy in first_pass_centers:
        x1 = max(cx - tile_size // 2, 0)
        y1 = max(cy - tile_size // 2, 0)
        x2 = min(cx + tile_size // 2, W)
        y2 = min(cy + tile_size // 2, H)

        tile = img[y1:y2, x1:x2]
        tile_rgb = cv2.cvtColor(tile, cv2.COLOR_GRAY2BGR)

        results = model.predict(
            tile_rgb,
            imgsz=tile_size,
            conf=conf_threshold,
            verbose=False
        )

        for r in results:
            if not hasattr(r, 'masks') or r.masks is None:
                continue

            for mask_poly in r.masks.xy:
                poly = np.array(mask_poly).reshape(-1, 2)
                if poly.shape[0] < 3:
                    continue

                # Convert polygon to global coordinates
                poly[:, 0] += x1
                poly[:, 1] += y1

                if cv2.pointPolygonTest(poly.astype(np.int32), (cx, cy), False) < 0:
                    continue

                # Create binary mask for this instance
                mask = np.zeros((H, W), dtype=np.uint8)
                cv2.fillPoly(mask, [poly.astype(np.int32)], 1)

                # Compute centroid
                M = cv2.moments(mask)
                if M["m00"] == 0:
                    continue
                cx_global = int(M["m10"] / M["m00"])
                cy_global = int(M["m01"] / M["m00"])

                instances.append({
                    "mask": mask,
                    "polygon": poly,
                    "centroid": (cx_global, cy_global)
                })

    return instances

import numpy as np

def merge_instances(instances, iou_thresh=0.3):
    merged = []
    used = [False] * len(instances)

    for i, inst_i in enumerate(instances):
        if used[i]:
            continue
        mask_i = inst_i["mask"].astype(bool)
        merged_mask = mask_i.copy()

        for j, inst_j in enumerate(instances):
            if i == j or used[j]:
                continue
            mask_j = inst_j["mask"].astype(bool)
            iou = (mask_i & mask_j).sum() / ((mask_i | mask_j).sum() + 1e-6)
            if iou > iou_thresh:
                merged_mask |= mask_j
                used[j] = True

        contours, _ = cv2.findContours(merged_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if len(contours) == 0:
            continue
        poly_merged = max(contours, key=cv2.contourArea).squeeze(1)
        M = cv2.moments(merged_mask.astype(np.uint8))
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        merged.append({"mask": merged_mask.astype(np.uint8), "polygon": poly_merged, "centroid": (cx, cy)})
        used[i] = True

    return merged


model = YOLO(Path(__file__).resolve().parent / "weights/best_side_new.pt")
dicom_path = Path(__file__).resolve().parent / "Data/spine-segmentation/dicom/side/1.dcm"

instances = two_pass_instances(dicom_path, model)

merged_instances = merge_instances(instances, iou_thresh=0.5)

print(f"Final vertebra count: {len(merged_instances)}")

img = pydicom.dcmread(dicom_path).pixel_array.astype(np.float32)
img = (img - img.min()) / (img.max() - img.min() + 1e-6)
img = (img * 255).astype(np.uint8)
vis = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

for inst in merged_instances:
    mask = inst["mask"].astype(bool)
    color = np.random.randint(0, 255, 3).tolist()
    vis[mask] = color

cv2.imwrite("prediction_overlay.png", vis)