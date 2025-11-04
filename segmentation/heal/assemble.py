from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from segmentation.elements.spine import PSpine

import numpy as np
from copy import deepcopy

from segmentation.elements.vertebrae import PVertebrae

from scipy.stats import linregress
def _compute_cap_len_func(vertebraes: list[PVertebrae], vpath):
    slope, intercept, r, p, se = linregress(
        [getattr(v.p, name) for v in vertebraes for name in ["t_bottom", "t_up"]],
        [np.linalg.norm(v.reference_points[c[0]] - v.reference_points[c[1]]) for v in vertebraes for c in [[0, 3], [1, 2]]],
    )

    def func(t):
        return intercept + slope * t
    
    return func

from scipy.optimize import fsolve
def assemble(side_spine: PSpine, front_spine: PSpine) -> list[PVertebrae]:
    new_vertebraes = [None] * len(side_spine.vertebraes)

    svi = 0
    for v in front_spine.vertebraes:
        fmy = np.average(v.reference_points[[2, 3], 1])
        md = float('inf')
        while True:
            d = np.abs(np.average(side_spine.vertebraes[svi].reference_points[[0, 1], 1]) - fmy)
            if d > md:
                break

            md = d
            svi += 1
        new_vertebraes[svi - 1] = deepcopy(v)
    
    cap_func = _compute_cap_len_func(front_spine.vertebraes, front_spine.vpath)

    def d(t, v, y):
        return (front_spine.vpath.f(t)[0][1] - front_spine.vpath.fn(t)[0][1] * cap_func(t) - y) ** 2

    for i, v in enumerate(side_spine.vertebraes):
        if new_vertebraes[i] is None:
            res = [
                fsolve(
                    d, 
                    front_spine.vpath._cs_2d.cs_y.solve(
                        v.reference_points[0][1]
                    )[-1], 
                    args=(v, v.reference_points[0][1]), 
                    maxfev=5000
                )[0],
                fsolve(
                    d, 
                    front_spine.vpath._cs_2d.cs_y.solve(
                        v.reference_points[1][1]
                    )[-1], 
                    args=(v, v.reference_points[1][1]), 
                    maxfev=5000
                )[0]
            ]

            new_ref_points = np.array(
                [
                    front_spine.vpath.f(res[0]) + front_spine.vpath.fn(res[0]) * cap_func(res[0]) / 2,
                    front_spine.vpath.f(res[1]) + front_spine.vpath.fn(res[1]) * cap_func(res[1]) / 2,
                    front_spine.vpath.f(res[1]) - front_spine.vpath.fn(res[1]) * cap_func(res[1]) / 2,
                    front_spine.vpath.f(res[0]) - front_spine.vpath.fn(res[0]) * cap_func(res[0]) / 2
                ],
                dtype=np.int32
            )

            new_vertebraes[i] = PVertebrae(
                new_ref_points,
                new_ref_points
            )
    
    return new_vertebraes