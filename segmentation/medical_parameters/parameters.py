from __future__ import annotations

from typing import TYPE_CHECKING, Literal
if TYPE_CHECKING:
    from segmentation.elements.interface import Vertebrae
    from segmentation.elements.gap import Gap

import numpy as np
import pandas as pd

from segmentation.medical_parameters.interface import Parameters

class Vertebrae_Parameters(Parameters):
    def __init__(self, vertebrae: Vertebrae, name: str, projection: Literal["side", "frontal"]):
        super().__init__([vertebrae])

        if projection == "side":
            self._COLUMNS = [
                ("Сагиттальный размер покровной замыкательной пластинки", Vertebrae_Parameters.compute_p1s),
                ("Сагиттальный размер базальной замыкательной пластинки", Vertebrae_Parameters.compute_p2s),
                ("Вертикальный размер тела позвонка по переднему контуру", Vertebrae_Parameters.compute_p3s),
                ("Вертикальный размер тела позвонка по заднему контуру", Vertebrae_Parameters.compute_p4s),
                ("Угол клиновидности тела позвонка", Vertebrae_Parameters.compute_p5s),
                ("Угол наклона переднего контура тела позвонка к оси Z", Vertebrae_Parameters.compute_p6s),
                ("Угол наклона верхней замыкательной пластинки тела позвонка к оси Z", Vertebrae_Parameters.compute_p7s),
                ("Угол наклона нижней замыкательной пластинки тела позвонка к оси Z", Vertebrae_Parameters.compute_p8s),
                ("Угол наклона замыкательной пластинки позвонка S1 к оси X", Vertebrae_Parameters.compute_p9s)
            ]
        else:
            self._COLUMNS = [

            ]

        self.set_parameter_object_names([name])
        self._compute()

    @staticmethod
    def compute_p1s(i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(v.reference_points[1] - v.reference_points[2])
    
    @staticmethod
    def compute_p2s(i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(v.reference_points[0] - v.reference_points[3])
    
    @staticmethod
    def compute_p3s(i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(v.reference_points[0] - v.reference_points[1])

    @staticmethod
    def compute_p4s(i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(v.reference_points[2] - v.reference_points[3])

    @staticmethod
    def compute_p5s(i: int, v: Vertebrae) -> np.float32:
        return np.arccos(
            ((v.reference_points[1][0] - v.reference_points[0][0]) * (v.reference_points[2][0] - v.reference_points[3][0]) + (v.reference_points[1][1] - v.reference_points[0][1]) * (v.reference_points[2][1] - v.reference_points[3][1])) / ((Vertebrae_Parameters.compute_p3s(i, v) * Vertebrae_Parameters.compute_p4s(i, v) + 1e-6))
        )
    
    @staticmethod
    def compute_p6s(i: int, v: Vertebrae) -> np.float32:
        return np.arctan((v.reference_points[0][0] - v.reference_points[1][0]) / (v.reference_points[1][1] - v.reference_points[0][1] + 1e-6))

    @staticmethod
    def compute_p7s(i: int, v: Vertebrae) -> np.float32:
        return np.arctan((v.reference_points[1][0] - v.reference_points[2][0]) / (v.reference_points[1][1] - v.reference_points[2][1] + 1e-6))

    @staticmethod
    def compute_p8s(i: int, v: Vertebrae) -> np.float32:
        return np.arctan((v.reference_points[0][0] - v.reference_points[3][0]) / (v.reference_points[0][1] - v.reference_points[3][1] + 1e-6))

    @staticmethod
    def compute_p9s(i: int, v: Vertebrae) -> np.float32:
        return pd.NA if v.name != "S1" else np.arcsin(
            (v.reference_points[2][1] - v.reference_points[1][1]) / (Vertebrae_Parameters.compute_p1s(i, v) + 1e-6)
        )

class Vertebraes_Parameters(Parameters):
    def __init__(self, vertebraes: list[Vertebrae]):
        super().__init__(vertebraes)

        self.dataframe = pd.concat([v.parameters.dataframe for v in vertebraes], axis=1)

class Gap_Parameters(Parameters):
    def __init__(self, gap_objects: list[Gap]):
        super().__init__(gap_objects)

        self._COLUMNS = [
            ("Угол между телами позвонков", Gap_Parameters.compute_p1),
            ("Высота диска спереди", Gap_Parameters.compute_p2),
            ("Высота диска сзади", Gap_Parameters.compute_p3),
            ("Угол клиновидности диска", Gap_Parameters.compute_p4),
            # "Линейное смещение верхнего позвонка относительно нижнего в плоскости диска",
            # "Угловое смещение верхнего позвонка относительно нижнего в плоскости диска",
            # "Угол между передним контуром позвонка L5 и замыкательной пластинкой S1"
        ]

        self.set_parameter_object_names([g.name for g in gap_objects])
        self._compute()
    
    def compute_p1(i: int, g: Gap) -> np.float32:
        return np.arccos(
            (
                (g[0].reference_points[1][0] - g[0].reference_points[0][0]) *\
                (g[1].reference_points[1][0] - g[1].reference_points[0][0]) +\
                (g[0].reference_points[1][1] - g[0].reference_points[0][1]) *\
                (g[1].reference_points[1][1] - g[1].reference_points[0][1])
            ) /\
            (
                np.linalg.norm(g[0].reference_points[1] - g[0].reference_points[0]) *\
                np.linalg.norm(g[1].reference_points[1] - g[1].reference_points[0]) + 1e-6
            )
        )
    
    def compute_p2(i: int, g: Gap) -> np.float32:
        return np.linalg.norm(g[0].reference_points[1] - g[1].reference_points[0])

    def compute_p3(i: int, g: Gap) -> np.float32:
        return np.linalg.norm(g[0].reference_points[2] - g[1].reference_points[3])

    def compute_p4(i: int, g: Gap) -> np.float32:
        return np.arccos(
            (
                (g[0].reference_points[1][0] - g[1].reference_points[0][0]) *\
                (g[0].reference_points[2][0] - g[1].reference_points[3][0]) +\
                (g[0].reference_points[1][1] - g[1].reference_points[0][1]) *\
                (g[0].reference_points[2][1] - g[1].reference_points[3][1])
            ) /\
            (
                Gap_Parameters.compute_p2(i, g) *\
                Gap_Parameters.compute_p3(i, g) + 1e-6
            )
        )