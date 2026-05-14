from logging import basicConfig, INFO, Logger, getLogger
basicConfig(format="%(asctime)s %(name)s %(levelname)s | %(message)s", level=INFO)
logger: Logger = getLogger("test")

import pandas as pd
from pathlib import Path

# Configuration
FILE_DIR = Path(__file__).resolve().parent.parent / "Data/physionet.org/files/vindr-spinexr/1.0.0"
BASE_DIR = FILE_DIR / "test_images"
CSV_PATH = FILE_DIR / "annotations/test.csv"

TARGET_LESIONS = ['No finding', 'Osteophytes', 'Vertebral collapse']

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
    df_final.info()
    
    return df_final

# Usage
df_final = load_and_clean_data(CSV_PATH, BASE_DIR, TARGET_LESIONS)

import numpy as np
from segmentation.elements import Vertebrae

def _compute_p3s(v: Vertebrae) -> np.float32:
    return np.linalg.norm(v.reference_points[0] - v.reference_points[1])

def _compute_p4s(v: Vertebrae) -> np.float32:
    return np.linalg.norm(v.reference_points[2] - v.reference_points[3])

def _compute_p5s(v: Vertebrae) -> np.float32:
    return np.arccos(
        ((v.reference_points[1][0] - v.reference_points[0][0]) * (v.reference_points[2][0] - v.reference_points[3][0]) + (v.reference_points[1][1] - v.reference_points[0][1]) * (v.reference_points[2][1] - v.reference_points[3][1])) / ((_compute_p3s(v) * _compute_p4s(v) + 1e-9))
    )

def _compute_p6s(v: Vertebrae) -> np.float32:
    return np.arctan((v.reference_points[0][0] - v.reference_points[1][0]) / (v.reference_points[1][1] - v.reference_points[0][1] + 1e-9))

def _compute_p7s(v: Vertebrae) -> np.float32:
    return np.arctan((v.reference_points[1][0] - v.reference_points[2][0]) / (v.reference_points[1][1] - v.reference_points[2][1] + 1e-9))

def _compute_p8s(v: Vertebrae) -> np.float32:
    return np.arctan((v.reference_points[0][0] - v.reference_points[3][0]) / (v.reference_points[0][1] - v.reference_points[3][1] + 1e-9))

import pydicom
from ultralytics.models import YOLO
from segmentation.compose import segment_spine_from_S1_to_C2

from random import choice

SPINE_MODEL = YOLO(Path(__file__).resolve().parent / "side-exp/train/weights/best.pt")

import numpy as np

def normalize_landmarks(landmarks):
    """
    Normalizes a set of landmarks for a single vertebra or disk to be 
    scale and rotation invariant.
    
    Args:
        landmarks (np.ndarray): Shape (N, 2) array of [x, y] coordinates.
        
    Returns:
        dict: Normalized landmarks and the transformation metadata.
    """
    # 1. Centering: Move the centroid to (0, 0)
    centroid = np.mean(landmarks, axis=0)
    centered_pts = landmarks - centroid
    
    # 2. Scaling: Calculate Centroid Size (S)
    # S = sqrt(sum(dist(point, centroid)^2))
    centroid_size = np.sqrt(np.sum(np.power(centered_pts, 2)))
    scaled_pts = centered_pts / centroid_size
    
    # 3. Alignment: Use PCA to find the local orientation (Pose)
    # This aligns the "long axis" of the vertebra to the X-axis
    covariance_matrix = np.cov(scaled_pts.T)
    eigenvalues, eigenvectors = np.linalg.eig(covariance_matrix)
    
    # Sort eigenvectors by eigenvalues to find the principal axis
    order = np.argsort(eigenvalues)[::-1]
    rotation_matrix = eigenvectors[:, order]
    
    # Rotate points into the local coordinate frame
    local_pts = scaled_pts @ rotation_matrix
    
    return local_pts


def get_indexes_with_lession(df, lesion_type: str):
    """
    Returns a list of positional indices (for .iloc) where the 
    lesion_type matches the requested string.
    """
    # Create a boolean mask where the column matches the type
    mask = df['lesion_type'] == lesion_type
    
    # np.where returns a tuple of indices; [0] gets the array of positions
    indices = np.where(mask)[0]
    
    return indices.tolist()


def entryVertebra2Vec(df, target_lesions: list[str], row_index=0):
    """
    Opens a DICOM file from the dataframe and draws the bounding box/points.
    """
    # 1. Get the data from the specific row
    row = df.iloc[row_index]
    file_path = row['file_path']
    lesion_type = row['lesion_type']
    
    if pd.isna(file_path) or not Path(file_path).exists():
        print(f"Error: File not found at {file_path}")
        return None

    # 2. Load the DICOM file
    ds = pydicom.dcmread(file_path)
    img = ds.pixel_array # The raw pixel data
    
    # 3. Handle coordinate display
    # If 'No finding', coordinates might be NaN; we handle that gracefully
    has_coords = not pd.isna(row['xmin'])
    
    # Normalize image for display (Min-Max scaling to 0-255)
    img_min, img_max = img.min(), img.max()
    img_scaled = (img - img_min) / (img_max - img_min)
    
    logger.info("Start segmenting")
    try:
        vertebraes = segment_spine_from_S1_to_C2(img_scaled, SPINE_MODEL, conf=0.5)
    except:
        logger.warning('Segmentation fail')
        return None
    logger.info("Segmenting done")

    if has_coords:
        xmin, ymin, xmax, ymax = row['xmin'], row['ymin'], row['xmax'], row['ymax']
        
        center_x = (xmin + xmax) / 2
        center_y = (ymin + ymax) / 2
        
        closestV = None
        min_dist = float('inf')
        for v in vertebraes:
            for r in v.reference_points:
                d = np.linalg.norm(r - np.array([center_x, center_y], dtype=np.float32))
                if d < min_dist:
                    min_dist = d
                    closestV = v
        
        vcentroid = np.mean(closestV.reference_points, axis=0)
        d = np.linalg.norm(vcentroid - np.array([center_x, center_y], dtype=np.float32))
        print(d)
    else:
        closestV = choice(vertebraes)

    normal_landmarks = normalize_landmarks(closestV.reference_points)

    vcentroid = np.mean(normal_landmarks, axis=0)
    local_ref_points = np.linalg.norm(normal_landmarks - vcentroid, axis=1).flatten()

    max_vals = np.max(normal_landmarks, axis=0)
    min_vals = np.min(normal_landmarks, axis=0)

    width = max_vals[0] - min_vals[0]
    height = max_vals[1] - min_vals[1]

    # 2. Compute the Aspect Ratio
    aspect_ratio = width / height
    area_bbox = width * height

    return (np.append(local_ref_points, [area_bbox, aspect_ratio, _compute_p5s(closestV), _compute_p6s(closestV), _compute_p7s(closestV), _compute_p8s(closestV)]), target_lesions.index(lesion_type))

# l_arr = get_indexes_with_lession(df_final, TARGET_LESIONS[1])
# from random import choice
# for i in range(5):
#     print(entryVertebra2Vec(df_final, TARGET_LESIONS, row_index=choice(l_arr)))

def is_lateral(ds):
    # 1. Check View Position (The standard)
    view_pos = str(ds.get("ViewPosition", "")).upper()
    if any(x in view_pos for x in ["LAT", "LL", "RL"]):
        return True
        
    # 2. Check Series Description (The technician's note)
    series_desc = str(ds.get("SeriesDescription", "")).upper()
    if "LATERAL" in series_desc or " LAT " in f" {series_desc} ":
        return True
        
    # 3. Check Patient Orientation (The anatomical axis)
    # Lateral views usually have A (Anterior) or P (Posterior) in the orientation
    pat_orient = ds.get("PatientOrientation", [])
    if any(any(c in axis for c in ["A", "P"]) for axis in pat_orient):
        return True

    return False

import cv2
def entry2img(df, row_index=0):
    # 1. Get the data from the specific row
    row = df.iloc[row_index]
    file_path = row['file_path']
    
    if pd.isna(file_path) or not Path(file_path).exists():
        print(f"Error: File not found at {file_path}")
        return None

    # 2. Load the DICOM file
    ds = pydicom.dcmread(file_path)

    img = ds.pixel_array # The raw pixel data
    
    # Normalize image for display (Min-Max scaling to 0-255)
    img_min, img_max = img.min(), img.max()
    img_scaled = (img - img_min) / (img_max - img_min)
    
    has_coords = not pd.isna(row['xmin'])

    img_uint = cv2.cvtColor((img_scaled * 255).astype(np.uint8), cv2.COLOR_GRAY2RGB)

    if has_coords:
        xmin, ymin, xmax, ymax = row['xmin'], row['ymin'], row['xmax'], row['ymax']
        
        center_x = (xmin + xmax) / 2
        center_y = (ymin + ymax) / 2
    
    if has_coords:
        xmin, ymin, xmax, ymax = row['xmin'], row['ymin'], row['xmax'], row['ymax']
        
        center_x = (xmin + xmax) / 2
        center_y = (ymin + ymax) / 2

        cv2.circle(img_uint, np.array([center_x, center_y], dtype=np.int32), 5, (255, 0, 0), 5)

    fpath = Path(row['file_path'])
    if not (fpath.resolve().parent.parent / f'test_img/{fpath.stem}.png').exists():
        cv2.imwrite(fpath.resolve().parent.parent / f'test_img/{fpath.stem}.png', img_uint)

import matplotlib.pyplot as plt
import pydicom
import cv2
import numpy as np
from pathlib import Path

import math

def display_lateral_images(df, start_index=0, total_count=10, grid_cols=5):
    """
    Filters for lateral projections starting from a specific index.
    
    Args:
        df: The input DataFrame.
        start_index: The row index to start searching from.
        total_count: Number of lateral images to find and display.
        grid_cols: How many images per row in the plot.
    """
    images = []
    found_indices = []
    
    # Slice the dataframe to start from your chosen index
    search_space = df.iloc[start_index:]
    
    for idx, row in search_space.iterrows():
        if len(images) >= total_count:
            break
            
        file_path = row['file_path']
        if not Path(file_path).exists():
            continue
        
        ds = pydicom.dcmread(file_path, stop_before_pixels=False)
        
        img = ds.pixel_array
        # Normalizing for display
        img = (img - img.min()) / (img.max() - img.min())
        
        images.append(img)
        found_indices.append(idx)

    if not images:
        print("No lateral images found in the specified range.")
        return

    # Calculate grid dimensions
    num_found = len(images)
    rows = math.ceil(num_found / grid_cols)
    
    plt.figure(figsize=(grid_cols * 4, rows * 4))
    
    for i in range(num_found):
        plt.subplot(rows, grid_cols, i + 1)
        plt.imshow(images[i], cmap='gray')
        plt.title(f"DF Index: {found_indices[i]}")
        plt.axis('off')
    
    plt.tight_layout()
    plt.show()

# tc = 10
# si = 100
# for i in range(10):
#     display_lateral_images(df_final, start_index=si + i * tc, total_count=tc)

lateral_indexes = [
    0, 2, 3, 5, 14, 16, 18, 24, 30, 31, 32, 34, 37, 39, 40, 41, 48, 50, 52, 54, 55, 56, 60, 65, 67, 73, 75, 80, 81, 82, 84, 85, 89, 93, 98
]

l0_arr = get_indexes_with_lession(df_final, TARGET_LESIONS[0])[:200]
l1_arr = get_indexes_with_lession(df_final, TARGET_LESIONS[1])[:200]
l2_arr = get_indexes_with_lession(df_final, TARGET_LESIONS[2])[:200]
for i in l2_arr:
    try:
        entry2img(df_final, row_index=i)
    except:
        pass
for i in l0_arr:
    try:
        entry2img(df_final, row_index=i)
    except:
        pass
for i in l1_arr:
    try:
        entry2img(df_final, row_index=i)
    except:
        pass