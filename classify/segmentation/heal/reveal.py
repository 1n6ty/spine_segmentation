from __future__ import annotations
from typing import TYPE_CHECKING

from copy import deepcopy
import numpy as np
import scipy.optimize

from segmentation.elements import Vertebrae
from segmentation.interpolation.types import Parametrization

from logging import Logger, getLogger
_logger: Logger = getLogger("segmentation.heal.reveal")

if TYPE_CHECKING:
    from segmentation.interpolation.path import CentralPath

def get_ref_points(t: float, l: float, vpath: CentralPath) -> list[np.ndarray]:
    normal = vpath.fn(t) * l / 2
    start = np.array(vpath.f(t), dtype=np.float32)

    return [start + normal, start - normal]

def err(coefs: np.ndarray, t_batch: np.ndarray, l_batch: np.ndarray) -> np.float32:
    return np.sum((coefs[0] * (t_batch - t_batch[0]) + coefs[1] - l_batch) ** 2)

def get_missing_l_estimates(l: np.ndarray, t: np.ndarray, t_estimates: list[np.ndarray], width: int) -> list[np.ndarray[np.float32]]:
    best_res = []

    n = len(l)
    local_l = [[] for _ in range(n - 1)]

    for i in range(n - width + 1):
        l_batch = l[i:i + width]
        t_batch = t[i:i + width]

        alpha0 = np.median(np.divide(np.diff(l_batch), np.diff(t_batch)))

        # constrained optimization
        res = scipy.optimize.minimize(
            err,
            [alpha0, l_batch[0]],
            (t_batch, l_batch),
            method="L-BFGS-B",
            tol=1e-4
        )
        coefs = res.x

        for k, t_est in enumerate(t_estimates[i:i + width - 1]):
            d = (t_est - t_batch[0])
            
            local_l[i + k].append(
                coefs[0] * d + coefs[1]
            )

    best_res = []
    for p in local_l:
        pl = len(p)

        if pl != 0:
            plm = len(p) // 2
            if len(p[plm].shape) != 0 and pl % 2 == 0 and p[plm].shape[0] == p[plm - 1].shape[0]:
                best_res.append((p[plm] + p[plm - 1]) / 2)
            else:
                best_res.append(p[plm])
        else:
            best_res.append(np.array([]))

    # final integer result
    if best_res is None:
        _logger.warning("best_res is None, falling back")
        best_res = [np.array() for i in range(n - 1)]

    return best_res

def errl(c: np.ndarray, t: np.ndarray, k: np.ndarray) -> np.float32:
    return np.sum((c * t - k) ** 2)

def get_missing_tl_estimates(t: np.ndarray, l: np.ndarray) -> tuple[list[np.ndarray[np.int32]], list[np.ndarray[np.int32]]]:
    best_score = float("-inf")
    best_res = []
    best_w = 4

    n = len(t)

    width = 4
    while width <= n:
        local_ms = [[] for _ in range(n - 1)]
        local_t = [[] for _ in range(n - 1)]

        for i in range(n - width + 1):
            batch = t[i:i + width]
            d = np.diff(batch)

            # robust initial alpha
            alpha0 = 1.0 / np.median(d)

            # constrained optimization
            res = scipy.optimize.minimize(
                errl,
                alpha0,
                (d, np.round(alpha0 * d)),
                method="L-BFGS-B",
                tol=1e-4
            )

            alpha = res.x[0]

            for j, diff in enumerate(d, i):
                local_ms[j].append(alpha * diff)
                local_t[j].append([])
                for m in range(1, np.round(alpha * diff).astype(np.int32)):
                    root = batch[j-i] + m / alpha

                    local_t[j][-1].append(root)
                local_t[j][-1] = np.array(local_t[j][-1], dtype=np.float32)

        # aggregate across windows
        res = np.array(
            [np.median(m) if len(m) else np.nan for m in local_ms],
            dtype=np.float64
        )

        score = np.nansum(np.round(res))

        if score > best_score and score < 24:
            best_score = score
            best_w = width

            best_res = []
            for p in local_t:
                pl = len(p)

                if pl != 0:
                    plm = len(p) // 2
                    if len(p[plm].shape) != 0 and pl % 2 == 0 and p[plm].shape[0] == p[plm - 1].shape[0]:
                        best_res.append((p[plm] + p[plm - 1]) / 2)
                    else:
                        best_res.append(p[plm])
                else:
                    best_res.append(np.array([]))

        width += 1

    # final integer result
    if best_res is None:
        _logger.warning("best_res is None, falling back")
        best_res = [np.array() for i in range(n - 1)]

    return (
        best_res, 
        get_missing_l_estimates(
            l, t, best_res, best_w
        )
    )

# Heal unseen ones
def reveal(vertebraes: list[Vertebrae], vpath: CentralPath) -> list[Vertebrae]:
    t = vpath._t[:]

    tb = t[::2]
    miss_tb, miss_lb = get_missing_tl_estimates(
        tb,
        np.array([np.linalg.norm(v.reference_points[0] - v.reference_points[3]) for v in vertebraes], dtype=np.float32)
    )

    tu = t[1::2]
    miss_tu, miss_lu = get_missing_tl_estimates(
        tu,
        np.array([np.linalg.norm(v.reference_points[1] - v.reference_points[2]) for v in vertebraes], dtype=np.float32)
    )

    _logger.debug(f"{sum(min([i[n].shape[0] if i[n].shape else 0 for n in range(2)]) for i in zip(miss_tb, miss_tu))} vertebraes are missed, revealing...")

    new_vertebraes = deepcopy(vertebraes)

    for m1, ml1, m2, ml2, i in zip(miss_tb, miss_lb, miss_tu, miss_lu, range(len(miss_tb))):
        if m1.shape and m2.shape:
            for mp1, mp2, mpl1, mpl2, j in zip(m1, m2, ml1, ml2, range(min(m1.shape[0], m2.shape[0]))):
                bottom_points = get_ref_points(mp1, mpl1, vpath)
                upper_points = get_ref_points(mp2, mpl2, vpath)

                new_vertebrae = Vertebrae(
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

                new_vertebraes = new_vertebraes[:i + j + 1] + [new_vertebrae] + new_vertebraes[i + j + 1:]

                new_vertebraes[i + j + 1].order_reference_points(new_vertebraes[i + j], "down")
                new_vertebraes[i + j + 1].set_p(
                    Parametrization(t_bottom=mp1, t_up=mp2)
                )

    return new_vertebraes
