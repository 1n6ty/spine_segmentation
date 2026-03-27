import numpy as np
import cv2
from ultralytics.models import YOLO

def _two_pass_instances(
    pixel_array: np.ndarray,
    model: YOLO,
    tile_size: int = 640,
    overlap: int = 160,
    conf_threshold: float = 0.5,
    iou_threshold: float = 0.3,
    max_iters: int = 5,
    centroid_eps: float = 15.0
):
    """
    Two-pass YOLO segmentation with iterative centroid refinement.
    """

    def mask_iou(a, b):
        inter = np.logical_and(a, b).sum()
        union = np.logical_or(a, b).sum()
        return inter / (union + 1e-6)

    # -------------------------
    # Load DICOM image
    # -------------------------
    img = pixel_array.astype(np.float32)
    img = (img - img.min()) / (img.max() - img.min() + 1e-6)
    img = (img * 255).astype(np.uint8)
    H, W = img.shape

    stride = tile_size - overlap
    instances = []

    # -------------------------
    # First pass: coarse tiling
    # -------------------------
    for gy in range(0, H, stride):
        for gx in range(0, W, stride):
            tile = img[gy:min(gy + tile_size, H),
                       gx:min(gx + tile_size, W)]
            tile_rgb = cv2.cvtColor(tile, cv2.COLOR_GRAY2BGR)

            results = model.predict(
                tile_rgb,
                imgsz=tile_size,
                conf=conf_threshold,
                verbose=False
            )

            for r in results:
                if r.masks is None:
                    continue

                for poly_local in r.masks.xy:
                    poly_local = np.array(poly_local)
                    if poly_local.shape[0] < 3:
                        continue

                    # initial centroid (global)
                    cx = int(poly_local[:, 0].mean()) + gx
                    cy = int(poly_local[:, 1].mean()) + gy

                    prev_c = np.array([cx, cy], dtype=np.float32)

                    final_mask = None
                    final_poly = None
                    final_centroid = None

                    # -------------------------
                    # Iterative refinement
                    # -------------------------
                    for _ in range(max_iters):
                        x1 = int(max(prev_c[0] - tile_size // 2, 0))
                        y1 = int(max(prev_c[1] - tile_size // 2, 0))
                        x2 = int(min(x1 + tile_size, W))
                        y2 = int(min(y1 + tile_size, H))

                        tile2 = img[y1:y2, x1:x2]
                        tile2_rgb = cv2.cvtColor(tile2, cv2.COLOR_GRAY2BGR)

                        results2 = model.predict(
                            tile2_rgb,
                            imgsz=tile_size,
                            conf=conf_threshold,
                            verbose=False
                        )

                        best = None
                        best_dist = np.inf

                        for r2 in results2:
                            if r2.masks is None:
                                continue

                            for poly in r2.masks.xy:
                                poly = np.array(poly)
                                if poly.shape[0] < 3:
                                    continue

                                poly[:, 0] += x1
                                poly[:, 1] += y1

                                mask = np.zeros((H, W), dtype=np.uint8)
                                cv2.fillPoly(mask, [poly.astype(np.int32)], 1)

                                M = cv2.moments(mask)
                                if M["m00"] == 0:
                                    continue

                                c_new = np.array([
                                    M["m10"] / M["m00"],
                                    M["m01"] / M["m00"]
                                ])

                                dist = np.linalg.norm(c_new - prev_c)
                                if dist < best_dist:
                                    best_dist = dist
                                    best = (mask, poly, c_new)

                        if best is None:
                            break

                        final_mask, final_poly, final_centroid = best

                        # convergence check
                        if np.linalg.norm(final_centroid - prev_c) < centroid_eps:
                            break

                        prev_c = final_centroid

                    if final_mask is None:
                        continue

                    # -------------------------
                    # Instance deduplication
                    # -------------------------
                    duplicate = False
                    for inst in instances:
                        if mask_iou(inst["mask"], final_mask) > iou_threshold:
                            duplicate = True
                            break

                    if duplicate:
                        continue

                    instances.append({
                        "mask": final_mask,
                        "polygon": final_poly,
                        "centroid": (
                            int(final_centroid[0]),
                            int(final_centroid[1])
                        )
                    })

    return instances