from __future__ import annotations

from typing import TYPE_CHECKING, Literal
if TYPE_CHECKING:
    from segmentation.elements.interface import Vertebrae
    from segmentation.elements.gap import Gap
    from segmentation.elements.segment import Segment
    from segmentation.elements.spine import Spine

import numpy as np
import pandas as pd

from segmentation.medical_parameters.interface import Parameters

class Vertebraes_Parameters(Parameters):
    def __init__(self, vertebraes: list[Vertebrae], projection: Literal["side", "frontal"]):
        super().__init__(vertebraes)

        if projection == "side":
            self._COLUMNS = [
                ("Сагиттальный размер покровной замыкательной пластинки", self._compute_p1s),
                ("Сагиттальный размер базальной замыкательной пластинки", self._compute_p2s),
                ("Вертикальный размер тела позвонка по переднему контуру", self._compute_p3s),
                ("Вертикальный размер тела позвонка по заднему контуру", self._compute_p4s),
                ("Угол клиновидности тела позвонка", self._compute_p5s),
                ("Угол наклона переднего контура тела позвонка к оси Z", self._compute_p6s),
                ("Угол наклона верхней замыкательной пластинки тела позвонка к оси Z", self._compute_p7s),
                ("Угол наклона нижней замыкательной пластинки тела позвонка к оси Z", self._compute_p8s),
                ("Угол наклона замыкательной пластинки позвонка S1 к оси X", self._compute_p9s)
            ]
        else:
            self._COLUMNS = [
                ("Фронтальный размер верхней замыкательной пластинки", self._compute_p1s),
                ("Фронтальный размер нижней замыкательной пластинки", self._compute_p2s),
                ("Высота тела позвонка по правому контуру", self._compute_p3s),
                ("Высота тела позвонка по левому контуру", self._compute_p4s),
                ("Высота тела позвонка по центру", self._compute_p5f),
                ("Угол фронтальной клиновидности тела позвонка", self._compute_p5s),
                ("Угол наклона центральной линии позвонка к оси Z", self._compute_p7f),
                ("Угол наклона верхней замыкательной пластинки тела позвонка к оси Z", self._compute_p7s),
                ("Угол наклона нижней замыкательной пластинки тела позвонка к оси Z", self._compute_p8s),
            ]

        self._compute()

    def _compute_p1s(self, i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(v.reference_points[1] - v.reference_points[2])

    def _compute_p2s(self, i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(v.reference_points[0] - v.reference_points[3])

    def _compute_p3s(self, i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(v.reference_points[0] - v.reference_points[1])

    def _compute_p4s(self, i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(v.reference_points[2] - v.reference_points[3])

    def _compute_p5s(self, i: int, v: Vertebrae) -> np.float32:
        return np.arccos(
            ((v.reference_points[1][0] - v.reference_points[0][0]) * (v.reference_points[2][0] - v.reference_points[3][0]) + (v.reference_points[1][1] - v.reference_points[0][1]) * (v.reference_points[2][1] - v.reference_points[3][1])) / ((self._compute_p3s(i, v) * self._compute_p4s(i, v) + 1e-9))
        )

    def _compute_p6s(self, i: int, v: Vertebrae) -> np.float32:
        return np.arctan((v.reference_points[0][0] - v.reference_points[1][0]) / (v.reference_points[1][1] - v.reference_points[0][1] + 1e-9))

    def _compute_p7s(self, i: int, v: Vertebrae) -> np.float32:
        return np.arctan((v.reference_points[1][0] - v.reference_points[2][0]) / (v.reference_points[1][1] - v.reference_points[2][1] + 1e-9))

    def _compute_p8s(self, i: int, v: Vertebrae) -> np.float32:
        return np.arctan((v.reference_points[0][0] - v.reference_points[3][0]) / (v.reference_points[0][1] - v.reference_points[3][1] + 1e-9))

    def _compute_p9s(self, i: int, v: Vertebrae) -> np.float32:
        return pd.NA if v.name != "S1" else np.arcsin(
            (v.reference_points[2][1] - v.reference_points[1][1]) / (self._compute_p1s(i, v) + 1e-9)
        )

    def _compute_p5f(self, i: int, v: Vertebrae) -> np.float32:
        return np.linalg.norm(np.average(v.reference_points[[1, 2]], axis=1) - np.average(v.reference_points[[0, 3]], axis=1))

    def _compute_p7f(self, i: int, v: Vertebrae) -> np.float32:
        p5f_v = np.average(v.reference_points[[1, 2]], axis=1) - np.average(v.reference_points[[0, 3]], axis=1)
        return np.arctan(
            p5f_v[0] / (p5f_v[1] + 1e-9)
        )

class Gap_Parameters(Parameters):
    def __init__(self, gap_objects: list[Gap], projection: Literal["side", "frontal"]):
        super().__init__(gap_objects)

        if projection == "side":
            self._COLUMNS = [
                ("Угол между телами позвонков", self._compute_p1),
                ("Высота диска спереди", self._compute_p2),
                ("Высота диска сзади", self._compute_p3),
                ("Угол клиновидности диска", self._compute_p4),
                ("Линейное смещение верхнего позвонка относительно нижнего в плоскости диска", self._compute_p5),
                ("Угловое смещение верхнего позвонка относительно нижнего в плоскости диска", self._compute_p6),
                ("Угол между передним контуром позвонка L5 и замыкательной пластинкой S1", self._compute_p7)
            ]
        else:
            self._COLUMNS = [
                ("Угол между телами позвонков", self._compute_p1),
                ("Высота диска справа", self._compute_p2),
                ("Высота диска слева", self._compute_p3),
                ("Угол клиновидности диска", self._compute_p4),
                ("Линейное смещение верхнего позвонка относительно нижнего в плоскости диска", self._compute_p5),
                ("Угловое смещение верхнего позвонка относительно нижнего в плоскости диска", self._compute_p6),
                ("Угол между передним контуром позвонка L5 и замыкательной пластинкой S1", self._compute_p7)
            ]

        self._compute()

    def _compute_p1(self, i: int, g: Gap) -> np.float32:
        g110 = g[0].reference_points[1] - g[0].reference_points[0]
        g210 = g[1].reference_points[1] - g[1].reference_points[0]
        return np.arccos(
            (g110[0] * g210[0] + g110[1] * g210[1]) / (np.linalg.norm(g110) * np.linalg.norm(g210) + 1e-9)
        )

    def _compute_p2(self, i: int, g: Gap) -> np.float32:
        return np.linalg.norm(g[0].reference_points[1] - g[1].reference_points[0])

    def _compute_p3(self, i: int, g: Gap) -> np.float32:
        return np.linalg.norm(g[0].reference_points[2] - g[1].reference_points[3])

    def _compute_p4(self, i: int, g: Gap) -> np.float32:
        g10 = g[0].reference_points[1] - g[1].reference_points[0]
        g23 = g[0].reference_points[2] - g[1].reference_points[3]
        return np.arccos(
            (g10[0] * g23[0] + g10[1] * g23[1]) / (self._compute_p2(i, g) * self._compute_p3(i, g) + 1e-9)
        )

    def _compute_p5(self, i: int, g: Gap) -> np.float32:
        g01 = g[1].reference_points[0] - g[0].reference_points[1]
        g21 = g[0].reference_points[2] - g[0].reference_points[1]
        return (g01[0] * g21[0] + g01[1] * g21[1]) / (np.linalg.norm(g21) + 1e-9)

    def _compute_p6(self, i: int, g: Gap) -> np.float32:
        g121 = g[0].reference_points[2] - g[0].reference_points[1]
        g01 = g[1].reference_points[0] - g[0].reference_points[1]
        return np.arccos(
            (g01[0] * g121[0] + g01[1] * g121[1]) / (np.linalg.norm(g01) * np.linalg.norm(g121) + 1e-9)
        )

    def _compute_p7(self, i: int, g: Gap) -> np.float32:
        g10 = g[1].reference_points[1] - g[1].reference_points[0]
        g21 = g[0].reference_points[2] - g[0].reference_points[1]
        return pd.NA if g.name != "S1-L5" else np.arccos(
            (g10[0] * g21[0] + g10[1] * g21[1]) / (np.linalg.norm(g10) * np.linalg.norm(g21) + 1e-9)
        )

class Segment_Parameters(Parameters):
    def __init__(self, segment_objects: list[Segment], projection: Literal["side", "frontal"]):
        super().__init__(segment_objects)

        self._abc = []
        for s in segment_objects:
            W = np.array(
                [
                    [1, *np.average(v.reference_points[cup], axis=1)]
                    for cup in [[0, 3], [1, 2]]
                    for v in s.vertebraes
                ],
                dtype=np.float32
            )
            U = np.array(
                [
                    np.sum(np.pow(np.average(v.reference_points[cup], axis=1), 2) * -1)
                    for cup in [[0, 3], [1, 2]]
                    for v in s.vertebraes
                ],
                dtype=np.float32
            )

            self._abc.append(np.linalg.solve(np.dot(W.T, W), np.dot(W.T, U)))
            
        self._COLUMNS = [
            ("Радиус дуги", self._compute_p1),
            ("Длина хорды дуги", self._compute_p2),
            ("Центральный угол дуги", self._compute_p3),
            ("Угол наклона хорды дуги", self._compute_p4)

        ]

        self._compute()

    def _compute_p1(self, i: int, s: Segment) -> np.float32:
        return 0.5 * np.sqrt(self._abc[i][1] ** 2 + self._abc[i][2] ** 2 - 4 * self._abc[i][0])
    
    def _compute_p2(self, i: int, s: Segment) -> np.float32:
        return np.linalg.norm(
            np.average(s.vertebraes[0].reference_points[[0, 3]], axis=1) - np.average(s.vertebraes[-1].reference_points[[1, 2]], axis=1)
        )

    def _compute_p3(self, i: int, s: Segment) -> np.float32:
        R = self._compute_p1(i, s)
        L = self._compute_p2(i, s)
        return np.arccos(
            (2 * R * R - L * L) / (2 * R * R + 1e-9)
        )
    
    def _compute_p4(self, i: int, s: Segment) -> np.float32:
        v = np.average(s.vertebraes[0].reference_points[[0, 3]], axis=1) - np.average(s.vertebraes[-1].reference_points[[1, 2]], axis=1)
        return np.arctan(
            v[1] / (v[0] + 1e-9)
        )

class Spine_Parameters(Parameters):
    def __init__(self, spine: Spine, projection: Literal["side", "frontal"]):
        super().__init__([spine])
  
        self._COLUMNS = [
            ("Угол наклона оси туловища Th1-L5", self._compute_p1),
            ("Длина оси туловища Th1-L5", self._compute_p2),
            ("Проекция ОГЦМ", self._compute_p3),

        ]

        self._compute()

    def _compute_p1(self, i: int, s: Spine) -> np.float32:
        return np.arctan((s.vertebraes[1].reference_points[0, 0] - s.vertebraes[17].reference_points[1, 0]) / (s.vertebraes[1].reference_points[0, 1] - s.vertebraes[17].reference_points[1, 1] + 1e-9))
    
    def _compute_p2(self, i: int, s: Spine) -> np.float32:
        return np.linalg.norm(
            s.vertebraes[1].reference_points[0] - s.vertebraes[17].reference_points[1]
        )

    def _compute_p3(self, i: int, s: Spine) -> np.float32:
        return self._compute_p2(i, s) * np.sin(self._compute_p1(i, s)) / 2
