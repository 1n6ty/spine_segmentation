from __future__ import annotations
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from segmentation.elements.vertebrae import Vertebrae

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

