import numpy as np
import cv2
from ultralytics.models import YOLO

import numpy as np
import cv2
from sahi import AutoDetectionModel
from sahi.predict import get_sliced_prediction

def get_instances(
    pixel_array: np.ndarray,
    model_path: str,
    tile_size: int = 640,
    overlap: int = 160,
    conf_threshold: float = 0.5,
    iou_threshold: float = 0.3
):
    # 1. Normalize and prepare image (similar to your DICOM prep)
    img = pixel_array.astype(np.float32)
    img = (img - img.min()) / (img.max() - img.min() + 1e-6)
    img = (img * 255).astype(np.uint8)
    
    img_rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)

    # 2. Initialize SAHI Model Wrapper
    detection_model = AutoDetectionModel.from_pretrained(
        model_type="ultralytics",
        model_path=model_path,
        confidence_threshold=conf_threshold,
        device="cpu", # Change to "cuda:0" for GPU
    )

    # 3. Perform Sliced Prediction
    # overlap_height_ratio = overlap / tile_size
    result = get_sliced_prediction(
        img_rgb,
        detection_model,
        slice_height=tile_size,
        slice_width=tile_size,
        overlap_height_ratio=overlap / tile_size,
        overlap_width_ratio=overlap / tile_size,
        postprocess_type="NMM", # Non-Maximum Merging (better for segments)
        postprocess_match_threshold=iou_threshold
    )

    instances = []

    # 4. Extract data into your desired format
    for object_prediction in result.object_prediction_list:
        mask_obj = object_prediction.mask
        
        if mask_obj is not None:
            # Full-sized boolean mask (H, W)
            bool_mask = mask_obj.bool_mask
            
            # Convert to uint8 for polygon extraction if necessary
            # or use the polygon already in the mask object
            mask_uint8 = (bool_mask * 255).astype(np.uint8)
            
            # Find contours to get the final polygon
            contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if len(contours) == 0:
                continue
                
            # Get the largest contour as the main polygon
            main_poly = max(contours, key=cv2.contourArea).reshape(-1, 2)

            instances.append({
                "mask": bool_mask,
                "polygon": main_poly,
                "confidence": object_prediction.score.value,
                "class_id": object_prediction.category.id
            })

    return instances
