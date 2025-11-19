import numpy as np
from scipy.interpolate import CubicSpline

from typing import NamedTuple

class Parametrization(NamedTuple):
    t_bottom: np.float32
    t_up: np.float32

class CS2D:
    cs_x: CubicSpline
    cs_y: CubicSpline

    dcs_x: CubicSpline
    dcs_y: CubicSpline

    d2cs_x: CubicSpline
    d2cs_y: CubicSpline

    def __init__(self, cs_x: CubicSpline, cs_y: CubicSpline) -> None:
        self.cs_x = cs_x
        self.cs_y = cs_y

        self.dcs_x = cs_x.derivative(nu=1)
        self.dcs_y = cs_y.derivative(nu=1)

        self.d2cs_x = cs_x.derivative(nu=2)
        self.d2cs_y = cs_y.derivative(nu=2)