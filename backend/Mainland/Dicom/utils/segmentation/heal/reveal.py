from __future__ import annotations
from typing import TYPE_CHECKING

from copy import deepcopy
import numpy as np
import scipy.optimize

from Dicom.utils.segmentation.elements import Vertebrae
from Dicom.utils.segmentation.interpolation.types import Parametrization

from logging import Logger, getLogger
_logger: Logger = getLogger("Dicom.utils.segmentation.heal.reveal")

if TYPE_CHECKING:
    from Dicom.utils.segmentation.interpolation.path import CentralPath

def compute_normal_len(vertebraes: list[Vertebrae], t: np.ndarray) -> np.float32:
    t_arr = np.concatenate(
        [
            [vertebraes[vind].p.t_bottom, vertebraes[vind].p.t_up]
            for vind in range(len(vertebraes))
        ],
        axis=0
    )
    lens = np.concatenate(
        [
            [
                np.linalg.norm(vertebraes[vind].reference_points[3] - vertebraes[vind].reference_points[0]) / 2,
                np.linalg.norm(vertebraes[vind].reference_points[2] - vertebraes[vind].reference_points[1]) / 2
            ]
            for vind in range(len(vertebraes))
        ],
        axis=0
    )

    for i in range(1, len(t_arr)):
        if t_arr[i - 1] <= t <= t_arr[i]:
            return ((t_arr[i] - t) * lens[i - 1] + (t - t_arr[i - 1]) * lens[i]) / (t_arr[i] - t_arr[i - 1])
    return None

def get_ref_points(t: np.ndarray, vertebraes: list[Vertebrae], vpath: CentralPath) -> list[np.ndarray]:
    normal = vpath.fn(t) * compute_normal_len(vertebraes, t)
    start = np.array(vpath.f(t), dtype=np.float32)

    return [start + normal, start - normal]

def errl(c: np.ndarray, t: np.ndarray, k: np.ndarray) -> np.float32:
    return np.sum((c * t - k) ** 2)

def get_missing_t_estimates(t: np.ndarray) -> np.ndarray[np.int32]:
    best_score = float("-inf")
    best_res = []

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
                tol=1e-9
            )

            if not res.success:
                continue

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

        t_arr = []
        for p in local_t:
            pl = len(p)

            if pl != 0:
                plm = len(p) // 2
                if len(p[plm].shape) != 0 and pl % 2 == 0 and p[plm].shape[0] == p[plm - 1].shape[0]:
                    t_arr.append((p[plm] + p[plm - 1]) / 2)
                else:
                    t_arr.append(p[plm])
            else:
                t_arr.append(np.array([]))

        valid = ~np.isnan(res)
        if np.sum(valid) < (n - 1) // 2:
            width += 1
            continue

        med = np.nanmedian(res)
        mad = np.nanmedian(np.abs(res - med))

        if mad == 0:
            score = -np.nanvar(res)
        else:
            mask = np.abs(res - med) < 3 * mad
            score = -np.nanvar(res[mask])

        if score > best_score:
            best_score = score
            best_res = t_arr

        width += 1

    # final integer result
    if best_res is None:
        _logger.warning("best_res is None, falling back")
        best_res = [np.array() for i in range(n - 1)]

    return best_res

# Heal unseen ones
def reveal(vertebraes: list[Vertebrae], vpath: CentralPath) -> list[Vertebrae]:
    t = vpath._t[:]

    tb = t[::2]
    miss_tb = get_missing_t_estimates(tb)

    tu = t[1::2]
    miss_tu = get_missing_t_estimates(tu)

    _logger.debug(f"{sum(min([i[n].shape[0] if i[n].shape else 0 for n in range(2)]) for i in zip(miss_tb, miss_tu))} vertebraes are missed, revealing...")

    new_vertebraes = deepcopy(vertebraes)

    for m1, m2, i in zip(miss_tb, miss_tu, range(len(miss_tb))):
        if m1.shape and m2.shape:
            for mp1, mp2, j in zip(m1, m2, range(min(m1.shape[0], m2.shape[0]))):
                bottom_points = get_ref_points(mp1, vertebraes, vpath)
                upper_points = get_ref_points(mp2, vertebraes, vpath)

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
