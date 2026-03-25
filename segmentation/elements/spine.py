from __future__ import annotations

from typing import Literal
import numpy as np
from scipy.integrate import fixed_quad

from segmentation.elements.interface import Spine, Vertebrae
from segmentation.elements.gap import Gap
from segmentation.elements.vertebrae import PVertebrae
from segmentation.elements.segment import Segment

from segmentation.interpolation.interface import vPath
from segmentation.interpolation.path import CentralPath
from segmentation.heal.unstick import unstick
from segmentation.heal.assemble import assemble
from segmentation.heal.reveal import reveal
from segmentation.medical_parameters.parameters import Gap_Parameters, Vertebraes_Parameters, Segment_Parameters, Spine_Parameters

from logging import Logger, getLogger

_logger: Logger = getLogger("segmentation:elements:spine")

class PSpine(Spine):
    """Class for parameterized spine building and computing parameters.

        Builds up the spine-array (array of vertebraes) for frontal and side projections,
        sorts them, heals concatenated vertebraes and fills large gaps with vertebraes,
        links two projections and computes medical parameters related to Gladkov's work.

        Attributes
        ----------
            vertebraes (List[Vertebrae])
                List of vertebraes in spine
    """
    def __init__(
            self, 
            projection: Literal["side", "frontal"],
            vertebraes: list[PVertebrae],
            **kwargs
        ) -> None:
        """Constructor for spine.
        
            Finds vertebraes on pixel arrays, sorts, heals and reveals missing ones,
            links projections and computes medical parameters.

            Args
            ----
                side_pixel_array: (np.ndarray[np.uint8])
                    Gray-Scaled pixel array of side projection of patient X-Ray
                segmentation_model (YOLO):
                    Segmentation model that can find vertebraes
        """
        super().__init__(projection, vertebraes)
        
        self.vertebraes = unstick(self.vertebraes)
        
        if projection == "side":
            ext_points = [
                np.empty((0, )),
                np.empty((0, ))
            ]
        
        if projection == "frontal":
            ext_points = PSpine._compute_ext_points(kwargs["side_spine"].vertebraes, self.vertebraes)

        self.vpath = PSpine._compute_spine_central_path(
            self.vertebraes,
            kwargs.get("max_iter", 50),
            kwargs.get("tol", 1e-9),
            *ext_points
        )
        self._set_vpath()

        if projection == "side":
            _logger.info("Starting revealing.")
            self.vertebraes = reveal(self)
            self.vertebraes = unstick(self.vertebraes)
        
        if projection == "frontal":
            _logger.info("Starting assembling.")
            self.vertebraes = assemble(kwargs["side_spine"], self)
            self.vertebraes = unstick(self.vertebraes)
        
        _logger.info("Rebuilding path.")
        self.vpath = PSpine._compute_spine_central_path(
            self.vertebraes,
            kwargs.get("max_iter", 50),
            kwargs.get("tol", 1e-9),
            *ext_points
        )
        self._set_vpath()

        self._set_v_names()
        self.segments = self._get_segments()

        _logger.info("Starting parameters-computing.")
        self._compute_parameters()

    def _set_v_names(self) -> None:
        for i, v in enumerate(self.vertebraes):
            v.set_name(self._names[i])

    def _compute_parameters(self) -> None:
        self.vertebraes_parameters = Vertebraes_Parameters(self.vertebraes, self.projection)

        self.gap_parameters = Gap_Parameters(
            [Gap(g[0], g[1], f"{g[0].name}-{g[1].name}") for g in zip(self.vertebraes[:-1], self.vertebraes[1:])],
            self.projection
        )

        self.segment_parameters = Segment_Parameters(self.segments, self.projection)
        
        self.spine_parameters = Spine_Parameters(self, self.projection)

    def _set_vpath(self) -> None:
        for i, v in enumerate(self.vertebraes):
            v.set_p(self.vpath.get_vertebrae_parametrization(i))
    
    @staticmethod
    def _kappat(t: np.float32, cls: PSpine) -> np.float32:
        d = cls.vpath.df(t)
        d2 = cls.vpath.d2f(t)
        return (d[:, 0] * d2[:, 1] - d[:, 1] * d2[:, 0]) / np.pow(np.linalg.norm(d), 1.5)

    def _get_segments(self) -> list[Segment]:
        if self.projection == "side":
            return [
                Segment(self.vertebraes[1:6]),
                Segment(self.vertebraes[1:18]),
                Segment(self.vertebraes[6:18]),
                Segment(self.vertebraes[18:24]),
                Segment(self.vertebraes[6:10]),
                Segment(self.vertebraes[9:14]),
                Segment(self.vertebraes[13:18]),
            ]
        else:
            segments = [
                self.vertebraes[1:18],
                []
            ]
            prev, total = 0, 0
            start_t = self.vertebraes[0].p.t_bottom
            for v in self.vertebraes:
                total += fixed_quad(
                    PSpine._kappat,
                    start_t,
                    v.p.t_up,
                    args=(self, ),
                    n=4
                )[0]
                
                if (prev != 0 and np.sign(prev) != np.sign(total)) or np.abs(total) < np.abs(prev):
                    if any([s[0].name == segments[-1][0].name and s[-1].name == segments[-1][-1].name for s in segments[:-1]]):
                        segments[-1] = []
                    else:
                        segments.append([])
                    
                    start_t = v.p.t_bottom
                    total = 0

                segments[-1].append(v)
                prev = total
            
            s_i = 1
            while s_i < len(segments):
                if len(segments[s_i]) < 2:
                    segments[s_i - 1] += segments[s_i]
                    segments = segments[:s_i] + segments[s_i + 1:]
                else:
                    s_i += 1
            
            return [Segment(s) for s in segments]
            

    @staticmethod
    def _compute_spine_central_path(
            vertebraes: list[Vertebrae],
            max_iter: int = 50,
            tol: float = 1e-9,
            ext_mpoints_before: np.ndarray[np.float32] = np.empty((0, )),
            ext_mpoints_after: np.ndarray[np.float32] = np.empty((0, ))
        ) -> vPath:
        _logger.info("Starting computing central path.")
        vpath = CentralPath(
            np.concatenate(
                [
                    [np.average(v.reference_points[[0, 3]], axis=0), np.average(v.reference_points[[1, 2]], axis=0)]
                    for v in vertebraes
                ],
                axis=0,
                dtype=np.float32
            ),
            max_iter,
            tol,
            ext_mpoints_before,
            ext_mpoints_after
        )
        _logger.info("Computing done.")

        return vpath

    @staticmethod
    def _compute_ext_points(side_vertebraes: list[Vertebrae], front_vertebraes: list[Vertebrae]) -> tuple[np.ndarray[np.int32], np.ndarray[np.int32]]:
        front_weight_mx = np.average([v.reference_points[:, 0] for v in front_vertebraes])
        
        ext_bottom = []
        side_bottom_y = np.average(side_vertebraes[0].reference_points[[0, 3]][:, 1])
        front_bottom_y = np.average(front_vertebraes[0].reference_points[[0, 3]][:, 1])
        if side_bottom_y > front_bottom_y:
            ext_bottom.append(
                [front_weight_mx, side_bottom_y]
            )
        ext_bottom = ext_bottom if len(ext_bottom) != 0 else np.empty((0, ))

        ext_up = []
        side_up_y = np.average(side_vertebraes[-1].reference_points[[1, 2]][:, 1])
        front_up_y = np.average(front_vertebraes[-1].reference_points[[1, 2]][:, 1])
        if side_up_y < front_up_y:
            ext_up.append(
                [front_weight_mx, side_up_y]
            )
        ext_up = ext_up if len(ext_up) != 0 else np.empty((0, ))
        
        return (
            np.array(
                ext_bottom,
                dtype=np.int32
            ),
            np.array(
                ext_up,
                dtype=np.int32
            )
        )