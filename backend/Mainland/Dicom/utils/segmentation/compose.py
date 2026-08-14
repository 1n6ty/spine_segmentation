import numpy as np
from copy import deepcopy
from logging import getLogger

from Dicom.utils.segmentation.elements import Vertebrae
from Dicom.utils.segmentation.instances import get_instances
from Dicom.utils.segmentation.utils import compute_spine_central_path, set_central_path_to_vertebraes, set_vertebraes_names
from Dicom.utils.segmentation.heal.unstick import unstick
from Dicom.utils.segmentation.heal.reveal import reveal

_logger = getLogger('segmentation.compose')

def _TSP_solve(central_points: np.ndarray[np.float32], prefix: np.ndarray[np.int32]) -> np.ndarray[np.int32]:
    """Solves TSP problem in gready way.

        Solves TCP problem in gready way to obtain right order of vertebraes.
    
        Args
        ----
            central_points (np.ndarray[np.float32])
                Array of central points of vertebraes to be ordered
            prefix (np.ndarray[np.int32])
                Ordered indexes, which go first
        
        Returns
        -------
            indexes (np.ndarray[np.int32])
                indexes of the right order of vertebraes; from S1 to C2 if `prefix` is S1-index
    """
    if central_points.shape[0] == prefix.shape[0]:
        return prefix

    distances: np.float32 = np.linalg.norm(central_points - central_points[prefix[-1]], axis=1)
    distances[prefix] = np.inf

    return _TSP_solve(central_points, np.concatenate([prefix, np.array([np.argmin(distances)], dtype=np.int32)]))

def _order_vertebraes(vertebraes: list[Vertebrae]) -> list[Vertebrae]:
    """Orders vertebraes from S1 to C2.
    """
    vertebraes_central_points: np.ndarray[np.float32] = np.concatenate([[np.average(v.reference_points, axis=0)] for v in vertebraes], axis=0)
    new_vertebraes = [
        vertebraes[i] 
        for i in _TSP_solve(vertebraes_central_points, prefix=np.array([np.argmax(vertebraes_central_points[:, 1])], dtype=np.int32))
    ]
    return new_vertebraes

def _order_vertebraes_reference_points(vertebraes: list[Vertebrae]) -> list[Vertebrae]:
    """Orders reference points of vertebraes.

        Orders reference points of vertebraes related by Gladkov's work.
        First point of the vertebrae is left-bottom one, than others clock-wise.
    """
    new_vertebraes: list[Vertebrae] = deepcopy(vertebraes)

    vertebraes_length: np.int32 = len(new_vertebraes)
    if vertebraes_length > 1:
        new_vertebraes[0].order_reference_points(new_vertebraes[1], "up")
        for i in range(1, vertebraes_length):
            new_vertebraes[i].order_reference_points(new_vertebraes[i - 1], "down")

    return new_vertebraes

def segment_spine_from_S1_to_C2_masks(polygons: np.ndarray[np.int32]) -> list[Vertebrae]:
    _logger.debug("Starting vertebraes building...")
    vertebraes: list[Vertebrae] = [Vertebrae(mask_xy=vm) for vm in polygons]
    _logger.debug(f"Built {len(vertebraes)} vertebraes.")

    _logger.debug(f"Ordering vertebraes and their reference points...")
    vertebraes = _order_vertebraes(vertebraes)
    vertebraes = _order_vertebraes_reference_points(vertebraes)

    _logger.debug(f"Filling the missing ones...")
    vertebraes = unstick(vertebraes)

    vpath = compute_spine_central_path(vertebraes)
    vertebraes = set_central_path_to_vertebraes(vertebraes, vpath)

    vertebraes = reveal(vertebraes, vpath)
    vertebraes = unstick(vertebraes)

    vertebraes = set_vertebraes_names(vertebraes)

    return vertebraes


def segment_spine_from_S1_to_C2(pixel_array: np.ndarray, detection_model) -> list[Vertebrae]:
    _logger.debug("Instances extraction...")
    instances = get_instances(pixel_array, detection_model=detection_model)[:24]

    return segment_spine_from_S1_to_C2_masks([vm["polygon"].astype(np.int32) for vm in instances])