from __future__ import annotations
from typing import TYPE_CHECKING

from copy import deepcopy
import numpy as np
import scipy.optimize

from segmentation.heal.utils import compute_errq, compute_errq_jac
from segmentation.heal.unstick import unstick
from segmentation.elements.vertebrae import PVertebrae
from segmentation.interpolation.types import Parametrization

from logging import Logger, getLogger

if TYPE_CHECKING:
    from segmentation.elements.spine import PSpine

def compute_md(ln) -> np.float32:
    return np.median(np.divide(ln[2:] - ln[1:-1], ln[1:-1] - ln[:-2]))

def compute_normal_len(spine: PSpine, t):
    t_arr = np.concatenate(
        [
            [spine.vertebraes[vind].p.t_bottom, spine.vertebraes[vind].p.t_up]
            for vind in range(len(spine.vertebraes))
        ], 
        axis=0
    )
    lens = np.concatenate(
        [
            [
                np.linalg.norm(spine.vertebraes[vind].reference_points[3] - spine.vertebraes[vind].reference_points[0]) / 2, 
                np.linalg.norm(spine.vertebraes[vind].reference_points[2] - spine.vertebraes[vind].reference_points[1]) / 2
            ]
            for vind in range(len(spine.vertebraes))
        ], 
        axis=0
    )
    
    for i in range(1, len(t_arr)):
        if t_arr[i - 1] <= t <= t_arr[i]:
            return ((t_arr[i] - t) * lens[i - 1] + (t - t_arr[i - 1]) * lens[i]) / (t_arr[i] - t_arr[i - 1])
    return None

def get_ref_points(t, spine: PSpine):
    normal = spine.vpath.fn(t) * compute_normal_len(spine, t)
    start = np.array(spine.vpath.f(t), dtype=np.float32)

    return [start + normal, start - normal]

def normalize(t_points):
    lb_min, lb_max = np.min(t_points), np.max(t_points)
    return ((t_points - lb_min) / (lb_max - lb_min), lb_min, lb_max)

def get_err(t, t_init):
    t_new = [t[0]]
    for _ in range(21):
        t_new.append(t[0] + t[1] * t_new[-1])
    t_new = np.array(t_new)

    ext = np.append(t_init, [float("inf")] * (t_new.shape[0] - t_init.shape[0]))
    x = np.array(
        [
            np.concatenate([ext[i:], ext[:i]], axis=0)
            for i in range(ext.shape[0])
        ]
    )
    y = np.array(
        [t_new for _ in range(ext.shape[0])]
    )
    err = np.abs(x - y).flatten()
    err.sort()
    return np.sum(err[:t_init.shape[0]]) + np.abs(t_init[-1] - t_new[-1])

def compute_t_coefs(t_points, grid_d = 1000):
    lbn, lbmin, lbmax = normalize(t_points)

    coefs: np.ndarray[np.float32] = None 
    c = float("inf")
    for i in np.linspace(0.1, 1, grid_d): #TODO depends on min border
        tmp = scipy.optimize.minimize(
            compute_errq,
            [lbn[1], compute_md(lbn)],
            args=(i, lbn),
            tol=1e-9,
            method="BFGS",
            jac=compute_errq_jac
        ).x

        err = get_err(tmp, lbn)
        if err < c:
            coefs = tmp
            c = err
    return coefs

# Heal unseen ones
def reveal(spine: PSpine) -> list[PVertebrae]:
    logger: Logger = getLogger("heal.reveal")

    t = spine.vpath._t[2:-2]
    
    bottom_coefs = compute_t_coefs(t[::2])
    lbn, lb_min, lb_max = normalize(t[::2])

    upper_coefs = compute_t_coefs(t[1::2])
    lun, lu_min, lu_max = normalize(t[1::2])

    logger.info("Regression coefficients for parametrized middle points are computed.")
    
    nb = [0]
    for i in range(len(spine.vertebraes)):
        nb.append(bottom_coefs[0] + bottom_coefs[1] * nb[-1])
    nb = np.array(nb) * (lb_max - lb_min) + lb_min
    
    nu = [0]
    for i in range(len(spine.vertebraes)):
        nu.append(upper_coefs[0] + upper_coefs[1] * nu[-1])
    nu = np.array(nu) * (lu_max - lu_min) + lu_min

    logger.info("Parametrized middle points are computed.")

    new_vertebraes = deepcopy(spine.vertebraes)

    vind: np.int32 = 1
    while vind < len(new_vertebraes) - 1 < 23:
        next_bottom_t = nb[vind]
        next_upper_t = nu[vind]
        next_middle_t = (next_bottom_t + next_upper_t) / 2
        
        if new_vertebraes[vind].p.t_up < next_middle_t < new_vertebraes[vind + 1].p.t_bottom:
            logger.info(f"Revealed vertebrae at index {vind}")
            bottom_points = get_ref_points(next_bottom_t, spine)
            upper_points = get_ref_points(next_upper_t, spine)
            
            new_vertebrae = PVertebrae(
                np.array(
                    [
                        bottom_points[0],
                        upper_points[0],
                        upper_points[1],
                        bottom_points[1],
                    ],
                    dtype=np.int32
                )
            )

            new_vertebraes = new_vertebraes[:vind + 1] + [new_vertebrae] + new_vertebraes[vind + 1:]

            new_vertebraes[vind + 1].order_reference_points(new_vertebraes[vind], "down")
            new_vertebraes[vind + 1].set_p(
                Parametrization(t_bottom=next_bottom_t, t_up=next_upper_t)
            )

        vind += 1

    return new_vertebraes
    