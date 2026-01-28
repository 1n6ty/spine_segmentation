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

        self.projection = projection

        if projection == "side":
            self._COLUMNS = [
                (
                    "Сагиттальный размер покровной замыкательной пластинки", 
                    self._compute_p1s,
                    {

                    }
                ),
                (
                    "Сагиттальный размер базальной замыкательной пластинки", 
                    self._compute_p2s,
                    {

                    }
                ),
                (
                    "Вертикальный размер тела позвонка по переднему контуру",
                    self._compute_p3s,
                    {

                    }
                ),
                (
                    "Вертикальный размер тела позвонка по заднему контуру",
                    self._compute_p4s,
                    {

                    }
                ),
                (
                    "Угол клиновидности тела позвонка", 
                    self._compute_p5s,
                    {
                        -1: {
                            "default": "Тело {name} позвонка клиновидно деформированно. Угол клиновидности {val:.2f}°"
                        },
                        0: {
                            "default": "Тело {name} позвонка клиновидно не деформированно",
                        },
                        1: {
                            "default": "Тело {name} позвонка клиновидно деформированно. Угол клиновидности {val:.2f}°"
                        }
                    }
                ),
                (
                    "Угол наклона переднего контура тела позвонка к оси Z",
                    self._compute_p6s,
                    {

                    }
                ),
                (
                    "Угол наклона верхней замыкательной пластинки тела позвонка к оси Z",
                    self._compute_p7s,
                    {
                        -1: {
                            "S1": "Положение крестца стремится к горизонтали",
                            "L5": "Тело позвонка отклонено кзади. Угол наклона {val:.2f}°"
                        },
                        0: {
                            "S1": "Положение крестца к оси Z не изменено",
                            "L5": "Наклон L5 позвонка не изменен"
                        },
                        1: {
                            "S1": "Положение крестца стремится к вертикали",
                            "L5": "Тело позвонка отклонено кпереди 1 ст. Угол наклона {val:.2f}°"
                        },
                        2: {
                            "L5": "Тело позвонка отклонено кпереди 2 ст. Угол наклона {val:.2f}°"
                        },
                        3: {
                            "L5": "Тело позвонка отклонено кпереди 3 ст. Угол наклона {val:.2f}°"
                        },
                        4: {
                            "L5": "Тело позвонка отклонено кпереди 4 ст. Угол наклона {val:.2f}°"
                        },
                        5: {
                            "L5": "Тело позвонка отклонено кпереди 5 ст. Угол наклона {val:.2f}°"
                        }
                    }
                ),
                (
                    "Угол наклона нижней замыкательной пластинки тела позвонка к оси Z",
                    self._compute_p8s,
                    {

                    }
                ),
                (
                    "Угол наклона замыкательной пластинки позвонка S1 к оси X",
                    self._compute_p9s,
                    {

                    }
                )
            ]
        else:
            self._COLUMNS = [
                (
                    "Фронтальный размер верхней замыкательной пластинки", 
                    self._compute_p1s,
                    {

                    }
                ),
                (
                    "Фронтальный размер нижней замыкательной пластинки",
                    self._compute_p2s,
                    {

                    }
                ),
                (
                    "Высота тела позвонка по правому контуру",
                    self._compute_p3s,
                    {

                    }
                ),
                (
                    "Высота тела позвонка по левому контуру",
                    self._compute_p4s,
                    {

                    }
                ),
                (
                    "Высота тела позвонка по центру",
                    self._compute_p5f,
                    {

                    }
                ),
                (
                    "Угол фронтальной клиновидности тела позвонка",
                    self._compute_p5s,
                    {
                        -1: {
                            "default": "Тело {name} позвонка клиновидно деформированно. Угол клиновидности {val:.2f}°"
                        },
                        0: {
                            "default": "Тело {name} позвонка клиновидно не деформированно"
                        },
                        1: {
                            "default": "Тело {name} позвонка клиновидно деформированно. Угол клиновидности {val:.2f}°"
                        }
                    }
                ),
                (
                    "Угол наклона центральной линии позвонка к оси Z",
                    self._compute_p7f,
                    {
                        
                    }
                ),
                (
                    "Угол наклона верхней замыкательной пластинки тела позвонка к оси Z",
                    self._compute_p7s,
                    {
                        -1: {
                            "L5": "Тело L5 позвонка отклонено влево на {val:.2f}°"
                        },
                        0: {
                            "L5": "Тело L5 позвонка не отклонено"
                        }
                    }
                ),
                (
                    "Угол наклона нижней замыкательной пластинки тела позвонка к оси Z",
                    self._compute_p8s,
                    {

                    }
                ),
            ]

        self._compute()

    def _compute(self):
        for i, o in enumerate(self._objects):
            for p_ind, p in enumerate(self._COLUMNS, start=1):
                param_name = f"{p_ind}. {p[0]}"
                r = p[1](i, o)

                if r[0] is not None:
                    result = np.float32(r[0])

                    self.dataframe.loc[param_name, o.name] = result
                    if r[1] is not None:
                        self.codeframe.loc[param_name, o.name] = r[1]
                        if r[1] in list(p[2].keys()):
                            keys = list(p[2][r[1]].keys())
                            
                            if o.name in keys:
                                self.strframe.loc[param_name, o.name] = p[2][r[1]][o.name].format(name=o.name, val=result)
                            elif "default" in keys:
                                self.strframe.loc[param_name, o.name] = p[2][r[1]]["default"].format(name=o.name, val=result)

    def _compute_p1s(self, i: int, v: Vertebrae) -> np.float32:
        return (
            np.linalg.norm(v.reference_points[1] - v.reference_points[2]),
            None,
        )

    def _compute_p2s(self, i: int, v: Vertebrae) -> np.float32:
        return (
            np.linalg.norm(v.reference_points[0] - v.reference_points[3]),
            None,
        )

    def _compute_p3s(self, i: int, v: Vertebrae) -> np.float32:
        return (
            np.linalg.norm(v.reference_points[0] - v.reference_points[1]),
            None,
        )

    def _compute_p4s(self, i: int, v: Vertebrae) -> np.float32:
        return (
            np.linalg.norm(v.reference_points[2] - v.reference_points[3]),
            None,
        )

    def _compute_p5s(self, i: int, v: Vertebrae) -> np.float32:
        r = np.degrees(
            np.arccos(
                ((v.reference_points[1][0] - v.reference_points[0][0]) * (v.reference_points[2][0] - v.reference_points[3][0]) + (v.reference_points[1][1] - v.reference_points[0][1]) * (v.reference_points[2][1] - v.reference_points[3][1])) / ((self._compute_p3s(i, v)[0] * self._compute_p4s(i, v)[0] + 1e-9))
            )
        )

        code = self.check_interval([-1, 1], r, 1)
        
        return (r, code)

    def _compute_p6s(self, i: int, v: Vertebrae) -> np.float32:
        return (
            np.arctan((v.reference_points[0][0] - v.reference_points[1][0]) / (v.reference_points[1][1] - v.reference_points[0][1] + 1e-9)),
            None
        )

    def _compute_p7s(self, i: int, v: Vertebrae) -> np.float32:
        r = np.degrees(
            np.arctan((v.reference_points[1][0] - v.reference_points[2][0]) / (v.reference_points[1][1] - v.reference_points[2][1] + 1e-9))
        )

        code = None
        if self.projection == "side":
            if v.name == "S1":
                code = self.check_interval([99, 124], r, 1)
            elif v.name == "L5":
                code = self.check_interval([-3, 18, 22, 36, 60, 80], r, 1)
        else:
            if v.name == "L5":
                code = self.check_interval([-89, 89], r, 1)

        return (r, code)

    def _compute_p8s(self, i: int, v: Vertebrae) -> np.float32:
        return (
            np.arctan((v.reference_points[0][0] - v.reference_points[3][0]) / (v.reference_points[0][1] - v.reference_points[3][1] + 1e-9)),
            None
        )

    def _compute_p9s(self, i: int, v: Vertebrae) -> np.float32:
        r = None if v.name != "S1" else np.arcsin(
            (v.reference_points[2][1] - v.reference_points[1][1]) / (self._compute_p1s(i, v)[0] + 1e-9)
        )
        return (r, None)

    def _compute_p5f(self, i: int, v: Vertebrae) -> np.float32:
        return (
            np.linalg.norm(np.average(v.reference_points[[1, 2]], axis=1) - np.average(v.reference_points[[0, 3]], axis=1)),
            None
        )

    def _compute_p7f(self, i: int, v: Vertebrae) -> np.float32:
        p5f_v = np.average(v.reference_points[[1, 2]], axis=1) - np.average(v.reference_points[[0, 3]], axis=1)
        r = np.arctan(
            p5f_v[0] / (p5f_v[1] + 1e-9)
        )
        return (r, None)

class Gap_Parameters(Parameters):
    def __init__(self, gap_objects: list[Gap], projection: Literal["side", "frontal"]):
        super().__init__(gap_objects)

        self.projection = projection

        if projection == "side":
            self._COLUMNS = [
                (
                    "Угол между телами позвонков",
                    self._compute_p1,
                    {
                        -1: {
                            "default": "Кифотизация на уровне {name}"
                        },
                        0: {
                            "default": "Угловое взаимоотношение {name} не изменено"
                        },
                        1: {
                            "default": "Гиперлордоз на уровне {name}"
                        },
                    }
                ),
                (
                    "Высота диска спереди",
                    self._compute_p2,
                    {

                    }
                ),
                (
                    "Высота диска сзади",
                    self._compute_p3,
                    {

                    }
                ),
                (
                    "Угол клиновидности диска",
                    self._compute_p4,
                    {
                        -1: {
                            "default": "Клиновидность диска за счет снижения его вентрального отдела. Угол клиновидности {val:.2f}°"
                        },
                        0: {
                            "default": "Замыкательные пластинки диска параллельны"
                        },
                        1: {
                            "default": "Клиновидность диска за счет расширения его вентрального отдела. Угол клиновидности {val:.2f}°"
                        }
                    }
                ),
                (
                    "Линейное смещение верхнего позвонка относительно нижнего в плоскости диска",
                    self._compute_p5,
                    {

                    }
                ),
                (
                    "Угловое смещение верхнего позвонка относительно нижнего в плоскости диска",
                    self._compute_p6,
                    {

                    }
                ),
                (
                    "Угол между передним контуром позвонка L5 и замыкательной пластинкой S1",
                    self._compute_p7,
                    {
                        -5: {
                            "S1-L5": "Антелистез L5 позвонка 5 ст."
                        },
                        -4: {
                            "S1-L5": "Антелистез L5 позвонка 4 ст."
                        },
                        -3: {
                            "S1-L5": "Антелистез L5 позвонка 3 ст."
                        },
                        -2: {
                            "S1-L5": "Антелистез L5 позвонка 2 ст."
                        },
                        -1: {
                            "S1-L5": "Антелистез L5 позвонка 1 ст."
                        }, 
                        0: {
                            "S1-L5": ""
                        }
                    }
                )
            ]
        else:
            self._COLUMNS = [
                (
                    "Угол между телами позвонков",
                    self._compute_p1,
                    {
                        -1: {
                            "default": "Отмечается угловое отклонение оси позвоночника вправо на уровне {name} сегмента величиной {val:.2f}°"
                        },
                        0: {
                            "default": "Угловое взаимоотношение {name} не изменено"
                        },
                        1: {
                            "default": "Отмечается угловое отклонение оси позвоночника влево на уровне {name} сегмента величиной {val:.2f}°"
                        },
                    }
                ),
                (
                    "Высота диска справа", 
                    self._compute_p2,
                    {

                    }
                ),
                (
                    "Высота диска слева",
                    self._compute_p3,
                    {

                    }
                ),
                (
                    "Угол клиновидности диска",
                    self._compute_p4,
                    {
                        -1: {
                            "default": "Клиновидность диска за счет снижения его вентрального отдела. Угол клиновидности {val:.2f}°"
                        },
                        0: {
                            "default": "Замыкательные пластинки диска параллельны"
                        },
                        1: {
                            "default": "Клиновидность диска за счет расширения его вентрального отдела. Угол клиновидности {val:.2f}°"
                        }
                    }
                ),
                (
                    "Линейное смещение верхнего позвонка относительно нижнего в плоскости диска",
                    self._compute_p5,
                    {

                    }
                ),
                (
                    "Угловое смещение верхнего позвонка относительно нижнего в плоскости диска",
                    self._compute_p6,
                    {

                    }
                ),
                (
                    "Угол между передним контуром позвонка L5 и замыкательной пластинкой S1",
                    self._compute_p7,
                    {

                    }
                )
            ]

        self._compute()

    def _compute(self):
        for i, o in enumerate(self._objects):
            for p_ind, p in enumerate(self._COLUMNS, start=1):
                param_name = f"{p_ind}. {p[0]}"
                r = p[1](i, o)

                if r[0] is not None:
                    result = np.float32(r[0])

                    self.dataframe.loc[param_name, o.name] = result
                    if r[1] is not None:
                        self.codeframe.loc[param_name, o.name] = r[1]
                        if r[1] in list(p[2].keys()):
                            keys = list(p[2][r[1]].keys())
                            vers = o.name.split('-')
                            
                            if o.name in keys:
                                self.strframe.loc[param_name, o.name] = p[2][r[1]][o.name].format(name=o.name, name_d=vers[0], name_u=vers[1], val=result)
                            elif "default" in keys:
                                self.strframe.loc[param_name, o.name] = p[2][r[1]]["default"].format(name=o.name, name_d=vers[0], name_u=vers[1], val=result)

    def _compute_p1(self, i: int, g: Gap) -> np.float32:
        g110 = g[0].reference_points[1] - g[0].reference_points[0]
        g210 = g[1].reference_points[1] - g[1].reference_points[0]
        r = np.degrees(
            np.arccos(
                (g110[0] * g210[0] + g110[1] * g210[1]) / (np.linalg.norm(g110) * np.linalg.norm(g210) + 1e-9)
            )
        )

        code = None
        if self.projection == "side":
            if g.name == "S1-L5":
                code = self.check_interval([-117, -97.5], r, 1)
            elif g.name == "L5-L4":
                code = self.check_interval([-22.6, -7.8], r, 1)
            elif g.name == "L4-L3":
                code = self.check_interval([-15.5, -3.5], r, 1)
            elif g.name == "L3-L2":
                code = self.check_interval([-10.3, -3.5], r, 1)
            elif g.name == "L2-L1":
                code = self.check_interval([-3.4, 3.8], r, 1)
            elif g.name == "L1-Th12":
                code = self.check_interval([0.5, 8.3], r, 1)
            elif g.name == "Th12-Th11":
                code = self.check_interval([-4.1, 8.9], r, 1)
            elif g.name == "Th11-Th10":
                code = self.check_interval([-2.9, 7.9], r, 1)
            elif g.name == "Th10-Th9":
                code = self.check_interval([0.6, 6], r, 1)
            elif g.name == "Th9-Th8":
                code = self.check_interval([-1.1, 11.1], r, 1)
            elif g.name == "Th8-Th7":
                code = self.check_interval([2, 10.6], r, 1)
            elif g.name == "Th7-Th6":
                code = self.check_interval([4.1, 9.1], r, 1)
            elif g.name == "Th6-Th5":
                code = self.check_interval([0, 8.6], r, 1)
            elif g.name == "Th5-Th4":
                code = self.check_interval([1.6, 7.6], r, 1)
            elif g.name == "Th4-Th3":
                code = self.check_interval([-1.5, 4.5], r, 1)
            elif g.name == "Th3-Th2":
                code = self.check_interval([-1.8, 6.6], r, 1)
            elif g.name == "Th2-Th1":
                code = self.check_interval([-4.2, 3.8], r, 1)
            elif g.name == "Th1-C7":
                code = self.check_interval([-9.3, -1.5], r, 1)
            elif g.name == "C7-C6":
                code = self.check_interval([-12.5, 1.1], r, 1)
            elif g.name == "C6-C5":
                code = self.check_interval([-9.5, 6.3], r, 1)
            elif g.name == "C5-C4":
                code = self.check_interval([-10.7, 4.1], r, 1)
            elif g.name == "C4-C3":
                code = self.check_interval([-14.4, 5.6], r, 1)
        else:
            code = self.check_interval([-1, 1], r, 1)

        return (r, code)

    def _compute_p2(self, i: int, g: Gap) -> np.float32:
        return (
            np.linalg.norm(g[0].reference_points[1] - g[1].reference_points[0]),
            None
        )

    def _compute_p3(self, i: int, g: Gap) -> np.float32:
        return (
            np.linalg.norm(g[0].reference_points[2] - g[1].reference_points[3]),
            None
        )

    def _compute_p4(self, i: int, g: Gap) -> np.float32:
        g10 = g[0].reference_points[1] - g[1].reference_points[0]
        g23 = g[0].reference_points[2] - g[1].reference_points[3]
        r = np.degrees(
            np.arccos(
                (g10[0] * g23[0] + g10[1] * g23[1]) / (self._compute_p2(i, g)[0] * self._compute_p3(i, g)[0] + 1e-9)
            )
        )

        code = self.check_interval([-1, 1], r, 1)

        return (r, code)

    def _compute_p5(self, i: int, g: Gap) -> np.float32:
        g01 = g[1].reference_points[0] - g[0].reference_points[1]
        g21 = g[0].reference_points[2] - g[0].reference_points[1]
        return (
            (g01[0] * g21[0] + g01[1] * g21[1]) / (np.linalg.norm(g21) + 1e-9),
            None
        )

    def _compute_p6(self, i: int, g: Gap) -> np.float32:
        g121 = g[0].reference_points[2] - g[0].reference_points[1]
        g01 = g[1].reference_points[0] - g[0].reference_points[1]

        r = np.degrees(
            np.arccos(
                (g01[0] * g121[0] + g01[1] * g121[1]) / (np.linalg.norm(g01) * np.linalg.norm(g121) + 1e-9)
            )
        )

        return (r, None)

    def _compute_p7(self, i: int, g: Gap) -> np.float32:
        g10 = g[1].reference_points[1] - g[1].reference_points[0]
        g21 = g[0].reference_points[2] - g[0].reference_points[1]
        r = None if not ("S1" in g.name or "L5" in g.name) else np.degrees(
            np.arccos(
                (g10[0] * g21[0] + g10[1] * g21[1]) / (np.linalg.norm(g10) * np.linalg.norm(g21) + 1e-9)
            )
        )

        code = None
        if self.projection == "side" and r is not None:
            code = self.check_interval([-141, -120, -75, -35], r, 3)
        
        return (r, code)

class Segment_Parameters(Parameters):
    def __init__(self, segment_objects: list[Segment], projection: Literal["side", "frontal"]):
        super().__init__(segment_objects)

        self.projection = projection

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
        
        if projection == "side":
            self._COLUMNS = [
                (
                    "Радиус дуги", 
                    self._compute_p1,
                    {
                        
                    }
                ),
                (
                    "Длина хорды дуги",
                    self._compute_p2,
                    {

                    }
                ),
                (
                    "Центральный угол дуги",
                    self._compute_p3,
                    {
                        -3: {
                            "L5-L1": "Гиперлордоз поясничного отдела 3 ст.. Величина центрального угла {val:.2f}°"
                        },
                        -2: {
                            "Th9-Th5": "Кифоз средне-грудного отдела лордозирован. Величина центрального угла {val:.2f}°",
                            "Th12-Th9": "Нижне-грудной отдела лордозирован. Величина центрального угла {val:.2f}°",
                            "L5-L1": "Гиперлордоз поясничного отдела 2 ст.. Величина центрального угла {val:.2f}°"
                        },
                        -1: {
                            "C7-C2": "Гиперлордоз шейного отдела позвоночника. Величина центрального угла {val:.2f}°",
                            "Th9-Th5": "Кифоз средне-грудного отдела сглажен. Величина центрального угла {val:.2f}°",
                            "Th12-Th9": "Кифоз нижне-грудного отдела сглажен. Величина центрального угла {val:.2f}°",
                            "L5-L1": "Гиперлордоз поясничного отдела 1 ст.. Величина центрального угла {val:.2f}°"
                        },
                        0: {
                            "C7-C2": "Лордоз шейного отдела позвоночника не изменен",
                            "Th5-Th1": "Кифоз верхне-грудного отдела не изменен",
                            "Th9-Th5": "Кифоз средне-грудного отдела не изменен",
                            "Th12-Th9": "Кифоз нижне-грудного отдела не изменен",
                            "L5-L1": "Лордоз поясничного отдела не изменен"
                        },
                        1: {
                            "C7-C2": "Лордоз шейного отдела позвоночника сглажен. Величина центрального угла {val:.2f}°",
                            "Th5-Th1": "Кифотическая деформация средне-грудного отдела усилен 1 ст.. Величина центрального угла {val:.2f}°",
                            "Th9-Th5": "Кифотическая деформация средне-грудного отдела 1 ст.. Величина центрального угла {val:.2f}°",
                            "Th12-Th9": "Кифотическая деформация средне-грудного отдела 1 ст.. Величина центрального угла {val:.2f}°",
                            "L5-L1": "Кифотическая деформация поясничного отдела 1 ст.. Величина центрального угла {val:.2f}°"
                        },
                        2: {
                            "C7-C2": "Кифотическая деформация шейного отдела позвоночника 2 ст.. Величина центрального угла {val:.2f}°",
                            "Th5-Th1": "Кифотическая деформация верхне-грудного отдела 2 ст.. Величина центрального угла {val:.2f}°",
                            "Th9-Th5": "Кифотическая деформация средне-грудного отдела 2 ст.. Величина центрального угла {val:.2f}°",
                            "Th12-Th9": "Кифотическая деформация нижне-грудного отдела 2 ст.. Величина центрального угла {val:.2f}°",
                            "L5-L1": "Кифотическая деформация поясничного отдела 2 ст.. Величина центрального угла {val:.2f}°"
                        },
                        3: {
                            "C7-C2": "Кифотическая деформация шейного отдела позвоночника 3 ст.. Величина центрального угла {val:.2f}°",
                            "Th5-Th1": "Кифотическая деформация средне-грудного отдела 3 ст.. Величина центрального угла {val:.2f}°",
                            "Th9-Th5": "Кифотическая деформация средне-грудного отдела 3 ст.. Величина центрального угла {val:.2f}°",
                            "Th12-Th9": "Кифотическая деформация нижне-грудного отдела 3 ст.. Величина центрального угла {val:.2f}°",
                            "L5-L1": "Кифотическая деформация поясничного отдела 3 ст.. Величина центрального угла {val:.2f}°"
                        },
                        4: {
                            "C7-C2": "Кифотическая деформация шейного отдела позвоночника 4 ст.. Величина центрального угла {val:.2f}°",
                            "L5-L1": "Кифотическая деформация поясничного отдела 4 ст.. Величина ентрального угла {val:.2f}°"
                        }
                    }
                ),
                (
                    "Угол наклона хорды дуги",
                    self._compute_p4,
                    {
                        -1: {
                            "C7-C2": "Шейный отдел позвоночника наклонен кзади. Угол наклона {val:.2f}°",
                            "Th5-Th1": "Верхне-грудной отдел позвоночника наклонен вперед. Угол наклона {val:.2f}°",
                            "Th9-Th5": "Средне-грудной отдел позвоночника наклонен кзади. Угол наклона {val:.2f}°",
                            "Th12-Th9": "Нижне-грудной отдел позвоночника наклонен кзади. Угол наклона {val:.2f}°",
                            "Th12-Th5": "Средне-нижне-грудной отдел отклонен кзади. Угол наклона {val:.2f}°",
                            "Th12-Th1": "Грудной отдел отклонен кзади. Угол наклона {val:.2f}°",
                            "L5-L1": "Поясничный отдел позвоночника отклонен кзади. Угол наклона {val:.2f}°"
                        },
                        0: {
                            "C7-C2": "Ориентация шейного отдела позвоночника в сагиттальной плоскости не изменена",
                            "Th5-Th1": "Ориентация верхне-грудного отдела позвоночника в сагиттальной плоскости не изменена",
                            "Th9-Th5": "Ориентация средне-грудного отдела позвоночника в сагиттальной плоскости не изменена",
                            "Th12-Th9": "Ориентация нижне-грудного отдела позвоночника в сагиттальной плоскости не изменена",
                            "Th12-Th5": "Наклон средне-нижне-грудного отдела не изменен",
                            "Th12-Th1": "Наклон грудного отдела не изменен",
                            "L5-L1": "Наклон поясничного отдела не изменен"
                        },
                        1: {
                            "C7-C2": "Шейный отдел позвоночника наклонен вперед. Угол наклона {val:.2f}°",
                            "Th5-Th1": "Верхне-грудной отдел позвоночника наклонен кзади. Угол наклона {val:.2f}°",
                            "Th9-Th5": "Средне-грудной отдел позвоночника наклонен вперед. Угол наклона {val:.2f}°",
                            "Th12-Th9": "Нижне-грудной отдел позвоночника наклонен вперед. Угол наклона {val:.2f}°",
                            "Th12-Th5": "Средне-нижне-грудной отдел отклонен вперед. Угол наклона {val:.2f}°",
                            "Th12-Th1": "Грудной отдел отклонен вперед. Угол наклона {val:.2f}°",
                            "L5-L1": "Поясничный отдел позвоночника отклонен кпереди 1 ст.. Угол наклона {val:.2f}°"
                        },
                        2: {
                            "L5-L1": "Поясничный отдел позвоночника отклонен кпереди 2 ст.. Угол наклона {val:.2f}°"
                        },
                        3: {
                            "L5-L1": "Поясничный отдел позвоночника отклонен кпереди 3 ст.. Угол наклона {val:.2f}°"
                        }
                    }
                )
            ]
        else:
            self._COLUMNS = [
                (
                    "Радиус дуги",
                    self._compute_p1,
                    {

                    }
                ),
                (
                    "Длина хорды дуги",
                    self._compute_p2,
                    {

                    }
                ),
                (
                    "Центральный угол дуги",
                    self._compute_p3,
                    {
                        -1: {
                            "L5-Th1": "Форма позвоночника во фронтальной плоскости имеет патологические изменения"
                        },
                        0: {
                            "L5-Th1": "Форма грудного и поясничного отделов позвоночника во фронтальной плоскости не изменена"
                        },
                        1: {
                            "L5-Th1": "Форма позвоночника во фронтальной плоскости имеет патологические изменения"
                        },
                    }
                ),
                (
                    "Угол наклона хорды дуги",
                    self._compute_p4,
                    {
                        
                    }
                )
            ]

        self._compute()

    def _compute(self):
        for i, o in enumerate(self._objects):
            for p_ind, p in enumerate(self._COLUMNS, start=1):
                param_name = f"{p_ind}. {p[0]}"
                r = p[1](i, o)

                if r[0] is not None:
                    result = np.float32(r[0])

                    self.dataframe.loc[param_name, o.name] = result
                    if r[1] is not None:
                        self.codeframe.loc[param_name, o.name] = r[1]
                        if r[1] in list(p[2].keys()):
                            keys = list(p[2][r[1]].keys())
                            vers = o.name.split('-')
                            
                            if o.name in keys:
                                self.strframe.loc[param_name, o.name] = p[2][r[1]][o.name].format(name=o.name, name_d=vers[0], name_u=vers[1], val=result)
                            elif "default" in keys:
                                self.strframe.loc[param_name, o.name] = p[2][r[1]]["default"].format(name=o.name, name_d=vers[0], name_u=vers[1], val=result)

    def _compute_p1(self, i: int, s: Segment) -> np.float32:
        return (
            0.5 * np.sqrt(self._abc[i][1] ** 2 + self._abc[i][2] ** 2 - 4 * self._abc[i][0]),
            None
        )
    
    def _compute_p2(self, i: int, s: Segment) -> np.float32:
        R = self._compute_p1(i, s)[0]
        return (
            min(
                np.linalg.norm(
                    np.average(s.vertebraes[0].reference_points[[0, 3]], axis=1) - np.average(s.vertebraes[-1].reference_points[[1, 2]], axis=1)
                ),
                2 * R
            ),
            None
        )

    def _compute_p3(self, i: int, s: Segment) -> np.float32:
        R = self._compute_p1(i, s)[0]
        L = self._compute_p2(i, s)[0]
        r = np.degrees(
            np.arccos(
                (2 * R * R - L * L) / (2 * R * R + 1e-9)
            )
        )

        code = None
        if self.projection == "side":
            if s.name == "C7-C2":
                code = self.check_interval([-40, -15, 15, 30], r, 1)
            elif s.name == "Th5-Th1":
                code = self.check_interval([8, 26, 41, 60], r, 1)
            elif s.name == "Th9-Th5":
                code = self.check_interval([0, 15, 44, 61, 80], r, 2)
            elif s.name == "Th12-Th9":
                code = self.check_interval([0, 8, 30, 40, 60], r, 2)
            elif s.name == "L5-L1":
                code = self.check_interval([-90, -70, -56, -30, 0, 20, 40], r, 3)
        else:
            if s.name == "L5-Th1":
                code = self.check_interval([-5, 5], r, 1)

        return (r, code)
    
    def _compute_p4(self, i: int, s: Segment) -> np.float32:
        v = np.average(s.vertebraes[0].reference_points[[0, 3]], axis=1) - np.average(s.vertebraes[-1].reference_points[[1, 2]], axis=1)
        r = np.degrees(
            np.arctan(
                v[1] / (v[0] + 1e-9)
            )
        )

        code = None
        if self.projection == "side":
            if s.name == "C7-C2":
                code = self.check_interval([-7, 1.5], r, 1)
            elif s.name == "Th5-Th1":
                code = self.check_interval([10, 20], r, 1)
            elif s.name == "Th9-Th5":
                code = self.check_interval([-2, 4], r, 1)
            elif s.name == "Th12-Th9":
                code = self.check_interval([-19, -12], r, 1)
            elif s.name == "Th12-Th5":
                code = self.check_interval([-14, -4], r, 1)
            elif s.name == "Th12-Th1":
                code = self.check_interval([-2, 1], r, 1)
            elif s.name == "L5-L1":
                code = self.check_interval([-18, -4, 11, 26], r, 1)

        return (r, code)

class Spine_Parameters(Parameters):
    def __init__(self, spine: Spine, projection: Literal["side", "frontal"]):
        super().__init__([spine])
  
        self.projection = projection

        if projection == "side":
            self._COLUMNS = [
                (
                    "Угол наклона оси туловища Th1-L5", 
                    self._compute_p1,
                    {
                        -1: {
                            "default": "Ось туловища наклонена назад"
                        },
                        0: {
                            "default": "Ориентация оси туловища не изменена"
                        },
                        1: {
                            "default": "Ось туловища наклонена вперед"
                        }
                    }
                ),
                (
                    "Длина оси туловища Th1-L5",
                    self._compute_p2,
                    {

                    }
                ),
                (
                    "Проекция ОГЦМ",
                    self._compute_p3,
                    {

                    }
                ),
            ]
        else:
            self._COLUMNS = [
                (
                    "Угол наклона оси туловища Th1-L5", 
                    self._compute_p1,
                    {

                    }
                ),
                (
                    "Длина оси туловища Th1-L5",
                    self._compute_p2,
                    {

                    }
                ),
                (
                    "Проекция ОГЦМ",
                    self._compute_p3,
                    {

                    }
                ),
            ]

        self._compute()

    def _compute(self):
        for i, o in enumerate(self._objects):
            for p_ind, p in enumerate(self._COLUMNS, start=1):
                param_name = f"{p_ind}. {p[0]}"
                r = p[1](i, o)

                if r[0] is not None:
                    result = np.float32(r[0])

                    self.dataframe.loc[param_name, o.name] = result
                    if r[1] is not None:
                        self.codeframe.loc[param_name, o.name] = r[1]
                        if r[1] in list(p[2].keys()):
                            keys = list(p[2][r[1]].keys())

                            if o.name in keys:
                                self.strframe.loc[param_name, o.name] = p[2][r[1]][o.name].format(name=o.name, val=result)
                            elif "default" in keys:
                                self.strframe.loc[param_name, o.name] = p[2][r[1]]["default"].format(name=o.name, val=result)

    def _compute_p1(self, i: int, s: Spine) -> np.float32:
        r = np.degrees(
            np.arctan((s.vertebraes[1].reference_points[0, 0] - s.vertebraes[17].reference_points[1, 0]) / (s.vertebraes[1].reference_points[0, 1] - s.vertebraes[17].reference_points[1, 1] + 1e-9))
        )

        code = None
        if self.projection == "side":
            code = self.check_interval([-9, -6], r, 1)

        return (r, code)
    
    def _compute_p2(self, i: int, s: Spine) -> np.float32:
        return (
            np.linalg.norm(
                s.vertebraes[1].reference_points[0] - s.vertebraes[17].reference_points[1]
            ),
            None
        )

    def _compute_p3(self, i: int, s: Spine) -> np.float32:
        return (
            self._compute_p2(i, s)[0] * np.sin(self._compute_p1(i, s)[0]) / 2,
            None
        )
