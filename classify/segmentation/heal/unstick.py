from __future__ import annotations

import numpy as np
import cv2
from copy import deepcopy
from scipy.stats import linregress

from segmentation.elements import Vertebrae
from segmentation.utils import get_signed_angle

from logging import Logger, getLogger
_logger: Logger = getLogger("segmentation.heal.unstick")

def _cut_vertebrae(init_vertebrae, cut, mode):
    if mode == "up":
        current_cut_points = np.array(
            [
                init_vertebrae.reference_points[0],
                cut[0],
                cut[1],
                init_vertebrae.reference_points[3]
            ],
            dtype=np.int32
        )
    else:
        current_cut_points = np.array(
            [
                cut[0],
                init_vertebrae.reference_points[1],
                init_vertebrae.reference_points[2],
                cut[1],
            ],
            dtype=np.int32
        )
    max_v = np.max(current_cut_points, axis=0)
    tmp_canvas_1 = np.zeros(max_v[::-1], dtype=np.uint8)
    cv2.fillConvexPoly(tmp_canvas_1, init_vertebrae.mask_xy, 255, 0)

    tmp_canvas_2 = np.zeros(max_v[::-1], dtype=np.uint8)
    cv2.fillConvexPoly(tmp_canvas_2, current_cut_points, 255, 0)

    new_mask_xy = np.squeeze(
        max(
            cv2.findContours(
                cv2.bitwise_and(tmp_canvas_1, tmp_canvas_2),
                cv2.RETR_TREE,
                cv2.CHAIN_APPROX_NONE
            )[0],
            key=cv2.contourArea
        )
    )

    return Vertebrae(new_mask_xy)

# Heal sticked vertebraes (intersect)
def unstick(vertebraes: list[Vertebrae]) -> list[Vertebrae]:
    new_vertebraes = deepcopy(vertebraes)

    for vind in range(1, len(new_vertebraes) - 2):
        comb_points: np.ndarray[np.int32] = np.concatenate([new_vertebraes[vind].reference_points, new_vertebraes[vind + 1].reference_points], axis=0)

        max_v: np.ndarray[np.int32] = np.max(comb_points, axis=0)
        
        tmp_canvas_fst: np.ndarray[np.uint8] = np.zeros(max_v[::-1], dtype=np.uint8)
        tmp_canvas_sec: np.ndarray[np.uint8] = np.zeros(max_v[::-1], dtype=np.uint8)

        cv2.fillConvexPoly(tmp_canvas_fst, new_vertebraes[vind].reference_points, 255, 1)
        cv2.fillConvexPoly(tmp_canvas_sec, new_vertebraes[vind + 1].reference_points, 255, 1)

        intersection: np.ndarray[np.int32] = np.where(cv2.bitwise_and(tmp_canvas_fst, tmp_canvas_sec))

        if intersection[0].shape[0] > 1:
            _logger.debug(f"Unsticking {vind}'s and {vind + 1}'s vertebraes.")
            cut_length = np.linalg.norm(new_vertebraes[vind].reference_points[0] - new_vertebraes[vind].reference_points[3])

            try:
                slope, intercept, r, p, se = linregress(intersection[1], intersection[0])

                mx = np.median(intersection[1])

                cut = np.array(
                    [
                        [mx - cut_length, intercept + slope * (mx - cut_length)],
                        [mx + cut_length, intercept + slope * (mx + cut_length)]
                    ],
                    dtype=np.int32
                )
                
            except Exception as e:
                x = intersection[1][0]
                y = np.median(intersection[0])

                cut = np.array(
                    [
                        [x, y + cut_length],
                        [x, y - cut_length]
                    ],
                    dtype=np.int32
                )
            
            down_avg: np.ndarray[np.float32] = np.average(new_vertebraes[vind].reference_points[[0, 3]], axis=0)
            main_vec: np.ndarray[np.float32] = np.average(new_vertebraes[vind].reference_points[[1, 2]], axis=0) - down_avg
            cut = cut[np.argsort([get_signed_angle(main_vec, cut[j] - down_avg) for j in [0, 1]])][::-1]
            
            ncut = (np.average(new_vertebraes[vind + 1].reference_points[[0, 3]], axis=0) - np.average(cut, axis=0)) / 2
            new_current_vertebrae = _cut_vertebrae(new_vertebraes[vind], cut + ncut, "up")
            
            ncut = (np.average(new_vertebraes[vind].reference_points[[1, 2]], axis=0) - np.average(cut, axis=0)) / 2
            new_next_vertebrae = _cut_vertebrae(new_vertebraes[vind + 1], cut + ncut, "down")

            new_vertebraes = new_vertebraes[:vind] + [new_current_vertebrae, new_next_vertebrae] + new_vertebraes[vind + 2:]

            new_vertebraes[vind].order_reference_points(new_vertebraes[vind - 1], "down")
            new_vertebraes[vind + 1].order_reference_points(new_vertebraes[vind], "down")
    
    return new_vertebraes
