import numpy as np
import cv2, os
from copy import deepcopy
from ultralytics.models import YOLO
from ultralytics.engine.results import Results

from segmentation.elements.interface import Vertebrae
from segmentation.interpolation.interface import vPath

from segmentation.elements.vertebrae import PVertebrae
from segmentation.interpolation.path import CentralPath

from logging import getLogger
_logger = getLogger("segmentation:elements:utils")

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
    _logger.info("Starting ordering vertebraes from S1 to C2.")
    vertebraes_central_points: np.ndarray[np.float32] = np.concatenate([[np.average(v.reference_points, axis=0)] for v in vertebraes], axis=0)
    new_vertebraes = [
        vertebraes[i] 
        for i in _TSP_solve(vertebraes_central_points, prefix=np.array([np.argmax(vertebraes_central_points[:, 1])], dtype=np.int32))
    ]
    _logger.info("Ordering done.")
    return new_vertebraes

def _order_vertebraes_reference_points(vertebraes: list[Vertebrae]) -> list[Vertebrae]:
    """Orders reference points of vertebraes.

        Orders reference points of vertebraes related by Gladkov's work.
        First point of the vertebrae is left-bottom one, than others clock-wise.
    """
    _logger.info("Starting ordering vertebraes' reference points.")
    new_vertebraes: list[Vertebrae] = deepcopy(vertebraes)

    vertebraes_length: np.int32 = len(new_vertebraes)
    if vertebraes_length > 1:
        new_vertebraes[0].order_reference_points(new_vertebraes[1], "up")
        for i in range(1, vertebraes_length):
            new_vertebraes[i].order_reference_points(new_vertebraes[i - 1], "down")
    _logger.info("Ordering done.")

    return new_vertebraes

def segment_vertebraes(pixel_array: np.ndarray[np.uint8], model: YOLO, conf: float = 0.5) -> list[PVertebrae]:
    _logger.info("Starting segmentation process.")
    cv2.imwrite("tmp.png", pixel_array)
    model_response: list[Results] = model.predict("tmp.png", save=False, show=False, show_boxes=False, conf=conf, project="segmenntation", name="segmentation")
    if os.path.exists("tmp.png"):
        os.remove("tmp.png")
    _logger.info("Segmentation done.")

    _logger.info("Starting vertebraes building.")
    vertebraes: list[PVertebrae] = [PVertebrae(mask_xy=vm.astype(np.int32)) for vm in model_response[0].masks.xy]
    _logger.info(f"Built {len(vertebraes)} vertebraes.")

    vertebraes = _order_vertebraes(vertebraes)

    vertebraes = _order_vertebraes_reference_points(vertebraes)

    return vertebraes
