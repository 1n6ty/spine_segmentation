from __future__ import annotations

import numpy as np
from typing import Literal

from segmentation.medical_parameters.parameters import Gap_Parameters

class Vertebrae():
    mask_xy: np.ndarray[np.int32] | None = None
    reference_points: np.ndarray[np.int32] | None = None

    name: str | None = None

    def set_name(self, name: str) -> None:
        self.name = name

    def order_reference_points(self, nearest_vertebrae: Vertebrae, pos: Literal["up", "down"]) -> None:
        raise NotImplementedError()

class Spine:
    name = "spine"
    _names: list[str] = ['S1', 'L5', 'L4', 'L3', 'L2', 'L1', 'Th12', 'Th11', 'Th10', 'Th9', 'Th8', 'Th7', 'Th6', 'Th5', 'Th4', 'Th3', 'Th2', 'Th1', 'C7', 'C6', 'C5', 'C4', 'C3', 'C2']
    gap_parameters: Gap_Parameters = None

    def __init__(self, projection: Literal["side", "frontal"], vertebraes: list[Vertebrae]):
        self.projection = projection
        self.vertebraes = vertebraes
