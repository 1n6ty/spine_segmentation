from abc import abstractmethod, ABC
import numpy as np

from segmentation.interpolation.types import Parametrization

class vPath(ABC):
    @abstractmethod
    def get_vertebrae_parametrization(self, vind: int) -> Parametrization:
        raise NotImplementedError()
    
    @abstractmethod
    def f(self, t: np.float32) -> np.ndarray[np.float32]:
        raise NotImplementedError()
    
    @abstractmethod
    def df(self, t: np.float32) -> np.ndarray[np.float32]:
        raise NotImplementedError()
    
    @abstractmethod
    def fn(self, t: np.float32) -> np.ndarray[np.float32]:
        raise NotImplementedError()
    