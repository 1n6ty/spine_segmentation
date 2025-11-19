from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from segmentation.elements.vertebrae import Vertebrae

class Segment:
    def __init__(self, vertebraes: list) -> None:
        self.name = f"{vertebraes[0].name}-{vertebraes[-1].name}"
        self.vertebraes = vertebraes