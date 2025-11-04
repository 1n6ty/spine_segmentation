from typing import Callable, Any
import numpy as np
import pandas as pd

class Parameters:
    _objects: list[Any]
    _COLUMNS: list[tuple[str, Callable[[int, Any], Any]]] = []

    def __init__(self, objects: list[Any]):
        self.dataframe: pd.DataFrame = pd.DataFrame()
        self._objects = objects

    def _compute(self):
        for i, o in enumerate(self._objects):
            for p in self._COLUMNS:
                self.dataframe.loc[p[0], o.name] = p[1](i, o)

    def set_parameter_object_names(self, names: list[str]) -> None:
        for n in names:
            self.dataframe[n] = pd.NA

    def write2csv(self, file: str) -> None:
        self.dataframe.to_csv(file, float_format="%.2f")