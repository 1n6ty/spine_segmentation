from __future__ import annotations
from typing import TYPE_CHECKING

import numpy as np
from typing import Literal

from Dicom.utils.segmentation.utils import get_signed_angle

if TYPE_CHECKING:
    from Dicom.utils.segmentation.interpolation.types import Parametrization

class Vertebrae:
    """Class of parameterized vertebrae.

        Attributes
        ----------
            mask_xy (np.ndarray[np.int32] | None)
                2D array of vertebrae mask `(x, y)` coordinates
            reference_points (np.ndarray[np.int32])
                Array of shape `(4, 2)` - (x, y) coordinates of reference points
            p (Parametrization)
                Parametrization tuple, computed from central path
            
    """
    def __init__(self, mask_xy: np.ndarray[np.int32] | None = None, reference_points: np.ndarray[np.int32] | None = None) -> None:
        """Vertebrae constructor.

            Args
            ----
                mask_xy (np.ndarray[np.int32] | None)
                    2D array of vertebrae mask `(x, y)` coordinates
                reference_points (np.ndarray[np.int32] | None)
                    Array of shape `(4, 2)` - (x, y) coordinates of reference points
        """
        super().__init__()

        if not (mask_xy is None):
            self.mask_xy: np.ndarray[np.int32] = mask_xy

            if reference_points is None:
                self.reference_points: np.ndarray[np.int32] = Vertebrae._compute_reference_points(mask_xy)
        if not(reference_points is None):
            self.reference_points: np.ndarray[np.int32] = reference_points
        
        if mask_xy is None and reference_points is None:
            raise AttributeError("Vertebrae constructor needs mask or reference_points array.")
    
    def set_p(self, p: Parametrization) -> None:
        self.p = p

    def set_name(self, name: str) -> None:
        self.name = name

    def order_reference_points(self, nearest_vertebrae: Vertebrae, pos: Literal["up", "down"]) -> None:
        """Orders reference points like in Gladkov's work.

            Orders points like: first point of the vertebrae is left-bottom one, than others clock-wise.
            This method relies on nearest vertebrae's central point to determinate up and down plates.
        
            Args
            ----
                nearest_vertebrae_central_point (np.ndarray[np.float32])
                    Nearest vertebrae's central point, up or down one
                central_point_type (Literal["up", "down"])
                    Position of central point relative to the current vertebrae `up` or `down`
        """
        nearest_indexes: np.ndarray = np.argpartition(np.linalg.norm(self.reference_points - np.average(nearest_vertebrae.reference_points, axis=0), axis=1), 2)[:2]

        if pos == "up":
            up: np.ndarray[np.int32] = self.reference_points[nearest_indexes]
            down: np.ndarray[np.int32] = np.delete(self.reference_points, nearest_indexes, axis=0)
        elif pos == "down":
            up: np.ndarray[np.int32] = np.delete(self.reference_points, nearest_indexes, axis=0)
            down: np.ndarray[np.int32] = self.reference_points[nearest_indexes]
        
        down_avg: np.ndarray[np.float32] = np.average(down, axis=0)
        main_vec: np.ndarray[np.float32] = np.average(up, axis=0) - down_avg
        self.reference_points = self.reference_points[np.argsort([get_signed_angle(main_vec, self.reference_points[j] - down_avg) for j in range(self.reference_points.shape[0])])][::-1]

    @staticmethod
    def _compute_cnt_weight(cnt: np.ndarray[np.int32], index: np.int32) -> np.float32:
        """Computes weight by rule: hypotenuse substruct legs.

            Args
            ----
                cnt (np.ndarray[np.int32])
                    Vertebrae contour
                index (np.int32)
                    Index, around which, weight will be computed
            
            Returns
            -------
                weight (np.float32)
                    Computed weight of `index` point
        """
        return np.linalg.norm(cnt[index] - cnt[index - 1]) + np.linalg.norm(cnt[index] - cnt[(index + 1) % cnt.shape[0]]) - np.linalg.norm(cnt[(index + 1) % cnt.shape[0]] - cnt[index - 1])
    
    @staticmethod
    def _compute_reference_points(mask_xy: np.ndarray[np.int32]) -> np.ndarray[np.int32]:
        """Computes reference points of vertebrae, based on `mask`.

            Args
            ----
                mask_xy (np.ndarray[np.int32])
                    2D array of vertebrae mask `(x, y)` coordinates
            
            Returns
            -------
                reference points (np.ndarray[np.int32])
                    Array of shape `(4, 2)` - (x, y) coordinates of reference points
        """
        cnt: np.ndarray[np.int32] = np.copy(mask_xy)
        
        weights: np.ndarray[np.float32] = np.array([Vertebrae._compute_cnt_weight(cnt, i) for i in range(cnt.shape[0])], dtype=np.float32)
        while cnt.shape[0] > 4:
            min_weight_index: np.int32 = np.argmin(weights)
            
            cnt = np.delete(cnt, min_weight_index, axis=0)
            weights = np.delete(weights, min_weight_index, axis=0)

            weights[min_weight_index % cnt.shape[0]] = Vertebrae._compute_cnt_weight(cnt, min_weight_index % cnt.shape[0])
            weights[min_weight_index - 1] = Vertebrae._compute_cnt_weight(cnt, min_weight_index - 1)
        
        return cnt