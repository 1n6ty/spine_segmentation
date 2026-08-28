import numpy as np
import cv2

from sahi.predict import get_sliced_prediction

def get_instances(
    pixel_array: np.ndarray,
    detection_model,
    tile_size: int = 640,
    overlap: int = 160,
    iou_threshold: float = 0.3
):
    # 1. Per-image min-max -> uint8. Caller is expected to have already applied
    #    apply_voi_lut + MONOCHROME1 polarity (Dicom.utils.pixels
    #    .dicom_to_windowed_float32), matching model/train.py's load_dicom_uint8.
    img = pixel_array.astype(np.float32)
    img = (img - img.min()) / (img.max() - img.min() + 1e-6)
    img = (img * 255).astype(np.uint8)

    img_rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)

    # 2. Perform Sliced Prediction using the pre-loaded SAHI detection model
    result = get_sliced_prediction(
        img_rgb,
        detection_model,
        slice_height=tile_size,
        slice_width=tile_size,
        overlap_height_ratio=overlap / tile_size,
        overlap_width_ratio=overlap / tile_size,
        postprocess_type="NMM",
        postprocess_match_threshold=iou_threshold
    )

    instances = []

    # 3. Extract polygons from masks
    for object_prediction in result.object_prediction_list:
        mask_obj = object_prediction.mask

        if mask_obj is not None:
            bool_mask = mask_obj.bool_mask
            mask_uint8 = (bool_mask * 255).astype(np.uint8)

            contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            if len(contours) == 0:
                continue

            main_poly = max(contours, key=cv2.contourArea).reshape(-1, 2)

            instances.append({
                "mask": bool_mask,
                "polygon": main_poly,
                "confidence": object_prediction.score.value,
                "class_id": object_prediction.category.id
            })

    return instances
