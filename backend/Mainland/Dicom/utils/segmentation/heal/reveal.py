from __future__ import annotations
from typing import TYPE_CHECKING

from copy import deepcopy
import numpy as np

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

def _segment_bic(x: np.ndarray[np.float32]) -> np.float32:
    """BIC of a single constant-mean Gaussian fit to `x`."""
    n = x.shape[0]
    resid_var = np.var(x) + 1e-12
    return n * np.log(resid_var) + 2 * np.log(n)  # k=2: mean, variance

def _changepoint_bic(x: np.ndarray[np.float32]) -> np.float32:
    """Best-case BIC of a single-changepoint (two constant segments) fit to `x`."""
    n = x.shape[0]
    best = np.float32(np.inf)
    for tau in range(2, n - 1):  # need >=2 points per segment to fit a variance
        left, right = x[:tau], x[tau:]
        rss = np.sum((left - left.mean()) ** 2) + np.sum((right - right.mean()) ** 2)
        resid_var = rss / n + 1e-12
        best = min(best, n * np.log(resid_var) + 4 * np.log(n))  # k=4: two means, two variances
    return best

def _adaptive_local_scale(
    d: np.ndarray[np.float32],
    index: int,
    min_radius: int = 2,
    max_radius: int = 8,
) -> np.float32:
    """Robust local spacing estimate around `index`, sized by BIC.

        Grows the neighborhood outward from `index` (excluding `d[index]`
        itself -- that's the gap under test) as long as one flat segment
        explains the neighbor gaps better than a two-segment changepoint
        model would. Freezes the window at the first radius where the
        changepoint model wins, since that's evidence the window has
        started crossing into a differently-scaled region -- lets a
        corrupted neighbor get averaged out over a wider still-uniform
        window without letting the window drift across a real boundary.
    """
    n = len(d)
    best_radius = min_radius

    for r in range(min_radius, max_radius + 1):
        lo, hi = max(0, index - r), min(n, index + r + 1)
        neighbors = np.delete(d[lo:hi], index - lo)

        if neighbors.shape[0] < 2 * min_radius:
            continue

        if _segment_bic(neighbors) <= _changepoint_bic(neighbors):
            best_radius = r
        else:
            break

    lo, hi = max(0, index - best_radius), min(n, index + best_radius + 1)
    neighbors = np.delete(d[lo:hi], index - lo)
    return np.median(neighbors) if neighbors.size else d[index]

def _gap_ratio(d: np.ndarray[np.float32], index: int) -> np.float32:
    scale = _adaptive_local_scale(d, index)
    return d[index] / scale if scale > 0 else np.float32("nan")

def _interpolate_gap(t: np.ndarray[np.float32], index: int, m: int) -> np.ndarray[np.float32]:
    step = t[index + 1] - t[index]
    return (t[index] + np.arange(1, m + 1) * step / (m + 1)).astype(np.float32)

def get_missing_t_estimates(
    tb: np.ndarray[np.float32],
    tu: np.ndarray[np.float32],
    outlier_ratio: float = 1.5,
    max_per_gap: int = 3,
) -> tuple[list[np.ndarray[np.float32]], list[np.ndarray[np.float32]]]:
    """Estimates missing point positions for a pair of sorted 1D point sets
        that mark the same underlying gaps -- one vertebra contributes one
        point to each of `tb` (bottom-plate arc positions) and `tu`
        (top-plate arc positions), so gap `i` in one always corresponds to
        gap `i` in the other.

        A gap is only treated as containing missing points when *both*
        series independently round to the same integer multiple of their
        own local scale (see `_adaptive_local_scale`). Corroboration across
        the two series stands in for a single-series distance-to-nearest-
        integer tolerance: measured on real detections, one side's ratio
        can land meaningfully off-round (noisy reference-point placement)
        while still agreeing with the other side on the rounded answer --
        a fixed per-side tolerance rejects that agreement instead of using
        it, silently dropping real gaps.
    """
    db, dt = np.diff(tb), np.diff(tu)
    n = len(db)

    miss_b: list[np.ndarray[np.float32]] = []
    miss_u: list[np.ndarray[np.float32]] = []

    for i in range(n):
        rb, ru = _gap_ratio(db, i), _gap_ratio(dt, i)
        mb, mu = int(round(rb)) - 1, int(round(ru)) - 1

        confident = mb == mu and mb >= 1 and rb > outlier_ratio and ru > outlier_ratio
        if not confident:
            miss_b.append(np.array([], dtype=np.float32))
            miss_u.append(np.array([], dtype=np.float32))
            continue

        m = min(mb, max_per_gap)
        miss_b.append(_interpolate_gap(tb, i, m))
        miss_u.append(_interpolate_gap(tu, i, m))

    return miss_b, miss_u

# Heal unseen ones
def reveal(vertebraes: list[Vertebrae], vpath: CentralPath, max_total: int | None = None) -> list[Vertebrae]:
    """Inserts vertebraes estimated to be missing from gaps in `vertebraes`.

        Args
        ----
            max_total (int | None)
                Hard cap on `len(vertebraes) + insertions`. `None` means
                unbounded. Insertion stops as soon as the cap would be hit,
                even mid-gap, so a single over-confident gap estimate can't
                blow past the known-plausible maximum on its own.
    """
    t = vpath._t[:]

    tb = t[::2]
    tu = t[1::2]
    miss_tb, miss_tu = get_missing_t_estimates(tb, tu)

    _logger.debug(f"{sum(m.shape[0] for m in miss_tb)} vertebraes are missed, revealing...")

    budget = float("inf") if max_total is None else max_total - len(vertebraes)

    new_vertebraes = deepcopy(vertebraes)
    inserted = 0
    offset = 0  # shift from insertions made at earlier gaps, so later gap indexes stay correct

    for m1, m2, i in zip(miss_tb, miss_tu, range(len(miss_tb))):
        # miss_tb/miss_tu are always paired to equal length per gap by
        # get_missing_t_estimates -- both sides agreeing on the count is
        # exactly what makes a gap confident in the first place.
        for mp1, mp2, j in zip(m1, m2, range(m1.shape[0])):
            if inserted >= budget:
                _logger.warning(f"Reveal insertion budget ({max_total}) exhausted, stopping early.")
                return new_vertebraes

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

            insert_at = i + offset + j + 1
            new_vertebraes = new_vertebraes[:insert_at] + [new_vertebrae] + new_vertebraes[insert_at:]

            new_vertebraes[insert_at].order_reference_points(new_vertebraes[insert_at - 1], "down")
            new_vertebraes[insert_at].set_p(
                Parametrization(t_bottom=mp1, t_up=mp2)
            )

            inserted += 1

        offset += m1.shape[0]

    return new_vertebraes
