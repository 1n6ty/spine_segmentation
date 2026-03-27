from dataclasses import dataclass

from django.db.models import Q, Model

@dataclass
class DatasetField:
    source: str | None
    type: str
    permissions: list
    description: str

@dataclass
class DatasetSpec:
    name: str
    model: type[Model]
    fields: dict[str, DatasetField]
    default_filters: Q
    permissions: list
    description: str
