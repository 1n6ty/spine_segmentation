# from pathlib import Path

# import numpy as np
# import cv2
# import pydicom

from logging import basicConfig, INFO, Logger, getLogger
basicConfig(format="%(asctime)s %(name)s %(levelname)s | %(message)s", level=INFO)
logger: Logger = getLogger("test")

# DATA_DIR = Path(__file__).resolve().parent / "Data/physionet.org/files/vindr-spinexr/1.0.0/test_images/"

# # ------------------------- Side ----------------------------------

# test_file_path: Path = DATA_DIR / "0a02fcb99f78a525dd29f446af7d179d.dicom"
# logger.info(f"Start testing side: {test_file_path}")
# if test_file_path.suffix == ".dicom":
#     side_pixel_array: np.ndarray = pydicom.dcmread(test_file_path).pixel_array
# else:
#     side_pixel_array: np.ndarray = cv2.cvtColor(cv2.imread(test_file_path), cv2.COLOR_BGR2GRAY)

# import seaborn as sns
# import matplotlib.pyplot as plt
# fig, ax = plt.subplots(nrows=1, ncols=1)

# sns.heatmap(side_pixel_array, ax=ax)
# plt.show()


import pandas as pd
from pathlib import Path

# Configuration
FILE_DIR = Path(__file__).resolve().parent.parent / "Data/physionet.org/files/vindr-spinexr/1.0.0"
BASE_DIR = FILE_DIR / "test_images"
CSV_PATH = FILE_DIR / "annotations/test.csv"

TARGET_LESIONS = ['Osteophytes', 'No finding', 'Vertebral collapse']

def load_and_clean_data(csv_path, base_dir, target_labels):
    # 1. Load and initial filter by lesion type
    df = pd.read_csv(csv_path)
    df = df[df['lesion_type'].isin(target_labels)].copy()
    
    # 2. Map file paths (Case-insensitive suffix check)
    search_path = Path(base_dir).resolve()
    file_map = {p.stem: str(p) for p in search_path.rglob("*") if p.suffix.lower() == ".dicom"}
    df['file_path'] = df['image_id'].map(file_map)

    # 3. Apply strict NaN filtering
    # Rule: If it's NOT 'No finding', all columns must be non-NaN.
    # Rule: If it IS 'No finding', we only care if the 'file_path' exists.
    
    # Split the dataframe into two groups
    no_finding_mask = df['lesion_type'] == 'No finding'
    
    # Group A: 'No finding' - only drop if the file_path is missing
    group_a = df[no_finding_mask].dropna(subset=['file_path'])
    
    # Group B: Pathologies - drop if ANY field is NaN (including coordinates)
    group_b = df[~no_finding_mask].dropna()
    
    # Combine them back together
    df_final = pd.concat([group_a, group_b], ignore_index=True)
    
    # 4. Final verification
    print(f"--- Data Integrity Check ---")
    print(f"Final dataset size: {len(df_final)}")
    print(f"Pathology rows: {len(group_b)}")
    print(f"Normal (No finding) rows: {len(group_a)}")
    print(df_final.info())
    
    return df_final

# Usage
df_final = load_and_clean_data(CSV_PATH, BASE_DIR, TARGET_LESIONS)

import numpy as np
from segmentation.elements import Vertebrae

def _compute_p5s(v: Vertebrae) -> np.float32:
    r = np.degrees(
        np.arccos(
            ((v.reference_points[1][0] - v.reference_points[0][0]) * (v.reference_points[2][0] - v.reference_points[3][0]) + (v.reference_points[1][1] - v.reference_points[0][1]) * (v.reference_points[2][1] - v.reference_points[3][1])) / ((self._compute_p3s(i, v)[0] * self._compute_p4s(i, v)[0] + 1e-9))
        )
    )
    return r

def _compute_p6s(v: Vertebrae) -> np.float32:
    return np.arctan((v.reference_points[0][0] - v.reference_points[1][0]) / (v.reference_points[1][1] - v.reference_points[0][1] + 1e-9))

def _compute_p7s(v: Vertebrae) -> np.float32:
    r = np.degrees(
        np.arctan((v.reference_points[1][0] - v.reference_points[2][0]) / (v.reference_points[1][1] - v.reference_points[2][1] + 1e-9))
    )
    return r

def _compute_p8s(v: Vertebrae) -> np.float32:
    return np.arctan((v.reference_points[0][0] - v.reference_points[3][0]) / (v.reference_points[0][1] - v.reference_points[3][1] + 1e-9))

import pydicom
import matplotlib.pyplot as plt

from ultralytics.models import YOLO

from segmentation.compose import segment_spine_from_S1_to_C2

SPINE_MODEL = YOLO(Path(__file__).resolve().parent.parent / 'backend/Mainland/Dicom/tasks/weights/yolo26m-seg-sag.pt')

def visualize_entry(df, row_index=0):
    """
    Opens a DICOM file from the dataframe and draws the bounding box/points.
    """
    # 1. Get the data from the specific row
    row = df.iloc[row_index]
    file_path = row['file_path']
    lesion_type = row['lesion_type']
    
    if pd.isna(file_path) or not Path(file_path).exists():
        print(f"Error: File not found at {file_path}")
        return

    # 2. Load the DICOM file
    ds = pydicom.dcmread(file_path)
    img = ds.pixel_array # The raw pixel data
    
    # 3. Handle coordinate display
    # If 'No finding', coordinates might be NaN; we handle that gracefully
    has_coords = not pd.isna(row['xmin'])
    
    # 4. Set up the plot
    fig, ax = plt.subplots(1, figsize=(10, 10))
    
    # Normalize image for display (Min-Max scaling to 0-255)
    img_min, img_max = img.min(), img.max()
    img_scaled = (img - img_min) / (img_max - img_min)
    
    ax.imshow(img_scaled, cmap='gray')
    ax.set_title(f"ID: {row['image_id']} | Type: {lesion_type}")
    
    vertebraes = segment_spine_from_S1_to_C2(img, SPINE_MODEL, conf=0.5)
    logger.info("segmenting done")
    if has_coords:
        xmin, ymin, xmax, ymax = row['xmin'], row['ymin'], row['xmax'], row['ymax']
        
        # Add a label for the lesion
        plt.text(xmin, ymin - 10, lesion_type, color='red', weight='bold')
        
        # Draw center points if you are preparing for Points2Vec
        center_x = (xmin + xmax) / 2
        center_y = (ymin + ymax) / 2
        ax.plot(center_x, center_y, 'ro', markersize=5) 
        
        closestV = None
        min_dist = float('inf')
        for v in vertebraes:
            for r in v.reference_points:
                ax.plot(r[0], r[1], 'go', markersize=5)
                d = np.linalg.norm(r - np.array([center_x, center_y], dtype=np.float32))
                if d < min_dist:
                    min_dist = d
                    closestV = v

        for r in closestV.reference_points:
            ax.plot(r[0], r[1], 'bo', markersize=5)

    plt.axis('off')
    plt.show()

logger.info("Start segmenting")
visualize_entry(df_final, row_index=1230)