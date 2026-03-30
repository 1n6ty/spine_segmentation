from __future__ import annotations
from typing import TYPE_CHECKING
from logging import getLogger
import numpy as np
from copy import deepcopy

from segmentation.interpolation.path import CentralPath

if TYPE_CHECKING:
    from segmentation.elements import Vertebrae

_logger = getLogger('segmentation.utils')

_NAMES = ['S1', 'L5', 'L4', 'L3', 'L2', 'L1', 'Th12', 'Th11', 'Th10', 'Th9', 'Th8', 'Th7', 'Th6', 'Th5', 'Th4', 'Th3', 'Th2', 'Th1', 'C7', 'C6', 'C5', 'C4', 'C3', 'C2']

def get_signed_angle(v1: np.ndarray[np.float32], v2: np.ndarray[np.float32]) -> np.float32:
    """Computes arctan2 function of two vectors `v1` and `v2`.

        Args
        ----
            v1 (np.ndarray[np.float32])
                First vector
            v2 (np.ndarray[np.float32])
                Second vector
    """
    return np.arctan2(v1[1] * v2[0] - v1[0] * v2[1], np.dot(v1, v2))

def compute_spine_central_path(
        vertebraes: list[Vertebrae],
        max_iter: int = 50,
        tol: float = 1e-9,
        ext_mpoints_before: np.ndarray[np.float32] = np.empty((0, )),
        ext_mpoints_after: np.ndarray[np.float32] = np.empty((0, ))
    ) -> CentralPath:
    _logger.debug("Computing central path...")
    vpath = CentralPath(
        np.concatenate(
            [
                [np.average(v.reference_points[[0, 3]], axis=0), np.average(v.reference_points[[1, 2]], axis=0)]
                for v in vertebraes
            ],
            axis=0,
            dtype=np.float32
        ),
        max_iter,
        tol,
        ext_mpoints_before,
        ext_mpoints_after
    )

    return vpath

def set_vertebraes_names(vertebraes: list[Vertebrae]) -> None:
    new_vertebraes = deepcopy(vertebraes)
    for i, v in enumerate(new_vertebraes):
        v.set_name(_NAMES[i])
    
    return new_vertebraes

def set_central_path_to_vertebraes(vertebraes: list[Vertebrae], vpath: CentralPath) -> None:
    new_vertebraes = deepcopy(vertebraes)
    for i, v in enumerate(new_vertebraes):
        v.set_p(vpath.get_vertebrae_parametrization(i))
    
    return new_vertebraes