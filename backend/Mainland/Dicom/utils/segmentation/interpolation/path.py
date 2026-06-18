from copy import deepcopy
import numpy as np
from scipy.interpolate import CubicSpline
from scipy.integrate import fixed_quad

from Dicom.utils.segmentation.interpolation.types import CS2D, Parametrization
from Dicom.utils.segmentation.interpolation.interface import vPath

class CentralPath(vPath):
    def __init__(
            self, 
            middle_points: np.ndarray[np.float32],
            max_iter: int = 50,
            tol: float = 1e-9,
            ext_mpoints_before: np.ndarray[np.float32] = np.empty((0, )),
            ext_mpoints_after: np.ndarray[np.float32] = np.empty((0, ))
        ) -> None:

        self._shift = ext_mpoints_before.shape[0]

        self._ext_middle_points = np.concatenate(
            list(
                filter(
                    lambda x: x.shape[0] != 0,
                    [ext_mpoints_before, middle_points, ext_mpoints_after]
                )
            ),
            axis=0
        )

        self._t: list[np.float] = [0]
        for pi in range(1, len(self._ext_middle_points)):
            self._t.append(self._t[-1] + np.linalg.norm(self._ext_middle_points[pi - 1] - self._ext_middle_points[pi]))
        self._t: np.ndarray[np.float32] = np.array(self._t, dtype=np.float32)
        
        self._cs_2d: CS2D
        old_cs_2d: CS2D = None

        diff: float = float("inf")
        for it in range(max_iter):
            if diff < tol:
                break
            
            self._cs_2d = CS2D(
                CubicSpline(self._t, (self._ext_middle_points.T)[0], bc_type="natural"),
                CubicSpline(self._t, (self._ext_middle_points.T)[1], bc_type="natural")
            )

            tmp = [0]
            for i in range(1, self._t.shape[0]):
                tmp.append(
                    tmp[-1] + fixed_quad(
                        CentralPath._compute_path_length,
                        self._t[i - 1],
                        self._t[i],
                        args=(self._cs_2d, ),
                        n=4
                    )[0]
                )

            self._t = np.array(
                tmp,
                dtype=np.float32
            )

            if it > 0:
                diff = fixed_quad(
                    CentralPath._compute_L2,
                    0, 
                    self._t[-1], 
                    args=(self._cs_2d, old_cs_2d),
                    n=4
                )[0]
            old_cs_2d = deepcopy(self._cs_2d)

    def get_vertebrae_parametrization(self, vind: int) -> Parametrization:
        t = self._t[self._shift + 2 * vind: self._shift + 2 * vind + 2]
        return Parametrization(*t) if len(t) == 2 else None

    def f(self, t: np.ndarray[np.float32] | np.float32) -> np.ndarray[np.float32]:
        p: np.ndarray[np.float32] = np.array([self._cs_2d.cs_x(t), self._cs_2d.cs_y(t)], dtype=np.float32)
        try:
            iter(t)
        except TypeError:
            return p
        else:
            return p.T
    
    def fn(self, t: np.ndarray[np.float32] | np.float32) -> np.ndarray[np.float32]:
        n: np.ndarray[np.float32] = np.array([self._cs_2d.dcs_y(t), -self._cs_2d.dcs_x(t)], dtype=np.float32)
        n /= np.linalg.norm(n)
        try:
            iter(t)
        except TypeError:
            return n
        else:
            return n.T
    
    def df(self, t: np.ndarray[np.float32]) -> np.ndarray[np.float32]:
        d: np.ndarray[np.float32] = np.array([self._cs_2d.dcs_x(t), self._cs_2d.dcs_y(t)], dtype=np.float32)
        d /= np.linalg.norm(d)
        try:
            iter(t)
        except TypeError:
            return d
        else:
            return d.T
        
    def d2f(self, t: np.ndarray[np.float32]) -> np.ndarray[np.float32]:
        d: np.ndarray[np.float32] = np.array([self._cs_2d.d2cs_x(t), self._cs_2d.d2cs_y(t)], dtype=np.float32)
        d /= np.linalg.norm(d)
        try:
            iter(t)
        except TypeError:
            return d
        else:
            return d.T

    @staticmethod
    def _compute_path_length(t: np.float32, cs: CS2D) -> np.float32:
        return np.sqrt(cs.dcs_x(t) ** 2 + cs.dcs_y(t) ** 2)

    @staticmethod
    def _compute_L2(t: np.float32, cs: CS2D, cs_old: CS2D) -> np.float32:
        return np.sqrt((cs.dcs_x(t) - cs_old.dcs_x(t)) ** 2 + (cs.dcs_y(t) - cs_old.dcs_y(t)) ** 2)