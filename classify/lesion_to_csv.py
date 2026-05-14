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
from segmentation.compose import segment_spine_from_S1_to_C2

from random import choice

SPINE_MODEL = str(Path(__file__).resolve().parent / "side-exp/train4/weights/best.pt")

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
    
    logger.info("Start segmenting")
    try:
        vertebraes = segment_spine_from_S1_to_C2(img, SPINE_MODEL)
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
    else:
        closestV = choice(vertebraes)
        d = 0

    normal_landmarks = normalize_landmarks(closestV.reference_points)

    vcentroid = np.mean(normal_landmarks, axis=0)

    max_vals = np.max(normal_landmarks, axis=0)
    min_vals = np.min(normal_landmarks, axis=0)

    width = max_vals[0] - min_vals[0]
    height = max_vals[1] - min_vals[1]

    # 2. Compute the Aspect Ratio
    aspect_ratio = width / height
    area_bbox = width * height

    return (np.append(normal_landmarks.flatten(), [area_bbox, aspect_ratio, _compute_p5s(closestV), _compute_p6s(closestV), _compute_p7s(closestV), _compute_p8s(closestV)]), target_lesions.index(lesion_type), d)

from multiprocessing import Pool, cpu_count
from functools import partial

def process_single_row(i, df, targets):
    """Wrapper function to process one row for the pool."""
    out = entryVertebra2Vec(df, targets, row_index=i)
    if out is not None:
        return list(out[0]) + list(out[1:])
    return None

if __name__ == '__main__':
    cols = [
        'x1', 'y1', 'x2', 'y2', 'x3', 'y3', 'x4', 'y4', 
        'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 
        'lesion_type', 'dist'
    ]
    
    output_file = 'lesions_with_points.csv'
    indices = [
        # *get_indexes_with_lession(df_final, TARGET_LESIONS[0]),
        # *get_indexes_with_lession(df_final, TARGET_LESIONS[1]),
        # *get_indexes_with_lession(df_final, TARGET_LESIONS[2])
        1, 2
    ]
    
    # 1. Initialize the file with headers
    pd.DataFrame(columns=cols).to_csv(output_file, index=False)

    func = partial(process_single_row, df=df_final, targets=TARGET_LESIONS)

    # 2. Use Pool with imap or imap_unordered
    with Pool(processes=2) as pool:
        # imap_unordered returns an iterator that yields results as soon as they are ready
        for result in pool.imap_unordered(func, indices):
            if result is not None:
                # 3. Append to the CSV immediately
                # We wrap result in a list because result is a single row
                df_row = pd.DataFrame([result], columns=cols)
                
                # mode='a' appends, header=False prevents writing column names again
                df_row.to_csv(output_file, mode='a', index=False, header=False)
                
                print(f"Row processed and appended to {output_file}")

    print("Finished processing all rows.")
