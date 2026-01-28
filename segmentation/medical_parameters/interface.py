from typing import Callable, Any
import numpy as np
import pandas as pd

class Parameters:
    _objects: list[Any]
    _COLUMNS: list[tuple[str, Callable[[int, Any], tuple[float, int]], dict[int, dict[str, str]]]] = []

    def __init__(self, objects: list[Any]):
        self.dataframe: pd.DataFrame = pd.DataFrame()
        self.codeframe: pd.DataFrame = pd.DataFrame()
        self.strframe: pd.DataFrame = pd.DataFrame()
        self._objects = objects

    def _compute(self):
        for i, o in enumerate(self._objects):
            for p in self._COLUMNS:
                try:
                    r = p[1](i, o)
                    self.dataframe.loc[p[0], o.name] = np.float32(r[0])
                    self.codeframe.loc[p[0], o.name] = r[1] if r[1] is not None else pd.NA
                    if r[1] is not None:
                        keys = list(p[2][r[1]].keys())
                        if o.name in keys:
                            self.strframe.loc[p[0], o.name] = p[2][r[1]][o.name].format(name=o.name, val=np.float32(r[0]))
                        elif "default" in keys:
                            self.strframe.loc[p[0], o.name] = p[2][r[1]]["default"].format(name=o.name, val=np.float32(r[0]))
                        else:
                            self.strframe.loc[p[0], o.name] = pd.NA
                    else:
                        self.strframe.loc[p[0], o.name] = pd.NA
                except:
                    self.dataframe.loc[p[0], o.name] = pd.NA
                    self.codeframe.loc[p[0], o.name] = pd.NA
                    self.strframe.loc[p[0], o.name] = pd.NA

    @staticmethod
    def check_interval(arr: list[int], val: float, default_interval: int) -> int:
        if val <= arr[0]:
            return -default_interval
        for i in range(0, len(arr) - 1):
            if arr[i] < val <= arr[i + 1]:
                return i + 1 - default_interval
        return len(arr) - default_interval

    def write2csv(self, file: str) -> None:
        self.dataframe.to_csv(file, float_format="%.2f")